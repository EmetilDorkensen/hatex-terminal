"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Store, ShieldCheck, FileText, ArrowRightLeft, 
  Wallet, Search, Loader2, CheckCircle2, AlertTriangle, 
  ArrowDownToLine, ArrowUpFromLine, UserCheck, ChevronRight
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
  
  // States pou fòm Depo a
  const [depositEmail, setDepositEmail] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Istorik Ajan
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

    // Rale pwofil la
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (prof) {
      setProfile(prof);
      
      // Si l se yon ajan ki apwouve, nou rale istorik li
      if (prof.agent_status === 'approved') {
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
  // SOUMÈT DEMANN POU VIN AJAN
  // ==========================================
  const applyForAgent = async () => {
    setActionLoading(true);
    try {
      if (profile.kyc_status !== 'approved') {
         throw new Error("Ou dwe verifye idantite w (KYC) anvan ou ka aplike kòm ajan.");
      }
      
      // Mete estati a sou 'pending'. (Administratè a ap dwe tcheke depo 25,000 HTG a epi ba l kòd 8 chif la)
      const { error } = await supabase
        .from('profiles')
        .update({ agent_status: 'pending' })
        .eq('id', profile.id);

      if (error) throw error;
      
      setProfile({ ...profile, agent_status: 'pending' });
      alert("Demann ou an soumèt! N ap kontakte w pou pwosedi depo 25,000 HTG a.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ==========================================
  // FÈ YON DEPO SOU KONT YON KLIYAN (GRATIS POU KLIYAN AN)
  // ==========================================
  const handleAgentDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    
    const amountNum = Number(depositAmount);
    
    if (amountNum <= 0 || !depositEmail) {
      setStatusMsg({ type: 'error', text: 'Tanpri antre yon montan ak yon imèl valab.' });
      return;
    }

    setActionLoading(true);

    try {
      // 1. Verifikasyon Sekirite Debaz
      const { data: currentAgent, error: agentErr } = await supabase
        .from('profiles')
        .select('account_status, agent_status, agent_balance')
        .eq('id', profile.id)
        .single();

      if (agentErr || !currentAgent) throw new Error("Pa ka verifye kont ajan w lan.");
      if (currentAgent.account_status === 'suspended') throw new Error("Kont ou a sispandi. Tranzaksyon an anile.");
      if (currentAgent.agent_status !== 'approved') throw new Error("Ou pa yon ajan ofisyèl ankò.");
      if (currentAgent.agent_balance < amountNum) throw new Error("Ou pa gen ase kòb sou balans Ajan w lan pou fè depo sa a.");

      // 2. Chèche Kliyan an
      const { data: client, error: clientErr } = await supabase
        .from('profiles')
        .select('id, wallet_balance, account_status, full_name')
        .eq('email', depositEmail.toLowerCase().trim())
        .single();

      if (clientErr || !client) throw new Error("Nou pa jwenn okenn itilizatè ak imèl sa a.");
      if (client.account_status === 'suspended') throw new Error("Kont kliyan sa a sispandi. Ou pa ka fè depo pou li.");

      // 3. FÈ TRANZAKSYON AN (Retire nan Agent Balance, Mete nan Wallet Balance Kliyan an)
      const newAgentBalance = Number(currentAgent.agent_balance) - amountNum;
      const newClientBalance = Number(client.wallet_balance) + amountNum;

      // Retire nan kont Ajan an
      const { error: err1 } = await supabase.from('profiles').update({ agent_balance: newAgentBalance }).eq('id', profile.id);
      if (err1) throw new Error("Erè lè n ap debite kont ajan w lan.");

      // Mete nan kont Kliyan an
      const { error: err2 } = await supabase.from('profiles').update({ wallet_balance: newClientBalance }).eq('id', client.id);
      if (err2) {
         // Si l echwe, remèt ajan an kòb li (Rollback)
         await supabase.from('profiles').update({ agent_balance: currentAgent.agent_balance }).eq('id', profile.id);
         throw new Error("Erè lè n ap kredite kliyan an. Kòb la retounen sou kont ou.");
      }

      // 4. Kreye Jounal Tranzaksyon yo
      await supabase.from('transactions').insert([
        {
          user_id: profile.id,
          type: 'AGENT_DEPOSIT',
          amount: -amountNum,
          status: 'success',
          description: `Depo fè pou ${client.full_name}`,
          metadata: { client_email: depositEmail, type: 'AGENT_OUT' }
        },
        {
          user_id: client.id,
          type: 'DEPOSIT',
          amount: amountNum,
          status: 'success',
          description: `Depo nan men Ajan: ${profile.agent_code}`,
          metadata: { agent_code: profile.agent_code, type: 'CASH_IN' }
        }
      ]);

      setStatusMsg({ type: 'success', text: `Depo ${amountNum} HTG fèt ak siksè pou ${client.full_name}!` });
      setDepositAmount('');
      setDepositEmail('');
      fetchAgentData(); // Rafrechi balans yo

    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
      </div>
    );
  }

  // ==========================================
  // VIZYÈL: POKO AJAN / PENDING
  // ==========================================
  if (!profile?.agent_status || profile?.agent_status === 'none' || profile?.agent_status === 'pending') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-10 font-sans">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 mt-8">
             <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-indigo-100">
               <Store size={40} strokeWidth={1.5} />
             </div>
             <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Vin Ajan Hatexcard</h1>
             <p className="text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
               Ede kliyan yo fè depo ak retrè an kach nan zòn ou an, epi fè kòb sou chak retrè kliyan yo fè nan men w.
             </p>
          </div>

          {profile?.agent_status === 'pending' ? (
             <div className="bg-white border border-gray-200 p-8 rounded-3xl shadow-sm text-center">
               <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Loader2 className="w-8 h-8 animate-spin" />
               </div>
               <h2 className="text-xl font-bold text-slate-900 mb-2">Demann Ou An Atant</h2>
               <p className="text-sm text-slate-500 max-w-md mx-auto">
                 Ekip nou an ap verifye pwofil ou. N ap kontakte w sou imèl oswa telefòn pou n finalize dokiman yo ak peman depo garanti 25,000 HTG a.
               </p>
             </div>
          ) : (
            <div className="bg-white border border-gray-200 p-8 sm:p-10 rounded-3xl shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6 border-b border-gray-100 pb-4">Kondisyon Obligatwa</h2>
              
              <ul className="space-y-5 mb-8">
                <li className="flex items-start gap-4">
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg shrink-0 mt-0.5"><CheckCircle2 size={18} /></div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Verifikasyon (KYC) Ranpli</h4>
                    <p className="text-xs text-slate-500 mt-1">Pwofil ou dwe gen estati verifye avèk pyès idantite valab.</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg shrink-0 mt-0.5"><FileText size={18} /></div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Dokiman Biznis</h4>
                    <p className="text-xs text-slate-500 mt-1">Patant ki valab oswa Prèv Adrès biznis la (pou nou lokalize w).</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg shrink-0 mt-0.5"><Wallet size={18} /></div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Depo Garanti: 25,000 HTG</h4>
                    <p className="text-xs text-slate-500 mt-1">Ou dwe fè yon premye depo sou "Balans Ajan" w lan pou w ka kòmanse sèvi kliyan yo.</p>
                  </div>
                </li>
              </ul>

              <button 
                onClick={applyForAgent} 
                disabled={actionLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Mwen Konprann, Soumèt Demann'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIZYÈL: DASHBOARD POU AJAN KI APWOUVE YO
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
                 <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Ajan Sètifye</span>
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
                   <p className="text-xs font-bold uppercase tracking-widest text-indigo-200 mb-2">Balans Ajan (Pou fè depo)</p>
                   <h2 className="text-4xl font-bold tracking-tight mb-1">
                     {Number(profile?.agent_balance || 0).toLocaleString()} <span className="text-lg text-indigo-200">HTG</span>
                   </h2>
                 </div>
              </div>

              {/* FÒM DEPO POU KLIYAN */}
              <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-3xl shadow-sm">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg">
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