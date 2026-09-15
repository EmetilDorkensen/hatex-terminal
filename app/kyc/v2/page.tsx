'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  ShieldCheck,
  Smartphone,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import LivenessCapture from '@/components/kyc-v2/LivenessCapture';
import { toKycJpeg } from '@/lib/kyc-v2/to-jpeg';

/**
 * Flow KYC v2:
 *   1. Tip kont  2. Enfòmasyon  3. Dokiman  4. Figi  5. Soumèt (san frè)
 *
 * Frè KYC retire — abonnman ranplase l.
 */

type AccountType = 'individual' | 'business';

type Application = {
  id: string;
  account_type: AccountType;
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected';
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
  id_document_type: string | null;
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
  liveness_passed: boolean | null;
  id_number_last4: string | null;
};

type Readiness = {
  ready: boolean;
  missingFields: Record<string, string>;
  missingDocuments: string[];
  livenessDone: boolean;
  feePaid: boolean;
  feeAmount: number;
  required_documents: string[];
};

type Options = {
  departments: string[];
  activity_categories: string[];
  id_document_types: { value: string; label: string }[];
  party2_roles: string[];
  fees: { individual: number; business: number };
};

const DOC_LABELS: Record<string, string> = {
  id_front: 'Devan pyès idantite',
  id_back: 'Dèyè pyès idantite',
  selfie: 'Foto figi',
  business_registration: 'Patant / RCCM (anrejistreman biznis)',
  business_nif_doc: 'NIF biznis (dokiman)',
  tax_clearance: 'Kitan fiskal (quittance DGI)',
  establishment_photo: 'Foto lokal / etablisman biznis',
  proof_of_address: 'Prèv adrès biznis',
  articles: 'Statu / akò asosyasyon',
};

