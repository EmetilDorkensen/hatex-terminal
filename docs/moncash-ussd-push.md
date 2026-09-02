# MonCash "USSD push" (telefòn-premye) — Gid entegrasyon ak Digicel

## Sitiyasyon

HatexCard vle peye **san** voye kliyan an sou paj hosted MonCash la
(`Moncash-middleware/Payment/Redirect`). Flow vize a:

1. Kliyan an antre **nimewo MonCash li** sou paj HatexCard (API / plugin / pwodwi / fakti).
2. HatexCard voye yon demann bay MonCash ak nimewo sa a.
3. MonCash voye yon **USSD** sou SIM kliyan an → kliyan an konfime ak PIN li.
4. Lajan an ale sou kont biznis HatexCard; HatexCard pran frè li epi fè payout machann nan
   otomatikman; machann nan resevwa yon notifikasyon/resi.

## Ki sa ki deja fèt nan kòd (2026-09)

- **`lib/moncash/ussd-push.ts`** — adaptè ki prete:
  - `parseMonCashFlow` / `normalizeMonCashPhone` / `isValidHaitiMonCashPhone`
  - `attemptMonCashUssdPush(...)` — rele `POST {MONCASH_USSD_PUSH_URL}` ak
    `{ phone, amount, orderId, reference, description }` (Bearer token OAuth biznis la).
- **Sifas ki sèvi ak telefòn-premye deja** (param `flow: 'auto' | 'redirect' | 'ussd'` + `customer_phone`):
  - `POST /v2/payments` (pasrèl v2)
  - `POST /api/moncash/payments` (API machann / plugin)
  - `POST /api/products/pay` (lyen pwodwi `/p/[slug]`)
  - `POST /api/checkout-invoice/[id]/pay-moncash` (fakti)
  - Plugin WooCommerce (ZIP ki tejenere sou `/plugin`)
- **Repons yo** gen kounye a `checkout_mode: 'hosted' | 'ussd'`:
  - `'hosted'` → `checkout_url` bay la se paj MonCash (fallback jodi a).
  - `'ussd'` → pa gen `checkout_url`; MonCash voye USSD a dirèkteman.
- **`GET /api/checkout/status?payment_id=<uuid>`** — polling estati peman an pou paj ki
  kenbe kliyan an.

## Sa k rete pou "vre USSD" la mache

Kòd la sèlman aktive USSD dirèk si varyab anviwònman sa a egziste:

```
MONCASH_USSD_PUSH_URL=https://...
```

Epi li dwe konplete kontra a (payload + validasyon repons) nan
`lib/moncash/ussd-push.ts` lè Digicel voye espesifikasyon ofisyèl la.

## Aksyon pou w fè ak Digicel Business

Kontakte Digicel Business (egzanp: `MFS_B.Services@digicelgroup.com`) pou mande sou kont
biznis MonCash HatexCard la:

1. **`Transfert`** (payout otomatik bay machann yo) — kounye a bay **403 Forbidden**.
2. **API "Direct Debit / USSD Push"** — kote HatexCard ka voye `{ phone, amount, orderId }`
   epi MonCash voye yon USSD sou nimewo a (sa se pwodui API ki pi gran pase "Bouton MonCash").

Lè yo bay aksè a, mande:
- **Endpoin** an (URL pou POST),
- **Kle/espesifikasyon** yo (menm OAuth oswa lòt),
- Kouman **webhook/Alert URL** la ap fèt pou yon peman USSD,
- Kouman **verifye** yon peman (RetrieveOrderPayment ak ki referans),
- Limit ak kondisyon (konsantman kliyan, orè, montan maksimòm).

## Rekòmandasyon pou verifikasyon sandbox

1. Mande Digicel si sandbox la gen yon `MONCASH_USSD_PUSH_URL` tès.
2. Tcheke lè y ap voye USSD a: li dwe parèt sou nimewo tès la.
3. Konfime webhook `hatexcard.com/api/moncash/alert` rive lè kliyan an peye.
4. Apre sa, chanje machann yo (`api_key_mode`) an `live` epi deplwaye.

## Kisa yo pa janm dwe fè

- Pa rele `attemptMonCashUssdPush` ak yon nimewo ki pa `509` + 8 chif.
- Pa estoke PIN kliyan. MonCash se sèl moun ki jere PIN an (nan USSD a).
- Pa fè konfyans yon repons "USSD voye" san nou pa verifye peman an ak MonCash
  (RetrieveOrder/Transaction) anvan nou make l peye — prensip regleman kòd la rete.
