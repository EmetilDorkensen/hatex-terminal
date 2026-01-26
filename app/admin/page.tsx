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

    // --- TELEGRAM CONFIG ---
    const BOT_TOKEN = "7547464134:AAH3M_R89D0UuN-WlOclj2D-Hj9S9I_K28Y";
    const CHAT_ID = "5352352512";

    // 1. Chèk Modpas ak Rale Done
    useEffect(() => {
        const pass = prompt("Antre modpas Admin lan:");
        if (pass === "fiokes1234") { // <--- CHANJE SA LA
            setAccessGranted(true);
            raleDone();
        } else {
            alert("Ou pa gen otorizasyon!");
            window.location.href = "/";
        }
    }, []);

    const voyeTelegram = async (msg: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'HTML' }),
            });
        } catch (e) { console.error("Telegram error", e); }
    };

    const raleDone = async () => {
        setLoading(true);
        const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
        const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
        setDeposits(d || []);
        setWithdrawals(w || []);
        setLoading(false);
    };

    const voyeEmailKliyan = async (email: string, non: string, mesaj: string) => {
        if (!email) return;
        try {
            await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: email.trim(), subject: 'MIZAJOU HATEX CARD', non, mesaj }),
            });
        } catch (error) { console.error("Erè email:", error); }
    };

    const deleteTranzaksyon = async (id: string, table: string) => {
        if (!confirm("Èske ou vle efase istovik sa a nèt nan baz de done a?")) return;
        setProcessingId(id);
        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            alert("🗑️ Efase nèt!");
            raleDone();
        } catch (err: any) {
            alert("Erè nan efase: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const apwouveDepo = async (d: any) => {
        if (!confirm(`Apwouve depo ${d.amount} HTG?`)) return;
        setProcessingId(d.id);
        try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (!p) throw new Error("Kliyan pa jwenn");

            const nouvoBalans = Number(p.wallet_balance || 0) + Number(d.amount);

            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
            
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: Number(d.amount), fee: 0,
                type: 'DEPOSIT', description: `Depo konfime: +${d.amount} HTG`, status: 'success', method: 'WALLET' 
            });

            await voyeEmailKliyan(p.email, p.full_name, `Kont ou kredite ak ${d.amount} HTG. Nouvo balans: ${nouvoBalans} HTG.`);
            await voyeTelegram(`✅ <b>DEPO APWOUVE</b>\nKliyan: ${p.full_name}\nMontan: ${d.amount} HTG`);
            
            alert("✅ DEPO APWOUVE!");
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const apwouveRetre = async (w: any) => {
        if (!confirm(`Konfime retrè ${w.amount} HTG sa a?`)) return;
        setProcessingId(w.id);
        try {
            const { data: p } = await supabase.from('profiles').select('*').eq('id', w.user_id).single();
            
            await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
            
            await supabase.from('transactions').insert({
                user_id: w.user_id, amount: -Number(w.amount), fee: 0,
                type: 'WITHDRAWAL', description: `Retrè konfime: -${w.amount} HTG`, status: 'success', method: 'WALLET' 
            });

            await voyeEmailKliyan(p.email, p.full_name, `Retrè ${w.amount} HTG ou a fin trete ak siksè.`);
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
            const { data: p } = await supabase.from('profiles').select('email, full_name').eq('id', item.user_id).single();
            
            if (p?.email) await voyeEmailKliyan(p.email, p.full_name, `Tranzaksyon anile. Rezon: ${rezon}`);
            await voyeTelegram(`❌ <b>TRANZAKSYON ANILE</b>\nTablo: ${table}\nKliyan: ${p?.full_name}\nRezon: ${rezon}`);

            alert("⚠️ Anile ak siksè");
            raleDone();
        } finally { setProcessingId(null); }
    };

    if (!accessGranted) return <div className="bg-black h-screen"></div>;

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 uppercase italic">
            <div className="max-w-md mx-auto flex justify-between items-center mb-10">
                <h1 className="text-2xl font-black text-red-600 tracking-tighter italic">ADMIN HATEX</h1>
                <button onClick={raleDone} className="bg-zinc-800 p-3 rounded-xl text-[10px] font-black uppercase">Refresh</button>
            </div>

            <div className="flex gap-2 mb-8 max-w-md mx-auto">
                <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs font-black ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/30' : 'bg-zinc-900 text-zinc-500'}`}>DEPO</button>
                <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs font-black ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/30' : 'bg-zinc-900 text-zinc-500'}`}>RETRÈ</button>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
                {(view === 'depo' ? deposits : withdrawals).map((item) => (
                    <div key={item.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative">
                        {/* BOUTON DELETE POU TRANZAKSYON KI FINI */}
                        {(item.status === 'approved' || item.status === 'completed' || item.status === 'rejected') && (
                            <button 
                                onClick={() => deleteTranzaksyon(item.id, view === 'depo' ? 'deposits' : 'withdrawals')}
                                className="absolute top-5 right-5 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-lg shadow-red-600/20 active:scale-75 transition-all"
                            >
                                X
                            </button>
                        )}

                        <div className="flex justify-between mb-4 pr-8">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase">ID: {item.user_id?.slice(0,8)}</span>
                            <span className={`text-[8px] px-3 py-1 rounded-full font-black uppercase ${item.status === 'pending' ? 'bg-yellow-500 text-black' : 'bg-green-600 text-white'}`}>{item.status}</span>
                        </div>

                        <p className="text-4xl font-black mb-6 tracking-tighter italic">{item.amount} <span className="text-xs text-red-600">HTG</span></p>

                        <div className="flex gap-2">
                            {item.status === 'pending' && (
                                <>
                                    <button 
                                        disabled={processingId === item.id}
                                        onClick={() => view === 'depo' ? apwouveDepo(item) : apwouveRetre(item)} 
                                        className="flex-1 bg-white text-black py-4 rounded-xl text-[10px] font-black uppercase"
                                    >
                                        {processingId === item.id ? 'Loading...' : 'Apwouve'}
                                    </button>
                                    <button onClick={() => anileTranzaksyon(item, view === 'depo' ? 'deposits' : 'withdrawals')} className="bg-red-600/20 text-red-600 border border-red-600/30 px-4 py-4 rounded-xl text-[10px] font-black uppercase">Anile</button>
                                </>
                            )}
                            {view === 'depo' && item.proof_img_1 && (
                                <a href={item.proof_img_1} target="_blank" rel="noreferrer" className="bg-zinc-800 px-6 py-4 rounded-xl text-[9px] font-black uppercase flex items-center">Prèv</a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}