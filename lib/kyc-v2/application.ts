import type { SupabaseClient } from '@supabase/supabase-js';
import { hashKycIdNumber, normalizeIdNumber } from '@/lib/kyc/id-hash';
import { getGatewaySettings, resolveKycFeeHtg } from '@/lib/moncash/settings';
import {
  requiredDocuments,
  validateKycFields,
  DOCUMENT_SLOT_COLUMNS,
  DOCUMENT_SLOT_LABELS,
  type AccountType,
  type DocumentSlot,
  type FieldErrors,
  type IdDocumentType,
  type KycFormFields,
} from './config';

/**
 * Sik-vi yon dosye KYC v2.
 *
 *   draft ──(ranpli + dokiman + liveness)──► soumèt (san frè)
 *         ──► submitted ──► in_review
 *                       ├─► approved
 *                       └─► rejected (ka reeseye)
 *
 * Frè KYC retire — abonnman (599 / 999 HTG) ranplase l.
 */

export type KycStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';

export type KycApplication = {
  id: string;
  user_id: string;
  account_type: AccountType;
  status: KycStatus;
  full_name: string | null;
  date_of_birth: string | null;
  address_street: string | null;
  address_city: string | null;
  address_department: string | null;
  phone_primary: string | null;
  email: string | null;
  activity_category: string | null;
  monthly_volume_estimate: number | null;
  business_name: string | null;
  business_url: string | null;
  service_description: string | null;
  business_nif: string | null;
  business_rccm: string | null;
  party1_whatsapp: string | null;
  party1_moncash: string | null;
  party2_full_name: string | null;
  party2_role: string | null;
  party2_whatsapp: string | null;
  party2_moncash: string | null;
  id_document_type: IdDocumentType | null;
  id_front_path: string | null;
  id_back_path: string | null;
  selfie_path: string | null;
  business_registration_path: string | null;
  tax_clearance_path: string | null;
  establishment_photo_path: string | null;
  proof_of_address_path: string | null;
  articles_path: string | null;
  business_nif_doc_path: string | null;
  payout_provider: 'moncash' | 'natcash';
  payout_phone: string | null;
  rejection_reason: string | null;
  fee_paid: boolean;
  fee_payment_id: string | null;
  fee_amount: number | null;
  fee_paid_at: string | null;
  face_match_score: number | null;
  liveness_passed: boolean | null;
  liveness_frame_count: number;
  liveness_checked_at: string | null;
  needs_manual_review: boolean;
  id_number_last4: string | null;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
};

export const APPLICATION_SELECT =
  'id, user_id, account_type, status, full_name, date_of_birth, address_street, address_city, address_department, phone_primary, email, activity_category, monthly_volume_estimate, business_name, business_url, service_description, business_nif, business_rccm, party1_whatsapp, party1_moncash, party2_full_name, party2_role, party2_whatsapp, party2_moncash, id_document_type, id_front_path, id_back_path, selfie_path, business_registration_path, tax_clearance_path, establishment_photo_path, proof_of_address_path, articles_path, business_nif_doc_path, payout_provider, payout_phone, rejection_reason, fee_paid, fee_payment_id, fee_amount, fee_paid_at, face_match_score, liveness_passed, liveness_frame_count, liveness_checked_at, needs_manual_review, id_number_last4, created_at, submitted_at, updated_at';

const OPEN_STATUSES: KycStatus[] = ['draft', 'submitted', 'in_review'];

/** Dosye ki an kou (pa fèmen). Null si moun nan poko kòmanse. */
export async function getOpenApplication(
  admin: SupabaseClient,
  userId: string
): Promise<KycApplication | null> {
  const { data } = await admin
    .from('hatex_kyc_applications')
    .select(APPLICATION_SELECT)
    .eq('user_id', userId)
    .in('status', OPEN_STATUSES)
    .maybeSingle();

  return (data as KycApplication) || null;
}

/** Dènye dosye a, nenpòt stati (pou montre apwobasyon/rejè). */
export async function getLatestApplication(
  admin: SupabaseClient,
  userId: string
): Promise<KycApplication | null> {
  const { data } = await admin
    .from('hatex_kyc_applications')
    .select(APPLICATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as KycApplication) || null;
}

export type SaveResult =
  | { ok: true; application: KycApplication }
  | { ok: false; status: number; code: string; message: string; errors?: FieldErrors };

/**
 * Sove yon bouyon. Kreye dosye a si li pa egziste.
 * Yon dosye ki deja soumèt pa ka chanje.
 */
