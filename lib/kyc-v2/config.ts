/**
 * Règ KYC v2 — ki dokiman ak ki chan obligatwa selon tip kont.
 *
 * Yon sèl sous verite: paj kliyan an, wout API a ak revizyon admin an tout
 * li menm règ sa yo, konsa fòmilè a pa ka janm dezakòde ak validasyon sèvè a.
 */

export type AccountType = 'individual' | 'business';

export type IdDocumentType = 'cin' | 'nif' | 'passport' | 'driver_license';

export const ID_DOCUMENT_LABELS: Record<IdDocumentType, string> = {
  cin: 'CIN / Kat Elektoral',
  nif: 'NIF',
  passport: 'Paspò',
  driver_license: 'Pèmi Kondwi',
};

/** Ki pyès idantite ki mande foto dèyè tou. */
export const ID_DOCUMENTS_WITH_BACK: ReadonlySet<IdDocumentType> = new Set<IdDocumentType>([
  'cin',
  'driver_license',
]);

export function requiresIdBack(docType: IdDocumentType): boolean {
  return ID_DOCUMENTS_WITH_BACK.has(docType);
}

export const HAITI_DEPARTMENTS = [
  'Lwès',
  'Nò',
  'Nò-Ès',
  'Nò-Uès',
  'Sid',
  'Sid-Ès',
  'Latibonit',
  'Sant',
  'Grandans',
  'Nip',
] as const;

export type HaitiDepartment = (typeof HAITI_DEPARTMENTS)[number];

export const ACTIVITY_CATEGORIES = [
  'Komès detay',
  'Restoran / Bar',
  'Otèl / Rezèvasyon',
  'Transpò / Livrezon',
  'Sèvis pwofesyonèl',
  'Edikasyon / Fòmasyon',
  'Sante / Famasi',
  'Teknoloji / Lojisyèl',
  'Divètisman / Evènman',
  'Agrikilti',
  'Konstriksyon',
  'Lòt',
] as const;

export const PARTY2_ROLES = [
  'Asosye / ko-pwopriyetè',
  'Administratè',
  'Kontab / trezorye',
  'Mandatè legal',
  'Lòt',
] as const;

export type Party2Role = (typeof PARTY2_ROLES)[number];

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const PAYOUT_PROVIDERS = ['moncash'] as const;
export type PayoutProvider = (typeof PAYOUT_PROVIDERS)[number];

// ============================================================
// Limit fichye
// ============================================================

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

/** Selfie/liveness dwe se yon imaj — pa yon PDF. */
export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;

export type DocumentSlot =
  | 'id_front'
  | 'id_back'
  | 'selfie'
  | 'business_registration'
  | 'business_nif_doc'
  | 'tax_clearance'
  | 'establishment_photo'
  | 'proof_of_address'
  | 'articles';

export const DOCUMENT_SLOT_LABELS: Record<DocumentSlot, string> = {
  id_front: 'Devan pyès idantite',
  id_back: 'Dèyè pyès idantite',
  selfie: 'Foto figi (an dirèk)',
  business_registration: 'Patant / RCCM (anrejistreman biznis)',
  business_nif_doc: 'NIF biznis (dokiman)',
  tax_clearance: 'Kitan fiskal (quittance DGI)',
  establishment_photo: 'Foto lokal / etablisman biznis',
  proof_of_address: 'Prèv adrès biznis (faktè EDH, DGI, lwaye)',
  articles: 'Statu / akò asosyasyon',
};

/** Kolòn baz done ki koresponn ak chak dokiman. */
export const DOCUMENT_SLOT_COLUMNS: Record<DocumentSlot, string> = {
  id_front: 'id_front_path',
  id_back: 'id_back_path',
  selfie: 'selfie_path',
  business_registration: 'business_registration_path',
  business_nif_doc: 'business_nif_doc_path',
  tax_clearance: 'tax_clearance_path',
  establishment_photo: 'establishment_photo_path',
  proof_of_address: 'proof_of_address_path',
  articles: 'articles_path',
};

