"use client";
import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function KatPage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                setProfile(data);
            }
            setLoading(false);
        };
        fetchProfile();
    }, [supabase]);

    if (loading) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white">Chaje...</div>;

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic">
            <h1 className="text-xl font-black uppercase text-red-600 mb-8">Ma Carte Hatex</h1>

            {/* KAT VIRTYÈL LA */}
            <div className="relative w-full aspect-[1.58/1] bg-gradient-to-br from-zinc-800 to-black rounded-[2rem] p-8 shadow-2xl border border-white/10 overflow-hidden mb-10">
                {/* Logo & Chip */}
                <div className="flex justify-between items-start mb-12">
                    <div className="w-12 h-10 bg-gradient-to-tr from-yellow-500 to-yellow-200 rounded-md opacity-80" />
                    <span className="text-2xl font-black italic text-red-600">HATEX</span>
                </div>

                {/* Nimewo Kat la */}
                <div className="mb-8">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-2">Card Number</p>
                    <p className="text-2xl font-mono tracking-[0.2em] shadow-sm">
                        {profile?.kyc_status === 'approved' ? profile?.card_number : "**** **** **** ****"}
                    </p>
                </div>

                {/* Detay: Dat ak CVV */}
                <div className="flex gap-10">
                    <div>
                        <p className="text-[8px] uppercase text-zinc-500">Expiry</p>
                        <p className="text-sm font-bold">{profile?.kyc_status === 'approved' ? profile?.card_expiry : "00/00"}</p>
                    </div>
                    <div>
                        <p className="text-[8px] uppercase text-zinc-500">CVV</p>
                        <p className="text-sm font-bold">{profile?.kyc_status === 'approved' ? profile?.card_cvv : "***"}</p>
                    </div>
                </div>

                {/* Non Mèt Kat la */}
                <div className="absolute bottom-8 left-8">
                    <p className="text-xs font-bold uppercase tracking-widest">{profile?.full_name || "Client Name"}</p>
                </div>
            </div>

            {/* MESAJ STATUS */}
            <div className="bg-zinc-900/50 p-6 rounded-[2rem] border border-white/5 text-center">
                {profile?.kyc_status !== 'approved' ? (
                    <div className="space-y-3">
                        <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto text-yellow-500">⚠️</div>
                        <p className="text-sm font-bold uppercase">Kat la an atant</p>
                        <p className="text-[10px] text-zinc-500">W ap wè enfòmasyon kat ou a depi nou fin verifye dokiman ou yo (KYC).</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto text-green-500">✓</div>
                        <p className="text-sm font-bold uppercase">Kat Aktif</p>
                        <p className="text-[10px] text-zinc-500">Ou ka itilize enfòmasyon sa yo pou fè acha anliy.</p>
                    </div>
                )}
            </div>
        </div>
    );
}