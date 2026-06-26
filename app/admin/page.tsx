"use client";
import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Send, UserX, ShieldCheck, AlertTriangle, Search, ArrowRightLeft, Store, Plus, Minus, Lock, Briefcase, DollarSign, EyeOff } from 'lucide-react';

export default function AdminSuperPage() {
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [promoCodes, setPromoCodes] = useState<any[]>([]);
    const [disputes, setDisputes] = useState<any[]>([]); 
    const [totalCardBal, setTotalCardBal] = useState(0);
     
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

    const [view, setView] = useState<'anons' | 'kliyan' | 'depo' | 'retre' | 'sispandi' | 'kyc' | 'promo' | 'litij' | 'biznis'>('litij'); 
    
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [accessGranted, setAccessGranted] = useState(false);
    const [montanModifye, setMontanModifye] = useState<{ [key: string]: number }>({});

    // ==========================================
    // ETA POU KONT BIZNIS LA (NOUVO METÒD SENP LAN)
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

    const handleOpenMaskedUrl = (url: string) => {
        if (!url) return;
        const newWindow = window.open('about:blank', '_blank');
        if (newWindow) {
            newWindow.document.write(`
                <html style="background:#0a0b14; display:flex; justify-content:center; align-items:center; margin:0;">
                    <head><title>Dokiman Sekirize - HatexCard</title></head>
                    <body>
                        <img src="${url}" style="max-width:100%; max-height:100vh; border-radius: 10px; box-shadow: 0 0 20px rgba(0,0,0,0.5);"/>
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

        const pass = prompt("🔒 ANTRE MODPAS SEKRÈ FINANSYE A:");
        if (!pass) return;

        try {
            const { data: settings } = await supabase.from('global_settings').select('finance_password').eq('id', 1).maybeSingle();
            const validPass = settings?.finance_password || '@fiokes1234';

            if (pass === validPass) {
                setBusinessTabPasswordVerified(true);
                setView('biznis');
                kalkileTotalBiznis();
            } else {
                alert("❌ Modpas la pa bon! Ou pa gen aksè ak kès biznis la.");
            }
        } catch (e) {
            alert("Erè nan sistèm sekirite a.");
        }
    };

// ==========================================
    // METÒD SENPLIFYE POU KALKILE FRÈ SOU TAB YO DIREK
    // ==========================================
    const kalkileTotalBiznis = async () => {
        setLoadingBiznis(true);
        try {
            // 1. Total Kòb sou tout Balans Kliyan yo (Wallet + Kat Vityèl)
            const { data: profiles } = await supabase.from('profiles').select('wallet_balance, card_balance');
            
            // Kalkile total pou Wallet yo
            const totalKliyan = (profiles || []).reduce((acc, u) => acc + Number(u.wallet_balance || 0), 0);
            setTotalClientBal(totalKliyan);

            // NOUVO: Kalkile total pou Kat Vityèl yo
            const totalKat = (profiles || []).reduce((acc, u) => acc + Number(u.card_balance || 0), 0);
            setTotalCardBal(totalKat); // 👈 Asire w ou gen state sa a ki kreye anwo nan kòd la

            // 2. Chèche Frè sou tout Depo ki reyisi yo
            const { data: depData, error: errDep } = await supabase.from('deposits').select('fee').eq('status', 'approved');
            const totalDepoFee = errDep ? 0 : (depData || []).reduce((acc, d) => acc + Number(d.fee || 0), 0);

            // 3. Chèche Frè sou tout Retrè ki reyisi yo
            const { data: witData, error: errWit } = await supabase.from('withdrawals').select('fee').eq('status', 'completed');
            const totalRetreFee = errWit ? 0 : (witData || []).reduce((acc, w) => acc + Number(w.fee || 0), 0);

            // 4. Chèche Frè sou tout Transfè ki reyisi yo
            const { data: traData, error: errTra } = await supabase.from('transfers').select('fee, status');
            const totalTransfeFee = errTra ? 0 : (traData || [])
                .filter(t => !t.status || t.status === 'success' || t.status === 'completed')
                .reduce((acc, t) => acc + Number(t.fee || 0), 0);

            // Nou mete tout done yo nan state yo
            setFeesBreakdown({ depo: totalDepoFee, retre: totalRetreFee, transfe: totalTransfeFee });
            
            // Grand Total Pwofi a
            const granTotalPwofi = totalDepoFee + totalRetreFee + totalTransfeFee;
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
        if (!confirm("Èske ou vle efase istovik sa a nèt?")) return;
        setProcessingId(id);
        try {
            await supabase.from(table).delete().eq('id', id);
            alert("🗑️ Efase nèt!"); raleDone();
        } finally { setProcessingId(null); }
    };

    const apwouveDepo = async (d: any) => {
        const isModified = montanModifye[d.id] !== undefined;
        const montanFinal = isModified ? montanModifye[d.id] : Number(d.amount);
        
        // Kalkil frè a: 5% si l modifye, sinon nou pran frè ki sou baz done a
        const frePouBiznisLa = isModified ? Number((montanFinal * 0.05).toFixed(2)) : Number(d.fee || 0);
        const totalPeye = montanFinal + frePouBiznisLa;

        if (!confirm(`TCHEKE DEPO SA BYEN:\n\n- Kliyan an ap resevwa: ${montanFinal} HTG\n- Frè pou Antrepriz la (Biznis): ${frePouBiznisLa} HTG\n- Total kliyan an te dwe voye sou Moncash la se: ${totalPeye} HTG\n\nÈske w wè ${totalPeye} HTG a sou telefòn ou? Si wi, konfime l.`)) return;
        
        setProcessingId(d.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', d.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn nan sistèm nan.");
            
            // 1. Mete montanFinal la sou balans kliyan an
            const nouvoBalans = Number(p.wallet_balance || 0) + montanFinal;
            await supabase.from('profiles').update({ wallet_balance: nouvoBalans }).eq('id', d.user_id);
            
            // 2. Aktyalize estati Depo a ak vrè frè a, konsa Kès Biznis la ap tou jwenn li nan kalkil "kalkileTotalBiznis" lan.
            await supabase.from('deposits').update({ status: 'approved', amount: montanFinal, fee: frePouBiznisLa, total_to_pay: totalPeye }).eq('id', d.id);
            
            // 3. Resi pou kliyan an nan istwa l
            await supabase.from('transactions').insert({ 
                user_id: d.user_id, 
                amount: montanFinal, 
                type: 'DEPOSIT', 
                description: `Depo konfime: +${montanFinal} HTG`, 
                status: 'success' 
            });

            await voyeEmailKliyan(p.email, p.full_name, `Bonjou ${p.full_name}, depo ou a apwouve. Nou ajoute ${montanFinal} HTG sou balans ou.`, "✅ DEPO APWOUVE");
            await voyeTelegram(`✅ <b>DEPO APWOUVE</b>\nKliyan: ${p.full_name}\nMontan Kliyan: ${montanFinal} HTG\nFrè Biznis (Pwofi): ${frePouBiznisLa} HTG`);
            
            alert("✅ SIKSÈ! Depo a apwouve, kòb la al sou kont li, epi frè a byen anrejistre pou Kès Biznis la."); 
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const apwouveRetre = async (w: any) => {
        if (!confirm(`Konfime retrè ${w.amount} HTG sa a?`)) return;
        setProcessingId(w.id);
        try {
            const { data: p, error: pErr } = await supabase.from('profiles').select('*').eq('id', w.user_id).single();
            if (pErr || !p) throw new Error("Kliyan pa jwenn.");
            
            // Isit la asire w w update fee a tou si w te bezwen nan retrè a
            await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
            
            await supabase.from('transactions').insert({ user_id: w.user_id, amount: -Number(w.amount), type: 'WITHDRAWAL', description: `Retrè konfime: -${w.amount} HTG`, status: 'success' });
            await voyeEmailKliyan(p.email, p.full_name, `Bonjou ${p.full_name}, retrè ${w.amount} HTG ou a fin trete. Lajan an voye sou kont ou.`, "💸 RETRÈ KONFIME");
            await voyeTelegram(`💸 <b>RETRÈ KONFIME</b>\nKliyan: ${p.full_name}\nMontan: ${w.amount} HTG`);
            alert("✅ RETRÈ FINI!"); raleDone();
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
                const balansR = Number(p.wallet_balance || 0) + Number(item.amount) + Number(item.fee || 0); // Ranbouse ak tout frè a si l te peye l deja
                await supabase.from('profiles').update({ wallet_balance: balansR }).eq('id', item.user_id);
            }
            await supabase.from('transactions').insert({ user_id: item.user_id, amount: 0, type: 'REJECTED', description: `Anile: ${rezon}`, status: 'failed' });
            if (p?.email) await voyeEmailKliyan(p.email, p.full_name, `Bonjou ${p?.full_name}, tranzaksyon ${item.amount} HTG ou a anile. Rezon: ${rezon}`, "❌ TRANZAKSYON ANILE");
            await voyeTelegram(`❌ <b>ANILE</b>\nKliyan: ${p?.full_name}\nRezon: ${rezon}`);
            alert("⚠️ Anile!"); raleDone();
        } finally { setProcessingId(null); }
    };

    const deblokeKont = async (id: string, email: string) => {
        if (!confirm(`Èske w vle aktive kont sa a ankò? (${email})`)) return;
        setProcessingId(id);
        try { await supabase.from('profiles').update({ account_status: 'active', failed_otp_attempts: 0 }).eq('id', id); alert(`✅ Kont ${email} lan aktive!`); raleDone(); } 
        catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const sispannKont = async (id: string, email: string) => {
        if (!confirm(`⚠️ Èske w sèten ou vle SISPANN kont sa a? (${email})`)) return;
        setProcessingId(id);
        try { await supabase.from('profiles').update({ account_status: 'suspended' }).eq('id', id); alert(`🚫 Kont ${email} lan sispandi!`); raleDone(); } 
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
            if (email) await voyeEmailKliyan(email, full_name, mesajE, `VERIFIKASYON ID ${aksyon === 'approved' ? 'APWOUVE ✅' : 'REJTE ❌'}`);
            alert(`KYC a ${aksyon === 'approved' ? 'Apwouve' : 'Rejte'} avèk siksè!`); raleDone();
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('creating_promo');
        const cleanCode = newPromoCode.trim().toUpperCase();
        if (!cleanCode) { alert('Mete yon kòd valab.'); setProcessingId(null); return; }
        try {
            const { error } = await supabase.from('promo_codes').insert([{ code: cleanCode, reward_amount: parseInt(promoReward) }]);
            if (error) { if (error.code === '23505') throw new Error('Kòd sa a egziste deja!'); throw error; }
            alert(`✅ Kòd ${cleanCode} la kreye!`); setNewPromoCode(''); setPromoReward('250'); raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const handleSaveAnons = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving_anons');
        try {
            const { error } = await supabase.from('global_settings').update({ announcement_text: anonsText, announcement_active: anonsActive }).eq('id', 1);
            if (error) throw error;
            alert("✅ Notifikasyon an chanje avèk siksè e li rive sou tout kliyan yo!"); raleDone();
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

            alert(`✅ Balans la modifye! Nouvo balans: ${newBal} HTG`);
            
            if (searchedDispute) {
                const updatedDispute = { ...searchedDispute };
                if (updatedDispute.senderProfile?.id === user.id) {
                    updatedDispute.senderProfile.wallet_balance = newBal;
                }
                if (updatedDispute.receiverProfile?.id === user.id) {
                    updatedDispute.receiverProfile.wallet_balance = newBal;
                }
                setSearchedDispute(updatedDispute);
            }
            raleDone();
        } catch (err: any) {
            alert("Erè nan modifikasyon: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

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
                    tx = { ...normTx, table_source: 'transactions', dispute_details: normTx.metadata?.dispute_details || {}, dispute_reason: normTx.description };
                }
            }

            if (!tx) return alert("Sistèm nan pa jwenn okenn kòmand avèk ID sa a ditou. Tcheke si ID a bon.");

            let senderId = null;
            let receiverId = null;

            if (tx.table_source === 'plugin_transactions') {
                receiverId = tx.user_id; 
                senderId = tx.dispute_details?.client_id || tx.metadata?.customer_id;
            } else {
                senderId = tx.user_id;
                receiverId = tx.metadata?.receiver_id || tx.metadata?.merchant_id;
            }

            let senderProfile = null;
            if (senderId) {
                const { data: s } = await supabase.from('profiles').select('*').eq('id', senderId).maybeSingle();
                senderProfile = s || allUsers.find(u => u.id === senderId);
            }

            let receiverProfile = null;
            let receiverEmail = tx.metadata?.merchant_email || tx.metadata?.receiver_email || tx.customer_info?.email;

            if (receiverId) {
                const { data: r } = await supabase.from('profiles').select('*').eq('id', receiverId).maybeSingle();
                receiverProfile = r || allUsers.find(u => u.id === receiverId);
            } else if (receiverEmail) {
                const { data: r } = await supabase.from('profiles').select('*').eq('email', receiverEmail).maybeSingle();
                receiverProfile = r || allUsers.find(u => u.email === receiverEmail);
            }

            tx.senderProfile = senderProfile;
            tx.receiverProfile = receiverProfile;

            setActionAmount(Number(tx.amount_htg || Math.abs(tx.amount) || 0));
            setSearchedDispute(tx);
            
        } catch (err: any) {
            alert("Erè: " + err.message);
        } finally {
            setIsSearchingDispute(false);
        }
    };

    const balanseLajanKont = async (fromUser: any, toUser: any, tipChanjman: string) => {
        if (!fromUser && !toUser) return alert("Sistèm nan pa jwenn okenn pwofil ditou! Nou pa ka fè tranzaksyon an.");
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
                    
                    <button onClick={handleOpenBiznis} className={`px-5 py-4 rounded-xl text-[10px] font-black transition-all flex items-center gap-2 ${view === 'biznis' ? 'bg-emerald-600 shadow-lg shadow-emerald-600/20 text-white' : 'bg-emerald-900/30 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white'}`}>
                        {businessTabPasswordVerified ? <Briefcase size={14}/> : <Lock size={14}/>} 
                        KONT BIZNIS
                    </button>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        <div className="text-center py-20 animate-pulse text-zinc-500 text-xs">L-AP CHACHE DONE YO...</div>
                    ) : view === 'biznis' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="p-3 bg-emerald-500/20 rounded-xl text-emerald-500"><Briefcase size={24}/></span>
                                <div>
                                    <h2 className="text-2xl font-black uppercase text-white tracking-widest">Kès Jeneral Antrepriz la</h2>
                                    <p className="text-[10px] text-zinc-400 font-bold tracking-widest flex items-center gap-1"><ShieldCheck size={12}/> Aksè Sekirize (Sèlman Mèt Biznis la)</p>
                                </div>
                            </div>

                            {loadingBiznis ? (
                                <div className="text-center py-20 animate-pulse text-zinc-500 text-xs flex flex-col items-center justify-center gap-4">
                                    <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                    L-AP KALKILE TOUT TRANZAKSYON YO...
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-[#121420] p-6 rounded-[2rem] border border-blue-500/30 relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 flex items-center gap-2"><UserX size={14}/> Total Kòb Kliyan Yo (Lajan Moun Yo)</p>
                                            <h3 className="text-4xl md:text-5xl font-black italic text-white tracking-tighter">
                                                {Number(totalClientBal).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-lg text-blue-500">HTG</span>
                                            </h3>
                                            <p className="text-[9px] text-zinc-500 mt-4 normal-case font-bold">Sa se sòm total tout kòb ki sou kont chak grenn kliyan. Ou pa ka touche sa!</p>
                                        </div>

                                        <div className="bg-emerald-900/20 p-6 rounded-[2rem] border-2 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2"><DollarSign size={14}/> Pwofi Biznis La (Kòb Antrepriz La)</p>
                                            <h3 className="text-4xl md:text-5xl font-black italic text-emerald-400 tracking-tighter">
                                                {Number(totalBiznisProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-lg text-emerald-600">HTG</span>
                                            </h3>
                                            <p className="text-[9px] text-zinc-400 mt-4 normal-case font-bold">Sa se total tout frè ou fè sou platfòm nan. Se kòb sa a ki pou ou legalman.</p>
                                        </div>
                                    </div>

                                    <div className="bg-[#121420] p-6 rounded-[2rem] border border-white/5 mt-6">
                                        <h3 className="text-[12px] font-black text-zinc-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-4">Detay Frè Antrepriz La Fè</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div className="bg-black p-5 rounded-2xl border border-white/5 flex flex-col justify-center">
                                                <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Frè Kolekte Sou Depo</p>
                                                <p className="text-xl font-black text-white">{Number(feesBreakdown.depo).toLocaleString()} HTG</p>
                                            </div>
                                            <div className="bg-black p-5 rounded-2xl border border-white/5 flex flex-col justify-center">
                                                <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Frè Kolekte Sou Retrè</p>
                                                <p className="text-xl font-black text-white">{Number(feesBreakdown.retre).toLocaleString()} HTG</p>
                                            </div>
                                            <div className="bg-black p-5 rounded-2xl border border-white/5 flex flex-col justify-center">
                                                <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Frè Kolekte Sou Transfè</p>
                                                <p className="text-xl font-black text-white">{Number(feesBreakdown.transfe).toLocaleString()} HTG</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-blue-900/20 p-6 rounded-[2rem] border border-blue-500/30 mt-6 flex justify-between items-center">
                                        <div>
                                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Gran Total Sou Sistèm Nan</p>
                                            <p className="text-[9px] text-zinc-400 normal-case font-bold">Kòb Kliyan + Kòb Biznis (Sa se total jeneral ki sipoze sou kès bank ou toutbon an)</p>
                                        </div>
                                        <p className="text-2xl font-black text-white italic">
                                            {Number(totalClientBal + totalBiznisProfit).toLocaleString('en-US', { minimumFractionDigits: 2 })} HTG
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
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
                                const sender = searchedDispute.senderProfile;
                                const receiver = searchedDispute.receiverProfile;

                                return (
                                    <div className="mb-10 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="absolute -top-3 left-6 bg-yellow-500 text-black px-3 py-1 rounded-md text-[9px] font-black uppercase z-10 flex items-center gap-1">
                                            <AlertTriangle size={12}/> JERE TRANZAKSYON #{searchedDispute.order_id || searchedDispute.id.substring(0,8)}
                                        </div>
                                        <div className="bg-[#121420] rounded-[2.5rem] border-2 border-yellow-500 overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.15)] p-6 pt-10 relative">
                                            <button onClick={() => setSearchedDispute(null)} className="absolute top-4 right-4 bg-zinc-800 text-white w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500 transition-colors z-10">✕</button>

                                            <div className="flex flex-col lg:flex-row items-stretch justify-between gap-4 mb-8 bg-zinc-900/50 p-6 rounded-3xl border border-yellow-500/30 shadow-inner">
                                                <div className="flex-1 w-full bg-black border border-white/5 p-5 rounded-2xl relative flex flex-col justify-between">
                                                    <span className="absolute -top-3 left-4 bg-zinc-800 text-zinc-300 text-[8px] px-2 py-1 rounded font-black tracking-widest border border-white/10 shadow-lg">MOUN KI PEYE (KLIYAN)</span>
                                                    {sender ? (
                                                        <>
                                                            <div className="flex items-center gap-4 mt-2 mb-4">
                                                                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-xl border border-white/10 shrink-0">👤</div>
                                                                <div className="overflow-hidden">
                                                                    <p className="text-sm font-black truncate text-white">{sender.full_name}</p>
                                                                    <p className="text-[10px] text-zinc-500 lowercase truncate">{sender.email}</p>
                                                                    <p className="text-xs font-black text-green-400 mt-1 flex items-center gap-1">
                                                                        <span>Balans:</span> 
                                                                        <span className="bg-green-900/30 px-2 py-0.5 rounded text-green-400">{Number(sender.wallet_balance).toLocaleString()} HTG</span>
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 mt-auto pt-4 border-t border-white/5">
                                                                <button onClick={() => handleManualBalanceAdjust(sender, 'add')} className="flex-1 flex items-center justify-center gap-1 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white py-2.5 rounded-xl text-[9px] font-black transition-all border border-green-600/20 hover:border-green-600"><Plus size={12}/> AJOUTE</button>
                                                                <button onClick={() => handleManualBalanceAdjust(sender, 'subtract')} className="flex-1 flex items-center justify-center gap-1 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white py-2.5 rounded-xl text-[9px] font-black transition-all border border-red-600/20 hover:border-red-600"><Minus size={12}/> RETIRE</button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <p className="text-[10px] text-red-500 italic mt-4 font-black tracking-widest text-center flex items-center justify-center gap-1"><AlertTriangle size={12}/> Kliyan an pa jwenn sou sistèm nan.</p>
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-center justify-center gap-3 shrink-0 w-full lg:w-48 my-4 lg:my-0">
                                                    <div className="flex flex-col items-center bg-black p-4 rounded-2xl border border-white/5 w-full shadow-lg">
                                                        <label className="text-[8px] text-zinc-500 uppercase tracking-widest mb-2">Montan an (HTG)</label>
                                                        <input type="number" value={actionAmount} onChange={(e) => setActionAmount(Number(e.target.value))} className="w-full text-center bg-transparent text-yellow-500 font-black text-2xl outline-none" />
                                                    </div>
                                                    <div className="flex gap-2 w-full">
                                                        <button onClick={() => balanseLajanKont(receiver, sender, `Ranbousman LITIJ #${searchedDispute.order_id || searchedDispute.id.substring(0,8)}`)} disabled={processingId === 'balance_transfer' || (!receiver && !sender)} className="flex-1 bg-red-600 hover:bg-red-500 text-white p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 shadow-lg shadow-red-600/20 group" title="Rale nan Machann, Mete nan Kliyan"><ArrowRightLeft className="rotate-180 group-hover:-translate-x-1 transition-transform" size={16} /><span className="text-[8px] font-black tracking-widest leading-tight text-center">RANBOUSE<br/>KLIYAN</span></button>
                                                        <button onClick={() => balanseLajanKont(sender, receiver, `Peman LITIJ #${searchedDispute.order_id || searchedDispute.id.substring(0,8)}`)} disabled={processingId === 'balance_transfer' || (!receiver && !sender)} className="flex-1 bg-green-600 hover:bg-green-500 text-white p-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50 shadow-lg shadow-green-600/20 group" title="Rale nan Kliyan, Mete nan Machann"><ArrowRightLeft className="group-hover:translate-x-1 transition-transform" size={16} /><span className="text-[8px] font-black tracking-widest leading-tight text-center">PEYE<br/>MACHANN</span></button>
                                                    </div>
                                                </div>

                                                <div className="flex-1 w-full bg-black border border-white/5 p-5 rounded-2xl relative flex flex-col justify-between">
                                                    <span className="absolute -top-3 left-4 bg-zinc-800 text-zinc-300 text-[8px] px-2 py-1 rounded font-black tracking-widest border border-white/10 shadow-lg">MOUN KI RESEVWA (MACHANN)</span>
                                                    {receiver ? (
                                                        <>
                                                            <div className="flex items-center gap-4 mt-2 mb-4">
                                                                <div className="w-12 h-12 bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center text-xl border border-blue-500/30 shrink-0"><Store size={20}/></div>
                                                                <div className="overflow-hidden">
                                                                    <p className="text-sm font-black truncate text-white">{receiver.full_name}</p>
                                                                    <p className="text-[10px] text-zinc-500 lowercase truncate">{receiver.email}</p>
                                                                    <p className="text-xs font-black text-blue-400 mt-1 flex items-center gap-1"><span>Balans:</span><span className="bg-blue-900/30 px-2 py-0.5 rounded text-blue-400">{Number(receiver.wallet_balance).toLocaleString()} HTG</span></p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2 mt-auto pt-4 border-t border-white/5">
                                                                <button onClick={() => handleManualBalanceAdjust(receiver, 'add')} className="flex-1 flex items-center justify-center gap-1 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white py-2.5 rounded-xl text-[9px] font-black transition-all border border-green-600/20 hover:border-green-600"><Plus size={12}/> AJOUTE</button>
                                                                <button onClick={() => handleManualBalanceAdjust(receiver, 'subtract')} className="flex-1 flex items-center justify-center gap-1 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white py-2.5 rounded-xl text-[9px] font-black transition-all border border-red-600/20 hover:border-red-600"><Minus size={12}/> RETIRE</button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <p className="text-[10px] text-red-500 italic mt-4 font-black tracking-widest text-center flex items-center justify-center gap-1"><AlertTriangle size={12}/> Machann nan pa jwenn sou sistèm nan.</p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-8 border-t border-white/5">
                                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4">Mesaj Ak Kliyan an / Prèv Litij</p>
                                                <div className="bg-black border border-white/5 rounded-2xl p-4 max-h-[250px] overflow-y-auto mb-4 space-y-4">
                                                    <div className="flex flex-col items-start max-w-[85%]">
                                                        <div className="bg-zinc-800 p-4 rounded-2xl rounded-tl-sm text-white text-xs whitespace-pre-wrap normal-case border border-white/5">{searchedDispute.dispute_details?.proof_text || searchedDispute.dispute_reason || 'Pa gen mesaj kliyan.'}</div>
                                                    </div>
                                                    {searchedDispute.dispute_details?.admin_reply && (
                                                        <div className="flex flex-col items-end max-w-[85%] ml-auto">
                                                            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-2xl rounded-tr-sm text-white text-xs whitespace-pre-wrap normal-case">{searchedDispute.dispute_details?.admin_reply}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="bg-zinc-900 rounded-xl p-2 flex gap-2 border border-white/10 focus-within:border-red-500/50 transition-colors">
                                                    <textarea placeholder="Voye yon mesaj bay kliyan an..." value={adminReplies[searchedDispute.id] || ''} onChange={(e) => setAdminReplies({ ...adminReplies, [searchedDispute.id]: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-xs p-3 text-white normal-case resize-none min-h-[40px]"></textarea>
                                                    <button onClick={() => voyeReponsAdmin(searchedDispute.id, searchedDispute.dispute_details || {}, searchedDispute.table_source)} className="bg-red-600 hover:bg-red-500 w-12 rounded-lg flex items-center justify-center text-white transition-all"><Send size={16} /></button>
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
                                        let senderId = tx.dispute_details?.client_id || tx.metadata?.customer_id || tx.user_id;
                                        const client = allUsers.find(u => u.id === senderId) || allUsers.find(u => u.id === tx.user_id);
                                        return (
                                            <div key={tx.id} className="bg-[#121420] rounded-[2.5rem] border border-zinc-800 overflow-hidden shadow-lg flex flex-col lg:flex-row opacity-80 hover:opacity-100 transition-opacity">
                                                <div className="w-full lg:w-1/3 bg-zinc-900/50 p-6 border-b lg:border-b-0 lg:border-r border-white/5 flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-6"><div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 border border-yellow-500/30"><AlertTriangle size={20} /></div><div><h3 className="text-lg font-black text-white">LITIJ #{tx.order_id || tx.id.substring(0,8)}</h3><p className="text-[10px] text-zinc-400 font-bold tracking-widest">{new Date(tx.created_at).toLocaleDateString()}</p></div></div>
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
                                                    <div className="mt-8 pt-6 border-t border-white/5"><button onClick={() => { setSearchDisputeId(tx.order_id || tx.id); handleAdminSearchDispute(); }} className="w-full bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl text-[10px] font-black text-white shadow-lg shadow-yellow-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">🔍 LOUVRI DOSYE A POU REZOUD LI</button></div>
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
                                                        <textarea placeholder="Tape repons ou an pou kliyan an la a..." value={adminReplies[tx.id] || ''} onChange={(e) => setAdminReplies({ ...adminReplies, [tx.id]: e.target.value })} className="flex-1 bg-transparent border-none outline-none text-xs p-3 text-white lowercase normal-case resize-none min-h-[50px]" rows={2}></textarea>
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
                                            {user.kyc_front && <button onClick={() => handleOpenMaskedUrl(user.kyc_front)} className="text-[9px] bg-blue-600/20 px-4 py-2 rounded-lg text-blue-400 border border-blue-600/30 hover:bg-blue-600 hover:text-white transition-all font-black tracking-widest flex items-center gap-1"><EyeOff size={10}/> DEVAN</button>}
                                            {user.kyc_back && <button onClick={() => handleOpenMaskedUrl(user.kyc_back)} className="text-[9px] bg-blue-600/20 px-4 py-2 rounded-lg text-blue-400 border border-blue-600/30 hover:bg-blue-600 hover:text-white transition-all font-black tracking-widest flex items-center gap-1"><EyeOff size={10}/> DÈYÈ</button>}
                                            {user.kyc_selfie && <button onClick={() => handleOpenMaskedUrl(user.kyc_selfie)} className="text-[9px] bg-purple-600/20 px-4 py-2 rounded-lg text-purple-400 border border-purple-600/30 hover:bg-purple-600 hover:text-white transition-all font-black tracking-widest flex items-center gap-1"><EyeOff size={10}/> SELFIE</button>}
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
                                        <p className="text-[9px] text-zinc-500 mb-1">MONTAN {isDepo ? 'KLIYAN AN DECLARE (SAN FRÈ)' : 'KLIYAN MANDE A'}:</p>
                                        <div className="flex items-center justify-between">
                                            <p className="text-4xl font-black italic tracking-tighter text-white">{aficheMontan} <span className="text-xs text-red-600">HTG</span></p>
                                            {isDepo && item.status === 'pending' && <button onClick={() => { const nouvoVal = prompt("Antre nouvo montan san frè a:", item.amount); if (nouvoVal && !isNaN(Number(nouvoVal))) setMontanModifye(prev => ({ ...prev, [item.id]: Number(nouvoVal) })); }} className="bg-zinc-800 text-white px-3 py-2 rounded-xl text-[8px] font-black tracking-widest hover:bg-zinc-700">MODIFYE</button>}
                                        </div>

                                        {isDepo && item.fee !== undefined && (
                                            <div className="mt-4 space-y-1">
                                                <div className="flex justify-between items-center p-2 bg-emerald-900/10 rounded-lg">
                                                    <span className="text-[9px] text-zinc-400">FRÈ BIZNIS LA (5%):</span>
                                                    <span className="text-[10px] text-emerald-500 font-black">+{montanModifye[item.id] ? (montanModifye[item.id] * 0.05).toFixed(2) : item.fee} HTG</span>
                                                </div>
                                                <div className="flex justify-between items-center p-2 bg-zinc-800 rounded-lg border border-white/5">
                                                    <span className="text-[9px] text-white font-black">TOTAL KLIYAN TE DWE VOYE A:</span>
                                                    <span className="text-sm text-yellow-500 font-black">{montanModifye[item.id] ? (montanModifye[item.id] * 1.05).toFixed(2) : item.total_to_pay || (Number(item.amount) + Number(item.fee))} HTG</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {item.status === 'pending' && (
                                        <div className="space-y-4">
                                            <div className="flex gap-2">
                                                <button disabled={processingId === item.id} onClick={() => isDepo ? apwouveDepo(item) : apwouveRetre(item)} className="flex-1 bg-white text-black py-4 rounded-2xl text-[10px] font-black hover:bg-green-500 hover:text-white transition-all">KONFIME APWOUVE</button>
                                                <button disabled={processingId === item.id} onClick={() => anileTranzaksyon(item, isDepo ? 'deposits' : 'withdrawals')} className="bg-red-600/20 text-red-600 border border-red-600/30 px-5 py-4 rounded-2xl text-[10px] hover:bg-red-600 hover:text-white transition-all">ANILE</button>
                                            </div>
                                            {isDepo && item.proof_img_1 && (<button onClick={() => handleOpenMaskedUrl(item.proof_img_1)} className="w-full block text-center bg-zinc-800 py-4 rounded-2xl text-[9px] text-zinc-400 border border-white/5 hover:text-white hover:bg-zinc-700 transition-all font-black tracking-widest flex items-center justify-center gap-2"><EyeOff size={12}/> GADE FOTO PRÈV 1</button>)}
                                            {isDepo && item.proof_img_2 && (<button onClick={() => handleOpenMaskedUrl(item.proof_img_2)} className="w-full block text-center bg-zinc-800 py-4 rounded-2xl text-[9px] text-zinc-400 border border-white/5 hover:text-white hover:bg-zinc-700 transition-all font-black tracking-widest flex items-center justify-center gap-2"><EyeOff size={12}/> GADE FOTO PRÈV 2</button>)}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    {!loading && view !== 'biznis' && view !== 'sispandi' && view !== 'litij' && view !== 'kliyan' && view !== 'kyc' && view !== 'promo' && view !== 'anons' && (view === 'depo' ? deposits : withdrawals).length === 0 && <div className="text-center py-20 text-zinc-600 text-xs uppercase">Pa gen okenn {view} pou kounye a</div>}
                </div>
            </div>
        </div>
    );
}