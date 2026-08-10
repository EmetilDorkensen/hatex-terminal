# Plan Finansye — Konekte HatexCard ak Stripe / PayPal

> Dokiman referans pou pri, kontra, ak etap teknik pou konekte HatexCard ak mond lajan entènasyonal la (Stripe dabò, PayPal apre si nesesè). Chif yo baze sou done piblik 2026 (Stripe, PayPal, Mercury, Wise, Delaware Division of Corporations). Tout pri an **USD**, paske se konsa fwonisè sa yo faktire — konvèti an HTG selon to chanj jou a lè w bidjetize.

## 0. Reyalite jiridiksyon (poukisa yon LLC obligatwa)

Ni **Stripe** ni **PayPal** pa aksepte kont biznis ak yon adrès Ayisyen dirèkteman an 2026. Chemen obligatwa a:

1. Kreye yon antite Ameriken (LLC) — pi rapid ak pi senp: **Stripe Atlas**
2. Louvri yon kont bank biznis Ameriken ak LLC + EIN la (Mercury oswa Wise Business)
3. Sèlman apre sa, kreye kont Stripe (epi PayPal pita si nesesè)

## 1. Kreye LLC (antite legal)

| Sèvis | Pri ane 1 | Renouvèlman/ane |
|---|---|---|
| **Stripe Atlas** (rekòmande — pi senp, fèt pou egzakteman sa a) | $500 (fòmasyon Delaware + EIN + ajan enrejistre ane 1 + $2,500 kredi Stripe) | $100/ane |
| Firstbase | ~$500–850 | $299–350/ane |
| Doola | ~$400 | $297/ane |
| Taks eta Delaware (fiks, obligatwa chak ane) | $300 (ap monte $400 apati 1ye Out 2026) | $300–400/ane |

**Estimasyon ane 1 (Stripe Atlas):** **~$800–900 USD**
**Chak ane apre:** **~$400–500 USD/ane**

## 2. Kont bank biznis Ameriken

| Bank | Kout mansyèl | Frè kle |
|---|---|---|
| **Mercury** (rekòmande pou non-rezidan) | $0/mwa | Wè entènasyonal SHA gratis; opsyon OUR $15; konvèsyon non-USD 1% |
| **Wise Business** | $0/mwa | Aktivasyon yon fwa $31; SWIFT antre ~$6/tranzaksyon; konvèsyon ~0.4–1% |

**Kout demare: $0–31 USD.**

## 3. Stripe — komisyon sou tranzaksyon (pa gen frè enskripsyon)

| Kalite tranzaksyon | Frè |
|---|---|
| Kat online, domestik US | 2.9% + $0.30 |
| Siplemantè si kat la soti aletranje (kliyan Ayisyen, elt.) | +1.5% |
| Siplemantè konvèsyon deviz (USD ↔ lòt) | +1% |
| **Total reyalis pou kliyan entènasyonal** | **~4.4–5.4% pa tranzaksyon** |
| Retrè kach depi Stripe rive nan bank (Payout) | Gratis (estanda 2 jou); Instant Payout 1% |

## 4. PayPal — pou konparezon / etap 2 pita

| Kalite tranzaksyon | Frè |
|---|---|
| PayPal Checkout | 3.49% + $0.49 |
| Kat kredi/debi estanda | 2.99% + $0.29 |
| Siplemantè entènasyonal | +1.5% |
| **Total reyalis** | **~4.5–5% pa tranzaksyon** (pi wo pase Stripe an jeneral) |

## 5. ⚠️ Money Transmitter License (MTL) — SÈLMAN si objektif se vrè "transfè lajan" (remitans)

Pa nesesè pou Senaryo A (aksepte peman kat sèlman). Mansyone la a pou referans si pwojè a grandi vin yon sèvis transfè lajan pwòp:

| Eleman | Pri chak eta |
|---|---|
| Anrejistreman federal FinCEN | Gratis (men konfòmite AML ~$40,000–$130,000/ane) |
| Frè aplikasyon leta | $500–$10,000 pa eta |
| Bond (garanti) | $10,000 (ti eta) jiska $500,000–$7M (California, New York) |
| Kapital minimòm obligatwa | $100,000–$1M+ selon eta |
| Estrateji limite (5 eta kle) | ~$70,000–$200,000 total |
| Estrateji nasyonal konplè | $500,000–$1.5M+ an frè, jiska $7–12M an kapital/bond |

## 6. Konsèy legal / kontablite

