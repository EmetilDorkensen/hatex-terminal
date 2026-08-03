import { Resend } from 'resend';

type SubEmailPayload = {
  buyerEmail?: string | null;
  buyerName?: string | null;
  merchantEmail?: string | null;
  merchantName?: string | null;
  planTitle: string;
  amount: number;
  intervalDays: number;
  description?: string | null;
};

/** Notify buyer + merchant after a marketplace subscription payment. Never throws. */
export async function sendSubscriptionPaidEmails(payload: SubEmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const from = 'HatexCard <notifications@hatexcard.com>';
  const amount = Number(payload.amount || 0).toLocaleString();
  const days = payload.intervalDays || 30;
  const plan = payload.planTitle || 'Abònman';
  const desc = payload.description ? `<p>Detay: ${escapeHtml(payload.description)}</p>` : '';

  const jobs: Promise<unknown>[] = [];

  if (payload.buyerEmail) {
    jobs.push(
      resend.emails.send({
        from,
        to: payload.buyerEmail,
        subject: `Abònman aktive: ${plan}`,
        html: `
          <p>Bonjou ${escapeHtml(payload.buyerName || '')},</p>
          <p>Ou peye abònman <b>${escapeHtml(plan)}</b> sou HatexCard.</p>
          <p>Montan: <b>${amount} HTG</b> — debit chak <b>${days}</b> jou.</p>
          ${desc}
          <p>Ou ka anile abònman an nenpòt lè nan <b>Rezèvasyon → Abònman mwen</b>.</p>
          <p>— Ekip HatexCard</p>
        `,
      })
    );
  }

  if (payload.merchantEmail) {
    jobs.push(
      resend.emails.send({
        from,
        to: payload.merchantEmail,
        subject: `Nouvo lavant abònman: ${plan}`,
        html: `
          <p>Bonjou ${escapeHtml(payload.merchantName || '')},</p>
          <p>Yon kliyan peye abònman <b>${escapeHtml(plan)}</b>.</p>
          <p>Montan: <b>${amount} HTG</b> (kredi nan wallet ou).</p>
          <p>Kliyan: ${escapeHtml(payload.buyerName || 'N/A')} (${escapeHtml(payload.buyerEmail || 'N/A')})</p>
          ${desc}
          <p>Debit: chak ${days} jou jiskaske kliyan an anile.</p>
          <p>— Ekip HatexCard</p>
        `,
      })
    );
  }

  await Promise.allSettled(jobs);
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
