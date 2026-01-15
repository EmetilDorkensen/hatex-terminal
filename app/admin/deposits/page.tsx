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

    useEffect(() => {
        fetchDeposits();
    }, []);

    const fetchDeposits = async () => {
        const { data } = await supabase
            .from('deposits')
            .select('*, profiles(full_name, wallet_balance)')
            .order('created_at', { ascending: false });
        if (data) setDeposits(data);
        setLoading(false);
    };

    const approveDeposit = async (dep: any) => {
        const newBalance = Number(dep.profiles.wallet_balance) + Number(dep.amount);
        
        // 1. Mete depo a "approved"
        await supabase.from('deposits').update({ status: 'approved' }).eq('id', dep.id);
        
        // 2. Ajoute kòb la sou balans kliyan an
        await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', dep.user_id);
        
        alert("Depo apwouve! Kliyan an resevwa kòb li.");
        fetchDeposits();
    };

    return (
        <div className="min-h-screen bg-black text-white p-4">
            <h1 className="text-2xl font-black mb-6 text-red-600">ADMIN: DEPO PENDING</h1>
            
            <div className="space-y-4">
                {deposits.map((dep) => (
                    <div key={dep.id} className="bg-zinc-900 p-4 rounded-3xl border border-white/5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="font-bold text-lg">{dep.profiles?.full_name}</p>
                                <p className="text-xs text-zinc-500">{dep.method} - {dep.transaction_id}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${dep.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-500'}`}>
                                {dep.status.toUpperCase()}
                            </span>
                        </div>

                        <div className="bg-black/50 p-3 rounded-2xl mb-4">
                            <p className="text-xs text-zinc-400">Montan pou ajoute:</p>
                            <p className="text-xl font-black text-green-500">{dep.amount} HTG</p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <a href={dep.proof_img_1} target="_blank" className="text-[10px] bg-white/5 p-2 rounded-lg text-center">Gade Prèv 1</a>
                            {dep.proof_img_2 && <a href={dep.proof_img_2} target="_blank" className="text-[10px] bg-white/5 p-2 rounded-lg text-center">Gade Prèv 2</a>}
                        </div>

                        {dep.status === 'pending' && (
                            <button 
                                onClick={() => approveDeposit(dep)}
                                className="w-full bg-red-600 py-4 rounded-2xl font-black uppercase text-xs"
                            >
                                Apwouve Depo a
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}