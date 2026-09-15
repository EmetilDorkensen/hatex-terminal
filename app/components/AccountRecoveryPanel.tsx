"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Loader2,
  ShieldCheck,
  UserCheck,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Send,
} from 'lucide-react';

type DocUrls = { id_front: string | null; id_back: string | null; selfie: string | null };

type RecoveryRequest = {
  id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  client_note: string | null;
  created_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  reset_token_expires_at: string | null;
  reset_token_used_at: string | null;
  doc_urls?: DocUrls;
};

type ProfileInfo = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  account_type: string | null;
  account_status: string | null;
  plan: string | null;
  kyc_status: string | null;
  kyc_doc_type: string | null;
  kyc_submitted_at: string | null;
  kyc_face_match_score: number | null;
  business_name: string | null;
  created_at: string | null;
};

type KycV2 = {
  status: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  phone_primary: string | null;
  address_street: string | null;
  address_city: string | null;
  address_department: string | null;
} | null;

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'An atant', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Lyen voye', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  rejected: { label: 'Refize', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  completed: { label: 'Konplete', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-HT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DocImage({ url, label }: Readonly<{ url: string | null; label: string }>) {
  return (
    <div className="bg-slate-50 border border-gray-200 rounded-xl overflow-hidden">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 px-3 py-2 border-b border-gray-100 bg-white">
        {label}
      </p>
      {url ? (
        url.includes('.pdf') ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-bold text-[#1d4ed8] py-10 hover:underline"
          >
            Ouvri PDF la
          </a>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block">
            <img src={url} alt={label} className="w-full h-44 object-contain bg-slate-100" />
          </a>
        )
      ) : (
        <p className="text-center text-[10px] text-slate-400 py-10 font-bold uppercase">Pa genyen</p>
      )}
    </div>
  );
}

/**
 * Panel Rekiperasyon Kont — admin + workspace (asistans).
 * 1. Antre email kliyan → tout pyès idantite l + enfo pwofil li parèt
 * 2. Konpare dokiman soumèt yo ak KYC sou dosye (kòt a kòt)
 * 3. Bouton "Reset MFA" → kliyan resevwa lyen imèl (1 èdtan, yon sèl fwa)
 */
