"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createBrowserClient } from '@supabase/ssr';
import { RefreshCcw, AlertTriangle, X, CheckCircle, ShieldCheck, Search, Send, CheckCircle2, MessageSquare } from 'lucide-react'; 

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
  const [existingDisputeId, setExistingDisputeId] = useState(""); // NOUVO: Kenbe ID litij ki deja la a
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

          const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', user.id).not('description', 'ilike', '%Voye bay%').order('created_at', { ascending: false }).limit(3);
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
  // FONKSYON POU OUVRI MODÈL RANBOUSMAN AK TCHEKE SI GIN LITIJ
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
      <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const kycPending = userData?.kyc_status !== 'approved';
  const cardNeedsActivation = userData?.kyc_status === 'approved' && !userData?.is_card_activated;
  const cardFullyActive = userData?.kyc_status === 'approved' && userData?.is_card_activated;
  const isAdmin = userData?.email === 'hatexcard@gmail.com';

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white font-sans relative flex flex-col italic overflow-x-hidden">
      
      {/* ========================================== */}
      {/* MODAL LITIJ / RANBOUSMAN (AK CHAT / KONTINYE KONVÈSASYON) */}
      {/* ========================================== */}
      {showRefundModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#0a0b14] border border-red-500/30 w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar rounded-[2rem] p-6 shadow-2xl relative flex flex-col">
            <button 
              onClick={() => {
                setShowRefundModal(false);
                setDisputeStatus(""); 
              }}
              className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-3 mb-6 shrink-0">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase italic">Mande Ranbousman</h3>
                <p className="text-[10px] text-zinc-400 font-bold tracking-widest">Sistèm Pwoteksyon Kliyan</p>
              </div>
            </div>

            <div className="space-y-4 mb-6 flex-1 flex flex-col min-h-0">
              
              {isCheckingId ? (
                 <div className="flex justify-center items-center py-10">
                    <div className="w-6 h-6 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                 </div>
              ) : (disputeStatus === 'disputed' || disputeStatus === 'refunded') ? (
                /* SI CHAT LA OUVRI -> AFICHE KONVÈSASYON AN */
                <div className="border border-white/5 bg-zinc-900/50 p-4 rounded-xl animate-in slide-in-from-bottom-4 flex flex-col min-h-[300px]">
                  <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2 shrink-0">
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Estati Dosye a:</p>
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${disputeStatus === 'refunded' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'}`}>
                      {disputeStatus === 'refunded' ? 'RANBOUSE ✅' : 'AN LITIJ ⚠️ (Jele)'}
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 custom-scrollbar pr-2 flex flex-col">
                    <div className="self-end bg-zinc-800 p-3 rounded-2xl rounded-tr-sm max-w-[95%] border border-white/5 ml-auto">
                      <p className="text-[9px] text-zinc-400 mb-1 font-bold">Ou menm ({storeName})</p>
                      <p className="text-xs text-white leading-relaxed whitespace-pre-wrap normal-case">{proofText}</p>
                    </div>

                    <div className="self-start bg-red-900/20 p-3 rounded-2xl rounded-tl-sm max-w-[95%] border border-red-500/20 mr-auto">
                      <p className="text-[9px] text-red-400 mb-1 font-black flex items-center gap-1">
                        <ShieldCheck size={10} /> Admin HatexCard
                      </p>
                      <p className="text-xs text-white leading-relaxed normal-case">
                        {adminReply ? adminReply : <span className="italic text-zinc-500">Nou resevwa dosye w la. Pasyante, n ap reponn ou la a...</span>}
                      </p>
                    </div>
                  </div>

                  {disputeStatus !== 'refunded' && (
                      <div className="bg-black rounded-xl p-1 flex gap-2 border border-white/10 shrink-0">
                          <input 
                              type="text" 
                              placeholder="Ekri yon nouvo mesaj..." 
                              value={chatReply}
                              onChange={(e) => setChatReply(e.target.value)}
                              className="flex-1 bg-transparent border-none outline-none text-xs p-3 text-white normal-case"
                          />
                          <button 
                              onClick={handleClientSendReply} 
                              disabled={isSendingReply || !chatReply} 
                              className="bg-zinc-800 hover:bg-zinc-700 w-10 rounded-lg flex items-center justify-center text-white disabled:opacity-50 transition-all"
                          >
                              {isSendingReply ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send size={14} />}
                          </button>
                      </div>
                  )}
                </div>
              ) : existingDisputeId ? (
                /* SI KLIYAN AN GEN LITIJ -> PA BAY RECHÈCH, JUST BAY BOUTON KONTINYE A */
                <div className="flex flex-col items-center justify-center py-6 px-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl animate-in fade-in">
                    <div className="w-16 h-16 bg-yellow-500/20 text-yellow-500 rounded-full flex items-center justify-center mb-4">
                        <MessageSquare size={28} />
                    </div>
                    <h4 className="text-sm font-black uppercase text-center mb-2">Ou gen yon dosye ki louvri!</h4>
                    <p className="text-xs text-zinc-400 text-center mb-6 px-2">Nou detekte ou gen yon konvèsasyon ranbousman ki poko fèmen sou sistèm nan. Klike anba a pou w wè repons lan oswa ekri Admin nan.</p>
                    <button 
                        onClick={() => handleCheckOrderDispute(existingDisputeId)}
                        className="w-full bg-yellow-600 hover:bg-yellow-500 text-white py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-yellow-600/20 flex items-center justify-center gap-2"
                    >
                        Kontinye Konvèsasyon an
                    </button>
                </div>
              ) : (
                /* SI PA GEN ANYEN -> AFICHE FÒMILÈ POU KREYE A (SAN RECHÈCH) */
                <div className="space-y-4 animate-in fade-in shrink-0">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block">1. Antre ID Kòmand ou an <span className="text-red-500">*</span></label>
                    <input 
                      type="text" value={refundTxId} onChange={(e) => setRefundTxId(e.target.value)}
                      placeholder="Eg: 12Chif"
                      className="w-full bg-black border border-white/10 text-white p-4 rounded-xl text-xs outline-none focus:border-red-500/50 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block">2. Non Boutik la <span className="text-red-500">*</span></label>
                    <input 
                      type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Kote w te achte l la"
                      className="w-full bg-black border border-white/10 text-white p-4 rounded-xl text-xs outline-none focus:border-red-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block">3. Rezon <span className="text-red-500">*</span></label>
                    <select value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full bg-black border border-white/10 text-white p-4 rounded-xl text-xs outline-none focus:border-red-500/50">
                      <option value="Mwen pa resevwa pwodwi a">Mwen pa resevwa pwodwi a</option>
                      <option value="Pwodwi a andomaje">Pwodwi a kraze oswa andomaje</option>
                      <option value="Se pa sa m te kòmande a">Se pa sa m te kòmande a</option>
                      <option value="Fwod">Mwen sispèk yon fwod</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block">4. Eksplikasyon & Prèv <span className="text-red-500">*</span></label>
                    <textarea 
                      value={proofText} onChange={(e) => setProofText(e.target.value)}
                      placeholder="Esplike kisa k pase a, epi mete lyen foto si w genyen..." rows={3}
                      className="w-full bg-black border border-white/10 text-white p-4 rounded-xl text-xs outline-none focus:border-red-500/50 resize-none"
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
                      className="w-full bg-red-600/20 border border-red-500/30 hover:bg-red-600 text-red-500 hover:text-white py-4 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2"
                  >
                      {isClosingDispute ? 'AP FÈMEN...' : <><CheckCircle2 size={16}/> MARKE KÒM REZOUD / FÈMEN DOSYE SA A</>}
                  </button>
              ) : (
                  <>
                      <button onClick={() => { setShowRefundModal(false); setDisputeStatus(""); }} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-xl font-black text-[10px] uppercase transition-all">
                        Fèmen
                      </button>
                      {(disputeStatus === 'pending' || disputeStatus === 'completed' || disputeStatus === 'success' || disputeStatus === '') && !existingDisputeId && !isCheckingId && (
                        <button 
                          onClick={handleSubmitDispute}
                          disabled={isRefunding || !refundTxId || !storeName || !proofText}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
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
      {/* MODAL OTP (KONFIME LIVREZON) */}
      {/* ========================================== */}
      {showOtpModal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#0a0b14] border border-green-500/30 w-full max-w-md rounded-[2rem] p-6 shadow-2xl relative">
            <button onClick={() => setShowOtpModal(false)} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"><X size={20} /></button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500"><ShieldCheck size={24} /></div>
              <div>
                <h3 className="text-lg font-black uppercase italic">Konfime Livrezon</h3>
                <p className="text-[10px] text-zinc-400 font-bold tracking-widest">Debloke kòb kòmand lan</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block">ID Tranzaksyon an</label>
                <input type="text" value={otpTxId} onChange={(e) => setOtpTxId(e.target.value)} placeholder="Eg: 74 oswa CMD-123" className="w-full bg-black border border-white/10 text-white p-4 rounded-xl text-xs outline-none focus:border-green-500/50 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-2 block">Kòd Sekrè Kliyan an (4 Chif)</label>
                <input type="text" maxLength={4} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="0000" className="w-full bg-black border border-white/10 text-white p-4 rounded-xl text-2xl tracking-[1em] text-center font-mono outline-none focus:border-green-500/50 transition-colors" />
                <p className="text-[9px] text-red-500 mt-2 font-bold uppercase">⚠️ Atansyon: Ou sèlman gen 3 chans si kòd la pa bon!</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowOtpModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-4 rounded-xl font-black text-[10px] uppercase transition-all">Anile</button>
              <button onClick={handleVerifyOTP} disabled={isVerifying || !otpTxId || otpCode.length !== 4} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-[10px] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isVerifying ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Verifye Kòd la'}
              </button>
            </div>
          </div>
        </div>
      )}

{/* ========================================== */}
        {/* HEADER AK MAIN DASHBOARD */}
        {/* ========================================== */}
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-5 md:p-6 lg:p-8 pb-32">
          
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
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
                    
                    // Voye nan Storage
                    const { error: uploadError } = await supabase.storage
                      .from('avatars')
                      .upload(fileName, file, { upsert: true });
                    
                    if (uploadError) throw uploadError;

                    // Jwenn URL piblik la
                    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

                    // Mete ajou baz done a
                    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userData.id);
                    
                    setUserData({...userData, avatar_url: publicUrl});
                    alert("✅ Foto pwofil ou mete ajou!");
                  } catch (err: any) {
                    alert("Erè nan mete foto a: " + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
              />

              <label 
                htmlFor="avatarUpload" 
                className="w-12 h-12 rounded-full border-2 border-red-600 p-0.5 bg-zinc-900 overflow-hidden flex items-center justify-center font-black shrink-0 cursor-pointer hover:scale-105 transition-all relative group"
              >
                {userData?.avatar_url ? (
                  <img src={userData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white">{userData?.full_name?.charAt(0) || "H"}</span>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] text-white uppercase font-bold">Edit</div>
              </label>

              <div className="overflow-hidden">
                <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest leading-none italic">Byenvini 👋</p>
                <h2 className="font-bold text-[11px] uppercase italic mt-1 tracking-wide truncate max-w-[120px] md:max-w-[200px] lg:max-w-[250px]">
                  {userData?.full_name || "Kliyan Hatex"}
                </h2>
              </div>
            </div>
          <div className="flex flex-wrap items-center gap-2">
            
            <button onClick={() => setShowOtpModal(true)} className="bg-zinc-900/50 hover:bg-green-600/20 text-green-500 border border-white/5 hover:border-green-500/30 text-[9px] font-black px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-lg">
              <CheckCircle size={12} /> KONFIME LIVREZON
            </button>
            
            <button onClick={handleOpenRefundModal} className="bg-zinc-900/50 hover:bg-red-600/20 text-red-500 border border-white/5 hover:border-red-500/30 text-[9px] font-black px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-lg">
              <RefreshCcw size={12} /> RANBOUSE
            </button>

            {isAdmin && (
              <button onClick={() => router.push('/admin')} className="bg-red-600 text-[9px] font-black px-3 py-2 rounded-lg animate-bounce shadow-lg shadow-red-600/30">
                ADMIN
              </button>
            )}
            <button onClick={() => setShowNumbers(!showNumbers)} className="w-9 h-9 bg-zinc-900/50 rounded-full border border-zinc-800 flex items-center justify-center active:scale-90 transition-all shrink-0">
              <span className="text-sm">{showNumbers ? "🔒" : "👁️"}</span>
            </button>
          </div>
        </div>

        {/* Balans Wallet */}
        <div className="bg-zinc-900/30 backdrop-blur-md p-5 sm:p-6 md:p-7 rounded-[2rem] mb-6 border border-white/5 relative overflow-hidden">
          <p className="text-[11px] uppercase text-zinc-500 font-black mb-1 tracking-[0.2em]">Balans Wallet</p>
          <div className="flex items-baseline gap-2 overflow-hidden">
            <h3 className="text-4xl sm:text-5xl md:text-6xl font-black italic tracking-tighter truncate">
              {userData?.wallet_balance ? Number(userData.wallet_balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : "0.00"}
            </h3>
            <span className="text-[10px] font-bold text-red-600 uppercase italic">Goud</span>
          </div>
        </div>

        {/* Aksyon */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-4 mb-8">
          <button onClick={() => router.push('/deposit')} className="bg-red-600 py-4 sm:py-5 md:py-6 rounded-[2.5rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20">
            <span className="text-[12px] sm:text-[13px] md:text-[14px] font-black uppercase italic tracking-widest">Depo</span>
          </button>
          <button onClick={() => router.push('/withdraw')} className="bg-red-600 py-4 sm:py-5 md:py-6 rounded-[2.5rem] flex items-center justify-center text-white active:scale-95 transition-all shadow-lg shadow-red-600/20">
            <span className="text-[12px] sm:text-[13px] md:text-[14px] font-black uppercase italic tracking-widest">Retrè</span>
          </button>
          <button onClick={() => router.push('/transfert')} className="bg-white py-4 sm:py-5 md:py-6 rounded-[2.5rem] flex items-center justify-center text-red-600 shadow-xl active:scale-95 transition-all">
            <span className="text-[12px] sm:text-[13px] md:text-[14px] font-black uppercase italic tracking-widest">Transfè</span>
          </button>
        </div>

        {/* Kat Vityèl */}
        <div className="mb-8 perspective-1000">
          <p className="text-[10px] font-black uppercase italic text-zinc-500 mb-3 ml-2 tracking-widest flex justify-between">
            <span>Kat Vityèl {cardNeedsActivation && "(Poko Aktive)"}</span>
            {cardFullyActive && <span className="text-red-600 animate-pulse text-[8px]">Klike pou vire</span>}
          </p>
          <div className="relative aspect-[1.58/1] w-full max-w-[500px] mx-auto">
            
            {kycPending && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[2rem] bg-black/80 backdrop-blur-md p-4 text-center border border-white/5">
                <p className="text-[9px] font-black uppercase mb-3 tracking-widest text-white/90">
                  {userData?.kyc_status === 'pending' ? "Verifikasyon an kous..." : "Verifikasyon ID Obligatwa"}
                </p>
                <button onClick={() => router.push('/kyc')} className="bg-white text-black px-8 py-3 rounded-full font-black text-[10px] uppercase shadow-2xl active:scale-90 transition-all">
                  Pase KYC Gratis
                </button>
              </div>
            )}

            {cardNeedsActivation && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-[2rem] bg-black/60 backdrop-blur-xl p-6 text-center border border-yellow-500/30">
                <div className="text-3xl mb-2 drop-shadow-md">🔒</div>
                <p className="text-[9px] font-bold uppercase mb-2 tracking-widest text-zinc-200 leading-relaxed drop-shadow-md">
                  Aktive kat ou ak terminal ou pou w kòmanse resevwa lajan, vann abònman, tout sa w vle.
                </p>
                
                {discountAmount > 0 && (
                   <p className="text-[10px] text-green-400 font-black mb-3 animate-pulse uppercase tracking-widest">
                      🎉 Ou jwenn yon rediksyon {discountAmount} HTG!
                   </p>
                )}

                <button onClick={handleActivateCard} className="bg-yellow-500 text-black px-8 py-4 rounded-full font-black text-[10px] uppercase shadow-2xl shadow-yellow-500/20 active:scale-90 transition-all border border-yellow-400">
                  AKTIVE POU {uiPriAktivasyon} HTG
                </button>
              </div>
            )}

            <div
              className={`relative h-full w-full transition-all duration-700 preserve-3d cursor-pointer ${isFlipped && cardFullyActive ? 'rotate-y-180' : ''}`}
              onClick={() => cardFullyActive && setIsFlipped(!isFlipped)}
            >
              <div className="absolute inset-0 backface-hidden rounded-[2rem] overflow-hidden bg-gradient-to-tr from-red-700 via-red-600 to-zinc-950 p-4 sm:p-5 md:p-6 shadow-2xl border border-white/5">
                <div className={`flex flex-col h-full justify-between ${!cardFullyActive ? 'blur-md opacity-50' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 bg-white/10 rounded-xl border border-white/20 flex items-center justify-center overflow-hidden">
                      <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-[10px] font-black italic tracking-tighter uppercase font-mono">HatexCard</h2>
                  </div>
                  <div className="space-y-3">
                    <p className="text-lg sm:text-xl md:text-2xl font-mono font-bold tracking-[0.2em] break-all">
                      {formatCardNumber(userData?.card_number)}
                    </p>
                    <div className="flex flex-wrap justify-between items-end gap-2">
                      <div className="min-w-0">
                        <p className="text-[7px] opacity-60 uppercase font-black mb-0.5">Pwopriyetè</p>
                        <p className="text-[10px] font-black uppercase truncate max-w-[150px] sm:max-w-[200px]">{userData?.full_name}</p>
                      </div>
                      <div className="flex gap-3 text-right flex-shrink-0">
                        <div>
                          <p className="text-[7px] opacity-60 uppercase font-black mb-0.5">Exp</p>
                          <p className="text-[9px] font-bold">{userData?.exp_date || "**/**"}</p>
                        </div>
                        <div>
                          <p className="text-[7px] opacity-60 uppercase font-black mb-0.5">CVV</p>
                          <p className="text-[9px] font-bold">{showNumbers ? (userData?.cvv || "***") : "***"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 rotate-y-180 backface-hidden rounded-[2rem] bg-zinc-900 p-6 border border-white/10 flex flex-col items-center justify-center">
                <div className="w-full h-10 bg-black absolute top-6 left-0"></div>
                <div className="mt-8 bg-white p-2 rounded-xl">
                  <QRCodeSVG value={`Card:${userData?.card_number || 'INVALID'}`} size={90} />
                </div>
                <p className="text-[8px] font-black uppercase mt-4 text-red-600 tracking-widest italic animate-pulse">Eskane pou peye</p>
              </div>
            </div>
          </div>
        </div>

        {isAnnouncementActive && announcement && (
          <div className="mb-10 bg-zinc-900/60 border border-blue-500/20 rounded-[2rem] p-5 sm:p-6 relative overflow-hidden shadow-lg shadow-blue-900/10 backdrop-blur-md">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl">📢</span>
              <span className="text-[9px] font-black uppercase text-blue-400 tracking-[0.2em] bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
                Notifikasyon Hatex
              </span>
            </div>
            
            <p className="text-[12px] sm:text-[13px] text-white font-bold leading-relaxed whitespace-pre-wrap">
              {announcement}
            </p>
          </div>
        )}

        {/* Dènye Aktivite */}
        <div className="mb-20">
          <div className="flex justify-between items-center mb-4 px-2">
            <p className="text-[10px] font-black uppercase italic text-zinc-500 tracking-widest">Dènye Aktivite</p>
            <button onClick={() => router.push('/transactions')} className="text-[9px] font-bold text-red-500 uppercase italic">Wè tout</button>
          </div>

          <div className="space-y-3">
            {loadingRecent ? (
              <div className="text-center py-4"><div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
            ) : recentTransactions.length === 0 ? (
              <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[1.5rem] text-center backdrop-blur-md">
                <p className="text-[8px] font-black uppercase text-zinc-600 italic tracking-widest">Pa gen aktivite ankò</p>
              </div>
            ) : (
              recentTransactions.map((t) => (
                <div key={t.id} className="bg-zinc-900/40 border border-white/5 p-4 rounded-[2rem] backdrop-blur-md active:scale-95 transition-all">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-zinc-800/80 border border-white/5 flex-shrink-0">
                        {t.type === 'DEPOSIT' ? '' :
                         t.type === 'WITHDRAWAL' ? '' :
                         t.type === 'P2P' ? '' :
                         t.type === 'CARD_ACTIVATION' ? '' :
                         t.type === 'CARD_RECHARGE' ? '' : ''}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[10px] font-black uppercase tracking-tight text-zinc-100 truncate max-w-[120px] sm:max-w-[200px] md:max-w-[300px]">
                          {t.description}
                        </h3>
                        {t.user_email && (
                          <p className="text-[8px] text-zinc-600 font-bold lowercase truncate">
                            {t.user_email.substring(0, 3)}.....@{t.user_email.split('@')[1]}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[12px] font-black ${t.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                        {t.amount > 0 ? '+' : ''}{Number(t.amount).toLocaleString()}
                        <span className="text-[7px] ml-1">HTG</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* NAVIGASYON ANBA (BOTTOM NAV) */}
      {/* ========================================== */}
      <div className="fixed bottom-4 md:bottom-6 left-3 right-3 sm:left-4 sm:right-4 max-w-lg mx-auto bg-zinc-900/90 backdrop-blur-xl border border-white/5 h-[4.5rem] rounded-[2rem] flex justify-around sm:justify-between items-center px-4 sm:px-8 z-50 shadow-2xl">
        <div className="flex flex-col items-center text-red-600 cursor-pointer hover:scale-105 transition-all">
          <div className="w-1.5 h-1.5 bg-red-600 rounded-full mb-1"></div>
          <span className="text-[10px] sm:text-[11px] font-black uppercase">Akey</span>
        </div>
        <div onClick={() => router.push('/kat')} className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 hover:scale-105 transition-all">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-white">Kat</span>
        </div>
        
        <div onClick={() => {
            if (cardFullyActive) {
              router.push('/terminal');
            } else {
              alert("⚠️ Ou dwe aktive Kat la ak Terminal la anvan w ka itilize opsyon sa a!");
              window.scrollTo({ top: 300, behavior: 'smooth' }); 
            }
          }} 
          className="relative -mt-10 md:-mt-12 cursor-pointer hover:scale-105 transition-all"
        >
          <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center shadow-lg rotate-45 ${cardFullyActive ? 'bg-red-600 shadow-red-600/40' : 'bg-zinc-700 shadow-black'}`}>
            <span className={`text-2xl font-black -rotate-45 italic ${cardFullyActive ? 'text-white' : 'text-zinc-500'}`}>
              {cardFullyActive ? 'T' : '🔒'}
            </span>
          </div>
        </div>

        <div onClick={() => router.push('/transactions')} className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 hover:scale-105 transition-all">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-white">Istorik</span>
        </div>
        <div onClick={() => router.push('/setting')} className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 hover:scale-105 transition-all">
          <span className="text-[10px] sm:text-[11px] font-black uppercase text-red-400">Paramèt</span>
        </div>
      </div>

      <style jsx>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}