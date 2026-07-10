'use client';

import React, { useCallback, useState } from 'react';
import {
  Search, Loader2, User, Mail, ShieldCheck, Building2, Briefcase,
  EyeOff, FileText, CreditCard, ArrowLeft, Calendar, AlertCircle,
} from 'lucide-react';

type Match = {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
  account_type: string | null;
  enterprise_status: string | null;
  account_status: string | null;
  created_at: string;
};

type DossierProfile = Match & {
  business_name?: string | null;
  phone?: string | null;
  kyc_doc_type?: string | null;
  kyc_front?: string | null;
  kyc_back?: string | null;
  kyc_selfie?: string | null;
  kyc_submitted_at?: string | null;
  kyc_rejection_reason?: string | null;
  kyc_face_match_score?: number | null;
  kyc_fee_paid?: boolean | null;
  wallet_balance?: number | null;
  card_balance?: number | null;
  is_card_activated?: boolean | null;
  is_merchant?: boolean | null;
  agent_status?: string | null;
  agent_tier?: string | null;
  card_number?: string | null;
};

type EnterpriseApp = {
  id: string;
  status: string;
  business_name?: string | null;
  business_reg_number?: string | null;
  business_activity?: string | null;
  created_at: string;
  rejection_reason?: string | null;
  patente_url?: string | null;
  cif_url?: string | null;
  business_registration_url?: string | null;
  bank_statement_url?: string | null;
  lease_doc_url?: string | null;
  legal_rep_id_url?: string | null;
};

type AgentApp = {
  id: string;
  status: string;
  created_at: string;
  rejection_reason?: string | null;
  id_doc_url?: string | null;
  address_doc_url?: string | null;
  location_photo_url?: string | null;
  selfie_with_id_url?: string | null;
  patente_url?: string | null;
  cif_url?: string | null;
  criminal_record_url?: string | null;
  bank_statement_url?: string | null;
  lease_doc_url?: string | null;
};

type Dossier = {
  profile: DossierProfile;
  enterprise_applications: EnterpriseApp[];
  agent_applications: AgentApp[];
  recent_transactions: Array<{
    id: string;
    amount: number;
    type: string;
    description: string | null;
    status: string;
    created_at: string;
  }>;
};

