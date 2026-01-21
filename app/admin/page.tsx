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

    // Done Telegram ou yo
    const BOT_TOKEN = '8395029585:AAEZKtLVQhuwk8drzziAIJeDtHuhjl77bPY';
    const CHAT_ID = '8392894841';

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
        setDeposits(d || []);
        setWithdrawals(w || []);
        setLoading(false);
    };

    useEffect(() => { raleDone(); }, []);

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

    const voyeNotifikasyonTelegram = async (mesaj: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: mesaj, parse_mode: 'Markdown' })
            });
        } catch (e) { console.error(e); }
    };

    // --- 1. APWOUVE DEPO ---
    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve ${d.amount} HTG?`)) return;
        setProcessingId(d.id);
        try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (!p) throw new Error("Kliyan pa jwenn nan profiles");

            const nouvoBalans = Number(p.wallet_balance || 0) + Number(d.amount);

            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
            
            // FIX: Nou itilize 'WALLET' piske baz done a bloke lòt mo yo
            await supabase.from('transactions').insert({
                user_id: d.user_id, 
                amount: Number(d.amount), 
                fee: 0,
                type: 'DEPOSIT',
                description: 'Depo apwouve pa Admin', 
                status: 'success', 
                method: 'WALLET' 
            });

            await voyeEmailKliyan(p.email, p.full_name, `Depo ${d.amount} HTG ou a apwouve. Balans: ${nouvoBalans} HTG.`);
            await voyeNotifikasyonTelegram(`✅ *DEPO APWOUVE*\n👤 ${p.full_name}\n💰 +${d.amount} HTG`);

            alert("✅ DEPO APWOUVE!");
            raleDone();
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    // --- 2. ANILE DEPO ---
    const anileDepo = async (d: any) => {
        const rezon = prompt("Rezon anilasyon?");
        if (!rezon) return;
        setProcessingId(d.id);
        try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            await supabase.from('deposits').update({ status: 'rejected', admin_notes: rezon }).eq('id', d.id);
            
            await supabase.from('transactions').insert({
                user_id: d.user_id, 
                amount: Number(d.amount), 
                fee: 0,
                type: 'DEPOSIT',
                description: `Anile: ${rezon}`, 
                status: 'rejected', 
                method: 'WALLET'
            });

            if (p) await voyeEmailKliyan(p.email, p.full_name, `Depo anile. Rezon: ${rezon}`);
            alert("⚠️ Depo Anile");
            raleDone();
        } finally { setProcessingId(null); }
    };

    // --- 3. KONFIME RETRÈ ---
    const finPeyeRetre = async (w: any) => {
        if (!confirm(`Konfime pèman ${w.amount} HTG?`)) return;
        setProcessingId(w.id);
        try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', w.user_id).single();
            await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
            
            await supabase.from('transactions').insert({
                user_id: w.user_id, 
                amount: -Number(w.amount), 
                fee: 0,
                type: 'WITHDRAWAL',
                description: `Retrè peye via ${w.method}`, 
                status: 'success', 
                method: 'WALLET'
            });

            if (p) await voyeEmailKliyan(p.email, p.full_name, `Retrè ${w.amount} HTG ou a fin peye.`);
            alert("✅ Retrè Konfime");
            raleDone();
        } finally { setProcessingId(null); }
    };

    const suprime = async (id: string, table: any) => {
        if (confirm("Efase nèt?")) {
            await supabase.from(table).delete().eq('id', id);
            raleDone();
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 font-sans uppercase italic pb-24">
            <div className="max-w-md mx-auto flex justify-between items-center mb-6">
                <h1 className="text-xl font-black text-red-600">Admin Hatex</h1>
                <button onClick={raleDone} className="bg-zinc-800 px-4 py-2 rounded-xl text-[10px] font-black">Refresh</button>
            </div>

            <div className="flex gap-2 mb-6 max-w-md mx-auto">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs font-black transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs font-black transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>RETRÈ</button>
            </div>

            {loading ? (
                <div className="text-center py-20 animate-pulse font-black text-xs">Y ap chache done...</div>
            ) : (
                <div className="space-y-4 max-w-md mx-auto">
                    {(view === 'depo' ? deposits : withdrawals).map((item) => (
                        <div key={item.id} className="bg-zinc-900 p-5 rounded-[2.5rem] border border-white/5 relative shadow-2xl overflow-hidden">
                            <div className="flex justify-between mb-2 pr-8">
                                <span className="text-[9px] text-zinc-500 font-bold">ID: {item.user_id?.slice(0,8)}</span>
                                <span className={`text-[8px] px-3 py-1 rounded-full font-black ${item.status === 'approved' || item.status === 'completed' ? 'bg-green-500 text-white' : item.status === 'rejected' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black'}`}>{item.status}</span>
                            </div>

                            <p className="text-3xl font-black mb-4 tracking-tighter">{item.amount} <span className="text-xs text-red-600 italic">HTG</span></p>

                            {view === 'depo' ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <a href={item.proof_img_1} target="_blank" className="bg-zinc-800 py-3 rounded-xl text-center text-[10px] font-black border border-white/5 uppercase italic">Foto Prèv</a>
                                        {item.status === 'pending' && (
                                            <button disabled={processingId === item.id} onClick={() => apwouveDepo(item)} className="bg-white text-black py-3 rounded-xl text-[10px] font-black uppercase">
                                                {processingId === item.id ? 'Wait...' : 'Apwouve'}
                                            </button>
                                        )}
                                    </div>
                                    {item.status === 'pending' && (
                                        <button disabled={processingId === item.id} onClick={() => anileDepo(item)} className="w-full bg-red-600/10 text-red-600 border border-red-600/20 py-3 rounded-xl text-[10px] font-black uppercase">Anile Depo</button>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[9px] text-red-600 font-black mb-1 italic">{item.method}</p>
                                        <p className="text-xs font-black tracking-widest">{item.phone || item.account_number}</p>
                                    </div>
                                    {item.status === 'pending' && (
                                        <button disabled={processingId === item.id} onClick={() => finPeyeRetre(item)} className="w-full bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-white/10">
                                            {processingId === item.id ? 'Ap Peye...' : 'Konfime Pèman'}
                                        </button>
                                    )}
                                </div>
                            )}

                            <button onClick={() => suprime(item.id, view === 'depo' ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-zinc-700 hover:text-red-600 transition-colors font-black">X</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}