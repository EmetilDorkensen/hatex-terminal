/**
 * Voye alèt imèl bay admin + anplwaye sipò lè gen nouvo mesaj kontak.
 */

import { ADMIN_EMAIL } from '@/lib/admin/auth';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { sendMail, escapeHtml, shellHtml } from '@/lib/notify/email';

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function staffNotifyEmails(): Promise<string[]> {
  const set = new Set<string>();

  const envTo =
    process.env.SUPPORT_NOTIFY_EMAIL?.trim() ||
    process.env.CONTACT_NOTIFY_EMAIL?.trim() ||
    '';
  if (envTo && isValidEmail(envTo)) set.add(envTo.toLowerCase());

  // Toujou alèt admin prensipal la
  set.add(ADMIN_EMAIL.toLowerCase());

  try {
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from('staff_users')
      .select('email, role')
      .eq('status', 'active')
      .in('role', ['support', 'super_admin']);
    for (const row of data || []) {
      const e = String(row.email || '').trim().toLowerCase();
      if (isValidEmail(e)) set.add(e);
    }
  } catch {
    /* ignore — admin default already set */
  }

  return [...set];
}

export async function notifyStaffOfContactMessage(opts: {
  channelLabel: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  source: 'web_form' | 'email';
  attachmentCount?: number;
}): Promise<void> {
  const recipients = await staffNotifyEmails();
  if (!recipients.length) return;

  const photoNote =
    (opts.attachmentCount || 0) > 0
      ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;">${opts.attachmentCount} foto/fichye — wè yo nan Admin → Imèl Kontak.</p>`
      : '';

  const sourceLabel = opts.source === 'email' ? 'Imèl inbound' : 'Fòm /kontakte';

  await Promise.allSettled(
    recipients.map((to) =>
      sendMail({
        to,
        subject: `[HatexCard ${opts.channelLabel}] ${opts.subject}`,
        html: shellHtml(
          'Nouvo mesaj kontak',
          `
        <h2 style="margin:0 0 12px;font-size:18px;">Nouvo mesaj — ${escapeHtml(opts.channelLabel)}</h2>
        <p style="margin:0 0 8px;color:#4b5563;font-size:14px;"><strong>Sous:</strong> ${escapeHtml(sourceLabel)}</p>
        <p style="margin:0 0 8px;color:#4b5563;font-size:14px;"><strong>De:</strong> ${escapeHtml(opts.fromName)} &lt;${escapeHtml(opts.fromEmail)}&gt;</p>
        <p style="margin:0 0 8px;color:#4b5563;font-size:14px;"><strong>Sijè:</strong> ${escapeHtml(opts.subject)}</p>
        <div style="margin-top:16px;padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(opts.body.slice(0, 2000))}</div>
        ${photoNote}
        <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Reponn nan Admin → Imèl Kontak oswa Workspace → Kontak Email.</p>
        `
        ),
        logLabel: 'contact:notify-staff',
      })
    )
  );
}
