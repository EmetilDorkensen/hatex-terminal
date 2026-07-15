import type { SupabaseClient } from '@supabase/supabase-js';

// ==========================================
// KONSTAN LIMIT & FRÈ (Kont Endividyèl vs Antrepriz)
// ==========================================
export const INDIVIDUAL_DAILY_LIMIT = 75000;
export const INDIVIDUAL_MONTHLY_LIMIT = 250000;

export const ENTERPRISE_CARD_DAILY_LIMIT = 100000;
export const ENTERPRISE_CARD_MONTHLY_LIMIT = 480000;

export const ENTERPRISE_APPLICATION_FEE = 49000;
export const ENTERPRISE_AUTO_AGENT_TIER = 'pro';
export const ENTERPRISE_AUTO_AGENT_CAPACITY = 40000;

// Limit espesifik pou Invoice/Fakti — kont endividyèl gen dwa voye jiska
// 85,000 HTG/jou nan fakti (total montan tout fakti li kreye), pou anpeche
// itilizasyon fwodilè (moun k ap fè "biznis" san yo pa gen kont Antrepriz).
// Kont Antrepriz gen dwa voye fakti san limit.
export const INDIVIDUAL_INVOICE_DAILY_LIMIT = 85000;

// Limit MAKSIMÒM sou BALANS PRENSIPAL (wallet_balance) yon kont ka kenbe.
// Sa a se yon plafon SOU BALANS, diferan de limit depans/retrè pi wo yo
// (ki kontwole vitès kòb k ap SÒTI). Plafon sa a kontwole konbyen kòb ki
// gen dwa REZIDE sou kont lan nenpòt ki moman — pou rezon anti-blanchiman
// ak jesyon risk. Kont ki DEJA depase plafon an (anvan règ sa a) pa jennen;
// verifikasyon an aplike sèlman sou NOUVO kòb k ap antre yo.
export const INDIVIDUAL_MAX_WALLET_BALANCE = 105000;
export const ENTERPRISE_MAX_WALLET_BALANCE = 2000000;

/** Frè retrè kay ajan: 50 HTG pou chak 1,000 HTG (5%). */
export const AGENT_WITHDRAW_FEE_PER_1000 = 50;
export const AGENT_WITHDRAW_AGENT_SHARE_RATE = 0.2;
export const AGENT_WITHDRAW_HATEX_SHARE_RATE = 0.8;

export type AgentWithdrawFeeBreakdown = {
  cashAmount: number;
  fee: number;
  agentShare: number;
  hatexShare: number;
  totalDebit: number;
};

/** Kalkile frè retrè ajan (menm fòmil ak SQL RPC). */
export function calcAgentWithdrawFee(cashAmount: number): AgentWithdrawFeeBreakdown {
  const amount = Math.max(0, Number(cashAmount) || 0);
  const fee = Math.round((amount / 1000) * AGENT_WITHDRAW_FEE_PER_1000 * 100) / 100;
  const agentShare = Math.round(fee * AGENT_WITHDRAW_AGENT_SHARE_RATE * 100) / 100;
  const hatexShare = Math.round((fee - agentShare) * 100) / 100;
  return {
    cashAmount: amount,
    fee,
    agentShare,
    hatexShare,
    totalDebit: Math.round((amount + fee) * 100) / 100,
  };
}

// Limit RESEPSYON via API piblik la (/api/public/payments). Sa a kontwole
// konbyen kòb yon MACHANN ka resevwa pa API a — apa de plafon balans jeneral
// la. De nivo verifikasyon: (1) yon sèl peman pa ka depase limit la (pa-tx),
// (2) total tout peman API resevwa nan yon jou pa ka depase limit la (pa-jou).
export const API_RECEIVE_INDIVIDUAL_LIMIT = 50000;
export const API_RECEIVE_ENTERPRISE_LIMIT = 2000000;

/** Frè platfòm sou peman API: 3 HTG pou chak 1 000 HTG resevwa. */
export const API_RECEIVE_FEE_PER_1000 = 3;
/** @deprecated Itilize API_RECEIVE_FEE_PER_1000 — pa yon pousantaj. */
export const API_RECEIVE_FEE_PERCENT = API_RECEIVE_FEE_PER_1000;

