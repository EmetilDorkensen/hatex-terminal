"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminSuperPage() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre'>('depo');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
        setDeposits(d || []);
        setWithdrawals(w || []);
        setLoading(false);
    };

    useEffect(() => { raleDone(); }, []);

    // --- FONKSYON TÈS EMAIL ---
    const testEmailKoneksyon = async () => {
        const emailTest = prompt("dorkensen@gmail.com:");
        if (!emailTest) return;
        
        try {
            const res = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    to: emailTest.trim(), 
                    non: "Admin Hatex", 
                    mesaj: "Sa se yon tès pou verifye si notifikasyon yo ap mache.",
                    subject: "🔔 TEST KONEKSYON HATEX"
                }),
            });
            const data = await res.json();
            if (res.ok) {
                alert("✅ EMAIL TÈS LA PATI! Tcheke bwat Spam ou.");
            } else {
                alert("❌ ERÈ: " + (data.error || "API a refize voye l"));
            }
        } catch (error) {
            alert("❌ ERÈ KONEKSYON: Paj la pa jwenn fichye API a.");
        }
    };

    // --- FONKSYON VOYE EMAIL REYÈL ---
    const voyeEmailKliyan = async (email: string, non: string, mesaj: string) => {
        if (!email) return;
        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: email.trim(), subject: 'Mizajou Hatex Card', non, mesaj }),
            });
        } catch (error) { console.error("Erè imèl:", error); }
    };

    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve ${d.amount} HTG?`)) return;
        setProcessingId(d.id);
        try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (!p) throw new Error("Kliyan pa jwenn");

            const nouvoBalans = Number(p.wallet_balance || 0) + Number(d.amount);

            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
            
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: Number(d.amount), fee: 0,
                type: 'DEPOSIT', description: 'Depo apwouve', status: 'success', method: 'WALLET' 
            });

            await voyeEmailKliyan(p.email, p.full_name, `Depo ${d.amount} HTG ou a apwouve. Balans: ${nouvoBalans} HTG.`);
            alert("✅ DEPO APWOUVE!");
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 uppercase italic">
            
            {/* BOUTON TÈS LA ISIT LA */}
            <div className="max-w-md mx-auto mb-6 p-4 border border-blue-600/30 bg-blue-600/10 rounded-2xl">
                <p className="text-[10px] text-blue-400 mb-2 font-black text-center">DEBUG MODE</p>
                <button 
                    onClick={testEmailKoneksyon}
                    className="w-full bg-blue-600 py-3 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20"
                >
                    🧪 Teste Si Email Ap Pati
                </button>
            </div>

            <div className="max-w-md mx-auto flex justify-between items-center mb-6">
                <h1 className="text-xl font-black text-red-600 tracking-tighter">Admin Hatex</h1>
                <button onClick={raleDone} className="bg-zinc-800 px-4 py-2 rounded-xl text-[10px] font-black">Refresh</button>
            </div>

            <div className="flex gap-2 mb-6 max-w-md mx-auto font-black">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs ${view === 'depo' ? 'bg-red-600' : 'bg-zinc-900 text-zinc-500'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs ${view === 'retre' ? 'bg-red-600' : 'bg-zinc-900 text-zinc-500'}`}>RETRÈ</button>
            </div>

            {loading ? (
                <div className="text-center py-20 animate-pulse font-black text-xs">Y ap rale done...</div>
            ) : (
                <div className="space-y-4 max-w-md mx-auto">
                    {(view === 'depo' ? deposits : withdrawals).map((item) => (
                        <div key={item.id} className="bg-zinc-900 p-5 rounded-[2.5rem] border border-white/5 relative">
                            <div className="flex justify-between mb-2 pr-8">
                                <p className="font-bold text-[9px] text-zinc-500">ID: {item.user_id?.slice(0,8)}</p>
                                <span className={`text-[8px] px-3 py-1 rounded-full font-black ${item.status === 'approved' || item.status === 'completed' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-black'}`}>
                                    {item.status}
                                </span>
                            </div>
                            <p className="text-3xl font-black mb-4 tracking-tighter">{item.amount} <span className="text-xs text-red-600 italic">HTG</span></p>
                            
                            {item.status === 'pending' && (
                                <button 
                                    disabled={processingId === item.id}
                                    onClick={() => apwouveDepo(item)} 
                                    className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase italic shadow-lg"
                                >
                                    {processingId === item.id ? 'Loading...' : 'Apwouve Kounye a'}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}