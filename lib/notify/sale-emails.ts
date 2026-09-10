import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeHtml, sendMail, shellHtml, SITE_URL } from './email';

/**
 * Imèl "konfimasyon vant" — yo voye apre yon peman regle (hatex_payments →
 * settle). Machann lan resevwa notifikasyon peman an; kliyan an resevwa yon
 * resi lè nou gen adrès li. Yo sèvi ak menm BREVO_API_KEY Vercel la.
 */

type SettledPaymentInfo = {
  id: string;
  mode?: string | null;
  purpose: string;
  merchant_id?: string | null;
  merchant_amount?: number | null;
  client_total?: number | null;
  description?: string | null;
  payer_phone?: string | null;
  metadata?: Record<string, unknown> | null;
};

function money(value: unknown, currency = 'HTG'): string {
  const n = Number(value || 0);
  const label = currency === 'USD' ? 'USD' : 'HTG';
  return `${Number.isFinite(n) ? Math.round(n).toLocaleString() : '0'} ${label}`;
}

function validEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
}

type MerchantProfile = { email: string | null; businessName: string };

async function fetchMerchantProfile(
  admin: SupabaseClient,
  merchantId?: string | null
): Promise<MerchantProfile | null> {
  if (!merchantId) return null;
  const { data } = await admin
    .from('profiles')
    .select('email, business_name, full_name')
    .eq('id', merchantId)
    .maybeSingle();
  if (!data) return null;
  return {
    email: validEmail(data.email),
    businessName: String(data.business_name || data.full_name || 'Machann'),
  };
}

function receivedPaymentHtml(opts: {
  merchantName: string;
  amountNet: string;
  amountClient: string;
  label: string;
  description?: string | null;
  payerPhone?: string | null;
  reference?: string;
}): string {
  const rows = [
    `<tr><td style="padding:8px 0; color:#64748b;">Montan resevwa</td><td style="padding:8px 0; font-weight:800; text-align:right;">${opts.amountNet}</td></tr>`,
    `<tr><td style="padding:8px 0; color:#64748b;">Kliyan te peye (ak frè)</td><td style="padding:8px 0; font-weight:800; text-align:right;">${opts.amountClient}</td></tr>`,
  ];
  if (opts.description) {
    rows.push(
      `<tr><td style="padding:8px 0; color:#64748b;">Deskripsyon</td><td style="padding:8px 0; text-align:right;">${escapeHtml(opts.description)}</td></tr>`
    );
  }
  if (opts.payerPhone) {
    rows.push(
      `<tr><td style="padding:8px 0; color:#64748b;">Telefòn kliyan</td><td style="padding:8px 0; text-align:right;">${escapeHtml(opts.payerPhone)}</td></tr>`
    );
  }
  if (opts.reference) {
    rows.push(
      `<tr><td style="padding:8px 0; color:#64748b;">Referans</td><td style="padding:8px 0; text-align:right; color:#64748b; font-size:12px;">${escapeHtml(opts.reference)}</td></tr>`
    );
  }
  return `
    <h2 style="margin:0 0 14px; font-size:19px;">${escapeHtml(opts.label)}</h2>
    <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 16px;">
      Bonjou ${escapeHtml(opts.merchantName)}, yon peman fèk antre sou kont HatexCard ou.
    </p>
    <table style="width:100%; border-collapse:collapse; font-size:14px; margin:0 0 18px;">
      ${rows.join('')}
    </table>
    <p style="color:#4b5563; font-size:13px; line-height:1.7; margin:0;">
      Lajan an ap tonbe sou kont peman ou chwazi a (MonCash / Natcash / bank).
      Ou ka swiv li nan Dashboard ou.
    </p>`;
}

