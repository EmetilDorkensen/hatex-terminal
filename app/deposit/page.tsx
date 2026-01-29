"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function DepositPage() {
    const router = useRouter();
    
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [step, setStep] = useState(1);
    const [method, setMethod] = useState('MonCash');
    const [amount, setAmount] = useState<number>(0);
    const [txnId, setTxnId] = useState('');
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const [files, setFiles] = useState<{ f1: File | null, f2: File | null }>({ f1: null, f2: null });

    const paymentInfo = {
        'MonCash': { number: '37201241', name: 'Emetil Dorkensen' },
        'NatCash': { number: '41242743', name: 'SEXE SEKS' }
    };

    useEffect(() => {
        const getProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                // Nou mete email la nan profile la tou pou sekirite
                setProfile({ ...(profileData || {}), id: user.id, email: user.email });
                setCheckingAuth(false);
            } else {
                router.replace('/login');
            }
        };
        getProfile();
    }, [router, supabase]);

    const fee = amount * 0.05;
    const total = amount + fee;

    const handleFileUpload = async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile?.id}/${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('proofs').upload(fileName, file, { upsert: true });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(data.path);
        return publicUrl;
    };

    const handleSubmitManual = async () => {
        if (!txnId || !files.f1) return alert("Tanpri antre ID tranzaksyon an ak foto prèv la.");
        
        setLoading(true);
        
        try {
            // 1. Rekipere itilizatè a ki konekte a (Gid sekirite: Toujou verifye sesyon an anvan aksyon kritik)
            const { data: { user }, error: authError } = await supabase.auth.getUser();
    
            if (authError || !user) {
                alert("Sesyon ou ekspire. Tanpri rekonekte.");
                router.push('/login');
                return;
            }
    
            // 2. Telechaje foto yo
            const url1 = await handleFileUpload(files.f1!);
            const url2 = files.f2 ? await handleFileUpload(files.f2) : url1;
            
            // 3. Antre done yo nan baz de done a
            const { error } = await supabase.from('deposits').insert([{
                user_id: user.id,            
                amount: Number(amount),      
                fee: Number(fee),
                total_to_pay: Number(total),
                method: method,
                user_email: user.email,      // Asire nou email la soti nan sesyon auth la pou evite NULL
                transaction_id: txnId,
                proof_img_1: url1,
                proof_img_2: url2,
                status: 'pending',
            }]);
    
            if (error) throw error;

            // 4. Notifikasyon Telegram (Opsyonèl men itil pou admin)
            const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
            const CHAT_ID = '8392894841';
            const msg = `🔔 *DEPO HATEX NOUVO*\n👤: ${profile?.full_name || 'Kliyan'}\n📧: ${user.email}\n💰: ${amount} HTG\n🆔: ${txnId}`;
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, photo: url1, caption: msg, parse_mode: 'Markdown' })
            });
    
            alert("Bravo! Depo w lan anrejistre. N ap verifye l talè.");
            router.push('/dashboard');
            
        } catch (err: any) {
            console.error("Erè depo:", err.message);
            alert("Erè: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (checkingAuth) {
        return (
            <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
                <div className="text-red-600 font-black animate-pulse uppercase italic tracking-widest text-sm">
                    Verifye sekirite HatexCard...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic relative uppercase">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => step === 2 ? setStep(1) : router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-white/5">←</button>
                <h1 className="text-xl font-black text-red-600 tracking-tighter">Depoze Fon</h1>
            </div>
            
            {step === 1 ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setMethod('MonCash')} className={`p-6 rounded-3xl border transition-all font-black text-xs ${method === 'MonCash' ? 'border-red-600 bg-red-600/20 text-white' : 'border-white/5 bg-zinc-900 text-zinc-500'}`}>MONCASH</button>
                        <button onClick={() => setMethod('NatCash')} className={`p-6 rounded-3xl border transition-all font-black text-xs ${method === 'NatCash' ? 'border-red-600 bg-red-600/20 text-white' : 'border-white/5 bg-zinc-900 text-zinc-500'}`}>NATCASH</button>
                    </div>

                    <div className="bg-zinc-900/50 p-8 rounded-[2.5rem] border border-white/5 text-center backdrop-blur-sm">
                        <p className="text-[10px] mb-4 text-zinc-500 font-black tracking-widest">KONBE OU VLE DEPOZE?</p>
                        <input type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-transparent text-5xl font-black text-center outline-none text-white placeholder-zinc-800" placeholder="0" />
                        
                        <div className="mt-6 pt-6 border-t border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-zinc-500">
                                <span className="text-[9px] font-black">FRAIS (5%):</span>
                                <span className="text-xs font-bold">{fee.toFixed(2)} HTG</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] font-black text-zinc-400">TOTAL POU VOYE:</span>
                                <span className="text-xl font-black text-red-600">{total.toFixed(2)} HTG</span>
                            </div>
                        </div>
                    </div>

                    <button onClick={() => amount >= 500 ? setStep(2) : alert("Minimòm depo se 500 HTG")} className="w-full bg-red-600 py-6 rounded-full font-black text-sm shadow-lg shadow-red-600/20 active:scale-95 transition-all">
                        KONTINYE
                    </button>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="bg-white text-black p-8 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden">
                        <p className="text-[10px] font-black mb-1 opacity-60">VOYE {total.toFixed(2)} HTG SOU:</p>
                        <h2 className="text-4xl font-black mb-2 tracking-tighter">{paymentInfo[method as keyof typeof paymentInfo].number}</h2>
                        <p className="text-[10px] font-black bg-red-600 text-white inline-block px-5 py-2 rounded-full shadow-md italic">NON: {paymentInfo[method as keyof typeof paymentInfo].name}</p>
                    </div>

                    <div className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-white/5 space-y-4 backdrop-blur-sm">
                        <label className="text-[9px] text-zinc-500 font-black ml-2 uppercase">ID Tranzaksyon {method}</label>
                        <input type="text" placeholder="ANTRE ID LA LA" value={txnId} onChange={(e) => setTxnId(e.target.value)} className="w-full bg-black/60 p-5 rounded-2xl outline-none text-xs border border-white/10 focus:border-red-600 font-bold" />
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <input type="file" id="f1" hidden onChange={(e) => setFiles({...files, f1: e.target.files![0]})} />
                                <label htmlFor="f1" className={`h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${files.f1 ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-white/10 text-zinc-600 hover:border-red-600'}`}>
                                    <span className="text-xl">{files.f1 ? '✅' : '📸'}</span>
                                    <span className="text-[8px] font-black mt-1">PRÈV 1</span>
                                </label>
                            </div>
                            <div>
                                <input type="file" id="f2" hidden onChange={(e) => setFiles({...files, f2: e.target.files![0]})} />
                                <label htmlFor="f2" className={`h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${files.f2 ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-white/10 text-zinc-600 hover:border-red-600'}`}>
                                    <span className="text-xl">{files.f2 ? '✅' : '📸'}</span>
                                    <span className="text-[8px] font-black mt-1">PRÈV 2 (OPSYON)</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleSubmitManual} disabled={loading} className="w-full bg-white text-black py-6 rounded-full font-black text-sm shadow-xl hover:bg-red-600 hover:text-white transition-all disabled:opacity-50">
                        {loading ? 'Y AP ANREJISTRE...' : 'MWEN VOYE KÒB LA'}
                    </button>
                </div>
            )}
        </div>
    );
}