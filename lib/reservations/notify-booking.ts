import { Resend } from 'resend';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatHtDate(iso?: string | null): string {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleString('fr-HT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

export type BookingNotifyPayload = {
  merchantEmail?: string | null;
  merchantName?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  listingTitle: string;
  category?: string | null;
  amount: number;
  scheduledAt?: string | null;
  scheduledEnd?: string | null;
  quantity?: number | null;
  deliveryRequested?: boolean;
  deliveryAddress?: string | null;
  customerNote?: string | null;
  paymentMethod?: string | null;
  referenceId?: string | null;
};

/** Imèl notifikasyon bay machann apre yon rezèvasyon peye. Never throws. */
export async function sendReservationPaidMerchantEmail(
  payload: BookingNotifyPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !payload.merchantEmail) return;

  const resend = new Resend(apiKey);
  const amount = Number(payload.amount || 0).toLocaleString();
  const note = String(payload.customerNote || '').trim();
  const isSub = payload.category === 'subscription';
  const title = payload.listingTitle || (isSub ? 'Abònman' : 'Rezèvasyon');

  const rows = [
    `<tr><td style="padding:6px 0;color:#64748b;">Kliyan</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(payload.buyerName || 'N/A')}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#64748b;">Email</td><td style="padding:6px 0;">${escapeHtml(payload.buyerEmail || 'N/A')}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#64748b;">Ofri</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(title)}</td></tr>`,
    !isSub
      ? `<tr><td style="padding:6px 0;color:#64748b;">Dat / lè</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(formatHtDate(payload.scheduledAt))}</td></tr>`
      : '',
    payload.scheduledEnd
      ? `<tr><td style="padding:6px 0;color:#64748b;">Jiska</td><td style="padding:6px 0;">${escapeHtml(formatHtDate(payload.scheduledEnd))}</td></tr>`
      : '',
    payload.quantity && Number(payload.quantity) > 1
      ? `<tr><td style="padding:6px 0;color:#64748b;">Kantite</td><td style="padding:6px 0;">${Number(payload.quantity)}</td></tr>`
      : '',
    payload.deliveryRequested
      ? `<tr><td style="padding:6px 0;color:#64748b;">Livrezon</td><td style="padding:6px 0;">${escapeHtml(payload.deliveryAddress || 'Wi')}</td></tr>`
      : '',
    `<tr><td style="padding:6px 0;color:#64748b;">Montan</td><td style="padding:6px 0;font-weight:700;color:#4f46e5;">${amount} HTG</td></tr>`,
    payload.paymentMethod
      ? `<tr><td style="padding:6px 0;color:#64748b;">Peman</td><td style="padding:6px 0;">${escapeHtml(payload.paymentMethod)}</td></tr>`
      : '',
    payload.referenceId
      ? `<tr><td style="padding:6px 0;color:#64748b;">Ref</td><td style="padding:6px 0;font-family:monospace;">${escapeHtml(payload.referenceId)}</td></tr>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const noteBlock = note
    ? `<div style="margin-top:16px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
         <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;">Nòt kliyan</p>
         <p style="margin:0;color:#0f172a;white-space:pre-wrap;">${escapeHtml(note)}</p>
       </div>`
    : '';

  await resend.emails.send({
    from: 'HatexCard <notifications@hatexcard.com>',
    to: payload.merchantEmail,
    subject: isSub
      ? `Nouvo abònman: ${payload.buyerName || 'Kliyan'} — ${title}`
      : `Nouvo rezèvasyon: ${payload.buyerName || 'Kliyan'} — ${title}`,
    html: `
      <p>Bonjou ${escapeHtml(payload.merchantName || '')},</p>
      <p>Ou resevwa yon ${isSub ? 'abònman' : 'rezèvasyon'} peye sou HatexCard.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>
      ${noteBlock}
      <p style="margin-top:20px;color:#64748b;font-size:12px;">Gade nan Terminal → Rezèvasyon.</p>
      <p>— Ekip HatexCard</p>
    `,
  });
}
