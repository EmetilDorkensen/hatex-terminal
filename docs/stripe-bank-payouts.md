# Payout bank (HTG / USD) — Stripe Connect (tès)

Dokiman sa a dekri workflow la pou payout bank ki rete nan lapo admin la:

- **MonCash / NatCash** — toujou trete atravè MonCash (retry admin).
- **Bank Ayiti (HTG)** — konfimasyon manyèl pa admin (depo a fèt deyò platform lan).
- **Bank USA (USD)** — Stripe Connect **test mode** (kle `sk_test_...`).

## 1. Ki sa moun nan lapo admin ka fè

Paj **admin → Payout**:

| Aksyon | Kondisyon | Efè |
|---|---|---|
| **Konfime peye** | pending / processing | status → `paid`, notifikasyon voye bay machann, odit ekri |
| **Refize** | pending / processing | status → `failed` |
| **Retry** | pending / failed **+ `receiver_provider='moncash'`** | relanse `executeMerchantPayout` |
| **Voye via Stripe** | pending / failed **+ `bank_us`** | `stripe.payouts.create` sou account Connect (test), status → `processing` |
| **Rafrechi Stripe** | processing **+ `provider_transaction_id`** | `stripe.payouts.retrieve` → mete ajou DB + notifikasyon sou `paid`/`failed` |

Tout aksyon ekri nan `admin_audit_log` (`PAYOUT_CONFIRM_MANUAL`, `PAYOUT_FAIL`, `PAYOUT_RETRY`, `PAYOUT_STRIPE_PAY`, `PAYOUT_STRIPE_REFRESH`).

## 2. Konfigirasyon Stripe

1. Kreye yon **conte Stripe** (dashboard.stripe.com) epi jwenn yon kle **test** (`sk_test_...`).
2. Ajoute kle a nan env `next`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_xxxx
   ```
3. Kòd la toujou verifye `sk_test_` anvan li fè yon apèl — **pa janm itilize yon kle live san egzamen**.
4. Pa gen okenn clef piblik (NEXT_PUBLIC) bezwen pou sa: se gwo boutèy la sèlman.

**Model Stripe yo itilize** (nan `lib/payouts/providers/stripe.ts`):

- `stripe.accounts.create({ type: 'custom', country: 'US', capabilities: { transfers: { requested: true } }, ... })`
  → ID a sove nan `hatex_bank_accounts.stripe_connect_account_id`.
- `stripe.tokens.create({ bank_account: { ... routing_number, account_number ... } })`
- `stripe.accounts.createExternalAccount(connectAccountId, { external_account: token.id })`
  → ID a sove nan `hatex_bank_accounts.stripe_external_account_id`.
- `stripe.payouts.create({ amount (cents), currency: 'usd', destination: connectAccountId }, { idempotencyKey: 'hx_payout_<payoutId>' })`
  → ID a sove nan `hatex_payouts.provider_transaction_id`.
- `stripe.payouts.retrieve(transactionId)` pou "Rafrechi".

## 3. Konvèsyon HTG → USD

- To a se `payout_usd_htg_rate` nan `hatex_gateway_settings` (**default: 132 HTG pou 1 USD**).
- Admin ka chanje li nan **admin → Frè → gwoup "Konvèsyon"**.
- Lè yon payout `bank_us` kreye, montan HTG a konvèti an USD:
  `amount_usd = round(amount_htg / rate, 2)` (gade `lib/payouts/rates.ts`).
- `rate_used` anrejistre ak payout la — sa vle di to a pa chanje apre kreyasyon an.

## 4. Kont bank: routing + account separe

- Pou **Bank USA**, fòmilè a mande **routing number (9 chif)** + **nimewo kont** apa.
- API `/api/v2/bank-accounts` (POST) sèvi ak:
  - `routing_number` → nouvo kolòn `hatex_bank_accounts.routing_number`
  - `account_number` → nimewo kont sèlman
- Ansyen fòma "`RRRRRRRRR` + account" nan yon sèl jaden **toujou sipòte** (retrospektif):
  si `routing_number` vid e `account_number` kòmanse ak 9 chif, API a separe yo.

## 5. Sèk ki fè l mach

1. Machann aji `bank_us` nan `ConnectBankModal` (routing + account).
2. Yon peman antre, `lib/invoices/moncash-pay.ts` kreye payout:
   - `receiver_provider = 'bank'`, `bank_account_id`, `currency = 'USD'`, `amount_usd`, `rate_used`.
3. `lib/payouts/execute.ts` wè bank → pa eseye MonCash, kite status `pending` (lapo admin).
4. Admin klike **Voye via Stripe** → `stripe_pay` → `processing` + `provider_transaction_id`.
5. Admin ka klike **Rafrechi Stripe** → eta Stripe mete ajou DB (status + `paid_at`/`last_error`).
6. Si Stripe pa ka voye a (kont enkonplè, minimòm $0.50, e.g.), `last_error` la afich nan lapo a.

## 6. Test

- Tout aksyon sèvi ak mode tès (kle `sk_test_`).
- Test sou Stripe se san danje: yo pa retire lajan reyèl.
- Pou tcheke kont Connect yo: Stripe Dashboard → **Connect** → **Accounts**.
- Pou wè payout: Stripe Dashboard → **Payments** → **Payouts** (filtè mode tès).

## 7. Nòt sekirite

- Chak aksyon admin verifye: `requireAdminUser` (email admin sèlman) + `hasValidAdminGate`.
- `rateLimit` (`admin-payouts:${ip}`) limite demann yo.
- Nimewo kont yo montre maske (`•••• 1234`) nan lapo a.
- Pakèt ID Stripe (account, external account, payout) yo anrejistre nan DB — pa gen okenn ID kenbe sèlman nan UI.