export async function saveDraft(
  admin: SupabaseClient,
  userId: string,
  fields: KycFormFields
): Promise<SaveResult> {
  const existing = await getOpenApplication(admin, userId);

  if (existing && existing.status !== 'draft') {
    return {
      ok: false,
      status: 409,
      code: 'already_submitted',
      message: 'Dosye ou deja soumèt. Tann rezilta revizyon an.',
    };
  }

  const validated = validateKycFields(fields, { partial: true });
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      code: 'validation_failed',
      message: 'Gen chan ki pa korèk.',
      errors: validated.errors,
    };
  }

  const patch: Record<string, unknown> = { ...validated.values, updated_at: new Date().toISOString() };

  // Nimewo idantite: nou sere yon hash + 4 dènye chif, pa nimewo an klè
  if (typeof validated.values.id_number === 'string') {
    const raw = validated.values.id_number as string;
    delete patch.id_number;
    try {
      patch.id_number_hash = hashKycIdNumber(raw);
      patch.id_number_last4 = normalizeIdNumber(raw).slice(-4);
    } catch {
      return {
        ok: false,
        status: 500,
        code: 'hash_unavailable',
        message: 'Konfigirasyon sekirite manke sou sèvè a (KYC_HASH_SECRET).',
      };
    }
  }

  // Chanje pyès idantite → foto dèyè ki te la pa valab ankò
  if (
    existing &&
    typeof patch.id_document_type === 'string' &&
    patch.id_document_type !== existing.id_document_type
  ) {
    patch.id_back_path = null;
  }

  if (!existing) {
    if (typeof patch.account_type !== 'string') {
      return {
        ok: false,
        status: 400,
        code: 'validation_failed',
        message: 'Chwazi tip kont ou anvan.',
        errors: { account_type: 'Chwazi si se yon kont endividyèl oswa biznis.' },
      };
    }

    const { data, error } = await admin
      .from('hatex_kyc_applications')
      .insert({ user_id: userId, status: 'draft', ...patch })
      .select(APPLICATION_SELECT)
      .maybeSingle();

    if (error) return storageError(error.message, error.code);
    return { ok: true, application: data as KycApplication };
  }

  const { data, error } = await admin
    .from('hatex_kyc_applications')
    .update(patch)
    .eq('id', existing.id)
    .eq('status', 'draft')
    .select(APPLICATION_SELECT)
    .maybeSingle();

  if (error) return storageError(error.message, error.code);
  if (!data) {
    return {
      ok: false,
      status: 409,
      code: 'already_submitted',
      message: 'Dosye a chanje pandan tan an. Rafrechi paj la.',
    };
  }

  return { ok: true, application: data as KycApplication };
}

function storageError(message: string, code?: string): SaveResult {
  // Menm pyès idantite deja sèvi nan yon lòt dosye
  if (code === '23505') {
    return {
      ok: false,
      status: 409,
      code: 'duplicate_id_number',
      message: 'Pyès idantite sa a deja sèvi pou yon lòt kont.',
    };
  }
  return { ok: false, status: 500, code: 'storage_error', message };
}

// ============================================================
// Konpletid
// ============================================================

export type Readiness = {
  ready: boolean;
  missingFields: FieldErrors;
  missingDocuments: DocumentSlot[];
  livenessDone: boolean;
  feePaid: boolean;
  /** Sa moun nan dwe peye, an HTG. */
  feeAmount: number;
};

/** Sa ki manke anvan yon dosye ka soumèt. */
export async function evaluateReadiness(
  admin: SupabaseClient,
  app: KycApplication
): Promise<Readiness> {
  const settings = await getGatewaySettings(admin);
  const feeAmount = resolveKycFeeHtg(settings, app.account_type);

  const validated = validateKycFields(
    {
      account_type: app.account_type,
      full_name: app.full_name,
      date_of_birth: app.date_of_birth,
      address_street: app.address_street,
      address_city: app.address_city,
      address_department: app.address_department,
      phone_primary: app.phone_primary,
      email: app.email,
      activity_category: app.activity_category,
      monthly_volume_estimate: app.monthly_volume_estimate,
      business_name: app.business_name,
      business_url: app.business_url,
      service_description: app.service_description,
      business_nif: app.business_nif,
      business_rccm: app.business_rccm,
      party1_whatsapp: app.party1_whatsapp,
      party1_moncash: app.party1_moncash,
      party2_full_name: app.party2_full_name,
      party2_role: app.party2_role,
      party2_whatsapp: app.party2_whatsapp,
      party2_moncash: app.party2_moncash,
      id_document_type: app.id_document_type,
      // Nimewo an klè pa sere; prezans hash la se prèv la
      id_number: app.id_number_last4 ? 'XXXXXXXX' : null,
      payout_provider: app.payout_provider,
      payout_phone: app.payout_phone,
    },
    { partial: false }
  );

  const missingFields = validated.ok ? {} : validated.errors;

  const missingDocuments = requiredDocuments(app.account_type, app.id_document_type).filter(
    (slot) => {
      const column = DOCUMENT_SLOT_COLUMNS[slot] as keyof KycApplication;
      return !app[column];
    }
  );

  const livenessDone = app.liveness_passed === true;

  return {
    ready:
      Object.keys(missingFields).length === 0 &&
      missingDocuments.length === 0 &&
      livenessDone,
    missingFields,
    missingDocuments,
    livenessDone,
    feePaid: app.fee_paid === true,
    feeAmount,
  };
}

export function describeMissingDocuments(slots: DocumentSlot[]): string {
  return slots.map((s) => DOCUMENT_SLOT_LABELS[s]).join(', ');
}

// ============================================================
// Soumisyon (apre frè a peye)
// ============================================================

/**
 * Make dosye a soumèt. Frè KYC retire — abonnman ranplase l.
 * Idempotan — si li deja soumèt, li pa fè anyen.
 */
export async function markApplicationSubmitted(
  admin: SupabaseClient,
  applicationId: string,
  paymentId: string | null,
  feeAmount: number
): Promise<{ ok: boolean; message?: string }> {
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from('hatex_kyc_applications')
    .update({
      status: 'submitted',
      fee_paid: true,
      fee_payment_id: paymentId,
      fee_amount: feeAmount,
      fee_paid_at: now,
      submitted_at: now,
      updated_at: now,
      rejection_reason: null,
    })
    .eq('id', applicationId)
    .eq('status', 'draft')
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data) {
    // Deja soumèt pa yon lòt apèl (alert + retou navigatè) — se yon siksè
    return { ok: true };
  }
  return { ok: true };
}
