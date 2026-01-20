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

    // 1. Rekiperasyon Profile
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

    // 2. Fonksyon MonCash (Anndan kò paj la kounye a)
    const handleMonCashPayment = async (montan: number) => {
        if (montan < 500) return alert("Depo minimòm lan se 500 HTG");
        try {
            setLoading(true);
            const res = await fetch('/api/moncash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    amount: montan,
                    userId: profile?.id // Nou sèvi ak profile.id pito
                }),
            });
            const data = await res.json();
            if (data.url) { window.location.href = data.url; }
        } catch (err) {
            alert("Erè koneksyon.");
        } finally { setLoading(false); }
    };

    const fee = amount * 0.05;
    const total = amount + fee;

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic">
            <h1 className="text-xl font-black text-red-600 mb-8 uppercase">Depoze Fon</h1>
            
            {/* ... Rès UI a (Bouton elatriye) ... */}
            <button 
                onClick={() => handleMonCashPayment(amount)}
                className="w-full bg-red-600 py-6 rounded-full font-black uppercase"
                disabled={loading}
            >
                {loading ? 'Ap chaje...' : 'Peye ak MonCash'}
            </button>
        </div>
    );
}