export const BUSINESS_LEGAL_SLOTS: DocumentSlot[] = [
  'business_registration',
  'business_nif_doc',
  'tax_clearance',
  'establishment_photo',
  'proof_of_address',
  'articles',
];

/** Ki dokiman obligatwa pou yon dosye bay tip kont + pyès idantite. */
export function requiredDocuments(
  accountType: AccountType,
  docType: IdDocumentType | null
): DocumentSlot[] {
  const slots: DocumentSlot[] = ['id_front', 'selfie'];
  if (docType && requiresIdBack(docType)) slots.push('id_back');
  if (accountType === 'business') slots.push(...BUSINESS_LEGAL_SLOTS);
  return slots;
}

// ============================================================
// Validasyon chan
// ============================================================

export const MIN_AGE_YEARS = 18;

export type FieldErrors = Record<string, string>;

function isBlank(v: unknown): boolean {
  return typeof v !== 'string' || v.trim().length === 0;
}

/** Nòmalize yon nimewo Ayisyen an chif sèlman, ak prefiks 509. */
export function normalizeHaitiPhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return `509${digits}`;
  if (digits.length === 11 && digits.startsWith('509')) return digits;
  return null;
}

export function ageFrom(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export type KycFormFields = {
  account_type?: unknown;
  full_name?: unknown;
  date_of_birth?: unknown;
  address_street?: unknown;
  address_city?: unknown;
  address_department?: unknown;
  phone_primary?: unknown;
  email?: unknown;
  activity_category?: unknown;
  monthly_volume_estimate?: unknown;
  business_name?: unknown;
  business_url?: unknown;
  service_description?: unknown;
  business_nif?: unknown;
  business_rccm?: unknown;
  party1_whatsapp?: unknown;
  party1_moncash?: unknown;
  party2_full_name?: unknown;
  party2_role?: unknown;
  party2_whatsapp?: unknown;
  party2_moncash?: unknown;
  id_document_type?: unknown;
  id_number?: unknown;
  payout_provider?: unknown;
  payout_phone?: unknown;
};

type FieldCtx = {
  errors: FieldErrors;
  values: Record<string, unknown>;
  partial: boolean;
};

function requireText(
  ctx: FieldCtx,
  key: string,
  value: unknown,
  message: string
): string | null {
  if (isBlank(value)) {
    if (!ctx.partial) ctx.errors[key] = message;
    return null;
  }
  return String(value).trim();
}

function setHaitiPhone(
  ctx: FieldCtx,
  key: string,
  raw: unknown,
  emptyMsg: string,
  badMsg: string
): void {
  const text = requireText(ctx, key, raw, emptyMsg);
  if (text === null) return;
  const normalized = normalizeHaitiPhone(text);
  if (!normalized) ctx.errors[key] = badMsg;
  else ctx.values[key] = normalized;
}

function applyIdentity(ctx: FieldCtx, input: KycFormFields): void {
  const fullName = requireText(ctx, 'full_name', input.full_name, 'Non konplè obligatwa.');
  if (fullName !== null) {
    if (fullName.length < 3) ctx.errors.full_name = 'Non an twò kout.';
    else if (!fullName.includes(' ')) ctx.errors.full_name = 'Mete non ak siyati.';
    else ctx.values.full_name = fullName.slice(0, 120);
  }

  const dob = requireText(ctx, 'date_of_birth', input.date_of_birth, 'Dat nesans obligatwa.');
  if (dob !== null) {
    const age = ageFrom(dob);
    if (age === null || age > 120) ctx.errors.date_of_birth = 'Dat nesans pa valab.';
    else if (age < MIN_AGE_YEARS) ctx.errors.date_of_birth = `Ou dwe gen omwen ${MIN_AGE_YEARS} an.`;
    else ctx.values.date_of_birth = dob;
  }
}

function applyAddress(ctx: FieldCtx, input: KycFormFields): void {
  const street = requireText(ctx, 'address_street', input.address_street, 'Adrès obligatwa.');
  if (street !== null) ctx.values.address_street = street.slice(0, 200);

  const city = requireText(ctx, 'address_city', input.address_city, 'Vil obligatwa.');
  if (city !== null) ctx.values.address_city = city.slice(0, 100);

  const dept = requireText(ctx, 'address_department', input.address_department, 'Depatman obligatwa.');
  if (dept !== null) {
    if (!HAITI_DEPARTMENTS.includes(dept as HaitiDepartment)) {
      ctx.errors.address_department = 'Chwazi yon depatman nan lis la.';
    } else ctx.values.address_department = dept;
  }
}

const SIMPLE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function applyContact(ctx: FieldCtx, input: KycFormFields): void {
  setHaitiPhone(
    ctx,
    'phone_primary',
    input.phone_primary,
    'Nimewo telefòn obligatwa.',
    'Nimewo pa valab (egzanp: 3720 1241).'
  );

  const email = requireText(ctx, 'email', input.email, 'Imèl obligatwa.');
  if (email !== null) {
    if (!SIMPLE_EMAIL.test(email)) ctx.errors.email = 'Imèl pa valab.';
    else ctx.values.email = email.toLowerCase().slice(0, 200);
  }
}

function applyActivity(ctx: FieldCtx, input: KycFormFields): void {
  const activity = requireText(
    ctx,
    'activity_category',
    input.activity_category,
    'Chwazi kalite aktivite ou.'
  );
  if (activity !== null) {
    if (!ACTIVITY_CATEGORIES.includes(activity as ActivityCategory)) {
      ctx.errors.activity_category = 'Chwazi yon kategori nan lis la.';
    } else ctx.values.activity_category = activity;
  }

  if (input.monthly_volume_estimate != null && !isBlank(input.monthly_volume_estimate)) {
    const vol = Number(input.monthly_volume_estimate);
    if (!Number.isFinite(vol) || vol < 0) {
      ctx.errors.monthly_volume_estimate = 'Estimasyon an dwe yon nonb.';
    } else ctx.values.monthly_volume_estimate = Math.round(vol);
  }
}

function applyIdDocument(ctx: FieldCtx, input: KycFormFields): void {
  const docType = requireText(ctx, 'id_document_type', input.id_document_type, 'Chwazi yon pyès idantite.');
  if (docType !== null) {
    if (!(docType in ID_DOCUMENT_LABELS)) ctx.errors.id_document_type = 'Pyès idantite pa rekonèt.';
    else ctx.values.id_document_type = docType;
  }

  const idNumber = requireText(ctx, 'id_number', input.id_number, 'Nimewo pyès idantite obligatwa.');
  if (idNumber !== null) {
    const cleaned = idNumber.replace(/\s+/g, '');
    if (cleaned.length < 5) ctx.errors.id_number = 'Nimewo a twò kout.';
    else ctx.values.id_number = cleaned.slice(0, 40);
  }
}

function applyPayout(ctx: FieldCtx, input: KycFormFields): void {
  const provider = input.payout_provider ?? 'moncash';
  if (!PAYOUT_PROVIDERS.includes(provider as PayoutProvider)) {
    ctx.errors.payout_provider = 'Chwazi MonCash.';
  } else ctx.values.payout_provider = provider;

  setHaitiPhone(
    ctx,
    'payout_phone',
    input.payout_phone,
    'Nimewo kote ou vle resevwa lajan ou obligatwa.',
    'Nimewo payout pa valab.'
  );
}

function applyPartyPhone(
  ctx: FieldCtx,
  key: string,
  raw: unknown,
  emptyMsg: string
): void {
  setHaitiPhone(ctx, key, raw, emptyMsg, 'Nimewo pa valab.');
}

function applyBusinessParties(ctx: FieldCtx, input: KycFormFields): void {
  applyPartyPhone(ctx, 'party1_whatsapp', input.party1_whatsapp, 'WhatsApp reprezantan legal la obligatwa.');
  applyPartyPhone(ctx, 'party1_moncash', input.party1_moncash, 'Nimewo MonCash reprezantan legal la obligatwa.');

  const p2name = requireText(ctx, 'party2_full_name', input.party2_full_name, 'Non dezyèm moun otorize a obligatwa.');
  if (p2name !== null) {
    if (p2name.length < 3 || !p2name.includes(' ')) {
      ctx.errors.party2_full_name = 'Mete non ak siyati dezyèm moun nan.';
    } else ctx.values.party2_full_name = p2name.slice(0, 120);
  }

  const p2role = requireText(ctx, 'party2_role', input.party2_role, 'Chwazi wòl dezyèm moun nan.');
  if (p2role !== null) {
    if (!PARTY2_ROLES.includes(p2role as Party2Role)) ctx.errors.party2_role = 'Chwazi yon wòl nan lis la.';
    else ctx.values.party2_role = p2role;
  }

  applyPartyPhone(ctx, 'party2_whatsapp', input.party2_whatsapp, 'WhatsApp dezyèm moun nan obligatwa.');
  applyPartyPhone(ctx, 'party2_moncash', input.party2_moncash, 'Nimewo MonCash dezyèm moun nan obligatwa.');
}

function applyBusiness(ctx: FieldCtx, input: KycFormFields, accountType: unknown): void {
  if (accountType !== 'business') {
    if (!isBlank(input.business_name)) {
      ctx.values.business_name = String(input.business_name).trim().slice(0, 160);
    }
    return;
  }

  const bizName = requireText(ctx, 'business_name', input.business_name, 'Non biznis obligatwa.');
  if (bizName !== null) ctx.values.business_name = bizName.slice(0, 160);

  const services = requireText(
    ctx,
    'service_description',
    input.service_description,
    'Di ki kalite sèvis biznis la ap bay.'
  );
  if (services !== null) {
    if (services.length < 12) ctx.errors.service_description = 'Dekri sèvis yo yon ti kras plis (omwen 12 karaktè).';
    else ctx.values.service_description = services.slice(0, 800);
  }

  const nif = requireText(ctx, 'business_nif', input.business_nif, 'NIF biznis obligatwa.');
  if (nif !== null) ctx.values.business_nif = nif.replace(/\s+/g, '').slice(0, 40);

  const rccm = requireText(ctx, 'business_rccm', input.business_rccm, 'Nimewo RCCM / patant obligatwa.');
  if (rccm !== null) ctx.values.business_rccm = rccm.replace(/\s+/g, ' ').slice(0, 60);

  applyBusinessParties(ctx, input);
}

function applyBusinessUrl(ctx: FieldCtx, input: KycFormFields): void {
  if (isBlank(input.business_url)) return;
  const url = String(input.business_url).trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      ctx.errors.business_url = 'Sit la dwe kòmanse ak http:// oswa https://.';
    } else ctx.values.business_url = parsed.toString().slice(0, 300);
  } catch {
    ctx.errors.business_url = 'Adrès sit la pa valab.';
  }
}

/**
 * Valide chan fòmilè yo. Retounen chan nòmalize yo oswa yon lis erè pa chan.
 * `partial: true` sèvi pou sove yon bouyon — chan vid pa bay erè.
 */
export function validateKycFields(
  input: KycFormFields,
  options: { partial?: boolean } = {}
):
  | { ok: true; values: Record<string, unknown> }
  | { ok: false; errors: FieldErrors } {
  const ctx: FieldCtx = { errors: {}, values: {}, partial: options.partial === true };

  const accountType = input.account_type;
  if (accountType !== 'individual' && accountType !== 'business') {
    ctx.errors.account_type = 'Chwazi si se yon kont endividyèl oswa yon kont biznis.';
  } else {
    ctx.values.account_type = accountType;
  }

  applyIdentity(ctx, input);
  applyAddress(ctx, input);
  applyContact(ctx, input);
  applyActivity(ctx, input);
  applyIdDocument(ctx, input);
  applyPayout(ctx, input);
  applyBusiness(ctx, input, accountType);
  applyBusinessUrl(ctx, input);

  if (Object.keys(ctx.errors).length > 0) return { ok: false, errors: ctx.errors };
  return { ok: true, values: ctx.values };
}
