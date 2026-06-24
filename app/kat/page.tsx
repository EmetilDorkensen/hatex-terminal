"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Copy, Eye, EyeOff, ShieldCheck, Lock, IdCard, CheckCircle2, Plus, Loader2 } from 'lucide-react';

export default function KatPage() {
  const router = useRouter();
  const [copyStatus, setCopyStatus] = useState("");
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNumbers, setShowNumbers] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchUserAndProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) {
            setUserData({ ...profile, email: user.email });
            
            // Tcheke si moun nan gen rediksyon (discount) pou n ka regle pri aktivasyon an
            const { data: discountData } = await supabase
              .from('user_discounts')
              .select('discount_amount')
              .eq('user_id', user.id)
              .maybeSingle();
              
            if (discountData) {
              setDiscountAmount(discountData.discount_amount || 0);
            }
          }

          // Realtime update pou balans lan chanje sou kat la menm kote a
          supabase
            .channel(`card_update_${user.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
              (payload) => setUserData((prev: any) => ({ ...prev, ...payload.new })))
            .subscribe();
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndProfile();
  }, [supabase, router]);

  const formatCardNumber = (num: string) => {
    if (!num) return "**** **** **** ****";
    if (!showNumbers) return `**** **** **** ${num.slice(-4)}`;
    return num.replace(/(\d{4})/g, '$1 ').trim();
  };

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyStatus(`${label} kopye`);
    setTimeout(() => setCopyStatus(""), 2000);
  };

  const kycPending = userData?.kyc_status !== 'approved';
  const cardNeedsActivation = userData?.kyc_status === 'approved' && !userData?.is_card_activated;
  const cardFullyActive = userData?.kyc_status === 'approved' && userData?.is_card_activated;

  const priBase = 520;
  const uiPriAktivasyon = Math.max(0, priBase - discountAmount);

  const handleActivateCard = async () => {
    if (!userData) return;
    setLoading(true);

    try {
      const { data: realProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', userData.id)
        .single();

      if (profileErr || !realProfile) throw new Error("Nou pa ka jwenn enfòmasyon w yo kounye a.");

      let dbDiscountAmount = 0;
      const { data: realDiscountData } = await supabase
        .from('user_discounts')
        .select('discount_amount')
        .eq('user_id', userData.id)
        .maybeSingle();

      if (realDiscountData) {
        dbDiscountAmount = realDiscountData.discount_amount || 0;
      }

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
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ wallet_balance: nouvoBalans, is_card_activated: true })
        .eq('id', userData.id);

      if (updateErr) throw updateErr;

      await supabase.from('transactions').insert({
        user_id: userData.id, 
        amount: -realActivationPrice, 
        type: 'CARD_ACTIVATION',
        description: dbDiscountAmount > 0 ? `Aktivasyon Kat (Ak Rediksyon -${dbDiscountAmount} HTG)` : 'Frè Aktivasyon Kat Vityèl', 
        status: 'success'
      });

      alert("Felisitasyon! Kat ou ak Terminal ou aktive nèt.");
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Chajman...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative flex flex-col overflow-x-hidden p-4 sm:p-6 pb-32">
      
      {copyStatus && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-full font-semibold text-xs uppercase shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 size={16} className="text-emerald-400" /> {copyStatus}
        </div>
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-8 max-w-lg mx-auto w-full mt-2">
        <button 
          onClick={() => router.push('/dashboard')} 
          className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider leading-none mb-1">Kat Vityèl</p>
          <div className="flex items-center justify-end gap-1.5">
            <div className={`w-2 h-2 rounded-full ${cardFullyActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
            <p className={`text-xs font-bold uppercase tracking-wide ${cardFullyActive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {cardFullyActive ? 'Aktif' : 'Bloke'}
            </p>
          </div>
        </div>
      </div>

      {/* KAT LA */}
      <div className="relative w-full max-w-[420px] mx-auto mb-8">
        
        {/* OVERLAY POU KYC (Si l poko fè l) */}
        {kycPending && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-white/90 backdrop-blur-md p-6 text-center border border-gray-200 shadow-sm mx-auto aspect-[1.58/1]">
            <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-4 border border-indigo-100">
              <IdCard size={28} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">KYC Obligatwa</h3>
            <p className="text-xs text-slate-500 font-medium mb-6 px-4 leading-relaxed">Verifye idantite w gratis pou jwenn aksè ak kat la.</p>
            <button onClick={() => router.push('/kyc')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase shadow-sm transition-colors tracking-wider flex items-center gap-2">
              Pase KYC Kounye a
            </button>
          </div>
        )}

        {/* OVERLAY POU AKTIVASYON (Si KYC fèt men kat poko peye) */}
        {cardNeedsActivation && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-3xl bg-white/95 backdrop-blur-md p-6 text-center border border-amber-200 shadow-sm mx-auto aspect-[1.58/1]">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mb-4 border border-amber-100">
              <Lock size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
              Aktive Kat Ou
            </p>
            <p className="text-xs text-slate-500 font-medium mb-4 px-4 leading-relaxed">
              Peye frè a pou w wè nimewo a epi kòmanse itilize l.
            </p>
            {discountAmount > 0 && (
               <p className="text-[10px] text-emerald-600 font-bold mb-4 uppercase tracking-wider flex items-center justify-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-100">
                 <CheckCircle2 size={14} /> Rediksyon {discountAmount} HTG aktif
               </p>
            )}
            <button onClick={handleActivateCard} className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold text-xs uppercase shadow-sm transition-colors tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} /> Aktive pou {uiPriAktivasyon} HTG
            </button>
          </div>
        )}

        {/* DESIGN KAT LA */}
        <div className={`relative bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-indigo-700/50 w-full aspect-[1.58/1] flex flex-col justify-between overflow-hidden transition-all duration-300`}>
          
          {/* Decorative background elements */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none"></div>

          <div className={`relative z-10 flex flex-col h-full justify-between ${!cardFullyActive ? 'blur-sm opacity-60' : ''}`}>
            
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className="bg-white p-1 rounded-lg border border-white/20 shadow-sm">
                  <img src="https://i.imgur.com/xDk58Xk.png" alt="Hatexcard" className="w-6 h-6 object-cover" />
                </div>
                <span className="text-white font-bold tracking-widest uppercase text-[11px] opacity-90">Hatexcard</span>
              </div>
              <div className="text-right">
                <p className="text-indigo-200 text-[9px] font-semibold uppercase tracking-wider mb-0.5">Balans</p>
                <p className="text-white font-bold text-sm">
                  {Number(userData?.card_balance || 0).toLocaleString()} <span className="text-indigo-300 text-[9px] ml-0.5">HTG</span>
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between mt-2">
                <p className="text-white text-lg sm:text-xl font-mono tracking-widest font-semibold drop-shadow-sm">
                  {formatCardNumber(userData?.card_number)}
                </p>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowNumbers(!showNumbers); }} 
                  className="text-indigo-200 hover:text-white transition-colors p-2 shrink-0 disabled:opacity-50"
                  disabled={!cardFullyActive}
                >
                  {showNumbers ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="flex justify-between items-end pb-1">
                <div className="pr-2">
                  <p className="text-indigo-200 text-[8px] font-semibold uppercase tracking-widest mb-1">Titilè</p>
                  <p className="text-white font-medium text-[11px] sm:text-xs uppercase tracking-wide truncate max-w-[160px]">
                    {userData?.full_name || 'Kliyan Hatex'}
                  </p>
                </div>
                <div className="flex gap-6 text-right shrink-0">
                  <div>
                    <p className="text-indigo-200 text-[8px] font-semibold uppercase tracking-widest mb-1">Eksp</p>
                    <p className="text-white font-medium text-[11px] sm:text-xs font-mono tracking-wider">
                      {cardFullyActive ? userData?.exp_date : "**/**"}
                    </p>
                  </div>
                  <div>
                    <p className="text-indigo-200 text-[8px] font-semibold uppercase tracking-widest mb-1">CVV</p>
                    <p className="text-white font-medium text-[11px] sm:text-xs font-mono tracking-wider">
                      {showNumbers ? userData?.cvv : "***"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* AKSYON YO (Sèlman si kat la aktif) */}
      {cardFullyActive && (
        <div className="max-w-[420px] mx-auto w-full space-y-4 animate-in slide-in-from-bottom-6 duration-500">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleCopy(userData?.card_number, "Nimewo")} 
              className="bg-white border border-gray-200 text-slate-700 py-4 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm"
            >
              <Copy size={16} className="text-indigo-500" /> Kopye Nimewo
            </button>
            <button 
              onClick={() => handleCopy(userData?.cvv, "CVV")} 
              className="bg-white border border-gray-200 text-slate-700 py-4 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm"
            >
              <Copy size={16} className="text-indigo-500" /> Kopye CVV
            </button>
          </div>
          
          <button 
            onClick={() => router.push('/kat/recharge')}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 sm:py-5 rounded-xl font-bold uppercase text-[11px] sm:text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus size={18} /> Rechaje Kat la (0 Frè)
          </button>
        </div>
      )}

    </div>
  );
}