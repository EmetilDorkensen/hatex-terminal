import { Resend } from 'resend';

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

const FROM = 'HatexCard <notifications@hatexcard.com>';

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
  const resend = getResend();
  if (!resend) return;

  const amount = Number(payload.amount || 0).toLocaleString();
  const days = payload.intervalDays || 30;
  const plan = payload.planTitle || 'Abònman';
  const desc = payload.description ? `<p>Detay: ${escapeHtml(payload.description)}</p>` : '';

  const jobs: Promise<unknown>[] = [];

  if (payload.buyerEmail) {
    jobs.push(
      resend.emails.send({
        from: FROM,
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
        from: FROM,
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

type LowBalancePayload = {
  buyerEmail?: string | null;
  buyerName?: string | null;
  merchantEmail?: string | null;
  merchantName?: string | null;
  planTitle: string;
  amount: number;
  nextBillingDate: string;
  cardBalance?: number | null;
};

/** 2 jou alavans: kat pa gen ase kob pou renouvèlman — kliyan + machann. */
export async function sendSubscriptionLowBalanceWarningEmails(
  payload: LowBalancePayload
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const plan = payload.planTitle || 'Abònman';
  const amount = Number(payload.amount || 0).toLocaleString();
  const when = formatHtDate(payload.nextBillingDate);
  const bal =
    payload.cardBalance != null ? Number(payload.cardBalance).toLocaleString() : null;

  const jobs: Promise<unknown>[] = [];

  if (payload.buyerEmail) {
    jobs.push(
      resend.emails.send({
        from: FROM,
        to: payload.buyerEmail,
        subject: `Kat ou pa gen ase kob pou renouvèlman: ${plan}`,
        html: `
          <p>Bonjou ${escapeHtml(payload.buyerName || '')},</p>
          <p>Abònman <b>${escapeHtml(plan)}</b> ap renouvle nan <b>${escapeHtml(when)}</b>
          (${amount} HTG).</p>
          <p><b>Kat HatexCard ou pa gen ase kob</b> pou debit la.
          ${bal != null ? `Balans kat: <b>${bal} HTG</b>.` : ''}</p>
          <p>Tanpri rechaje kat ou anvan dat la pou abònman an rete aktif.</p>
          <p>— Ekip HatexCard</p>
        `,
      })
    );
  }

  if (payload.merchantEmail) {
    jobs.push(
      resend.emails.send({
        from: FROM,
        to: payload.merchantEmail,
        subject: `Avètisman: kliyan ka rate renouvèlman — ${plan}`,
        html: `
          <p>Bonjou ${escapeHtml(payload.merchantName || '')},</p>
          <p>Kliyan <b>${escapeHtml(payload.buyerName || 'N/A')}</b>
          (${escapeHtml(payload.buyerEmail || 'N/A')}) gen abònman
          <b>${escapeHtml(plan)}</b> ki dwe renouvle <b>${escapeHtml(when)}</b>
          (${amount} HTG).</p>
          <p>Kat kliyan an <b>pa gen ase kob</b> pou debit la kounye a.
          Nou deja avèti kliyan an pa imèl.</p>
          <p>— Ekip HatexCard</p>
        `,
      })
    );
  }

  await Promise.allSettled(jobs);
}

type NonRenewalPayload = {
  merchantEmail?: string | null;
  merchantName?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  planTitle: string;
  amount: number;
  nextBillingDate: string;
  status: string;
};

/** 2 jou apre: kliyan pa renouvle — imèl sèlman bay machann. */
export async function sendSubscriptionNonRenewalMerchantEmail(
  payload: NonRenewalPayload
): Promise<void> {
  const resend = getResend();
  if (!resend || !payload.merchantEmail) return;

  const plan = payload.planTitle || 'Abònman';
  const amount = Number(payload.amount || 0).toLocaleString();
  const when = formatHtDate(payload.nextBillingDate);
  const buyer = payload.buyerName || 'Kliyan';

  await resend.emails.send({
    from: FROM,
    to: payload.merchantEmail,
    subject: `Kliyan pa renouvle abònman: ${buyer} — ${plan}`,
    html: `
      <p>Bonjou ${escapeHtml(payload.merchantName || '')},</p>
      <p>Kliyan <b>${escapeHtml(buyer)}</b>
      ${payload.buyerEmail ? `(${escapeHtml(payload.buyerEmail)})` : ''}
      <b>pa renouvle</b> abònman <b>${escapeHtml(plan)}</b>.</p>
      <p>Dat debit te: <b>${escapeHtml(when)}</b> · Montan: <b>${amount} HTG</b>.</p>
      <p>Estati: <b>${escapeHtml(payload.status)}</b>.</p>
      <p>Ou ka swiv nan Terminal → Rezèvasyon → Abònman.</p>
      <p>— Ekip HatexCard</p>
    `,
  });
}

function formatHtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-HT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
