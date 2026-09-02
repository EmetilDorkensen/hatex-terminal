import type { SupabaseClient } from '@supabase/supabase-js';
import { getMonCashConfigForGateway, getMonCashMode, type GatewayMode } from '@/lib/moncash/config';
import { monCashTransfer } from '@/lib/moncash/client';
import { listMoncashPhones, looksLikeWalletFull, maskPhone } from './phones';

const HOLD_DAYS = 10;

export const WALLET_FULL_TITLE = 'KONT MONCASH PLEN';
export const WALLET_FULL_BODY =
  'SISTEM NAN AP ESYE DEPOZE YON KÒB SOU KONT OU MEN SANBLE KONT MONCASH OU PLEN. ' +
  'Fè retrè pi rapid ke posib. Si kòb la fè 10 jou nan sistèm nan san nou pa ka depoze l ' +
  'sou kont pèsonèl ou, kòb sa a ap konsidere kòm lajan pèdi. ' +
  'Mete yon dezyèm nimewo MonCash nan Konekte kont bank ou — sistèm nan ap eseye yo youn pa youn.';

type ExecuteInput = {
  paymentId: string;
  merchantId: string;
  amount: number;
  mode?: GatewayMode;
  reference: string;
  description?: string;
  /** Eseye nimewo sa a an premye (fakti: kont machann te chwazi). */
  preferPhone?: string | null;
};

export type ExecuteResult = {
  payoutId: string | null;
  status: 'paid' | 'pending' | 'skipped';
  transferTx: string | null;
  receiverPhone: string | null;
  walletFull: boolean;
};

async function paymentMode(
  admin: SupabaseClient,
  merchantId: string,
  explicit?: GatewayMode
): Promise<GatewayMode> {
  if (explicit) return explicit;
  const { data: profile } = await admin
    .from('profiles')
    .select('api_key_mode')
    .eq('id', merchantId)
    .maybeSingle();
  if (profile?.api_key_mode === 'test') return 'test';
  return getMonCashMode() === 'live' ? 'live' : 'test';
}


async function notify(
  admin: SupabaseClient,
  userId: string,
  kind: string,
  title: string,
  body: string,
  href = '/dashboard'
) {
  await admin.from('hatex_notifications').insert({
    user_id: userId,
    kind,
    title,
    body,
    href,
  });
}

async function logAttempt(
  admin: SupabaseClient,
  payoutId: string,
  merchantId: string,
  phone: string,
  amount: number,
  status: 'success' | 'failed' | 'wallet_full',
  errorMessage: string | null,
  txId: string | null
) {
  await admin.from('hatex_payout_attempts').insert({
    payout_id: payoutId,
    merchant_id: merchantId,
    receiver_phone: phone,
    amount,
    status,
    error_message: errorMessage,
    moncash_transaction_id: txId,
  });
}

/**
 * Kreye (oswa repran) liy payout la epi eseye transfè sou TOUT nimewo MonCash
 * machann nan, youn apre lòt. Si yo tout echwe, kenbe tranzaksyon an an atant
 * 10 jou.
 */