export function calcApiReceiveFee(grossAmount: number): { fee: number; net: number } {
  const gross = Number(grossAmount || 0);
  const fee = Math.round((gross / 1000) * API_RECEIVE_FEE_PER_1000 * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;
  return { fee: Math.max(0, fee), net: Math.max(0, net) };
}

export type SpendingChannel = 'transfer' | 'withdraw' | 'card' | 'invoice';

const TRANSFER_TYPES = ['TRANSFER', 'P2P'];
const WITHDRAW_TYPES = ['WITHDRAWAL', 'AGENT_WITHDRAWAL_CLIENT'];
const CARD_SPEND_TYPES = ['PURCHASE', 'PAYMENT', 'API_GATEWAY_PAYMENT'];

export function isEnterpriseAccount(accountType?: string | null): boolean {
  return accountType === 'business';
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function sumOutgoing(
  supabase: SupabaseClient,
  userId: string,
  types: string[],
  sinceIso: string
): Promise<number> {
  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .in('type', types)
    .lt('amount', 0)
    .gte('created_at', sinceIso);

  return (data || []).reduce((acc, tx) => acc + Math.abs(Number(tx.amount || 0)), 0);
}

// Fakti yo pa pase nan tab 'transactions' (moun ki kreye fakti a poko peye/resevwa
// anyen, li se yon demann); nou kalkile total la dirèkteman nan tab 'invoices'.
async function sumInvoicedToday(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string
): Promise<number> {
  const { data } = await supabase
    .from('invoices')
    .select('amount, status')
    .eq('owner_id', userId)
    .neq('status', 'cancelled')
    .gte('created_at', sinceIso);

  return (data || []).reduce((acc, inv) => acc + Number(inv.amount || 0), 0);
}

export interface SpendingLimitResult {
  allowed: boolean;
  message?: string;
  todayTotal: number;
  monthTotal: number;
  dailyLimit: number;
  monthlyLimit: number;
}

/**
 * Verifye si yon operasyon (transfè, retrè, oswa peman kat) respekte limit
 * jounalye/mansyèl yo, dapre tip kont lan (endividyèl oswa antrepriz).
 *
 * Kont Antrepriz gen transfè/retrè ILIMITE, men gen yon limit kat pi wo
 * (100,000 HTG/jou, 480,000 HTG/mwa) pase kont endividyèl yo.
 */
export async function checkSpendingLimit(
  supabase: SupabaseClient,
  userId: string,
  accountType: string | null | undefined,
  amount: number,
  channel: SpendingChannel
): Promise<SpendingLimitResult> {
  const enterprise = isEnterpriseAccount(accountType);

  // Fakti (Invoice): kont Antrepriz san limit, kont endividyèl kanpe a 85,000 HTG/jou.
  // Pa gen limit mansyèl separe pou fakti — se sèlman yon plafon jounalye.
  if (channel === 'invoice') {
    if (enterprise) {
      return { allowed: true, todayTotal: 0, monthTotal: 0, dailyLimit: Infinity, monthlyLimit: Infinity };
    }

    const todayTotal = await sumInvoicedToday(supabase, userId, startOfToday().toISOString());

    if (todayTotal + amount > INDIVIDUAL_INVOICE_DAILY_LIMIT) {
      return {
        allowed: false,
        message: `Limit jounalye pou fakti se ${INDIVIDUAL_INVOICE_DAILY_LIMIT.toLocaleString()} HTG. Ou gentan kreye ${todayTotal.toLocaleString()} HTG an fakti jodi a.`,
        todayTotal, monthTotal: 0, dailyLimit: INDIVIDUAL_INVOICE_DAILY_LIMIT, monthlyLimit: Infinity,
      };
    }

    return { allowed: true, todayTotal, monthTotal: 0, dailyLimit: INDIVIDUAL_INVOICE_DAILY_LIMIT, monthlyLimit: Infinity };
  }

  if (enterprise && channel !== 'card') {
    return { allowed: true, todayTotal: 0, monthTotal: 0, dailyLimit: Infinity, monthlyLimit: Infinity };
  }

  const dailyLimit = enterprise ? ENTERPRISE_CARD_DAILY_LIMIT : INDIVIDUAL_DAILY_LIMIT;
  const monthlyLimit = enterprise ? ENTERPRISE_CARD_MONTHLY_LIMIT : INDIVIDUAL_MONTHLY_LIMIT;
  const types = channel === 'transfer' ? TRANSFER_TYPES : channel === 'withdraw' ? WITHDRAW_TYPES : CARD_SPEND_TYPES;

  const [todayTotal, monthTotal] = await Promise.all([
    sumOutgoing(supabase, userId, types, startOfToday().toISOString()),
    sumOutgoing(supabase, userId, types, startOfMonth().toISOString()),
  ]);

  if (todayTotal + amount > dailyLimit) {
    return {
      allowed: false,
      message: `Limit jounalye a se ${dailyLimit.toLocaleString()} HTG. Ou gentan itilize ${todayTotal.toLocaleString()} HTG jodi a.`,
      todayTotal, monthTotal, dailyLimit, monthlyLimit,
    };
  }

  if (monthTotal + amount > monthlyLimit) {
    return {
      allowed: false,
      message: `Limit mansyèl la se ${monthlyLimit.toLocaleString()} HTG. Ou gentan itilize ${monthTotal.toLocaleString()} HTG mwa sa a.`,
      todayTotal, monthTotal, dailyLimit, monthlyLimit,
    };
  }

  return { allowed: true, todayTotal, monthTotal, dailyLimit, monthlyLimit };
}

export interface BalanceCapResult {
  allowed: boolean;
  message?: string;
  cap: number;
}

/**
 * Verifye si kredite yon kont ak NOUVO kòb (depo, transfè resevwa, peman kat
 * resevwa, elatriye) ta fè balans prensipal li (`wallet_balance`) depase
 * plafon otorize a, dapre tip kont lan.
 *
 * - Kont Endividyèl: plafon 105,000 HTG.
 * - Kont Antrepriz apwouve: plafon 2,000,000 HTG.
 *
 * ⚠️ Sa a SÈLMAN aplike sou operasyon ki bay yon kont NOUVO kòb (depo,
 * transfè/peman resevwa, elatriye). Li PA dwe aplike sou ranbousman/anilasyon
 * ki senpleman retabli kòb yon kont te deja genyen anvan (egzanp: anile yon
 * retrè, ranbouse yon frè rejte) — sa yo pa "nouvo" kòb, se pwòp kòb kliyan an.
 */
export function checkBalanceCap(
  currentBalance: number,
  accountType: string | null | undefined,
  incomingAmount: number
): BalanceCapResult {
  const enterprise = isEnterpriseAccount(accountType);
  const cap = enterprise ? ENTERPRISE_MAX_WALLET_BALANCE : INDIVIDUAL_MAX_WALLET_BALANCE;

  const projected = Number(currentBalance || 0) + Number(incomingAmount || 0);
  if (projected > cap) {
    return {
      allowed: false,
      cap,
      message: `Balans maksimòm otorize pou ${enterprise ? 'yon Kont Antrepriz' : 'yon Kont Endividyèl'} se ${cap.toLocaleString()} HTG. Operasyon sa a ta fè balans lan rive ${projected.toLocaleString()} HTG, sa depase limit la.`,
    };
  }

  return { allowed: true, cap };
}

export interface ApiReceiveLimitResult {
  allowed: boolean;
  message?: string;
  limit: number;
  todayReceived: number;
}

// Total kòb yon machann DEJA resevwa via API piblik la jodi a. Nou idantifye
// peman API yo pa tag `metadata->>'source' = 'public_api'` (nou PA chanje
// `type = 'SALE'` la pou pa kraze afichaj/kalkil ki egziste deja).
async function sumApiReceivedToday(
  supabase: SupabaseClient,
  merchantId: string,
  sinceIso: string
): Promise<number> {
  const { data } = await supabase
    .from('transactions')
    .select('amount, metadata')
    .eq('user_id', merchantId)
    .eq('metadata->>source', 'public_api')
    .gt('amount', 0)
    .gte('created_at', sinceIso);

  return (data || []).reduce((acc, tx) => {
    const meta = tx.metadata as { gross_amount?: number | string } | null;
    const gross = meta?.gross_amount != null ? Number(meta.gross_amount) : Number(tx.amount || 0);
    return acc + gross;
  }, 0);
}

/**
 * Verifye si yon machann ka RESEVWA yon peman via API piblik la, dapre limit
 * resepsyon an (50,000 HTG kont endividyèl / 2,000,000 HTG kont antrepriz).
 * Kontwole TOUDE: montan yon sèl peman (pa-tranzaksyon) AK total jounalye.
 *
 * ⚠️ Sa a se yon pre-check rapid. Verifikasyon final la (kont kous ant plizyè
 * rekèt similtane) fèt ATOMIKMAN anndan RPC `process_direct_card_payment`.
 */
export async function checkApiReceiveLimit(
  supabase: SupabaseClient,
  merchantId: string,
  accountType: string | null | undefined,
  amount: number
): Promise<ApiReceiveLimitResult> {
  const enterprise = isEnterpriseAccount(accountType);
  const limit = enterprise ? API_RECEIVE_ENTERPRISE_LIMIT : API_RECEIVE_INDIVIDUAL_LIMIT;

  if (amount > limit) {
    return {
      allowed: false,
      limit,
      todayReceived: 0,
      message: `Yon sèl peman pa ka depase ${limit.toLocaleString()} HTG pou ${enterprise ? 'yon Kont Antrepriz' : 'yon Kont Endividyèl'}.`,
    };
  }

  const todayReceived = await sumApiReceivedToday(supabase, merchantId, startOfToday().toISOString());

  if (todayReceived + amount > limit) {
    return {
      allowed: false,
      limit,
      todayReceived,
      message: `Limit resepsyon jounalye via API a se ${limit.toLocaleString()} HTG. Ou gentan resevwa ${todayReceived.toLocaleString()} HTG jodi a.`,
    };
  }

  return { allowed: true, limit, todayReceived };
}
