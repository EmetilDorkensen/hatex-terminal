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
    const [files, setFiles] = useState<{f1: File | null, f2: File | null}>({f1: null, f2: null});

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
            }
        };
        getProfile();
    }, [supabase]);

    const fee = amount * 0.05;
    const total = amount + fee;

    const handleFileUpload = async (file: File) => {
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from('proofs').upload(fileName, file);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(data.path);
        return publicUrl;
    };

    const notifyTelegram = async (imgUrl: string) => {
        const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY'; 
        const CHAT_ID = '8392894841'; 
        const msg = `🔔 *DEPO HATEX NOUVO*\n👤: ${profile?.full_name}\n💰: ${amount} HTG\n💳: ${method}\n🆔: ${txnId}`;
        
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, photo: imgUrl, caption: msg, parse_mode: 'Markdown' })
        });
    };

    const handleSubmit = async () => {
        if (!txnId || !files.f1) return alert("Ranpli ID Tranzaksyon ak omwen yon foto prèv");
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
            alert("Depo soumèt! N ap verifye sa nan 15-45 minit.");
            router.push('/dashboard');
        } catch (err: any) {
            alert("Erè: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic">
            <h1 className="text-xl font-black uppercase text-red-600 mb-8">Depoze Fon</h1>
            {step === 1 ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setMethod('MonCash')} className={`p-6 rounded-3xl border ${method === 'MonCash' ? 'border-red-600 bg-red-600/10' : 'border-white/5 bg-zinc-900'}`}>MONCASH</button>
                        <button onClick={() => setMethod('NatCash')} className={`p-6 rounded-3xl border ${method === 'NatCash' ? 'border-red-600 bg-red-600/10' : 'border-white/5 bg-zinc-900'}`}>NATCASH</button>
                    </div>
                    <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5 text-center">
                        <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full bg-transparent text-4xl font-black text-center outline-none" placeholder="0" />
                        <p className="text-[10px] mt-4 text-zinc-500 uppercase font-black tracking-widest">Total: {(total).toFixed(2)} HTG</p>
                    </div>
                    <button onClick={() => amount >= 500 ? setStep(2) : alert("Min 500 HTG")} className="w-full bg-red-600 py-6 rounded-full font-black uppercase text-sm">Kontinye</button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-white text-black p-6 rounded-[2.5rem] text-center font-black">
                        <p className="text-xs mb-2">VOYE KÒB LA SOU:</p>
                        <p className="text-lg uppercase">{method}: 4X XX XX XX</p>
                    </div>
                    <div className="bg-zinc-900 p-6 rounded-[2rem] border border-white/5 space-y-4">
                        <input type="text" placeholder="ID TRANZAKSYON" value={txnId} onChange={(e) => setTxnId(e.target.value)} className="w-full bg-black/40 p-4 rounded-xl outline-none text-xs border border-white/5" />
                        <div className="grid grid-cols-2 gap-2">
                            <input type="file" id="f1" hidden onChange={(e) => setFiles({...files, f1: e.target.files![0]})} />
                            <label htmlFor="f1" className={`h-20 rounded-xl border border-dashed flex items-center justify-center text-[8px] uppercase font-black ${files.f1 ? 'border-green-500 text-green-500' : 'border-white/10'}`}>Foto 1</label>
                            <input type="file" id="f2" hidden onChange={(e) => setFiles({...files, f2: e.target.files![0]})} />
                            <label htmlFor="f2" className={`h-20 rounded-xl border border-dashed flex items-center justify-center text-[8px] uppercase font-black ${files.f2 ? 'border-green-500 text-green-500' : 'border-white/10'}`}>Foto 2</label>
                        </div>
                    </div>
                    <button onClick={handleSubmit} disabled={loading} className="w-full bg-white text-black py-6 rounded-full font-black uppercase text-sm">
                        {loading ? 'Y ap voye...' : 'Finalize Depo'}
                    </button>
                </div>
            )}
        </div>
    );
}