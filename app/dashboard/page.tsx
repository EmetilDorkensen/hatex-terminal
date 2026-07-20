"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createBrowserClient } from '@supabase/ssr';
import { checkStrongPassword } from '@/lib/security/password-strength';
import { isKycApproved } from '@/lib/kyc/status';
import { prepareUserTransactions, getTransactionDescription } from '@/lib/transactions/display';
import FeaturesUnlockPanel from '@/components/FeaturesUnlockPanel';
import { 
  RefreshCcw, AlertTriangle, X, CheckCircle, ShieldCheck, 
  Send, CheckCircle2, MessageSquare, Plus, ArrowUpRight, 
  ArrowRightLeft, Home, CreditCard, Terminal, History, Store, Settings, Menu, Headset, Briefcase, Loader2, Building2, Receipt, Lock, AlertCircle
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
  
  // ETA POU MENI SOU BÒ GÒCH LA (SIDEBAR)
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
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

  // ETA POU PÒTAY ADMIN
  const [isLoggingAdmin, setIsLoggingAdmin] = useState(false);

  // ==========================================
  // ETA POU AKSÈ ESPAS TRAVAY (ANPLWAYE)
  // ==========================================
  const [staffRecord, setStaffRecord] = useState<any>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [workspacePassword, setWorkspacePassword] = useState('');
  const [workspacePasswordConfirm, setWorkspacePasswordConfirm] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const generateMissingCard = async (userId: string, currentProfile: any) => {
    if (currentProfile.kyc_status === 'approved' && !currentProfile.card_last4) {
      try {
         const res = await fetch('/api/card/ensure', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ reveal: false }),
         });
         if (res.ok) {
           const data = await res.json();
           if (data.card) {
             return {
               ...currentProfile,
               card_last4: data.card.card_last4,
               exp_date: data.card.exp_date || currentProfile.exp_date,
               masked: data.card.masked,
             };
           }
         }
      } catch (e) {
          console.error('Card ensure failed, will retry later:', e);
      }
    }
    return currentProfile;
  };

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id, full_name, email, phone, wallet_balance, card_balance, agent_balance, account_status, account_type, kyc_status, is_activated, is_card_activated, is_agent, agent_tier, agent_capacity, card_last4, card_number_hash, exp_date, created_at, business_name')
            .eq('id', user.id)
            .maybeSingle();

          if (profileErr) {
            console.error('Erè lekti pwofil:', profileErr.message);
          }

          if (profile) {
            // Pa chaje secrets (pin/card plaintext) — card_last4 + hash sèlman
            let safeProfile = profile as any;
            safeProfile = await generateMissingCard(user.id, safeProfile);
            setUserData({ ...safeProfile, email: user.email });
            
            const { data: discountData } = await supabase
              .from('user_discounts')
              .select('discount_amount')
              .eq('user_id', user.id)
              .maybeSingle();
              
            if (discountData) {
              setDiscountAmount(discountData.discount_amount || 0);
            }
          } else {
            // Fallback: si select espesifik echwe, eseye kolòn debaz pou pa bloke kont lan
            const { data: fallback } = await supabase
              .from('profiles')
              .select('id, full_name, email, wallet_balance, card_balance, kyc_status, is_card_activated, account_type, account_status')
              .eq('id', user.id)
              .maybeSingle();
            if (fallback) {
              setUserData({ ...fallback, email: user.email });
            }
          }

          // Tcheke si kliyan sa a se tou yon anplwaye Hatexcard (staff_users).
          // RLS pèmèt li li SÈLMAN pwòp liy pa li.
          if (user.email) {
            const { data: staff } = await supabase
              .from('staff_users')
              .select('id, role, status, workspace_password_hash, full_name')
              .eq('email', user.email.trim().toLowerCase())
              .maybeSingle();
            if (staff && staff.status !== 'revoked') {
              setStaffRecord({
                ...staff,
                has_workspace_password: !!staff.workspace_password_hash,
                workspace_password_hash: staff.workspace_password_hash ? 'set' : null,
              });
            }
          }

          const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', user.id).not('description', 'ilike', '%Voye bay%').order('created_at', { ascending: false }).limit(12);
          if (transactions) setRecentTransactions(prepareUserTransactions(transactions).slice(0, 5));

          const { data: settings } = await supabase.from('global_settings').select('*').eq('id', 1).maybeSingle();
          if (settings) {
            setAnnouncement(settings.announcement_text || "");
            setIsAnnouncementActive(settings.announcement_active);
          }

          const channel = supabase.channel(`profile_realtime_${user.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
              const next = payload.new as any;
              // Pa antre secrets / ciphertext nan UI realtime
              setUserData((prev: any) => ({
                ...prev,
                full_name: next.full_name ?? prev?.full_name,
                wallet_balance: next.wallet_balance,
                card_balance: next.card_balance,
                agent_balance: next.agent_balance,
                kyc_status: next.kyc_status,
                is_card_activated: next.is_card_activated,
                is_activated: next.is_activated,
                account_status: next.account_status,
                account_type: next.account_type,
                card_last4: next.card_last4 ?? prev?.card_last4,
                exp_date: next.exp_date ?? prev?.exp_date,
                is_agent: next.is_agent,
                agent_tier: next.agent_tier,
                agent_capacity: next.agent_capacity,
              }));
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
    if (!num && userData?.card_last4) return `**** **** **** ${userData.card_last4}`;
    if (!num) return "**** **** **** ****";
    if (showNumbers) return num.match(/.{1,4}/g)?.join(' ') || num;
    return `${num.substring(0, 4)} **** **** ${num.substring(12, 16)}`;
  };

  const revealDashboardCard = async () => {
    if (showNumbers) {
      setShowNumbers(false);
      setUserData((prev: any) => ({ ...prev, card_number: undefined, cvv: undefined }));
      return;
    }
    const res = await fetch('/api/card/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reveal: true }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.card?.card_number) {
      setUserData((prev: any) => ({
        ...prev,
        card_number: data.card.card_number,
        cvv: data.card.cvv,
        card_last4: data.card.card_last4,
        exp_date: data.card.exp_date,
      }));
      setShowNumbers(true);
    }
  };

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

  // 👇 FONKSYON POU BOUTON ADMIN NAN KI ITILIZE API A POU L PASE MIDDLEWARE LA 👇
  const antreNanAdmin = async () => {
    const pass = prompt("Antre Modpas Sipè Admin lan pou w ka konekte:");
    if (!pass) return;

    setIsLoggingAdmin(true);
    try {
        const verifyRes = await fetch('/api/admin/verify-gate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass }),
        });

        const data = await verifyRes.json().catch(() => ({}));

        if (verifyRes.ok) {
            window.location.href = "/admin";
        } else if (verifyRes.status === 403) {
            alert(data.message || "Kont ou konekte a pa gen dwa admin.");
        } else if (verifyRes.status === 500) {
            alert(data.message || "ADMIN_GATE_PASSWORD pa konfigire sou sèvè a. Kontakte devlopè a.");
        } else if (verifyRes.status === 429) {
            alert("Twòp tantativ. Tann kèk minit anvan w eseye ankò.");
        } else {
            alert(data.message || "Modpas la pa bon!");
        }
    } catch (e) {
        alert("Erè nan sistèm nan. Tanpri eseye ankò.");
    } finally {
        setIsLoggingAdmin(false);
    }
  };

  // 👇 BOUTON "AKSÈ ESPAS TRAVAY" — parèt sèlman si imel la nan lis anplwaye 👇
  const handleOpenWorkspaceModal = () => {
    setWorkspaceError('');
    setWorkspacePassword('');
    setWorkspacePasswordConfirm('');
    setShowWorkspaceModal(true);
  };

  const isFirstTimeWorkspaceSetup = staffRecord && !staffRecord.workspace_password_hash;

  const handleWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkspaceError('');

    if (isFirstTimeWorkspaceSetup) {
      const strength = checkStrongPassword(workspacePassword);
      if (!strength.valid) {
        setWorkspaceError(strength.message || 'Modpas la twò fèb.');
        return;
      }
      if (workspacePassword !== workspacePasswordConfirm) {
        setWorkspaceError('Modpas yo pa menm. Tanpri konfime menm modpas la de fwa.');
        return;
      }
    }

    setWorkspaceLoading(true);
    try {
      const endpoint = isFirstTimeWorkspaceSetup ? '/api/workspace/set-password' : '/api/workspace/verify-gate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: workspacePassword }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.needsSetup) {
          setStaffRecord((prev: any) => ({ ...prev, workspace_password_hash: null }));
        }
        setWorkspaceError(data.message || "Yon erè pase. Tanpri eseye ankò.");
        return;
      }

      setShowWorkspaceModal(false);
      window.location.href = '/workspace';
    } catch {
      setWorkspaceError('Erè rezo. Tanpri eseye ankò.');
    } finally {
      setWorkspaceLoading(false);
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
  const kycNotSubmitted = userData?.kyc_status === 'not_submitted' || !userData?.kyc_status;
  const cardFullyActive = userData?.kyc_status === 'approved' && userData?.is_card_activated;
  
  // 👇 BOUTON AN PARÈT SÈLMAN POU IMÈL SA A 👇
  const isAdmin = userData?.email === 'adminhatexcard@gmail.com';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col relative">
      
      {/* ========================================== */}
      {/* SIDEBAR (MENI SOU BÒ GÒCH LA) */}
      {/* ========================================== */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[300] flex">
          {/* FOND NWA K AP KOUVRI EKRAN AN (Backdrop) */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsMenuOpen(false)}
          ></div>
          
          {/* PWENPAL MENI AN (Soti bò gòch la) */}
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 border-r border-gray-200 z-10">
            {/* Header Meni an ak Logo */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <img src="https://i.imgur.com/xDk58Xk.png" alt="Hatexcard Logo" className="w-9 h-9 rounded-lg object-cover shadow-sm border border-gray-200" />
                <span className="font-bold text-xl text-slate-900 tracking-tight">Hatexcard</span>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 hover:text-slate-700 bg-white rounded-full p-1 border border-gray-200 shadow-sm transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold text-lg shadow-sm">
                  {userData?.full_name ? userData.full_name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm truncate w-32">{userData?.full_name || 'Kliyan'}</h3>
                  <p className="text-[10px] text-slate-500 font-medium truncate w-32">{userData?.email}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-2">Navigasyon Prensipal</p>
              
              <button onClick={() => { router.push('/dashboard'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-indigo-700 bg-indigo-50 font-semibold transition-all border border-indigo-100">
                <Home size={20} /> Akèy
              </button>
              
              <button onClick={() => { router.push('/kat'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 font-medium transition-all">
                <CreditCard size={20} /> Kat
              </button>
              
              <button 
                onClick={() => {
                  if (cardFullyActive) { router.push('/terminal'); setIsMenuOpen(false); } 
                  else { alert("Ou dwe pase KYC, tann apwobasyon, epi peye 525 HTG pou debloke Terminal la."); }
                }} 
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 font-medium transition-all"
              >
                <Terminal size={20} /> Terminal
              </button>

              <button onClick={() => { router.push('/agent'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 font-medium transition-all">
                <Store size={20} /> Ajan
              </button>
              
              <button onClick={() => { router.push('/transactions'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 font-medium transition-all">
                <History size={20} /> Istorik
              </button>

              <button onClick={() => { router.push('/support'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 font-medium transition-all">
                <Headset size={20} /> Asistans / Sipò
              </button>
              
              <button onClick={() => { router.push('/setting'); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-50 font-medium transition-all">
                <Settings size={20} /> Paramèt
              </button>

              {/* 👇 BOUTON AKSÈ ESPAS TRAVAY — PARÈT SÈLMAN POU ANPLWAYE (staff_users) 👇 */}
              {staffRecord && (
                <button
                  onClick={() => { handleOpenWorkspaceModal(); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-bold uppercase tracking-wider text-[10px] transition-all border border-indigo-100 mt-4 shadow-sm"
                >
                   <Lock size={16} />
                   Aksè Espas Travay
                </button>
              )}

              {/* 👇 BOUTON PÒTAY ADMIN NAN ANNDAN MENI AN SÈLMAN POU IMÈL ADMIN NAN 👇 */}
              {isAdmin && (
                <button 
                  onClick={antreNanAdmin} 
                  disabled={isLoggingAdmin}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 font-bold uppercase tracking-wider text-[10px] transition-all border border-rose-100 mt-2 shadow-sm"
                >
                   {isLoggingAdmin ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />} 
                   Kès Biznis (Admin)
                </button>
              )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-slate-50">
               <button onClick={() => { router.push('/deposit'); setIsMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs shadow-sm transition-all">
                 <Plus size={16} /> Fè yon Depo
               </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* NAVBAR ANLÈ (AVÈK LOGO AK HAMBURGER) */}
      {/* ========================================== */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Seksyon Gòch: Bouton Meni + Logo */}
            <div className="flex items-center gap-4">
              <button onClick={() => setIsMenuOpen(true)} className="text-slate-500 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-100">
                <Menu size={24} />
              </button>
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/dashboard')}>
                <img src="https://i.imgur.com/xDk58Xk.png" alt="Hatexcard Logo" className="w-8 h-8 rounded-lg object-cover shadow-sm border border-gray-200" />
                <span className="font-bold text-xl text-slate-900 tracking-tight hidden sm:block">Hatexcard</span>
              </div>
            </div>

            {/* Seksyon Dwat: Profil */}
            <div className="flex items-center gap-4">
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
      </nav>

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
            {/* 👇 BOUTON PÒTAY ADMIN NAN SOU DASHBOARD PRINCIPAL LA POU IMÈL ADMIN NAN SÈLMAN 👇 */}
            {isAdmin && (
                <button 
                   onClick={antreNanAdmin} 
                   disabled={isLoggingAdmin}
                   className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                   {isLoggingAdmin ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />} Admin
                </button>
            )}
            <button onClick={() => revealDashboardCard()} className="w-10 h-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-all shadow-sm">
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
            <div className="grid grid-cols-4 gap-3">
              <button onClick={() => router.push('/deposit')} className="bg-white border border-gray-200 p-4 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Plus size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">Depo</span>
              </button>
              <button
                onClick={() => {
                  if (!isKycApproved(userData?.kyc_status)) {
                    alert('Ou dwe pase KYC anvan ou ka fè retrè. Depo a toujou disponib.');
                    router.push('/kyc');
                    return;
                  }
                  router.push('/withdraw');
                }}
                className={`bg-white border p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group ${isKycApproved(userData?.kyc_status) ? 'border-gray-200 hover:border-indigo-300 hover:shadow-md' : 'border-gray-100 opacity-60'}`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ArrowUpRight size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">Retrè</span>
              </button>
              <button
                onClick={() => {
                  if (!isKycApproved(userData?.kyc_status)) {
                    alert('Ou dwe pase KYC anvan ou ka fè transfè. Depo a toujou disponib.');
                    router.push('/kyc');
                    return;
                  }
                  router.push('/transfert');
                }}
                className={`bg-white border p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group ${isKycApproved(userData?.kyc_status) ? 'border-gray-200 hover:border-indigo-300 hover:shadow-md' : 'border-gray-100 opacity-60'}`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <ArrowRightLeft size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">Transfè</span>
              </button>
              <button
                onClick={() => {
                  if (!cardFullyActive) {
                    alert('Ou dwe debloke opsyon yo (525 HTG) anvan ou ka voye fakti.');
                    return;
                  }
                  router.push('/invoice');
                }}
                className={`bg-white border p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group ${cardFullyActive ? 'border-gray-200 hover:border-indigo-300 hover:shadow-md' : 'border-gray-100 opacity-60'}`}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Receipt size={20} />
                </div>
                <span className="text-xs font-semibold text-slate-700">Invoice</span>
              </button>
            </div>

            {userData?.kyc_status === 'approved' && !cardFullyActive && (
              <FeaturesUnlockPanel
                variant="banner"
                onUnlocked={() => {
                  setUserData((prev: any) =>
                    prev ? { ...prev, is_card_activated: true, features_unlock_paid: true } : prev
                  );
                  window.location.reload();
                }}
              />
            )}

            {/* Bouton Kont Antrepriz */}
            {userData?.account_type === 'business' && userData?.enterprise_status === 'approved' ? (
              <button onClick={() => router.push('/enterprise')} className="w-full bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between gap-3 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0"><Building2 size={16} /></div>
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Kont Antrepriz Aktif</span>
                </div>
              </button>
            ) : userData?.enterprise_status === 'pending' ? (
              <button onClick={() => router.push('/enterprise')} className="w-full bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between gap-3 hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0"><Loader2 size={16} className="animate-spin" /></div>
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Antrepriz: Nan Revizyon</span>
                </div>
              </button>
            ) : (
              <button onClick={() => router.push('/enterprise')} className="w-full bg-white border border-gray-200 p-4 rounded-xl flex items-center justify-between gap-3 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0"><Building2 size={16} /></div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-700 block">Vin Kont Antrepriz</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider">Transfè/Retrè Ilimite + Ajan PRO Gratis</span>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
              </button>
            )}
          </div>

          {/* Col 2: Virtual Card */}
          <div className="lg:col-span-2 flex justify-center lg:justify-end items-center perspective-1000">
            <div className="w-full max-w-[480px]">
              <div className="flex justify-between items-end mb-3 px-1">
                <p className="text-sm font-semibold text-slate-700">Kat Vityèl {!cardFullyActive && kycPending && ''}{!cardFullyActive && !kycPending && userData?.kyc_status === 'pending' ? '(Nan revizyon)' : ''}</p>
                {cardFullyActive && <button onClick={() => setIsFlipped(!isFlipped)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><RefreshCcw size={12}/> Vire Kat la</button>}
              </div>
              
              <div className="relative aspect-[1.58/1] w-full cursor-pointer transition-all duration-700 preserve-3d" onClick={() => cardFullyActive && setIsFlipped(!isFlipped)}>
                
                {kycPending && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-2xl bg-white/90 backdrop-blur-sm p-6 text-center border border-gray-200 shadow-sm">
                    <p className="text-sm font-bold text-slate-900 mb-4">
                      {userData?.kyc_status === 'pending' ? "Verifikasyon an kous..." : kycNotSubmitted ? "Verifikasyon ID Obligatwa" : "KYC pa apwouve ankò"}
                    </p>
                    <button onClick={() => router.push('/kyc')} className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm shadow-md hover:bg-indigo-700 transition-all">
                      {userData?.kyc_status === 'pending' ? 'Tann Revizyon' : 'Pase KYC'}
                    </button>
                  </div>
                )}

                {userData?.kyc_status === 'approved' && !cardFullyActive && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm p-4 text-center border border-indigo-200 shadow-sm">
                    <FeaturesUnlockPanel
                      variant="overlay"
                      onUnlocked={() => {
                        setUserData((prev: any) =>
                          prev ? { ...prev, is_card_activated: true, features_unlock_paid: true } : prev
                        );
                        window.location.reload();
                      }}
                    />
                  </div>
                )}

                {/* Kat Fè Fas (Front) */}
                <div className={`absolute inset-0 backface-hidden rounded-2xl overflow-hidden bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 p-6 shadow-xl border border-white/10 ${!cardFullyActive && 'opacity-30 blur-sm'}`}>
                  <div className="flex flex-col h-full justify-between relative z-10">
                    <div className="flex justify-between items-start">
                      <img src="https://i.imgur.com/xDk58Xk.png" alt="Hatexcard" className="w-10 h-10 rounded-lg object-cover shadow-sm bg-white/10 backdrop-blur-sm border border-white/20 p-0.5" />
                      <span className="text-sm font-bold text-white/50 tracking-wider mt-1">Hatexcard</span>
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
                  <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                </div>

                {/* Kat Fè Do (Back) */}
                <div className={`absolute inset-0 rotate-y-180 backface-hidden rounded-2xl bg-slate-800 border border-slate-700 shadow-xl flex flex-col items-center justify-center ${!cardFullyActive && 'hidden'}`}>
                  <div className="w-full h-12 bg-slate-950 absolute top-6 left-0"></div>
                  <div className="mt-10 bg-white p-2.5 rounded-xl shadow-sm">
                    <QRCodeSVG value={`Card:${userData?.card_last4 || userData?.card_number || 'INVALID'}`} size={100} />
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

        {/* Recent Transactions List */}
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
                        <p className="text-sm font-semibold text-slate-900 truncate">{getTransactionDescription(t)}</p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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
      {/* GWO FOOTER WEB LA (AVÈK LOGO HATEXCARD LA) */}
      {/* ========================================== */}
      <footer className="bg-white border-t border-gray-200 mt-20 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="https://i.imgur.com/xDk58Xk.png" alt="Hatexcard Logo" className="w-10 h-10 rounded-lg object-cover shadow-sm border border-gray-200" />
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
                <li><button onClick={() => router.push('/developer/docs')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Pòtay Peman (API)</button></li>
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
                <li><button onClick={() => router.push('/support')} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Sèvis Kliyan</button></li>
                <li><button onClick={handleOpenRefundModal} className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Kondisyon Ranbousman</button></li>
                <li><a href="mailto:hatexcard@gmail.com" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Kontakte Nou</a></li>
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

      {/* ========================================== */}
      {/* MODAL: AKSÈ ESPAS TRAVAY (ANPLWAYE) */}
      {/* ========================================== */}
      {showWorkspaceModal && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 relative">
            <button
              onClick={() => setShowWorkspaceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isFirstTimeWorkspaceSetup ? 'Kreye Modpas Espas Travay' : 'Aksè Espas Travay'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {isFirstTimeWorkspaceSetup
                    ? 'Premye fwa: kreye yon modpas fò apa pou espas travay ou.'
                    : 'Antre modpas espas travay ou pou kontinye.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {isFirstTimeWorkspaceSetup ? 'Nouvo Modpas Fò' : 'Modpas Espas Travay'}
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={workspacePassword}
                  onChange={(e) => setWorkspacePassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                {isFirstTimeWorkspaceSetup && (
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Omwen 10 karaktè, ak yon majiskil, yon miniskil, yon chif, ak yon senbòl. Modpas sa a apa de modpas kont kliyan ou a.
                  </p>
                )}
              </div>

              {isFirstTimeWorkspaceSetup && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Konfime Modpas la</label>
                  <input
                    type="password"
                    required
                    value={workspacePasswordConfirm}
                    onChange={(e) => setWorkspacePasswordConfirm(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}

              {workspaceError && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-rose-700 text-xs font-bold leading-relaxed">{workspaceError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={workspaceLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {workspaceLoading ? <Loader2 size={16} className="animate-spin" /> : (isFirstTimeWorkspaceSetup ? 'Kreye Modpas & Antre' : 'Konekte')}
              </button>
            </form>
          </div>
        </div>
      )}

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
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 17V3"/><path d="m6 11 6 6-6"/><path d="M19 21H5"/></svg>
}
function ArrowUpFromLine(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m18 9-6-6-6 6"/><path d="M12 3v14"/><path d="M5 21h14"/></svg>
}