/**
 * Lojik pataje: kreye mesaj contact_inbox depi yon imèl inbound.
 */

import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { notifyStaffOfContactMessage } from '@/lib/contact/notify-staff';

export type InboundChannel = 'support' | 'business' | 'contact' | 'notifications';

export const CHANNEL_FROM: Record<InboundChannel, string> = {
  support: 'HatexCard Sipò <support@hatexcard.com>',
  business: 'HatexCard Biznis <business@hatexcard.com>',
  contact: 'HatexCard Kontak <contact@hatexcard.com>',
  notifications: 'HatexCard <notifications@hatexcard.com>',
};

const BUCKET = 'contact-attachments';
const MAX_ATTACH = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export function channelFromRecipient(to: string): InboundChannel {
  const local = to.split('@')[0]?.toLowerCase().trim() || '';
  if (local === 'business') return 'business';
  if (local === 'contact') return 'contact';
  if (local === 'notifications') return 'notifications';
  return 'support';
}

/** Map notifications → contact_inbox channel (DB check: support|business|contact). */
export function inboxChannelOf(ch: InboundChannel): 'support' | 'business' | 'contact' {
  if (ch === 'business') return 'business';
  if (ch === 'contact' || ch === 'notifications') return 'contact';
  return 'support';
}

export type InboundAttachment = {
  filename: string;
  contentType: string;
  /** base64 (san data: prefix) */
  contentBase64: string;
};

export type InboundEmailPayload = {
  fromEmail: string;
  fromName?: string | null;
  toEmail: string;
  subject: string;
  textBody: string;
  messageId?: string | null;
  attachments?: InboundAttachment[];
};

function cleanEmail(raw: string): string {
  const m = /<([^>]+)>/.exec(raw);
  const e = (m ? m[1] : raw).trim().toLowerCase();
  return e.replace(/^mailto:/, '');
}

export async function ingestInboundEmail(
  payload: InboundEmailPayload
): Promise<{ ok: true; id: string } | { ok: false; status: number; message: string }> {
  const fromEmail = cleanEmail(payload.fromEmail);
  if (!fromEmail.includes('@')) {
    return { ok: false, status: 400, message: 'from_email pa valab.' };
  }

  const toEmail = cleanEmail(payload.toEmail || 'support@hatexcard.com');
  const channel = inboxChannelOf(channelFromRecipient(toEmail));
  const subject = (payload.subject || '(San sijè)').trim().slice(0, 200);
  const body = (payload.textBody || '').trim().slice(0, 8000) || '(Mesaj vid)';
  const fromName = (payload.fromName || fromEmail.split('@')[0] || 'Kliyan').trim().slice(0, 120);
  const externalId = payload.messageId?.trim().slice(0, 200) || null;

  const admin = createSupabaseAdminClient();

  if (externalId) {
    const { data: existing } = await admin
      .from('contact_inbox')
      .select('id')
      .eq('external_message_id', externalId)
      .maybeSingle();
    if (existing) {
      return { ok: true, id: existing.id };
    }
  }

  const inboxId = crypto.randomUUID();
  const attachmentPaths: string[] = [];
  const files = (payload.attachments || []).slice(0, MAX_ATTACH);

  for (let i = 0; i < files.length; i++) {
    const att = files[i];
    let mime = (att.contentType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    if (!ALLOWED.has(mime)) {
      const lower = (att.filename || '').toLowerCase();
      if (lower.endsWith('.pdf')) mime = 'application/pdf';
      else if (lower.endsWith('.png')) mime = 'image/png';
      else if (lower.endsWith('.webp')) mime = 'image/webp';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
      else continue; // ignore unsupported
    }
    let buf: Buffer;
    try {
      buf = Buffer.from(att.contentBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    } catch {
      continue;
    }
    if (!buf.length || buf.length > MAX_BYTES) continue;

    const ext =
      mime === 'application/pdf'
        ? 'pdf'
        : mime === 'image/png'
          ? 'png'
          : mime === 'image/webp'
            ? 'webp'
            : 'jpg';
    const path = `${inboxId}/email_${Date.now()}_${i + 1}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buf, {
      contentType: mime,
      upsert: false,
    });
    if (!upErr) attachmentPaths.push(path);
  }

  const { data, error } = await admin
    .from('contact_inbox')
    .insert({
      id: inboxId,
      channel,
      from_name: fromName,
      from_email: fromEmail,
      subject,
      body,
      status: 'open',
      source: 'email',
      external_message_id: externalId,
      attachment_paths: attachmentPaths,
    })
    .select('id')
    .single();

  if (error || !data) {
    if (attachmentPaths.length) {
      await admin.storage.from(BUCKET).remove(attachmentPaths).catch(() => {});
    }
    // Unique violation = deja trete
    if (error?.code === '23505' && externalId) {
      const { data: again } = await admin
        .from('contact_inbox')
        .select('id')
        .eq('external_message_id', externalId)
        .maybeSingle();
      if (again) return { ok: true, id: again.id };
    }
    console.error('[inbound-email] insert:', error?.message);
    return { ok: false, status: 500, message: 'Pa t kapab sove mesaj la.' };
  }

  void notifyStaffOfContactMessage({
    channelLabel:
      channel === 'business'
        ? 'Biznis & Patenarya'
        : channel === 'contact'
          ? 'Kontak / Sekirite'
          : 'Sipò Kliyan',
    fromName,
    fromEmail,
    subject,
    body,
    source: 'email',
    attachmentCount: attachmentPaths.length,
  }).catch(() => {});

  return { ok: true, id: data.id };
}
