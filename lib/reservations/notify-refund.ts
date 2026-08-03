import { Resend } from 'resend';

export async function sendRefundEmails(opts: {
  buyerEmail?: string | null;
  merchantEmail?: string | null;
  merchantName?: string | null;
  buyerName?: string | null;
  amount: number;
  title: string;
  reason?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const from = 'HatexCard <notifications@hatexcard.com>';
  const amount = Number(opts.amount || 0).toLocaleString();
  const title = escapeHtml(opts.title || 'Tranzaksyon');
  const reason = escapeHtml(opts.reason || 'Pa presize');
  const merchant = escapeHtml(opts.merchantName || 'Machann');

  const jobs: Promise<unknown>[] = [];
  if (opts.buyerEmail) {
    jobs.push(
      resend.emails.send({
        from,
        to: opts.buyerEmail,
        subject: `Ranbousman: ${amount} HTG`,
        html: `
          <p>Bonjou ${escapeHtml(opts.buyerName || '')},</p>
          <p>Ou resevwa yon ranbousman sou HatexCard.</p>
          <p><b>${amount} HTG</b> pou « ${title} ».</p>
          <p>Rezon: ${reason}</p>
          <p>Machann: ${merchant}</p>
          <p>Lajan an retounen sou balans HatexCard ou.</p>
        `,
      })
    );
  }
  if (opts.merchantEmail) {
    jobs.push(
      resend.emails.send({
        from,
        to: opts.merchantEmail,
        subject: `Ranbousman fèt: ${amount} HTG`,
        html: `
          <p>Bonjou ${merchant},</p>
          <p>Ou fè yon ranbousman sou HatexCard.</p>
          <p><b>${amount} HTG</b> pou « ${title} » debite nan wallet ou.</p>
          <p>Rezon: ${reason}</p>
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
