"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Store, ShieldCheck, FileText, Wallet, Search, Loader2, CheckCircle2, 
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, UserCheck, 
  ArrowLeft, Building2, Briefcase, UploadCloud, CheckSquare, ChevronRight,
  RefreshCw, ArrowUpCircle, Filter, Calendar, Clock
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

  // Upgrade State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePatente, setUpgradePatente] = useState<File | null>(null);
  const [upgradeCif, setUpgradeCif] = useState<File | null>(null);

  // Lojik Peman & Rechaj
  const [activationAmount, setActivationAmount] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState('');
  
  // Dashboard Ajan
  const [depositEmail, setDepositEmail] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [agentTransactions, setAgentTransactions] = useState<any[]>([]);
  
  // Filtè Istorik
  const [historyFilter, setHistoryFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');

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
          .in('type', ['AGENT_DEPOSIT', 'AGENT_WITHDRAWAL', 'AGENT_GUARANTEE', 'AGENT_RECHARGE'])
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
  // SOUMÈT APLIKASYON (PREMYE FWA) - AK FRÈ
  // ==========================================
  const submitApplication = async () => {
    const amount = Number(activationAmount);
    if (amount <= 0) return alert("Kantite lajan an pa valab.");
    
    const fee = Math.floor((amount / 1000) * 7);
    const totalDeduction = amount + fee;

    if (profile.wallet_balance < totalDeduction) {
        return alert(`Ou pa gen ase kòb sou Wallet ou.\nOu bezwen ${amount} HTG + ${fee} HTG (Frè) = ${totalDeduction} HTG.`);
    }

    const requiredAmount = selectedTier === 'premium' ? 110000 : 40000;
    if (amount > requiredAmount) {
        return alert(`Kapasite maksimòm plan ${selectedTier} la se ${requiredAmount.toLocaleString()} HTG.`);
    }

    setActionLoading(true);
    try {
      const uploadFile = async (file: File, type: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `agent-${profile.id}-${type}-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('agent_documents').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('agent_documents').getPublicUrl(fileName);
        return data.publicUrl;
      };

      const idUrl = await uploadFile(idDoc!, 'id');
      const addressUrl = await uploadFile(addressDoc!, 'address');
      const locationUrl = await uploadFile(locationPhoto!, 'location');
      const patenteUrl = selectedTier === 'premium' && patenteDoc ? await uploadFile(patenteDoc, 'patente') : null;
      const cifUrl = selectedTier === 'premium' && cifDoc ? await uploadFile(cifDoc, 'cif') : null;

      const newWalletBal = Number(profile.wallet_balance) - totalDeduction;
      
      await supabase.from('profiles').update({ 
        wallet_balance: newWalletBal,
        agent_balance: amount,
        agent_capacity: amount,
        agent_guarantee_paid: amount,
        agent_status: 'pending', 
        agent_tier: selectedTier 
      }).eq('id', profile.id);

      await supabase.from('transactions').insert([
          { user_id: profile.id, type: 'AGENT_GUARANTEE', amount: -amount, status: 'success', description: `Aktivasyon Ajan ${selectedTier?.toUpperCase() || ''}` },
          { user_id: profile.id, type: 'FEE', amount: -fee, status: 'success', description: `Frè aktivasyon Ajan (7 HTG / 1000 HTG)` }
      ]);

      await supabase.from('agent_applications').insert([{
        user_id: profile.id,
        tier: selectedTier,
        status: 'pending',
        application_type: 'new',
        id_doc_url: idUrl,
        address_doc_url: addressUrl,
        location_photo_url: locationUrl,
        patente_url: patenteUrl,
        cif_url: cifUrl,
        metadata: { initial_deposit: amount, fee_paid: fee }
      }]);

      fetchAgentData();
    } catch (err: any) { alert("Erè: " + err.message); } finally { setActionLoading(false); }
  };

  const restartApplication = async () => {
    setActionLoading(true);
    await supabase.from('profiles').update({ agent_status: 'none', upgrade_status: 'none' }).eq('id', profile.id);
    setAppStep('tier_select');
    setActionLoading(false);
  };

  // ==========================================
  // RECHAJE BALANS AJAN SAN FRÈ
  // ==========================================
  const handleRechargeBalance = async () => {
    const amount = Number(rechargeAmount);
    const maxAllowed = Number(profile.agent_capacity) - Number(profile.agent_balance);
    
    if (amount <= 0) return alert("Kantite a pa valab.");
    if (amount > maxAllowed) return alert(`Ou gen dwa rechaje sèlman maksimòm ${maxAllowed.toLocaleString()} HTG pou w rive nan kapasite w.`);
    if (amount > profile.wallet_balance) return alert("Ou pa gen ase kòb sou balans Wallet ou pou w fè rechaj sa a.");

    setActionLoading(true);
    try {
      const newWalletBal = Number(profile.wallet_balance) - amount;
      const newAgentBal = Number(profile.agent_balance) + amount;

      await supabase.from('profiles').update({ 
        wallet_balance: newWalletBal,
        agent_balance: newAgentBal
      }).eq('id', profile.id);

      await supabase.from('transactions').insert([
          { user_id: profile.id, type: 'AGENT_RECHARGE', amount: amount, status: 'success', description: `Rechaj balans ajan san frè` },
          { user_id: profile.id, type: 'WITHDRAWAL', amount: -amount, status: 'success', description: `Retrè pou rechaje kont ajan` }
      ]);

      alert(`Ou rechaje kont ajan w lan ak ${amount.toLocaleString()} HTG ak siksè!`);
      setRechargeAmount('');
      fetchAgentData();
    } catch (err: any) { alert(err.message); } finally { setActionLoading(false); }
  };

  // ==========================================
  // OGMANTE KAPASITE (VÈSMAN AK FRÈ 7HTG)
  // ==========================================
  const makeInstallmentPayment = async () => {
    const amount = Number(installmentAmount);
    if (amount <= 0) return alert("Kantite a pa valab.");
    
    const fee = Math.floor((amount / 1000) * 7);
    const totalDeduction = amount + fee;

    if (profile.wallet_balance < totalDeduction) return alert(`Ou bezwen ${totalDeduction.toLocaleString()} HTG sou balans prensipal ou (Kòb + Frè).`);

    const requiredAmount = profile.agent_tier === 'premium' ? 110000 : 40000;
    const remaining = requiredAmount - (profile.agent_guarantee_paid || 0);

    if (amount > remaining) return alert(`Ou kapab ajoute maksimòm ${remaining.toLocaleString()} HTG sèlman pou kapasite a.`);

    setActionLoading(true);
    try {
      const newWalletBal = profile.wallet_balance - totalDeduction;
      const newGuaranteePaid = (profile.agent_guarantee_paid || 0) + amount;
      const newCapacity = (profile.agent_capacity || 0) + amount;
      const newAgentBalance = (profile.agent_balance || 0) + amount;

      await supabase.from('profiles').update({ 
        wallet_balance: newWalletBal,
        agent_guarantee_paid: newGuaranteePaid,
        agent_capacity: newCapacity,
        agent_balance: newAgentBalance
      }).eq('id', profile.id);

      await supabase.from('transactions').insert([
          { user_id: profile.id, type: 'AGENT_GUARANTEE', amount: -amount, status: 'success', description: `Ogmante kapasite ajan` },
          { user_id: profile.id, type: 'FEE', amount: -fee, status: 'success', description: `Frè ogmantasyon kapasite (7/1000 HTG)` }
      ]);

      alert(`Kapasite w ogmante ak siksè!`);
      setInstallmentAmount('');
      fetchAgentData();
    } catch (err: any) { alert(err.message); } finally { setActionLoading(false); }
  };

  // ==========================================
  // UPGRADE NAN PREMIUM
  // ==========================================
  const handleUpgradeToPremium = async () => {
    if (profile.wallet_balance < 10000) {
       return alert("Ou dwe genyen plis pase 10,000 HTG sou Wallet Balans ou pou w kalifye pou pase nan nivo PREMIUM.");
    }
    if (!upgradePatente || !upgradeCif) {
       return alert("Patant ak CIF obligatwa pou ajan Premium.");
    }

    setActionLoading(true);
    try {
      const uploadFile = async (file: File, type: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `agent-${profile.id}-${type}-${Date.now()}.${fileExt}`;
        await supabase.storage.from('agent_documents').upload(fileName, file);
        const { data } = supabase.storage.from('agent_documents').getPublicUrl(fileName);
        return data.publicUrl;
      };

      const patUrl = await uploadFile(upgradePatente, 'patente_upg');
      const cifUrl = await uploadFile(upgradeCif, 'cif_upg');

      await supabase.from('agent_applications').insert([{
        user_id: profile.id,
        tier: 'premium',
        status: 'pending',
        application_type: 'upgrade',
        patente_url: patUrl,
        cif_url: cifUrl
      }]);

      await supabase.from('profiles').update({ upgrade_status: 'pending' }).eq('id', profile.id);

      alert("Demann pou pase PREMIUM nan soumèt ak siksè! Admin nan ap verifye l.");
      setShowUpgradeModal(false);
      fetchAgentData();
    } catch (err: any) { alert(err.message); } finally { setActionLoading(false); }
  };

  // ==========================================
  // FÈ DEPO POU KLIYAN
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

  // ==========================================
  // FILTRASYON ISTORIK
  // ==========================================
  const filteredTransactions = agentTransactions.filter(tx => {
    if (historyFilter === 'all') return true;
    const txDate = new Date(tx.created_at);
    const now = new Date();
    if (historyFilter === 'today') return txDate.toDateString() === now.toDateString();
    if (historyFilter === 'week') {
       const weekAgo = new Date(now.setDate(now.getDate() - 7));
       return txDate >= weekAgo;
    }
    if (historyFilter === 'month') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
    if (historyFilter === 'year') return txDate.getFullYear() === now.getFullYear();
    return true;
  });

  if (appStep === 'loading') return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>;

  if (appStep === 'kyc_denied') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="bg-white p-8 rounded-3xl text-center max-w-md w-full shadow-sm"><ShieldCheck size={40} className="text-amber-500 mx-auto mb-4" /><h2 className="text-2xl font-bold mb-3">Verifikasyon Obligatwa</h2><p className="text-sm text-slate-500 mb-8">Pase KYC w anvan w ka aplike kòm ajan.</p><button onClick={() => router.push('/dashboard')} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-xs uppercase transition-all shadow-sm">Dashboard</button></div></div>
  );

  if (appStep === 'rejected') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="bg-white p-8 rounded-3xl text-center max-w-md w-full shadow-sm"><AlertTriangle size={60} className="text-rose-500 mx-auto mb-4" /><h2 className="text-xl font-bold mb-3">Aplikasyon Rejte</h2><p className="text-sm text-slate-500 mb-8">Admin nan rejte dokiman yo. Lajan w lan te ranbouse.</p><button onClick={restartApplication} disabled={actionLoading} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-xs uppercase shadow-sm flex justify-center">{actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Rekòmanse Aplikasyon an'}</button></div></div>
  );

  if (appStep === 'pending') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="bg-white p-8 sm:p-10 rounded-3xl shadow-sm text-center max-w-lg w-full"><Store size={40} className="text-indigo-600 mx-auto mb-4" /><h2 className="text-2xl font-bold mb-4">Verifikasyon ankou...</h2><p className="text-sm text-slate-600 mb-6">Ekip Admin nan ap verifye dokiman w yo. Sa pran 1 a 3 jou ouvrab.</p><button onClick={() => router.push('/dashboard')} className="w-full bg-slate-100 text-slate-700 py-4 rounded-xl font-bold text-xs uppercase shadow-sm">Dashboard</button></div></div>
  );

  if (appStep === 'tier_select') return (
    <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center pt-12"><div className="text-center mb-10"><Store size={32} className="text-indigo-600 mx-auto mb-4" /><h1 className="text-3xl font-bold text-slate-900">Vin Ajan Hatexcard</h1></div><div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full"><div className="bg-white p-8 rounded-3xl shadow-sm flex flex-col hover:border-indigo-300 transition-all border border-gray-200"><h2 className="text-2xl font-bold mb-4">Ajan PRO</h2><div className="text-3xl font-bold mb-6">40,000 <span className="text-sm text-slate-500">HTG</span></div><button onClick={() => { setSelectedTier('pro'); setAppStep('upload_docs'); }} className="w-full bg-indigo-50 text-indigo-700 py-4 rounded-xl font-bold text-xs uppercase">Chwazi PRO</button></div><div className="bg-slate-900 p-8 rounded-3xl shadow-xl flex flex-col border border-slate-800"><h2 className="text-2xl font-bold text-white mb-4">Ajan PREMIUM</h2><div className="text-3xl font-bold text-white mb-6">110,000 <span className="text-sm text-slate-400">HTG</span></div><button onClick={() => { setSelectedTier('premium'); setAppStep('upload_docs'); }} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-xs uppercase">Chwazi PREMIUM</button></div></div></div>
  );

  if (appStep === 'upload_docs') return (
    <div className="min-h-screen bg-slate-50 p-6"><div className="max-w-2xl mx-auto"><button onClick={() => setAppStep('tier_select')} className="flex items-center gap-2 text-slate-500 mb-6 font-bold text-xs"><ArrowLeft size={16} /> Tounen</button><div className="bg-white p-8 rounded-3xl shadow-sm"><h2 className="text-2xl font-bold mb-8">Dokiman {selectedTier?.toUpperCase()}</h2><div className="space-y-6"><div><label className="block text-xs font-bold mb-2">Pyès Idantite *</label><input type="file" onChange={(e) => setIdDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" /></div><div><label className="block text-xs font-bold mb-2">Prèv Adrès *</label><input type="file" onChange={(e) => setAddressDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" /></div><div><label className="block text-xs font-bold mb-2">Foto Lokal La *</label><input type="file" onChange={(e) => setLocationPhoto(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-xl text-sm border" /></div>{selectedTier === 'premium' && (<><div className="pt-4"><label className="block text-xs font-bold text-indigo-600 mb-2">Patant Biznis la *</label><input type="file" onChange={(e) => setPatenteDoc(e.target.files?.[0] || null)} className="w-full bg-indigo-50 p-3 rounded-xl text-sm border border-indigo-100" /></div><div><label className="block text-xs font-bold text-indigo-600 mb-2">CIF Biznis la *</label><input type="file" onChange={(e) => setCifDoc(e.target.files?.[0] || null)} className="w-full bg-indigo-50 p-3 rounded-xl text-sm border border-indigo-100" /></div></>)}</div><button onClick={handleDocsNext} className="w-full mt-10 bg-slate-900 text-white py-4 rounded-xl font-bold text-xs uppercase flex justify-center gap-2">Kontinye <ChevronRight size={16} /></button></div></div></div>
  );

  if (appStep === 'payment_plan') {
    const requiredAmount = selectedTier === 'premium' ? 110000 : 40000;
    const currentInput = Number(activationAmount);
    const calculatedFee = Math.floor((currentInput / 1000) * 7);
    const totalWithFee = currentInput + calculatedFee;

    return (
      <div className="min-h-screen bg-slate-50 p-6"><div className="max-w-2xl mx-auto"><button onClick={() => setAppStep('upload_docs')} className="flex items-center gap-2 text-slate-500 mb-6 font-bold text-xs"><ArrowLeft size={16} /> Tounen</button><div className="bg-white p-8 rounded-3xl shadow-sm"><h2 className="text-2xl font-bold mb-8">Peman Aktivasyon</h2><div className="mb-8"><label className="block text-xs font-bold mb-2">Montan w ap peye a (HTG)</label><input type="number" value={activationAmount} onChange={(e) => setActivationAmount(e.target.value)} placeholder="0" className="w-full bg-slate-50 p-4 rounded-xl text-lg font-bold border" /></div>{currentInput > 0 && (<div className="bg-slate-50 p-5 rounded-xl border mb-8"><div className="flex justify-between text-xs font-bold mb-2"><span>Frè (7 HTG / 1000 HTG):</span><span className="text-rose-600">+{calculatedFee} HTG</span></div><div className="flex justify-between text-sm font-black border-t pt-2 mt-2"><span>Total k ap soti a:</span><span>{totalWithFee} HTG</span></div></div>)}<button onClick={submitApplication} disabled={actionLoading || currentInput <= 0} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-xs uppercase flex justify-center">{actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Sove Dokiman & Peye'}</button></div></div></div>
    );
  }

  if (appStep === 'dashboard') {
    const isPremium = profile?.agent_tier === 'premium';
    const capacity = Number(profile?.agent_capacity || 0);
    const maxAllowedTier = isPremium ? 110000 : 40000;

    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans pb-24 relative">
        
        {/* MODAL UPGRADE PREMIUM */}
        {showUpgradeModal && (
           <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-white border border-gray-200 p-8 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-200">
               <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ArrowUpCircle className="text-indigo-600" /> Pase nan PREMIUM</h2>
               <p className="text-xs text-slate-500 mb-6">Pou w pase Premium, ou dwe gen 10,000 HTG sou Wallet ou, epi soumèt Patant ak CIF ou a.</p>
               <div className="space-y-4 mb-8">
                 <div><label className="block text-xs font-bold mb-2 text-indigo-600">Patant Biznis la *</label><input type="file" onChange={(e) => setUpgradePatente(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-lg border text-sm" /></div>
                 <div><label className="block text-xs font-bold mb-2 text-indigo-600">CIF Biznis la *</label><input type="file" onChange={(e) => setUpgradeCif(e.target.files?.[0] || null)} className="w-full bg-slate-50 p-3 rounded-lg border text-sm" /></div>
               </div>
               <div className="flex gap-3">
                 <button onClick={() => setShowUpgradeModal(false)} className="flex-1 py-3 rounded-xl border text-xs font-bold uppercase">Anile</button>
                 <button onClick={handleUpgradeToPremium} disabled={actionLoading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-xs font-bold uppercase flex justify-center items-center">{actionLoading ? <Loader2 size={16} className="animate-spin" /> : 'Soumèt'}</button>
               </div>
             </div>
           </div>
        )}

        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border shadow-sm">
             <div className="flex items-center gap-4">
               <div className="bg-indigo-600 text-white p-3 rounded-xl"><Store size={24} /></div>
               <div>
                 <h1 className="text-xl font-bold">Pòtay Ajan Hatexcard</h1>
                 <span className="text-[10px] text-emerald-600 font-bold uppercase">Ajan {profile?.agent_tier?.toUpperCase() || ''} Sètifye</span>
               </div>
             </div>
             <div className="bg-slate-50 px-5 py-3 rounded-2xl flex items-center gap-4 w-full md:w-auto border">
               <div><p className="text-[9px] text-slate-400 font-bold uppercase">Kòd Ajan w lan</p><p className="text-lg font-mono font-bold text-indigo-700">{profile?.agent_code}</p></div>
             </div>
          </div>

          {/* MESAJ SI L AP TANN YON UPGRADE */}
          {profile?.upgrade_status === 'pending' && (
             <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 shadow-sm">
                <Clock className="text-amber-500 animate-pulse" size={24} />
                <div>
                   <p className="text-sm font-bold text-amber-800">Verifikasyon Upgrade PREMIUM nan ankou...</p>
                   <p className="text-xs text-amber-700">Dokiman w yo ap tcheke pa yon Admin. Nap mete w a jou nan 1 a 3 jou ouvran.</p>
                </div>
             </div>
          )}

          <div className="grid lg:grid-cols-12 gap-6">
             <div className="lg:col-span-5 space-y-6">
                
                {/* BLÒK BALANS LA */}
                <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-md relative overflow-hidden">
                   <div className="relative z-10">
                     <p className="text-[10px] font-bold uppercase text-indigo-200 mb-1">Balans pou Fè Depo</p>
                     <h2 className="text-4xl font-bold mb-1">{Number(profile?.agent_balance || 0).toLocaleString()} <span className="text-lg text-indigo-200">HTG</span></h2>
                     
                     <div className="bg-indigo-500/50 p-4 rounded-xl mt-4 space-y-4">
                       <div className="flex justify-between items-center text-xs font-semibold">
                         <span>Kapasite Maksimòm Ou:</span><span className="font-bold">{capacity.toLocaleString()} HTG</span>
                       </div>

                       {/* BOUTON UPGRADE (SI L SE PRO) */}
                       {!isPremium && profile?.upgrade_status !== 'pending' && (
                          <button onClick={() => setShowUpgradeModal(true)} className="w-full bg-white text-indigo-700 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex justify-center items-center gap-2 shadow-sm">
                             <ArrowUpCircle size={14} /> Pase nan Premium kounye a
                          </button>
                       )}
                       
                       {/* OGMANTE KAPASITE (Peye Frè) */}
                       {capacity < maxAllowedTier && (
                         <div className="pt-4 border-t border-indigo-400/30">
                            <p className="text-[10px] uppercase font-bold text-indigo-200 mb-2">Ogmante Kapasite (Avèk Frè 7/1000)</p>
                            <div className="flex gap-2">
                              <input type="number" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} placeholder="0" className="w-full bg-indigo-900/30 border border-indigo-400/30 p-2 rounded-lg text-sm text-white" />
                              <button onClick={makeInstallmentPayment} disabled={actionLoading} className="bg-white text-indigo-600 px-4 rounded-lg font-bold text-xs uppercase">{actionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Peye'}</button>
                            </div>
                         </div>
                       )}
                     </div>
                   </div>
                </div>

                {/* RECHAJE BALANS SAN FRÈ */}
                <div className="bg-white p-6 rounded-3xl border shadow-sm">
                   <div className="flex items-center gap-3 mb-4"><div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><RefreshCw size={20} /></div><h3 className="font-bold text-slate-900">Rechaje Kont Ajan (San Frè)</h3></div>
                   <p className="text-xs text-slate-500 mb-4">Pran kòb sou Wallet ou pou w ranpli balans Ajan w lan (Jiska limit kapasite w).</p>
                   <div className="flex gap-2">
                      <input type="number" value={rechargeAmount} onChange={(e) => setRechargeAmount(e.target.value)} placeholder="Montan HTG" className="w-full bg-slate-50 border p-3 rounded-xl text-sm font-bold" />
                      <button onClick={handleRechargeBalance} disabled={actionLoading || !rechargeAmount} className="bg-slate-900 text-white px-5 rounded-xl font-bold text-xs uppercase whitespace-nowrap">{actionLoading ? <Loader2 size={16} className="animate-spin" /> : 'Rechaje'}</button>
                   </div>
                </div>

                {/* FÒM DEPO */}
                <div className="bg-white border p-6 rounded-3xl shadow-sm">
                   <div className="flex items-center gap-3 mb-6"><div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg"><ArrowDownToLine size={20} /></div><h3 className="font-bold text-slate-900">Voye Depo bay Kliyan</h3></div>
                   <form onSubmit={handleAgentDeposit} className="space-y-4">
                     <input type="email" value={depositEmail} onChange={(e) => setDepositEmail(e.target.value)} placeholder="Imèl kliyan an" className="w-full bg-slate-50 border p-3.5 rounded-xl text-sm font-medium" required />
                     <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Montan (HTG)" className="w-full bg-slate-50 border p-3.5 rounded-xl text-lg font-bold" required />
                     {statusMsg.text && (<div className={`p-3 rounded-lg text-xs font-bold uppercase ${statusMsg.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{statusMsg.text}</div>)}
                     <button type="submit" disabled={actionLoading} className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold uppercase text-xs">Voye Depo a</button>
                   </form>
                </div>
             </div>

             {/* ISTORIK LA AK FILTÈ */}
             <div className="lg:col-span-7">
                <div className="bg-white border rounded-3xl shadow-sm overflow-hidden h-full flex flex-col">
                   <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div><h3 className="text-lg font-bold">Istorik Ajan</h3><p className="text-xs text-slate-500">Tout sa w fè nan jounen / semèn / mwa a</p></div>
                      
                      {/* FILTÈ YO */}
                      <div className="flex flex-wrap gap-2">
                         <button onClick={() => setHistoryFilter('today')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${historyFilter === 'today' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Jodi a</button>
                         <button onClick={() => setHistoryFilter('week')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${historyFilter === 'week' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Semèn sa</button>
                         <button onClick={() => setHistoryFilter('month')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${historyFilter === 'month' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Mwa sa</button>
                         <button onClick={() => setHistoryFilter('all')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${historyFilter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Tout</button>
                      </div>
                   </div>

                   <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                      {filteredTransactions.length === 0 ? (
                        <div className="text-center py-20"><FileText size={40} className="mx-auto text-slate-300 mb-4" /><p className="text-sm font-bold text-slate-500">Pa gen tranzaksyon nan peryòd sa a.</p></div>
                      ) : (
                        <div className="space-y-3">
                           {filteredTransactions.map((tx) => (
                             <div key={tx.id} className="flex justify-between items-center p-4 rounded-2xl border bg-slate-50 shadow-sm">
                               <div className="flex items-center gap-4">
                                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 ${tx.type === 'AGENT_WITHDRAWAL' ? 'bg-emerald-500' : tx.type === 'AGENT_RECHARGE' ? 'bg-blue-500' : tx.type === 'AGENT_GUARANTEE' ? 'bg-indigo-500' : 'bg-rose-500'}`}>
                                    {tx.type === 'AGENT_WITHDRAWAL' ? <ArrowUpFromLine size={18} /> : tx.type === 'AGENT_RECHARGE' ? <RefreshCw size={18}/> : tx.type === 'AGENT_GUARANTEE' ? <Wallet size={18}/> : <ArrowDownToLine size={18} />}
                                 </div>
                                 <div>
                                   <p className="text-sm font-bold">{tx.metadata?.client_email || tx.description}</p>
                                   <div className="flex items-center gap-2 mt-1">
                                     <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md bg-white border text-slate-500">{tx.type.replace('AGENT_', '')}</span>
                                     <span className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</span>
                                   </div>
                                 </div>
                               </div>
                               <p className={`text-base font-bold ${['AGENT_WITHDRAWAL', 'AGENT_RECHARGE'].includes(tx.type) ? 'text-emerald-600' : 'text-slate-900'}`}>{['AGENT_WITHDRAWAL', 'AGENT_RECHARGE'].includes(tx.type) ? '+' : ''}{Math.abs(tx.amount).toLocaleString()} <span className="text-xs">HTG</span></p>
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