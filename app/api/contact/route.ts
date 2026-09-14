import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { notifyStaffOfContactMessage } from '@/lib/contact/notify-staff';

export const dynamic = 'force-dynamic';

const CHANNELS = ['support', 'business', 'contact'] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABEL: Record<Channel, string> = {
  support: 'Sipò Kliyan',
  business: 'Biznis & Patenarya',
  contact: 'Kontak / Sekirite',
};

const BUCKET = 'contact-attachments';
const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length <= 200;
}

function asString(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v : '';
}

/**
 * POST /api/contact
 * multipart/form-data: channel, name, email, subject, message, website?, photos[]
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`contact-form:${ip}`, 8, 600);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Twòp demann. Eseye ankò nan kèk minit.' },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Fòm pa valab. Eseye ankò.' },
      { status: 400 }
    );
  }

  // Honeypot
  if (asString(form.get('website')).trim()) {
    return NextResponse.json({ ok: true, message: 'Mesaj ou resevwa.' });
  }

  const channelRaw = asString(form.get('channel')).trim().toLowerCase();
  const channel = (CHANNELS.includes(channelRaw as Channel) ? channelRaw : 'support') as Channel;
  const fromName = asString(form.get('name')).trim().slice(0, 120);
  const fromEmail = asString(form.get('email')).trim().toLowerCase().slice(0, 200);
  const subject = asString(form.get('subject')).trim().slice(0, 200);
  const message = asString(form.get('message')).trim().slice(0, 5000);

  if (!fromName || fromName.length < 2) {
    return NextResponse.json({ ok: false, message: 'Antre non ou.' }, { status: 400 });
  }
  if (!isValidEmail(fromEmail)) {
    return NextResponse.json({ ok: false, message: 'Imèl pa valab.' }, { status: 400 });
  }
  if (!subject || subject.length < 3) {
    return NextResponse.json({ ok: false, message: 'Antre yon sijè.' }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json(
      { ok: false, message: 'Mesaj la twò kout (omwen 10 karaktè).' },
      { status: 400 }
    );
  }

  const fileEntries = form
    .getAll('photos')
    .filter((f): f is File => typeof File !== 'undefined' && f instanceof File && f.size > 0);

  if (fileEntries.length > MAX_FILES) {
    return NextResponse.json(
      { ok: false, message: `Ou ka voye jiska ${MAX_FILES} foto / fichye.` },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const attachmentPaths: string[] = [];
  const inboxId = crypto.randomUUID();

  for (const file of fileEntries) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, message: 'Chak foto/fichye dwe pi piti pase 5 MB.' },
        { status: 400 }
      );
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    let mime = file.type;
    if (!mime || !ALLOWED_MIME.has(mime)) {
      mime = EXT_TO_MIME[ext] || '';
    }
    if (!mime || !ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Kalite fichye pa aksepte. Itilize JPG, PNG, WEBP, HEIC oswa PDF.',
        },
        { status: 400 }
      );
    }
    const finalExt = EXT_TO_MIME[ext] ? ext : mime === 'application/pdf' ? 'pdf' : 'jpg';
    const path = `${inboxId}/${Date.now()}_${attachmentPaths.length + 1}.${finalExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) {
      console.error('[contact] upload error:', upErr.message);
      return NextResponse.json(
        { ok: false, message: 'Pa t kapab telechaje foto a. Eseye ankò.' },
        { status: 500 }
      );
    }
    attachmentPaths.push(path);
  }

  const { data, error } = await admin
    .from('contact_inbox')
    .insert({
      id: inboxId,
      channel,
      from_name: fromName,
      from_email: fromEmail,
      subject,
      body: message,
      status: 'open',
      source: 'web_form',
      attachment_paths: attachmentPaths,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[contact] insert error:', error?.message);
    if (attachmentPaths.length) {
      await admin.storage.from(BUCKET).remove(attachmentPaths).catch(() => {});
    }
    return NextResponse.json(
      { ok: false, message: 'Pa t kapab voye mesaj la. Eseye ankò.' },
      { status: 500 }
    );
  }

  void notifyStaffOfContactMessage({
    channelLabel: CHANNEL_LABEL[channel] || channel,
    fromName,
    fromEmail,
    subject,
    body: message,
    source: 'web_form',
    attachmentCount: attachmentPaths.length,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    id: data.id,
    message: 'Mesaj ou resevwa. Ekip nou an ap reponn ba ou pa imèl.',
  });
}
