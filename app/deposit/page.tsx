"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function DepositPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [method, setMethod] = useState('MonCash');
    const [amount, setAmount] = useState<number>(0);
    const [txnId, setTxnId] = useState('');
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<{ f1: File | null, f2: File | null }>({ f1: null, f2: null });

    const paymentInfo = {
        'MonCash': { number: '37201241', name: 'Emetil Dorkensen' },
        'NatCash': { number: '41242743', name: 'SEXE SEKS' }
    };

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const getProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setProfile(data);
            } else {
                router.push('/login');
            }
        };
        getProfile();
    }, [supabase, router]);

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

    const notifyTelegram = async (imgUrl: string) => {
        const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
        const CHAT_ID = '8392894841';
        const msg = `🔔 *DEPO HATEX NOUVO*\n👤 Kliyan: ${profile?.full_name}\n📞 Tel: ${profile?.phone}\n💰 Montan Nèt: ${amount} HTG\n📉 Frais (5%): ${fee} HTG\n💸 Total pou peye: ${total} HTG\n💳 Metòd: ${method}\n🆔 Trans ID: ${txnId}`;
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    photo: imgUrl,
                    caption: msg,
                    parse_mode: 'Markdown'
                })
            });
        } catch (e) { console.error("Telegram error:", e); }
    };

    const handleSubmitManual = async () => {
        if (!txnId || !files.f1) return alert("Tanpri antre ID tranzaksyon an ak foto prèv la.");
        setLoading(true);
        try {
            const url1 = await handleFileUpload(files.f1!);
            const url2 = files.f2 ? await handleFileUpload(files.f2) : url1;
            const { error } = await supabase.from('deposits').insert([{
                user_id: profile.id,
                amount: amount,
                fee: fee,
                total_to_pay: total,
                method: method,
                transaction_id: txnId,
                proof_img_1: url1,
                proof_img_2: url2,
                status: 'pending'
            }]);
            if (error) throw error;
            await notifyTelegram(url1);
            alert("Depo w lan soumèt ak siksè! N ap verifye l nan 15 a 45 minit.");
            router.push('/dashboard');
        } catch (err: any) { alert("Erè: " + err.message); } 
        finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic relative">
            <h1 className="text-xl font-black uppercase text-red-600 mb-8">Depoze Fon</h1>
            
            {step === 1 ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setMethod('MonCash')} className={`p-6 rounded-3xl border transition-all ${method === 'MonCash' ? 'border-red-600 bg-red-600/20' : 'border-white/5 bg-zinc-900'}`}>MONCASH</button>
                        <button onClick={() => setMethod('NatCash')} className={`p-6 rounded-3xl border transition-all ${method === 'NatCash' ? 'border-red-600 bg-red-600/20' : 'border-white/5 bg-zinc-900'}`}>NATCASH</button>
                    </div>

                    <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5 text-center">
                        <p className="text-[10px] mb-4 text-zinc-500 uppercase font-black">Konbe ou vle depoze?</p>
                        <input type="number" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-transparent text-5xl font-black text-center outline-none text-white" placeholder="0" />
                        <div className="mt-6 pt-6 border-t border-white/5 flex justify-between items-center text-zinc-500">
                            <span className="text-[10px] uppercase font-black">Frais (5%):</span>
                            <span className="text-sm font-bold">{fee.toFixed(2)} HTG</span>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-[12px] uppercase font-black text-zinc-400">Total pou peye:</span>
                            <span className="text-xl font-black text-red-600">{total.toFixed(2)} HTG</span>
                        </div>
                    </div>

                    <button onClick={() => amount >= 500 ? setStep(2) : alert("Minimòm 500 HTG")} className="w-full bg-red-600 py-6 rounded-full font-black uppercase text-sm shadow-lg shadow-red-600/20">
                        Kontinye
                    </button>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="bg-white text-black p-8 rounded-[2.5rem] text-center">
                        <p className="text-[10px] font-black mb-1 opacity-60 uppercase">Voye {total.toFixed(2)} HTG sou:</p>
                        <h2 className="text-3xl font-black mb-1 tracking-tighter">{paymentInfo[method as keyof typeof paymentInfo].number}</h2>
                        <p className="text-xs font-black uppercase bg-black text-white inline-block px-4 py-1 rounded-full">Non: {paymentInfo[method as keyof typeof paymentInfo].name}</p>
                    </div>

                    <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 space-y-4">
                        <input type="text" placeholder="ID Tranzaksyon" value={txnId} onChange={(e) => setTxnId(e.target.value)} className="w-full bg-black/40 p-5 rounded-2xl outline-none text-xs border border-white/5 focus:border-red-600" />
                        <div className="grid grid-cols-2 gap-3 text-center">
                            <div>
                                <input type="file" id="f1" hidden onChange={(e) => setFiles({...files, f1: e.target.files![0]})} />
                                <label htmlFor="f1" className={`h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center ${files.f1 ? 'border-green-500 text-green-500' : 'border-white/10 text-zinc-500'}`}>
                                    <span>{files.f1 ? '✅' : '📸'}</span>
                                    <span className="text-[8px] uppercase font-black">Foto 1</span>
                                </label>
                            </div>
                            <div>
                                <input type="file" id="f2" hidden onChange={(e) => setFiles({...files, f2: e.target.files![0]})} />
                                <label htmlFor="f2" className={`h-24 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center ${files.f2 ? 'border-green-500 text-green-500' : 'border-white/10 text-zinc-500'}`}>
                                    <span>{files.f2 ? '✅' : '📸'}</span>
                                    <span className="text-[8px] uppercase font-black">Foto 2</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="w-1/3 bg-zinc-800 py-6 rounded-full font-black uppercase text-xs text-zinc-500">Retou</button>
                        <button onClick={handleSubmitManual} disabled={loading} className="flex-1 bg-white text-black py-6 rounded-full font-black uppercase text-sm">
                            {loading ? 'Y ap voye...' : 'Mwen voye kòb la'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}