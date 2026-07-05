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
