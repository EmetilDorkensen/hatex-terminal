"use client";

import React from 'react';
import { EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export type StaffKycCardData = {
  id: string;
  application_id?: string;
  full_name?: string | null;
  email?: string | null;
  account_type?: string | null;
  kyc_doc_type?: string | null;
  id_number?: string | null;
  id_number_last4?: string | null;
  date_of_birth?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_department?: string | null;
  phone_primary?: string | null;
  activity_category?: string | null;
  monthly_volume_estimate?: number | null;
  business_name?: string | null;
  business_url?: string | null;
  service_description?: string | null;
  business_nif?: string | null;
  business_rccm?: string | null;
  party1_whatsapp?: string | null;
  party1_moncash?: string | null;
  party2_full_name?: string | null;
  party2_role?: string | null;
  party2_whatsapp?: string | null;
  party2_moncash?: string | null;
  payout_provider?: string | null;
  payout_phone?: string | null;
  kyc_face_match_score?: number | null;
  liveness_passed?: boolean | null;
  needs_manual_review?: boolean;
  kyc_front?: string | null;
  kyc_back?: string | null;
  kyc_selfie?: string | null;
  business_registration?: string | null;
  business_nif_doc?: string | null;
  tax_clearance?: string | null;
  establishment_photo?: string | null;
  proof_of_address?: string | null;
  articles?: string | null;
  submitted_at?: string | null;
};

type DocKey =
  | 'front'
  | 'back'
  | 'selfie'
  | 'business'
  | 'nif'
  | 'tax'
  | 'establishment'
  | 'address'
  | 'articles';

type Props = {
  user: StaffKycCardData;
  processingId?: string | null;
  onOpenDoc: (userId: string, doc: DocKey, path: string | null | undefined) => void;
  onApprove: () => void;
  onReject: () => void;
};

function Info({ label, value }: Readonly<{ label: string; value: string | number | null | undefined }>) {
  if (value == null || value === '') return null;
  return (
    <div className="bg-slate-50 border border-gray-100 rounded-lg px-3 py-2">
      <p className="text-[9px] font-bold uppercase text-slate-400">{label}</p>
      <p className="text-[11px] font-bold text-slate-800 mt-0.5 break-words">{String(value)}</p>
    </div>
  );
}

function DocBtn({
  label,
  path,
  onClick,
}: Readonly<{ label: string; path: string | null | undefined; onClick: () => void }>) {
  if (!path) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] bg-slate-50 px-3 py-2 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"
    >
      <EyeOff size={14} /> {label}
    </button>
  );
}

/**
 * Kat revizyon KYC — tout enfo + tout pyès (endividyèl ak antrepriz).
 * Pataje ant Admin ak Workspace (asistans).
 */
export default function KycReviewCard({
  user,
  processingId,
  onOpenDoc,
  onApprove,
  onReject,
}: Props) {
  const uid = user.id;
  const busy = processingId === uid;
  const address = [user.address_street, user.address_city, user.address_department]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-5">
      <div className="flex flex-col md:flex-row gap-4 md:items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{user.full_name || 'San Non'}</h3>
          <p className="text-xs text-slate-500 mt-1">{user.email}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {user.account_type && (
              <span className="text-[10px] bg-slate-50 text-slate-700 px-2 py-1 rounded border border-gray-200 font-bold uppercase">
                {user.account_type === 'business' ? 'Antrepriz' : 'Endividyèl'}
              </span>
            )}
            {user.kyc_doc_type && (
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 font-bold uppercase">
                {user.kyc_doc_type}
              </span>
            )}
            {user.kyc_face_match_score != null && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 font-bold">
                Figi: {Number(user.kyc_face_match_score).toFixed(1)}%
              </span>
            )}
            {user.liveness_passed && (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 font-bold uppercase">
                Liveness OK
              </span>
            )}
            {user.needs_manual_review && (
              <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200 font-bold uppercase">
                Revizyon imen
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Apwouve</>}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            className="bg-white border border-rose-200 text-rose-600 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <XCircle size={16} /> Rejte
          </button>
        </div>
      </div>

      {/* Tout enfo idantite */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        <Info label="Nimewo ID" value={user.id_number} />
        <Info label="Dat nesans" value={user.date_of_birth} />
        <Info label="Telefòn" value={user.phone_primary} />
        <Info label="Adrès" value={address || null} />
        <Info label="Aktivite" value={user.activity_category} />
        <Info
          label="Volim/mwa (HTG)"
          value={user.monthly_volume_estimate != null ? user.monthly_volume_estimate : null}
        />
        <Info label="Payout" value={user.payout_provider} />
        <Info label="Tel MonCash" value={user.payout_phone} />
        <Info
          label="Soumèt"
          value={user.submitted_at ? new Date(user.submitted_at).toLocaleString('fr-HT') : null}
        />
      </div>

      {user.account_type === 'business' && (
        <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#1d4ed8]">Enfo antrepriz</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Info label="Non biznis" value={user.business_name} />
            <Info label="Sitwèb" value={user.business_url} />
            <Info label="NIF" value={user.business_nif} />
            <Info label="RCCM" value={user.business_rccm} />
            <Info label="Sèvis" value={user.service_description} />
            <Info label="Pati 1 WhatsApp" value={user.party1_whatsapp} />
            <Info label="Pati 1 MonCash" value={user.party1_moncash} />
            <Info label="Pati 2 non" value={user.party2_full_name} />
            <Info label="Pati 2 wòl" value={user.party2_role} />
            <Info label="Pati 2 WhatsApp" value={user.party2_whatsapp} />
            <Info label="Pati 2 MonCash" value={user.party2_moncash} />
          </div>
        </div>
      )}

      {/* Tout pyès */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Pyès dokiman</p>
        <div className="flex flex-wrap gap-2">
          <DocBtn label="ID Devan" path={user.kyc_front} onClick={() => onOpenDoc(uid, 'front', user.kyc_front)} />
          <DocBtn label="ID Dèyè" path={user.kyc_back} onClick={() => onOpenDoc(uid, 'back', user.kyc_back)} />
          <DocBtn label="Selfie" path={user.kyc_selfie} onClick={() => onOpenDoc(uid, 'selfie', user.kyc_selfie)} />
          <DocBtn
            label="Patant/RCCM"
            path={user.business_registration}
            onClick={() => onOpenDoc(uid, 'business', user.business_registration)}
          />
          <DocBtn
            label="NIF dok"
            path={user.business_nif_doc}
            onClick={() => onOpenDoc(uid, 'nif', user.business_nif_doc)}
          />
          <DocBtn
            label="Kitan"
            path={user.tax_clearance}
            onClick={() => onOpenDoc(uid, 'tax', user.tax_clearance)}
          />
          <DocBtn
            label="Lokal"
            path={user.establishment_photo}
            onClick={() => onOpenDoc(uid, 'establishment', user.establishment_photo)}
          />
          <DocBtn
            label="Prèv adrès"
            path={user.proof_of_address}
            onClick={() => onOpenDoc(uid, 'address', user.proof_of_address)}
          />
          <DocBtn
            label="Statu"
            path={user.articles}
            onClick={() => onOpenDoc(uid, 'articles', user.articles)}
          />
          {!user.kyc_front && !user.kyc_selfie && (
            <span className="text-[10px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 font-bold uppercase">
              Okenn imaj
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
