"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation'; // Enpòte router la

export default function AdminSuperPage() {
    const router = useRouter(); // Inisyalize router la
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre'>('depo');
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Telegram Config
    const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
    const CHAT_ID = '8392894841';

    const voyeNotifikasyon = async (mesaj: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: mesaj, parse_mode: 'Markdown' })
            });
        } catch (e) { console.error(e); }
    };

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*, profiles(full_name, wallet_balance)').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*, profiles(full_name, wallet_balance)').order('created_at', { ascending: false });
        if (d) setDeposits(d);
        if (w) setWithdrawals(w);
        setLoading(false);
    };

    useEffect(() => { raleDone(); }, []);

    // APWOUVE DEPO (Ajoute kòb)
    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve ${d.amount} HTG?`)) return;
        const nouvoBalans = Number(d.profiles.wallet_balance || 0) + Number(d.amount);
        
        await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
        await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
        
        await voyeNotifikasyon(`✅ *DEPO APWOUVE*\n👤 ${d.profiles?.full_name}\n💰 +${d.amount} HTG`);
        raleDone();
    };

    // KONFIME RETRÈ (Kòb la sipoze deja retire nan balans lan lè kliyan an te fè demann lan)
    const finPeyeRetre = async (w: any) => {
        if (!confirm(`Èske ou fin voye kòb la bay ${w.profiles?.full_name}?`)) return;

        const { error } = await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
        if (!error) {
            await voyeNotifikasyon(`💸 *RETRÈ FIN PEYE*\n👤 ${w.profiles?.full_name}\n💵 ${w.amount} HTG`);
            alert("Siksè!");
            raleDone();
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 italic font-sans pb-24">
            <h1 className="text-xl font-black text-red-600 mb-6 uppercase text-center">Admin Hatex</h1>
            
            <div className="flex gap-2 mb-6">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl font-black text-xs ${view === 'depo' ? 'bg-red-600' : 'bg-zinc-900'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl font-black text-xs ${view === 'retre' ? 'bg-red-600' : 'bg-zinc-900'}`}>RETRÈ</button>
            </div>

            {loading ? <p className="text-center">Chajman...</p> : (
                <div className="space-y-4">
                    {view === 'depo' ? deposits.map(d => (
                        <div key={d.id} className="bg-zinc-900 p-5 rounded-[2rem] border border-white/5">
                            <p className="font-bold text-[10px] text-zinc-400">{d.profiles?.full_name}</p>
                            <p className="text-2xl font-black text-green-500">{d.amount} HTG</p>
                            <div className="flex gap-2 mt-4">
                                <a href={d.proof_img_1} target="_blank" className="flex-1 bg-zinc-800 py-3 rounded-xl text-center text-[10px]">FOTO</a>
                                {d.status === 'pending' && <button onClick={() => apwouveDepo(d)} className="flex-1 bg-white text-black py-3 rounded-xl text-[10px] font-black">APWOUVE</button>}
                            </div>
                        </div>
                    )) : withdrawals.map(w => (
                        <div key={w.id} className="bg-zinc-900 p-5 rounded-[2rem] border border-red-600/20">
                            <p className="font-bold text-[10px] text-zinc-400">{w.profiles?.full_name}</p>
                            <p className="text-2xl font-black text-red-500">{w.amount} HTG</p>
                            <p className="text-[11px] mt-2 bg-black/40 p-2 rounded-lg">{w.method}: {w.phone || w.account_number}</p>
                            {w.status === 'pending' && <button onClick={() => finPeyeRetre(w)} className="w-full mt-4 bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase">Konfime Pèman</button>}
                        </div>
                    ))}
                </div>
            )}

            <button onClick={() => router.push('/dashboard')} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 px-8 py-3 rounded-full text-[10px] font-black border border-white/10">
                TOUNEN NAN DASHBOARD
            </button>
        </div>
    );
}