| Sèvis | Estimasyon |
|---|---|
| Konsiltasyon avoka (estrikti LLC + kontra) | $500–$2,000 (yon fwa) |
| PCI-DSS SAQ-A (si Stripe Elements/Checkout jere kat la — pa gen ekstra chaj, enkli nan Stripe) | $0 |
| Kontablite/deklarasyon taks federal US pou LLC etranje | $500–$1,800/ane |

## 7. REZIME — Senaryo A: Stripe sèlman (chwa aktyèl la)

Objektif: pèmèt kliyan **peye ak nenpòt kat (Visa/Mastercard, kèlkeswa peyi kat la soti)** pou rechaje kont HatexCard oswa peye nan checkout/invoice/store — san chanje sistèm kat vityèl HatexCard la.

| Depans | Kout |
|---|---|
| LLC + ajan enrejistre (ane 1) | ~$800 |
| Kont bank (Mercury oswa Wise) | $0–31 |
| Konsèy legal debaz | ~$500–1,000 |
| Kontablite ane 1 | ~$500–900 |
| **TOTAL DEMARE (yon fwa)** | **~$1,800–$2,700 USD** |
| **Chak ane apre (LLC + ajan + kontablite)** | **~$900–1,400 USD/ane** |
| **Kòb kontinyèl sou chak tranzaksyon** | 2.9–5.4% selon kote kat la soti |

## 8. Etap pratik pou kòmanse (lè w pare)

1. Kreye LLC ak Stripe Atlas ($500) → resevwa EIN
2. Louvri kont Mercury ak LLC + EIN la (gratis)
3. Kreye kont Stripe Live ak LLC/EIN/kont bank la
4. Mete `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` nan Cloud Agent Secrets / `.env`
5. Devlopman: ajoute Stripe kòm **nouvo metòd depo/peman** — wè seksyon achitekti pi ba a

---

## 9. Achitekti — Èske fòk nou re-ekri kòd la oswa retire kat HatexCard yo?

**Non.** Entegrasyon Stripe la se yon **ajoute**, se pa yon **ranplasman**. De sistèm yo rete separe men konplemantè:

- **Kat vityèl HatexCard** (`4550…`, jenere nan `lib/kyc/card-provision.ts`) se **pwodwi prensipal** platfòm lan — se sa ki fè yon moun gen yon "HatexCard". Yo rete egzakteman jan yo ye — pa gen okenn rezon pou retire yo.
- **Stripe** ap antre kòm yon **nouvo chemen depo/peman**, menm nivo ak MonCash/NatCash yo genyen kounye a, men **otomatik** (pa manyèl):
  - Sou paj `deposit`, ajoute yon 3yèm opsyon "Peye ak kat (Visa/Mastercard — kèlkeswa peyi)" bò kote MonCash/NatCash
  - Sou `checkout` / `invoice` / `store` / `subscribe`, ajoute yon opsyon "Peye ak kat entènasyonal (Stripe)" bò kote opsyon "Peye ak HatexCard" ki egziste deja

**Kòd ki rete san touch:**
- Jenerasyon/jesyon kat vityèl (`lib/kyc/card-provision.ts`, `app/api/card/*`)
- Tout flux peman ki itilize balans/kat Hatex (checkout, transfer, API machann)
- Sistèm sekirite/hash kat aktyèl la

**Kòd nouvo pou ajoute (pa modifye ansyen):**
1. Yon nouvo API route (`app/api/deposit/stripe/create-intent/route.ts`) ki kreye yon Stripe PaymentIntent/Checkout Session
2. Yon nouvo webhook (`app/api/webhooks/stripe/route.ts`) ki koute `payment_intent.succeeded` epi kredite `wallet_balance` otomatikman (menm lojik ak `admin_approve_deposit`, men san admin)
3. Yon nouvo opsyon UI sou `app/deposit/page.tsx` ak paj checkout yo
4. Yon kolòn/tras nan `transactions` pou make sous lan kòm `STRIPE` (menm jan `MONCASH`/`NATCASH` egziste deja)
5. Yon ti kouch konvèsyon **USD → HTG** (Stripe pa aksepte HTG kòm deviz; kliyan peye an USD, sistèm kredite ekivalan HTG)

**Konklizyon:** Ajoute Stripe se yon **ekstansyon add-on**, pa yon refonte. Kat HatexCard yo rete menm jan, itilizatè ki gen kat yo pa wè okenn chanjman — sèlman gen yon nouvo fason pou moun **antre** lajan nan sistèm nan (dabò) e pita **peye** dirèkteman nan checkout/store ak nenpòt kat entènasyonal.
