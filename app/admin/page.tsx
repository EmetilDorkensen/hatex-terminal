"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminSuperPage() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre'>('depo');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    
    // --- NOUVO: SISTÈM PIN POU AKSÈ ---
    const [pinInput, setPinInput] = useState("");
    const [isAuthorized, setIsAuthorized] = useState(false);
    const ADMIN_SECRET_PIN = "2024"; // Chanje PIN sa a si w vle

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const BOT_TOKEN = "7547464134:AAH3M_R89D0UuN-WlOclj2D-Hj9S9I_K28Y";
    const CHAT_ID = "5352352512";

    const checkPin = () => {
        if (pinInput === ADMIN_SECRET_PIN) {
            setIsAuthorized(true);
            raleDone();
        } else { alert("PIN ENKORÈK!"); }
    };

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
        setDeposits(d || []);
        setWithdrawals(w || []);
        setLoading(false);
    };

    useEffect(() => { if(isAuthorized) raleDone(); }, [isAuthorized]);

    const voyeTelegram = async (msg: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'HTML' }),
            });
        } catch (e) { console.error("Telegram error", e); }
    };

    // --- FONKSYON POU DEBLOKE KYC ---
    const deblokeKYC = async (userId: string) => {
        if (!confirm("Debloke KYC ak Kat kliyan sa a?")) return;
        const { error } = await supabase.from('profiles').update({ 
            kyc_status: 'approved', 
            is_activated: true 
        }).eq('id', userId);
        if (!error) alert("✅ KYC Debloke!");
    };

    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve depo ${d.amount} HTG?`)) return;
        setProcessingId(d.id);
        try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (!p) throw new Error("Kliyan pa jwenn");

            const nouvoBalans = Number(p.wallet_balance || 0) + Number(d.amount);
            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
            
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: Number(d.amount), fee: 0,
                type: 'DEPOSIT', description: `Depo konfime: +${d.amount} HTG`, status: 'success', method: 'WALLET' 
            });

            await voyeTelegram(`✅ <b>DEPO APWOUVE</b>\nKliyan: ${p.full_name}\nMontan: ${d.amount} HTG`);
            alert("✅ DEPO APWOUVE!");
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    // --- PAJ PIN SI OU POKO ANTRE ---
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center p-6 text-white uppercase italic">
                <h1 className="text-red-600 font-black text-2xl mb-6 tracking-tighter">ADMIN HATEX</h1>
                <div className="bg-zinc-900 p-8 rounded-[2.5rem] border border-white/5 w-full max-w-sm">
                    <input 
                        type="password" 
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        className="w-full bg-black border border-white/10 p-4 rounded-xl mb-4 text-center text-2xl font-black"
                        placeholder="PIN"
                    />
                    <button onClick={checkPin} className="w-full bg-red-600 py-4 rounded-xl font-black">ANTRE</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 uppercase italic">
            <div className="max-w-md mx-auto flex justify-between items-center mb-10">
                <h1 className="text-2xl font-black text-red-600 italic">ADMIN SUPER</h1>
                <button onClick={raleDone} className="bg-zinc-800 p-3 rounded-xl text-[10px] font-black">Refresh</button>
            </div>

            <div className="flex gap-2 mb-8 max-w-md mx-auto">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs font-black ${view === 'depo' ? 'bg-red-600' : 'bg-zinc-900'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs font-black ${view === 'retre' ? 'bg-red-600' : 'bg-zinc-900'}`}>RETRÈ</button>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
                {(view === 'depo' ? deposits : withdrawals).map((item) => (
                    <div key={item.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5">
                        <div className="flex justify-between mb-4">
                            <span className="text-[9px] text-zinc-500 font-bold">ID: {item.user_id?.slice(0,8)}</span>
                            <button 
                                onClick={() => deblokeKYC(item.user_id)}
                                className="text-[8px] bg-blue-600 px-2 py-1 rounded text-white font-black"
                            >
                                DEBLOKE KYC
                            </button>
                        </div>

                        <p className="text-4xl font-black mb-6 italic">{item.amount} <span className="text-xs text-red-600">HTG</span></p>

                        <div className="flex gap-2">
                            {item.status === 'pending' && (
                                <button 
                                    disabled={processingId === item.id}
                                    onClick={() => view === 'depo' ? apwouveDepo(item) : null} 
                                    className="flex-1 bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase"
                                >
                                    {processingId === item.id ? 'Loading...' : 'Apwouve'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}