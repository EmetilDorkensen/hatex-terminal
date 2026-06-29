"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Store, ShieldCheck, FileText, Wallet, Search, Loader2, CheckCircle2, 
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, UserCheck, 
  ArrowLeft, Building2, Briefcase, UploadCloud, CheckSquare, ChevronRight
} from 'lucide-react';

type AppStep = 'loading' | 'kyc_denied' | 'rejected' | 'tier_select' | 'upload_docs' | 'payment_plan' | 'pending' | 'dashboard';

export default function AgentPortal() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const [appStep, setAppStep] = useState<AppStep>('loading');
  const [actionLoading, setActionLoading] = useState(false);
  
  const [selectedTier, setSelectedTier] = useState<'pro' | 'premium' | null>(null);
  
  // Fichye Dokiman
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [addressDoc, setAddressDoc] = useState<File | null>(null);
  const [locationPhoto, setLocationPhoto] = useState<File | null>(null);
  const [patenteDoc, setPatenteDoc] = useState<File | null>(null);
  const [cifDoc, setCifDoc] = useState<File | null>(null);

  // Lojik Peman Premye Fwa
  const [activationAmount, setActivationAmount] = useState('');
  
  // Dashboard Ajan
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [depositEmail, setDepositEmail] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [agentTransactions, setAgentTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchAgentData();
  }, [supabase, router]);

  const fetchAgentData = async () => {
    setAppStep('loading');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return router.push('/login');

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();

    if (prof) {
      setProfile(prof);
      if (prof.kyc_status !== 'approved') {
        setAppStep('kyc_denied');
      } else if (prof.agent_status === 'none' || !prof.agent_status) {
        setAppStep('tier_select');
      } else if (prof.agent_status === 'rejected') {
        setAppStep('rejected');
      } else if (prof.agent_status === 'pending') {
        setAppStep('pending');
      } else if (prof.agent_status === 'approved') {
        setAppStep('dashboard');
        const { data: txs } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .in('type', ['AGENT_DEPOSIT', 'AGENT_WITHDRAWAL', 'AGENT_GUARANTEE'])
          .order('created_at', { ascending: false });
        if (txs) setAgentTransactions(txs);
      }
    }
  };

  const handleDocsNext = () => {
    if (!idDoc || !addressDoc || !locationPhoto) return alert("Pyès idantite, prèv adrès ak foto lokal la obligatwa.");
    if (selectedTier === 'premium' && (!patenteDoc || !cifDoc)) return alert("Patant ak CIF obligatwa pou ajan Premium.");
    setAppStep('payment_plan');
  };

  // ==========================================
  // SOUMÈT APLIKASYON + PRAN KÒB LA AK FRÈ A SOU WALLET LA
  // ==========================================
  const submitApplication = async () => {
    const amount = Number(activationAmount);
    if (amount <= 0) return alert("Kantite lajan an pa valab.");
    
    // Kalkile Frè (7 HTG pou chak 1000 HTG)
    const fee = Math.floor((amount / 1000) * 7);
    const totalDeduction = amount + fee;

    if (profile.wallet_balance < totalDeduction) {
        return alert(`Ou pa gen ase kòb sou Wallet ou.\nOu bezwen ${amount} HTG + ${fee} HTG (Frè) = ${totalDeduction} HTG pou tranzaksyon sa a.`);
    }

    const requiredAmount = selectedTier === 'premium' ? 110000 : 40000;
    if (amount > requiredAmount) {
        return alert(`Kapasite maksimòm plan ${selectedTier} la se ${requiredAmount.toLocaleString()} HTG.`);
    }

    setActionLoading(true);
    try {
      // 1. Upload files
      const uploadFile = async (file: File, type: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `agent-${profile.id}-${type}-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('agent_documents').upload(fileName, file);
        if (error) { console.error(error); return ""; }
        const { data } = supabase.storage.from('agent_documents').getPublicUrl(fileName);
        return data.publicUrl;
      };

      const idUrl = await uploadFile(idDoc!, 'id');
      const addressUrl = await uploadFile(addressDoc!, 'address');
      const locationUrl = await uploadFile(locationPhoto!, 'location');
      const patenteUrl = selectedTier === 'premium' && patenteDoc ? await uploadFile(patenteDoc, 'patente') : null;
      const cifUrl = selectedTier === 'premium' && cifDoc ? await uploadFile(cifDoc, 'cif') : null;

      // 2. Wete kòb la sou Wallet, mete l sou Agent Balance, ekri kapasite a
      const newWalletBal = Number(profile.wallet_balance) - totalDeduction;
      
      const { error: profileErr } = await supabase.from('profiles').update({ 
        wallet_balance: newWalletBal,
        agent_balance: amount,
        agent_capacity: amount,
        agent_guarantee_paid: amount,
        agent_status: 'pending', 
        agent_tier: selectedTier 
      }).eq('id', profile.id);

      if (profileErr) throw profileErr;

      // 3. Jounal Tranzaksyon an (Garanti + Frè) - ✅ MEN KOTE ERÈ A TE YE
      await supabase.from('transactions').insert([
          { user_id: profile.id, type: 'AGENT_GUARANTEE', amount: -amount, status: 'success', description: `Aktivasyon Ajan ${selectedTier?.toUpperCase() || ''}` },
          { user_id: profile.id, type: 'FEE', amount: -fee, status: 'success', description: `Frè aktivasyon Ajan (7/1000 HTG)` }
      ]);

      // 4. Voye Dokiman yo bay Admin an nan baz done a
      await supabase.from('agent_applications').insert([{
        user_id: profile.id,
        tier: selectedTier,
        status: 'pending',
        id_doc_url: idUrl,
        address_doc_url: addressUrl,
        location_photo_url: locationUrl,
        patente_url: patenteUrl,
        cif_url: cifUrl,
        metadata: { initial_deposit: amount, fee_paid: fee }
      }]);

      fetchAgentData();
    } catch (err: any) {
      alert("Erè nan telechaje dokiman yo: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const restartApplication = async () => {
    setActionLoading(true);
    await supabase.from('profiles').update({ agent_status: 'none' }).eq('id', profile.id);
    setAppStep('tier_select');
    setActionLoading(false);
  };

  // ==========================================
  // OGMANTE KAPASITE AJAN NAN DASHBOARD LA (+ Frè a)
  // ==========================================
  const makeInstallmentPayment = async () => {
    const amount = Number(installmentAmount);
    if (amount <= 0) return alert("Kantite a pa valab.");
    
    const fee = Math.floor((amount / 1000) * 7);
    const totalDeduction = amount + fee;

    if (profile.wallet_balance < totalDeduction) {
        return alert(`Ou bezwen ${totalDeduction.toLocaleString()} HTG sou balans prensipal ou (Kòb + Frè).`);
    }

    const requiredAmount = profile.agent_tier === 'premium' ? 110000 : 40000;
    const remaining = requiredAmount - (profile.agent_guarantee_paid || 0);

    if (amount > remaining) return alert(`Ou kapab ajoute maksimòm ${remaining.toLocaleString()} HTG sèlman.`);

    setActionLoading(true);
    try {
      const newWalletBal = profile.wallet_balance - totalDeduction;
      const newGuaranteePaid = (profile.agent_guarantee_paid || 0) + amount;
      const newCapacity = (profile.agent_capacity || 0) + amount;
      const newAgentBalance = (profile.agent_balance || 0) + amount;

      const { error } = await supabase.from('profiles').update({ 
        wallet_balance: newWalletBal,
        agent_guarantee_paid: newGuaranteePaid,
        agent_capacity: newCapacity,
        agent_balance: newAgentBalance
      }).eq('id', profile.id);

      if (error) throw error;

      await supabase.from('transactions').insert([
          { user_id: profile.id, type: 'AGENT_GUARANTEE', amount: -amount, status: 'success', description: `Peman adisyonèl kapasite Ajan` },
          { user_id: profile.id, type: 'FEE', amount: -fee, status: 'success', description: `Frè peman kapasite (7/1000 HTG)` }
      ]);

      alert(`Vèsman pase ak siksè! Kapasite w ak Balans Ajan w ogmante.`);
      setInstallmentAmount('');
      fetchAgentData();
    } catch (err: any) { alert(err.message); } finally { setActionLoading(false); }
  };

  // ==========================================
  // FÈ DEPO POU KLIYAN (Gratis)
  // ==========================================
  const handleAgentDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    
    const amountNum = Number(depositAmount);
    if (amountNum <= 0 || !depositEmail) return setStatusMsg({ type: 'error', text: 'Imèl ak montan obligatwa.' });

    setActionLoading(true);
    try {
      const { data: currentAgent, error: agentErr } = await supabase.from('profiles').select('account_status, agent_status, agent_balance').eq('id', profile.id).single();
      if (agentErr || !currentAgent) throw new Error("Erè verifikasyon ajan.");
      if (currentAgent.account_status === 'suspended') throw new Error("Kont ou a sispandi.");
      if (currentAgent.agent_balance < amountNum) throw new Error("Ou pa gen ase kòb sou balans Ajan w lan pou fè depo sa.");

      const { data: client, error: clientErr } = await supabase.from('profiles').select('id, wallet_balance, account_status, full_name').eq('email', depositEmail.toLowerCase().trim()).single();
      if (clientErr || !client) throw new Error("Pa jwenn okenn kliyan ak imèl sa a.");
      if (client.account_status === 'suspended') throw new Error("Kont kliyan an sispandi.");

      const newAgentBalance = Number(currentAgent.agent_balance) - amountNum;
      const newClientBalance = Number(client.wallet_balance) + amountNum;

      await supabase.from('profiles').update({ agent_balance: newAgentBalance }).eq('id', profile.id);
      const { error: err2 } = await supabase.from('profiles').update({ wallet_balance: newClientBalance }).eq('id', client.id);
      
      if (err2) {
         await supabase.from('profiles').update({ agent_balance: currentAgent.agent_balance }).eq('id', profile.id);
         throw new Error("Echèk tranzaksyon. Kòb la retounen sou kont ou.");
      }

      await supabase.from('transactions').insert([
        { user_id: profile.id, type: 'AGENT_DEPOSIT', amount: -amountNum, status: 'success', description: `Depo pou ${client.full_name}`, metadata: { client_email: depositEmail } },
        { user_id: client.id, type: 'DEPOSIT', amount: amountNum, status: 'success', description: `Depo nan men Ajan: ${profile.agent_code}`, metadata: { agent_code: profile.agent_code } }
      ]);

      setStatusMsg({ type: 'success', text: `Depo ${amountNum} HTG reyisi pou ${client.full_name}!` });
      setDepositAmount(''); setDepositEmail('');
      fetchAgentData();
    } catch (err: any) { setStatusMsg({ type: 'error', text: err.message }); } finally { setActionLoading(false); }
  };


  if (appStep === 'loading') return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>;

  if (appStep === 'kyc_denied') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm text-center max-w-md w-full">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldCheck size={40} className="text-amber-500" /></div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-3">Verifikasyon Obligatwa</h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">Pou garanti sekirite platfòm nan, ou dwe pase etap verifikasyon idantite a (KYC) anvan ou ka aplike pou vin yon ajan Hatexcard.</p>
          <button onClick={() => router.push('/dashboard')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm hover:bg-indigo-700">Ale nan Dashboard la</button>
        </div>
      </div>
    );
  }

  if (appStep === 'rejected') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-rose-200 p-8 rounded-3xl shadow-sm text-center max-w-md w-full">
          <AlertTriangle size={60} className="text-rose-500 mx-auto mb-6" />
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-3">Aplikasyon w lan Rejte</h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">Admin nan te verifye dokiman w yo epi li te rejte yo. Sa konn rive si foto yo pa klè oswa dokiman an ekspire. (N.B: Lajan w te depoze a ranbouse sou kont ou).</p>
          <button onClick={restartApplication} disabled={actionLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex justify-center">
            {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Rekòmanse Aplikasyon an'}
          </button>
        </div>
      </div>
    );
  }

  if (appStep === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-indigo-100 p-8 sm:p-10 rounded-3xl shadow-sm text-center max-w-lg w-full">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8 relative">
            <div className="absolute inset-0 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <Store size={40} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">Verifikasyon ankou...</h2>
          <div className="bg-slate-50 border border-gray-100 p-5 rounded-2xl mb-8">
            <p className="text-sm text-slate-600 leading-relaxed font-medium">Dokiman ou yo ak peman w lan byen rive! Ekip Admin nou an ap verifye tout pyès idantite ak prèv ou soumèt yo.</p>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mt-4 bg-indigo-50 py-2 rounded-lg">Tan atant: 1 a 3 Jou Ouvrab</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm">Retounen nan Akèy la</button>
        </div>
      </div>
    );
  }

  if (appStep === 'tier_select') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans flex flex-col items-center pt-12 pb-24">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100"><Store size={32} /></div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vin Ajan Hatexcard</h1>
          <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto leading-relaxed">Chwazi nivo ki koresponn ak gwosè biznis ou an pou w kòmanse fè pwofi kòm pwen tranzaksyon nan zòn ou an.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col hover:border-indigo-300 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-4"><Briefcase className="text-indigo-600" size={28} /><h2 className="text-2xl font-bold">Ajan PRO</h2></div>
            <p className="text-sm text-slate-500 mb-6">Pafè pou ti ak mwayen biznis kap chache ajoute yon revni siplemantè.</p>
            <div className="text-3xl font-bold text-slate-900 mb-6">40,000 <span className="text-sm text-slate-500 uppercase">HTG</span></div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm font-medium text-slate-700"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Kapasite Maksimòm 40,000 HTG</li>
              <li className="flex items-center gap-3 text-sm font-medium text-slate-700"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Pyès Idantite & Prèv Adrès sèlman</li>
              <li className="flex items-center gap-3 text-sm font-medium text-slate-700"><CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> Ka peye nan 3 vèsman</li>
            </ul>
            <button onClick={() => { setSelectedTier('pro'); setAppStep('upload_docs'); }} className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all">Chwazi PRO</button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-wider">Rekòmande</div>
            <div className="flex items-center gap-3 mb-4"><Building2 className="text-indigo-400" size={28} /><h2 className="text-2xl font-bold text-white">Ajan PREMIUM</h2></div>
            <p className="text-sm text-slate-400 mb-6">Pou gwo antrepriz ki gen anpil mouvman kach ak gwo volim tranzaksyon.</p>
            <div className="text-3xl font-bold text-white mb-6">110,000 <span className="text-sm text-slate-400 uppercase">HTG</span></div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-sm font-medium text-slate-300"><CheckCircle2 size={18} className="text-indigo-400 shrink-0" /> Kapasite Maksimòm 110,000 HTG</li>
              <li className="flex items-center gap-3 text-sm font-medium text-slate-300"><CheckCircle2 size={18} className="text-indigo-400 shrink-0" /> Mande Patant ak CIF biznis la</li>
              <li className="flex items-center gap-3 text-sm font-medium text-slate-300"><CheckCircle2 size={18} className="text-indigo-400 shrink-0" /> Ka peye nan 3 vèsman</li>
            </ul>
            <button onClick={() => { setSelectedTier('premium'); setAppStep('upload_docs'); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-md border border-indigo-500">Chwazi PREMIUM</button>
          </div>
        </div>
      </div>
    );
  }

  if (appStep === 'upload_docs') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans pb-24">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setAppStep('tier_select')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-xs uppercase tracking-wider mb-6 transition-colors"><ArrowLeft size={16} /> Tounen</button>
          
          <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Dokiman pou Ajan <span className="text-indigo-600 uppercase">{selectedTier || ''}</span></h2>
            <p className="text-sm text-slate-500 mb-8">Telechaje dosye legal ki anba yo pou admin nan ka verifye w ak biznis ou an.</p>

            <div className="space-y-6">
              <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Pyès Idantite Valid *</label><input type="file" onChange={(e) => setIdDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" /></div>
              <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Prèv Adrès (&lt; 3 mwa) *</label><input type="file" onChange={(e) => setAddressDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" /></div>
              <div><label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Foto Kote W Vle Bay Sèvis La *</label><input type="file" onChange={(e) => setLocationPhoto(e.target.files?.[0] || null)} className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" /></div>

              {selectedTier === 'premium' && (
                <>
                  <div className="pt-4 border-t border-gray-100"><label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Patant Biznis la *</label><input type="file" onChange={(e) => setPatenteDoc(e.target.files?.[0] || null)} className="w-full bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-800" /></div>
                  <div><label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">CIF Biznis la *</label><input type="file" onChange={(e) => setCifDoc(e.target.files?.[0] || null)} className="w-full bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-800" /></div>
                </>
              )}
            </div>
            <button onClick={handleDocsNext} className="w-full mt-10 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2">Kontinye <ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    );
  }

  if (appStep === 'payment_plan') {
    const requiredAmount = selectedTier === 'premium' ? 110000 : 40000;
    const currentInput = Number(activationAmount);
    const calculatedFee = Math.floor((currentInput / 1000) * 7);
    const totalWithFee = currentInput + calculatedFee;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans pb-24">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setAppStep('upload_docs')} disabled={actionLoading} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-xs uppercase tracking-wider mb-6 transition-colors disabled:opacity-50"><ArrowLeft size={16} /> Tounen nan Dokiman yo</button>
          
          <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Aktivasyon & Premye Vèsman</h2>
            <p className="text-sm text-slate-500 mb-8 leading-relaxed">
              Plan {selectedTier?.toUpperCase() || ''} la mande yon maksimòm de {requiredAmount.toLocaleString()} HTG. Lajan sa ap transfere sou "Balans Ajan" w lan epi li bay kapasite pou travay. Ou ka peye l yon sèl kou, oswa an pati.
            </p>

            <div className="space-y-4 mb-8">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Montan w ap peye kounye a (HTG)</label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="number" 
                  value={activationAmount}
                  onChange={(e) => setActivationAmount(e.target.value)}
                  placeholder="Ex: 10000"
                  className="w-full bg-slate-50 border border-gray-200 py-4 pl-12 pr-4 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm text-slate-900"
                />
              </div>
            </div>

            {currentInput > 0 && (
              <div className="bg-slate-50 p-5 rounded-xl border border-gray-200 mb-8 space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>Montan pou Kapasite Ajan:</span>
                  <span className="text-slate-900">{currentInput.toLocaleString()} HTG</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                  <span>Frè Aktivasyon (7 HTG / 1000 HTG):</span>
                  <span className="text-rose-600">+{calculatedFee.toLocaleString()} HTG</span>
                </div>
                <div className="h-px bg-gray-200 w-full my-2"></div>
                <div className="flex justify-between items-center text-sm font-black text-slate-900">
                  <span>Total K ap Soti sou Wallet Ou:</span>
                  <span className={profile.wallet_balance >= totalWithFee ? 'text-emerald-600' : 'text-rose-600'}>{totalWithFee.toLocaleString()} HTG</span>
                </div>
                {profile.wallet_balance < totalWithFee && (
                  <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-2">Ou pa gen ase kòb sou Wallet ou pou sa.</p>
                )}
              </div>
            )}

            <button onClick={submitApplication} disabled={actionLoading || !activationAmount || currentInput <= 0 || profile.wallet_balance < totalWithFee} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:bg-slate-300">
              {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Sove Dokiman & Peye'}
            </button>
            <p className="text-[10px] text-center font-bold text-slate-400 mt-4 uppercase tracking-wider">Apre w fin peye, w ap tann 1 a 3 jou ouvrab.</p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: DASHBOARD POU AJAN KI APWOUVE YO
  // ==========================================
  if (appStep === 'dashboard') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8 font-sans pb-24">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
             <div className="flex items-center gap-4">
               <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-sm"><Store size={24} /></div>
               <div>
                 <h1 className="text-xl font-bold tracking-tight text-slate-900">Pòtay Ajan Hatexcard</h1>
                 <div className="flex items-center gap-2 mt-1">
                   <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                   <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Ajan {profile?.agent_tier?.toUpperCase() || ''} Sètifye</span>
                 </div>
               </div>
             </div>
             
             <div className="bg-slate-50 border border-gray-200 px-5 py-3 rounded-2xl flex items-center gap-4 w-full md:w-auto">
               <div>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kòd 8-Chif Ajan w lan</p>
                 <p className="text-lg font-mono font-bold text-indigo-700 tracking-widest">{profile?.agent_code || 'AP CHÈCHE...'}</p>
               </div>
             </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-6">
             <div className="lg:col-span-5 space-y-6">
                <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-md relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck size={100} /></div>
                   <div className="relative z-10">
                     <div className="flex justify-between items-start mb-4">
                       <div>
                         <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Balans pou Fè Depo</p>
                         <h2 className="text-4xl font-bold tracking-tight mb-1">{Number(profile?.agent_balance || 0).toLocaleString()} <span className="text-lg text-indigo-200">HTG</span></h2>
                       </div>
                     </div>
                     <div className="bg-indigo-500/50 border border-indigo-400/50 p-4 rounded-xl mt-4">
                       <div className="flex justify-between items-center text-xs font-semibold text-indigo-50">
                         <span>Kapasite kont ou:</span>
                         <span className="font-bold text-white">{Number(profile?.agent_capacity || 0).toLocaleString()} HTG</span>
                       </div>
                       {(profile?.agent_capacity || 0) < (profile?.agent_tier === 'premium' ? 110000 : 40000) && (
                         <div className="mt-4 pt-4 border-t border-indigo-400/30">
                            <p className="text-[10px] uppercase font-bold text-indigo-200 mb-2 tracking-wider">Ogmante Kapasite w (Fè Vèsman)</p>
                            <div className="flex gap-2">
                              <input type="number" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} placeholder="Montan HTG" className="w-full bg-indigo-900/30 border border-indigo-400/30 py-2.5 px-3 rounded-lg text-sm font-bold outline-none text-white placeholder:text-indigo-300/50" />
                              <button onClick={makeInstallmentPayment} disabled={actionLoading} className="bg-white text-indigo-600 px-4 py-2.5 rounded-lg font-bold text-xs uppercase shadow-sm disabled:opacity-50 hover:bg-slate-50 transition-colors whitespace-nowrap">
                                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : 'Peye'}
                              </button>
                            </div>
                            <p className="text-[9px] text-indigo-200 mt-2 font-medium">Frè aktivasyon: 7 HTG pou chak 1000 HTG ap ajoute otomatikman.</p>
                         </div>
                       )}
                     </div>
                   </div>
                </div>

                <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-3xl shadow-sm">
                   <div className="flex items-center gap-3 mb-6"><div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg border border-emerald-100"><ArrowDownToLine size={20} /></div><div><h3 className="text-lg font-bold text-slate-900">Fè yon Depo pou Kliyan</h3><p className="text-xs font-medium text-slate-500">Transfere soti nan balans ajan w lan.</p></div></div>
                   <form onSubmit={handleAgentDeposit} className="space-y-5">
                     <div><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Imèl Kliyan an</label><div className="relative"><UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="email" value={depositEmail} onChange={(e) => setDepositEmail(e.target.value)} placeholder="kliyan@email.com" className="w-full bg-slate-50 border border-gray-200 py-3.5 pl-12 pr-4 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 transition-all text-slate-900" required /></div></div>
                     <div><label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Montan (HTG)</label><div className="relative"><Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-50 border border-gray-200 py-3.5 pl-12 pr-4 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 transition-all text-slate-900" required /></div></div>
                     {statusMsg.text && (<div className={`p-4 rounded-xl flex items-start gap-3 border ${statusMsg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}><p className="text-[11px] font-bold uppercase tracking-wider leading-relaxed">{statusMsg.text}</p></div>)}
                     <button type="submit" disabled={actionLoading} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50">{actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Voye Depo a bay Kliyan an'}</button>
                   </form>
                </div>
             </div>

             <div className="lg:col-span-7">
                <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden h-full">
                   <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between"><div><h3 className="text-lg font-bold text-slate-900">Istorik Ajan</h3><p className="text-xs text-slate-500 font-medium mt-0.5">Tout depo ak retrè ou jere yo</p></div><div className="bg-slate-50 p-2.5 rounded-xl border border-gray-200"><Search className="w-5 h-5 text-slate-400" /></div></div>
                   <div className="p-4 sm:p-6 md:p-8">
                      {agentTransactions.length === 0 ? (
                        <div className="text-center py-24 bg-slate-50 rounded-2xl border border-dashed border-gray-200"><FileText size={48} className="mx-auto text-slate-300 mb-4" /><p className="text-sm font-bold text-slate-500">Ou poko fè okenn tranzaksyon antanke ajan.</p></div>
                      ) : (
                        <div className="space-y-3">
                           {agentTransactions.map((tx) => (
                             <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-gray-100 bg-slate-50 hover:bg-white hover:shadow-sm transition-all shadow-sm">
                               <div className="flex items-center gap-4">
                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${tx.type === 'AGENT_WITHDRAWAL' ? 'bg-emerald-500' : tx.type === 'AGENT_GUARANTEE' ? 'bg-indigo-500' : 'bg-rose-500'}`}>{tx.type === 'AGENT_WITHDRAWAL' ? <ArrowUpFromLine size={20} /> : tx.type === 'AGENT_GUARANTEE' ? <Wallet size={20}/> : <ArrowDownToLine size={20} />}</div>
                                 <div>
                                   <p className="text-sm font-bold text-slate-900">{tx.metadata?.client_email || tx.description || 'Kliyan Hatex'}</p>
                                   <div className="flex items-center gap-2 mt-1">
                                     <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${tx.type === 'AGENT_WITHDRAWAL' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : tx.type === 'AGENT_GUARANTEE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>{tx.type === 'AGENT_WITHDRAWAL' ? 'Retrè Kliyan' : tx.type === 'AGENT_GUARANTEE' ? 'Depo Garanti' : 'Depo Kliyan'}</span>
                                     <span className="text-[10px] text-slate-400 font-medium">{new Date(tx.created_at).toLocaleDateString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</span>
                                   </div>
                                 </div>
                               </div>
                               <div className="text-right border-t sm:border-none border-gray-200 pt-3 sm:pt-0">
                                 <p className={`text-base font-bold ${tx.type === 'AGENT_WITHDRAWAL' ? 'text-emerald-600' : 'text-slate-900'}`}>{tx.type === 'AGENT_WITHDRAWAL' ? '+' : ''}{Math.abs(tx.amount).toLocaleString()} <span className="text-xs text-slate-500">HTG</span></p>
                               </div>
                             </div>
                           ))}
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}