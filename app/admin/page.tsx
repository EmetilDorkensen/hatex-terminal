"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Send, UserX, ShieldCheck, AlertTriangle, Search, ArrowRightLeft, Store } from 'lucide-react';

export default function AdminSuperPage() {
    // ==========================================
    // ETA AK VARYAB YO
    // ==========================================
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [promoCodes, setPromoCodes] = useState<any[]>([]);
    const [disputes, setDisputes] = useState<any[]>([]); 
    
    const [newPromoCode, setNewPromoCode] = useState('');
    const [promoReward, setPromoReward] = useState('250');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [anonsText, setAnonsText] = useState('');
    const [anonsActive, setAnonsActive] = useState(true);
    
    const [adminReplies, setAdminReplies] = useState<{ [key: string]: string }>({});
    const [searchDisputeId, setSearchDisputeId] = useState('');
    const [searchedDispute, setSearchedDispute] = useState<any>(null);
    const [isSearchingDispute, setIsSearchingDispute] = useState(false);
    const [actionAmount, setActionAmount] = useState<number>(0);

    const [view, setView] = useState<'anons' | 'kliyan' | 'depo' | 'retre' | 'sispandi' | 'kyc' | 'promo' | 'litij'>('anons');
    
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [accessGranted, setAccessGranted] = useState(false);
    const [montanModifye, setMontanModifye] = useState<{ [key: string]: number }>({});

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

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

    // ==========================================
    // RALE TOUT DONE YO NAN BAZ DONE A
    // ==========================================
    const raleDone = async () => {
        setLoading(true);
        try {
            const { data: u } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            setAllUsers(u || []);

            const { data: d } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
            setDeposits(d || []);

            const { data: w } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false });
            setWithdrawals(w || []);

            const { data: s } = await supabase.from('profiles').select('*').eq('account_status', 'suspended').order('created_at', { ascending: false });
            setSuspendedAccounts(s || []);

            const { data: k } = await supabase.from('profiles').select('*').eq('kyc_status', 'pending').order('created_at', { ascending: false });
            setPendingKyc(k || []);

            const { data: p } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
            setPromoCodes(p || []);

            const { data: disp1 } = await supabase.from('plugin_transactions').select('*').eq('status', 'disputed');
            const { data: disp2 } = await supabase.from('transactions').select('*').eq('status', 'disputed');
            
            const allDisputes = [
                ...(disp1 || []).map(d => ({ ...d, table_source: 'plugin_transactions' })),
                ...(disp2 || []).map(d => ({ 
                    ...d, 
                    table_source: 'transactions', 
                    dispute_details: d.metadata?.dispute_details || {}, 
                    dispute_reason: d.description 
                }))
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            setDisputes(allDisputes);
            
            const { data: anonsData } = await supabase.from('global_settings').select('*').eq('id', 1).maybeSingle();
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
    // KONT AK KYC
    // ==========================================
    const deblokeKont = async (id: string, email: string) => {
        if (!confirm(`Èske w vle aktive kont sa a ankò? (${email})`)) return;
        setProcessingId(id);
        try {
            await supabase.from('profiles').update({ account_status: 'active', failed_otp_attempts: 0 }).eq('id', id);
            alert(`✅ Kont ${email} lan aktive!`);
            raleDone(); 
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const sispannKont = async (id: string, email: string) => {
        if (!confirm(`⚠️ Èske w sèten ou vle SISPANN kont sa a? (${email})\nKliyan an pap ka konekte ni fè tranzaksyon ankò.`)) return;
        setProcessingId(id);
        try {
            await supabase.from('profiles').update({ account_status: 'suspended' }).eq('id', id);
            alert(`🚫 Kont ${email} lan sispandi!`);
            raleDone(); 
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const jereKyc = async (id: string, full_name: string, email: string, aksyon: 'approved' | 'rejected') => {
        let rezonReje = "";
        if (aksyon === 'rejected') {
            const rep = prompt("Tanpri ekri rezon ki fè w rejte dokiman sa yo:");
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
    // PWOMO AK ANONS
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

    const handleSaveAnons = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving_anons');
        try {
            const { error } = await supabase.from('global_settings').update({ announcement_text: anonsText, announcement_active: anonsActive }).eq('id', 1);
            if (error) throw error;
            alert("✅ Notifikasyon an chanje avèk siksè e li rive sou tout kliyan yo!");
            raleDone();
        } catch (err: any) { alert("Erè nan sove notifikasyon an: " + err.message); } finally { setProcessingId(null); }
    };

    // ==========================================
    // NOUVO LITIJ AK RECHÈCH
    // ==========================================
    const handleAdminSearchDispute = async () => {
        if (!searchDisputeId.trim()) return alert("Tanpri mete ID kòmand lan pou w chèche a.");
        setIsSearchingDispute(true);
        setSearchedDispute(null);
        
        try {
            const cleanId = searchDisputeId.trim().toLowerCase();
            let tx = null;
            
            let { data: pluginTx } = await supabase.from('plugin_transactions').select('*').ilike('order_id', `${cleanId}%`).maybeSingle();
            if (!pluginTx) {
                const { data: pluginTxOld } = await supabase.from('plugin_transactions').select('*').ilike('id', `${cleanId}%`).maybeSingle();
                pluginTx = pluginTxOld;
            }
            
            if (pluginTx) {
                tx = { ...pluginTx, table_source: 'plugin_transactions' };
            } else {
                let { data: normTx } = await supabase.from('transactions').select('*').ilike('order_id', `${cleanId}%`).maybeSingle();
                if (!normTx) {
                    const { data: normTxOld } = await supabase.from('transactions').select('*').ilike('id', `${cleanId}%`).maybeSingle();
                    normTx = normTxOld;
                }
                if (normTx) {
                    tx = { 
                        ...normTx, 
                        table_source: 'transactions', 
                        dispute_details: normTx.metadata?.dispute_details || {}, 
                        dispute_reason: normTx.description 
                    };
                }
            }

            if (!tx) return alert("Sistèm nan pa jwenn okenn kòmand avèk ID sa a ditou. Tcheke si ID a bon.");

            setActionAmount(Number(tx.amount_htg || Math.abs(tx.amount) || 0));
            setSearchedDispute(tx);
            
        } catch (err: any) {
            alert("Erè: " + err.message);
        } finally {
            setIsSearchingDispute(false);
        }
    };

    const getPartiesForTx = (tx: any) => {
        if (!tx) return { sender: null, receiver: null };
        let sender = null;
        let receiver = null;

        if (tx.table_source === 'plugin_transactions') {
            const senderId = tx.dispute_details?.client_id || tx.metadata?.customer_id || tx.user_id;
            sender = allUsers.find(u => u.id === senderId || u.email === tx.metadata?.customer_email);

            const receiverId = tx.metadata?.merchant_id || tx.dispute_details?.merchant_id;
            receiver = allUsers.find(u => u.id === receiverId || u.email === tx.metadata?.merchant_email);
            if (!receiver && tx.user_id !== senderId) receiver = allUsers.find(u => u.id === tx.user_id);
        } else {
            sender = allUsers.find(u => u.id === tx.user_id);
            const rEmail = tx.metadata?.receiver_email;
            receiver = allUsers.find(u => u.email === rEmail);
        }

        return { sender, receiver };
    };

    const balanseLajanKont = async (fromUser: any, toUser: any, tipChanjman: string) => {
        if (!fromUser && !toUser) return alert("Sistèm nan pa jwenn okenn pwofil! Nou pa ka fè tranzaksyon an.");
        if (actionAmount <= 0) return alert("Ou dwe mete yon montan ki pi gwo pase zewo.");
        
        let mesajKonfimasyon = "";
        if (!fromUser) {
            mesajKonfimasyon = `⚠️ MACHANN NAN PA SOU SISTÈM NAN!\n\nÈske w vle FÒSE ajoute ${actionAmount} HTG sou kont kliyan an (${toUser?.full_name}) kanmenm? (Kòb la pap sòti sou okenn lòt kont).`;
        } else if (!toUser) {
            mesajKonfimasyon = `⚠️ KLIYAN AN PA SOU SISTÈM NAN!\n\nÈske w vle FÒSE retire ${actionAmount} HTG sou kont ${fromUser?.full_name} kanmenm?`;
        } else {
            mesajKonfimasyon = `⚠️ SÈTEN?\n\nOu pral RETIRE ${actionAmount} HTG sou kont: ${fromUser.full_name}\nPou w AJOUTE sou kont: ${toUser.full_name}\n\nKontinye?`;
        }

        if (!confirm(mesajKonfimasyon)) return;

        setProcessingId('balance_transfer');
        try {
            if (fromUser) {
                const { data: f } = await supabase.from('profiles').select('wallet_balance').eq('id', fromUser.id).single();
                await supabase.from('profiles').update({ wallet_balance: Number(f?.wallet_balance || 0) - actionAmount }).eq('id', fromUser.id);
                await supabase.from('transactions').insert([{ user_id: fromUser.id, amount: -actionAmount, type: 'ADMIN_ADJUSTMENT', description: tipChanjman, status: 'success' }]);
            }

            if (toUser) {
                const { data: t } = await supabase.from('profiles').select('wallet_balance').eq('id', toUser.id).single();
                await supabase.from('profiles').update({ wallet_balance: Number(t?.wallet_balance || 0) + actionAmount }).eq('id', toUser.id);
                await supabase.from('transactions').insert([{ user_id: toUser.id, amount: actionAmount, type: 'ADMIN_ADJUSTMENT', description: tipChanjman, status: 'success' }]);
            }

            if (searchedDispute?.status === 'disputed') {
                if (searchedDispute.table_source === 'plugin_transactions') {
                    await supabase.from('plugin_transactions').update({ status: 'refunded' }).eq('id', searchedDispute.id);
                } else {
                    await supabase.from('transactions').update({ status: 'refunded' }).eq('id', searchedDispute.id);
                }
            }

            alert(`✅ SIKSÈ! Tranzaksyon an fèt!`);
            setSearchedDispute(null); 
            raleDone(); 
        } catch (err: any) {
            alert("Erè: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const voyeReponsAdmin = async (txId: string, currentDetails: any, tabSource: string) => {
        const replyText = adminReplies[txId];
        if (!replyText || replyText.trim() === '') return alert("Tanpri ekri yon mesaj anvan w voye l!");
        setProcessingId(`reply_${txId}`);
        try {
            // Nou tou kole nouvo mesaj la nan istorik Admin nan pou l pa pèdi mesaj kliyan an
            const updatedDetails = { ...currentDetails, admin_reply: replyText };
            if (tabSource === 'plugin_transactions') {
                await supabase.from('plugin_transactions').update({ dispute_details: updatedDetails }).eq('id', txId);
            } else {
                const { data: oldTx } = await supabase.from('transactions').select('metadata').eq('id', txId).single();
                await supabase.from('transactions').update({ metadata: { ...oldTx?.metadata, dispute_details: updatedDetails } }).eq('id', txId);
            }
            
            alert("✅ Mesaj la ale!");
            setAdminReplies({ ...adminReplies, [txId]: '' }); 
            raleDone(); 
            if (searchedDispute && searchedDispute.id === txId) {
                setSearchedDispute({...searchedDispute, dispute_details: updatedDetails});
            }
        } catch (err: any) { alert("Erè nan voye mesaj la: " + err.message); } finally { setProcessingId(null); }
    };

    const filteredUsers = allUsers.filter(user => {
        if (!searchQuery) return true;
        const lowerQuery = searchQuery.toLowerCase();
        return user.email?.toLowerCase().includes(lowerQuery) || user.full_name?.toLowerCase().includes(lowerQuery);
    });

    const getClientInfo = (clientId: string) => {
        return allUsers.find(u => u.id === clientId) || null;
    };

    if (!accessGranted) return <div className="bg-black h-screen" />;

    return (
        <div className="min-h-screen bg-[#0a0b14] text-white p-4 uppercase italic font-bold pb-24">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-4">
                    <h1 className="text-2xl font-black text-red-600 italic tracking-tighter">HATEX ADMIN</h1>
                    <button onClick={raleDone} className="bg-zinc-800 p-3 rounded-xl text-[10px] active:scale-95 transition-all">REFRESH</button>
                </div>

                <div className="flex gap-2 mb-8 bg-zinc-900/50 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar whitespace-nowrap custom-scrollbar pb-2">
                    <button onClick={() => setView('anons')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'anons' ? 'bg-blue-600 shadow-lg shadow-blue-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>📢 ANONS</button>
                    <button onClick={() => setView('kliyan')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'kliyan' ? 'bg-indigo-600 shadow-lg shadow-indigo-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>👥 KLIYAN ({allUsers.length})</button>
                    <button onClick={() => setView('litij')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all relative ${view === 'litij' ? 'bg-yellow-600 shadow-lg shadow-yellow-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>
                        ⚠️ LITIJ / CHÈCHE
                        {disputes.length > 0 && <span className="absolute -top-1 -right-1 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded-full text-[8px] animate-pulse">{disputes.length}</span>}
                    </button>
                    <button onClick={() => setView('depo')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'depo' ? 'bg-red-600 shadow-lg shadow-red-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>DEPO ({deposits.filter(d => d.status === 'pending').length})</button>
                    <button onClick={() => setView('retre')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'retre' ? 'bg-red-600 shadow-lg shadow-red-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>RETRÈ ({withdrawals.filter(w => w.status === 'pending').length})</button>
                    <button onClick={() => setView('kyc')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'kyc' ? 'bg-red-600 shadow-lg shadow-red-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>KYC ({pendingKyc.length})</button>
                    <button onClick={() => setView('promo')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'promo' ? 'bg-red-600 shadow-lg shadow-red-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>PWOMO</button>
                    <button onClick={() => setView('sispandi')} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all ${view === 'sispandi' ? 'bg-red-600 shadow-lg shadow-red-600/20 text-white' : 'text-zinc-500 hover:text-white'}`}>SISPANDI</button>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 animate-pulse text-zinc-500 text-xs">L-AP CHACHE DONE YO...</div>
                    ) : view === 'litij' ? (
                        <div className="space-y-8">
                            <div className="bg-[#121420] p-6 rounded-[2rem] border border-yellow-500/30 shadow-lg shadow-yellow-900/10">
                                <p className="text-[10px] font-black text-yellow-500 mb-3 tracking-widest uppercase flex items-center gap-2">
                                    <Search size={14} /> Chèche ID kòmand lan (Acha, Transfè, Depo...)
                                </p>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="Kole ID 12 chif la la a..." 
                                        value={searchDisputeId} 
                                        onChange={(e) => setSearchDisputeId(e.target.value)}
                                        className="flex-1 bg-black border border-white/10 p-4 rounded-xl text-white outline-none focus:border-yellow-500/50 transition-all font-mono uppercase text-sm"
                                    />
                                    <button 
                                        onClick={handleAdminSearchDispute}
                                        disabled={isSearchingDispute || !searchDisputeId}
                                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 rounded-xl font-black transition-all disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                                    >
                                        {isSearchingDispute ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "CHÈCHE"}
                                    </button>
                                </div>
                            </div>

                            {searchedDispute && (() => {
                                const { sender, receiver } = getPartiesForTx(searchedDispute);

                                return (
                                    <div className="mb-10 relative">
                                        <div className="absolute -top-3 left-6 bg-yellow-500 text-black px-3 py-1 rounded-md text-[9px] font-black uppercase z-10 flex items-center gap-1">
                                            <AlertTriangle size={12}/> JERE TRANZAKSYON #{searchedDispute.order_id || searchedDispute.id.substring(0,8)}
                                        </div>
                                        <div className="bg-[#121420] rounded-[2.5rem] border-2 border-yellow-500 overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.15)] p-6 pt-10 relative">
                                            
                                            <button onClick={() => setSearchedDispute(null)} className="absolute top-4 right-4 bg-zinc-800 text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500 transition-colors z-10">✕</button>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                                <div className="bg-black/50 border border-white/5 p-5 rounded-2xl relative">
                                                    <span className="absolute -top-3 left-4 bg-zinc-800 text-zinc-300 text-[8px] px-2 py-1 rounded">MOUN KI PEYE / VOYE A</span>
                                                    {sender ? (
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-xl border border-white/10 shrink-0">👤</div>
                                                            <div className="overflow-hidden">
                                                                <p className="text-sm font-black truncate text-white">{sender.full_name}</p>
                                                                <p className="text-[10px] text-zinc-500 lowercase truncate">{sender.email}</p>
                                                                <p className="text-xs text-green-400 mt-1">Balans: {Number(sender.wallet_balance).toLocaleString()} HTG</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-red-500 italic mt-2 font-black tracking-widest">⚠️ Kliyan an pa jwenn.</p>
                                                    )}
                                                </div>

                                                <div className="bg-black/50 border border-white/5 p-5 rounded-2xl relative">
                                                    <span className="absolute -top-3 left-4 bg-zinc-800 text-zinc-300 text-[8px] px-2 py-1 rounded">MOUN KI RESEVWA A (MACHANN)</span>
                                                    {receiver ? (
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center text-xl border border-blue-500/30 shrink-0"><Store size={20}/></div>
                                                            <div className="overflow-hidden">
                                                                <p className="text-sm font-black truncate text-white">{receiver.full_name}</p>
                                                                <p className="text-[10px] text-zinc-500 lowercase truncate">{receiver.email}</p>
                                                                <p className="text-xs text-green-400 mt-1">Balans: {Number(receiver.wallet_balance).toLocaleString()} HTG</p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="text-[10px] text-red-500 italic mt-2 font-black tracking-widest">⚠️ Pwofil machann pa disponib nan baz done a.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
                                                <div className="flex flex-col md:flex-row items-center gap-4">
                                                    <div className="w-full md:w-1/3">
                                                        <label className="text-[9px] text-zinc-500 uppercase tracking-widest block mb-2">Montan (HTG)</label>
                                                        <input 
                                                            type="number" 
                                                            value={actionAmount} 
                                                            onChange={(e) => setActionAmount(Number(e.target.value))}
                                                            className="w-full bg-black border border-yellow-500/30 p-4 rounded-xl text-yellow-500 font-black text-xl outline-none focus:border-yellow-500 transition-colors"
                                                        />
                                                    </div>

                                                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 md:mt-0">
                                                        <button 
                                                            onClick={() => balanseLajanKont(receiver, sender, `Ranbousman LITIJ #${searchedDispute.order_id || searchedDispute.id.substring(0,8)}`)}
                                                            disabled={processingId === 'balance_transfer' || (!receiver && !sender)}
                                                            className="bg-zinc-800 hover:bg-zinc-700 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50"
                                                        >
                                                            <ArrowRightLeft className="text-red-400 rotate-180" size={20} />
                                                            <span className="text-[9px] text-white tracking-widest text-center">RANBOUSE KLIYAN AN<br/><span className="text-zinc-500">(Rale nan Machann {'->'} Mete nan Kliyan)</span></span>
                                                        </button>

                                                        <button 
                                                            onClick={() => balanseLajanKont(sender, receiver, `Peman LITIJ #${searchedDispute.order_id || searchedDispute.id.substring(0,8)}`)}
                                                            disabled={processingId === 'balance_transfer' || (!receiver && !sender)}
                                                            className="bg-zinc-800 hover:bg-zinc-700 border border-white/10 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-50"
                                                        >
                                                            <ArrowRightLeft className="text-green-400" size={20} />
                                                            <span className="text-[9px] text-white tracking-widest text-center">PEYE MACHANN NAN<br/><span className="text-zinc-500">(Rale nan Kliyan {'->'} Mete nan Machann)</span></span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-8 border-t border-white/5">
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4">Mesaj Ak Kliyan an / Prèv Litij</p>
                                                <div className="bg-black border border-white/5 rounded-2xl p-4 max-h-[250px] overflow-y-auto mb-4 space-y-4">
                                                    <div className="flex flex-col items-start max-w-[85%]">
                                                        <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-sm text-white text-xs whitespace-pre-wrap normal-case">
                                                            {searchedDispute.dispute_details?.proof_text || searchedDispute.dispute_reason || searchedDispute.description || 'Pa gen mesaj sou sistèm nan pou tranzaksyon sa a.'}
                                                        </div>
                                                    </div>
                                                    {searchedDispute.dispute_details?.admin_reply && (
                                                        <div className="flex flex-col items-end max-w-[85%] ml-auto">
                                                            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-2xl rounded-tr-sm text-white text-xs whitespace-pre-wrap normal-case">
                                                                {searchedDispute.dispute_details?.admin_reply}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="bg-zinc-900 rounded-xl p-2 flex gap-2 border border-white/10 focus-within:border-red-500/50 transition-colors">
                                                    <textarea 
                                                        placeholder="Voye yon mesaj bay kliyan an..."
                                                        value={adminReplies[searchedDispute.id] || ''}
                                                        onChange={(e) => setAdminReplies({ ...adminReplies, [searchedDispute.id]: e.target.value })}
                                                        className="flex-1 bg-transparent border-none outline-none text-xs p-3 text-white normal-case resize-none min-h-[40px]"
                                                    ></textarea>
                                                    <button 
                                                        onClick={() => voyeReponsAdmin(searchedDispute.id, searchedDispute.dispute_details || {}, searchedDispute.table_source)}
                                                        className="bg-red-600 hover:bg-red-500 w-12 rounded-lg flex items-center justify-center text-white"
                                                    >
                                                        <Send size={16} />
                                                    </button>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                );
                            })()}

                            {disputes.length > 0 && !searchedDispute && (
                                <>
                                    <h2 className="text-xl font-black text-white border-b border-white/10 pb-2">TOUT PLENT KI LOUVRI YO ({disputes.length})</h2>
                                    {disputes.map((tx) => {
                                        const client = getClientInfo(tx.dispute_details?.client_id || tx.user_id);
                                        return (
                                            <div key={tx.id} className="bg-[#121420] rounded-[2.5rem] border border-zinc-800 overflow-hidden shadow-lg flex flex-col lg:flex-row opacity-80 hover:opacity-100 transition-opacity">
                                                <div className="w-full lg:w-1/3 bg-zinc-900/50 p-6 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-6">
                                                            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 border border-yellow-500/30"><AlertTriangle size={20} /></div>
                                                            <div><h3 className="text-lg font-black text-white">LITIJ #{tx.order_id || tx.id.substring(0,8)}</h3><p className="text-[10px] text-zinc-400 font-bold tracking-widest">{new Date(tx.created_at).toLocaleDateString()}</p></div>
                                                        </div>
                                                        {client ? (
                                                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 mb-6">
                                                                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-3 font-black flex items-center gap-2"><UserX size={12} /> Enfòmasyon Kliyan</p>
                                                                <p className="text-sm font-black text-white mb-1 truncate">{client.full_name}</p>
                                                                <p className="text-[10px] text-zinc-400 mb-3 lowercase truncate">{client.email}</p>
                                                                <div className="bg-zinc-900 px-3 py-2 rounded-xl inline-block border border-white/5"><span className="text-[9px] text-zinc-500">BALANS: </span><span className="text-xs text-green-400">{Number(client.wallet_balance).toLocaleString()} HTG</span></div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-red-400 mb-6">Enfòmasyon kliyan an pa disponib.</p>
                                                        )}
                                                        <div className="space-y-3">
                                                            <div><p className="text-[9px] text-zinc-500">BOUTIK LA / TIP:</p><p className="text-xs text-white">{tx.dispute_details?.store_name || tx.metadata?.merchant_name || tx.type || 'Enkoni'}</p></div>
                                                            <div><p className="text-[9px] text-zinc-500">REZON PLENT LAN:</p><p className="text-xs text-red-400">{tx.dispute_reason || 'Enkoni'}</p></div>
                                                            <div><p className="text-[9px] text-zinc-500">MONTAN AN JÈ:</p><p className="text-2xl font-black text-white italic">{tx.amount_htg || Math.abs(tx.amount)} <span className="text-xs text-yellow-500">HTG</span></p></div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-8 pt-6 border-t border-white/5">
                                                        <button onClick={() => { setSearchDisputeId(tx.order_id || tx.id); handleAdminSearchDispute(); }} className="w-full bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl text-[10px] font-black text-white shadow-lg shadow-yellow-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">🔍 LOUVRI DOSYE A POU REZOUD LI</button>
                                                    </div>
                                                </div>
                                                <div className="w-full lg:w-2/3 flex flex-col p-6 bg-black relative">
                                                    <div className="flex-1 overflow-y-auto mb-6 pr-2 space-y-6 custom-scrollbar">
                                                        <div className="flex flex-col items-start max-w-[85%]">
                                                            <div className="flex items-center gap-2 mb-1 pl-1"><div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs">👤</div><span className="text-[10px] text-zinc-400 lowercase">{client?.full_name || 'Kliyan'}</span></div>
                                                            <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-sm border border-white/5 text-white text-xs leading-relaxed lowercase normal-case whitespace-pre-wrap">{tx.dispute_details?.proof_text || tx.dispute_reason || 'Pa gen detay prèv.'}</div>
                                                        </div>
                                                        {tx.dispute_details?.admin_reply && (
                                                            <div className="flex flex-col items-end max-w-[85%] ml-auto">
                                                                <div className="flex items-center gap-2 mb-1 pr-1"><span className="text-[10px] text-red-500 lowercase">Admin</span><div className="w-6 h-6 rounded-full bg-red-900/50 flex items-center justify-center text-xs text-red-500 border border-red-500/30"><ShieldCheck size={12}/></div></div>
                                                                <div className="bg-red-900/20 p-4 rounded-2xl rounded-tr-sm border border-red-500/30 text-white text-xs leading-relaxed lowercase normal-case whitespace-pre-wrap">{tx.dispute_details?.admin_reply}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="mt-auto bg-zinc-900 rounded-2xl p-2 flex gap-2 border border-white/10 focus-within:border-red-500/50 transition-colors">
                                                        <textarea placeholder="Tape repons ou an pou kliyan an la a..." value={adminReplies[tx.id] || ''} onChange={(e) => setAdminReplies({ ...adminReplies, [tx.id]: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-xs p-3 text-white normal-case resize-none min-h-[50px]"></textarea>
                                                        <button onClick={() => voyeReponsAdmin(tx.id, tx.dispute_details || {}, tx.table_source)} disabled={processingId === `reply_${tx.id}`} className="bg-red-600 hover:bg-red-500 w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-red-600/20 transition-all active:scale-90">{processingId === `reply_${tx.id}` ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send size={16} />}</button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>
                    ) : view === 'kliyan' ? (
                        <div className="space-y-6">
                            <div className="bg-[#121420] p-4 rounded-3xl border border-indigo-500/30 shadow-lg shadow-indigo-900/10 flex items-center gap-3">
                                <span className="text-xl ml-2">🔍</span>
                                <input type="text" placeholder="CHÈCHE YON KLIYAN AK IMÈL LI OSWA NON L..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none p-2 text-white outline-none font-black tracking-widest placeholder:text-zinc-600 text-xs sm:text-sm" />
                                {searchQuery && <button onClick={() => setSearchQuery('')} className="bg-zinc-800 text-zinc-400 p-2 rounded-xl text-[10px] hover:text-white hover:bg-zinc-700 transition-all">EFASE</button>}
                            </div>
                            <div className="space-y-4">
                                {filteredUsers.length === 0 ? (
                                    <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa jwenn okenn kliyan ak non oswa imèl sa a</div>
                                ) : (
                                    filteredUsers.map(user => (
                                        <div key={user.id} className={`bg-zinc-900 p-5 sm:p-6 rounded-[2.5rem] border ${user.account_status === 'suspended' ? 'border-red-600/50 bg-red-950/10' : 'border-white/5'} relative flex flex-col md:flex-row gap-6 items-center justify-between transition-all`}>
                                            <div className="flex items-center gap-4 w-full md:w-auto">
                                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl border shrink-0 ${user.account_status === 'suspended' ? 'bg-red-900/40 text-red-500 border-red-500/30' : 'bg-zinc-800 text-white border-white/10'}`}>{user.full_name ? user.full_name.charAt(0).toUpperCase() : '👤'}</div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm sm:text-base font-black text-white truncate w-full">{user.full_name || 'San Non'}</h3><p className="text-[10px] text-zinc-400 lowercase truncate w-full">{user.email}</p>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="text-[9px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded-md">BALANS: <span className="text-white">{Number(user.wallet_balance || 0).toLocaleString()} HTG</span></span>
                                                        <span className={`text-[9px] px-2 py-1 rounded-md ${user.kyc_status === 'approved' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-500'}`}>KYC: {user.kyc_status}</span>
                                                        {user.is_card_activated && <span className="text-[9px] bg-blue-900/30 text-blue-400 px-2 py-1 rounded-md">KAT AKTIVE</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                                {user.account_status === 'suspended' ? (
                                                    <button onClick={() => deblokeKont(user.id, user.email)} disabled={processingId === user.id} className="w-full md:w-auto bg-green-600 px-6 py-4 rounded-2xl text-[10px] font-black text-white hover:bg-green-500 transition-all shadow-lg shadow-green-600/20">AKTIVE KONT</button>
                                                ) : (
                                                    <button onClick={() => sispannKont(user.id, user.email)} disabled={processingId === user.id} className="w-full md:w-auto bg-red-600/20 border border-red-600/30 text-red-500 px-6 py-4 rounded-2xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all">SISPANN KONT</button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : view === 'anons' ? (
                        <div className="bg-[#121420] p-6 rounded-3xl border border-blue-500/30 mb-8 shadow-lg shadow-blue-900/10">
                            <div className="flex items-center gap-3 mb-6"><span className="text-2xl drop-shadow-md">📢</span><h2 className="text-xl font-black uppercase text-blue-400 tracking-widest">Jere Notifikasyon Global</h2></div>
                            <form onSubmit={handleSaveAnons} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] text-zinc-400 font-black uppercase tracking-widest ml-2">Tèks k ap parèt sou paj kliyan yo:</label>
                                    <textarea value={anonsText} onChange={(e) => setAnonsText(e.target.value)} placeholder="Ekri mesaj ou vle tout kliyan wè a la a..." className="w-full bg-black border border-white/10 p-5 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-sm min-h-[150px] text-white whitespace-pre-wrap normal-case" required />
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-black rounded-2xl border border-white/5 cursor-pointer" onClick={() => setAnonsActive(!anonsActive)}>
                                    <input type="checkbox" checked={anonsActive} onChange={(e) => setAnonsActive(e.target.checked)} className="w-6 h-6 accent-blue-600 cursor-pointer" onClick={(e) => e.stopPropagation()}/>
                                    <div className="flex flex-col"><span className="text-[11px] font-black uppercase tracking-widest text-white">Afiche notifikasyon an?</span><span className="text-[9px] text-zinc-500 normal-case italic">Si bwat sa pa make, notifikasyon an pap parèt pou kliyan yo.</span></div>
                                </div>
                                <button type="submit" disabled={processingId === 'saving_anons'} className="w-full bg-blue-600 hover:bg-blue-500 px-8 py-5 rounded-2xl font-black uppercase italic active:scale-95 transition-all text-white shadow-lg shadow-blue-600/20">{processingId === 'saving_anons' ? "AP SOVE..." : "SOVE NOTIFIKASYON AN"}</button>
                            </form>
                        </div>
                    ) : view === 'kyc' ? (
                        pendingKyc.length === 0 ? (
                            <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa gen okenn KYC k ap tann</div>
                        ) : (
                            pendingKyc.map((user) => (
                                <div key={user.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                                    <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center text-2xl border border-white/10 shrink-0">👤</div>
                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="text-lg font-black text-white">{user.full_name || 'San Non'}</h3><p className="text-[10px] text-zinc-400 mb-4 lowercase">{user.email}</p>
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
                        <div>
                            <form onSubmit={handleCreateCode} className="bg-[#121420] p-6 rounded-3xl border border-purple-500/30 mb-8 flex flex-col md:flex-row gap-4 items-end shadow-lg shadow-purple-900/10">
                                <div className="flex-1 w-full space-y-2"><label className="text-[9px] text-purple-400 font-black uppercase tracking-widest ml-2">Nouvo Kòd (Ex: IZO2026)</label><input type="text" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())} placeholder="NON ATIS LA" className="w-full bg-black border border-white/10 p-4 rounded-xl focus:border-purple-500 outline-none transition-all font-bold text-sm uppercase" required /></div>
                                <div className="w-full md:w-48 space-y-2"><label className="text-[9px] text-purple-400 font-black uppercase tracking-widest ml-2">Rediksyon (HTG)</label><input type="number" value={promoReward} onChange={(e) => setPromoReward(e.target.value)} className="w-full bg-black border border-white/10 p-4 rounded-xl focus:border-purple-500 outline-none transition-all font-bold text-sm" required min="0" /></div>
                                <button type="submit" disabled={processingId === 'creating_promo'} className="w-full md:w-auto bg-purple-600 px-8 py-4 rounded-xl font-black uppercase italic active:scale-95 transition-all">{processingId === 'creating_promo' ? "AP KREYE..." : "KREYE KÒD LA"}</button>
                            </form>
                            <div className="overflow-x-auto bg-[#121420] rounded-3xl border border-white/5">
                                <table className="w-full text-left border-collapse">
                                    <thead><tr className="border-b border-white/5 bg-black/20"><th className="p-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest">Kòd Pwomo</th><th className="p-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-center">Rediksyon (HTG)</th><th className="p-4 text-[10px] font-black uppercase text-zinc-400 tracking-widest text-center">Moun Mennen</th></tr></thead>
                                    <tbody>
                                        {promoCodes.length === 0 ? (<tr><td colSpan={3} className="p-8 text-center text-[10px] font-black uppercase text-zinc-600">Pa gen kòd kreye ankò.</td></tr>) : (
                                            promoCodes.map((promo) => (<tr key={promo.code} className="border-b border-white/5"><td className="p-4 font-black text-purple-500">{promo.code}</td><td className="p-4 text-center font-bold text-white">{promo.reward_amount} HTG</td><td className="p-4 text-center"><span className="bg-green-500/20 text-green-500 px-3 py-1 rounded-lg font-black text-[12px]">{promo.usage_count}</span></td></tr>))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : view === 'sispandi' ? (
                        suspendedAccounts.map((account) => (
                            <div key={account.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-red-600/30 relative overflow-hidden flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-600/50"><span className="text-xl">⚠️</span></div>
                                <h3 className="text-lg font-black truncate w-full">{account.full_name || 'San Non'}</h3><p className="text-[10px] text-zinc-400 mb-6 lowercase">{account.email}</p>
                                <button onClick={() => deblokeKont(account.id, account.email)} disabled={processingId === account.id} className="w-full bg-green-600 py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all">{processingId === account.id ? 'AP AKTIVE...' : 'AKTIVE KONT SA A'}</button>
                            </div>
                        ))
                    ) : (
                        (view === 'depo' ? deposits : withdrawals).map((item) => {
                            const isDepo = view === 'depo';
                            const aficheMontan = isDepo && montanModifye[item.id] !== undefined ? montanModifye[item.id] : item.amount;
                            return (
                                <div key={item.id} className="bg-zinc-900 p-6 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                                    {item.status !== 'pending' && <button onClick={() => deleteTranzaksyon(item.id, isDepo ? 'deposits' : 'withdrawals')} className="absolute top-5 right-5 text-red-600 text-[9px] bg-red-600/10 px-2 py-1 rounded hover:bg-red-600 hover:text-white transition-colors">EFASE</button>}
                                    <div className="flex justify-between mb-4 pr-12"><div className="flex flex-col"><span className="text-[9px] text-zinc-500">KLIYAN ID: {item.user_id?.slice(0,8)}...</span><span className="text-[9px] text-zinc-400">METÒD: {item.method}</span></div><span className={`text-[8px] h-fit px-3 py-1 rounded-full font-black ${item.status === 'pending' ? 'bg-yellow-500 text-black' : item.status === 'approved' || item.status === 'completed' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{item.status}</span></div>
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
                                            {isDepo && item.proof_img_1 && (<a href={item.proof_img_1} target="_blank" rel="noreferrer" className="block text-center bg-zinc-800 py-4 rounded-2xl text-[9px] text-zinc-400 border border-white/5 hover:text-white hover:bg-zinc-700 transition-all font-black tracking-widest">👁️ GADE FOTO PRÈV</a>)}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    {!loading && view !== 'sispandi' && view !== 'litij' && view !== 'kliyan' && view !== 'kyc' && view !== 'promo' && view !== 'anons' && (view === 'depo' ? deposits : withdrawals).length === 0 && <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa gen okenn {view} pou kounye a</div>}
                </div>
            </div>
        </div>
    );
}