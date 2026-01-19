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

    const modifyeDepo = async (d: any) => {
        const nouvoMontan = prompt(`Modifye montan pou ${d.profiles?.full_name}:`, d.amount);
        if (nouvoMontan !== null && !isNaN(Number(nouvoMontan))) {
            const { error } = await supabase.from('deposits').update({ amount: Number(nouvoMontan) }).eq('id', d.id);
            if (!error) { alert("Montan modifye!"); raleDone(); }
        }
    };

    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve ${d.amount} HTG pou ${d.profiles?.full_name}?`)) return;

        // 1. Kalkile nouvo balans lan
        const nouvoBalans = Number(d.profiles.wallet_balance || 0) + Number(d.amount);

        // 2. Mizajou Balans Profile la
        const { error: err1 } = await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
        
        // 3. Mizajou Status Depo a
        const { error: err2 } = await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);

        if (!err1 && !err2) {
            // 4. Kreye tranzaksyon nan Istorik (Transactions Table)
            await supabase.from('transactions').insert({
                user_id: d.user_id,
                amount: Number(d.amount),
                type: 'DEPOSIT',
                description: 'Depo HTG konfime',
                status: 'success',
                method: 'SISTÈM'
            });

            await voyeNotifikasyon(`✅ *DEPO APWOUVE*\n👤 ${d.profiles?.full_name}\n💰 +${d.amount} HTG\n📈 Balans: ${nouvoBalans} HTG`);
            alert("Depo apwouve ak siksè!");
            raleDone();
        } else {
            alert("Gen yon erè ki rive.");
        }
    };

    const anileDepo = async (d: any) => {
        const rezon = prompt("Poukisa w ap anile depo sa a?");
        if (rezon) {
            // 1. Mizajou status depo a kòm rejected
            const { error } = await supabase.from('deposits').update({ 
                status: 'rejected', 
                admin_notes: rezon 
            }).eq('id', d.id);

            if (!error) {
                // 2. Kreye tranzaksyon anile nan Istorik
                await supabase.from('transactions').insert({
                    user_id: d.user_id,
                    amount: Number(d.amount),
                    type: 'DEPOSIT',
                    description: 'Depo anile',
                    status: 'rejected',
                    admin_notes: rezon,
                    method: 'SISTÈM'
                });

                await voyeNotifikasyon(`❌ *DEPO ANILE*\n👤 ${d.profiles?.full_name}\n📝 Rezon: ${rezon}`);
                alert("Depo anile!");
                raleDone();
            }
        }
    };

    const finPeyeRetre = async (w: any) => {
        if (!confirm(`Èske ou fin voye kòb la bay ${w.profiles?.full_name}?`)) return;
        
        const { error } = await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
        
        if (!error) {
            // Kreye tranzaksyon pou retrè a fini
            await supabase.from('transactions').insert({
                user_id: w.user_id,
                amount: -Number(w.amount), // Negatif paske kòb la soti
                type: 'WITHDRAWAL',
                description: 'Retrè konfime',
                status: 'success',
                method: 'SISTÈM'
            });

            await voyeNotifikasyon(`💸 *RETRÈ FIN PEYE*\n👤 ${w.profiles?.full_name}\n💵 ${w.amount} HTG`);
            alert("Retrè konfime!");
            raleDone();
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 italic font-sans pb-24 uppercase">
            <h1 className="text-xl font-black text-red-600 mb-6 text-center tracking-tighter">Admin Hatex</h1>
            
            <div className="flex gap-2 mb-6 max-w-md mx-auto font-black">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>RETRÈ</button>
            </div>

            {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div> : (
                <div className="space-y-4 max-w-md mx-auto">
                    {view === 'depo' ? deposits.map(d => (
                        <div key={d.id} className="bg-zinc-900 p-5 rounded-[2.5rem] border border-white/5 shadow-2xl">
                            <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-[9px] text-zinc-500 tracking-widest truncate max-w-[150px]">{d.profiles?.full_name}</p>
                                <span className={`text-[8px] px-3 py-1 rounded-full font-black ${d.status === 'approved' ? 'bg-green-500 text-white' : d.status === 'rejected' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black'}`}>
                                    {d.status}
                                </span>
                            </div>
                            <p className="text-3xl font-black mb-5">{d.amount} <span className="text-xs text-red-600">HTG</span></p>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <a href={d.proof_img_1} target="_blank" className="bg-zinc-800 py-3 rounded-xl text-center text-[10px] font-black border border-white/5">GADE PRÈV</a>
                                {d.status === 'pending' && (
                                    <button onClick={() => modifyeDepo(d)} className="bg-zinc-700 py-3 rounded-xl text-[10px] font-black uppercase">Modifye</button>
                                )}
                            </div>

                            {d.status === 'pending' && (
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <button onClick={() => apwouveDepo(d)} className="bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase shadow-lg">Apwouve</button>
                                    <button onClick={() => anileDepo(d)} className="bg-red-600 text-white py-4 rounded-xl text-[10px] font-black uppercase">Anile</button>
                                </div>
                            )}
                        </div>
                    )) : withdrawals.map(w => (
                        <div key={w.id} className="bg-zinc-900 p-5 rounded-[2.5rem] border border-white/5">
                            <div className="flex justify-between mb-2">
                                <p className="font-bold text-[9px] text-zinc-500 tracking-widest">{w.profiles?.full_name}</p>
                                <span className={`text-[8px] px-3 py-1 rounded-full font-black ${w.status === 'completed' ? 'bg-blue-600' : 'bg-red-600'}`}>{w.status}</span>
                            </div>
                            <p className="text-3xl font-black mb-3">{w.amount} <span className="text-xs text-red-600">HTG</span></p>
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-4">
                                <p className="text-[9px] text-red-600 font-black mb-1">{w.method}</p>
                                <p className="text-xs font-black tracking-tighter">{w.phone || w.account_number}</p>
                            </div>
                            {w.status === 'pending' && <button onClick={() => finPeyeRetre(w)} className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase">Konfime Pèman</button>}
                        </div>
                    ))}
                </div>
            )}

            <button onClick={() => router.push('/dashboard')} className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-xl px-8 py-4 rounded-full text-[9px] font-black border border-white/10 tracking-widest shadow-2xl">
                Tounen nan Dashboard
            </button>
        </div>
    );
}