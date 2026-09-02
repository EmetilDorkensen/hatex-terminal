# Aktivasyon Transfert (Disbursement) API — MonCash

## Sitiyasyon

Kont biznis MonCash la gen aksè ak **koleksyon** (`CreatePayment`, `RetrieveOrderPayment`) men
**pa gen aksè ak dekèsman** (`Transfert`). San `Transfert`, HatexCard pa ka voye kòb bay machann
yo otomatikman.

## Rezilta tès (sandbox)

| Endpoint | Rezilta |
| --- | --- |
| `POST /Api/oauth/token` | 200 OK |
| `POST /Api/v1/CreatePayment` | 200 OK |
| `POST /Api/v1/RetrieveOrderPayment` | 200 OK |
| `POST /Api/v1/Transfert` | **403 Forbidden** |

Repons egzat MonCash bay:

```json
{
  "path": "/Api/v1/Transfert",
  "error": "Forbidden",
  "message": "The value of parameter {0} is incorrect. The initiator organization queried by the organization entity ID or short code does not exist.",
  "status": 403
}
```

## Sa nou deja verifye

- Menm `access_token` la mache san pwoblèm sou `CreatePayment` — donk otantifikasyon an bon.
- Payload la konfòm ak dokiman ofisyèl la (`RestAPI_MonCash_doc.pdf`) :
  `{ amount, receiver, desc, reference }` ak header `Authorization: Bearer <token>`.
- Erè a **pa depann de nimewo resevè a**. Teste ak de nimewo diferan (yon nimewo valab ak yon
  nimewo ki pa egziste) → menm erè byte pou byte. Sa konfime pwoblèm nan se sou òganizasyon
  **inisyatè** a, pa sou benefisyè a.
- Mete yon short code MFS nan pòtay biznis la pa chanje anyen.

**Konklizyon:** kont biznis la pa gen yon *organization entity* pwovizyone pou dekèsman nan
platfòm MFS la. Se Digicel ki dwe kreye sa bò kote yo.

---

## Bouyon imèl (an franse)

**Pou:** `MFS_B.Services@digicelgroup.com`

**Objet:** Demande d'activation de l'API Transfert (décaissement) — compte marchand MonCash

> Bonjour,
>
> Je vous contacte concernant le compte marchand MonCash de **HatexCard** (nom du business :
> `[NON BIZNIS OU]`, Client ID : `[CLIENT_ID OU]`).
>
> Notre intégration à l'API REST MonCash fonctionne correctement pour la **collecte** de
> paiements. Les appels suivants retournent tous un code 200 avec le même jeton
> d'authentification :
>
> - `POST /Api/oauth/token`
> - `POST /Api/v1/CreatePayment`
> - `POST /Api/v1/RetrieveOrderPayment`
>
> En revanche, l'appel à l'API de **décaissement** échoue systématiquement avec un code 403 :
>
> ```
> POST /Api/v1/Transfert
>
> {
>   "path": "/Api/v1/Transfert",
>   "error": "Forbidden",
>   "message": "The value of parameter {0} is incorrect. The initiator organization queried
>               by the organization entity ID or short code does not exist.",
>   "status": 403
> }
> ```
>
> Nous avons effectué les vérifications suivantes afin d'écarter une erreur d'intégration de
> notre côté :
>
> 1. Le corps de la requête est conforme à votre documentation (`RestAPI_MonCash_doc.pdf`) :
>    `{ amount, receiver, desc, reference }`, avec l'en-tête `Authorization: Bearer <token>`.
> 2. Le jeton utilisé est le même que celui qui fonctionne pour `CreatePayment`, ce qui confirme
>    que l'authentification est valide.
> 3. L'erreur est identique avec deux numéros bénéficiaires différents, y compris un numéro
>    inexistant. Le rejet survient donc avant toute validation du bénéficiaire, et concerne
>    l'organisation **émettrice**.
> 4. La configuration d'un short code MFS dans le portail business n'a pas modifié le résultat.
>
> Le message d'erreur indique que notre compte ne possède pas d'*organization entity*
> provisionnée pour le décaissement sur la plateforme MFS.
>
> Je vous demande donc de bien vouloir :
>
> - **Activer l'API `Transfert` (décaissement / disbursement)** sur notre compte marchand ;
> - Créer et nous communiquer l'**organization entity ID / short code** correspondant ;
> - Effectuer cette activation à la fois sur l'environnement **sandbox** (pour nos tests) et sur
>   l'environnement **production** ;
> - M'indiquer les éventuelles **conditions préalables** : contrat spécifique, documents à
>   fournir, dépôt de garantie ou solde minimum requis pour alimenter les décaissements, ainsi
>   que les **limites** applicables (montant par transaction, plafond journalier et mensuel).
>
> Ce point est bloquant pour notre lancement : HatexCard est une passerelle de paiement qui
> reverse automatiquement les fonds aux marchands sur leur compte MonCash, ce qui dépend
> entièrement de cette API.
>
> Je reste à votre disposition pour tout complément d'information (journaux d'appels,
> identifiants techniques, démonstration de l'intégration).
>
> Cordialement,
>
> `[NON OU]`
> HatexCard — `[IMÈL OU]` — `[TELEFÒN OU]`

---

## Kesyon enpòtan pou mande yo

Repons sa yo ap detèmine kijan payout la konfigire :

1. **Balans:** èske dekèsman yo pran nan lajan ki fèk kolekte a, oswa nan yon kont depo apa ki
   dwe gen fon davans ?
2. **Limit:** montan maksimòm pa tranzaksyon, pa jou, pa mwa.
3. **Frè:** konbyen Digicel pran pa transfè ? Sa antre dirèkteman nan kalkil frè nou an
   (`lib/moncash/fees.ts`).
4. **Vitès:** èske `Transfert` la sinkwòn (imedyat) oswa asinkwòn ak yon notifikasyon apre ?
5. **Reyesèy:** ki konpòtman si yon transfè echwe — èske `reference` la ka reyitilize san risk
   doub peman (idempotans) ?