export default function AccountRecoveryPanel() {
  const [searchEmail, setSearchEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listItems, setListItems] = useState<RecoveryRequest[]>([]);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [kycV2, setKycV2] = useState<KycV2>(null);
  const [kycOnFile, setKycOnFile] = useState<DocUrls | null>(null);
  const [requests, setRequests] = useState<RecoveryRequest[]>([]);
  const [searched, setSearched] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const loadList = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/account-recovery', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.ok) setListItems(data.items || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const search = async (emailArg?: string) => {
    const email = (emailArg ?? searchEmail).trim().toLowerCase();
    if (!email || !email.includes('@')) {
      setError('Antre imèl kliyan an.');
      return;
    }
    setLoading(true);
    setError('');
    setActionMsg('');
    setSearched(true);
    if (emailArg) setSearchEmail(emailArg);
    try {
      const res = await fetch(
        `/api/admin/account-recovery?email=${encodeURIComponent(email)}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Erè chajman.');
      setProfile(data.profile || null);
      setKycV2(data.kyc_v2 || null);
      setKycOnFile(data.kyc_on_file || null);
      setRequests(data.requests || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erè');
      setProfile(null);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const doAction = async (requestId: string, action: 'send_reset' | 'reject') => {
    const confirmMsg =
      action === 'send_reset'
        ? 'Ou fin verifye dokiman yo? Kliyan an ap resevwa yon imèl ak yon lyen (1 èdtan) pou l antre nan kont li epi re-konfigire MFA li.'
        : 'Refize demann sa a?';
    if (!window.confirm(confirmMsg)) return;

    setActionBusy(requestId + action);
    setActionMsg('');
    try {
      const res = await fetch('/api/admin/account-recovery', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message || 'Erè.');
      setActionMsg(data.message || 'Fèt!');
      await search();
      await loadList();
    } catch (e: unknown) {
      setActionMsg(e instanceof Error ? e.message : 'Erè.');
    } finally {
      setActionBusy('');
    }
  };

  const tokenExpired = (r: RecoveryRequest) =>
    r.status === 'approved' &&
    !r.reset_token_used_at &&
    !!r.reset_token_expires_at &&
    Date.parse(r.reset_token_expires_at) <= Date.now();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="text-[#1d4ed8]" size={20} />
          Rekiperasyon Kont (MFA pèdi)
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-1 max-w-2xl">
          Kliyan ki pèdi MFA + kòd aksè soumèt dokiman sou /rekiperasyon. Antre imèl li —
          tout pyès idantite l ak enfo pwofil li ap parèt. Konpare dokiman yo, epi si se
          menm moun nan, klike <strong>Reset MFA</strong> — kliyan an ap resevwa yon lyen
          imèl ki valab <strong>1 èdtan</strong> (yon sèl fwa).
        </p>
      </div>

      {/* ── CHÈCHE PA EMAIL ── */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search size={18} className="text-slate-400 ml-1 shrink-0" />
        <input
          type="email"
          placeholder="Antre imèl kliyan an (ex: kliyan@email.com)..."
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search();
          }}
          className="w-full bg-transparent border-none p-2 text-slate-900 outline-none font-medium text-sm"
        />
        <button
          onClick={() => void search()}
          disabled={loading}
          className="bg-[#1d4ed8] text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-blue-800 transition-all disabled:opacity-50 shrink-0 flex items-center gap-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Chèche
        </button>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">{error}</p>
      )}
      {actionMsg && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
          {actionMsg}
        </p>
      )}

      {/* ── DÈNYE DEMANN YO (san rechèch) ── */}
      {!searched && listItems.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Dènye demann rekiperasyon
            </span>
            <button
              onClick={() => void loadList()}
              className="text-[10px] font-bold text-[#1d4ed8] uppercase flex items-center gap-1"
            >
              <RefreshCw size={11} /> Rafrechi
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {listItems.map((r) => {
              const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
              return (
                <button
                  key={r.id}
                  onClick={() => void search(r.email)}
                  className="w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{r.email}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} /> {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase border shrink-0 ${st.cls}`}>
                    {st.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!searched && listItems.length === 0 && (
        <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">
          Poko gen demann rekiperasyon
        </p>
      )}

      {/* ── REZILTA RECHÈCH ── */}
      {searched && !loading && (
        <>
          {/* Pwofil kliyan an */}
          {profile ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 bg-blue-50 text-[#1d4ed8] rounded-full flex items-center justify-center font-bold text-lg border border-blue-100 overflow-hidden shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (profile.full_name || profile.email).substring(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <UserCheck size={16} className="text-emerald-500" />
                    {profile.full_name || '(San non)'}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <Mail size={12} /> {profile.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  ['Telefòn', profile.phone || kycV2?.phone_primary || '—'],
                  ['Tip kont', profile.account_type || 'pèsonèl'],
                  ['Estati kont', profile.account_status || 'aktif'],
                  ['Plan', profile.plan || '—'],
                  ['Estati KYC', profile.kyc_status || '—'],
                  ['Tip pyès KYC', profile.kyc_doc_type || '—'],
                  ['KYC soumèt', fmtDate(profile.kyc_submitted_at)],
                  ['Kont kreye', fmtDate(profile.created_at)],
                  ...(kycV2?.date_of_birth ? [['Dat nesans', kycV2.date_of_birth]] : []),
                  ...(kycV2?.address_city
                    ? [['Adrès', `${kycV2.address_street || ''} ${kycV2.address_city}, ${kycV2.address_department || ''}`]]
                    : []),
                  ...(profile.business_name ? [['Biznis', profile.business_name]] : []),
                  ...(profile.kyc_face_match_score != null
                    ? [['Face match KYC', `${profile.kyc_face_match_score}%`]]
                    : []),
                ].map(([k, v]) => (
                  <div key={k as string} className="bg-slate-50 border border-gray-100 rounded-lg px-3 py-2">
                    <p className="text-[9px] font-bold uppercase text-slate-400">{k}</p>
                    <p className="font-bold text-slate-800 truncate mt-0.5">{v as string}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={15} />
              Pa gen kont HatexCard ak imèl sa a — verifye òtograf la anvan w reset anyen.
            </p>
          )}

          {/* Demann + konparezon dokiman */}
          {requests.length === 0 ? (
            <p className="text-center text-slate-400 text-xs font-bold uppercase py-8">
              Pa gen demann rekiperasyon pou imèl sa a
            </p>
          ) : (
            requests.map((r) => {
              const st = STATUS_LABEL[r.status] || STATUS_LABEL.pending;
              const expired = tokenExpired(r);
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] px-2.5 py-1 rounded-md font-bold uppercase border ${st.cls}`}>
                        {expired ? 'Lyen ekspire' : st.label}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Clock size={11} /> Soumèt: {fmtDate(r.created_at)}
                      </span>
                    </div>
                    {r.reviewed_by && (
                      <span className="text-[10px] text-slate-400">
                        Revize pa {r.reviewed_by} · {fmtDate(r.reviewed_at)}
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-5">
                    {r.client_note && (
                      <p className="text-xs text-slate-600 bg-blue-50/50 border border-blue-100 rounded-xl px-4 py-3">
                        <strong>Nòt kliyan:</strong> {r.client_note}
                      </p>
                    )}

                    {/* ── KONPAREZON: dokiman soumèt vs KYC sou dosye ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1d4ed8] mb-2 flex items-center gap-1.5">
                          <Send size={11} /> Dokiman kliyan an sot soumèt
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <DocImage url={r.doc_urls?.id_front || null} label="Pyès (devan)" />
                          <DocImage url={r.doc_urls?.id_back || null} label="Pyès (dèyè)" />
                          <DocImage url={r.doc_urls?.selfie || null} label="Foto live" />
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2 flex items-center gap-1.5">
                          <ShieldCheck size={11} /> KYC sou dosye (referans)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <DocImage url={kycOnFile?.id_front || null} label="Pyès (devan)" />
                          <DocImage url={kycOnFile?.id_back || null} label="Pyès (dèyè)" />
                          <DocImage url={kycOnFile?.selfie || null} label="Selfie KYC" />
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500 bg-slate-50 border border-gray-100 rounded-xl px-4 py-3">
                      ✔ Konpare foto yo: <strong>menm figi</strong>, <strong>menm non</strong> sou pyès la ak pwofil la,
                      pyès la <strong>klè e san modifikasyon</strong>. Si gen dout — refize epi mande kliyan an
                      soumèt ankò oswa kontakte l.
                    </p>

                    {/* ── AKSYON ── */}
                    {(r.status === 'pending' || (r.status === 'approved' && (expired || !r.reset_token_used_at))) && (
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => void doAction(r.id, 'send_reset')}
                          disabled={!!actionBusy || !profile}
                          className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          {actionBusy === r.id + 'send_reset' ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}
                          {r.status === 'approved' ? 'Revoye lyen an (Reset MFA)' : 'Reset MFA — voye lyen an'}
                        </button>
                        {r.status === 'pending' && (
                          <button
                            onClick={() => void doAction(r.id, 'reject')}
                            disabled={!!actionBusy}
                            className="bg-white border border-rose-200 text-rose-600 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {actionBusy === r.id + 'reject' ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <XCircle size={14} />
                            )}
                            Refize
                          </button>
                        )}
                      </div>
                    )}

                    {r.status === 'approved' && !expired && !r.reset_token_used_at && (
                      <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        📧 Lyen an voye — li valab jiska <strong>{fmtDate(r.reset_token_expires_at)}</strong>.
                        Si kliyan an pa itilize l atan, klike "Revoye lyen an".
                      </p>
                    )}
                    {r.status === 'completed' && (
                      <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                        ✔ Kliyan an itilize lyen an ({fmtDate(r.reset_token_used_at)}) — MFA li reyinisyalize.
                      </p>
                    )}
                    {r.status === 'rejected' && (
                      <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                        ✖ Demann refize{r.reject_reason ? ` — ${r.reject_reason}` : ''}.
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          <button
            onClick={() => {
              setSearched(false);
              setProfile(null);
              setRequests([]);
              setSearchEmail('');
              setActionMsg('');
              void loadList();
            }}
            className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-[#1d4ed8]"
          >
            ← Retounen sou lis la
          </button>
        </>
      )}
    </div>
  );
}
