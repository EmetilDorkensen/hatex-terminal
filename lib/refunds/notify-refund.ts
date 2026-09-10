import { isEmailConfigured, sendMail, escapeHtml } from '@/lib/notify/email';

/**
 * Imèl ranbousman — sa a se yon modil pataje (se pa yon fonksyonalite rezèvasyon).
 * Te sitye nan lib/reservations/notify-refund.ts; yo deplase li isit la pandan
 * netwayaj boutik anliy paske refunds yo sèvi ak li pou tout sous peman.
 */

export async function sendRefundEmails(opts: {
  buyerEmail?: string | null;
  merchantEmail?: string | null;
  merchantName?: string | null;
  buyerName?: string | null;
  amount: number;
  title: string;
  reason?: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) return;
  const amount = Number(opts.amount || 0).toLocaleString();
  const title = escapeHtml(opts.title || 'Tranzaksyon');
  const reason = escapeHtml(opts.reason || 'Pa presize');
  const merchant = escapeHtml(opts.merchantName || 'Machann');

  const jobs: Promise<unknown>[] = [];
  if (opts.buyerEmail) {
    jobs.push(
      sendMail({
        to: opts.buyerEmail,
        subject: `Ranbousman: ${amount} HTG`,
        html: `
          <p>Bonjou ${escapeHtml(opts.buyerName || '')},</p>
          <p>Ou resevwa yon ranbousman sou HatexCard.</p>
          <p><b>${amount} HTG</b> pou « ${title} ».</p>
          <p>Rezon: ${reason}</p>
          <p>Machann: ${merchant}</p>
          <p>Lajan an retounen sou balans HatexCard ou (kat/wallet) — san frè.</p>
        `,
        logLabel: 'refund-buyer',
      })
    );
  }
  if (opts.merchantEmail) {
    jobs.push(
      sendMail({
        to: opts.merchantEmail,
        subject: `Ranbousman fèt: ${amount} HTG`,
        html: `
          <p>Bonjou ${merchant},</p>
          <p>Ou fè yon ranbousman sou HatexCard.</p>
          <p><b>${amount} HTG</b> pou « ${title} » debite nan wallet ou.</p>
          <p>Rezon: ${reason}</p>
        `,
        logLabel: 'refund-merchant',
      })
    );
  }
  await Promise.allSettled(jobs);
}

/** Imèl bay machann lè kliyan mande ranbousman. */
export async function sendRefundRequestMerchantEmail(opts: {
  merchantEmail?: string | null;
  merchantName?: string | null;
  buyerName?: string | null;
  buyerEmail?: string | null;
  amount: number;
  title: string;
  reason: string;
}): Promise<void> {
  if (!isEmailConfigured() || !opts.merchantEmail) return;
  const amount = Number(opts.amount || 0).toLocaleString();
  const buyer = escapeHtml(opts.buyerName || 'Yon kliyan');
  const title = escapeHtml(opts.title || 'sèvis');
  const reason = escapeHtml(opts.reason);

  await sendMail({
    to: opts.merchantEmail,
    subject: `Demann ranbousman: ${buyer} — ${amount} HTG`,
    html: `
      <p>Bonjou ${escapeHtml(opts.merchantName || '')},</p>
      <p><b>${buyer}</b>${opts.buyerEmail ? ` (${escapeHtml(opts.buyerEmail)})` : ''}
      ki te peye w pou « <b>${title}</b> » ap <b>mande ranbousman</b>
      (<b>${amount} HTG</b>).</p>
      <p><b>Rezon:</b> ${reason}</p>
      <p>Ale nan <b>Istorik</b> ou — ou pral wè mesaj la ak bouton <b>Ranbouse</b>
      pou retounen kob la sou kat kliyan an (san frè).</p>
      <p>— Ekip HatexCard</p>
    `,
    logLabel: 'refund-request-merchant',
  });
}
