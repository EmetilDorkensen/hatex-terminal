"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function AdminSuperPage() {
    const router = useRouter();
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre'>('depo');
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

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

    // FONKSYON POU MODIFYE MONTAN DEPO A
    const modifyeDepo = async (d: any) => {
        const nouvoMontan = prompt(`Modifye montan pou ${d.profiles?.full_name}:`, d.amount);
        
        if (nouvoMontan !== null && !isNaN(Number(nouvoMontan))) {
            const { error } = await supabase
                .from('deposits')
                .update({ amount: Number(nouvoMontan) })
                .eq('id', d.id);
            
            if (!error) {
                alert("Montan an modifye ak siksè!");
                raleDone();
            } else {
                alert("Erè nan modifikasyon an.");
            }
        }
    };

    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve ${d.amount} HTG pou ${d.profiles?.full_name}?`)) return;
        
        const nouvoBalans = Number(d.profiles.wallet_balance || 0) + Number(d.amount);
        
        const { error: profError } = await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
        const { error: depError } = await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
        
        if (!profError && !depError) {
            await voyeNotifikasyon(`✅ *DEPO APWOUVE*\n👤 ${d.profiles?.full_name}\n💰 Montan final: ${d.amount} HTG\n📈 Nouvo Balans: ${nouvoBalans} HTG`);
            alert("Depo apwouve!");
            raleDone();
        }
    };

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
            <h1 className="text-xl font-black text-red-600 mb-6 uppercase text-center tracking-tighter">Admin Hatex</h1>
            
            <div className="flex gap-2 mb-6 max-w-md mx-auto">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900'}`}>RETRÈ</button>
            </div>

            {loading ? <p className="text-center opacity-50 animate-pulse uppercase text-[10px] font-black">Chajman done yo...</p> : (
                <div className="space-y-4 max-w-md mx-auto">
                    {view === 'depo' ? deposits.map(d => (
                        <div key={d.id} className="bg-zinc-900 p-5 rounded-[2rem] border border-white/5 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-[10px] text-zinc-400 uppercase tracking-widest">{d.profiles?.full_name}</p>
                                <span className={`text-[8px] px-2 py-1 rounded-full font-black ${d.status === 'approved' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                                    {d.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-3xl font-black text-white">{d.amount} <span className="text-[10px] text-red-600">HTG</span></p>
                            
                            <div className="flex gap-2 mt-5">
                                <a href={d.proof_img_1} target="_blank" className="flex-1 bg-zinc-800 py-3 rounded-xl text-center text-[10px] font-bold border border-white/5">PRÈV</a>
                                
                                {d.status === 'pending' && (
                                    <>
                                        <button onClick={() => modifyeDepo(d)} className="flex-1 bg-zinc-700 text-white py-3 rounded-xl text-[10px] font-black border border-white/10 uppercase">Modifye</button>
                                        <button onClick={() => apwouveDepo(d)} className="flex-[1.5] bg-white text-black py-3 rounded-xl text-[10px] font-black uppercase">Apwouve</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )) : withdrawals.map(w => (
                        <div key={w.id} className="bg-zinc-900 p-5 rounded-[2rem] border border-red-600/20">
                            <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-[10px] text-zinc-400 uppercase tracking-widest">{w.profiles?.full_name}</p>
                                <span className={`text-[8px] px-2 py-1 rounded-full font-black ${w.status === 'completed' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                                    {w.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-3xl font-black text-white">{w.amount} <span className="text-[10px] text-red-600">HTG</span></p>
                            <div className="mt-3 bg-black/40 p-3 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{w.method}</p>
                                <p className="text-xs font-black tracking-widest">{w.phone || w.account_number}</p>
                            </div>
                            {w.status === 'pending' && <button onClick={() => finPeyeRetre(w)} className="w-full mt-4 bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase shadow-xl shadow-white/5">Konfime Pèman</button>}
                        </div>
                    ))}
                </div>
            )}

            <button onClick={() => router.push('/dashboard')} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800/80 backdrop-blur-md px-10 py-4 rounded-full text-[9px] font-black border border-white/10 uppercase tracking-[0.2em] z-50">
                Tounen nan Dashboard
            </button>
        </div>
    );
}