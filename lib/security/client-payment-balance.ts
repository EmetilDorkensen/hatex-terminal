/** Balans kliyan an ka soti sou kat (card_balance) oswa wallet (wallet_balance). */
export type ClientPaymentBalances = {
  card_balance: number;
  wallet_balance: number;
};

/** Menm chanm yo lòt paj peman kat yo li nan `profiles` (subscribe, verify-card, checkout RPC). */
export const CLIENT_PAYMENT_PROFILE_SELECT =
  'id, card_balance, wallet_balance, account_status, full_name, account_type, is_activated, is_card_activated, is_card_frozen';

export type ClientPaymentProfile = {
  id: string;
  card_balance?: number | null;
  wallet_balance?: number | null;
  account_status?: string | null;
  full_name?: string | null;
  account_type?: string | null;
  is_activated?: boolean | null;
  is_card_activated?: boolean | null;
  is_card_frozen?: boolean | null;
};

export function normalizeClientBalances(row: {
  card_balance?: number | null;
  wallet_balance?: number | null;
}): ClientPaymentBalances {
  return {
    card_balance: Number(row.card_balance ?? 0),
    wallet_balance: Number(row.wallet_balance ?? 0),
  };
}

/** Peman API ak kat: debite card_balance an premye (tankou subscribe/checkout), sinon wallet. */
export function clientCanPayAmount(balances: ClientPaymentBalances, amount: number): boolean {
  return balances.card_balance >= amount || balances.wallet_balance >= amount;
}

export function clientPaymentSource(balances: ClientPaymentBalances, amount: number): 'card' | 'wallet' | null {
  if (balances.card_balance >= amount) return 'card';
  if (balances.wallet_balance >= amount) return 'wallet';
  return null;
}

export function balanceDiagnosticsFromBalances(
  balances: ClientPaymentBalances,
  amount: number
) {
  return {
    card_htg: balances.card_balance,
    wallet_htg: balances.wallet_balance,
    required_htg: amount,
  };
}

/** Mesaj inik pou tout peman kat san ase lajan — pa ekspoze balans ni chemen teknik. */
export const INSUFFICIENT_FUNDS_MESSAGE = 'Fon ensifizan';

/** Menm mesaj ak subscribe/[id]/page.tsx lè card_balance pa ase pou montan an. */
export function insufficientCardBalanceMessage(_balances?: ClientPaymentBalances, _amount?: number): string {
  return INSUFFICIENT_FUNDS_MESSAGE;
}

export function insufficientClientFundsMessage(_balances?: ClientPaymentBalances, _amount?: number): string {
  return INSUFFICIENT_FUNDS_MESSAGE;
}

/** Si RPC oswa lòt kouch voye mesaj long sou fon, normalize l. */
export function normalizeInsufficientFundsMessage(message: string | null | undefined): string {
  const m = String(message || '');
  if (
    /fon ensifizan/i.test(m) ||
    /pa gen ase fon/i.test(m) ||
    /pa gen ase lajan/i.test(m) ||
    /balans kat/i.test(m) ||
    /card_balance/i.test(m)
  ) {
    return INSUFFICIENT_FUNDS_MESSAGE;
  }
  return m || INSUFFICIENT_FUNDS_MESSAGE;
}

export type ClientPaymentValidation =
  | { ok: true; balances: ClientPaymentBalances; debitFrom: 'card' | 'wallet' }
  | { ok: false; status: number; error: string; balances?: ClientPaymentBalances };

/** Valide kliyan an anvan RPC — menm lòjik ak checkout RPC (account_status sèlman). */
export function validateClientForCardPayment(
  profile: ClientPaymentProfile,
  amount: number
): ClientPaymentValidation {
  if (profile.account_status !== 'active') {
    return {
      ok: false,
      status: 403,
      error:
        profile.account_status === 'suspended'
          ? 'Kont ou sispann. Kontakte sipò HatexCard pou debloke l.'
          : 'Kont ki asosye ak kat sa a pa aktif.',
    };
  }

  if (profile.is_card_frozen === true) {
    return {
      ok: false,
      status: 403,
      error: 'Kat ou friz. Defriz li nan paj Kat (PIN obligatwa) anvan ou ka peye.',
    };
  }

  const balances = normalizeClientBalances(profile);
  const debitFrom = clientPaymentSource(balances, amount);

  if (!debitFrom) {
    return {
      ok: false,
      status: 400,
      error: insufficientClientFundsMessage(balances, amount),
      balances,
    };
  }

  return { ok: true, balances, debitFrom };
}