export async function executeMerchantPayout(
  admin: SupabaseClient,
  input: ExecuteInput
): Promise<ExecuteResult> {
  const mode = await paymentMode(admin, input.merchantId, input.mode);
  const amount = Math.round(Number(input.amount));

  const now = new Date().toISOString();

  const { data: paymentRow } = await admin
    .from('hatex_payments')
    .select('purpose')
    .eq('id', input.paymentId)
    .maybeSingle();

  if (paymentRow?.purpose === 'plan_fee' || paymentRow?.purpose === 'kyc_fee') {
    return {
      payoutId: null,
      status: 'skipped',
      transferTx: null,
      receiverPhone: null,
      walletFull: false,
    };
  }

  const { data: existing } = await admin
    .from('hatex_payouts')
    .select('id, status, receiver_phone, moncash_transaction_id, wallet_full, considered_lost_at')
    .eq('payment_id', input.paymentId)
    .maybeSingle();

  if (existing?.status === 'paid') {
    return {
      payoutId: existing.id,
      status: 'paid',
      transferTx: existing.moncash_transaction_id,
      receiverPhone: existing.receiver_phone,
      walletFull: false,
    };
  }

  if (existing?.considered_lost_at) {
    return {
      payoutId: existing.id,
      status: 'skipped',
      transferTx: null,
      receiverPhone: existing.receiver_phone,
      walletFull: true,
    };
  }

  // ---- Payout bank: si machann nan chwazi yon kont bank default,
  //      li ale nan lapo admin (pa nan bouk retry MonCash) ----
  if (!input.preferPhone) {
    const { data: defaultBank } = await admin
      .from('hatex_bank_accounts')
      .select('id, kind, account_number, account_name')
      .eq('user_id', input.merchantId)
      .eq('is_default', true)
      .in('kind', ['bank', 'bank_us', 'natcash'])
      .maybeSingle();

    if (defaultBank) {
      const { getPayoutUsdRate, convertHtgToUsd } = await import('@/lib/payouts/rates');
      const rate = await getPayoutUsdRate(admin);
      const amountUsd = convertHtgToUsd(amount, rate);
      const receiver = defaultBank.account_number || defaultBank.account_name || 'pending';
      const bankStatus: ExecuteResult = {
        payoutId: null,
        status: 'pending',
        transferTx: null,
        receiverPhone: null,
        walletFull: false,
      };

      if (existing?.id) {
        await admin
          .from('hatex_payouts')
          .update({
            receiver_provider: defaultBank.kind,
            receiver_phone: String(receiver).slice(0, 64),
            currency: defaultBank.kind === 'bank_us' ? 'USD' : 'HTG',
            amount_usd: defaultBank.kind === 'bank_us' && amountUsd > 0 ? amountUsd : null,
            rate_used: defaultBank.kind === 'bank_us' ? rate : null,
            bank_account_id: defaultBank.id,
            status: 'pending',
            last_error: `Payout ${defaultBank.kind} an atant konfimasyon admin`,
            wallet_full: false,
            hold_until: null,
            next_retry_at: null,
            attempt_count: 0,
            updated_at: now,
          })
          .eq('id', existing.id);
        bankStatus.payoutId = existing.id;
        return bankStatus;
      }

      const { data: created } = await admin
        .from('hatex_payouts')
        .insert({
          payment_id: input.paymentId,
          merchant_id: input.merchantId,
          mode,
          receiver_provider: defaultBank.kind,
          receiver_phone: String(receiver).slice(0, 64),
          amount,
          currency: defaultBank.kind === 'bank_us' ? 'USD' : 'HTG',
          amount_usd: defaultBank.kind === 'bank_us' && amountUsd > 0 ? amountUsd : null,
          rate_used: defaultBank.kind === 'bank_us' ? rate : null,
          bank_account_id: defaultBank.id,
          status: 'pending',
          reference: input.reference.slice(0, 64),
          last_error: `Payout ${defaultBank.kind} an atant konfimasyon admin`,
          wallet_full: false,
        })
        .select('id')
        .maybeSingle();

      bankStatus.payoutId = created?.id || null;
      return bankStatus;
    }
  }

  const phones = await listMoncashPhones(admin, input.merchantId);
  if (input.preferPhone) {
    const pref = String(input.preferPhone).replace(/\D/g, '');
    if (pref.length >= 8) {
      const rest = phones.filter((p) => p !== pref);
      phones.length = 0;
      phones.push(pref, ...rest);
    }
  }
  const firstPhone = phones[0] || 'pending';

  let payoutId = existing?.id || null;
  if (!payoutId) {
    const { data: created, error } = await admin
      .from('hatex_payouts')
      .insert({
        payment_id: input.paymentId,
        merchant_id: input.merchantId,
        mode,
        receiver_provider: 'moncash',
        receiver_phone: firstPhone,
        amount,
        status: 'pending',
        reference: input.reference.slice(0, 64),
        wallet_full: false,
        hold_until: new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .maybeSingle();

    if (error) {
      if (error.code === '23505' || error.code === '23405') {
        const { data: raced } = await admin
          .from('hatex_payouts')
          .select('id, status, receiver_phone, moncash_transaction_id')
          .eq('payment_id', input.paymentId)
          .maybeSingle();
        if (raced?.status === 'paid') {
          return {
            payoutId: raced.id,
            status: 'paid',
            transferTx: raced.moncash_transaction_id,
            receiverPhone: raced.receiver_phone,
            walletFull: false,
          };
        }
        payoutId = raced?.id || null;
      } else {
        console.error('[payout] kreye echwe:', error.message);
        return {
          payoutId: null,
          status: 'pending',
          transferTx: null,
          receiverPhone: null,
          walletFull: false,
        };
      }
    } else {
      payoutId = created?.id || null;
    }
  }

  if (!payoutId) {
    return {
      payoutId: null,
      status: 'pending',
      transferTx: null,
      receiverPhone: null,
      walletFull: false,
    };
  }

  if (phones.length === 0) {
    await admin
      .from('hatex_payouts')
      .update({
        status: 'pending',
        wallet_full: true,
        last_error: 'Pa gen nimewo MonCash konekte.',
        next_retry_at: new Date(Date.now() + 30 * 60_000).toISOString(),
        updated_at: now,
      })
      .eq('id', payoutId);

    await notify(
      admin,
      input.merchantId,
      'payout_wallet_full',
      WALLET_FULL_TITLE,
      'Nou pa ka depoze kòb la: ou poko konekte yon nimewo MonCash. Ale nan Konekte kont bank ou.',
      '/dashboard'
    );

    return {
      payoutId,
      status: 'pending',
      transferTx: null,
      receiverPhone: null,
      walletFull: true,
    };
  }

  let cfg;
  try {
    cfg = getMonCashConfigForGateway(mode);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'MonCash pa konfigire.';
    await admin
      .from('hatex_payouts')
      .update({
        last_error: msg,
        next_retry_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        updated_at: now,
      })
      .eq('id', payoutId);
    return {
      payoutId,
      status: 'pending',
      transferTx: null,
      receiverPhone: phones[0],
      walletFull: false,
    };
  }

  let anyWalletFull = false;
  const attemptLog: Array<Record<string, unknown>> = [];

  for (const phone of phones) {
    const transfer = await monCashTransfer(
      {
        receiver: phone,
        amount,
        desc: (input.description || 'Payout HatexCard').slice(0, 120),
        reference: `${input.reference}_${phone.slice(-4)}`.slice(0, 64),
      },
      cfg
    );

    if (transfer.ok) {
      await logAttempt(
        admin,
        payoutId,
        input.merchantId,
        phone,
        amount,
        'success',
        null,
        transfer.data.transactionId
      );
      attemptLog.push({
        phone: maskPhone(phone),
        status: 'success',
        tx: transfer.data.transactionId,
        at: now,
      });

      await admin
        .from('hatex_payouts')
        .update({
          status: 'paid',
          receiver_phone: phone,
          moncash_transaction_id: transfer.data.transactionId,
          moncash_raw: transfer.data.raw as never,
          paid_at: now,
          wallet_full: false,
          last_error: null,
          attempt_log: attemptLog,
          updated_at: now,
        })
        .eq('id', payoutId);

      await notify(
        admin,
        input.merchantId,
        'payout_sent',
        'Kòb depoze sou MonCash',
        `${amount.toLocaleString('fr-FR')} HTG depoze sou nimewo ${maskPhone(phone)}.`,
        '/transactions'
      );

      return {
        payoutId,
        status: 'paid',
        transferTx: transfer.data.transactionId,
        receiverPhone: phone,
        walletFull: false,
      };
    }

    const full = looksLikeWalletFull(transfer.message);
    if (full) anyWalletFull = true;
    await logAttempt(
      admin,
      payoutId,
      input.merchantId,
      phone,
      amount,
      full ? 'wallet_full' : 'failed',
      transfer.message,
      null
    );
    attemptLog.push({
      phone: maskPhone(phone),
      status: full ? 'wallet_full' : 'failed',
      error: transfer.message,
      at: now,
    });
  }

  await admin
    .from('hatex_payouts')
    .update({
      status: 'pending',
      wallet_full: anyWalletFull || phones.length > 0,
      last_error: anyWalletFull
        ? 'Kont MonCash plen sou tout nimewo yo.'
        : 'Transfè MonCash echwe sou tout nimewo yo.',
      attempt_log: attemptLog,
      next_retry_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      hold_until: new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      attempt_count: Number((existing as { attempt_count?: number } | null)?.attempt_count || 0) + 1,
      updated_at: now,
    })
    .eq('id', payoutId);

  if (anyWalletFull) {
    await notify(
      admin,
      input.merchantId,
      'payout_wallet_full',
      WALLET_FULL_TITLE,
      WALLET_FULL_BODY,
      '/dashboard'
    );
  }

  return {
    payoutId,
    status: 'pending',
    transferTx: null,
    receiverPhone: phones[0],
    walletFull: anyWalletFull,
  };
}

/** Cron: reeseye pending, epi make pèdi apre 10 jou. */
export async function processPendingPayouts(
  admin: SupabaseClient,
  limit = 25
): Promise<{ retried: number; lost: number; paid: number }> {
  const now = new Date().toISOString();
  let retried = 0;
  let lost = 0;
  let paid = 0;

  const { data: expired } = await admin
    .from('hatex_payouts')
    .select('id, merchant_id, amount')
    .in('status', ['pending', 'failed'])
    .in('receiver_provider', ['moncash'])
    .is('considered_lost_at', null)
    .lt('hold_until', now)
    .limit(50);

  for (const row of expired || []) {
    await admin
      .from('hatex_payouts')
      .update({
        status: 'failed',
        considered_lost_at: now,
        last_error: '10 jou pase — kòb la konsidere kòm lajan pèdi.',
        updated_at: now,
      })
      .eq('id', row.id);

    await notify(
      admin,
      row.merchant_id,
      'payout_lost',
      'Lajan pèdi — 10 jou',
      `${Number(row.amount).toLocaleString('fr-FR')} HTG pa t ka depoze sou MonCash ou nan 10 jou. Sistèm nan sispann eseye.`,
      '/transactions'
    );
    lost += 1;
  }

  const { data: due } = await admin
    .from('hatex_payouts')
    .select('id, payment_id, merchant_id, amount, mode, reference')
    .in('status', ['pending', 'failed'])
    .in('receiver_provider', ['moncash'])
    .is('considered_lost_at', null)
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .limit(limit);

  for (const row of due || []) {
    retried += 1;
    const result = await executeMerchantPayout(admin, {
      paymentId: row.payment_id,
      merchantId: row.merchant_id,
      amount: Number(row.amount),
      mode: row.mode as GatewayMode,
      reference: row.reference,
    });
    if (result.status === 'paid') paid += 1;
  }

  return { retried, lost, paid };
}
