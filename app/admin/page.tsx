"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminSuperPage() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);
    const [view, setView] = useState<'depo' | 'retre' | 'sispandi'>('depo');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [accessGranted, setAccessGranted] = useState(false);

    // Nouvo state pou kenbe valè modifikasyon depo yo
    const [montanModifye, setMontanModifye] = useState<{ [key: string]: number }>({});

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
            // Rale Depo yo
            const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
            setDeposits(d || []);

            // Rale Retrè yo
            const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
            setWithdrawals(w || []);

            // Rale Kont Sispandi yo
            const { data: s } = await supabase.from('profiles').select('*').eq('account_status', 'suspended').order('created_at', { ascending: false });
            setSuspendedAccounts(s || []);
            
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

    // ==========================================
    // APWOUVE DEPO AK MODIFIKASYON MANIÈL
    // ==========================================
    const apwouveDepo = async (d: any) => {
        // Pran valè ki modifye a, sinon pran valè orijinal la
        const montanFinal = montanModifye[d.id] !== undefined ? montanModifye[d.id] : Number(d.amount);

        if (!confirm(`Konfime depo sa a?\nMontan k ap ajoute sou balans lan: ${montanFinal} HTG`)) return;
        
        setProcessingId(d.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn nan sistèm nan.");

            const nouvoBalans = Number(p.wallet_balance || 0) + montanFinal;

            // 1. Update Balans
            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            // 2. Update Status Depo (ak montan modifye a si l te chanje)
            await supabase.from('deposits').update({ status: 'approved', amount: montanFinal }).eq('id', d.id);
            // 3. Kreye Istorik
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: montanFinal, type: 'DEPOSIT',
                description: `Depo konfime: +${montanFinal} HTG`, status: 'success'
            });

            // Notifikasyon
            const mesajE = `Bonjou ${p.full_name}, depo ou a apwouve. Nou ajoute ${montanFinal} HTG sou balans ou.`;
            await voyeEmailKliyan(p.email, p.full_name, mesajE, "✅ DEPO APWOUVE - HATEX CARD");
            await voyeTelegram(`✅ <b>DEPO APWOUVE</b>\nKliyan: ${p.full_name}\nMontan: ${montanFinal} HTG`);
            
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

    // ==========================================
    // DEBLOKE KONT SISPANDI YO
    // ==========================================
    const deblokeKont = async (id: string, email: string) => {
        if (!confirm(`Èske w vle aktive kont sa a ankò? (${email})`)) return;
        setProcessingId(id);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ account_status: 'active', failed_pin_attempts: 0 })
                .eq('id', id);

            if (error) throw error;
            
            alert(`✅ Kont ${email} lan aktive!`);
            raleDone(); // Recharge lis yo
        } catch (err: any) {
            alert("Erè: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    if (!accessGranted) return <div className="bg-black h-screen" />;

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 uppercase italic font-bold pb-24">
            <div className="max-w-md mx-auto">
                <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-4">
                    <h1 className="text-2xl font-black text-red-600 italic tracking-tighter">HATEX ADMIN</h1>
                    <button onClick={raleDone} className="bg-zinc-800 p-3 rounded-xl text-[10px] active:scale-95 transition-all">REFRESH</button>
                </div>

                {/* MENI ONGLET YO */}
                <div className="flex gap-2 mb-8 bg-zinc-900/50 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
                    <button onClick={() => setView('depo')} className={`flex-1 py-4 px-4 rounded-xl text-[10px] font-black transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>DEPO ({deposits.filter(d => d.status === 'pending').length})</button>
                    <button onClick={() => setView('retre')} className={`flex-1 py-4 px-4 rounded-xl text-[10px] font-black transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>RETRÈ ({withdrawals.filter(w => w.status === 'pending').length})</button>
                    <button onClick={() => setView('sispandi')} className={`flex-1 py-4 px-4 rounded-xl text-[10px] font-black transition-all ${view === 'sispandi' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>SISPANDI ({suspendedAccounts.length})</button>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 animate-pulse text-zinc-500 text-xs">L-AP CHACHE DONE YO...</div>
                    ) : view === 'sispandi' ? (
                        // ==========================================
                        // VUE KONT SISPANDI YO
                        // ==========================================
                        suspendedAccounts.map((account) => (
                            <div key={account.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-red-600/30 relative overflow-hidden flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-600/50">
                                    <span className="text-xl">⚠️</span>
                                </div>
                                <h3 className="text-lg font-black truncate w-full">{account.full_name || 'San Non'}</h3>
                                <p className="text-[10px] text-zinc-400 mb-6 lowercase">{account.email}</p>
                                
                                <button 
                                    onClick={() => deblokeKont(account.id, account.email)}
                                    disabled={processingId === account.id}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all disabled:opacity-50"
                                >
                                    {processingId === account.id ? 'AP AKTIVE...' : 'AKTIVE KONT SA A'}
                                </button>
                            </div>
                        ))
                    ) : (
                        // ==========================================
                        // VUE DEPO AK RETRÈ YO
                        // ==========================================
                        (view === 'depo' ? deposits : withdrawals).map((item) => {
                            const isDepo = view === 'depo';
                            // Kalkile valè k ap afiche a si l modifye
                            const aficheMontan = isDepo && montanModifye[item.id] !== undefined ? montanModifye[item.id] : item.amount;

                            return (
                                <div key={item.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                                    {item.status !== 'pending' && (
                                        <button onClick={() => deleteTranzaksyon(item.id, isDepo ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-red-600 text-[9px] bg-red-600/10 px-2 py-1 rounded">EFASE</button>
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

                                    {/* Zòn Montan an ak Modifikasyon (Pou Depo sèlman) */}
                                    <div className="mb-6 border-b border-white/5 pb-6">
                                        <p className="text-[9px] text-zinc-500 mb-1">MONTAN {isDepo ? 'KLIYAN AN DECLARE' : 'KLIYAN MANDE A'}:</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-4xl font-black italic tracking-tighter text-white">
                                                {aficheMontan} <span className="text-xs text-red-600">HTG</span>
                                            </p>
                                            
                                            {isDepo && item.status === 'pending' && (
                                                <button 
                                                    onClick={() => {
                                                        const nouvoVal = prompt("Antre nouvo montan ou vle mete pou kliyan sa a (HTG):", item.amount);
                                                        if (nouvoVal && !isNaN(Number(nouvoVal))) {
                                                            setMontanModifye(prev => ({ ...prev, [item.id]: Number(nouvoVal) }));
                                                        }
                                                    }}
                                                    className="bg-zinc-800 text-white px-3 py-2 rounded-xl text-[8px] font-black tracking-widest hover:bg-zinc-700"
                                                >
                                                    MODIFYE MONTAN
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {item.status === 'pending' && (
                                        <div className="space-y-4">
                                            <div className="flex gap-2">
                                                <button 
                                                    disabled={processingId === item.id} 
                                                    onClick={() => isDepo ? apwouveDepo(item) : apwouveRetre(item)} 
                                                    className="flex-1 bg-white text-black py-4 rounded-2xl text-[10px] font-black hover:bg-green-500 hover:text-white transition-all"
                                                >
                                                    {processingId === item.id ? 'TRETE...' : 'KONFIME APWOUVE'}
                                                </button>
                                                <button 
                                                    disabled={processingId === item.id}
                                                    onClick={() => anileTranzaksyon(item, isDepo ? 'deposits' : 'withdrawals')} 
                                                    className="bg-red-600/20 text-red-600 border border-red-600/30 px-5 py-4 rounded-2xl text-[10px] hover:bg-red-600 hover:text-white transition-all"
                                                >
                                                    ANILE
                                                </button>
                                            </div>
                                            {isDepo && item.proof_img_1 && (
                                                <a href={item.proof_img_1} target="_blank" rel="noreferrer" className="block text-center bg-zinc-800 py-4 rounded-2xl text-[9px] text-zinc-400 border border-white/5 hover:text-white">
                                                    👁️ GADE FOTO PRÈV
                                                </a>
                                            )}
                                            <div className="text-[8px] text-zinc-600 text-center mt-2">ID: {item.transaction_id || 'SANS ID'}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    
                    {/* Mesaj Lè Pa Gen Anyen */}
                    {!loading && view !== 'sispandi' && (view === 'depo' ? deposits : withdrawals).length === 0 && (
                        <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa gen okenn {view} pou kounye a</div>
                    )}
                    {!loading && view === 'sispandi' && suspendedAccounts.length === 0 && (
                        <div className="text-center py-20 text-zinc-600 text-[10px] font-black uppercase tracking-widest border border-white/5 rounded-[2rem]">
                            Tout Kont Yo Pwòp! ✅
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}