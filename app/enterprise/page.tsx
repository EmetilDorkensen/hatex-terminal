"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  Building2, ShieldCheck, Loader2, CheckCircle2, AlertTriangle,
  ArrowLeft, ChevronRight, Lock, XCircle, Wallet, CreditCard, ArrowRightLeft, ArrowUpFromLine
} from 'lucide-react';
import { ENTERPRISE_APPLICATION_FEE, ENTERPRISE_CARD_DAILY_LIMIT, ENTERPRISE_CARD_MONTHLY_LIMIT, INDIVIDUAL_DAILY_LIMIT, INDIVIDUAL_MONTHLY_LIMIT } from '@/lib/security/spending-limits';

type Step = 'loading' | 'kyc_denied' | 'intro' | 'upload_docs' | 'confirm_fee' | 'pending' | 'rejected' | 'approved';

export default function EnterprisePortal() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [step, setStep] = useState<Step>('loading');
  const [actionLoading, setActionLoading] = useState(false);

  // Enfòmasyon biznis
  const [businessName, setBusinessName] = useState('');
  const [businessRegNumber, setBusinessRegNumber] = useState('');
  const [businessActivity, setBusinessActivity] = useState('');

  // Dokiman
  const [patenteDoc, setPatenteDoc] = useState<File | null>(null);
  const [cifDoc, setCifDoc] = useState<File | null>(null);
  const [businessRegistrationDoc, setBusinessRegistrationDoc] = useState<File | null>(null);
  const [bankStatementDoc, setBankStatementDoc] = useState<File | null>(null);
  const [leaseDoc, setLeaseDoc] = useState<File | null>(null);
  const [legalRepIdDoc, setLegalRepIdDoc] = useState<File | null>(null);
  const [confidentialityAccepted, setConfidentialityAccepted] = useState(false);

  // PIN pou konfime frè a
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setStep('loading');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/login');

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!prof) return;
    setProfile(prof);

    if (prof.kyc_status !== 'approved') {
      setStep('kyc_denied');
      return;
    }

    if (prof.account_type === 'business' && prof.enterprise_status === 'approved') {
      setStep('approved');
      return;
    }

    if (prof.enterprise_status === 'pending') {
      const { data: app } = await supabase
        .from('enterprise_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(app);
      setStep('pending');
      return;
    }

    if (prof.enterprise_status === 'rejected') {
      const { data: app } = await supabase
        .from('enterprise_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(app);
      setStep('rejected');
      return;
    }

    setStep('intro');
  };

  const handleDocsNext = () => {
    if (!businessName.trim() || !businessRegNumber.trim() || !businessActivity.trim()) {
      return alert("Tanpri ranpli non biznis la, nimewo anrejistreman an, ak aktivite biznis la.");
    }
    if (!patenteDoc || !cifDoc || !businessRegistrationDoc) {
      return alert("Patant, CIF, ak Sètifika Anrejistreman Biznis la obligatwa.");
    }
    if (!bankStatementDoc) return alert("Relve bankè biznis la (3 dènye mwa) obligatwa.");
    if (!leaseDoc) return alert("Kontra lokasyon oswa tit pwopriyete lokal biznis la obligatwa.");
    if (!legalRepIdDoc) return alert("Pyès idantite reprezantan legal biznis la obligatwa.");
    if (!confidentialityAccepted) return alert("Ou dwe aksepte Angajman Konfidansyalite/Anti-Fwod la pou w kontinye.");

    if (Number(profile?.wallet_balance || 0) < ENTERPRISE_APPLICATION_FEE) {
      return alert(`Ou bezwen omwen ${ENTERPRISE_APPLICATION_FEE.toLocaleString()} HTG sou Wallet ou pou peye frè pasaj la.`);
    }

    setStep('confirm_fee');
  };

  const submitApplication = async () => {
    if (enteredPin.length !== 4) {
      setPinError("PIN nan dwe gen 4 chif");
      return;
    }

    setActionLoading(true);
    setPinError('');

    try {
      const pinRes = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', pin: enteredPin }),
      });
      const pinData = await pinRes.json();
      if (!pinRes.ok || !pinData.success) {
        throw new Error(pinData.message || "PIN ou antre a pa bon. Tranzaksyon an anile.");
      }

      const { data: freshProf } = await supabase.from('profiles').select('wallet_balance').eq('id', profile.id).single();
      const currentBal = Number(freshProf?.wallet_balance || 0);
      if (currentBal < ENTERPRISE_APPLICATION_FEE) {
        throw new Error(`Ou pa gen ase kòb. Ou bezwen ${ENTERPRISE_APPLICATION_FEE.toLocaleString()} HTG.`);
      }

      const uploadFile = async (file: File, type: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `enterprise-${profile.id}-${type}-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('enterprise_documents').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('enterprise_documents').getPublicUrl(fileName);
        return data.publicUrl;
      };

      const patenteUrl = await uploadFile(patenteDoc!, 'patente');
      const cifUrl = await uploadFile(cifDoc!, 'cif');
      const businessRegUrl = await uploadFile(businessRegistrationDoc!, 'business_registration');
      const bankStatementUrl = await uploadFile(bankStatementDoc!, 'bank_statement');
      const leaseUrl = await uploadFile(leaseDoc!, 'lease_doc');
      const legalRepIdUrl = await uploadFile(legalRepIdDoc!, 'legal_rep_id');

      const newBal = currentBal - ENTERPRISE_APPLICATION_FEE;
      await supabase.from('profiles').update({
        wallet_balance: newBal,
        enterprise_status: 'pending',
        enterprise_fee_paid: ENTERPRISE_APPLICATION_FEE,
      }).eq('id', profile.id);

      await supabase.from('transactions').insert([
        { user_id: profile.id, type: 'ENTERPRISE_FEE', amount: -ENTERPRISE_APPLICATION_FEE, status: 'success', description: 'Frè Pasaj Kont Antrepriz' }
      ]);

      await supabase.from('enterprise_applications').insert([{
        user_id: profile.id,
        status: 'pending',
        business_name: businessName.trim(),
        business_reg_number: businessRegNumber.trim(),
        business_activity: businessActivity.trim(),
        patente_url: patenteUrl,
        cif_url: cifUrl,
        business_registration_url: businessRegUrl,
        bank_statement_url: bankStatementUrl,
        lease_doc_url: leaseUrl,
        legal_rep_id_url: legalRepIdUrl,
        confidentiality_accepted: confidentialityAccepted,
        confidentiality_accepted_at: new Date().toISOString(),
        metadata: { fee_paid: ENTERPRISE_APPLICATION_FEE },
      }]);

      try {
        await fetch('/api/notifications/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'admin',
            message: `🏢 <b>Nouvo Aplikasyon Kont Antrepriz</b>\n👤 ${profile.full_name}\n✉️ ${profile.email}\n🏬 Biznis: ${businessName.trim()}\n💰 Frè peye: ${ENTERPRISE_APPLICATION_FEE.toLocaleString()} HTG`,
            parseMode: 'HTML',
          }),
        });
      } catch {}

      setShowPinPrompt(false);
      setStep('pending');
    } catch (err: any) {
      setPinError(err.message);
      setEnteredPin('');
    } finally {
      setActionLoading(false);
    }
  };

  if (step === 'loading') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>;
  }

  if (step === 'kyc_denied') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm max-w-md text-center">
          <AlertTriangle className="mx-auto text-amber-500 mb-4" size={40} />
          <h2 className="text-xl font-bold mb-2">KYC Obligatwa</h2>
          <p className="text-sm text-slate-500 mb-6">Ou dwe fin verifye idantite w (KYC apwouve) anvan ou ka aplike pou yon Kont Antrepriz.</p>
          <button onClick={() => router.push('/kyc')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs uppercase">Ale nan Verifikasyon KYC</button>
        </div>
      </div>
    );
  }

  if (step === 'approved') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-slate-500 mb-6 font-bold text-xs">
            <ArrowLeft size={16} /> Tounen nan Tablodbò
          </button>
          <div className="bg-white p-8 rounded-3xl shadow-sm text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <Building2 className="text-emerald-600" size={28} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Kont Antrepriz Aktif</h2>
            <p className="text-sm text-slate-500 mb-8">Kont ou gen tout avantaj Antrepriz yo aktive.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="bg-slate-50 p-4 rounded-xl border">
                <ArrowRightLeft className="text-indigo-600 mb-2" size={20} />
                <p className="text-xs font-bold uppercase text-slate-500">Transfè</p>
                <p className="text-sm font-black text-emerald-600">Ilimite</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border">
                <ArrowUpFromLine className="text-indigo-600 mb-2" size={20} />
                <p className="text-xs font-bold uppercase text-slate-500">Retrè</p>
                <p className="text-sm font-black text-emerald-600">Ilimite</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border">
                <CreditCard className="text-indigo-600 mb-2" size={20} />
                <p className="text-xs font-bold uppercase text-slate-500">Limit Kat</p>
                <p className="text-sm font-black text-slate-800">{ENTERPRISE_CARD_DAILY_LIMIT.toLocaleString()}/j</p>
                <p className="text-[10px] text-slate-400">{ENTERPRISE_CARD_MONTHLY_LIMIT.toLocaleString()} HTG/mwa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm max-w-md text-center">
          <Loader2 className="mx-auto text-amber-500 mb-4 animate-spin" size={40} />
          <h2 className="text-xl font-bold mb-2">Aplikasyon Ap Egzamine</h2>
          <p className="text-sm text-slate-500 mb-2">Ekip Konfòmite nou an ap verifye dokiman biznis ou yo.</p>
          <p className="text-xs text-slate-400">Biznis: {application?.business_name || '—'}</p>
          <button onClick={() => router.push('/dashboard')} className="w-full mt-6 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-xs uppercase">Tounen nan Tablodbò</button>
        </div>
      </div>
    );
  }

  if (step === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="bg-white p-8 rounded-3xl shadow-sm max-w-md text-center">
          <XCircle className="mx-auto text-rose-500 mb-4" size={40} />
          <h2 className="text-xl font-bold mb-2">Aplikasyon Rejte</h2>
          <p className="text-sm text-slate-500 mb-4">{application?.rejection_reason || "Ekip nou an pa t ka apwouve aplikasyon w lan."}</p>
          <p className="text-[10px] text-slate-400 mb-6">Frè ou te peye a ranbouse sou Wallet ou.</p>
          <button
            onClick={() => setStep('intro')}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-xs uppercase"
          >
            Soumèt Nouvo Aplikasyon
          </button>
        </div>
      </div>
    );
  }

  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-slate-500 mb-6 font-bold text-xs">
            <ArrowLeft size={16} /> Tounen
          </button>

          <div className="bg-slate-900 p-8 rounded-3xl shadow-xl text-white mb-6">
            <Building2 className="mb-4" size={32} />
            <h1 className="text-2xl font-bold mb-2">Vin Kont Antrepriz</h1>
            <p className="text-sm text-slate-300">Debloke plis posiblite pou biznis ou: transfè ak retrè ilimite, limit kat pi wo, epi yon kont Ajan PRO gratis.</p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm mb-6">
            <h3 className="font-bold text-slate-900 mb-4">Avantaj Kont Antrepriz</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-slate-600">Transfè ak Retrè <strong>ilimite</strong> (kont endividyèl limite a {INDIVIDUAL_DAILY_LIMIT.toLocaleString()} HTG/jou, {INDIVIDUAL_MONTHLY_LIMIT.toLocaleString()} HTG/mwa)</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-slate-600">Kat ka depanse jiska <strong>{ENTERPRISE_CARD_DAILY_LIMIT.toLocaleString()} HTG/jou</strong> ak <strong>{ENTERPRISE_CARD_MONTHLY_LIMIT.toLocaleString()} HTG/mwa</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-slate-600">Kont <strong>Ajan PRO</strong> bay otomatikman si ou poko genyen l</p>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl mb-6">
            <p className="text-xs text-amber-800 font-bold uppercase tracking-wider mb-1">Frè Pasaj</p>
            <p className="text-2xl font-black text-amber-900">{ENTERPRISE_APPLICATION_FEE.toLocaleString()} HTG</p>
            <p className="text-[11px] text-amber-700 mt-1">Peye apre w fin soumèt dokiman yo. Ranbouse otomatikman si aplikasyon an rejte.</p>
          </div>

          <button
            onClick={() => setStep('upload_docs')}
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-xs uppercase flex justify-center items-center gap-2"
          >
            Kòmanse Aplikasyon <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (step === 'upload_docs') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setStep('intro')} className="flex items-center gap-2 text-slate-500 mb-6 font-bold text-xs">
            <ArrowLeft size={16} /> Tounen
          </button>

          <div className="bg-white p-8 rounded-3xl shadow-sm">
            <h2 className="text-2xl font-bold mb-8">Dokiman Antrepriz</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">Non Biznis la *</label>
                <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Egzamp: Boutik Rene SA" className="w-full bg-slate-50 p-3 rounded-xl text-sm border text-slate-900" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">Nimewo Anrejistreman Biznis (CIN/RCCM) *</label>
                <input type="text" value={businessRegNumber} onChange={(e) => setBusinessRegNumber(e.target.value)} placeholder="Nimewo Anrejistreman" className="w-full bg-slate-50 p-3 rounded-xl text-sm border text-slate-900" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">Aktivite Biznis la *</label>
                <input type="text" value={businessActivity} onChange={(e) => setBusinessActivity(e.target.value)} placeholder="Egzamp: Vant machandiz an gwo" className="w-full bg-slate-50 p-3 rounded-xl text-sm border text-slate-900" />
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="block text-xs font-bold mb-2 text-slate-900">Patant Biznis la *</label>
                <input type="file" onChange={(e) => setPatenteDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">CIF Biznis la *</label>
                <input type="file" onChange={(e) => setCifDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">Sètifika Anrejistreman Biznis la *</label>
                <input type="file" onChange={(e) => setBusinessRegistrationDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">Relve Bankè Biznis (3 dènye mwa) *</label>
                <input type="file" onChange={(e) => setBankStatementDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" />
                <p className="text-[10px] text-slate-400 mt-1.5">Pwoteksyon kont blanchiman lajan pou gwo volim tranzaksyon.</p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">Kontra Lokasyon oswa Tit Pwopriyete Lokal Biznis la *</label>
                <input type="file" onChange={(e) => setLeaseDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" />
                <p className="text-[10px] text-slate-400 mt-1.5">Konfime lokal biznis la reyèl e li pa vityèl.</p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 text-slate-900">Pyès Idantite Reprezantan Legal la *</label>
                <input type="file" onChange={(e) => setLegalRepIdDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" />
              </div>

              <label className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 p-4 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={confidentialityAccepted}
                  onChange={(e) => setConfidentialityAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                <span className="text-xs text-indigo-700 font-medium">
                  Mwen sètifye enfòmasyon biznis sa yo egzat epi mwen aksepte Angajman Konfidansyalite/Anti-Fwod HatexCard la.
                </span>
              </label>
            </div>

            <button onClick={handleDocsNext} className="w-full mt-10 bg-slate-900 text-white py-4 rounded-xl font-bold text-xs uppercase flex justify-center gap-2">
              Kontinye <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm_fee') {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        {showPinPrompt && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white border border-gray-200 p-8 rounded-3xl w-full max-w-sm text-center shadow-xl animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
                <Lock className="text-indigo-600" size={28} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Konfime Frè Pasaj la</h2>
              <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
                Mete PIN sekirite 4 chif ou a pou peye <span className="font-bold text-slate-800">{ENTERPRISE_APPLICATION_FEE.toLocaleString()} HTG</span> epi soumèt aplikasyon w lan.
              </p>

              <input
                type="password" maxLength={4} autoFocus placeholder="••••"
                value={enteredPin} onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-center text-3xl font-mono tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-6 text-slate-900 transition-all shadow-sm"
              />

              {pinError && (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg mb-6">
                  <p className="text-xs text-rose-600 font-bold uppercase tracking-wider animate-pulse">{pinError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowPinPrompt(false)} disabled={actionLoading} className="flex-1 bg-white border border-gray-300 py-3.5 rounded-xl font-bold uppercase text-xs text-slate-700 hover:bg-gray-50 transition-all shadow-sm">
                  Anile
                </button>
                <button onClick={submitApplication} disabled={actionLoading || enteredPin.length !== 4} className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3.5 rounded-xl font-bold uppercase text-xs text-white transition-all disabled:opacity-50 shadow-sm flex justify-center items-center">
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : "Peye & Soumèt"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto">
          <button onClick={() => setStep('upload_docs')} className="flex items-center gap-2 text-slate-500 mb-6 font-bold text-xs">
            <ArrowLeft size={16} /> Tounen
          </button>

          <div className="bg-white p-8 rounded-3xl shadow-sm">
            <h2 className="text-2xl font-bold mb-4">Peman Frè Pasaj</h2>
            <div className="flex items-center gap-2 mb-6 text-slate-500">
              <Wallet size={16} />
              <p className="text-xs font-bold uppercase tracking-wider">Balans Disponib: <span className="text-slate-800">{Number(profile?.wallet_balance || 0).toLocaleString()} HTG</span></p>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border mb-8">
              <div className="flex justify-between text-sm font-black">
                <span>Frè Pasaj Kont Antrepriz:</span>
                <span className="text-rose-600">{ENTERPRISE_APPLICATION_FEE.toLocaleString()} HTG</span>
              </div>
            </div>

            <button
              onClick={() => { setShowPinPrompt(true); setEnteredPin(''); setPinError(''); }}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-xs uppercase flex justify-center"
            >
              Peye & Soumèt Aplikasyon
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