function receiptHtml(opts: {
  business: string;
  label: string;
  amount: string;
  description?: string | null;
  payerPhone?: string | null;
  paymentId: string;
}): string {
  return `
    <h2 style="margin:0 0 14px; font-size:19px;">Mèsi pou peman w la ✅</h2>
    <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 16px;">
      Ou sot peye <strong>${escapeHtml(opts.business)}</strong> pou « ${escapeHtml(opts.label)} ».
    </p>
    <div style="margin:0 0 20px; padding:18px 20px; background:#fdf2f2; border-radius:12px; font-weight:900; font-size:22px; color:#dc2626;">
      ${escapeHtml(opts.amount)}
    </div>
    ${opts.description ? `<p style="color:#4b5563; font-size:14px; margin:0 0 8px;">${escapeHtml(opts.description)}</p>` : ''}
    ${opts.payerPhone ? `<p style="color:#64748b; font-size:13px; margin:0;">Telefòn: ${escapeHtml(opts.payerPhone)}</p>` : ''}
    <p style="margin:22px 0 0;">
      <a href="${SITE_URL}/success?status=success&payment=${encodeURIComponent(opts.paymentId)}"
         style="display:inline-block; background:#4f46e5; color:#fff; padding:13px 24px; border-radius:10px; text-decoration:none; font-weight:800; font-size:13px;">Gade resi ou</a>
    </p>`;
}

/* ============================= EKSPEDISYON ============================= */

async function notifyInvoicePaid(admin: SupabaseClient, payment: SettledPaymentInfo): Promise<void> {
  const invoiceId =
    typeof payment.metadata?.invoice_id === 'string' ? payment.metadata.invoice_id : null;
  if (!invoiceId) return;

  const { data: inv } = await admin
    .from('invoices')
    .select('id, owner_id, client_email, amount, currency, description, business_name')
    .eq('id', invoiceId)
    .maybeSingle();
  if (!inv) return;

  const profile = await fetchMerchantProfile(admin, inv.owner_id);
  const currency = inv.currency === 'USD' ? 'USD' : 'HTG';
  const amountLabel = money(inv.amount, currency);
  const netLabel = money(payment.merchant_amount, 'HTG');
  const label = String(inv.description || inv.business_name || 'Fakti HatexCard');

  const merchantBody = receivedPaymentHtml({
    merchantName: profile?.businessName || 'Machann',
    amountNet: netLabel,
    amountClient: amountLabel,
    label: 'Fakti peye ✅',
    description: label,
    payerPhone: payment.payer_phone,
    reference: `inv_${invoiceId.slice(0, 8)}`,
  });

  if (profile?.email) {
    await sendMail({
      to: profile.email,
      subject: `Fakti peye — ${amountLabel}`,
      html: shellHtml('Konfimasyon Vant', merchantBody),
      logLabel: 'sale:invoice:merchant',
    });
  }

  const clientEmail = validEmail(inv.client_email);
  if (clientEmail) {
    await sendMail({
      to: clientEmail,
      subject: `Resi fakti — ${amountLabel}`,
      html: shellHtml(
        'Resi Peman',
        receiptHtml({
          business: profile?.businessName || 'HatexCard',
          label,
          amount: amountLabel,
          payerPhone: payment.payer_phone,
          paymentId: payment.id,
        })
      ),
      logLabel: 'sale:invoice:client',
    });
  }
}

async function notifyProductSold(admin: SupabaseClient, payment: SettledPaymentInfo): Promise<void> {
  const productId =
    typeof payment.metadata?.product_id === 'string' ? payment.metadata.product_id : null;
  let productName = payment.description || 'Pwodwi';

  if (productId) {
    const { data: product } = await admin
      .from('hatex_products')
      .select('name')
      .eq('id', productId)
      .maybeSingle();
    if (product?.name) productName = String(product.name);
  }

  const profile = await fetchMerchantProfile(admin, payment.merchant_id);
  const amountClient = money(payment.client_total, 'HTG');
  const amountNet = money(payment.merchant_amount, 'HTG');

  if (profile?.email) {
    await sendMail({
      to: profile.email,
      subject: `Vant fèt — ${productName}`,
      html: shellHtml(
        'Konfimasyon Vant',
        receivedPaymentHtml({
          merchantName: profile.businessName,
          amountNet,
          amountClient,
          label: `Vant fèt: ${productName}`,
          description: payment.description,
          payerPhone: payment.payer_phone,
        })
      ),
      logLabel: 'sale:product:merchant',
    });
  }

  const customerEmail = validEmail(payment.metadata?.customer_email);
  if (customerEmail) {
    await sendMail({
      to: customerEmail,
      subject: `Acha reyisi — ${productName}`,
      html: shellHtml(
        'Resi Peman',
        receiptHtml({
          business: profile?.businessName || 'HatexCard',
          label: productName,
          amount: amountClient,
          description: payment.description,
          payerPhone: payment.payer_phone,
          paymentId: payment.id,
        })
      ),
      logLabel: 'sale:product:client',
    });
  }
}

