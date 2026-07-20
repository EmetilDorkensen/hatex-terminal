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

/** Menm mesaj ak subscribe/[id]/page.tsx lè card_balance pa ase pou montan an. */
export function insufficientCardBalanceMessage(balances: ClientPaymentBalances, amount: number): string {
  return `Ou pa gen ase fon sou kat ou a. Balans kat ou se: ${balances.card_balance.toFixed(2)} HTG (bezwen ${amount.toFixed(2)} HTG).`;
}

export function insufficientClientFundsMessage(balances: ClientPaymentBalances, amount: number): string {
  if (balances.card_balance < amount && balances.wallet_balance >= amount) {
    return (
      `Balans kat (${balances.card_balance.toFixed(2)} HTG) pa ase, men wallet ou gen ${balances.wallet_balance.toFixed(2)} HTG. ` +
      `Peman an ap soti nan wallet la. Pou debite kat la dirèkteman, ale sou /kat/recharge.`
    );
  }
  return (
    `Fon ensifizan pou ${amount.toFixed(2)} HTG. ` +
    `Balans kat (profiles.card_balance): ${balances.card_balance.toFixed(2)} HTG, ` +
    `balans wallet: ${balances.wallet_balance.toFixed(2)} HTG. ` +
    `Si lajan an sou Dashboard (wallet) epi pa sou /kat, ale sou /kat/recharge pou transfere l sou kat la.`
  );
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
