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
        // ADMIN KALKIL: Nou pran montan li voye a, nou retire 5% frais
        const frais = Number(d.amount) * 0.05;
        const montanNet = Number(d.amount) - frais;

        if (!confirm(`Apwouve depo sa a?\nMontan voye: ${d.amount} HTG\nFrais (5%): ${frais} HTG\nNet sou balans: ${montanNet} HTG`)) return;
        
        setProcessingId(d.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn nan sistèm nan.");

            const nouvoBalans = Number(p.wallet_balance || 0) + montanNet;

            // 1. Update Balans
            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            // 2. Update Status Depo
            await supabase.from('deposits').update({ status: 'approved' }).eq('id', d.id);
            // 3. Kreye Istorik
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: montanNet, type: 'DEPOSIT',
                description: `Depo konfime: +${montanNet} HTG (Frais 5% dedui)`, status: 'success'
            });

            // Notifikasyon
            const mesajE = `Bonjou ${p.full_name}, depo ou a pou ${d.amount} HTG apwouve. Apre frais 5%, nou ajoute ${montanNet} HTG sou balans ou.`;
            await voyeEmailKliyan(p.email, p.full_name, mesajE, "✅ DEPO APWOUVE - HATEX CARD");
            await voyeTelegram(`✅ <b>DEPO APWOUVE</b>\nKliyan: ${p.full_name}\nMontan Net: ${montanNet} HTG`);
            
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
                    <h1 className="text-2xl font-black text-red-600 italic tracking-tighter">HATEX ADMIN</h1>
                    <button onClick={raleDone} className="bg-zinc-800 p-3 rounded-xl text-[10px] active:scale-95 transition-all">REFRESH</button>
                </div>

                <div className="flex gap-2 mb-8">
                    <button onClick={() => setView('depo')} className={`flex-1 py-4 rounded-2xl text-xs transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>DEPO</button>
                    <button onClick={() => setView('retre')} className={`flex-1 py-4 rounded-2xl text-xs transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'bg-zinc-900 text-zinc-500'}`}>RETRÈ</button>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 animate-pulse text-zinc-500 text-xs">L-AP CHACHE TRANZAKSYON...</div>
                    ) : (view === 'depo' ? deposits : withdrawals).map((item) => (
                        <div key={item.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                            {item.status !== 'pending' && (
                                <button onClick={() => deleteTranzaksyon(item.id, view === 'depo' ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-red-600 text-[9px] bg-red-600/10 px-2 py-1 rounded">EFASE</button>
                            )}
                            
                            <div className="flex justify-between mb-4 pr-12">
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-zinc-500">KLIYAN ID: {item.user_id?.slice(0,8)}...</span>
                                    <span className="text-[9px] text-zinc-400">METÒD: {item.method}</span>
                                </div>
                                <span className={`text-[8px] h-fit px-3 py-1 rounded-full font-black ${item.status === 'pending' ? 'bg-yellow-500 text-black' : item.status === 'approved' || item.status === 'completed' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                                    {item.status}
                                </span>
                            </div>

                            <p className="text-4xl font-black mb-1 italic tracking-tighter">{item.amount} <span className="text-xs text-red-600">HTG</span></p>
                            
                            {view === 'depo' && (
                                <p className="text-[10px] text-zinc-500 mb-6 font-medium">NET POU KLIYAN (95%): <span className="text-white">{(item.amount * 0.95).toFixed(2)} HTG</span></p>
                            )}

                            {item.status === 'pending' && (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <button 
                                            disabled={processingId === item.id} 
                                            onClick={() => view === 'depo' ? apwouveDepo(item) : apwouveRetre(item)} 
                                            className="flex-1 bg-white text-black py-4 rounded-2xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all"
                                        >
                                            {processingId === item.id ? 'TRETE...' : 'KONFIME APWOUVE'}
                                        </button>
                                        <button 
                                            onClick={() => anileTranzaksyon(item, view === 'depo' ? 'deposits' : 'withdrawals')} 
                                            className="bg-red-600/20 text-red-600 border border-red-600/30 px-5 py-4 rounded-2xl text-[10px]"
                                        >
                                            ANILE
                                        </button>
                                    </div>
                                    {view === 'depo' && item.proof_img_1 && (
                                        <a href={item.proof_img_1} target="_blank" rel="noreferrer" className="block text-center bg-zinc-800 py-4 rounded-2xl text-[9px] text-zinc-400 border border-white/5">
                                            👁️ GADE FOTO PRÈV
                                        </a>
                                    )}
                                    <div className="text-[8px] text-zinc-600 text-center mt-2">ID: {item.transaction_id || 'SANS ID'}</div>
                                </div>
                            )}
                        </div>
                    ))}
                    {!loading && (view === 'depo' ? deposits : withdrawals).length === 0 && (
                        <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa gen okenn {view} pou kounye a</div>
                    )}
                </div>
            </div>
        </div>
    );
}