async function notifyMerchantPaymentReceived(
  admin: SupabaseClient,
  payment: SettledPaymentInfo
): Promise<void> {
  const profile = await fetchMerchantProfile(admin, payment.merchant_id);
  const label = payment.description || 'Peman';

  if (profile?.email) {
    await sendMail({
      to: profile.email,
      subject: `Peman resevwa — ${money(payment.client_total, 'HTG')}`,
      html: shellHtml(
        'Konfimasyon Vant',
        receivedPaymentHtml({
          merchantName: profile.businessName,
          amountNet: money(payment.merchant_amount, 'HTG'),
          amountClient: money(payment.client_total, 'HTG'),
          label: 'Peman resevwa ✅',
          description: label,
          payerPhone: payment.payer_phone,
        })
      ),
      logLabel: 'sale:merchant',
    });
  }

  const customerEmail = validEmail(payment.metadata?.customer_email);
  if (customerEmail) {
    await sendMail({
      to: customerEmail,
      subject: `Resi peman — ${money(payment.client_total, 'HTG')}`,
      html: shellHtml(
        'Resi Peman',
        receiptHtml({
          business: profile?.businessName || 'HatexCard',
          label,
          amount: money(payment.client_total, 'HTG'),
          payerPhone: payment.payer_phone,
          paymentId: payment.id,
        })
      ),
      logLabel: 'sale:merchant:client',
    });
  }
}

async function notifyPlanActivated(
  admin: SupabaseClient,
  payment: SettledPaymentInfo
): Promise<void> {
  const plan = typeof payment.metadata?.plan === 'string' ? payment.metadata.plan : null;
  if (!plan) return;
  const profile = await fetchMerchantProfile(admin, payment.merchant_id);
  if (!profile?.email) return;

  const planName = plan === 'premium' ? 'Premyòm' : plan === 'capacity' ? 'Kapasite' : plan;
  await sendMail({
    to: profile.email,
    subject: `Plan ${planName} aktif 🎉`,
    html: shellHtml(
      'Abònman',
      `
      <h2 style="margin:0 0 14px; font-size:19px;">Plan ${escapeHtml(planName)} aktif</h2>
      <p style="color:#4b5563; font-size:14px; line-height:1.7; margin:0 0 16px;">
        Mèsi ${escapeHtml(profile.businessName)}! Abònman ${escapeHtml(planName)} ou fèk aktif pou 30 jou.
        Ou ka swiv tout peman ou yo sou Dashboard HatexCard.
      </p>`
    ),
    logLabel: 'sale:plan',
  });
}

/**
 * Voye notifikasyon "peman peye" apre yon règleman ki fèt premye fwa.
 * Pa janm jete — si imèl la echwe, l ap loje epi règleman an kontinye.
 * Pa voye nan mòd test.
 */
export async function notifyPaymentPaid(
  admin: SupabaseClient,
  payment: SettledPaymentInfo
): Promise<void> {
  try {
    if (!payment || !payment.id || payment.mode === 'test') return;
    if (payment.purpose === 'invoice') return notifyInvoicePaid(admin, payment);
    if (payment.purpose === 'product') return notifyProductSold(admin, payment);
    if (payment.purpose === 'merchant') return notifyMerchantPaymentReceived(admin, payment);
    if (payment.purpose === 'plan_fee') return notifyPlanActivated(admin, payment);
  } catch (err: unknown) {
    console.error(
      `[notify-sale] erè pandan n ap voye konfimasyon peman ${payment.id}:`,
      err instanceof Error ? err.message : err
    );
  }
}
