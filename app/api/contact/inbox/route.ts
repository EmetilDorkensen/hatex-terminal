import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { sendMail, escapeHtml, shellHtml } from '@/lib/notify/email';

export const dynamic = 'force-dynamic';

const CHANNEL_LABEL: Record<string, string> = {
  support: 'Sipò Kliyan',
  business: 'Biznis & Patenarya',
  contact: 'Kontak / Sekirite',
};

async function requireInboxOperator(email: string | undefined, userId: string | undefined) {
  if (!email || !userId) {
    return { ok: false as const, status: 401, message: 'Ou dwe konekte.' };
  }
  const gate = await assertFinanceOperatorWithGate(email);
  if (!gate.ok) {
    return {
      ok: false as const,
      status: 403,
      message: 'Aksè refize. Antre gate admin/workspace anvan.',
    };
  }
  if (gate.role === 'staff') {
    const db = createSupabaseAdminClient();
    const { data: staff } = await db
      .from('staff_users')
      .select('role')
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'active')
      .maybeSingle();
    if (!staff || !['support', 'super_admin'].includes(String(staff.role))) {
      return {
        ok: false as const,
        status: 403,
        message: 'Wòl ou pa gen dwa jere bwat mesaj la.',
      };
    }
  }
  return { ok: true as const, email, userId, role: gate.role };
}

/** GET — lis mesaj inbox (admin + staff sipò). */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`contact-inbox-get:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const auth = await requireInboxOperator(user?.email, user?.id);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || '').trim();
  const id = (url.searchParams.get('id') || '').trim();

  const db = createSupabaseAdminClient();

  if (id) {
    const { data: row, error } = await db.from('contact_inbox').select('*').eq('id', id).maybeSingle();
    if (error || !row) {
      return NextResponse.json({ ok: false, message: 'Mesaj pa jwenn.' }, { status: 404 });
    }
    const { data: replies } = await db
      .from('contact_inbox_replies')
      .select('id, body, emailed, created_at, staff_id')
      .eq('inbox_id', id)
      .order('created_at', { ascending: true });

    const paths: string[] = Array.isArray(row.attachment_paths) ? row.attachment_paths : [];
    const attachment_urls: { path: string; url: string }[] = [];
    for (const path of paths) {
      const { data: signed } = await db.storage
        .from('contact-attachments')
        .createSignedUrl(path, 60 * 30);
      if (signed?.signedUrl) {
        attachment_urls.push({ path, url: signed.signedUrl });
      }
    }

    return NextResponse.json({
      ok: true,
      item: { ...row, attachment_urls },
      replies: replies || [],
    });
  }

  let q = db.from('contact_inbox').select('*').order('created_at', { ascending: false }).limit(100);
  if (status && ['open', 'answered', 'closed'].includes(status)) {
    q = q.eq('status', status);
  }
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    items: data || [],
    open_count: (data || []).filter((r) => r.status === 'open').length,
  });
}

/** POST — reponn yon mesaj (voye imèl bay moun nan + sove nan DB). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`contact-inbox-reply:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const auth = await requireInboxOperator(user?.email, user?.id);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const inboxId = String(body.inbox_id || '').trim();
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
  const close = body.close === true;

  if (!inboxId || (!message && !close)) {
    return NextResponse.json({ ok: false, message: 'Mesaj oswa aksyon manke.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: item } = await db.from('contact_inbox').select('*').eq('id', inboxId).maybeSingle();
  if (!item) {
    return NextResponse.json({ ok: false, message: 'Mesaj pa jwenn.' }, { status: 404 });
  }

  // Asire pwofil staff pou FK
  const { data: senderProf } = await db.from('profiles').select('id').eq('id', auth.userId).maybeSingle();
  if (!senderProf) {
    await db.from('profiles').upsert(
      {
        id: auth.userId,
        email: auth.email.trim().toLowerCase(),
        full_name: auth.email.split('@')[0],
        account_status: 'active',
      },
      { onConflict: 'id' }
    );
  }

  let emailed = false;
  if (message) {
    const channelLabel = CHANNEL_LABEL[item.channel] || 'HatexCard';
    const fromByChannel: Record<string, string> = {
      support: 'HatexCard Sipò <support@hatexcard.com>',
      business: 'HatexCard Biznis <business@hatexcard.com>',
      contact: 'HatexCard Kontak <contact@hatexcard.com>',
    };
    const mail = await sendMail({
      to: item.from_email,
      subject: `Re: ${item.subject}`,
      from: fromByChannel[item.channel] || fromByChannel.support,
      html: shellHtml(
        `Repons — ${channelLabel}`,
        `
        <p style="margin:0 0 12px;color:#4b5563;font-size:14px;">Bonjou ${escapeHtml(item.from_name || '')},</p>
        <div style="margin:0 0 16px;padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</div>
        <p style="margin:0;font-size:12px;color:#94a3b8;">Ekip HatexCard · ${escapeHtml(channelLabel)}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Sijè orijinal: ${escapeHtml(item.subject)}</p>
        `
      ),
      logLabel: 'contact:staff-reply',
    });
    emailed = mail.ok === true;

    await db.from('contact_inbox_replies').insert({
      inbox_id: inboxId,
      staff_id: auth.userId,
      body: message,
      emailed,
    });

    await db
      .from('contact_inbox')
      .update({
        status: close ? 'closed' : 'answered',
        updated_at: new Date().toISOString(),
        assigned_to: auth.userId,
      })
      .eq('id', inboxId);
  } else if (close) {
    await db
      .from('contact_inbox')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', inboxId);
  }

  return NextResponse.json({
    ok: true,
    emailed,
    message: message
      ? emailed
        ? 'Repons voye pa imèl epi sove.'
        : 'Repons sove, men imèl la pa t ale (tcheke Brevo).'
      : 'Mesaj fèmen.',
  });
}

/** PATCH — chanje estati sèlman. */
export async function PATCH(request: Request) {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const auth = await requireInboxOperator(user?.email, user?.id);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const inboxId = String(body.inbox_id || '').trim();
  const status = String(body.status || '').trim();
  if (!inboxId || !['open', 'answered', 'closed'].includes(status)) {
    return NextResponse.json({ ok: false, message: 'Paramèt pa valab.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { error } = await db
    .from('contact_inbox')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', inboxId);
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
