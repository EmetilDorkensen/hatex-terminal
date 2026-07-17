"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import imageCompression from 'browser-image-compression';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, ChevronRight, Camera, User, Clock,
  ShieldCheck, FileText, Loader2, ScanFace, Wallet, CreditCard,
} from 'lucide-react';
import { KYC_STATUS } from '@/lib/kyc/status';
import { KYC_FEE_HTG } from '@/lib/kyc/fees';

type KycStep = 'pay' | 1 | 2 | 3;

export default function KYCPage() {
  const router = useRouter();
  const [step, setStep] = useState<KycStep>('pay');
  const [loading, setLoading] = useState(false);
  const [verifyStep, setVerifyStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [docType, setDocType] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [feeInfo, setFeeInfo] = useState<{
    amount_due_htg: number;
    wallet_balance_htg: number;
    discount_htg: number;
    kyc_fee_paid: boolean;
  } | null>(null);

  const [extractedData, setExtractedData] = useState({ firstName: '', lastName: '', idNumber: '' });
  const [files, setFiles] = useState({
    idFront: null as File | null,
    idBack: null as File | null,
    selfie: null as File | null,
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      setUserData(prof);

      const feeRes = await fetch('/api/kyc/pay-fee');
      const feeData = feeRes.ok ? await feeRes.json() : null;
      if (feeData) {
        setFeeInfo({
          amount_due_htg: feeData.amount_due_htg,
          wallet_balance_htg: feeData.wallet_balance_htg,
          discount_htg: feeData.discount_htg || 0,
          kyc_fee_paid: feeData.kyc_fee_paid,
        });
      }

      if (prof?.kyc_status === KYC_STATUS.APPROVED) {
        router.push('/dashboard');
        return;
      }
      if (prof?.kyc_status === KYC_STATUS.PENDING) {
        setStep(3);
        return;
      }
      if (!feeData?.kyc_fee_paid) {
        setStep('pay');
      } else {
        setStep(1);
      }
    };
    loadData();
  }, [supabase, router]);

  const handlePayKycFee = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/kyc/pay-fee', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.needs_deposit) {
          setErrorMsg(data.error || 'Balans pa ase. Fè yon depo.');
        } else {
          setErrorMsg(data.error || 'Peman echwe.');
        }
        return;
      }
      setFeeInfo((prev) => prev ? { ...prev, kyc_fee_paid: true, wallet_balance_htg: data.wallet_balance_htg ?? prev.wallet_balance_htg } : null);
      setStep(1);
    } catch {
      setErrorMsg('Erè koneksyon. Eseye ankò.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else router.push('/dashboard');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof files) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Telefòn ka pran foto 8–12 MB — rejte oswa kontinyè; konpresyon ap fèt sou soumisyon
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('Foto a twò gwo (plis pase 25 MB). Pran yon lòt foto pi piti.');
      e.target.value = '';
      return;
    }
    setErrorMsg('');
    setFiles((prev) => ({ ...prev, [type]: file }));
  };

  const compressKycImage = async (file: File, label: string) => {
    setVerifyStep(`Konprese ${label}...`);
    const isSelfie = label.toLowerCase().includes('selfie');
    // Selfie: pa konprese twòp — deteksyon figi echwe sou foto twòp konprese
    if (isSelfie && file.size <= 2.5 * 1024 * 1024) {
      return file;
    }
    try {
      return await imageCompression(file, {
        maxSizeMB: isSelfie ? 1.2 : 0.75,
        maxWidthOrHeight: isSelfie ? 1600 : 1400,
        useWebWorker: false,
        initialQuality: isSelfie ? 0.92 : 0.82,
        fileType: 'image/jpeg',
      });
    } catch {
      // Fall back si konpresyon echwe — limenm gen chans pase si foto a deja pi piti
      if (file.size <= 1.5 * 1024 * 1024) return file;
      throw new Error(`Pa t kapab konprese ${label}. Fèmen lòt aplikasyon epi pran yon foto pi piti.`);
    }
  };

  const soumetKycBayAdmin = async () => {
    if (!extractedData.firstName || !extractedData.lastName) {
      setErrorMsg('TANPRI ANTRE NON AK SIYATI OU AVAN.');
      return;
    }
    if (!extractedData.idNumber || extractedData.idNumber.replace(/[\s\-]/g, '').length < 5) {
      setErrorMsg('Tanpri antre nimewo dokiman an jan li ekri sou ID a (omwen 5 karaktè).');
      return;
    }

    const isCIN = docType === 'CIN / KAT ELEKTORAL';
    if (!files.idFront || !files.selfie || (isCIN && !files.idBack)) {
      setErrorMsg('Tanpri pran tout foto yo mande yo.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setVerifyStep('Prepare dokiman yo...');

    try {
      // Konprese youn apre lòt pou pa choke memwa telefòn nan
      const compressedFront = await compressKycImage(files.idFront, 'devan ID');
      const compressedSelfie = await compressKycImage(files.selfie, 'selfie');
      const compressedBack = files.idBack
        ? await compressKycImage(files.idBack, 'dèyè ID')
        : null;

      const body = new FormData();
      body.append('docType', docType);
      body.append('firstName', extractedData.firstName);
      body.append('lastName', extractedData.lastName);
      body.append('idNumber', extractedData.idNumber.trim());
      body.append('idFront', compressedFront, 'front.jpg');
      body.append('selfie', compressedSelfie, 'selfie.jpg');
      if (compressedBack) body.append('idBack', compressedBack, 'back.jpg');

      setVerifyStep('Konpare figi ak ID (AI)...');
      const res = await fetch('/api/kyc/submit', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.needs_payment) {
          setStep('pay');
        }
        setErrorMsg(data.error || 'Soumisyon an echwe.');
        return;
      }

      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (/mémoire|memory|out of memory|allocation/i.test(msg) || msg.includes('konprese')) {
        setErrorMsg(msg || 'Telefòn ou pa gen ase memwa. Fèmen lòt aplikasyon, pran foto pi piti (pa 4K), epi eseye ankò.');
      } else {
        setErrorMsg('Erè nan voye dokiman yo: ' + (msg || 'Eseye ankò.'));
      }
    } finally {
      setLoading(false);
      setVerifyStep('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 font-sans flex flex-col items-center">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-4 mb-8 mt-2">
          <button
            onClick={goBack}
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Verifikasyon ID</h1>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">Konfòmite KYC</p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-700 text-xs font-bold mb-6 flex items-center gap-2 shadow-sm">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {loading && verifyStep && (
          <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-indigo-800 text-xs font-bold mb-6 flex items-center gap-2 shadow-sm">
            <Loader2 size={18} className="animate-spin shrink-0" />
            <span>{verifyStep}</span>
          </div>
        )}

        {userData?.kyc_status === KYC_STATUS.REJECTED && step === 1 && (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-8 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-amber-100 p-2 rounded-full text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-amber-800 font-bold uppercase tracking-wider text-xs">Demann ou an te Rejte</h3>
            </div>
            <div className="bg-white/60 p-3 rounded-lg border border-amber-100 mb-4">
              <p className="text-amber-900 text-sm font-medium leading-relaxed">
                <span className="text-amber-700/70 text-xs uppercase font-bold block mb-1">Rezon an se:</span>
                {userData.kyc_rejection_reason || 'Dokiman w yo pa t klè ase.'}
              </p>
            </div>
            <p className="text-amber-700 text-[10px] font-bold uppercase tracking-widest">
              Repran pwosesis la — nou pral verifye figi w ak ID ou otomatikman.
            </p>
          </div>
        )}

        {step === 'pay' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-5 border border-indigo-100 mx-auto">
                <CreditCard size={28} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2 text-center">Frè Verifikasyon KYC</h2>
              <p className="text-xs text-slate-500 text-center mb-6 leading-relaxed">
                Peye <strong className="text-slate-800">{KYC_FEE_HTG.toLocaleString()} HTG</strong> yon sèl fwa — enkli verifikasyon ID, kat vityèl, ak terminal. Pa gen okenn frè apa apre sa.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2 mb-6 border border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Frè KYC (kat enkli)</span>
                  <span className="font-bold">{KYC_FEE_HTG.toLocaleString()} HTG</span>
                </div>
                {(feeInfo?.discount_htg || 0) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Rediksyon pwomo</span>
                    <span className="font-bold">-{feeInfo?.discount_htg.toLocaleString()} HTG</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black border-t border-gray-200 pt-2">
                  <span>Total pou peye</span>
                  <span className="text-indigo-600">{(feeInfo?.amount_due_htg ?? KYC_FEE_HTG).toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1"><Wallet size={12}/> Balans wallet ou</span>
                  <span>{(feeInfo?.wallet_balance_htg ?? 0).toLocaleString()} HTG</span>
                </div>
              </div>

              {(feeInfo?.wallet_balance_htg ?? 0) < (feeInfo?.amount_due_htg ?? KYC_FEE_HTG) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-xs text-amber-800 font-medium">
                  Ou pa gen ase kòb sou wallet ou. Fè yon <strong>depo</strong> anvan, epi retounen isit pou peye frè KYC a.
                </div>
              )}

              <button
                type="button"
                disabled={loading || (feeInfo?.wallet_balance_htg ?? 0) < (feeInfo?.amount_due_htg ?? KYC_FEE_HTG)}
                onClick={handlePayKycFee}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 mb-3"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Ap trete...</> : <>Peye & Kontinye</>}
              </button>
              <button
                type="button"
                onClick={() => router.push('/deposit')}
                className="w-full border border-gray-200 text-slate-700 py-3.5 rounded-xl font-bold uppercase text-xs hover:bg-slate-50"
              >
                Ale fè Depo
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Chwazi Dokiman</h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Apre peman, nou verifye figi w ak dokiman an otomatikman, epi ekip nou an fè dènye revizyon an.
              </p>
            </div>

            <div className="space-y-3">
              {['CIN / KAT ELEKTORAL', 'PASPÒ', 'PÈMI KONDWI'].map((item) => (
                <button
                  key={item}
                  onClick={() => { setDocType(item); setStep(2); }}
                  className="w-full bg-white p-5 rounded-2xl border border-gray-200 text-left font-bold text-sm text-slate-700 flex justify-between items-center transition-all hover:border-indigo-300 hover:shadow-sm group"
                >
                  <span className="flex items-center gap-3">
                    <FileText size={18} className="text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                    {item}
                  </span>
                  <ChevronRight size={18} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-slate-400">
              <ScanFace size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Selfie + ID verifye pa AI anvan revizyon imen</span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Enfòmasyon w</h2>
              <p className="text-xs text-slate-500 font-medium">Antre non w jan l ekri sou dokiman an.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Non</label>
                <input
                  type="text"
                  placeholder="EG: JEAN"
                  className="w-full bg-white p-4 rounded-xl border border-gray-300 text-sm font-bold uppercase text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400 shadow-sm"
                  value={extractedData.firstName}
                  onChange={(e) => setExtractedData((prev) => ({ ...prev, firstName: e.target.value.toUpperCase() }))}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Siyati</label>
                <input
                  type="text"
                  placeholder="EG: JACQUES"
                  className="w-full bg-white p-4 rounded-xl border border-gray-300 text-sm font-bold uppercase text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400 shadow-sm"
                  value={extractedData.lastName}
                  onChange={(e) => setExtractedData((prev) => ({ ...prev, lastName: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">
                Nimewo dokiman (obligatwa)
              </label>
              <input
                type="text"
                placeholder="EG: 001-234-567-8 oswa nimewo sou ID a"
                className="w-full bg-white p-4 rounded-xl border border-gray-300 text-sm font-bold uppercase text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-400 shadow-sm"
                value={extractedData.idNumber}
                onChange={(e) =>
                  setExtractedData((prev) => ({
                    ...prev,
                    idNumber: e.target.value.toUpperCase(),
                  }))
                }
              />
              <p className="mt-1.5 text-[10px] text-slate-400 font-medium">
                Nou verifye nimewo sa a pa deja sou yon lòt kont.
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 border-b border-gray-200 pb-2">Foto Dokiman yo</p>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left mb-2">
                <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                  <strong>DEVAN</strong> = fas kat (kote foto ou ye). <strong>DÈYÈ</strong> = lòt bò a (pa menm foto fas). Selfie = figi ou sèlman, limyè klè.
                </p>
              </div>

              <label className={`block bg-slate-50 p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${files.idFront ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                <Camera size={32} className={`mx-auto mb-3 ${files.idFront ? 'text-emerald-500' : 'text-slate-400'}`} />
                <p className={`text-xs font-bold uppercase tracking-wider ${files.idFront ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {files.idFront ? `✅ ${files.idFront.name}` : 'Foto DEVAN Dokiman an (fas + foto figi)'}
                </p>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idFront')} />
              </label>

              {docType === 'CIN / KAT ELEKTORAL' && (
                <label className={`block bg-slate-50 p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${files.idBack ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                  <Camera size={32} className={`mx-auto mb-3 ${files.idBack ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <p className={`text-xs font-bold uppercase tracking-wider ${files.idBack ? 'text-emerald-700' : 'text-slate-600'}`}>
                    {files.idBack ? `✅ ${files.idBack.name}` : 'Foto DÈYÈ Dokiman an (lòt bò, pa fas)'}
                  </p>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFileChange(e, 'idBack')} />
                </label>
              )}

              <label className={`block bg-slate-50 p-6 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer ${files.selfie ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 hover:border-indigo-400'}`}>
                <User size={32} className={`mx-auto mb-3 ${files.selfie ? 'text-emerald-500' : 'text-slate-400'}`} />
                <p className={`text-xs font-bold uppercase tracking-wider ${files.selfie ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {files.selfie ? `✅ ${files.selfie.name}` : 'Pran yon Selfie klè ak figi w'}
                </p>
                <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => handleFileChange(e, 'selfie')} />
              </label>
            </div>

            <button
              disabled={loading}
              onClick={soumetKycBayAdmin}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Verifye & Soumèt...</>
              ) : (
                <><ScanFace size={16} /> Verifye Figi & Soumèt</>
              )}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center space-y-8 animate-in zoom-in duration-500 mt-10 bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
            <div className="py-6">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-100 shadow-sm">
                <Clock size={36} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">Dokiman yo Soumèt!</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed px-2">
                Figi w te pase verifikasyon otomatik la.<br />
                Ekip nou an ap fè dènye revizyon an — lè yo apwouve, <strong className="text-slate-800">kat vityèl ou ak terminal ou ap aktive otomatikman</strong>.
              </p>
            </div>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-white border border-gray-300 text-slate-700 py-4 rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-gray-50 transition-all shadow-sm"
            >
              Tounen nan Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
