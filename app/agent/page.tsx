"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Store, ShieldCheck, FileText, Wallet, Search, Loader2, CheckCircle2, 
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, UserCheck, 
  ArrowLeft, Building2, Briefcase, UploadCloud, ChevronRight, CheckSquare
} from 'lucide-react';

export default function AgentPortal() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Etap Aplikasyon yo
  const [appStep, setAppStep] = useState<'check' | 'tier_select' | 'upload_docs' | 'installment' | 'dashboard'>('check');
  const [selectedTier, setSelectedTier] = useState<'pro' | 'premium' | null>(null);
  
  // Fichye Dokiman yo
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [addressDoc, setAddressDoc] = useState<File | null>(null);
  const [locationPhoto, setLocationPhoto] = useState<File | null>(null);
  const [patenteDoc, setPatenteDoc] = useState<File | null>(null);
  const [cifDoc, setCifDoc] = useState<File | null>(null);

  // Vèsman
  const [installmentAmount, setInstallmentAmount] = useState('');

  // Fòm Depo Ajan
  const [depositEmail, setDepositEmail] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [agentTransactions, setAgentTransactions] = useState<any[]>([]);

  useEffect(() => {
    fetchAgentData();
  }, [supabase, router]);

  const fetchAgentData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof) {
      setProfile(prof);
      
      // Detèmine nan ki etap li ye
      if (prof.kyc_status !== 'approved' || !prof.card_active) {
        setAppStep('check');
      } else if (prof.agent_status === 'none') {
        setAppStep('tier_select');
      } else if (prof.agent_status === 'pending') {
        setAppStep('installment');
      } else if (prof.agent_status === 'approved') {
        setAppStep('dashboard');
        // Rale istorik si l apwouve
        const { data: txs } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .in('type', ['AGENT_DEPOSIT', 'AGENT_WITHDRAWAL'])
          .order('created_at', { ascending: false });
        if (txs) setAgentTransactions(txs);
      }
    }
    setLoading(false);
  };

  // ==========================================
  // SOUMÈT DOKIMAN YO
  // ==========================================
  const submitApplication = async () => {
    if (!idDoc || !addressDoc || !locationPhoto) return alert("Pyès idantite, prèv adrès ak foto lokal la obligatwa.");
    if (selectedTier === 'premium' && (!patenteDoc || !cifDoc)) return alert("Patant ak CIF obligatwa pou ajan Premium.");

    setActionLoading(true);
    try {
      // 1. Upload fonksyon èd
      const uploadFile = async (file: File, type: string) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile.id}-${type}-${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('agent_documents').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('agent_documents').getPublicUrl(fileName);
        return data.publicUrl;
      };

      // 2. Upload tout dokiman yo
      const idUrl = await uploadFile(idDoc, 'id');
      const addressUrl = await uploadFile(addressDoc, 'address');
      const locationUrl = await uploadFile(locationPhoto, 'location');
      const patenteUrl = selectedTier === 'premium' && patenteDoc ? await uploadFile(patenteDoc, 'patente') : null;
      const cifUrl = selectedTier === 'premium' && cifDoc ? await uploadFile(cifDoc, 'cif') : null;

      // 3. Ekri nan tab aplikasyon an
      await supabase.from('agent_applications').insert([{
        user_id: profile.id,
        tier: selectedTier,
        id_doc_url: idUrl,
        address_doc_url: addressUrl,
        location_photo_url: locationUrl,
        patente_url: patenteUrl,
        cif_url: cifUrl
      }]);

      // 4. Mizajou pwofil la
      await supabase.from('profiles').update({ 
        agent_status: 'pending', 
        agent_tier: selectedTier 
      }).eq('id', profile.id);

      alert("Dokiman ou yo soumèt avèk siksè! Kounye a ou ka fè premye vèsman garanti w la.");
      fetchAgentData();
    } catch (err: any) {
      alert("Erè nan telechaje dokiman yo: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // FÈ VÈSMAN GARANTI
  // ==========================================
  const makeInstallmentPayment = async () => {
    const amount = Number(installmentAmount);
    if (amount <= 0) return alert("Kantite a pa valab.");
    if (profile.wallet_balance < amount) return alert("Ou pa gen ase kòb sou balans prensipal ou pou vèsman sa a.");

    const requiredAmount = profile.agent_tier === 'premium' ? 110000 : 40000;
    const remaining = requiredAmount - profile.agent_guarantee_paid;

    if (amount > remaining) return alert(`Ou gen sèlman ${remaining.toLocaleString()} HTG pou w fin peye garanti a.`);

    setActionLoading(true);
    try {
      const newWalletBal = profile.wallet_balance - amount;
      const newGuaranteePaid = profile.agent_guarantee_paid + amount;
      const newCapacity = newGuaranteePaid; // Kapasite l ap moute chak fwa l peye

      const { error } = await supabase.from('profiles').update({ 
        wallet_balance: newWalletBal,
        agent_guarantee_paid: newGuaranteePaid,
        agent_capacity: newCapacity,
        // Si l fin peye total la epi dokiman l yo tcheke (nou verifye l manyèlman, men isit n ap rann li disponib pou demontre)
      }).eq('id', profile.id);

      if (error) throw error;

      await supabase.from('transactions').insert([{
        user_id: profile.id,
        type: 'AGENT_GUARANTEE',
        amount: -amount,
        status: 'success',
        description: `Vèsman garanti Ajan ${profile.agent_tier.toUpperCase()}`
      }]);

      alert(`Vèsman ${amount.toLocaleString()} HTG pase ak siksè! Kapasite Ajan ou ogmante.`);
      setInstallmentAmount('');
      fetchAgentData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
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
      const { data: currentAgent, error: agentErr } = await supabase.from('profiles').select('account_status, agent_status, agent_balance, agent_capacity').eq('id', profile.id).single();

      if (agentErr || !currentAgent) throw new Error("Erè verifikasyon ajan.");
      if (currentAgent.account_status === 'suspended') throw new Error("Kont ou a sispandi.");
      if (currentAgent.agent_balance < amountNum) throw new Error("Ou pa gen ase kòb sou balans Ajan w lan.");

      const { data: client, error: clientErr } = await supabase.from('profiles').select('id, wallet_balance, account_status, full_name').eq('email', depositEmail.toLowerCase().trim()).single();

      if (clientErr || !client) throw new Error("Pa jwenn itilizatè sa a.");
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
        { user_id: profile.id, type: 'AGENT_DEPOSIT', amount: -amountNum, status: 'success', description: `Depo pou ${client.full_name}` },
        { user_id: client.id, type: 'DEPOSIT', amount: amountNum, status: 'success', description: `Soti nan Ajan: ${profile.agent_code}` }
      ]);

      setStatusMsg({ type: 'success', text: `Depo ${amountNum} HTG reyisi pou ${client.full_name}!` });
      setDepositAmount(''); setDepositEmail('');
      fetchAgentData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-10 h-10" /></div>;

  // ==========================================
  // RENDER: BLOKE SI L POKO VERIFYE OSWA POKO GEN KAT
  // ==========================================
  if (appStep === 'check') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6 font-sans">
        <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm text-center max-w-md w-full">
          <AlertTriangle size={48} className="text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">Aksè Refize</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Ou dwe genyen yon idantite ki verifye (KYC Apwouve) e ou dwe aktive Kat Vityèl ou anvan ou ka louvri yon kont Ajan sou platfòm nan.
          </p>
          <div className="space-y-3">
            <button onClick={() => router.push('/dashboard')} className="w-full bg-slate-100 text-slate-700 hover:bg-slate-200 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm">Retounen nan Akèy</button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: CHWAZI NIVO AJAN AN
  // ==========================================
  if (appStep === 'tier_select') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans flex flex-col items-center pt-12">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100">
            <Store size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vin Ajan Hatexcard</h1>
          <p className="text-slate-500 text-sm mt-2 max-w-lg mx-auto">Chwazi nivo ki koresponn ak gwosè biznis ou an pou w kòmanse fè pwofi nan kominote w la.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl w-full">
          {/* TIER PRO */}
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col hover:border-indigo-300 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-4">
              <Briefcase className="text-indigo-600" size={28} />
              <h2 className="text-2xl font-bold">Ajan PRO</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">Pafè pou mwayen biznis kap chache ajoute yon revni siplemantè.</p>
            <div className="text-3xl font-bold text-slate-900 mb-6">40,000 <span className="text-sm text-slate-500 uppercase">HTG</span></div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CheckCircle2 size={16} className="text-emerald-500" /> Kapasite Maksimòm: 40,000 HTG</li>
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CheckCircle2 size={16} className="text-emerald-500" /> Kat Idantite & Prèv Adrès sèlman</li>
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CheckCircle2 size={16} className="text-emerald-500" /> Peye nan 3 vèsman</li>
            </ul>
            <button onClick={() => { setSelectedTier('pro'); setAppStep('upload_docs'); }} className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all">Chwazi PRO</button>
          </div>

          {/* TIER PREMIUM */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Rekòmande</div>
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="text-indigo-400" size={28} />
              <h2 className="text-2xl font-bold text-white">Ajan PREMIUM</h2>
            </div>
            <p className="text-sm text-slate-400 mb-6">Pou gwo biznis ki gen anpil mouvman kach ak tranzaksyon.</p>
            <div className="text-3xl font-bold text-white mb-6">110,000 <span className="text-sm text-slate-400 uppercase">HTG</span></div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-300"><CheckCircle2 size={16} className="text-indigo-400" /> Kapasite Maksimòm: 110,000 HTG</li>
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-300"><CheckCircle2 size={16} className="text-indigo-400" /> Mande Patant ak CIF biznis la</li>
              <li className="flex items-center gap-2 text-sm font-semibold text-slate-300"><CheckCircle2 size={16} className="text-indigo-400" /> Sipò Priyoritè 24/7</li>
            </ul>
            <button onClick={() => { setSelectedTier('premium'); setAppStep('upload_docs'); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-md border border-indigo-500">Chwazi PREMIUM</button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: SOUMÈT DOKIMAN
  // ==========================================
  if (appStep === 'upload_docs') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setAppStep('tier_select')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-xs uppercase tracking-wider mb-6 transition-colors"><ArrowLeft size={16} /> Tounen</button>
          
          <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight mb-2">Dokiman pou Ajan <span className="text-indigo-600 uppercase">{selectedTier}</span></h2>
            <p className="text-sm text-slate-500 mb-8">Telechaje dosye legal ki anba yo klè pou n ka valide kont ou an rapid.</p>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Pyès Idantite (Mèt/Anplwaye)</label>
                <input type="file" onChange={(e) => setIdDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Prèv Adrès (&lt; 3 mwa)</label>
                <input type="file" onChange={(e) => setAddressDoc(e.target.files?.[0] || null)} className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Foto Lokal la (Devan & Kote)</label>
                <input type="file" onChange={(e) => setLocationPhoto(e.target.files?.[0] || null)} className="w-full bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
              </div>

              {selectedTier === 'premium' && (
                <>
                  <div className="pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">Patant Biznis la (OBLIGATWA POU PREMIUM)</label>
                    <input type="file" onChange={(e) => setPatenteDoc(e.target.files?.[0] || null)} className="w-full bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">CIF Biznis la (OBLIGATWA POU PREMIUM)</label>
                    <input type="file" onChange={(e) => setCifDoc(e.target.files?.[0] || null)} className="w-full bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-800" />
                  </div>
                </>
              )}
            </div>

            <button onClick={submitApplication} disabled={actionLoading} className="w-full mt-10 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50">
              {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <><UploadCloud size={16} /> Soumèt Dokiman yo</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: PENDING / FÈ VÈSMAN
  // ==========================================
  if (appStep === 'installment') {
    const requiredAmount = profile.agent_tier === 'premium' ? 110000 : 40000;
    const remaining = requiredAmount - profile.agent_guarantee_paid;
    const progress = (profile.agent_guarantee_paid / requiredAmount) * 100;

    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans">
        <div className="max-w-xl mx-auto mt-8">
          <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                <Store size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Kont Ajan {profile.agent_tier.toUpperCase()}</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                  <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">An Atant Validasyon</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-gray-100 rounded-2xl p-6 mb-8">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kapasite / Garanti Peye</p>
                  <p className="text-2xl font-bold text-slate-900">{profile.agent_guarantee_paid.toLocaleString()} HTG</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total pou plan an</p>
                  <p className="text-sm font-bold text-slate-600">{requiredAmount.toLocaleString()} HTG</p>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                <div className="bg-indigo-600 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-4 leading-relaxed">
                Kapasite kont ou an ap grandi chak fwa w peye. Ou ka fè depo a nan 3 vèsman. Lè w fin peye total la, ajan w lan ap aktive konplètman.
              </p>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">Fè yon Vèsman (Sot nan Wallet Ou)</label>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="number" 
                  value={installmentAmount} 
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  placeholder="0.00" 
                  className="w-full bg-white border border-gray-300 py-4 pl-12 pr-4 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                />
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>Rès pou peye: <span className="text-rose-600">{remaining.toLocaleString()} HTG</span></span>
                <span>Wallet: <span className="text-indigo-600">{profile.wallet_balance.toLocaleString()} HTG</span></span>
              </div>
              
              <button 
                onClick={makeInstallmentPayment}
                disabled={actionLoading || remaining === 0}
                className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-slate-300"
              >
                {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <><CheckSquare size={16} /> Peye Garanti a</>}
              </button>
            </div>
            
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: DASHBOARD POU AJAN KI APWOUVE YO
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-sm">
               <Store size={24} />
             </div>
             <div>
               <h1 className="text-xl font-bold tracking-tight text-slate-900">Pòtay Ajan Hatexcard</h1>
               <div className="flex items-center gap-2 mt-1">
                 <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                 <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Ajan {profile?.agent_tier} Sètifye</span>
               </div>
             </div>
           </div>
           
           <div className="bg-slate-50 border border-gray-200 px-5 py-3 rounded-2xl flex items-center gap-4 w-full md:w-auto">
             <div>
               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Kòd Ajan w lan</p>
               <p className="text-lg font-mono font-bold text-indigo-700 tracking-widest">{profile?.agent_code || '---'}</p>
             </div>
             <button onClick={() => { navigator.clipboard.writeText(profile?.agent_code); alert('Kòd la kopye!'); }} className="p-2 bg-white rounded-lg border border-gray-200 text-slate-500 hover:text-indigo-600 shadow-sm">
                <FileText size={16} />
             </button>
           </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
           {/* KÒLÒN GOCH (Balans & Fòm Depo) */}
           <div className="lg:col-span-5 space-y-6">
              
              {/* BALANS AJAN */}
              <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-md relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-6 opacity-10">
                   <ShieldCheck size={100} />
                 </div>
                 <div className="relative z-10">
                   <div className="flex justify-between items-start mb-4">
                     <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Balans pou Fè Depo</p>
                       <h2 className="text-4xl font-bold tracking-tight mb-1">
                         {Number(profile?.agent_balance || 0).toLocaleString()} <span className="text-lg text-indigo-200">HTG</span>
                       </h2>
                     </div>
                   </div>
                   <div className="bg-indigo-500/50 border border-indigo-400/50 p-3 rounded-xl mt-4">
                     <div className="flex justify-between items-center text-xs font-semibold text-indigo-100">
                       <span>Kapasite Maksimòm:</span>
                       <span>{Number(profile?.agent_capacity || 0).toLocaleString()} HTG</span>
                     </div>
                   </div>
                 </div>
              </div>

              {/* FÒM DEPO POU KLIYAN */}
              <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-3xl shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg border border-emerald-100">
                     <ArrowDownToLine size={20} />
                   </div>
                   <h3 className="text-lg font-bold text-slate-900">Fè yon Depo pou Kliyan</h3>
                 </div>
                 
                 <form onSubmit={handleAgentDeposit} className="space-y-5">
                   <div>
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Imèl Kliyan an</label>
                     <div className="relative">
                       <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                       <input 
                         type="email" 
                         value={depositEmail}
                         onChange={(e) => setDepositEmail(e.target.value)}
                         placeholder="kliyan@email.com"
                         className="w-full bg-slate-50 border border-gray-200 py-3.5 pl-12 pr-4 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-900"
                         required
                       />
                     </div>
                   </div>

                   <div>
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Montan (HTG)</label>
                     <div className="relative">
                       <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                       <input 
                         type="number" 
                         value={depositAmount}
                         onChange={(e) => setDepositAmount(e.target.value)}
                         placeholder="0.00"
                         className="w-full bg-slate-50 border border-gray-200 py-3.5 pl-12 pr-4 rounded-xl text-lg font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-900"
                         required
                       />
                     </div>
                   </div>

                   {statusMsg.text && (
                     <div className={`p-4 rounded-xl flex items-start gap-3 border ${statusMsg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        {statusMsg.type === 'error' ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                        <p className="text-[11px] font-bold uppercase tracking-wider leading-relaxed">{statusMsg.text}</p>
                     </div>
                   )}

                   <button 
                     type="submit" 
                     disabled={actionLoading}
                     className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                   >
                     {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Voye Depo a'}
                   </button>
                   <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest mt-3">Depo kliyan yo 100% gratis</p>
                 </form>
              </div>

              {/* NÒT POU RETRÈ */}
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl shadow-sm text-amber-800">
                <h4 className="font-bold mb-2 flex items-center gap-2"><ArrowUpFromLine size={18} /> Pwosesis pou Retrè</h4>
                <p className="text-sm font-medium leading-relaxed">
                  Lè yon kliyan bezwen fè retrè nan men w, se <strong>li menm</strong> ki dwe inisye tranzaksyon an sou kont li, epi antre kòd 8-chif ou an (<span className="font-mono font-bold">{profile?.agent_code}</span>). Kòb la ap ajoute otomatikman sou balans Ajan w lan.
                </p>
              </div>

           </div>

           {/* KÒLÒN DWA (Istorik) */}
           <div className="lg:col-span-7">
              <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden h-full">
                 <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Istorik Ajan</h3>
                      <p className="text-xs text-slate-500 font-medium">Tout depo ak retrè ou jere yo</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-gray-100">
                      <Search className="w-5 h-5 text-slate-400" />
                    </div>
                 </div>

                 <div className="p-6 md:p-8">
                    {agentTransactions.length === 0 ? (
                      <div className="text-center py-20">
                        <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-sm font-bold text-slate-500">Ou poko fè okenn tranzaksyon antanke ajan.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                         {agentTransactions.map((tx) => (
                           <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-slate-50 hover:bg-white hover:shadow-sm hover:border-indigo-100 transition-all">
                             <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${tx.type === 'AGENT_WITHDRAWAL' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                 {tx.type === 'AGENT_WITHDRAWAL' ? <ArrowUpFromLine size={18} /> : <ArrowDownToLine size={18} />}
                               </div>
                               <div>
                                 <p className="text-sm font-bold text-slate-900">{tx.metadata?.client_email || 'Kliyan Hatex'}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                   <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-gray-200/50 px-2 py-0.5 rounded-full">
                                     {tx.type === 'AGENT_WITHDRAWAL' ? 'Retrè Kliyan' : 'Depo Kliyan'}
                                   </span>
                                   <span className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</span>
                                 </div>
                               </div>
                             </div>
                             
                             <div className="text-right border-t sm:border-none border-gray-200 pt-3 sm:pt-0">
                               <p className={`text-base font-bold ${tx.type === 'AGENT_WITHDRAWAL' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                 {tx.type === 'AGENT_WITHDRAWAL' ? '+' : ''}{Math.abs(tx.amount).toLocaleString()} <span className="text-xs">HTG</span>
                               </p>
                               <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md mt-1 inline-block border border-emerald-100">Reyisi</span>
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