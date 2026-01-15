"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminDeposits() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => { fetchDeposits(); }, []);

    const fetchDeposits = async () => {
        const { data } = await supabase
            .from('deposits')
            .select('*, profiles(full_name, wallet_balance)')
            .order('created_at', { ascending: false });
        if (data) setDeposits(data);
        setLoading(false);
    };

    const handleAction = async (dep: any, status: 'approved' | 'rejected') => {
        const confirmMsg = status === 'approved' ? `Apwouve ${dep.amount} HTG pou ${dep.profiles.full_name}?` : `Refize depo sa a?`;
        if (!confirm(confirmMsg)) return;

        if (status === 'approved') {
            const newBalance = Number(dep.profiles.wallet_balance || 0) + Number(dep.amount);
            // Mizajou Balans
            await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', dep.user_id);
        }

        // Mizajou Status Depo
        await supabase.from('deposits').update({ status }).eq('id', dep.id);
        
        alert("Operasyon an fèt ak siksè!");
        fetchDeposits();
    };

    if (loading) return <div className="p-10 text-white italic text-center">Chaje depo...</div>;

    return (
        <div className="min-h-screen bg-black text-white p-4 font-sans italic">
            <h1 className="text-xl font-black text-red-600 mb-6 uppercase tracking-tighter">Gestion Depo</h1>
            <div className="space-y-4">
                {deposits.map((dep) => (
                    <div key={dep.id} className="bg-zinc-900 border border-white/5 p-5 rounded-[2rem]">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="font-black text-sm uppercase">{dep.profiles?.full_name}</p>
                                <p className="text-[10px] text-zinc-500">{new Date(dep.created_at).toLocaleString()}</p>
                            </div>
                            <span className={`text-[8px] font-black px-3 py-1 rounded-full uppercase ${dep.status === 'pending' ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white'}`}>
                                {dep.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-black/50 p-3 rounded-2xl">
                                <p className="text-[9px] text-zinc-500 uppercase font-bold text-red-600">Montan</p>
                                <p className="text-lg font-black">{dep.amount} HTG</p>
                            </div>
                            <div className="bg-black/50 p-3 rounded-2xl">
                                <p className="text-[9px] text-zinc-500 uppercase font-bold text-red-600">ID Trans</p>
                                <p className="text-sm font-black truncate">{dep.transaction_id}</p>
                            </div>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <a href={dep.proof_img_1} target="_blank" className="flex-1 bg-zinc-800 py-3 rounded-xl text-[9px] font-black text-center uppercase">Gade Prèv</a>
                        </div>

                        {dep.status === 'pending' && (
                            <div className="flex gap-2">
                                <button onClick={() => handleAction(dep, 'rejected')} className="flex-1 bg-zinc-800 py-4 rounded-2xl font-black uppercase text-[10px]">Refize</button>
                                <button onClick={() => handleAction(dep, 'approved')} className="flex-[2] bg-white text-black py-4 rounded-2xl font-black uppercase text-[10px]">Apwouve</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}