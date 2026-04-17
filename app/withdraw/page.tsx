"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function WithdrawPage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number | ''>('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('MonCash');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // ==========================================
  // ETA POU SISTÈM PIN NAN
  // ==========================================
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Kalkil frè ak kantite (Si montan an < 15000 frè a se 5%, si l > 15000 frè a se 0 pou gwo tranzaksyon)
  const currentAmount = Number(amount) || 0;
  const isLargeWithdrawal = currentAmount > 15000;
  
  const withdrawFee = isLargeWithdrawal ? 0 : currentAmount * 0.05;
  const netAmount = currentAmount - withdrawFee;

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (data) {
           setProfile(data);
           // Si kliyan an poko janm fè yon PIN (Etap 2 Sekirite), nou fòse l fè l
           if (!data.transaction_pin) {
               alert("Ou dwe gen yon kòd PIN pou sekirize kont ou anvan ou ka retire lajan. Y ap mennen w nan paj paramèt la.");
               router.push('/setting'); // Oubyen kote l ka kreye PIN li an
           }
        }
      } else {
        router.push('/login');
      }
    };
    fetchProfile();
  }, [supabase, router]);

  // 1. Lè itilizatè a peze premye bouton Konfime a (Mande PIN)
  const initiateWithdrawal = () => {
    if (currentAmount < 500) return alert("Minimòm retrè se 500 HTG");
    if (currentAmount > (profile?.wallet_balance || 0)) return alert("Ou pa gen ase kòb sou kont ou.");
    if (!phone && !isLargeWithdrawal) return alert("Tanpri mete nimewo telefòn ou"); // Si l ap retire +15k, nimewo pa obligatwa la menm jan
    
    // Mande PIN
    setPinError('');
    setEnteredPin('');
    setShowPinPrompt(true);
  };

  // 2. Vre tranzaksyon an fèt LÈ bon PIN nan antre
  const executeWithdrawal = async () => {
    if (enteredPin.length !== 4) {
      setPinError("PIN nan dwe gen 4 chif");
      return;
    }

    setLoading(true);
    setPinError('');

    try {
      // A) VERIFYE KÒD PIN NAN BAZ DONE A ANVAN TOUT BAGAY
      const { data: pinCheck, error: pinErr } = await supabase
        .from('profiles')
        .select('transaction_pin, wallet_balance')
        .eq('id', profile.id)
        .single();
        
      if (pinErr || !pinCheck) throw new Error("Nou pa jwenn kont ou.");
      if (pinCheck.transaction_pin !== enteredPin) {
        throw new Error("❌ PIN ou antre a pa bon. Tranzaksyon an anile.");
      }
      
      // Asire nou lajan an la vre vre nan baz done a nan menm segonn nan
      if (currentAmount > Number(pinCheck.wallet_balance)) {
         throw new Error("Ou pa gen ase kòb pou tranzaksyon sa a.");
      }

      // B) KOUPE LAJAN AN NAN BALANS LA
      const nouvoBalans = Number(pinCheck.wallet_balance) - currentAmount;
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ wallet_balance: nouvoBalans })
        .eq('id', profile.id);

      if (balanceError) throw new Error("Erè nan mizajou balans ou an. Tanpri re-eseye.");

      // C) EKRI RESI RETRÈ A (Ak yon makè si se yon gwo tranzaksyon)
      const withdrawalMethod = isLargeWithdrawal ? 'VIP_LARGE_TRANSFER' : method;
      const withdrawalPhone = isLargeWithdrawal ? 'Pral bay li bay Sèvis Kliyan' : phone;

      const { error: withdrawError } = await supabase.from('withdrawals').insert([{
        user_id: profile.id,
        amount: currentAmount,
        fee: withdrawFee,
        net_amount: netAmount,
        method: withdrawalMethod,
        phone: withdrawalPhone,
        user_email: profile.email, 
        status: 'pending'
      }]);

      if (withdrawError) {
        // ROLLBACK SI L PA MACHE
        await supabase.from('profiles').update({ wallet_balance: pinCheck.wallet_balance }).eq('id', profile.id);
        throw new Error("Sistèm nan jwenn yon pwoblèm. Nou remèt kòb la sou balans ou.");
      }

      // D) VOYE NOTIFIKASYON TELEGRAM
      const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
      const CHAT_ID = '8392894841';
      const msg = isLargeWithdrawal 
        ? `🚨 *GWO DEMANN RETRÈ VIP*\n\n👤: ${profile.full_name}\n💰 Montan: ${currentAmount} HTG\n⚠️ _Montan an plis pase 15,000 HTG. Kliyan an ap kontakte w pou l ba w kote l vle kòb la. Li deja koupe sou balans li._`
        : `💸 *DEMANN RETRÈ NOUVO*\n\n👤: ${profile.full_name}\n💰 Brits: ${currentAmount} HTG\n📉 Frè (5%): ${withdrawFee} HTG\n✅ Nèt pou voye: ${netAmount} HTG\n📲: ${method} (${phone})\n\n_Kòb la deja retire sou balans kliyan an_`;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' })
      });

      setShowPinPrompt(false);
      
      if (isLargeWithdrawal) {
          alert("✅ Demann ou a pase! Piske se yon gwo sòm (Plis pase 15,000 HTG), tanpri kontakte Sèvis Kliyan pou n bay kote nou dwe voye kòb la pou ou.");
      } else {
          alert("✅ Retrè voye! Kòb la retire sou balans ou. N ap voye l nan 15-45 minit.");
      }
      
      router.push('/dashboard');

    } catch (err: any) {
      setPinError(err.message);
      setEnteredPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic relative">
      
      {/* ==================================================== */}
      {/* POPUP: MANDE PIN POU KONFIME RETRÈ A                   */}
      {/* ==================================================== */}
      {showPinPrompt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-[#121420] border border-white/10 p-8 rounded-[2.5rem] w-full max-w-sm text-center shadow-2xl">
            <h2 className="text-lg font-black uppercase text-white mb-2">Konfime Retrè a</h2>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-6">
              Mete PIN 4 chif ou a pou w ka retire {currentAmount.toLocaleString()} HTG sou kont ou.
            </p>
            
            <input 
              type="password" maxLength={4} autoFocus placeholder="••••" 
              value={enteredPin} onChange={(e) => setEnteredPin(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-black border border-white/10 p-4 rounded-2xl text-center text-2xl font-black tracking-[1em] outline-none focus:border-red-600 mb-6 text-red-500"
            />

            {pinError && (
               <p className="text-[10px] text-red-500 font-black uppercase mb-4 animate-pulse">{pinError}</p>
            )}
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPinPrompt(false)} disabled={loading}
                className="flex-1 bg-zinc-800 py-4 rounded-2xl font-black uppercase text-[10px] text-white active:scale-95 transition-all"
              >
                ANILE
              </button>
              <button 
                onClick={executeWithdrawal} disabled={loading || enteredPin.length !== 4}
                className="flex-1 bg-red-600 py-4 rounded-2xl font-black uppercase text-[10px] text-white active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "..." : "KONFIME"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* PAJ NORMAL LA (Fòm Retrè a)                            */}
      {/* ==================================================== */}
      <div className={`transition-all duration-300 ${showPinPrompt ? 'opacity-30 pointer-events-none blur-sm' : ''}`}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5">←</button>
            <h1 className="text-xl font-black uppercase text-red-600">Retire Fon</h1>
          </div>

          <div className="space-y-6">
            <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <p className="text-[10px] text-center mb-4 text-zinc-500 uppercase font-black tracking-widest">Balans ou: {profile?.wallet_balance?.toLocaleString() || 0} HTG</p>
                <div className="flex items-center justify-center gap-2">
                   <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-transparent text-5xl font-black text-center outline-none text-white" placeholder="0" />
                </div>
                
                {currentAmount > 0 && !isLargeWithdrawal && (
                  <div className="mt-6 pt-6 border-t border-white/5 text-[10px] uppercase space-y-2">
                    <div className="flex justify-between text-zinc-500"><span>Frè Hatex (5%):</span><span className="font-bold">-{withdrawFee.toFixed(2)} HTG</span></div>
                    <div className="flex justify-between font-black text-red-500 text-sm"><span>Nèt pou resevwa:</span><span>{netAmount.toFixed(2)} HTG</span></div>
                  </div>
                )}
                
                {/* Mesaj GWO SÒM (Pou retrè > 15,000) */}
                {isLargeWithdrawal && (
                  <div className="mt-6 pt-6 border-t border-white/5">
                     <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center">
                        <span className="text-lg mb-2 block">🌟</span>
                        <p className="text-[9px] font-black uppercase text-yellow-500 tracking-widest leading-relaxed">
                          Ou ap retire plis pase 15,000 HTG.<br/>
                          Transfè sa a p ap gen frè otomatikman, men w ap bezwen bay nou yon kote pou n depoze l (Zelle, CashApp, Bank, etc.).<br/>
                          Nou pral retire l sou balans ou a, apre sa y ap kontakte w oswa ou ka ekri sipò nou.
                        </p>
                     </div>
                  </div>
                )}
            </div>
            
            {/* Si l ap retire anba 15,000 HTG, li dwe bay nimewo MonCash/NatCash nòmal li */}
            {!isLargeWithdrawal && (
                <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 space-y-4">
                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-2">Metòd Pèman</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full bg-black/50 p-5 rounded-2xl border border-white/5 text-xs font-black italic outline-none">
                        <option value="MonCash">MonCash</option>
                        <option value="NatCash">NatCash</option>
                    </select>
                    
                    <label className="text-[9px] font-black text-zinc-500 uppercase ml-2">Nimewo Kont / Telefòn</label>
                    <input type="text" placeholder="EG: 44332211" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-black/50 p-5 rounded-2xl outline-none border border-white/5 text-xs font-black italic" />
                </div>
            )}

            <button 
              onClick={initiateWithdrawal} 
              disabled={loading || currentAmount <= 0} 
              className={`w-full py-6 rounded-full font-black uppercase text-sm transition-all shadow-xl ${loading ? 'bg-zinc-800 opacity-50' : 'bg-red-600 active:scale-95 shadow-red-600/20'}`}
            >
              Konfime ak Retire
            </button>

            <p className="text-[9px] text-center text-zinc-600 uppercase font-bold leading-relaxed">
              Lè w klike sou bouton an epi w mete PIN ou a, kòb la ap retire otomatikman sou balans Hatex ou a.
            </p>
          </div>
      </div>
    </div>
  );
}