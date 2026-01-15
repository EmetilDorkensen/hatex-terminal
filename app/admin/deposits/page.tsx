"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminSuperPage() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre'>('depo');
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*, profiles(full_name, wallet_balance)').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*, profiles(full_name, wallet_balance)').order('created_at', { ascending: false });
        if (d) setDeposits(d);
        if (w) setWithdrawals(w);
        setLoading(false);
    };

    useEffect(() => { raleDone(); }, []);

    const apwouveDepo = async (d: any) => {
        const nouvoBalans = Number(d.profiles.wallet_balance || 0) + Number(d.amount);
        await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
        await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
        alert("Depo apwouve!");
        raleDone();
    };

    const finPeyeRetre = async (w: any) => {
        await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
        alert("Retrè make kòm fin peye!");
        raleDone();
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 italic font-sans">
            <h1 className="text-xl font-black text-red-600 mb-6 uppercase text-center">Admin Dashboard</h1>
            
            <div className="flex gap-2 mb-6">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl font-black text-xs ${view === 'depo' ? 'bg-red-600' : 'bg-zinc-900 border border-white/5'}`}>DEPO ({deposits.filter(x=>x.status==='pending').length})</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl font-black text-xs ${view === 'retre' ? 'bg-red-600' : 'bg-zinc-900 border border-white/5'}`}>RETRÈ ({withdrawals.filter(x=>x.status==='pending').length})</button>
            </div>

            {loading ? <p className="text-center opacity-50">Y ap chache done...</p> : (
                <div className="space-y-4">
                    {view === 'depo' ? deposits.map(d => (
                        <div key={d.id} className="bg-zinc-900 p-5 rounded-[2rem] border border-white/5">
                            <div className="flex justify-between items-start mb-2">
                                <p className="font-bold uppercase text-[10px] text-zinc-400">{d.profiles?.full_name}</p>
                                <span className="text-[8px] bg-yellow-600 px-2 py-1 rounded-full">{d.status}</span>
                            </div>
                            <p className="text-2xl font-black text-green-500">{d.amount} HTG</p>
                            <p className="text-[10px] mb-4">ID: {d.transaction_id}</p>
                            <div className="flex gap-2">
                                <a href={d.proof_img_1} target="_blank" className="flex-1 bg-zinc-800 py-3 rounded-xl text-center text-[10px] font-bold">GADE FOTO</a>
                                {d.status === 'pending' && <button onClick={() => apwouveDepo(d)} className="flex-1 bg-white text-black py-3 rounded-xl text-[10px] font-black">APWOUVE</button>}
                            </div>
                        </div>
                    )) : withdrawals.map(w => (
                        <div key={w.id} className="bg-zinc-900 p-5 rounded-[2rem] border border-red-600/20">
                            <p className="font-bold uppercase text-[10px] text-zinc-400">{w.profiles?.full_name}</p>
                            <p className="text-2xl font-black text-red-500">{w.amount} HTG</p>
                            <p className="text-[10px] mb-4 text-zinc-400">Voyè sou: <b>{w.method} - {w.phone || w.account_number}</b></p>
                            {w.status === 'pending' && <button onClick={() => finPeyeRetre(w)} className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase">Mwen fin peye l</button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}