/** Balans kliyan an ka soti sou kat (card_balance) oswa wallet (wallet_balance). */
export type ClientPaymentBalances = {
  card_balance: number;
  wallet_balance: number;
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

/** Peman API ak kat: debite kat an premye, sinon wallet si li gen ase. */
export function clientCanPayAmount(balances: ClientPaymentBalances, amount: number): boolean {
  return balances.card_balance >= amount || balances.wallet_balance >= amount;
}

export function clientPaymentSource(balances: ClientPaymentBalances, amount: number): 'card' | 'wallet' | null {
  if (balances.card_balance >= amount) return 'card';
  if (balances.wallet_balance >= amount) return 'wallet';
  return null;
}

export function insufficientClientFundsMessage(balances: ClientPaymentBalances, amount: number): string {
  return (
    `Fon ensifizan pou ${amount.toFixed(2)} HTG. ` +
    `Balans kat: ${balances.card_balance.toFixed(2)} HTG, ` +
    `balans wallet: ${balances.wallet_balance.toFixed(2)} HTG. ` +
    `Si lajan an sou Dashboard (wallet) epi pa sou /kat, ale sou /kat/recharge pou transfere l sou kat la.`
  );
}
