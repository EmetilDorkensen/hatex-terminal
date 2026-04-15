"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminSuperPage() {
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [promoCodes, setPromoCodes] = useState<any[]>([]);
    
    const [newPromoCode, setNewPromoCode] = useState('');
    const [promoReward, setPromoReward] = useState('250');
    
    // NOUVO ETA POU ANONS GLOBAL LA
    const [anonsText, setAnonsText] = useState('');
    const [anonsActive, setAnonsActive] = useState(true);
    
    // NOU METE 'anons' NAN LIS ONGLET YO
    const [view, setView] = useState<'depo' | 'retre' | 'sispandi' | 'kyc' | 'promo' | 'anons'>('depo');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [accessGranted, setAccessGranted] = useState(false);
    const [montanModifye, setMontanModifye] = useState<{ [key: string]: number }>({});

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // --- CONFIG TELEGRAM ---
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
            // Rale Depo
            const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
            setDeposits(d || []);

            // Rale Retrè
            const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
            setWithdrawals(w || []);

            // Rale Kont Sispandi
            const { data: s } = await supabase.from('profiles').select('*').eq('account_status', 'suspended').order('created_at', { ascending: false });
            setSuspendedAccounts(s || []);

            // Rale KYC Pending
            const { data: k } = await supabase.from('profiles').select('*').eq('kyc_status', 'pending').order('created_at', { ascending: false });
            setPendingKyc(k || []);

            // Rale Promo Codes
            const { data: p } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
            setPromoCodes(p || []);
            
            // Rale Anons Global la
            const { data: anonsData } = await supabase.from('global_settings').select('*').eq('id', 1).single();
            if (anonsData) {
                setAnonsText(anonsData.announcement_text || '');
                setAnonsActive(anonsData.announcement_active);
            }

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
    // DEPO AK RETRÈ
    // ==========================================
    const apwouveDepo = async (d: any) => {
        const montanFinal = montanModifye[d.id] !== undefined ? montanModifye[d.id] : Number(d.amount);
        if (!confirm(`Konfime depo sa a?\nMontan k ap ajoute sou balans lan: ${montanFinal} HTG`)) return;
        
        setProcessingId(d.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn nan sistèm nan.");

            const nouvoBalans = Number(p.wallet_balance || 0) + montanFinal;

            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            await supabase.from('deposits').update({ status: 'approved', amount: montanFinal }).eq('id', d.id);
            await supabase.from('transactions').insert({
                user_id: d.user_id, amount: montanFinal, type: 'DEPOSIT',
                description: `Depo konfime: +${montanFinal} HTG`, status: 'success'
            });

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
    // DEBLOKE KONT
    // ==========================================
    const deblokeKont = async (id: string, email: string) => {
        if (!confirm(`Èske w vle aktive kont sa a ankò? (${email})`)) return;
        setProcessingId(id);
        try {
            await supabase.from('profiles').update({ account_status: 'active', failed_pin_attempts: 0 }).eq('id', id);
            alert(`✅ Kont ${email} lan aktive!`);
            raleDone(); 
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    // ==========================================
    // JERE KYC AK REZON REJÈ
    // ==========================================
    const jereKyc = async (id: string, full_name: string, email: string, aksyon: 'approved' | 'rejected') => {
        let rezonReje = "";
        
        if (aksyon === 'rejected') {
            const rep = prompt("Tanpri ekri rezon ki fè w rejte dokiman sa yo (Egz: Pyès la twò flou, Foto a pa klè):");
            if (!rep) return; 
            rezonReje = rep;
        } else {
            if (!confirm(`Èske w sèten ou vle APWOUVE KYC pou ${full_name}?`)) return;
        }

        setProcessingId(id);
        try {
            await supabase.from('profiles').update({ 
                kyc_status: aksyon,
                kyc_rejection_reason: aksyon === 'rejected' ? rezonReje : null
            }).eq('id', id);
            
            const mesajE = aksyon === 'approved' 
                ? `Felisitasyon ${full_name}! Dokiman w yo apwouve. Ou kapab aktive Kat Vityèl ou a nan aplikasyon an kounye a.`
                : `Bonjou ${full_name}. \n\nMalerezman, nou pa ka aksepte dokiman KYC ou te soumèt yo.\n\nREZON: ${rezonReje}\n\nTanpri konekte sou aplikasyon an pou w soumèt lòt dokiman ki korije pwoblèm sa a.`;
            
            if (email) await voyeEmailKliyan(email, full_name, mesajE, `VERIFIKASYON ID ${aksyon === 'approved' ? 'APWOUVE ✅' : 'REJTE ❌'}`);
            
            alert(`KYC a ${aksyon === 'approved' ? 'Apwouve' : 'Rejte'} avèk siksè!`);
            raleDone();
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    // ==========================================
    // KREYE KÒD PWOMO
    // ==========================================
    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('creating_promo');
        const cleanCode = newPromoCode.trim().toUpperCase();
        if (!cleanCode) { alert('Mete yon kòd valab.'); setProcessingId(null); return; }

        try {
            const { error } = await supabase.from('promo_codes').insert([{ code: cleanCode, reward_amount: parseInt(promoReward) }]);
            if (error) {
                if (error.code === '23505') throw new Error('Kòd sa a egziste deja!');
                throw error;
            }
            alert(`✅ Kòd ${cleanCode} la kreye!`);
            setNewPromoCode('');
            setPromoReward('250');
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    // ==========================================
    // SOVE NOTIFIKASYON GLOBAL LA
    // ==========================================
    const handleSaveAnons = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving_anons');
        try {
            const { error } = await supabase.from('global_settings').update({ 
                announcement_text: anonsText, 
                announcement_active: anonsActive 
            }).eq('id', 1);
            
            if (error) throw error;
            alert("✅ Notifikasyon an chanje avèk siksè e li rive sou tout kliyan yo!");
            raleDone();
        } catch (err: any) { 
            alert("Erè nan sove notifikasyon an: " + err.message); 
        } finally { 
            setProcessingId(null); 
        }
    };

    if (!accessGranted) return <div className="bg-black h-screen" />;

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 uppercase italic font-bold pb-24">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-4">
                    <h1 className="text-2xl font-black text-red-600 italic tracking-tighter">HATEX ADMIN</h1>
                    <button onClick={raleDone} className="bg-zinc-800 p-3 rounded-xl text-[10px] active:scale-95 transition-all">REFRESH</button>
                </div>

                {/* MENI ONGLET YO */}
                <div className="flex gap-2 mb-8 bg-zinc-900/50 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar whitespace-nowrap">
                    <button onClick={() => setView('depo')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>DEPO ({deposits.filter(d => d.status === 'pending').length})</button>
                    <button onClick={() => setView('retre')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>RETRÈ ({withdrawals.filter(w => w.status === 'pending').length})</button>
                    <button onClick={() => setView('kyc')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'kyc' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>KYC PENDING ({pendingKyc.length})</button>
                    <button onClick={() => setView('promo')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'promo' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>PWOMO</button>
                    <button onClick={() => setView('sispandi')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'sispandi' ? 'bg-red-600 shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}>SISPANDI ({suspendedAccounts.length})</button>
                    {/* NOUVO BOUTON ANONS LAN */}
                    <button onClick={() => setView('anons')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'anons' ? 'bg-blue-600 shadow-lg shadow-blue-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>ANONS</button>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 animate-pulse text-zinc-500 text-xs">L-AP CHACHE DONE YO...</div>
                    ) : view === 'anons' ? (
                        // ==========================================
                        // VUE NOTIFIKASYON GLOBAL (ANONS)
                        // ==========================================
                        <div className="bg-[#121420] p-6 rounded-3xl border border-blue-500/30 mb-8 shadow-lg shadow-blue-900/10">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-2xl drop-shadow-md">📢</span>
                                <h2 className="text-xl font-black uppercase text-blue-400 tracking-widest">Jere Notifikasyon Global</h2>
                            </div>
                            
                            <form onSubmit={handleSaveAnons} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-zinc-400 font-black uppercase tracking-widest ml-2">Tèks k ap parèt sou paj kliyan yo:</label>
                                    <textarea 
                                        value={anonsText} 
                                        onChange={(e) => setAnonsText(e.target.value)} 
                                        placeholder="Ekri mesaj ou vle tout kliyan wè a la a..." 
                                        className="w-full bg-black border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm min-h-[150px] text-white whitespace-pre-wrap" 
                                        required 
                                    />
                                </div>
                                
                                <div className="flex items-center gap-3 p-4 bg-black rounded-2xl border border-white/5 cursor-pointer" onClick={() => setAnonsActive(!anonsActive)}>
                                    <input 
                                        type="checkbox" 
                                        checked={anonsActive} 
                                        onChange={(e) => setAnonsActive(e.target.checked)} 
                                        className="w-6 h-6 accent-blue-600 cursor-pointer"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-white">Afiche notifikasyon an?</span>
                                        <span className="text-[9px] text-zinc-500 normal-case italic">Si w dezaktive l, li pap parèt sou Dashboard kliyan yo.</span>
                                    </div>
                                </div>
                                
                                <button type="submit" disabled={processingId === 'saving_anons'} className="w-full bg-blue-600 hover:bg-blue-500 px-8 py-5 rounded-2xl font-black uppercase italic active:scale-95 transition-all text-white shadow-lg shadow-blue-600/20">
                                    {processingId === 'saving_anons' ? "AP SOVE..." : "SOVE NOTIFIKASYON AN"}
                                </button>
                            </form>
                        </div>
                    ) : view === 'kyc' ? (
                        // ==========================================
                        // VUE KYC MANIÈL
                        // ==========================================
                        pendingKyc.length === 0 ? (
                            <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa gen okenn KYC k ap tann</div>
                        ) : (
                            pendingKyc.map((user) => (
                                <div key={user.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl border border-white/10 shrink-0">👤</div>
                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="text-lg font-black text-white">{user.full_name || 'San Non'}</h3>
                                        <p className="text-[10px] text-zinc-400 mb-4 lowercase">{user.email}</p>
                                        
                                        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                            {user.kyc_front && <a href={user.kyc_front} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 px-4 py-2 rounded-lg text-blue-400 border border-blue-600/30 hover:bg-blue-600 hover:text-white transition-all font-black tracking-widest">👁️ DEVAN</a>}
                                            {user.kyc_back && <a href={user.kyc_back} target="_blank" rel="noreferrer" className="text-[9px] bg-blue-600/20 px-4 py-2 rounded-lg text-blue-400 border border-blue-600/30 hover:bg-blue-600 hover:text-white transition-all font-black tracking-widest">👁️ DÈYÈ</a>}
                                            {user.kyc_selfie && <a href={user.kyc_selfie} target="_blank" rel="noreferrer" className="text-[9px] bg-purple-600/20 px-4 py-2 rounded-lg text-purple-400 border border-purple-600/30 hover:bg-purple-600 hover:text-white transition-all font-black tracking-widest">📸 SELFIE</a>}
                                            {!user.kyc_front && !user.kyc_selfie && <span className="text-[9px] text-yellow-500 bg-yellow-500/10 px-3 py-1 rounded border border-yellow-500/20">OKENN IMAJ SOU SISTÈM NAN</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
                                        <button onClick={() => jereKyc(user.id, user.full_name, user.email, 'approved')} disabled={processingId === user.id} className="flex-1 md:flex-none bg-green-600 px-6 py-4 rounded-2xl text-[10px] font-black text-white hover:bg-green-500 transition-all shadow-lg shadow-green-600/20">✅ APWOUVE</button>
                                        <button onClick={() => jereKyc(user.id, user.full_name, user.email, 'rejected')} disabled={processingId === user.id} className="flex-1 md:flex-none bg-red-600/20 border border-red-600/30 text-red-500 px-6 py-4 rounded-2xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all">❌ REJTE</button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : view === 'promo' ? (
                        // ==========================================
                        // VUE KÒD PWOMO
                        // ==========================================
                        <div>
                            <form onSubmit={handleCreateCode} className="bg-[#121420] p-6 rounded-3xl border border-purple-500/30 mb-8 flex flex-col md:flex-row gap-4 items-end shadow-lg shadow-purple-900/10">
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-[9px] text-purple-400 font-black uppercase tracking-widest ml-2">Nouvo Kòd (Ex: IZO2026)</label>
                                    <input type="text" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())} placeholder="NON ATIS LA" className="w-full bg-black border border-white/10 p-4 rounded-xl focus:border-purple-500 outline-none transition-all font-bold text-sm uppercase" required />
                                </div>
                                <div className="w-full md:w-48 space-y-2">
                                    <label className="text-[9px] text-purple-400 font-black uppercase tracking-widest ml-2">Kado Kliyan an (HTG)</label>
                                    <input type="number" value={promoReward} onChange={(e) => setPromoReward(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-xl focus:border-purple-500 outline-none transition-all font-bold text-sm" required min="0" />
                                </div>
                                <button type="submit" disabled={processingId === 'creating_promo'} className="w-full md:w-auto bg-purple-600 px-8 py-4 rounded-xl font-black uppercase italic active:scale-95 transition-all">{processingId === 'creating_promo' ? "AP KREYE..." : "KREYE KÒD LA"}</button>
                            </form>
                            <div className="overflow-x-auto bg-[#121420] rounded-3xl border border-white/5">
                                <table className="w-full text-left border-collapse">
                                    <thead><tr className="border-b border-white/5 bg-black/20"><th className="p-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Kòd Pwomo</th><th className="p-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-center">Kado (HTG)</th><th className="p-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-center">Moun Mennen</th></tr></thead>
                                    <tbody>
                                        {promoCodes.length === 0 ? (
                                            <tr><td colSpan={3} className="p-8 text-center text-[10px] font-black uppercase text-zinc-600">Pa gen kòd kreye ankò.</td></tr>
                                        ) : (
                                            promoCodes.map((promo) => (
                                                <tr key={promo.code} className="border-b border-white/5"><td className="p-4 font-black text-purple-500">{promo.code}</td><td className="p-4 text-center font-bold text-white">{promo.reward_amount} HTG</td><td className="p-4 text-center"><span className="bg-green-500/20 text-green-500 px-3 py-1 rounded-lg font-black text-[12px]">{promo.usage_count}</span></td></tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : view === 'sispandi' ? (
                        // ==========================================
                        // VUE SISPANDI
                        // ==========================================
                        suspendedAccounts.map((account) => (
                            <div key={account.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-red-600/30 relative overflow-hidden flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-600/50"><span className="text-xl">⚠️</span></div>
                                <h3 className="text-lg font-black truncate w-full">{account.full_name || 'San Non'}</h3>
                                <p className="text-[10px] text-zinc-400 mb-6 lowercase">{account.email}</p>
                                <button onClick={() => deblokeKont(account.id, account.email)} disabled={processingId === account.id} className="w-full bg-green-600 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all">{processingId === account.id ? 'AP AKTIVE...' : 'AKTIVE KONT SA A'}</button>
                            </div>
                        ))
                    ) : (
                        // ==========================================
                        // VUE DEPO AK RETRÈ
                        // ==========================================
                        (view === 'depo' ? deposits : withdrawals).map((item) => {
                            const isDepo = view === 'depo';
                            const aficheMontan = isDepo && montanModifye[item.id] !== undefined ? montanModifye[item.id] : item.amount;
                            return (
                                <div key={item.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                                    {item.status !== 'pending' && <button onClick={() => deleteTranzaksyon(item.id, isDepo ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-red-600 text-[9px] bg-red-600/10 px-2 py-1 rounded hover:bg-red-600 hover:text-white transition-colors">EFASE</button>}
                                    <div className="flex justify-between mb-4 pr-12">
                                        <div className="flex flex-col"><span className="text-[9px] text-zinc-500">KLIYAN ID: {item.user_id?.slice(0,8)}...</span><span className="text-[9px] text-zinc-400">METÒD: {item.method}</span></div>
                                        <span className={`text-[8px] h-fit px-3 py-1 rounded-full font-black ${item.status === 'pending' ? 'bg-yellow-500 text-black' : item.status === 'approved' || item.status === 'completed' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{item.status}</span>
                                    </div>
                                    <div className="mb-6 border-b border-white/5 pb-6">
                                        <p className="text-[9px] text-zinc-500 mb-1">MONTAN {isDepo ? 'KLIYAN AN DECLARE' : 'KLIYAN MANDE A'}:</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-4xl font-black italic tracking-tighter text-white">{aficheMontan} <span className="text-xs text-red-600">HTG</span></p>
                                            {isDepo && item.status === 'pending' && <button onClick={() => { const nouvoVal = prompt("Antre nouvo montan:", item.amount); if (nouvoVal && !isNaN(Number(nouvoVal))) setMontanModifye(prev => ({ ...prev, [item.id]: Number(nouvoVal) })); }} className="bg-zinc-800 text-white px-3 py-2 rounded-xl text-[8px] font-black tracking-widest hover:bg-zinc-700">MODIFYE</button>}
                                        </div>
                                    </div>
                                    {item.status === 'pending' && (
                                        <div className="space-y-4">
                                            <div className="flex gap-2">
                                                <button disabled={processingId === item.id} onClick={() => isDepo ? apwouveDepo(item) : apwouveRetre(item)} className="flex-1 bg-white text-black py-4 rounded-2xl text-[10px] font-black hover:bg-green-500 hover:text-white transition-all">KONFIME APWOUVE</button>
                                                <button disabled={processingId === item.id} onClick={() => anileTranzaksyon(item, isDepo ? 'deposits' : 'withdrawals')} className="bg-red-600/20 text-red-600 border border-red-600/30 px-5 py-4 rounded-2xl text-[10px] hover:bg-red-600 hover:text-white transition-all">ANILE</button>
                                            </div>
                                            {isDepo && item.proof_img_1 && (
                                                <a href={item.proof_img_1} target="_blank" rel="noreferrer" className="block text-center bg-zinc-800 py-4 rounded-2xl text-[9px] text-zinc-400 border border-white/5 hover:text-white hover:bg-zinc-700 transition-all font-black tracking-widest">
                                                    👁️ GADE FOTO PRÈV
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    {!loading && view !== 'sispandi' && view !== 'kyc' && view !== 'promo' && view !== 'anons' && (view === 'depo' ? deposits : withdrawals).length === 0 && <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa gen okenn {view} pou kounye a</div>}
                </div>
            </div>
        </div>
    );
}