const DOC_PATH: Record<string, keyof Application> = {
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

const STEPS = ['Tip kont', 'Enfòmasyon', 'Dokiman', 'Figi', 'Soumèt'];

export default function KycV2Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [step, setStep] = useState(1);
  const [application, setApplication] = useState<Application | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    account_type: '' as AccountType | '',
    full_name: '',
    date_of_birth: '',
    address_street: '',
    address_city: '',
    address_department: '',
    phone_primary: '',
    activity_category: '',
    monthly_volume_estimate: '',
    business_name: '',
    business_url: '',
    service_description: '',
    business_nif: '',
    business_rccm: '',
    party1_whatsapp: '',
    party1_moncash: '',
    party2_full_name: '',
    party2_role: '',
    party2_whatsapp: '',
    party2_moncash: '',
    id_document_type: '',
    id_number: '',
    payout_provider: 'moncash' as 'moncash' | 'natcash',
    payout_phone: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/kyc/v2/application');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const data = await res.json();

      setOptions(data.options || null);
      setApplication(data.application || null);
      setReadiness(data.readiness || null);

      if (data.application) {
        const a = data.application as Application;
        setForm((prev) => ({
          ...prev,
          account_type: a.account_type,
          full_name: a.full_name || '',
          date_of_birth: a.date_of_birth || '',
          address_street: a.address_street || '',
          address_city: a.address_city || '',
          address_department: a.address_department || '',
          phone_primary: a.phone_primary || '',
          activity_category: a.activity_category || '',
          monthly_volume_estimate:
            a.monthly_volume_estimate != null ? String(a.monthly_volume_estimate) : '',
          business_name: a.business_name || '',
          business_url: a.business_url || '',
          service_description: a.service_description || '',
          business_nif: a.business_nif || '',
          business_rccm: a.business_rccm || '',
          party1_whatsapp: a.party1_whatsapp || '',
          party1_moncash: a.party1_moncash || '',
          party2_full_name: a.party2_full_name || '',
          party2_role: a.party2_role || '',
          party2_whatsapp: a.party2_whatsapp || '',
          party2_moncash: a.party2_moncash || '',
          id_document_type: a.id_document_type || '',
          // Nimewo an klè pa janm retounen — nou montre 4 dènye chif yo
          id_number: a.id_number_last4 ? `••••${a.id_number_last4}` : '',
          payout_provider: a.payout_provider || 'moncash',
          payout_phone: a.payout_phone || '',
        }));

        if (a.status === 'draft') {
          const r = data.readiness as Readiness | null;
          if (r?.ready) setStep(5);
          else if (r?.livenessDone === false && r.missingDocuments.length === 0) setStep(4);
          else if (Object.keys(r?.missingFields || {}).length === 0) setStep(3);
          else setStep(2);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = useCallback(
    async (patch: Record<string, unknown>): Promise<boolean> => {
      setSaving(true);
      setFieldErrors({});
      setNotice(null);
      try {
        const res = await fetch('/api/kyc/v2/application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          setFieldErrors(data?.errors || {});
          setNotice(data?.error?.message || 'Pa t kapab sove.');
          return false;
        }

        setApplication(data.application);
        setReadiness(data.readiness);
        return true;
      } catch {
        setNotice('Pwoblèm rezo. Eseye ankò.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  const chooseAccountType = async (type: AccountType) => {
    setForm((f) => ({ ...f, account_type: type }));
    if (await saveDraft({ account_type: type })) setStep(2);
  };

  const submitInfo = async () => {
    const payload: Record<string, unknown> = {
      account_type: form.account_type,
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      address_street: form.address_street,
      address_city: form.address_city,
      address_department: form.address_department,
      phone_primary: form.phone_primary,
      activity_category: form.activity_category,
      monthly_volume_estimate: form.monthly_volume_estimate,
      business_name: form.business_name,
      business_url: form.business_url,
      service_description: form.service_description,
      business_nif: form.business_nif,
      business_rccm: form.business_rccm,
      party1_whatsapp: form.party1_whatsapp,
      party1_moncash: form.party1_moncash,
      party2_full_name: form.party2_full_name,
      party2_role: form.party2_role,
      party2_whatsapp: form.party2_whatsapp,
      party2_moncash: form.party2_moncash,
      id_document_type: form.id_document_type,
      payout_provider: form.payout_provider,
      payout_phone: form.payout_phone,
    };
    // Pa reekri hash la ak vèsyon maske a
    if (form.id_number && !form.id_number.startsWith('••••')) {
      payload.id_number = form.id_number;
    }

    if (await saveDraft(payload)) setStep(3);
  };

  const submitKyc = async () => {
    setPaying(true);
    setNotice(null);
    try {
      const res = await fetch('/api/kyc/v2/submit', { method: 'POST' });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setNotice(data?.error?.message || 'Pa t kapab soumèt dosye a.');
        setPaying(false);
        return;
      }

      await load();
    } catch {
      setNotice('Pwoblèm rezo. Eseye ankò.');
      setPaying(false);
    }
  };

  const requiredDocs = useMemo(
    () => readiness?.required_documents?.filter((d) => d !== 'selfie') || [],
    [readiness]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  // ── Eta apre soumisyon ───────────────────────────────────────
  if (application && application.status !== 'draft') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <Loader2 size={28} className="animate-spin text-indigo-600" />
          </div>
        }
      >
        <StatusView application={application} onRestart={load} />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">Verifikasyon idantite</h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Etap {step} sou {STEPS.length} — {STEPS[step - 1]}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {notice && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium leading-relaxed">{notice}</p>
          </div>
        )}

        {step > 1 && step <= STEPS.length && (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="mb-5 text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 uppercase tracking-wider"
          >
            <ArrowLeft size={14} /> Retounen
          </button>
        )}

        {/* ── Etap 1: tip kont ── */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
              Chwazi ki kalite kont ou vle louvri. Sa detèmine ki dokiman nou mande ak ki
              limit ou genyen.
            </p>

            <AccountTypeCard
              icon={<User size={20} />}
              title="Kont endividyèl"
              description="Pou yon moun k ap resevwa peman nan pwòp non li"
              onClick={() => chooseAccountType('individual')}
              disabled={saving}
            />
            <AccountTypeCard
              icon={<Building2 size={20} />}
              title="Kont biznis"
              description="Pou yon konpayi — tout papye legal MonCash mande (patant, NIF, kitan fiskal, statu, foto lokal)"
              onClick={() => chooseAccountType('business')}
              disabled={saving}
            />
          </div>
        )}

        {/* ── Etap 2: enfòmasyon ── */}
        {step === 2 && options && (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-5">
            <Field label="Non konplè" error={fieldErrors.full_name}>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jan li ekri sou dokiman an"
                className={inputClass(fieldErrors.full_name)}
              />
            </Field>

            <Field label="Dat nesans" error={fieldErrors.date_of_birth}>
              <input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                className={inputClass(fieldErrors.date_of_birth)}
              />
            </Field>

            <Field label="Adrès" error={fieldErrors.address_street}>
              <input
                type="text"
                value={form.address_street}
                onChange={(e) => setForm({ ...form, address_street: e.target.value })}
                placeholder="Ri, nimewo kay"
                className={inputClass(fieldErrors.address_street)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Vil" error={fieldErrors.address_city}>
                <input
                  type="text"
                  value={form.address_city}
                  onChange={(e) => setForm({ ...form, address_city: e.target.value })}
                  className={inputClass(fieldErrors.address_city)}
                />
              </Field>
              <Field label="Depatman" error={fieldErrors.address_department}>
                <select
                  value={form.address_department}
                  onChange={(e) => setForm({ ...form, address_department: e.target.value })}
                  className={inputClass(fieldErrors.address_department)}
                >
                  <option value="">Chwazi</option>
                  {options.departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Telefòn" error={fieldErrors.phone_primary}>
              <input
                type="tel"
                value={form.phone_primary}
                onChange={(e) => setForm({ ...form, phone_primary: e.target.value })}
                placeholder="3720 1241"
                className={inputClass(fieldErrors.phone_primary)}
              />
            </Field>

            <Field label="Kalite aktivite" error={fieldErrors.activity_category}>
              <select
                value={form.activity_category}
                onChange={(e) => setForm({ ...form, activity_category: e.target.value })}
                className={inputClass(fieldErrors.activity_category)}
              >
                <option value="">Chwazi</option>
                {options.activity_categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Estimasyon volim pa mwa (HTG)"
              error={fieldErrors.monthly_volume_estimate}
              optional
            >
              <input
                type="number"
                min={0}
                value={form.monthly_volume_estimate}
                onChange={(e) =>
                  setForm({ ...form, monthly_volume_estimate: e.target.value })
                }
                placeholder="50000"
                className={inputClass(fieldErrors.monthly_volume_estimate)}
              />
            </Field>

            {form.account_type === 'business' && (
              <>
                <Field label="Non biznis" error={fieldErrors.business_name}>
                  <input
                    type="text"
                    value={form.business_name}
                    onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    className={inputClass(fieldErrors.business_name)}
                  />
                </Field>
                <Field label="Sit entènèt" error={fieldErrors.business_url} optional>
                  <input
                    type="url"
                    value={form.business_url}
                    onChange={(e) => setForm({ ...form, business_url: e.target.value })}
                    placeholder="https://..."
                    className={inputClass(fieldErrors.business_url)}
                  />
                </Field>
                <Field
                  label="Ki kalite sèvis w ap bay"
                  error={fieldErrors.service_description}
                >
                  <textarea
                    value={form.service_description}
                    onChange={(e) => setForm({ ...form, service_description: e.target.value })}
                    placeholder="Egzanp: vann abònman dijital, resevwa peman pou restoran, livrezon..."
                    rows={3}
                    className={inputClass(fieldErrors.service_description)}
                  />
                </Field>
                <Field label="NIF biznis" error={fieldErrors.business_nif}>
                  <input
                    type="text"
                    value={form.business_nif}
                    onChange={(e) => setForm({ ...form, business_nif: e.target.value })}
                    className={inputClass(fieldErrors.business_nif)}
                  />
                </Field>
                <Field label="Nimewo RCCM / Patant" error={fieldErrors.business_rccm}>
                  <input
                    type="text"
                    value={form.business_rccm}
                    onChange={(e) => setForm({ ...form, business_rccm: e.target.value })}
                    className={inputClass(fieldErrors.business_rccm)}
                  />
                </Field>

                <div className="border-t border-gray-100 pt-5 space-y-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Pati 1 — reprezantan legal
                  </p>
                  <Field label="WhatsApp reprezantan" error={fieldErrors.party1_whatsapp}>
                    <input
                      type="tel"
                      value={form.party1_whatsapp}
                      onChange={(e) => setForm({ ...form, party1_whatsapp: e.target.value })}
                      placeholder="3720 1241"
                      className={inputClass(fieldErrors.party1_whatsapp)}
                    />
                  </Field>
                  <Field label="MonCash reprezantan" error={fieldErrors.party1_moncash}>
                    <input
                      type="tel"
                      value={form.party1_moncash}
                      onChange={(e) => setForm({ ...form, party1_moncash: e.target.value })}
                      placeholder="3720 1241"
                      className={inputClass(fieldErrors.party1_moncash)}
                    />
                  </Field>
                </div>

                <div className="border-t border-gray-100 pt-5 space-y-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Pati 2 — dezyèm moun otorize
                  </p>
                  <Field label="Non konplè" error={fieldErrors.party2_full_name}>
                    <input
                      type="text"
                      value={form.party2_full_name}
                      onChange={(e) => setForm({ ...form, party2_full_name: e.target.value })}
                      className={inputClass(fieldErrors.party2_full_name)}
                    />
                  </Field>
                  <Field label="Wòl" error={fieldErrors.party2_role}>
                    <select
                      value={form.party2_role}
                      onChange={(e) => setForm({ ...form, party2_role: e.target.value })}
                      className={inputClass(fieldErrors.party2_role)}
                    >
                      <option value="">Chwazi</option>
                      {(options.party2_roles || []).map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="WhatsApp" error={fieldErrors.party2_whatsapp}>
                    <input
                      type="tel"
                      value={form.party2_whatsapp}
                      onChange={(e) => setForm({ ...form, party2_whatsapp: e.target.value })}
                      placeholder="3720 1241"
                      className={inputClass(fieldErrors.party2_whatsapp)}
                    />
                  </Field>
                  <Field label="MonCash" error={fieldErrors.party2_moncash}>
                    <input
                      type="tel"
                      value={form.party2_moncash}
                      onChange={(e) => setForm({ ...form, party2_moncash: e.target.value })}
                      placeholder="3720 1241"
                      className={inputClass(fieldErrors.party2_moncash)}
                    />
                  </Field>
                </div>
              </>
            )}

            <div className="border-t border-gray-100 pt-5 space-y-5">
              <Field label="Pyès idantite" error={fieldErrors.id_document_type}>
                <select
                  value={form.id_document_type}
                  onChange={(e) => setForm({ ...form, id_document_type: e.target.value })}
                  className={inputClass(fieldErrors.id_document_type)}
                >
                  <option value="">Chwazi</option>
                  {options.id_document_types.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Nimewo pyès idantite" error={fieldErrors.id_number}>
                <input
                  type="text"
                  value={form.id_number}
                  onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                  onFocus={() => {
                    if (form.id_number.startsWith('••••')) setForm({ ...form, id_number: '' });
                  }}
                  className={inputClass(fieldErrors.id_number)}
                />
              </Field>
            </div>

            <div className="border-t border-gray-100 pt-5 space-y-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Kote ou vle resevwa lajan ou (MonCash sèlman pou kounye a)
              </p>

              <Field label="Sèvis payout" error={fieldErrors.payout_provider}>
                <input
                  type="text"
                  value="MonCash"
                  readOnly
                  className={inputClass(fieldErrors.payout_provider)}
                />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Pou kounye a, sèl nimewo MonCash ki aksepte pou resevwa lajan sou sistèm nan.
                </p>
              </Field>

              <Field label="Nimewo MonCash (payout)" error={fieldErrors.payout_phone}>
                <input
                  type="tel"
                  value={form.payout_phone}
                  onChange={(e) => setForm({ ...form, payout_phone: e.target.value })}
                  placeholder="3720 1241"
                  className={inputClass(fieldErrors.payout_phone)}
                />
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Nimewo sa a ap vin premye nimewo payout ou — ou ka siprime l pita si w vle.
                </p>
              </Field>
            </div>

            <button
              type="button"
              onClick={submitInfo}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Kontinye
            </button>
          </div>
        )}

        {/* ── Etap 3: dokiman ── */}
        {step === 3 && application && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {form.account_type === 'business'
                ? 'Voye tout papye legal biznis la — se menm dokiman MonCash mande pou yon kont biznis.'
                : 'Pran foto dokiman yo klè — tout kwen yo dwe parèt, san reflè.'}
            </p>

            {requiredDocs.map((slot) => (
              <DocumentUpload
                key={slot}
                slot={slot}
                label={DOC_LABELS[slot] || slot}
                uploaded={Boolean(application[DOC_PATH[slot]])}
                onUploaded={load}
              />
            ))}

            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={(readiness?.missingDocuments || []).some((d) => d !== 'selfie')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm disabled:opacity-40"
            >
              Kontinye
            </button>
          </div>
        )}

        {/* ── Etap 4: figi ── */}
        {step === 4 && (
          <div className="space-y-4">
            <LivenessCapture
              alreadyVerified={readiness?.livenessDone === true}
              onVerified={async () => {
                await load();
                setStep(5);
              }}
            />
            {readiness?.livenessDone && (
              <button
                type="button"
                onClick={() => setStep(5)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm"
              >
                Kontinye
              </button>
            )}
          </div>
        )}

        {/* ── Etap 5: soumèt (san frè) ── */}
        {step === 5 && readiness && (
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-5 border border-indigo-100 mx-auto">
              <ShieldCheck size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">
              Soumèt dosye a
            </h2>
            <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">
              Pa gen frè KYC. Apre ou soumèt, ou peye abonnman Kapasite oswa Premyòm sou
              MonCash pou ogmante kapasite kont ou.
            </p>

            {!readiness.ready && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-xs text-amber-800 font-medium leading-relaxed">
                Dosye a poko konplè.
                {readiness.missingDocuments.length > 0 && (
                  <> Dokiman ki manke: {readiness.missingDocuments.map((d) => DOC_LABELS[d] || d).join(', ')}.</>
                )}
                {!readiness.livenessDone && <> Verifikasyon figi a poko fèt.</>}
              </div>
            )}

            <button
              type="button"
              onClick={submitKyc}
              disabled={paying || !readiness.ready}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-40"
            >
              {paying ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Ap soumèt...
                </>
              ) : (
                <>
                  Soumèt pou revizyon
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Ti konpozan
// ============================================================

function inputClass(error?: string): string {
  return `w-full border rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 transition-all ${
    error
      ? 'border-red-300 focus:ring-red-200'
      : 'border-gray-200 focus:ring-indigo-200 focus:border-indigo-400'
  }`;
}

type FieldProps = Readonly<{
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}>;

function Field({ label, error, optional, children }: FieldProps) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">
        {label}
        {optional && <span className="text-slate-400 normal-case"> (opsyonèl)</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-600 font-medium mt-1.5">{error}</p>}
    </div>
  );
}

type AccountTypeCardProps = Readonly<{
  icon: React.ReactNode;
  title: string;
  description: string;
  fee?: number;
  onClick: () => void;
  disabled?: boolean;
}>;

function AccountTypeCard({
  icon,
  title,
  description,
  fee,
  onClick,
  disabled,
}: AccountTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-white p-5 rounded-2xl border border-gray-200 text-left transition-all hover:border-indigo-300 hover:shadow-sm group disabled:opacity-50"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-bold text-sm text-slate-900 mb-0.5">{title}</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">{description}</p>
          {fee != null && (
            <p className="text-[11px] font-bold text-indigo-600 mt-2">
              Frè: {fee.toLocaleString('fr-FR')} HTG
            </p>
          )}
        </div>
        <ChevronRight
          size={18}
          className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0 mt-3"
        />
      </div>
    </button>
  );
}

type DocumentUploadProps = Readonly<{
  slot: string;
  label: string;
  uploaded: boolean;
  onUploaded: () => Promise<void> | void;
}>;

function DocumentUpload({ slot, label, uploaded, onUploaded }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      let payload = file;
      if (!isPdf) {
        try {
          payload = await toKycJpeg(file, 1400, 0.88);
        } catch {
          setError('Pa t kapab li foto a. Pran l ak kamera a, pa galri a.');
          return;
        }
      }

      const form = new FormData();
      form.append('slot', slot);
      form.append('file', payload);

      const res = await fetch('/api/kyc/v2/documents', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error?.message || 'Pa t kapab voye fichye a.');
        return;
      }
      await onUploaded();
    } catch {
      setError('Pwoblèm rezo. Eseye ankò.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`bg-white border rounded-2xl p-5 transition-colors ${
        uploaded ? 'border-emerald-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${
            uploaded
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
              : 'bg-slate-50 text-slate-400 border-gray-100'
          }`}
        >
          {uploaded ? <CheckCircle2 size={20} /> : <FileText size={20} />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-slate-900">{label}</p>
          <p className="text-[11px] text-slate-500">
            {uploaded ? 'Voye monte' : 'JPG, PNG oswa PDF — maks 10 Mo'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          {uploaded ? 'Chanje' : 'Voye'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-600 font-medium mt-3">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture={slot === 'id_front' || slot === 'id_back' ? 'environment' : undefined}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function planPayAmount(
  intended: string | null,
  prices?: { capacity?: number; premium?: number }
): number | null {
  if (intended === 'premium') return prices?.premium ?? 999;
  if (intended === 'capacity') return prices?.capacity ?? 599;
  return null;
}

type StatusViewProps = Readonly<{
  application: Application;
  onRestart: () => void;
}>;

function StatusView({ application, onRestart }: StatusViewProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [paying, setPaying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [billing, setBilling] = useState<{
    intended: string | null;
    effective: string;
    plan_status: string;
    amount: number | null;
  } | null>(null);

  const payStatus = search.get('status');

  const loadBilling = useCallback(async () => {
    const res = await fetch('/api/billing/plan');
    if (!res.ok) return;
    const data = await res.json();
    const intended = data?.profile?.intended_plan || null;
    const effective = data?.profile?.effective_plan || 'free';
    setBilling({
      intended,
      effective,
      plan_status: data?.profile?.plan_status || 'none',
      amount: planPayAmount(intended, data?.prices),
    });
    return { intended, effective };
  }, []);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    if (payStatus !== 'success' && payStatus !== '1' && search.get('paid') !== '1') return;
    let cancelled = false;
    setConfirming(true);
    const run = async () => {
      await fetch('/api/billing/confirm', { method: 'POST' });
      for (let i = 0; i < 6; i++) {
        const state = await loadBilling();
        if (cancelled) return;
        if (state && state.effective !== 'free') {
          setConfirming(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setConfirming(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [payStatus, search, loadBilling]);

  const config = {
    submitted: {
      icon: <Clock size={28} />,
      tone: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      title: 'Dosye ou soumèt',
      body: 'Ekip nou an ap revize dokiman ou yo. Ou ka peye abonnman an kounye a pou ogmante kapasite kont ou.',
    },
    in_review: {
      icon: <Clock size={28} />,
      tone: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      title: 'Revizyon an kou',
      body: 'Yon manm ekip la ap gade dosye ou kounye a.',
    },
    approved: {
      icon: <CheckCircle2 size={28} />,
      tone: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      title: 'Kont ou apwouve',
      body: 'Ou ka kòmanse aksepte peman kounye a.',
    },
    rejected: {
      icon: <XCircle size={28} />,
      tone: 'bg-red-50 text-red-600 border-red-100',
      title: 'Dosye a refize',
      body: application.rejection_reason || 'Kontakte sipò pou plis detay.',
    },
  }[application.status as 'submitted' | 'in_review' | 'approved' | 'rejected'];

  const needsPay =
    application.status !== 'rejected' &&
    billing &&
    (billing.intended === 'capacity' || billing.intended === 'premium') &&
    billing.effective === 'free';

  const payPlan = async () => {
    if (!billing?.intended) return;
    setPaying(true);
    setPayError(null);
    try {
      const pay = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing.intended, return_to: 'kyc' }),
      });
      const payData = await pay.json();
      if (!pay.ok || !payData.checkout_url) {
        setPayError(
          payData?.error?.message ||
            'Pa t kapab ouvri MonCash. Rechaje kont MonCash ou epi eseye ankò.'
        );
        return;
      }
      window.location.href = payData.checkout_url;
    } catch {
      setPayError('Pwoblèm rezo. Eseye ankò.');
    } finally {
      setPaying(false);
    }
  };

  const paidOk = billing && billing.effective !== 'free';
  const payFailed = payStatus === 'failed';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm text-center">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 border mx-auto ${config.tone}`}
          >
            {config.icon}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">{config.title}</h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">{config.body}</p>

          {paidOk && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5 text-left">
              <p className="text-sm font-bold text-emerald-800">Kapasite ou ogmante</p>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                {billing?.effective === 'premium'
                  ? 'Plan Premyòm aktif — san limit jou si kont MonCash ou ka sipòte.'
                  : 'Plan Kapasite aktif — 150 000 HTG pa jou sou tout chanèl.'}
              </p>
            </div>
          )}

          {confirming && (
            <p className="text-xs text-indigo-600 font-medium mb-4 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> N ap konfime peman MonCash la…
            </p>
          )}

          {payFailed && !paidOk && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-5 text-left">
              <p className="text-sm font-bold text-rose-800">Peman an pa t pase</p>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                Rechaje kont MonCash ou pou ou ka finalize peman abonnman an, epi klike
                bouton MonCash la ankò.
              </p>
            </div>
          )}

          {payError && (
            <p className="text-xs text-rose-600 font-medium mb-4">{payError}</p>
          )}

          {needsPay && (
            <button
              type="button"
              onClick={() => void payPlan()}
              disabled={paying || confirming}
              className="w-full bg-[#E21C23] hover:bg-[#c4181e] text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
            >
              {paying ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Smartphone size={16} />
              )}
              Peye {billing.amount?.toLocaleString('fr-FR')} HTG ak MonCash
            </button>
          )}

          {!needsPay && !paidOk && application.status !== 'rejected' && (
            <button
              type="button"
              onClick={() => router.push('/plan')}
              className="w-full bg-[#E21C23] hover:bg-[#c4181e] text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 mb-3"
            >
              <Smartphone size={16} /> Peye abonnman ak MonCash
            </button>
          )}

          {application.status === 'rejected' ? (
            <button
              type="button"
              onClick={onRestart}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs"
            >
              Kòmanse yon nouvo dosye
            </button>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full bg-white border border-gray-200 text-slate-700 py-4 rounded-xl font-bold uppercase tracking-wider text-xs"
            >
              Ale nan Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