function statusBadge(status: string | null | undefined, map: Record<string, string>) {
  const key = (status || 'none').toLowerCase();
  const cls = map[key] || 'bg-slate-100 text-slate-600';
  return (
    <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${cls}`}>
      {status || '—'}
    </span>
  );
}

function DocLink({ label, url, variant = 'default' }: { label: string; url?: string | null; variant?: 'default' | 'amber' }) {
  if (!url) return null;
  const base =
    variant === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
      : 'bg-slate-50 text-slate-700 border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200';
  return (
    <button
      type="button"
      onClick={() => window.open(url, '_blank')}
      className={`text-[10px] px-4 py-2.5 rounded-lg border transition-all font-bold tracking-wider uppercase flex items-center gap-1.5 ${base}`}
    >
      <EyeOff size={14} />
      {label}
    </button>
  );
}

function KycDocButton({
  userId,
  doc,
  label,
  stored,
}: {
  userId: string;
  doc: 'front' | 'back' | 'selfie';
  label: string;
  stored?: string | null;
}) {
  if (!stored) return null;

  const open = async () => {
    if (stored.startsWith('http://') || stored.startsWith('https://')) {
      window.open(stored, '_blank');
      return;
    }
    try {
      const res = await fetch(`/api/kyc/document?userId=${userId}&doc=${doc}`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Erè');
      window.open(data.url, '_blank');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Pa t kapab louvri dokiman an.';
      alert(msg);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"
    >
      <EyeOff size={14} />
      {label}
    </button>
  );
}

function enterpriseDocs(app: EnterpriseApp) {
  return (
    <div className="flex flex-wrap gap-2">
      <DocLink label="Patant" url={app.patente_url} />
      <DocLink label="CIF" url={app.cif_url} />
      <DocLink label="Anrejistreman" url={app.business_registration_url} />
      <DocLink label="Relve Bankè" url={app.bank_statement_url} />
      <DocLink label="Kontra Lokal" url={app.lease_doc_url} />
      <DocLink label="ID Reprezantan" url={app.legal_rep_id_url} variant="amber" />
    </div>
  );
}

function agentDocs(app: AgentApp) {
  return (
    <div className="flex flex-wrap gap-2">
      <DocLink label="Pyès Idantite" url={app.id_doc_url} />
      <DocLink label="Prèv Adrès" url={app.address_doc_url} />
      <DocLink label="Foto Lokal" url={app.location_photo_url} />
      <DocLink label="Selfie + ID" url={app.selfie_with_id_url} variant="amber" />
      <DocLink label="Patant" url={app.patente_url} />
      <DocLink label="CIF" url={app.cif_url} />
      <DocLink label="Kazye Jidisyè" url={app.criminal_record_url} />
      <DocLink label="Relve Bankè" url={app.bank_statement_url} />
      <DocLink label="Kontra Lokal" url={app.lease_doc_url} />
    </div>
  );
}

export default function AdminClientDossier({ initialUserId }: { initialUserId?: string | null }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const loadDossier = useCallback(async (userId: string) => {
    setLoadingDossier(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/client-dossier?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè');
      setDossier(data.dossier);
      setMatches([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erè chajman dosye a.');
      setDossier(null);
    } finally {
      setLoadingDossier(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialUserId) {
      loadDossier(initialUserId);
    }
  }, [initialUserId, loadDossier]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError('Antre omwen 2 karaktè (non, imèl, oswa ID).');
      return;
    }
    setSearching(true);
    setError('');
    setDossier(null);
    setSearched(true);
    try {
      const res = await fetch(`/api/admin/client-dossier?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè');
      setMatches(data.matches || []);
      if ((data.matches || []).length === 1) {
        await loadDossier(data.matches[0].id);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erè rechèch.');
      setMatches([]);
    } finally {
      setSearching(false);
    }
  };

  const p = dossier?.profile;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 sm:p-8 rounded-3xl text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="text-indigo-300" size={28} />
          <h2 className="text-xl font-bold tracking-tight">Dosye Kliyan</h2>
        </div>
        <p className="text-sm text-indigo-200/90 max-w-2xl">
          Chèche pa <strong>imèl</strong>, <strong>non konplè</strong>, oswa <strong>ID itilizatè</strong>.
          Tout dokiman KYC, antrepriz, ak ajan yo santralize isit la.
        </p>
      </div>

      <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 flex-1">
          <Search size={20} className="text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Egzamp: dorkensen@gmail.com, Emetil Dorkensen, oswa UUID..."
            className="w-full bg-transparent border-none p-2 text-slate-900 outline-none font-bold placeholder:text-slate-400 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={searching || loadingDossier}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {(searching || loadingDossier) && <Loader2 size={16} className="animate-spin" />}
          Chèche
        </button>
      </form>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {matches.length > 0 && !dossier && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-slate-50">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {matches.length} rezilta — chwazi yon kliyan
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => loadDossier(m.id)}
                className="w-full text-left px-6 py-4 hover:bg-indigo-50/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <p className="font-bold text-slate-900">{m.full_name || 'San non'}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {statusBadge(m.kyc_status, {
                    approved: 'bg-emerald-50 text-emerald-700',
                    pending: 'bg-amber-50 text-amber-700',
                    rejected: 'bg-rose-50 text-rose-700',
                  })}
                  {m.account_type === 'business' && (
                    <span className="text-[10px] px-2.5 py-1 rounded-md font-bold uppercase bg-indigo-50 text-indigo-700">Biznis</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {searched && matches.length === 0 && !dossier && !searching && !loadingDossier && !error && (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200 text-slate-500 text-sm font-bold uppercase tracking-wider">
          Pa jwenn okenn kliyan
        </div>
      )}

      {loadingDossier && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-indigo-600" size={36} />
        </div>
      )}

      {p && dossier && !loadingDossier && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => { setDossier(null); setMatches([]); setSearched(false); }}
            className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase hover:text-indigo-600"
          >
            <ArrowLeft size={16} />
            Tounen nan rechèch
          </button>

          {/* Idantite */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 md:items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <User size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{p.full_name || 'San non'}</h3>
                  {p.business_name && (
                    <p className="text-sm text-indigo-700 font-semibold mt-0.5 flex items-center gap-1">
                      <Building2 size={14} />
                      {p.business_name}
                    </p>
                  )}
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                    <Mail size={14} />
                    {p.email}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono mt-2">ID: {p.id}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                    <Calendar size={12} />
                    Enskri: {new Date(p.created_at).toLocaleDateString('ht-HT')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {statusBadge(p.kyc_status, {
                  approved: 'bg-emerald-50 text-emerald-700',
                  pending: 'bg-amber-50 text-amber-700',
                  rejected: 'bg-rose-50 text-rose-700',
                })}
                {statusBadge(p.account_status, {
                  active: 'bg-emerald-50 text-emerald-700',
                  suspended: 'bg-rose-50 text-rose-700',
                })}
                {p.account_type === 'business' && (
                  <span className="text-[10px] px-2.5 py-1 rounded-md font-bold uppercase bg-indigo-50 text-indigo-700">
                    Kont Antrepriz
                  </span>
                )}
                {p.is_merchant && (
                  <span className="text-[10px] px-2.5 py-1 rounded-md font-bold uppercase bg-violet-50 text-violet-700">
                    Machann API
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100">
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Wallet</p>
                <p className="text-sm font-black text-slate-900">{Number(p.wallet_balance || 0).toLocaleString()} HTG</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Kat</p>
                <p className="text-sm font-black text-slate-900">{Number(p.card_balance || 0).toLocaleString()} HTG</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Nimewo Kat</p>
                <p className="text-sm font-mono font-bold text-slate-900">{p.card_number || '—'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <p className="text-[10px] font-bold uppercase text-slate-500">Ajan</p>
                <p className="text-sm font-bold text-slate-900 uppercase">{p.agent_status || 'none'}</p>
              </div>
            </div>
          </div>

          {/* KYC */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="text-emerald-600" size={22} />
              <h4 className="font-bold text-slate-900">Verifikasyon Idantite (KYC)</h4>
            </div>
            <div className="text-sm text-slate-600 space-y-1 mb-4">
              <p><strong>Tip dokiman:</strong> {p.kyc_doc_type || '—'}</p>
              {p.kyc_submitted_at && (
                <p><strong>Soumèt:</strong> {new Date(p.kyc_submitted_at).toLocaleString('ht-HT')}</p>
              )}
              {p.kyc_face_match_score != null && (
                <p><strong>Match figi:</strong> {p.kyc_face_match_score}%</p>
              )}
              {p.kyc_rejection_reason && (
                <p className="text-rose-700"><strong>Rezon rejè:</strong> {p.kyc_rejection_reason}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <KycDocButton userId={p.id} doc="front" label="ID Devan" stored={p.kyc_front} />
              <KycDocButton userId={p.id} doc="back" label="ID Dèyè" stored={p.kyc_back} />
              <KycDocButton userId={p.id} doc="selfie" label="Selfie" stored={p.kyc_selfie} />
              {!p.kyc_front && !p.kyc_selfie && (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 font-bold uppercase">
                  Okenn dokiman KYC sou sistèm nan
                </span>
              )}
            </div>
          </div>

          {/* Antrepriz */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="text-indigo-600" size={22} />
              <h4 className="font-bold text-slate-900">Dokiman Antrepriz</h4>
            </div>
            {dossier.enterprise_applications.length === 0 ? (
              <p className="text-sm text-slate-500">Pa gen aplikasyon antrepriz.</p>
            ) : (
              <div className="space-y-5">
                {dossier.enterprise_applications.map((app) => (
                  <div key={app.id} className="border border-gray-100 rounded-2xl p-4 bg-slate-50/50">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="font-bold text-slate-900">{app.business_name || 'Biznis'}</p>
                      {statusBadge(app.status, {
                        approved: 'bg-emerald-50 text-emerald-700',
                        pending: 'bg-amber-50 text-amber-700',
                        rejected: 'bg-rose-50 text-rose-700',
                      })}
                      <span className="text-[10px] text-slate-400">
                        {new Date(app.created_at).toLocaleDateString('ht-HT')}
                      </span>
                    </div>
                    {app.business_reg_number && (
                      <p className="text-xs text-slate-600 mb-1">RCCM: {app.business_reg_number}</p>
                    )}
                    {app.business_activity && (
                      <p className="text-xs text-slate-600 mb-3">Aktivite: {app.business_activity}</p>
                    )}
                    {enterpriseDocs(app)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ajan */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="text-violet-600" size={22} />
              <h4 className="font-bold text-slate-900">Dokiman Ajan</h4>
            </div>
            {dossier.agent_applications.length === 0 ? (
              <p className="text-sm text-slate-500">Pa gen aplikasyon ajan.</p>
            ) : (
              <div className="space-y-5">
                {dossier.agent_applications.map((app) => (
                  <div key={app.id} className="border border-gray-100 rounded-2xl p-4 bg-slate-50/50">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {statusBadge(app.status, {
                        approved: 'bg-emerald-50 text-emerald-700',
                        pending: 'bg-amber-50 text-amber-700',
                        rejected: 'bg-rose-50 text-rose-700',
                      })}
                      <span className="text-[10px] text-slate-400">
                        {new Date(app.created_at).toLocaleDateString('ht-HT')}
                      </span>
                    </div>
                    {agentDocs(app)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dènye tranzaksyon */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="text-slate-600" size={22} />
              <h4 className="font-bold text-slate-900">Dènye Tranzaksyon (15)</h4>
            </div>
            {dossier.recent_transactions.length === 0 ? (
              <p className="text-sm text-slate-500">Okenn tranzaksyon.</p>
            ) : (
              <div className="space-y-2">
                {dossier.recent_transactions.map((tx) => (
                  <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-2 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-slate-700 font-medium truncate">{tx.description || tx.type}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-bold ${Number(tx.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {Number(tx.amount) >= 0 ? '+' : ''}{Number(tx.amount).toLocaleString()} HTG
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(tx.created_at).toLocaleDateString('ht-HT')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
