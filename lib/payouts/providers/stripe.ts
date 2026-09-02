import type { SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

/**
 * Stripe Connect — payout bank USA (test mode).
 *
 * Mòd la konplete 2 kou:
 *   • STRIPE_SECRET_KEY (sk_test_...) — platform HatexCard (dashboard Stripe)
 *   • Account connect "custom" pou chak machann + external_account (bank)
 *   • payouts.create({ destination: acct_id }) → depo an USD sou bank machann nan
 *
 * ID ki soti Stripe yo anrejistre nan baz done a (hatex_bank_accounts /
 * hatex_payouts) — pa gen okenn eta UI sèlman.
 */

export type StripeBankAccount = {
  id: string;
  user_id: string;
  account_name: string | null;
  account_number: string | null;
  routing_number: string | null;
  stripe_connect_account_id: string | null;
  stripe_external_account_id: string | null;
};

export function stripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  return Boolean(key && key.startsWith('sk_test_'));
}

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith('sk_test_')) {
    throw new Error('STRIPE_SECRET_KEY pa konfigire (bezwen yon kle sk_test_...).');
  }
  return new Stripe(key);
}

/**
 * Separe routing (9 chif) ak nimewo kont. Kont new yo anrejistre ak jaden
 * apa (routing_number); pou ansyen kont, routing = 9 premye chif.
 */
export function parseUsBankAccount(bankAccount: {
  account_number: string | null;
  routing_number: string | null;
}): { ok: true; routingNumber: string; accountNumber: string } | { ok: false; message: string } {
  const routing = (bankAccount.routing_number || '').replace(/[^0-9]/g, '');
  const digits = (bankAccount.account_number || '').replace(/[^0-9]/g, '');
  let routingNumber = routing;
  let accountNumber = digits;

  if (!routingNumber && digits.length >= 9) {
    routingNumber = digits.slice(0, 9);
    accountNumber = digits.slice(9);
  }

  if (routingNumber.length !== 9) {
    return { ok: false, message: 'Routing number USA dwe gen egzakteman 9 chif.' };
  }
  if (accountNumber.length < 4) {
    return { ok: false, message: 'Nimewo kont bank la pa valab (mwens pase 4 chif).' };
  }
  return { ok: true, routingNumber, accountNumber };
}

/** Kreye (oswa rekipere) akount Connect "custom" machann nan epi anrejistre ID li. */
async function getOrCreateConnectAccount(
  admin: SupabaseClient,
  bankAccount: StripeBankAccount,
  merchantEmail?: string | null
): Promise<string> {
  if (bankAccount.stripe_connect_account_id) return bankAccount.stripe_connect_account_id;

  const stripe = getStripe();
  const name = bankAccount.account_name || 'HatexCard Merchant';
  const acct = await stripe.accounts.create({
    type: 'custom',
    country: 'US',
    email: merchantEmail || undefined,
    capabilities: { transfers: { requested: true } },
    business_profile: { name },
    company: { name },
    tos_acceptance: { service_agreement: 'recipient' },
    metadata: { hatex_user_id: bankAccount.user_id, hatex_bank_account_id: bankAccount.id },
  });

  await admin
    .from('hatex_bank_accounts')
    .update({ stripe_connect_account_id: acct.id })
    .eq('id', bankAccount.id);

  return acct.id;
}

/** Tache kont bank la sou akount Connect a (external account) epi anrejistre ID li. */
async function attachExternalBankAccount(
  admin: SupabaseClient,
  connectAccountId: string,
  bankAccount: StripeBankAccount,
  parsed: { routingNumber: string; accountNumber: string }
): Promise<string> {
  if (bankAccount.stripe_external_account_id) return bankAccount.stripe_external_account_id;

  const stripe = getStripe();
  const token = await stripe.tokens.create({
    bank_account: {
      country: 'US',
      currency: 'usd',
      account_holder_name: bankAccount.account_name || 'HatexCard Merchant',
      account_holder_type: 'individual',
      routing_number: parsed.routingNumber,
      account_number: parsed.accountNumber,
    },
  });

  const ext = await stripe.accounts.createExternalAccount(connectAccountId, {
    external_account: token.id,
  });

  await admin
    .from('hatex_bank_accounts')
    .update({ stripe_external_account_id: ext.id })
    .eq('id', bankAccount.id);

  return ext.id;
}

export type StripePayoutResult =
  | { ok: true; transactionId: string; status: string }
  | { ok: false; code: string; message: string };

/**
 * Voye yon payout bank USA via Stripe Connect (test mode).
 * Montan an USD (dola). Tout ID yo anrejistre nan baz done a.
 */
export async function executeStripeBankPayout(params: {
  admin: SupabaseClient;
  payoutId: string;
  amountUsd: number;
  bankAccount: StripeBankAccount;
  merchantEmail?: string | null;
}): Promise<StripePayoutResult> {
  if (!stripeConfigured()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'STRIPE_SECRET_KEY (sk_test_...) pa konfigire. Konfigire l anvan ou voye via Stripe.',
    };
  }

  const amountUsd = Number(params.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'Montan USD pa valab.' };
  }

  const cents = Math.round(amountUsd * 100);
  if (cents < 50) {
    return {
      ok: false,
      code: 'BELOW_MINIMUM',
      message: 'Montan an anba minimòm payout Stripe a ($0.50 USD).',
    };
  }

  const parsed = parseUsBankAccount(params.bankAccount);
  if (!parsed.ok) return { ok: false, code: 'INVALID_BANK', message: parsed.message };

  try {
    const stripe = getStripe();
    const connectAccountId = await getOrCreateConnectAccount(
      params.admin,
      params.bankAccount,
      params.merchantEmail
    );
    await attachExternalBankAccount(params.admin, connectAccountId, params.bankAccount, parsed);

    const payout = await stripe.payouts.create(
      {
        amount: cents,
        currency: 'usd',
        destination: connectAccountId,
        description: `HatexCard payout ${params.payoutId.slice(0, 8)}`,
        statement_descriptor: 'HATEXCARD',
        metadata: { hatex_payout_id: params.payoutId, hatex_bank_account_id: params.bankAccount.id },
      },
      { idempotencyKey: `hx_payout_${params.payoutId}` }
    );

    return { ok: true, transactionId: payout.id, status: payout.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, code: 'STRIPE_ERROR', message: `Stripe: ${message}` };
  }
}

/** Tcheke eta yon payout Stripe (sèvi pou "Rafrechi"). */
export async function refreshStripePayoutStatus(
  transactionId: string
): Promise<{ status: string; error?: string }> {
  if (!stripeConfigured()) {
    return { status: 'unknown', error: 'STRIPE_SECRET_KEY pa konfigire.' };
  }
  try {
    const payout = await getStripe().payouts.retrieve(transactionId);
    return { status: payout.status };
  } catch (err) {
    return { status: 'unknown', error: err instanceof Error ? err.message : String(err) };
  }
}
