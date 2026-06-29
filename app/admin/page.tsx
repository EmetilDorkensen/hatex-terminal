"use client";

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Send, UserX, ShieldCheck, AlertTriangle, Search, ArrowRightLeft, Store, Plus, Minus, Lock, Briefcase, DollarSign, EyeOff, Loader2, CheckCircle2, FileText, UploadCloud, ChevronRight, XCircle } from 'lucide-react';

export default function AdminSuperPage() {
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [promoCodes, setPromoCodes] = useState<any[]>([]);
    
    // NOUVO: State pou ajan yo
    const [pendingAgents, setPendingAgents] = useState<any[]>([]);
    const [agentRejectionReason, setAgentRejectionReason] = useState<{ [key: string]: string }>({});

    const [totalCardBal, setTotalCardBal] = useState(0);
    const [newPromoCode, setNewPromoCode] = useState('');
    const [promoReward, setPromoReward] = useState('250');
    const [searchQuery, setSearchQuery] = useState('');
    
    const [anonsText, setAnonsText] = useState('');
    const [anonsActive, setAnonsActive] = useState(true);
    
    const [view, setView] = useState<'anons' | 'kliyan' | 'depo' | 'retre' | 'sispandi' | 'kyc' | 'promo' | 'ajan' | 'biznis'>('depo'); 
    
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [accessGranted, setAccessGranted] = useState(false);
    const [montanModifye, setMontanModifye] = useState<{ [key: string]: number }>({});

    // ==========================================
    // ETA POU KONT BIZNIS LA
    // ==========================================
    const [businessTabPasswordVerified, setBusinessTabPasswordVerified] = useState(false);
    const [loadingBiznis, setLoadingBiznis] = useState(false);
    const [totalClientBal, setTotalClientBal] = useState(0);
    const [totalBiznisProfit, setTotalBiznisProfit] = useState(0);
    const [feesBreakdown, setFeesBreakdown] = useState({ depo: 0, retre: 0, transfe: 0 });

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const BOT_TOKEN = "7547464134:AAH3M_R89D0UuN-WlOclj2D-Hj9S9I_K28Y";
    const CHAT_ID = "5352352512";

    useEffect(() => {
        const pass = prompt("Antre modpas Admin lan:");
        if (pass === "@fiokes1234") {
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

            // NOUVO: Fetch ajan ki an atant yo
            const { data: agData } = await supabase.from('agent_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false });
            if (agData && u) {
                const mergedAgents = agData.map(agent => ({
                   ...agent,
                   profiles: u.find(user => user.id === agent.user_id) || {}
                }));
                setPendingAgents(mergedAgents);
            }
            
            const { data: anonsData } = await supabase.from('global_settings').select('*').eq('id', 1).maybeSingle();
            if (anonsData) {
                setAnonsText(anonsData.announcement_text || '');
                setAnonsActive(anonsData.announcement_active);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleOpenMaskedUrl = (url: string) => {
        if (!url) return;
        const newWindow = window.open('about:blank', '_blank');
        if (newWindow) {
            newWindow.document.write(`
                <html style="background:#f8fafc; display:flex; justify-content:center; align-items:center; margin:0;">
                    <head><title>Dokiman Sekirize - HatexCard</title></head>
                    <body>
                        <img src="${url}" style="max-width:100%; max-height:100vh; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;"/>
                    </body>
                </html>
            `);
            newWindow.document.close();
        }
    };

    const handleOpenBiznis = async () => {
        if (businessTabPasswordVerified) {
            setView('biznis');
            kalkileTotalBiznis();
            return;
        }

        const pass = prompt("ANTRE MODPAS SEKRÈ FINANSYE A:");
        if (!pass) return;

        try {
            const { data: settings } = await supabase.from('global_settings').select('finance_password').eq('id', 1).maybeSingle();
            const validPass = settings?.finance_password || '@fiokes1234';

            if (pass === validPass) {
                setBusinessTabPasswordVerified(true);
                setView('biznis');
                kalkileTotalBiznis();
            } else {
                alert("Modpas la pa bon! Ou pa gen aksè ak kès biznis la.");
            }
        } catch (e) {
            alert("Erè nan sistèm sekirite a.");
        }
    };

    const kalkileTotalBiznis = async () => {
        setLoadingBiznis(true);
        try {
            const { data: profiles } = await supabase.from('profiles').select('wallet_balance, card_balance');
            
            const totalKliyan = (profiles || []).reduce((acc, u) => acc + Number(u.wallet_balance || 0), 0);
            setTotalClientBal(totalKliyan);

            const totalKat = (profiles || []).reduce((acc, u) => acc + Number(u.card_balance || 0), 0);
            setTotalCardBal(totalKat);

            const { data: depData, error: errDep } = await supabase.from('deposits').select('fee').eq('status', 'approved');
            const totalDepoFee = errDep ? 0 : (depData || []).reduce((acc, d) => acc + Number(d.fee || 0), 0);

            const { data: witData, error: errWit } = await supabase.from('withdrawals').select('fee').eq('status', 'completed');
            const totalRetreFee = errWit ? 0 : (witData || []).reduce((acc, w) => acc + Number(w.fee || 0), 0);

            const { data: traData, error: errTra } = await supabase.from('transfers').select('fee, status');
            const totalTransfeFee = errTra ? 0 : (traData || [])
                .filter(t => !t.status || t.status === 'success' || t.status === 'completed')
                .reduce((acc, t) => acc + Number(t.fee || 0), 0);
                
            // Ajoute frè ki soti nan Ajan yo ki soti nan transactions tab kote type = 'FEE'
            const { data: feeData } = await supabase.from('transactions').select('amount').eq('type', 'FEE').eq('status', 'success');
            const totalAgentFee = (feeData || []).reduce((acc, f) => acc + Math.abs(Number(f.amount || 0)), 0);

            setFeesBreakdown({ depo: totalDepoFee, retre: totalRetreFee, transfe: totalTransfeFee + totalAgentFee });
            
            const granTotalPwofi = totalDepoFee + totalRetreFee + totalTransfeFee + totalAgentFee;
            setTotalBiznisProfit(granTotalPwofi);

        } catch (error) {
            console.error("Erè kalkil biznis:", error);
            alert("Sistèm nan jwenn yon ti pwoblèm nan rale done yo. Tcheke si tab transfers la ekziste byen.");
        } finally {
            setLoadingBiznis(false);
        }
    };

    const voyeEmailKliyan = async (email: string, non: string, mesaj: string, subject: string) => {
        if (!email) return;
        try {
            await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email.trim(), subject, non, mesaj }), });
        } catch (error) { console.error("Erè email:", error); }
    };

    const voyeTelegram = async (msg: string) => {
        try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'HTML' }), });
        } catch (e) { console.error("Telegram error", e); }
    };

    const deleteTranzaksyon = async (id: string, table: string) => {
        if (!confirm("Èske ou vle efase istwa sa a nèt?")) return;
        setProcessingId(id);
        try {
            await supabase.from(table).delete().eq('id', id);
            alert("Efase nèt!"); raleDone();
        } finally { setProcessingId(null); }
    };

    const apwouveDepo = async (d: any) => {
        const isModified = montanModifye[d.id] !== undefined;
        const montanFinal = isModified ? montanModifye[d.id] : Number(d.amount);
        
        const frePouBiznisLa = isModified ? Number((montanFinal * 0.05).toFixed(2)) : Number(d.fee || 0);
        const totalPeye = montanFinal + frePouBiznisLa;

        if (!confirm(`TCHEKE DEPO SA BYEN:\n\n- Kliyan an ap resevwa: ${montanFinal} HTG\n- Frè pou Antrepriz la (Biznis): ${frePouBiznisLa} HTG\n- Total kliyan an te dwe voye sou Moncash la se: ${totalPeye} HTG\n\nÈske w wè ${totalPeye} HTG a sou telefòn ou? Si wi, konfime l.`)) return;
        
        setProcessingId(d.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn nan sistèm nan.");
            
            const nouvoBalans = Number(p.wallet_balance || 0) + montanFinal;
            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            
            await supabase.from('deposits').update({ status: 'approved', amount: montanFinal, fee: frePouBiznisLa, total_to_pay: totalPeye }).eq('id', d.id);
            
            await supabase.from('transactions').insert({ 
                user_id: d.user_id, 
                amount: montanFinal, 
                type: 'DEPOSIT', 
                description: `Depo konfime: +${montanFinal} HTG`, 
                status: 'success' 
            });

            await voyeEmailKliyan(p.email, p.full_name, `Bonjou ${p.full_name}, depo ou a apwouve. Nou ajoute ${montanFinal} HTG sou balans ou.`, "DEPO APWOUVE");
            await voyeTelegram(`<b>DEPO APWOUVE</b>\nKliyan: ${p.full_name}\nMontan Kliyan: ${montanFinal} HTG\nFrè Biznis (Pwofi): ${frePouBiznisLa} HTG`);
            
            alert("SIKSÈ! Depo a apwouve, kòb la al sou kont li, epi frè a byen anrejistre pou Kès Biznis la."); 
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
            
            await supabase.from('transactions').insert({ user_id: w.user_id, amount: -Number(w.amount), type: 'WITHDRAWAL', description: `Retrè konfime: -${w.amount} HTG`, status: 'success' });
            await voyeEmailKliyan(p.email, p.full_name, `Bonjou ${p.full_name}, retrè ${w.amount} HTG ou a fin trete. Lajan an voye sou kont ou.`, "RETRÈ KONFIME");
            await voyeTelegram(`<b>RETRÈ KONFIME</b>\nKliyan: ${p.full_name}\nMontan: ${w.amount} HTG`);
            alert("RETRÈ FINI!"); raleDone();
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
                const balansR = Number(p.wallet_balance || 0) + Number(item.amount) + Number(item.fee || 0); 
                await supabase.from('profiles').update({ wallet_balance: balansR }).eq('id', item.user_id);
            }
            await supabase.from('transactions').insert({ user_id: item.user_id, amount: 0, type: 'REJECTED', description: `Anile: ${rezon}`, status: 'failed' });
            if (p?.email) await voyeEmailKliyan(p.email, p.full_name, `Bonjou ${p?.full_name}, tranzaksyon ${item.amount} HTG ou a anile. Rezon: ${rezon}`, "TRANZAKSYON ANILE");
            await voyeTelegram(`<b>ANILE</b>\nKliyan: ${p?.full_name}\nRezon: ${rezon}`);
            alert("Anile!"); raleDone();
        } finally { setProcessingId(null); }
    };

    const deblokeKont = async (id: string, email: string) => {
        if (!confirm(`Èske w vle aktive kont sa a ankò? (${email})`)) return;
        setProcessingId(id);
        try { await supabase.from('profiles').update({ account_status: 'active', failed_otp_attempts: 0 }).eq('id', id); alert(`Kont ${email} lan aktive!`); raleDone(); } 
        catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const sispannKont = async (id: string, email: string) => {
        if (!confirm(`Èske w sèten ou vle SISPANN kont sa a? (${email})`)) return;
        setProcessingId(id);
        try { await supabase.from('profiles').update({ account_status: 'suspended' }).eq('id', id); alert(`Kont ${email} lan sispandi!`); raleDone(); } 
        catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const jereKyc = async (id: string, full_name: string, email: string, aksyon: 'approved' | 'rejected') => {
        let rezonReje = "";
        if (aksyon === 'rejected') { const rep = prompt("Tanpri ekri rezon ki fè w rejte dokiman sa yo:"); if (!rep) return; rezonReje = rep; } 
        else { if (!confirm(`Èske w sèten ou vle APWOUVE KYC pou ${full_name}?`)) return; }
        setProcessingId(id);
        try {
            await supabase.from('profiles').update({ kyc_status: aksyon, kyc_rejection_reason: aksyon === 'rejected' ? rezonReje : null }).eq('id', id);
            const mesajE = aksyon === 'approved' ? `Felisitasyon ${full_name}! Dokiman w yo apwouve.` : `Bonjou ${full_name}. \n\nMalerezman, nou pa ka aksepte dokiman KYC ou te soumèt yo.\n\nREZON: ${rezonReje}`;
            if (email) await voyeEmailKliyan(email, full_name, mesajE, `VERIFIKASYON ID ${aksyon === 'approved' ? 'APWOUVE' : 'REJTE'}`);
            alert(`KYC a ${aksyon === 'approved' ? 'Apwouve' : 'Rejte'} avèk siksè!`); raleDone();
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const jereAjan = async (applicationId: string, userId: string, fullName: string, userEmail: string, aksyon: 'approved' | 'rejected') => {
        let rezon = "";
        if (aksyon === 'rejected') {
            rezon = agentRejectionReason[applicationId] || "";
            if (!rezon.trim()) return alert("Tanpri ekri yon rezon pou w ka rejte aplikasyon sa a.");
        } else {
            if (!confirm(`Èske w sèten ou vle APWOUVE aplikasyon ajan sa a pou ${fullName}?`)) return;
        }

        setProcessingId(applicationId);
        try {
            if (aksyon === 'rejected') {
                const { data: userProf } = await supabase.from('profiles').select('agent_guarantee_paid, wallet_balance').eq('id', userId).single();
                if (userProf) {
                    const paidAmount = Number(userProf.agent_guarantee_paid || 0);
                    if (paidAmount > 0) {
                        const feePaid = Math.floor((paidAmount / 1000) * 7);
                        const totalRefund = paidAmount + feePaid;
                        const newWalletBalance = Number(userProf.wallet_balance || 0) + totalRefund;
                        
                        await supabase.from('profiles').update({ 
                            wallet_balance: newWalletBalance,
                            agent_balance: 0,
                            agent_capacity: 0,
                            agent_guarantee_paid: 0,
                            agent_status: 'rejected'
                        }).eq('id', userId);

                        await supabase.from('transactions').insert({
                            user_id: userId,
                            type: 'REFUND',
                            amount: totalRefund,
                            status: 'success',
                            description: `Ranbousman Aplikasyon Ajan ki Rejte (+ Frè)`
                        });
                    } else {
                        await supabase.from('profiles').update({ agent_status: 'rejected' }).eq('id', userId);
                    }
                }
            } else {
                await supabase.from('profiles').update({ agent_status: 'approved' }).eq('id', userId);
            }

            await supabase.from('agent_applications').update({ 
                status: aksyon,
                rejection_reason: aksyon === 'rejected' ? rezon : null
            }).eq('id', applicationId);

            const mesajE = aksyon === 'approved' 
                ? `Felisitasyon ${fullName}! Aplikasyon w pou vin Ajan Hatexcard la apwouve. Ou ka vizite pòtay ajan w lan kounye a pou w jwenn kòd inik ou a epi kòmanse travay.` 
                : `Bonjou ${fullName}. \n\nEkip nou an verifye aplikasyon ajan w lan epi nou oblije rejte l pou rezon sa a:\n\n${rezon}\n\n(N.B: Tout garanti ou te depoze yo tounen sou kont prensipal ou otomatikman).\n\nOu ka korije enfòmasyon yo epi soumèt yon nouvo demann.`;
            
            if (userEmail) await voyeEmailKliyan(userEmail, fullName, mesajE, `REZILTA APLIKASYON AJAN ${aksyon === 'approved' ? 'APWOUVE' : 'REJTE'}`);
            
            alert(`Aplikasyon an ${aksyon === 'approved' ? 'Apwouve' : 'Rejte e Ranbouse'} avèk siksè!`); 
            
            if (aksyon === 'rejected') setAgentRejectionReason(prev => ({...prev, [applicationId]: ''}));
            
            raleDone();
        } catch (err: any) { 
            alert("Erè nan pwosesis la: " + err.message); 
        } finally { 
            setProcessingId(null); 
        }
    };

    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('creating_promo');
        const cleanCode = newPromoCode.trim().toUpperCase();
        if (!cleanCode) { alert('Mete yon kòd valab.'); setProcessingId(null); return; }
        try {
            const { error } = await supabase.from('promo_codes').insert([{ code: cleanCode, reward_amount: parseInt(promoReward) }]);
            if (error) { if (error.code === '23505') throw new Error('Kòd sa a egziste deja!'); throw error; }
            alert(`Kòd ${cleanCode} la kreye!`); setNewPromoCode(''); setPromoReward('250'); raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const handleSaveAnons = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving_anons');
        try {
            const { error } = await supabase.from('global_settings').update({ announcement_text: anonsText, announcement_active: anonsActive }).eq('id', 1);
            if (error) throw error;
            alert("Notifikasyon an chanje avèk siksè e li rive sou tout kliyan yo!"); raleDone();
        } catch (err: any) { alert("Erè nan sove notifikasyon an: " + err.message); } finally { setProcessingId(null); }
    };

    const handleManualBalanceAdjust = async (user: any, action: 'add' | 'subtract') => {
        if (!user) return;
        const amtStr = prompt(`Antre montan ou vle ${action === 'add' ? 'AJOUTE sou' : 'RETIRE nan'} kont ${user.full_name} an:`);
        if (!amtStr) return;
        
        const amt = Number(amtStr);
        if (isNaN(amt) || amt <= 0) return alert("Montan an pa bon!");

        if (!confirm(`W ap ${action === 'add' ? 'AJOUTE' : 'RETIRE'} ${amt} HTG ${action === 'add' ? 'sou' : 'nan'} kont ${user.full_name}. Kontinye?`)) return;

        setProcessingId(`adjust_${user.id}`);
        try {
            const { data: dbUser } = await supabase.from('profiles').select('wallet_balance').eq('id', user.id).single();
            const currentBal = Number(dbUser?.wallet_balance || 0);
            const newBal = action === 'add' ? currentBal + amt : currentBal - amt;

            await supabase.from('profiles').update({ wallet_balance: newBal }).eq('id', user.id);
            await supabase.from('transactions').insert([{
                user_id: user.id,
                amount: action === 'add' ? amt : -amt,
                type: 'ADMIN_ADJUSTMENT',
                description: `Ajusteman Admin: ${action === 'add' ? '+' : '-'}${amt} HTG`,
                status: 'success'
            }]);

            alert(`Balans la modifye! Nouvo balans: ${newBal} HTG`);
            raleDone();
        } catch (err: any) {
            alert("Erè nan modifikasyon: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const filteredUsers = allUsers.filter(user => {
        if (!searchQuery) return true;
        const lowerQuery = searchQuery.toLowerCase();
        return user.email?.toLowerCase().includes(lowerQuery) || user.full_name?.toLowerCase().includes(lowerQuery);
    });

    if (!accessGranted) return <div className="bg-slate-50 h-screen" />;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8 font-sans pb-24">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-8 border-b border-gray-200 pb-6 gap-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={28} className="text-indigo-600" />
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pòtay Prensipal Admin</h1>
                    </div>
                    <button onClick={raleDone} className="bg-white border border-gray-200 text-slate-600 hover:text-indigo-600 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm">Rafrechi Done Yo</button>
                </div>

                <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl border border-gray-200 overflow-x-auto custom-scrollbar whitespace-nowrap shadow-sm">
                    <button onClick={() => setView('anons')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'anons' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Anons</button>
                    <button onClick={() => setView('kliyan')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'kliyan' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Kliyan ({allUsers.length})</button>
                    <button onClick={() => setView('depo')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'depo' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Depo ({deposits.filter(d => d.status === 'pending').length})</button>
                    <button onClick={() => setView('retre')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'retre' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Retrè ({withdrawals.filter(w => w.status === 'pending').length})</button>
                    <button onClick={() => setView('kyc')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'kyc' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>KYC ({pendingKyc.length})</button>
                    
                    <button onClick={() => setView('ajan')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all relative ${view === 'ajan' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        Ajan 
                        {pendingAgents.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] animate-pulse">{pendingAgents.length}</span>}
                    </button>
                    
                    <button onClick={() => setView('promo')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'promo' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Pwomo</button>
                    <button onClick={() => setView('sispandi')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'sispandi' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Sispandi</button>
                    
                    <button onClick={handleOpenBiznis} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'biznis' ? 'bg-emerald-600 shadow-sm text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100'}`}>
                        {businessTabPasswordVerified ? <Briefcase size={14}/> : <Lock size={14}/>} 
                        Kès Biznis
                    </button>
                </div>

                <div className="space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                           <Loader2 size={32} className="text-indigo-600 animate-spin" />
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ap Chaje Done Yo...</p>
                        </div>
                    ) : view === 'biznis' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-4 mb-8">
                                <span className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 border border-emerald-100"><Briefcase size={28}/></span>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Kès Jeneral Antrepriz la</h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1"><ShieldCheck size={14} className="text-emerald-500" /> Aksè Sekirize (Sèlman Mèt Biznis la)</p>
                                </div>
                            </div>

                            {loadingBiznis ? (
                                <div className="text-center py-20 flex flex-col items-center justify-center gap-4 bg-white rounded-3xl border border-gray-200">
                                    <Loader2 size={32} className="text-indigo-600 animate-spin" />
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ap Kalkile Tout Tranzaksyon Yo...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-6 opacity-5"><UserX size={80} /></div>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Kòb Kliyan Yo (Lajan Moun Yo)</p>
                                            <h3 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                                                {Number(totalClientBal).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-lg text-slate-500">HTG</span>
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-4 font-medium">Sa se sòm total tout kòb ki sou kont chak grenn kliyan. Ou pa ka touche sa!</p>
                                        </div>

                                        <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-6 opacity-5 text-emerald-600"><DollarSign size={80} /></div>
                                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Pwofi Biznis La (Kòb Antrepriz La)</p>
                                            <h3 className="text-4xl md:text-5xl font-bold text-emerald-700 tracking-tight">
                                                {Number(totalBiznisProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-lg text-emerald-600">HTG</span>
                                            </h3>
                                            <p className="text-xs text-emerald-600/70 mt-4 font-medium">Sa se total tout frè ou fè sou platfòm nan. Se kòb sa a ki pou ou legalman.</p>
                                        </div>
                                    </div>

                                    <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm mt-6">
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 border-b border-gray-100 pb-4">Detay Frè Antrepriz La Fè</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100">
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Frè Kolekte Sou Depo</p>
                                                <p className="text-2xl font-bold text-slate-900">{Number(feesBreakdown.depo).toLocaleString()} <span className="text-sm text-slate-500">HTG</span></p>
                                            </div>
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100">
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Frè Kolekte Sou Retrè</p>
                                                <p className="text-2xl font-bold text-slate-900">{Number(feesBreakdown.retre).toLocaleString()} <span className="text-sm text-slate-500">HTG</span></p>
                                            </div>
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100">
                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Frè Kolekte Sou Transfè</p>
                                                <p className="text-2xl font-bold text-slate-900">{Number(feesBreakdown.transfe).toLocaleString()} <span className="text-sm text-slate-500">HTG</span></p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-600 p-8 rounded-3xl shadow-sm mt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div>
                                            <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider mb-2">Gran Total Sou Sistèm Nan</p>
                                            <p className="text-sm text-white font-medium">Kòb Kliyan + Kòb Biznis (Sa se total jeneral ki sipoze sou kès bank ou toutbon an)</p>
                                        </div>
                                        <p className="text-3xl font-bold text-white tracking-tight">
                                            {Number(totalClientBal + totalBiznisProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })} HTG
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : view === 'kliyan' ? (
                        <div className="space-y-6">
                            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
                                <Search size={20} className="text-slate-400 ml-2" />
                                <input type="text" placeholder="Chèche yon kliyan ak imèl li oswa non l..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none p-2 text-slate-900 outline-none font-bold placeholder:text-slate-400 text-sm" />
                                {searchQuery && <button onClick={() => setSearchQuery('')} className="bg-slate-100 text-slate-500 hover:text-slate-900 p-2.5 rounded-xl text-xs font-bold transition-all">EFASE</button>}
                            </div>
                            <div className="space-y-4">
                                {filteredUsers.length === 0 ? (
                                    <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-200 text-slate-500 text-sm font-bold uppercase tracking-wider">Pa jwenn okenn kliyan ak non oswa imèl sa a</div>
                                ) : (
                                    filteredUsers.map(user => (
                                        <div key={user.id} className={`bg-white p-6 rounded-3xl border ${user.account_status === 'suspended' ? 'border-rose-200 bg-rose-50/30' : 'border-gray-200'} relative flex flex-col md:flex-row gap-6 items-center justify-between transition-all shadow-sm`}>
                                            <div className="flex items-center gap-5 w-full md:w-auto">
                                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl shrink-0 ${user.account_status === 'suspended' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                    {user.full_name ? user.full_name.charAt(0).toUpperCase() : <UserX size={24} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-base font-bold text-slate-900 truncate w-full">{user.full_name || 'San Non'}</h3>
                                                    <p className="text-xs text-slate-500 truncate w-full mt-0.5">{user.email}</p>
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-bold tracking-wider">BALANS: <span className="text-slate-900">{Number(user.wallet_balance || 0).toLocaleString()} HTG</span></span>
                                                        <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold tracking-wider uppercase ${user.kyc_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>KYC: {user.kyc_status}</span>
                                                        {user.is_card_activated && <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-bold tracking-wider uppercase">KAT AKTIVE</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                                {user.account_status === 'suspended' ? (
                                                    <button onClick={() => deblokeKont(user.id, user.email)} disabled={processingId === user.id} className="w-full md:w-auto bg-emerald-600 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white hover:bg-emerald-700 transition-all shadow-sm">AKTIVE KONT</button>
                                                ) : (
                                                    <button onClick={() => sispannKont(user.id, user.email)} disabled={processingId === user.id} className="w-full md:w-auto bg-white border border-rose-200 text-rose-600 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all shadow-sm">SISPANN KONT</button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : view === 'anons' ? (
                        <div className="bg-white p-8 rounded-3xl border border-gray-200 mb-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Send size={24} /></span>
                                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Jere Notifikasyon Global</h2>
                            </div>
                            <form onSubmit={handleSaveAnons} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Tèks k ap parèt sou paj kliyan yo:</label>
                                    <textarea value={anonsText} onChange={(e) => setAnonsText(e.target.value)} placeholder="Ekri mesaj ou vle tout kliyan wè a la a..." className="w-full bg-slate-50 border border-gray-200 p-5 rounded-2xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium text-sm min-h-[150px] text-slate-900 placeholder:text-slate-400 resize-none" required />
                                </div>
                                <div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-gray-200 cursor-pointer hover:border-indigo-300 transition-colors" onClick={() => setAnonsActive(!anonsActive)}>
                                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 border ${anonsActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-300'}`}>
                                       {anonsActive && <CheckCircle2 size={16} />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-900">Afiche notifikasyon an?</span>
                                        <span className="text-xs text-slate-500 font-medium mt-0.5">Si bwat sa pa make, notifikasyon an pap parèt pou kliyan yo.</span>
                                    </div>
                                </div>
                                <button type="submit" disabled={processingId === 'saving_anons'} className="w-full bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-white shadow-sm flex items-center justify-center gap-2">
                                    {processingId === 'saving_anons' ? <Loader2 size={18} className="animate-spin" /> : "Sove Notifikasyon an"}
                                </button>
                            </form>
                        </div>
                    ) : view === 'kyc' ? (
                        pendingKyc.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300 text-slate-500 text-sm font-bold uppercase tracking-wider">Pa gen okenn KYC k ap tann</div>
                        ) : (
                            <div className="space-y-4">
                                {pendingKyc.map((user) => (
                                    <div key={user.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-6 items-center transition-all hover:shadow-md">
                                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 shrink-0"><UserX size={32} /></div>
                                        <div className="flex-1 text-center md:text-left w-full">
                                            <h3 className="text-lg font-bold text-slate-900">{user.full_name || 'San Non'}</h3>
                                            <p className="text-xs text-slate-500 mt-1 mb-4">{user.email}</p>
                                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                                {user.kyc_front && <button onClick={() => handleOpenMaskedUrl(user.kyc_front)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Fasad Devan</button>}
                                                {user.kyc_back && <button onClick={() => handleOpenMaskedUrl(user.kyc_back)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Fasad Dèyè</button>}
                                                {user.kyc_selfie && <button onClick={() => handleOpenMaskedUrl(user.kyc_selfie)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Selfie</button>}
                                                {!user.kyc_front && !user.kyc_selfie && <span className="text-[10px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 font-bold uppercase tracking-wider">Okenn imaj sou sistèm nan</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-2 md:mt-0 shrink-0">
                                            <button onClick={() => jereKyc(user.id, user.full_name, user.email, 'approved')} disabled={processingId === user.id} className="bg-emerald-600 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2">
                                                {processingId === user.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Apwouve</>}
                                            </button>
                                            <button onClick={() => jereKyc(user.id, user.full_name, user.email, 'rejected')} disabled={processingId === user.id} className="bg-white border border-rose-200 text-rose-600 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center gap-2">
                                                <XCircle size={16} /> Rejte
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : view === 'ajan' ? (
                        pendingAgents.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300 text-slate-500 text-sm font-bold uppercase tracking-wider">
                                <Store size={48} className="mx-auto mb-4 text-slate-300" />
                                Pa gen okenn aplikasyon Ajan k ap tann
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {pendingAgents.map((agent) => (
                                    <div key={agent.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col gap-6 transition-all hover:shadow-md">
                                        
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100"><Store size={24} /></div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">{agent.profiles?.full_name || 'San Non'}</h3>
                                                    <p className="text-xs text-slate-500 mt-1">{agent.profiles?.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-indigo-100 mb-2">Plan: {agent.tier}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Depo + Frè (Wete sou Wallet): {Number((agent.metadata?.initial_deposit || 0) + (agent.metadata?.fee_paid || 0)).toLocaleString()} HTG</span>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Dokiman Soumèt</p>
                                            <div className="flex flex-wrap gap-3">
                                                {agent.id_doc_url && <button onClick={() => handleOpenMaskedUrl(agent.id_doc_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Pyès Idantite</button>}
                                                {agent.address_doc_url && <button onClick={() => handleOpenMaskedUrl(agent.address_doc_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Prèv Adrès</button>}
                                                {agent.location_photo_url && <button onClick={() => handleOpenMaskedUrl(agent.location_photo_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Foto Lokal</button>}
                                                {agent.patente_url && <button onClick={() => handleOpenMaskedUrl(agent.patente_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Patant</button>}
                                                {agent.cif_url && <button onClick={() => handleOpenMaskedUrl(agent.cif_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> CIF</button>}
                                            </div>
                                        </div>

                                        <div className="mt-2 flex flex-col md:flex-row gap-4 items-start md:items-end border-t border-gray-100 pt-6">
                                            <div className="w-full md:flex-1">
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Si w ap rejte l, ekri rezon an la:</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Egz: Foto lokal la pa klè..." 
                                                    value={agentRejectionReason[agent.id] || ''}
                                                    onChange={(e) => setAgentRejectionReason({...agentRejectionReason, [agent.id]: e.target.value})}
                                                    className="w-full bg-slate-50 border border-gray-200 py-3 px-4 rounded-xl text-sm outline-none focus:border-rose-500 transition-colors"
                                                />
                                            </div>
                                            <div className="flex gap-3 w-full md:w-auto shrink-0">
                                                <button onClick={() => jereAjan(agent.id, agent.user_id, agent.profiles?.full_name, agent.profiles?.email, 'rejected')} disabled={processingId === agent.id} className="flex-1 md:flex-none bg-white border border-rose-200 text-rose-600 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center gap-2">
                                                    <XCircle size={16} /> Rejte (Ranbouse l)
                                                </button>
                                                <button onClick={() => jereAjan(agent.id, agent.user_id, agent.profiles?.full_name, agent.profiles?.email, 'approved')} disabled={processingId === agent.id} className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2">
                                                    {processingId === agent.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Apwouve</>}
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )
                    ) : view === 'promo' ? (
                        <div>
                            <form onSubmit={handleCreateCode} className="bg-white p-8 rounded-3xl border border-gray-200 mb-8 flex flex-col md:flex-row gap-4 items-end shadow-sm">
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Nouvo Kòd (Ex: IZO2026)</label>
                                    <input type="text" value={newPromoCode} onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())} placeholder="NON ATIS LA" className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold text-sm uppercase text-slate-900" required />
                                </div>
                                <div className="w-full md:w-48 space-y-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Rediksyon (HTG)</label>
                                    <input type="number" value={promoReward} onChange={(e) => setPromoReward(e.target.value)} className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-bold text-sm text-slate-900" required min="0" />
                                </div>
                                <button type="submit" disabled={processingId === 'creating_promo'} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold uppercase tracking-wider active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2">
                                    {processingId === 'creating_promo' ? <Loader2 size={18} className="animate-spin" /> : "Kreye Kòd La"}
                                </button>
                            </form>
                            <div className="overflow-x-auto bg-white rounded-3xl border border-gray-200 shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-slate-50">
                                            <th className="p-5 text-xs font-bold uppercase text-slate-500 tracking-wider">Kòd Pwomo</th>
                                            <th className="p-5 text-xs font-bold uppercase text-slate-500 tracking-wider text-center">Rediksyon (HTG)</th>
                                            <th className="p-5 text-xs font-bold uppercase text-slate-500 tracking-wider text-center">Moun Mennen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {promoCodes.length === 0 ? (
                                            <tr><td colSpan={3} className="p-10 text-center text-sm font-bold uppercase text-slate-400 tracking-wider">Pa gen kòd kreye ankò.</td></tr>
                                        ) : (
                                            promoCodes.map((promo) => (
                                                <tr key={promo.code} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                                                    <td className="p-5 font-bold text-indigo-600">{promo.code}</td>
                                                    <td className="p-5 text-center font-bold text-slate-900">{promo.reward_amount} HTG</td>
                                                    <td className="p-5 text-center"><span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-bold text-xs border border-emerald-100">{promo.usage_count}</span></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : view === 'sispandi' ? (
                        <div className="space-y-4">
                            {suspendedAccounts.length === 0 ? (
                                <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300 text-slate-500 text-sm font-bold uppercase tracking-wider">Pa gen okenn kont ki sispandi</div>
                            ) : (
                                suspendedAccounts.map((account) => (
                                    <div key={account.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-rose-200 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                                        <div className="flex items-center gap-5 w-full md:w-auto">
                                            <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center border border-rose-200 shrink-0"><AlertTriangle size={24} /></div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-base font-bold text-slate-900 truncate w-full">{account.full_name || 'San Non'}</h3>
                                                <p className="text-xs text-slate-500 truncate w-full mt-0.5">{account.email}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => deblokeKont(account.id, account.email)} disabled={processingId === account.id} className="w-full md:w-auto bg-emerald-600 text-white px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:bg-emerald-700 shadow-sm flex items-center justify-center gap-2">
                                            {processingId === account.id ? <Loader2 size={16} className="animate-spin" /> : "Aktive Kont Sa a"}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {(view === 'depo' ? deposits : withdrawals).map((item) => {
                                const isDepo = view === 'depo';
                                const aficheMontan = isDepo && montanModifye[item.id] !== undefined ? montanModifye[item.id] : item.amount;
                                
                                return (
                                    <div key={item.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 relative overflow-hidden shadow-sm hover:shadow-md transition-all">
                                        {item.status !== 'pending' && <button onClick={() => deleteTranzaksyon(item.id, isDepo ? 'deposits' : 'withdrawals')} className="absolute top-6 right-6 text-rose-600 text-[10px] font-bold uppercase tracking-wider bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg hover:bg-rose-600 hover:text-white transition-colors">EFASE</button>}
                                        
                                        <div className="flex justify-between mb-6 pr-16 border-b border-gray-100 pb-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kliyan: {item.user_id?.slice(0,8)}...</span>
                                                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded w-fit border border-indigo-100">Metòd: {item.method}</span>
                                            </div>
                                            <span className={`text-[10px] h-fit px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider border ${item.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : item.status === 'approved' || item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        
                                        <div className="mb-6">
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">MONTAN {isDepo ? 'KLIYAN AN DECLARE (SAN FRÈ)' : 'KLIYAN MANDE A'}:</p>
                                            <div className="flex items-center justify-between">
                                                <p className="text-4xl font-bold tracking-tight text-slate-900">{aficheMontan} <span className="text-sm text-slate-500">HTG</span></p>
                                                {isDepo && item.status === 'pending' && <button onClick={() => { const nouvoVal = prompt("Antre nouvo montan san frè a:", item.amount); if (nouvoVal && !isNaN(Number(nouvoVal))) setMontanModifye(prev => ({ ...prev, [item.id]: Number(nouvoVal) })); }} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-colors">MODIFYE</button>}
                                            </div>

                                            {isDepo && item.fee !== undefined && (
                                                <div className="mt-6 space-y-2">
                                                    <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Frè Biznis La (5%):</span>
                                                        <span className="text-xs text-emerald-700 font-bold">+{montanModifye[item.id] ? (montanModifye[item.id] * 0.05).toFixed(2) : item.fee} HTG</span>
                                                    </div>
                                                    <div className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                                        <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">Total Kliyan te dwe voye a:</span>
                                                        <span className="text-sm text-indigo-700 font-bold">{montanModifye[item.id] ? (montanModifye[item.id] * 1.05).toFixed(2) : item.total_to_pay || (Number(item.amount) + Number(item.fee))} HTG</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {item.status === 'pending' && (
                                            <div className="space-y-4 pt-6 border-t border-gray-100">
                                                <div className="flex gap-3">
                                                    <button disabled={processingId === item.id} onClick={() => isDepo ? apwouveDepo(item) : apwouveRetre(item)} className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2">
                                                        <CheckCircle2 size={16} /> Konfime Apwouve
                                                    </button>
                                                    <button disabled={processingId === item.id} onClick={() => anileTranzaksyon(item, isDepo ? 'deposits' : 'withdrawals')} className="bg-white text-rose-600 border border-rose-200 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center gap-2">
                                                        <XCircle size={16} /> Anile
                                                    </button>
                                                </div>
                                                {isDepo && item.proof_img_1 && (<button onClick={() => handleOpenMaskedUrl(item.proof_img_1)} className="w-full bg-slate-50 text-slate-700 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-gray-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><EyeOff size={14}/> Gade Foto Prèv 1</button>)}
                                                {isDepo && item.proof_img_2 && (<button onClick={() => handleOpenMaskedUrl(item.proof_img_2)} className="w-full bg-slate-50 text-slate-700 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-gray-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><EyeOff size={14}/> Gade Foto Prèv 2</button>)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {!loading && (view === 'depo' ? deposits : withdrawals).length === 0 && <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300 text-slate-500 text-sm font-bold uppercase tracking-wider">Pa gen okenn {view} pou kounye a</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}