"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  RefreshCcw, AlertTriangle, X, CheckCircle, ShieldCheck, 
  Search, Send, CheckCircle2, MessageSquare, Plus, ArrowUpRight, 
  ArrowRightLeft, Home, CreditCard, Terminal, History, Settings 
} from 'lucide-react'; 

export default function Dashboard() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  
  const [announcement, setAnnouncement] = useState("");
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(false);
  
  const [discountAmount, setDiscountAmount] = useState(0);

  // ==========================================
  // ETA POU LITIJ / CHAT KLIYAN AN
  // ==========================================
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundTxId, setRefundTxId] = useState("");
  const [refundReason, setRefundReason] = useState("Mwen pa resevwa pwodwi a");
  const [storeName, setStoreName] = useState("");
  const [proofText, setProofText] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [existingDisputeId, setExistingDisputeId] = useState("");
  const [disputeStatus, setDisputeStatus] = useState("");
  const [adminReply, setAdminReply] = useState("");
  const [disputeTableSource, setDisputeTableSource] = useState(""); 
  const [disputeDetailsFull, setDisputeDetailsFull] = useState<any>(null);
  
  const [chatReply, setChatReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isClosingDispute, setIsClosingDispute] = useState(false);

  // ==========================================
  // ETA POU KONFIME LIVREZON (OTP)
  // ==========================================
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpTxId, setOtpTxId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const generateMissingCard = async (userId: string, currentProfile: any) => {
    if (currentProfile.kyc_status === 'approved' && !currentProfile.card_number) {
      const random4 = () => Math.floor(1000 + Math.random() * 9000).toString();
      const newCardNum = `4550${random4()}${random4()}${random4()}`;
      const newCvv = Math.floor(100 + Math.random() * 900).toString();
      const now = new Date();
      const newExp = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getFullYear() + 3).substring(2)}`;

      await supabase.from('profiles').update({ card_number: newCardNum, cvv: newCvv, exp_date: newExp }).eq('id', userId);
      return { ...currentProfile, card_number: newCardNum, cvv: newCvv, exp_date: newExp };
    }
    return currentProfile;
  };

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

          if (profile) {
            profile = await generateMissingCard(user.id, profile);
            setUserData({ ...profile, email: user.email });
            
            const { data: discountData } = await supabase
              .from('user_discounts')
              .select('discount_amount')
              .eq('user_id', user.id)
              .maybeSingle();
              
            if (discountData) {
              setDiscountAmount(discountData.discount_amount || 0);
            }
          }

          const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', user.id).not('description', 'ilike', '%Voye bay%').order('created_at', { ascending: false }).limit(5);
          if (transactions) setRecentTransactions(transactions);

          const { data: settings } = await supabase.from('global_settings').select('*').eq('id', 1).maybeSingle();
          if (settings) {
            setAnnouncement(settings.announcement_text || "");
            setIsAnnouncementActive(settings.announcement_active);
          }

          const channel = supabase.channel(`profile_realtime_${user.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, async (payload) => {
              let updatedProfile = payload.new;
              updatedProfile = await generateMissingCard(user.id, updatedProfile);
              setUserData((prev: any) => ({ ...prev, ...updatedProfile }));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_settings', filter: `id=eq.1` }, (payload) => {
               setAnnouncement(payload.new.announcement_text);
               setIsAnnouncementActive(payload.new.announcement_active);
            }).subscribe();

          setLoading(false);
          setLoadingRecent(false);

          return () => { supabase.removeChannel(channel); };
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error("Erè Dashboard:", err);
        setLoading(false);
        setLoadingRecent(false);
      }
    };
    fetchUserAndProfile();
  }, [supabase, router]);

  const formatCardNumber = (num: string) => {
    if (!num) return "**** **** **** ****";
    if (showNumbers) return num.match(/.{1,4}/g)?.join(' ') || num;
    return `${num.substring(0, 4)} **** **** ${num.substring(12, 16)}`;
  };

  const priBase = 520;
  const uiPriAktivasyon = Math.max(0, priBase - discountAmount);

  const handleActivateCard = async () => {
    if (!userData) return;
    setLoading(true);

    try {
      const { data: realProfile, error: profileErr } = await supabase.from('profiles').select('wallet_balance').eq('id', userData.id).single();
      if (profileErr || !realProfile) throw new Error("Nou pa ka jwenn enfòmasyon w yo kounye a.");

      let dbDiscountAmount = 0;
      const { data: realDiscountData } = await supabase.from('user_discounts').select('discount_amount').eq('user_id', userData.id).maybeSingle();
      if (realDiscountData) dbDiscountAmount = realDiscountData.discount_amount || 0;

      const realActivationPrice = Math.max(0, priBase - dbDiscountAmount);
      const realWalletBalance = Number(realProfile.wallet_balance || 0);

      if (realWalletBalance < realActivationPrice) {
        setLoading(false);
        alert(`Ou pa gen ase kòb sou balans ou!\n\nOu bezwen omwen ${realActivationPrice} HTG pou aktive kat la.\nTanpri fè yon depo anvan.`);
        router.push('/deposit');
        return;
      }

      if (!window.confirm(`Èske w sèten ou vle peye ${realActivationPrice} HTG pou aktive Kat Vityèl la ak Terminal ou a?`)) {
        setLoading(false);
        return;
      }

      const nouvoBalans = realWalletBalance - realActivationPrice;
      const { error: updateErr } = await supabase.from('profiles').update({ wallet_balance: nouvoBalans, is_card_activated: true }).eq('id', userData.id);
      if (updateErr) throw updateErr;

      await supabase.from('transactions').insert({
        user_id: userData.id, amount: -realActivationPrice, type: 'CARD_ACTIVATION',
        description: dbDiscountAmount > 0 ? `Aktivasyon Kat (Ak Rediksyon -${dbDiscountAmount} HTG)` : 'Frè Aktivasyon Kat Vityèl', status: 'success'
      });

      alert("✅ Felisitasyon! Kat ou ak Terminal ou aktive nèt.");
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FONKSYON LITIJ AK OTP (Rete Entak)
  // ==========================================
  const handleOpenRefundModal = async () => {
      setShowRefundModal(true);
      setDisputeStatus("");
      setRefundTxId("");
      setExistingDisputeId("");
      setIsCheckingId(true);
      
      try {
          const { data: recentTxs } = await supabase.from('plugin_transactions')
            .select('order_id, dispute_details')
            .in('status', ['disputed', 'refunded'])
            .order('created_at', { ascending: false })
            .limit(20);

          let foundId = null;
          if (recentTxs) {
              const myDispute = recentTxs.find(t => t.dispute_details?.client_id === userData.id);
              if (myDispute) foundId = myDispute.order_id;
          }

          if (!foundId) {
             const { data: nTx } = await supabase.from('transactions')
                .select('order_id')
                .eq('user_id', userData.id)
                .in('status', ['disputed', 'refunded'])
                .order('created_at', { ascending: false })
                .limit(1);
             if (nTx && nTx.length > 0) foundId = nTx[0].order_id;
          }

          if (foundId) {
             setExistingDisputeId(foundId);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsCheckingId(false);
      }
  };

  const handleCheckOrderDispute = async (overrideId?: string) => {
    const targetId = overrideId || refundTxId;
    if (!targetId) return alert("Tanpri mete ID kòmand lan anvan.");
    setIsCheckingId(true);
    setDisputeStatus("");
    setAdminReply("");
    setDisputeTableSource("");
    if (overrideId) setRefundTxId(overrideId);
    
    try {
      const cleanId = targetId.toString().replace('#', '').trim();
      let foundData = null;
      let source = "";

      const { data: pData } = await supabase.from('plugin_transactions').select('status, dispute_details').eq('order_id', cleanId).maybeSingle();
      if (pData) { 
        foundData = pData; 
        source = "plugin_transactions"; 
      } else {
        const { data: nData } = await supabase.from('transactions').select('status, metadata').eq('order_id', cleanId).maybeSingle();
        if (nData) { 
          foundData = { status: nData.status, dispute_details: nData.metadata?.dispute_details }; 
          source = "transactions"; 
        }
      }

      if (foundData) {
        setDisputeStatus(foundData.status);
        setDisputeTableSource(source);
        if (foundData.dispute_details) {
          setDisputeDetailsFull(foundData.dispute_details);
          setStoreName(foundData.dispute_details.store_name || "");
          setProofText(foundData.dispute_details.proof_text || "");
          setAdminReply(foundData.dispute_details.admin_reply || "");
        } else if (foundData.status === 'pending' || foundData.status === 'success' || foundData.status === 'completed') {
          alert("Kòmand sa a anfòm, ou ka ouvè yon litij sou li.");
        }
      } else {
        alert("Sistèm nan pa jwenn kòmand sa a. Tcheke ID a ankò.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCheckingId(false);
    }
  };

  const handleSubmitDispute = async (e: any) => {
    e.preventDefault();
    if (!refundTxId || refundTxId.trim() === '') return alert("Tanpri mete ID kòmand lan (12 chif).");
    setIsRefunding(true);

    try {
      const response = await fetch('/api/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: refundTxId.trim(), reason: refundReason, proofText: proofText, clientId: userData?.id, storeName: storeName }),
      });

      const data = await response.json();
      if (!response.ok) {
        alert("Erè: " + data.error);
      } else {
        alert("✅ Siksè: " + data.message);
        handleCheckOrderDispute(); 
      }
    } catch (error) {
      alert("Gen yon pwoblèm rezo. Tanpri eseye ankò.");
    } finally {
      setIsRefunding(false);
    }
  };

  const handleClientSendReply = async () => {
    if (!chatReply.trim() || !disputeTableSource) return;
    setIsSendingReply(true);
    try {
        const newHistory = proofText + `\n\n[NOUVO MESAJ - KLIYAN]: ${chatReply}`;
        const updatedDetails = { ...disputeDetailsFull, proof_text: newHistory };
        
        if (disputeTableSource === 'plugin_transactions') {
            await supabase.from('plugin_transactions').update({ dispute_details: updatedDetails }).eq('order_id', refundTxId.replace('#', '').trim());
        } else {
            const { data: oldTx } = await supabase.from('transactions').select('metadata').eq('order_id', refundTxId.replace('#', '').trim()).single();
            await supabase.from('transactions').update({ metadata: { ...oldTx?.metadata, dispute_details: updatedDetails } }).eq('order_id', refundTxId.replace('#', '').trim());
        }
        setProofText(newHistory);
        setChatReply("");
    } catch(e) {
        alert("Erè nan voye mesaj la."); 
    } finally { 
        setIsSendingReply(false); 
    }
  };

  const handleCloseDisputeClient = async () => {
    if (!confirm("Èske w sèten ou vle fèmen dosye sa a nèt? Ou p ap ka poze pwoblèm sou kòmand sa a ankò.")) return;
    setIsClosingDispute(true);
    try {
        await supabase.from(disputeTableSource).update({ status: 'completed' }).eq('order_id', refundTxId.replace('#', '').trim());
        alert("✅ Ou fèmen dosye sa a ak siksè.");
        setShowRefundModal(false);
        setDisputeStatus("");
        setRefundTxId("");
    } catch(e) { 
        alert("Erè lè w t ap fèmen dosye a."); 
    } finally { 
        setIsClosingDispute(false); 
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpTxId || !otpCode) return alert("Tanpri ranpli tout bwat yo!");
    setIsVerifying(true);
    try {
      const res = await fetch('/api/verify-delivery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_id: otpTxId.trim(), merchant_id: userData.id, otp_code: otpCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Echèk nan verifikasyon kòd la.");
      
      alert(`✅ ${data.message}`);
      setShowOtpModal(false);
      setOtpTxId('');
      setOtpCode('');
    } catch (err: any) {
      alert(`❌ Erè: ${err.message}`);
      if (err.message.includes("sispann") || err.message.includes("bloke")) {
          window.location.reload();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const kycPending = userData?.kyc_status !== 'approved';
  const cardNeedsActivation = userData?.kyc_status === 'approved' && !userData?.is_card_activated;
  const cardFullyActive = userData?.kyc_status === 'approved' && userData?.is_card_activated;
  const isAdmin = userData?.email === 'hatexcard@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      
      {/* ========================================== */}
      {/* NAVBAR ANLÈ (RANPLASE MENI ANBA A) */}
      {/* ========================================== */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/dashboard')}>
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">H</div>
              <span className="font-bold text-xl text-slate-900 tracking-tight">Hatexcard</span>
            </div>

            {/* Menu Desktop */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => router.push('/dashboard')} className="text-indigo-600 font-medium flex items-center gap-2 hover:text-indigo-700 transition">
                <Home size={18} /> Akey
              </button>
              <button onClick={() => router.push('/kat')} className="text-slate-600 font-medium flex items-center gap-2 hover:text-indigo-600 transition">
                <CreditCard size={18} /> Kat
              </button>
              <button 
                onClick={() => {
                  if (cardFullyActive) router.push('/terminal');
                  else alert("⚠️ Ou dwe aktive Kat la ak Terminal la anvan w ka itilize opsyon sa a!");
                }} 
                className="text-slate-600 font-medium flex items-center gap-2 hover:text-indigo-600 transition"
              >
                <Terminal size={18} /> Terminal
              </button>
              <button onClick={() => router.push('/transactions')} className="text-slate-600 font-medium flex items-center gap-2 hover:text-indigo-600 transition">
                <History size={18} /> Istorik
              </button>
              <button onClick={() => router.push('/setting')} className="text-slate-600 font-medium flex items-center gap-2 hover:text-indigo-600 transition">
                <Settings size={18} /> Paramèt
              </button>
            </div>

            {/* Profil Mobile & Desktop Right */}
            <div className="flex items-center gap-4">
              {isAdmin && (
                <button onClick={() => router.push('/admin')} className="hidden sm:block px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium border border-indigo-200 hover:bg-indigo-100 transition">
                  Admin Panel
                </button>
              )}
              <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center text-slate-600 font-bold">
                {userData?.avatar_url ? (
                  <img src={userData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userData?.full_name?.charAt(0) || "U"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Mobile (Anba navbar la sou ti ekran) */}
        <div className="md:hidden border-t border-gray-100 bg-white flex justify-between px-4 py-2 overflow-x-auto">
          <button onClick={() => router.push('/dashboard')} className="flex flex-col items-center p-2 text-indigo-600 min-w-[60px]">
            <Home size={20} /> <span className="text-[10px] mt-1 font-medium">Akey</span>
          </button>
          <button onClick={() => router.push('/kat')} className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 min-w-[60px]">
            <CreditCard size={20} /> <span className="text-[10px] mt-1 font-medium">Kat</span>
          </button>
          <button 
            onClick={() => cardFullyActive ? router.push('/terminal') : alert("Aktive kat la anvan!")} 
            className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 min-w-[60px]"
          >
            <Terminal size={20} /> <span className="text-[10px] mt-1 font-medium">Terminal</span>
          </button>
          <button onClick={() => router.push('/transactions')} className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 min-w-[60px]">
            <History size={20} /> <span className="text-[10px] mt-1 font-medium">Istorik</span>
          </button>
          <button onClick={() => router.push('/setting')} className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 min-w-[60px]">
            <Settings size={20} /> <span className="text-[10px] mt-1 font-medium">Paramèt</span>
          </button>
        </div>
      </nav>

      {/* ========================================== */}
      {/* MODAL LITIJ / RANBOUSMAN (Adaptasyon Blan) */}
      {/* ========================================== */}
      {showRefundModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-gray-200 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-2xl p-6 shadow-2xl relative flex flex-col">
            <button onClick={() => { setShowRefundModal(false); setDisputeStatus(""); }} className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors">
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Mande Ranbousman</h3>
                <p className="text-xs text-slate-500 font-medium">Sistèm Pwoteksyon Kliyan</p>
              </div>
            </div>

            <div className="space-y-4 mb-6 flex-1 flex flex-col min-h-0">
              {isCheckingId ? (
                 <div className="flex justify-center items-center py-10">
                    <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : (disputeStatus === 'disputed' || disputeStatus === 'refunded') ? (
                <div className="border border-gray-200 bg-gray-50 p-4 rounded-xl flex flex-col min-h-[300px]">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-2 shrink-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase">Estati Dosye a:</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${disputeStatus === 'refunded' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {disputeStatus === 'refunded' ? 'RANBOUSE ✅' : 'AN LITIJ ⚠️'}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 flex flex-col">
                    <div className="self-end bg-indigo-600 text-white p-3 rounded-2xl rounded-tr-sm max-w-[90%] shadow-sm ml-auto">
                      <p className="text-[10px] text-indigo-200 mb-1 font-medium">Ou menm ({storeName})</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{proofText}</p>
                    </div>

                    <div className="self-start bg-white p-3 rounded-2xl rounded-tl-sm max-w-[90%] shadow-sm border border-gray-100 mr-auto">
                      <p className="text-[10px] text-slate-500 mb-1 font-bold flex items-center gap-1">
                        <ShieldCheck size={12} className="text-indigo-600"/> Admin Hatexcard
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {adminReply ? adminReply : <span className="italic text-gray-400">Nou resevwa dosye w la. Pasyante, n ap reponn ou la a...</span>}
                      </p>
                    </div>
                  </div>

                  {disputeStatus !== 'refunded' && (
                      <div className="bg-white rounded-xl p-1 flex gap-2 border border-gray-200 shrink-0 shadow-sm">
                          <input 
                              type="text" 
                              placeholder="Ekri yon nouvo mesaj..." 
                              value={chatReply}
                              onChange={(e) => setChatReply(e.target.value)}
                              className="flex-1 bg-transparent border-none outline-none text-sm p-3 text-slate-900"
                          />
                          <button 
                              onClick={handleClientSendReply} 
                              disabled={isSendingReply || !chatReply} 
                              className="bg-indigo-600 hover:bg-indigo-700 w-10 rounded-lg flex items-center justify-center text-white disabled:opacity-50 transition-all"
                          >
                              {isSendingReply ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send size={16} />}
                          </button>
                      </div>
                  )}
                </div>
              ) : existingDisputeId ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                        <MessageSquare size={28} />
                    </div>
                    <h4 className="text-base font-bold text-amber-900 text-center mb-2">Ou gen yon dosye ki louvri!</h4>
                    <p className="text-sm text-amber-700/80 text-center mb-6 px-2">Nou detekte ou gen yon konvèsasyon ranbousman ki poko fèmen sou sistèm nan.</p>
                    <button 
                        onClick={() => handleCheckOrderDispute(existingDisputeId)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-lg font-semibold transition-all shadow-sm flex items-center justify-center"
                    >
                        Kontinye Konvèsasyon an
                    </button>
                </div>
              ) : (
                <div className="space-y-4 shrink-0">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">1. Antre ID Kòmand ou an <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" value={refundTxId} onChange={(e) => setRefundTxId(e.target.value)}
                      placeholder="Eg: 12Chif oswa CMD-123"
                      className="w-full bg-white border border-gray-300 text-slate-900 p-3 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">2. Non Boutik la <span className="text-rose-500">*</span></label>
                    <input 
                      type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Kote w te achte l la"
                      className="w-full bg-white border border-gray-300 text-slate-900 p-3 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">3. Rezon <span className="text-rose-500">*</span></label>
                    <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full bg-white border border-gray-300 text-slate-900 p-3 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                      <option value="Mwen pa resevwa pwodwi a">Mwen pa resevwa pwodwi a</option>
                      <option value="Pwodwi a andomaje">Pwodwi a kraze oswa andomaje</option>
                      <option value="Se pa sa m te kòmande a">Se pa sa m te kòmande a</option>
                      <option value="Fwod">Mwen sispèk yon fwod</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">4. Eksplikasyon & Prèv <span className="text-rose-500">*</span></label>
                    <textarea 
                      value={proofText} onChange={(e) => setProofText(e.target.value)}
                      placeholder="Esplike kisa k pase a, epi mete lyen foto si w genyen..." rows={3}
                      className="w-full bg-white border border-gray-300 text-slate-900 p-3 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                    ></textarea>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-auto shrink-0">
              {(disputeStatus === 'disputed' || disputeStatus === 'refunded') ? (
                  <button 
                      onClick={handleCloseDisputeClient} 
                      disabled={isClosingDispute} 
                      className="w-full bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2"
                  >
                      {isClosingDispute ? 'AP FÈMEN...' : <><CheckCircle2 size={18}/> MARKE KÒM REZOUD / FÈMEN DOSYE A</>}
                  </button>
              ) : (
                  <>
                      <button onClick={() => { setShowRefundModal(false); setDisputeStatus(""); }} className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 py-3 rounded-lg font-semibold text-sm transition-all">
                        Anile
                      </button>
                      {(disputeStatus === 'pending' || disputeStatus === 'completed' || disputeStatus === 'success' || disputeStatus === '') && !existingDisputeId && !isCheckingId && (
                        <button 
                          onClick={handleSubmitDispute}
                          disabled={isRefunding || !refundTxId || !storeName || !proofText}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                          {isRefunding ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Soumèt Dosye a'}
                        </button>
                      )}
                  </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL OTP (Adaptasyon Blan) */}
      {/* ========================================== */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white border border-gray-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button onClick={() => setShowOtpModal(false)} className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors"><X size={20} /></button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><ShieldCheck size={24} /></div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Konfime Livrezon</h3>
                <p className="text-xs text-slate-500 font-medium">Debloke lajan an nan kont ou</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">ID Tranzaksyon an</label>
                <input type="text" value={otpTxId} onChange={(e) => setOtpTxId(e.target.value)} placeholder="Eg: CMD-123" className="w-full bg-white border border-gray-300 text-slate-900 p-3 rounded-lg text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Kòd Sekrè Kliyan an (OTP)</label>
                <input type="text" maxLength={4} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="0000" className="w-full bg-gray-50 border border-gray-300 text-slate-900 p-4 rounded-lg text-2xl tracking-[1em] text-center font-mono outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowOtpModal(false)} className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 py-3 rounded-lg font-semibold text-sm transition-all">Anile</button>
              <button onClick={handleVerifyOTP} disabled={isVerifying || !otpTxId || otpCode.length !== 4} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                {isVerifying ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Verifye Kòd la'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ========================================== */}
      <main className="flex-grow w-full max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer">
              {/* INPUT FILE KACHE POU FOTO A */}
              <input 
                type="file" 
                id="avatarUpload" 
                className="hidden" 
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !userData) return;
                  setLoading(true);
                  try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${userData.id}/${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
                    if (uploadError) throw uploadError;
                    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userData.id);
                    setUserData({...userData, avatar_url: publicUrl});
                  } catch (err: any) {
                    alert("Erè nan mete foto a: " + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
              />
              <label htmlFor="avatarUpload" className="block w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all relative cursor-pointer">
                {userData?.avatar_url ? (
                  <img src={userData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-600 text-2xl font-bold">
                    {userData?.full_name?.charAt(0) || "H"}
                  </div>
                )}
                <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white font-medium">Edit</div>
              </label>
            </div>

            <div>
              <p className="text-sm text-slate-500 font-medium">Bonjou,</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight truncate max-w-[200px] sm:max-w-[400px]">
                {userData?.full_name || "Kliyan Hatexcard"}
              </h1>
            </div>
          </div>

          {/* Quick Actions Desktop */}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setShowOtpModal(true)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all">
              <CheckCircle size={16} /> Konfime Peman
            </button>
            <button onClick={handleOpenRefundModal} className="bg-white hover:bg-gray-50 text-slate-700 border border-gray-200 text-sm font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm">
              <RefreshCcw size={16} className="text-indigo-600" /> Litij / Ranbousman
            </button>
            <button onClick={() => setShowNumbers(!showNumbers)} className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-all shadow-sm">
              <span className="text-lg">{showNumbers ? "🔒" : "👁️"}</span>
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-10">
          
          {/* Col 1: Balance & Actions */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Balance Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <CreditCard size={100} />
              </div>
              <p className="text-sm font-semibold text-slate-500 mb-2">Balans Disponib</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight truncate">
                  {userData?.wallet_balance ? Number(userData.wallet_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
                </h3>
                <span className="text-lg font-semibold text-slate-500">HTG</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => router.push('/deposit')} className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">Depo</span>
              </button>
              <button onClick={() => router.push('/withdraw')} className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ArrowUpRight size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">Retrè</span>
              </button>
              <button onClick={() => router.push('/transfert')} className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ArrowRightLeft size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">Transfè</span>
              </button>
            </div>
          </div>

          {/* Col 2: Virtual Card */}
          <div className="lg:col-span-2 flex justify-center lg:justify-end items-center perspective-1000">
            <div className="w-full max-w-[480px]">
              <div className="flex justify-between items-end mb-3 px-1">
                <p className="text-sm font-semibold text-slate-700">Kat Vityèl {cardNeedsActivation && "(Poko Aktive)"}</p>
                {cardFullyActive && <button onClick={() => setIsFlipped(!isFlipped)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><RefreshCcw size={12}/> Vire Kat la</button>}
              </div>
              
              <div className="relative aspect-[1.58/1] w-full cursor-pointer transition-all duration-700 preserve-3d" onClick={() => cardFullyActive && setIsFlipped(!isFlipped)}>
                
                {kycPending && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-2xl bg-white/90 backdrop-blur-sm p-6 text-center border border-gray-200 shadow-sm">
                    <p className="text-sm font-bold text-slate-900 mb-4">
                      {userData?.kyc_status === 'pending' ? "Verifikasyon an kous..." : "Verifikasyon ID Obligatwa"}
                    </p>
                    <button onClick={() => router.push('/kyc')} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md hover:bg-indigo-700 transition-all">
                      Pase KYC Gratis
                    </button>
                  </div>
                )}

                {cardNeedsActivation && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-2xl bg-slate-900/80 backdrop-blur-md p-6 text-center shadow-lg border border-slate-700">
                    <div className="text-4xl mb-3">🔒</div>
                    <p className="text-sm font-medium text-white mb-4">
                      Aktive kat ou pou kòmanse resevwa peman.
                    </p>
                    {discountAmount > 0 && (
                       <p className="text-xs text-emerald-400 font-bold mb-3">
                          🎉 Rediksyon {discountAmount} HTG!
                       </p>
                    )}
                    <button onClick={handleActivateCard} className="bg-white text-slate-900 px-6 py-3 rounded-lg font-bold text-sm shadow-lg hover:bg-gray-100 transition-all">
                      Aktive pou {uiPriAktivasyon} HTG
                    </button>
                  </div>
                )}

                {/* Kat Fè Fas (Front) - Stripe Style (Dark Blue/Slate Gradient) */}
                <div className={`absolute inset-0 backface-hidden rounded-2xl overflow-hidden bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 p-6 shadow-xl border border-white/10 ${!cardFullyActive && 'opacity-30 blur-sm'}`}>
                  <div className="flex flex-col h-full justify-between relative z-10">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center text-white font-bold text-xl">H</div>
                      <span className="text-sm font-bold text-white/50 tracking-wider">Hatexcard</span>
                    </div>
                    <div>
                      <p className="text-xl sm:text-2xl font-mono text-white tracking-widest mb-4">
                        {formatCardNumber(userData?.card_number)}
                      </p>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Non sou Kat la</p>
                          <p className="text-sm font-medium text-white tracking-wide truncate max-w-[180px]">{userData?.full_name}</p>
                        </div>
                        <div className="flex gap-6 text-right">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Exp</p>
                            <p className="text-sm font-mono text-white">{userData?.exp_date || "**/**"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">CVV</p>
                            <p className="text-sm font-mono text-white">{showNumbers ? (userData?.cvv || "***") : "***"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Decorative Elements */}
                  <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                </div>

                {/* Kat Fè Do (Back) */}
                <div className={`absolute inset-0 rotate-y-180 backface-hidden rounded-2xl bg-slate-800 border border-slate-700 shadow-xl flex flex-col items-center justify-center ${!cardFullyActive && 'hidden'}`}>
                  <div className="w-full h-12 bg-slate-950 absolute top-6 left-0"></div>
                  <div className="mt-10 bg-white p-2.5 rounded-xl shadow-sm">
                    <QRCodeSVG value={`Card:${userData?.card_number || 'INVALID'}`} size={100} />
                  </div>
                  <p className="text-xs font-semibold text-slate-400 mt-4">Eskane pou Peye</p>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Announcements */}
        {isAnnouncementActive && announcement && (
          <div className="mb-10 bg-indigo-50 border border-indigo-100 rounded-2xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg">📢</span>
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Notifikasyon</span>
            </div>
            <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">
              {announcement}
            </p>
          </div>
        )}

        {/* Recent Transactions List (Stripe Style) */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Dènye Tranzaksyon</h2>
            <button onClick={() => router.push('/transactions')} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Gade tout</button>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {loadingRecent ? (
              <div className="p-8 flex justify-center"><div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
            ) : recentTransactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Pa gen aktivite ankò.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${t.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                        {t.amount > 0 ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{t.description}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {t.user_email && ` • ${t.user_email.split('@')[0]}...`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-4">
                      <p className={`text-sm font-bold ${t.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {t.amount > 0 ? '+' : ''}{Number(t.amount).toLocaleString('en-US', {minimumFractionDigits: 2})} <span className="text-[10px] text-slate-500">HTG</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ========================================== */}
      {/* GWO FOOTER WEB LA (RANPLASE MENI ANBA A) */}
      {/* ========================================== */}
      <footer className="bg-white border-t border-gray-200 mt-20 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">H</div>
                <span className="font-bold text-xl text-slate-900 tracking-tight">Hatexcard</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">
                Platfòm peman sou entènèt ak kat vityèl pou antreprenè, devlopè, ak sitwayen nimerik an Ayiti.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Pwodwi</h3>
              <ul className="space-y-3">
                <li><button onClick={() => router.push('/kat')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Kat Vityèl</button></li>
                <li><button onClick={() => router.push('/terminal')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Pòtay Peman (API)</button></li>
                <li><button onClick={() => router.push('/deposit')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Rechaje Kont</button></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Devlopè</h3>
              <ul className="space-y-3">
                <li><button onClick={() => router.push('/developer/docs')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Dokimantasyon API</button></li>
                <li><button onClick={() => router.push('/plugins')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Plugins (WordPress)</button></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Kòd Sous</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 mb-4 uppercase text-xs tracking-wider">Sipò</h3>
              <ul className="space-y-3">
                <li><button onClick={handleOpenRefundModal} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Kondisyon Ranbousman</button></li>
                <li><a href="mailto:hatexcard@gmail.com" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Kontakte Nou</a></li>
                <li><button onClick={() => router.push('/setting')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Paramèt Kont</button></li>
              </ul>
            </div>

          </div>
          
          <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-400">
              &copy; {new Date().getFullYear()} Hatexcard. Tout dwa rezève.
            </p>
            <div className="flex gap-6">
              <a href="#" className="text-sm text-slate-400 hover:text-slate-600">Tèm ak Kondisyon</a>
              <a href="#" className="text-sm text-slate-400 hover:text-slate-600">Konfidansyalite</a>
            </div>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}

// Ikon Anplis ki itilize nan paj la
function ArrowDownToLine(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>
}
function ArrowUpFromLine(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/></svg>
}