/**
 * Map yon ranje hatex_kyc_applications pou Admin / Asistans.
 * Dekodaj nimewo ID chifre a — pa janm ekspoze bay kliyan piblik.
 */

import { decryptKycIdNumber } from '@/lib/kyc/id-hash';

export const KYC_STAFF_SELECT = `
  id, user_id, account_type, status,
  full_name, date_of_birth, address_street, address_city, address_department,
  phone_primary, email, activity_category, monthly_volume_estimate,
  business_name, business_url, service_description, business_nif, business_rccm,
  party1_whatsapp, party1_moncash, party2_full_name, party2_role, party2_whatsapp, party2_moncash,
  id_document_type, id_number_hash, id_number_last4, id_number_enc,
  id_front_path, id_back_path, selfie_path,
  business_registration_path, tax_clearance_path, establishment_photo_path,
  proof_of_address_path, articles_path, business_nif_doc_path,
  payout_provider, payout_phone,
  rejection_reason, fee_paid, fee_amount, fee_paid_at,
  face_match_score, liveness_passed, liveness_frame_count, liveness_checked_at,
  needs_manual_review, created_at, submitted_at, updated_at
`.replace(/\s+/g, ' ').trim();

export type StaffKycView = {
  id: string;
  application_id: string;
  user_id: string;
  full_name: string;
  email: string;
  account_type: string | null;
  status: string | null;
  date_of_birth: string | null;
  address_street: string | null;
  address_city: string | null;
  address_department: string | null;
  phone_primary: string | null;
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
  kyc_doc_type: string | null;
  id_number: string | null;
  id_number_last4: string | null;
  kyc_face_match_score: number | null;
  liveness_passed: boolean | null;
  liveness_frame_count: number | null;
  needs_manual_review: boolean;
  fee_paid: boolean;
  payout_provider: string | null;
  payout_phone: string | null;
  submitted_at: string | null;
  created_at: string | null;
  // Alias dokiman (UI admin/workspace)
  kyc_front: string | null;
  kyc_back: string | null;
  kyc_selfie: string | null;
  business_registration: string | null;
  business_nif_doc: string | null;
  tax_clearance: string | null;
  establishment_photo: string | null;
  proof_of_address: string | null;
  articles: string | null;
};

export function mapKycAppForStaff(
  app: Record<string, unknown>,
  profileFallback?: { full_name?: string | null; email?: string | null } | null
): StaffKycView {
  const idEnc = typeof app.id_number_enc === 'string' ? app.id_number_enc : null;
  let idNumber: string | null = null;
  try {
    idNumber = decryptKycIdNumber(idEnc);
  } catch {
    idNumber = null;
  }
  if (!idNumber && app.id_number_last4) {
    idNumber = `••••${app.id_number_last4}`;
  }

  return {
    id: String(app.user_id || ''),
    application_id: String(app.id || ''),
    user_id: String(app.user_id || ''),
    full_name: String(app.full_name || profileFallback?.full_name || 'San Non'),
    email: String(app.email || profileFallback?.email || ''),
    account_type: (app.account_type as string) || null,
    status: (app.status as string) || null,
    date_of_birth: (app.date_of_birth as string) || null,
    address_street: (app.address_street as string) || null,
    address_city: (app.address_city as string) || null,
    address_department: (app.address_department as string) || null,
    phone_primary: (app.phone_primary as string) || null,
    activity_category: (app.activity_category as string) || null,
    monthly_volume_estimate:
      app.monthly_volume_estimate != null ? Number(app.monthly_volume_estimate) : null,
    business_name: (app.business_name as string) || null,
    business_url: (app.business_url as string) || null,
    service_description: (app.service_description as string) || null,
    business_nif: (app.business_nif as string) || null,
    business_rccm: (app.business_rccm as string) || null,
    party1_whatsapp: (app.party1_whatsapp as string) || null,
    party1_moncash: (app.party1_moncash as string) || null,
    party2_full_name: (app.party2_full_name as string) || null,
    party2_role: (app.party2_role as string) || null,
    party2_whatsapp: (app.party2_whatsapp as string) || null,
    party2_moncash: (app.party2_moncash as string) || null,
    kyc_doc_type: (app.id_document_type as string) || null,
    id_number: idNumber,
    id_number_last4: (app.id_number_last4 as string) || null,
    kyc_face_match_score:
      app.face_match_score != null ? Number(app.face_match_score) : null,
    liveness_passed: app.liveness_passed === true,
    liveness_frame_count:
      app.liveness_frame_count != null ? Number(app.liveness_frame_count) : null,
    needs_manual_review: app.needs_manual_review === true,
    fee_paid: app.fee_paid === true,
    payout_provider: (app.payout_provider as string) || null,
    payout_phone: (app.payout_phone as string) || null,
    submitted_at: (app.submitted_at as string) || null,
    created_at: (app.created_at as string) || null,
    kyc_front: (app.id_front_path as string) || null,
    kyc_back: (app.id_back_path as string) || null,
    kyc_selfie: (app.selfie_path as string) || null,
    business_registration: (app.business_registration_path as string) || null,
    business_nif_doc: (app.business_nif_doc_path as string) || null,
    tax_clearance: (app.tax_clearance_path as string) || null,
    establishment_photo: (app.establishment_photo_path as string) || null,
    proof_of_address: (app.proof_of_address_path as string) || null,
    articles: (app.articles_path as string) || null,
  };
}

/** Sync enfo KYC nan profiles pou dosye/legacy UI (chemin dokiman + idantite). */
export function profileSyncFromKycApp(app: {
  full_name?: string | null;
  phone_primary?: string | null;
  account_type?: string | null;
  business_name?: string | null;
  id_document_type?: string | null;
  id_number_hash?: string | null;
  id_front_path?: string | null;
  id_back_path?: string | null;
  selfie_path?: string | null;
  face_match_score?: number | null;
  submitted_at?: string | null;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    kyc_status: 'pending',
    kyc_fee_paid: true,
    kyc_submitted_at: app.submitted_at || new Date().toISOString(),
  };
  if (app.full_name) patch.full_name = app.full_name;
  if (app.phone_primary) patch.phone = app.phone_primary;
  if (app.account_type === 'business') {
    patch.account_type = 'enterprise';
    if (app.business_name) patch.business_name = app.business_name;
  }
  if (app.id_document_type) patch.kyc_doc_type = app.id_document_type;
  if (app.id_number_hash) patch.kyc_id_number_hash = app.id_number_hash;
  if (app.id_front_path) patch.kyc_front = app.id_front_path;
  if (app.id_back_path) patch.kyc_back = app.id_back_path;
  if (app.selfie_path) patch.kyc_selfie = app.selfie_path;
  if (app.face_match_score != null) patch.kyc_face_match_score = app.face_match_score;
  return patch;
}
