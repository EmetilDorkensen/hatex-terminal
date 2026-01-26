"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminSuperPage() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre'>('depo');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [accessGranted, setAccessGranted] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // --- CONFIG ---
    const BOT_TOKEN = "7547464134:AAH3M_R89D0UuN-WlOclj2D-Hj9S9I_K28Y";
    const CHAT_ID = "5352352512";

    useEffect(() => {
        const pass = prompt("Antre modpas Admin lan:");
        if (pass === "fiokes1234") {
            setAccessGranted(true);
            raleDone();
        } else {
            alert("Ou pa gen otorizasyon!");
            window.location.href = "/";
        }
    }, []);

    const raleDone = async () => {
        setLoading(true);
        try {
            const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
            const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
            setDeposits(d || []);
            setWithdrawals(w || []);
        } finally {
            setLoading(false);
        }
    };

    const voyeEmailKliyan = async (email: string, non: string, mesaj: string, subject: string) => {
        if (!email) return;
        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: email.trim(), subject, non, mesaj }),
            });
        } catch (error) { console.error("Erè email:", error); }
    };

    const voyeTelegram = async (msg: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'HTML' }),
            });
        } catch (e) { console.error("Telegram error", e); }
    };

    const deleteTranzaksyon = async (id: string, table: string) => {
        if (!confirm("Èske ou vle efase istovik sa a nèt?")) return;
        setProcessingId(id);
        try {
            await supabase.from(table).delete().eq('id', id);
            alert("🗑️ Efase nèt!");
            raleDone();
        } finally { setProcessingId(null); }
    };

    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve depo ${d.amount} HTG?`)) return;
        setProcessingId(d.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn nan sistèm nan.");

            const nouvoBalans = Number(p.wallet_balance || 0) + Number(d.amount);

            // Update Balans
            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            // Update Status Depo
            await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
            // Kreye Istorik
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: Number(d.amount), type: 'DEPOSIT',
                description: `Depo konfime: +${d.amount} HTG`, status: 'success'
            });

            // Notifikasyon
            const mesajE = `Bonjou ${p.full_name}, depo ou a ki te fè pou ${d.amount} HTG fin apwouve. Nouvo balans ou se: ${nouvoBalans} HTG.`;
            await voyeEmailKliyan(p.email, p.full_name, mesajE, "✅ DEPO APWOUVE - HATEX CARD");
            await voyeTelegram(`✅ <b>DEPO APWOUVE</b>\nKliyan: ${p.full_name}\nMontan: ${d.amount} HTG`);
            
            alert("✅ DEPO APWOUVE!");
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const apwouveRetre = async (w: any) => {
        if (!confirm(`Konfime retrè ${w.amount} HTG sa a?`)) return;
        setProcessingId(w.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', w.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn.");

            await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
            await supabase.from('transactions').insert({
                user_id: w.user_id, amount: -Number(w.amount), type: 'WITHDRAWAL',
                description: `Retrè konfime: -${w.amount} HTG`, status: 'success'
            });

            const mesajE = `Bonjou ${p.full_name}, retrè ${w.amount} HTG ou a fin trete. Lajan an voye sou kont ou.`;
            await voyeEmailKliyan(p.email, p.full_name, mesajE, "💸 RETRÈ KONFIME - HATEX CARD");
            await voyeTelegram(`💸 <b>RETRÈ KONFIME</b>\nKliyan: ${p.full_name}\nMontan: ${w.amount} HTG`);

            alert("✅ RETRÈ FINI!");
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const anileTranzaksyon = async (item: any, table: string) => {
        const rezon = prompt("Rezon anilasyon?");
        if (!rezon) return;
        setProcessingId(item.id);
        try {
            await supabase.from(table).update({ status: 'rejected' }).eq('id', item.id);
            const { data: p } = await supabase.from('profiles').select('*').eq('id', item.user_id).single();
            
            if (table === 'withdrawals') {
                const balansR = Number(p.wallet_balance || 0) + Number(item.amount);
                await supabase.from('profiles').update({ wallet_balance: balansR }).eq('id', item.user_id);
            }

            await supabase.from('transactions').insert({
                user_id: item.user_id, amount: 0, type: 'REJECTED',
                description: `Anile: ${rezon}`, status: 'failed'
            });

            const mesajE = `Bonjou ${p?.full_name}, tranzaksyon ${item.amount} HTG ou a anile. Rezon: ${rezon}`;
            if (p?.email) await voyeEmailKliyan(p.email, p.full_name, mesajE, "❌ TRANZAKSYON ANILE");
            await voyeTelegram(`❌ <b>ANILE</b>\nKliyan: ${p?.full_name}\nRezon: ${rezon}`);

            alert("⚠️ Anile!");
            raleDone();
        } finally { setProcessingId(null); }
    };

    if (!accessGranted) return <div className="bg-black h-screen" />;

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 uppercase italic font-bold">
            <div className="max-w-md mx-auto">
                <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-4">
                    <h1 className="text-2xl font-black text-red-600 italic">HATEX ADMIN</h1>
                    <button onClick={raleDone} className="bg-zinc-800 p-3 rounded-xl text-[10px]">REFRESH</button>
                </div>

                <div className="flex gap-2 mb-8">
                    <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs ${view === 'depo' ? 'bg-red-600' : 'bg-zinc-900 text-zinc-500'}`}>DEPO</button>
                    <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs ${view === 'retre' ? 'bg-red-600' : 'bg-zinc-900 text-zinc-500'}`}>RETRÈ</button>
                </div>

                <div className="space-y-4">
                    {loading ? <p className="text-center text-zinc-500">L-AP CHACHE...</p> : (view === 'depo' ? deposits : withdrawals).map((item) => (
                        <div key={item.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative">
                            {item.status !== 'pending' && (
                                <button onClick={() => deleteTranzaksyon(item.id, view === 'depo' ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-red-600 text-[10px]">EFASE</button>
                            )}
                            <div className="flex justify-between mb-4 pr-10">
                                <span className="text-[9px] text-zinc-500">KLIYAN: {item.user_id?.slice(0,10)}</span>
                                <span className={`text-[8px] px-3 py-1 rounded-full ${item.status === 'pending' ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white'}`}>{item.status}</span>
                            </div>
                            <p className="text-4xl font-black mb-6 italic">{item.amount} <span className="text-xs text-red-600">HTG</span></p>
                            
                            {item.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button disabled={processingId === item.id} onClick={() => view === 'depo' ? apwouveDepo(item) : apwouveRetre(item)} className="flex-1 bg-white text-black py-4 rounded-xl text-[10px]">{processingId === item.id ? '...' : 'APWOUVE'}</button>
                                    <button onClick={() => anileTranzaksyon(item, view === 'depo' ? 'deposits' : 'withdrawals')} className="bg-red-600/20 text-red-600 border border-red-600/30 px-4 py-4 rounded-xl text-[10px]">ANILE</button>
                                </div>
                            )}
                            {view === 'depo' && item.proof_img_1 && (
                                <a href={item.proof_img_1} target="_blank" rel="noreferrer" className="mt-2 block text-center bg-zinc-800 py-3 rounded-xl text-[9px]">GADE PRÈV FOTO</a>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}