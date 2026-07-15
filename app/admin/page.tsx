"use client";

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Send, UserX, ShieldCheck, AlertTriangle, Search, Store, Lock, Briefcase, DollarSign, EyeOff, Loader2, CheckCircle2, FileText, XCircle, Users, UserPlus, UserMinus, UserCheck as UserCheckIcon, Activity, CreditCard, KeyRound, Building2 as Building2Icon, MinusCircle } from 'lucide-react';
import AdminMfaSettings from './AdminMfaSettings';
import AdminAuditLog from './AdminAuditLog';
import AdminClientDossier from './AdminClientDossier';

export default function AdminSuperPage() {
    // ----------------------------------------------------
    // ETA POU EKRAN SEKIRITE A
    // ----------------------------------------------------
    const [accessGranted, setAccessGranted] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const [adminPassword, setAdminPassword] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [unlockError, setUnlockError] = useState('');

    // ----------------------------------------------------
    // ETA POU DONE ADMIN YO (PANYEN AN)
    // ----------------------------------------------------
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [promoCodes, setPromoCodes] = useState<any[]>([]);
    const [pendingAgents, setPendingAgents] = useState<any[]>([]);
    const [agentRejectionReason, setAgentRejectionReason] = useState<{ [key: string]: string }>({});
    const [pendingEnterprises, setPendingEnterprises] = useState<any[]>([]);
    const [enterpriseRejectionReason, setEnterpriseRejectionReason] = useState<{ [key: string]: string }>({});
    const [staffMembers, setStaffMembers] = useState<any[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('support');
    const [totalCardBal, setTotalCardBal] = useState(0);
    const [newPromoCode, setNewPromoCode] = useState('');
    const [promoReward, setPromoReward] = useState('250');
    const [searchQuery, setSearchQuery] = useState('');
    const [anonsText, setAnonsText] = useState('');
    const [anonsActive, setAnonsActive] = useState(true);
    const [view, setView] = useState<'dashboard' | 'anons' | 'kliyan' | 'dosye' | 'depo' | 'retre' | 'sispandi' | 'kyc' | 'promo' | 'ajan' | 'antrepriz' | 'ekip' | 'sekirite'>('dashboard');
    const [dossierUserId, setDossierUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [montanModifye, setMontanModifye] = useState<{ [key: string]: number }>({});
    const [totalClientBal, setTotalClientBal] = useState(0);
    const [totalBiznisProfit, setTotalBiznisProfit] = useState(0);
    const [feesBreakdown, setFeesBreakdown] = useState({ depo: 0, retre: 0, transfe: 0, ajan: 0, antrepriz: 0, kat: 0, kyc: 0 });
    const [agentFeeHistory, setAgentFeeHistory] = useState<any[]>([]);
    const [enterpriseFeeHistory, setEnterpriseFeeHistory] = useState<any[]>([]);
    const [cardActivationFeeHistory, setCardActivationFeeHistory] = useState<any[]>([]);
    const [kycFeeHistory, setKycFeeHistory] = useState<any[]>([]);
    const [unifiedFeeHistory, setUnifiedFeeHistory] = useState<any[]>([]);
    const [bizProfitWithdrawn, setBizProfitWithdrawn] = useState(0);
    const [bizProfitAvailable, setBizProfitAvailable] = useState(0);
    const [bizWithdrawHistory, setBizWithdrawHistory] = useState<any[]>([]);
    const [showBizWithdrawModal, setShowBizWithdrawModal] = useState(false);
    const [bizWithdrawAmount, setBizWithdrawAmount] = useState('');
    const [bizWithdrawNote, setBizWithdrawNote] = useState('');
    const [bizWithdrawPassword, setBizWithdrawPassword] = useState('');
    const [bizWithdrawLoading, setBizWithdrawLoading] = useState(false);
    const [bizWithdrawError, setBizWithdrawError] = useState('');

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // ====================================================
    // VERIFIKASYON AK LÒK EKRAN AN
    // ====================================================
    useEffect(() => {
        const checkExistingSession = async () => {
            try {
                const gateRes = await fetch('/api/admin/verify-gate');
                if (gateRes.ok) {
                    setAccessGranted(true);
                    raleDone();
                }
            } catch (e) {
                // Ignore
            } finally {
                setIsCheckingSession(false);
            }
        };
        checkExistingSession();
    }, []);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUnlocking(true);
        setUnlockError('');

        try {
            const verifyRes = await fetch('/api/admin/verify-gate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: adminPassword }),
            });

            const data = await verifyRes.json().catch(() => ({}));

            if (verifyRes.ok) {
                setAccessGranted(true);
                raleDone();
            } else if (verifyRes.status === 429) {
                setUnlockError("Erè 429: Twòp tantativ. Tann kèk minit anvan w eseye ankò.");
            } else if (verifyRes.status === 403) {
                setUnlockError(data.message || "Kont ou konekte a pa gen dwa admin.");
            } else if (verifyRes.status === 500) {
                setUnlockError(data.message || "ADMIN_GATE_PASSWORD pa konfigire sou sèvè a. Kontakte devlopè a.");
            } else {
                setUnlockError(data.message || "Modpas la pa bon!");
            }
        } catch (err) {
            setUnlockError("Erè koneksyon. Tcheke entènèt ou.");
        } finally {
            setIsUnlocking(false);
        }
    };

    // ====================================================
    // FONKSYON RALE DONE
    // ====================================================
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

            const { data: k } = await supabase.from('profiles').select('*').eq('kyc_status', 'pending').not('kyc_selfie', 'is', null).order('created_at', { ascending: false });
            setPendingKyc(k || []);

            const { data: p } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false });
            setPromoCodes(p || []);

            const { data: agData } = await supabase.from('agent_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false });
            if (agData && u) {
                const mergedAgents = agData.map(agent => ({
                   ...agent,
                   profiles: u.find(user => user.id === agent.user_id) || {}
                }));
                setPendingAgents(mergedAgents);
            }

            const { data: entData } = await supabase.from('enterprise_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false });
            if (entData && u) {
                const mergedEnterprises = entData.map(app => ({
                   ...app,
                   profiles: u.find(user => user.id === app.user_id) || {}
                }));
                setPendingEnterprises(mergedEnterprises);
            }

            const { data: stData } = await supabase.from('staff_users').select('*').order('created_at', { ascending: false });
            setStaffMembers(stData || []);
            
            const { data: anonsData } = await supabase.from('global_settings').select('*').eq('id', 1).maybeSingle();
            if (anonsData) {
                setAnonsText(anonsData.announcement_text || '');
                setAnonsActive(anonsData.announcement_active);
            }

            await kalkileTotalBiznis(u || []);

        } catch (e: any) {
             console.error("Erè rale done:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleBizProfitWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        setBizWithdrawLoading(true);
        setBizWithdrawError('');

        const montan = Number(bizWithdrawAmount);
        if (!Number.isFinite(montan) || montan <= 0) {
            setBizWithdrawError('Antre yon montan valab.');
            setBizWithdrawLoading(false);
            return;
        }
        if (!bizWithdrawPassword) {
            setBizWithdrawError('Modpas admin obligatwa pou konfime.');
            setBizWithdrawLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/admin/business-withdrawal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: montan,
                    note: bizWithdrawNote.trim() || undefined,
                    password: bizWithdrawPassword,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setBizWithdrawError(data.error || 'Retrè a echwe.');
                return;
            }

            setShowBizWithdrawModal(false);
            setBizWithdrawAmount('');
            setBizWithdrawNote('');
            setBizWithdrawPassword('');
            await raleDone();
            alert(`Retrè ${montan.toLocaleString()} HTG anrejistre. Pwofi disponib: ${Number(data.available_htg || 0).toLocaleString()} HTG`);
        } catch {
            setBizWithdrawError('Erè koneksyon. Eseye ankò.');
        } finally {
            setBizWithdrawLoading(false);
        }
    };

    const kalkileTotalBiznis = async (profiles: any[]) => {
        try {
            const totalKliyan = profiles.reduce((acc, u) => acc + Number(u.wallet_balance || 0), 0);
            setTotalClientBal(totalKliyan);

            const totalKat = profiles.reduce((acc, u) => acc + Number(u.card_balance || 0), 0);
            setTotalCardBal(totalKat);

            const { data: depData } = await supabase.from('deposits').select('fee, created_at').eq('status', 'approved');
            const totalDepoFee = (depData || []).reduce((acc, d) => acc + Number(d.fee || 0), 0);

            const { data: witData } = await supabase.from('withdrawals').select('fee, created_at').eq('status', 'completed');
            const totalRetreFee = (witData || []).reduce((acc, w) => acc + Number(w.fee || 0), 0);

            const { data: traData } = await supabase.from('transfers').select('fee, status');
            const totalTransfeFeeOld = (traData || [])
                .filter(t => !t.status || t.status === 'success' || t.status === 'completed')
                .reduce((acc, t) => acc + Number(t.fee || 0), 0);

            // Frè transfè P2P yo anrejistre kòm tranzaksyon 'TRANSFER_FEE' (menm sistèm ak frè ajan yo)
            const { data: transferFeeData } = await supabase
                .from('transactions')
                .select('amount, status, created_at')
                .eq('type', 'TRANSFER_FEE')
                .eq('status', 'success');
            const totalTransferFeeNew = (transferFeeData || []).reduce((acc, t) => acc + Math.abs(Number(t.amount || 0)), 0);

            const totalTransfeFee = totalTransfeFeeOld + totalTransferFeeNew;
                
            // Chak frè ajan (aktivasyon oswa ogmantasyon kapasite) antre otomatikman nan Kès Global la
            // paske li anrejistre kòm yon tranzaksyon 'FEE' — nou rale l isit pou n kalkile total la
            // EPI pou n bati yon istorik li pou Sipè Admin ka wè chak evènman apa.
            const { data: feeData } = await supabase
                .from('transactions')
                .select('id, user_id, amount, description, created_at')
                .eq('type', 'FEE')
                .eq('status', 'success')
                .order('created_at', { ascending: false });

            const totalAgentFee = (feeData || []).reduce((acc, f) => acc + Math.abs(Number(f.amount || 0)), 0);

            const enrichedHistory = (feeData || []).slice(0, 25).map(f => ({
                ...f,
                agentName: profiles.find(u => u.id === f.user_id)?.full_name || 'Ajan Enkoni',
                agentEmail: profiles.find(u => u.id === f.user_id)?.email || '',
            }));
            setAgentFeeHistory(enrichedHistory);

            // Frè Pasaj Kont Antrepriz (49,000 HTG) — se pwofi HatexCard, li PA janm
            // antre sou balans/kont ajan moun ki soumèt aplikasyon an.
            const { data: entFeeData } = await supabase
                .from('transactions')
                .select('id, user_id, amount, description, created_at')
                .eq('type', 'ENTERPRISE_FEE')
                .eq('status', 'success')
                .order('created_at', { ascending: false });

            const totalEnterpriseFee = (entFeeData || []).reduce((acc, f) => acc + Math.abs(Number(f.amount || 0)), 0);

            const enrichedEnterpriseHistory = (entFeeData || []).slice(0, 25).map(f => ({
                ...f,
                clientName: profiles.find(u => u.id === f.user_id)?.full_name || 'Kliyan Enkoni',
                clientEmail: profiles.find(u => u.id === f.user_id)?.email || '',
            }));
            setEnterpriseFeeHistory(enrichedEnterpriseHistory);

            // 🔧 KORIJE: Frè Aktivasyon Kat (520 HTG) te envizib nèt nan Kès Global
            // la — li anrejistre kòm tranzaksyon 'CARD_ACTIVATION' men pa t janm
            // konte. Kounye a nou rale l, konte l, e bati yon istorik pou li tou.
            const { data: cardFeeData } = await supabase
                .from('transactions')
                .select('id, user_id, amount, description, created_at')
                .eq('type', 'CARD_ACTIVATION')
                .eq('status', 'success')
                .order('created_at', { ascending: false });

            const totalCardFee = (cardFeeData || []).reduce((acc, f) => acc + Math.abs(Number(f.amount || 0)), 0);

            const enrichedCardHistory = (cardFeeData || []).slice(0, 25).map(f => ({
                ...f,
                clientName: profiles.find(u => u.id === f.user_id)?.full_name || 'Kliyan Enkoni',
                clientEmail: profiles.find(u => u.id === f.user_id)?.email || '',
            }));
            setCardActivationFeeHistory(enrichedCardHistory);

            const { data: kycFeeData } = await supabase
                .from('transactions')
                .select('id, user_id, amount, description, created_at')
                .eq('type', 'KYC_FEE')
                .eq('status', 'success')
                .order('created_at', { ascending: false });

            const totalKycFee = (kycFeeData || []).reduce((acc, f) => acc + Math.abs(Number(f.amount || 0)), 0);

            const enrichedKycHistory = (kycFeeData || []).slice(0, 25).map(f => ({
                ...f,
                clientName: profiles.find(u => u.id === f.user_id)?.full_name || 'Kliyan Enkoni',
                clientEmail: profiles.find(u => u.id === f.user_id)?.email || '',
            }));
            setKycFeeHistory(enrichedKycHistory);

            setFeesBreakdown({ depo: totalDepoFee, retre: totalRetreFee, transfe: totalTransfeFee, ajan: totalAgentFee, antrepriz: totalEnterpriseFee, kat: totalCardFee, kyc: totalKycFee });
            
            const granTotalPwofi = totalDepoFee + totalRetreFee + totalTransfeFee + totalAgentFee + totalEnterpriseFee + totalCardFee + totalKycFee;
            setTotalBiznisProfit(granTotalPwofi);

            const { data: bizWithdrawData } = await supabase
                .from('business_profit_withdrawals')
                .select('id, amount, note, created_at')
                .order('created_at', { ascending: false })
                .limit(50);

            const totalRetirePwofi = (bizWithdrawData || []).reduce((acc, w) => acc + Number(w.amount || 0), 0);
            setBizProfitWithdrawn(totalRetirePwofi);
            setBizProfitAvailable(Math.max(0, granTotalPwofi - totalRetirePwofi));
            setBizWithdrawHistory(bizWithdrawData || []);

            // 🔗 ISTORIK KONPLÈ KÈS GLOBAL — fusyone TOUT sous frè yo (depo,
            // retrè, transfè, ajan, antrepriz, kat) nan YON SÈL lis kwonolojik
            // pou Sipè Admin ka wè tout mouvman kòb biznis la fè nan yon sèl kote.
            const depoEntries = (depData || [])
                .filter((d: any) => Number(d.fee) > 0)
                .map((d: any, idx: number) => ({ id: `depo-${idx}`, kalite: 'Depo', amount: Number(d.fee), created_at: d.created_at || null, description: 'Frè Depo (5%)' }));

            const retreEntries = (witData || [])
                .filter((w: any) => Number(w.fee) > 0)
                .map((w: any, idx: number) => ({ id: `retre-${idx}`, kalite: 'Retrè', amount: Number(w.fee), created_at: w.created_at || null, description: 'Frè Retrè (5%)' }));

            const transfeEntries = (transferFeeData || []).map((t: any, idx: number) => ({
                id: `transfe-${idx}`, kalite: 'Transfè', amount: Math.abs(Number(t.amount || 0)), created_at: t.created_at || null, description: 'Frè Transfè P2P',
            }));

            const ajanEntries = (feeData || []).map((f: any) => ({
                id: f.id, kalite: 'Ajan', amount: Math.abs(Number(f.amount || 0)), created_at: f.created_at,
                description: f.description, nonMoun: profiles.find(u => u.id === f.user_id)?.full_name || 'Ajan Enkoni',
            }));

            const antreprizEntries = (entFeeData || []).map((f: any) => ({
                id: f.id, kalite: 'Antrepriz', amount: Math.abs(Number(f.amount || 0)), created_at: f.created_at,
                description: f.description, nonMoun: profiles.find(u => u.id === f.user_id)?.full_name || 'Kliyan Enkoni',
            }));

            const katEntries = (cardFeeData || []).map((f: any) => ({
                id: f.id, kalite: 'Kat', amount: Math.abs(Number(f.amount || 0)), created_at: f.created_at,
                description: f.description, nonMoun: profiles.find(u => u.id === f.user_id)?.full_name || 'Kliyan Enkoni',
            }));

            const kycEntries = (kycFeeData || []).map((f: any) => ({
                id: f.id, kalite: 'KYC', amount: Math.abs(Number(f.amount || 0)), created_at: f.created_at,
                description: f.description || 'Frè KYC (kat enkli)', nonMoun: profiles.find(u => u.id === f.user_id)?.full_name || 'Kliyan Enkoni',
            }));

            const retreBankEntries = (bizWithdrawData || []).map((w: any) => ({
                id: w.id,
                kalite: 'Retrè Bank',
                amount: -Number(w.amount || 0),
                created_at: w.created_at,
                description: w.note || 'Retrè pwofi biznis nan bank',
            }));

            const tousLesFrèYo = [...depoEntries, ...retreEntries, ...transfeEntries, ...ajanEntries, ...antreprizEntries, ...katEntries, ...kycEntries, ...retreBankEntries]
                .filter((entry) => entry.created_at)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 60);

            setUnifiedFeeHistory(tousLesFrèYo);
        } catch (error) {}
    };

    const handleOpenDocument = async (ref: string) => {
        if (!ref) { alert("Pa gen lyen pou dokiman sa a!"); return; }
        if (ref.startsWith('http://') || ref.startsWith('https://')) {
            window.open(ref, '_blank');
            return;
        }
        try {
            const res = await fetch(`/api/admin/deposit-proof?ref=${encodeURIComponent(ref)}`);
            const data = await res.json();
            if (!res.ok || !data.url) throw new Error(data.error || 'Erè');
            window.open(data.url, '_blank');
        } catch (e: any) {
            alert(e.message || 'Pa t kapab louvri prèv la.');
        }
    };

    const handleOpenKycDocument = async (userId: string, doc: 'front' | 'back' | 'selfie', legacyValue?: string | null) => {
        if (!legacyValue) { alert("Pa gen dokiman sa a!"); return; }
        if (legacyValue.startsWith('http://') || legacyValue.startsWith('https://')) {
            window.open(legacyValue, '_blank');
            return;
        }
        try {
            const res = await fetch(`/api/kyc/document?userId=${userId}&doc=${doc}`);
            const data = await res.json();
            if (!res.ok || !data.url) throw new Error(data.error || 'Erè');
            window.open(data.url, '_blank');
        } catch (e: any) {
            alert(e.message || 'Pa t kapab louvri dokiman an.');
        }
    };

    const voyeEmailKliyan = async (email: string, non: string, mesaj: string, subject: string) => {
        if (!email) return;
        try { await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email.trim(), subject, non, mesaj }), }); } catch (error) {}
    };

    const voyeTelegram = async (msg: string) => {
        try { await fetch('/api/notifications/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: 'admin', message: msg, parseMode: 'HTML' }) }); } catch (e) {}
    };

    // Jounal odit sèvè-a-sèvè pou chak aksyon sansib Sipè Admin fè (gade
    // AdminAuditLog.tsx pou konsilte l nan tab "Sekirite").
    const logAdminAudit = async (action: string, targetType?: string, targetId?: string, details?: Record<string, unknown>) => {
        try { await fetch('/api/admin/audit-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, targetType, targetId, details }) }); } catch (e) {}
    };

    const deleteTranzaksyon = async (id: string, table: string) => {
        if (!confirm("Èske ou vle efase istwa sa a nèt?")) return;
        setProcessingId(id);
        try { await supabase.from(table).delete().eq('id', id); await logAdminAudit('TRANSACTION_DELETED', table, id); alert("Efase nèt!"); raleDone(); } finally { setProcessingId(null); }
    };

    const apwouveDepo = async (d: any) => {
        const isModified = montanModifye[d.id] !== undefined;
        const montanFinal = isModified ? montanModifye[d.id] : Number(d.amount);
        const frePouBiznisLa = isModified ? Number((montanFinal * 0.05).toFixed(2)) : Number(d.fee || 0);
        const totalPeye = montanFinal + frePouBiznisLa;

        if (!confirm(`TCHEKE DEPO SA BYEN:\n\n- Kliyan an ap resevwa: ${montanFinal} HTG\n- Frè pou Antrepriz la (Biznis): ${frePouBiznisLa} HTG\n- Total kliyan an te dwe voye sou Moncash la se: ${totalPeye} HTG\n\nÈske w wè ${totalPeye} HTG a sou telefòn ou? Si wi, konfime l.`)) return;
        
        setProcessingId(d.id);
        try {
            const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', d.user_id).single();

            const res = await fetch('/api/admin/finance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'approve_deposit',
                deposit_id: d.id,
                final_amount: montanFinal,
                fee: frePouBiznisLa,
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Apwobasyon echwe.');

            await voyeEmailKliyan(p?.email, p?.full_name, `Bonjou ${p?.full_name}, depo ou a apwouve. Nou ajoute ${montanFinal} HTG sou balans ou.`, "DEPO APWOUVE");
            await voyeTelegram(`<b>DEPO APWOUVE</b>\nKliyan: ${p?.full_name}\nMontan Kliyan: ${montanFinal} HTG\nFrè Biznis (Pwofi): ${frePouBiznisLa} HTG`);
            await logAdminAudit('DEPOSIT_APPROVED', 'deposit', d.id, { amount: montanFinal, fee: frePouBiznisLa, user_id: d.user_id });
            
            alert("SIKSÈ! Depo a apwouve."); raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const apwouveRetre = async (w: any) => {
        if (!confirm(`Konfime retrè ${w.amount} HTG sa a?`)) return;
        setProcessingId(w.id);
        try {
            const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', w.user_id).single();
            const res = await fetch('/api/admin/finance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'complete_withdrawal', withdrawal_id: w.id }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Retrè echwe.');
            
            await voyeEmailKliyan(p?.email, p?.full_name, `Bonjou ${p?.full_name}, retrè ${w.amount} HTG ou a fin trete. Lajan an voye sou kont ou.`, "RETRÈ KONFIME");
            await voyeTelegram(`<b>RETRÈ KONFIME</b>\nKliyan: ${p?.full_name}\nMontan: ${w.amount} HTG`);
            await logAdminAudit('WITHDRAWAL_APPROVED', 'withdrawal', w.id, { amount: w.amount, user_id: w.user_id });
            alert("RETRÈ FINI!"); raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const anileTranzaksyon = async (item: any, table: string) => {
        const rezon = prompt("Rezon anilasyon?");
        if (!rezon) return;
        setProcessingId(item.id);
        try {
            const { data: p } = await supabase.from('profiles').select('full_name, email').eq('id', item.user_id).single();
            const res = await fetch('/api/admin/finance', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'reject', table, item_id: item.id, reason: rezon }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Anilasyon echwe.');

            await voyeEmailKliyan(p?.email, p?.full_name, `Bonjou ${p?.full_name}, tranzaksyon ${item.amount} HTG ou a anile. Rezon: ${rezon}`, "TRANZAKSYON ANILE");
            await voyeTelegram(`<b>ANILE</b>\nKliyan: ${p?.full_name}\nRezon: ${rezon}`);
            await logAdminAudit(`${table.toUpperCase()}_CANCELLED`, table, item.id, { reason: rezon, amount: item.amount, user_id: item.user_id });
            alert("Anile!"); raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const deblokeKont = async (id: string, email: string) => {
        if (!confirm(`Èske w vle aktive kont sa a ankò? (${email})`)) return;
        setProcessingId(id);
        try { await supabase.from('profiles').update({ account_status: 'active', is_activated: true, failed_otp_attempts: 0 }).eq('id', id); await logAdminAudit('ACCOUNT_UNSUSPENDED', 'profile', id, { email }); alert(`Kont ${email} lan aktive!`); raleDone(); } 
        catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const sispannKont = async (id: string, email: string) => {
        if (!confirm(`Èske w sèten ou vle SISPANN kont sa a? (${email})`)) return;
        setProcessingId(id);
        try { await supabase.from('profiles').update({ account_status: 'suspended' }).eq('id', id); await logAdminAudit('ACCOUNT_SUSPENDED', 'profile', id, { email }); alert(`Kont ${email} lan sispandi!`); raleDone(); } 
        catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const jereKyc = async (id: string, full_name: string, email: string, aksyon: 'approved' | 'rejected') => {
        let rezonReje = "";
        if (aksyon === 'rejected') { const rep = prompt("Tanpri ekri rezon ki fè w rejte dokiman sa yo:"); if (!rep) return; rezonReje = rep; } 
        else { if (!confirm(`Èske w sèten ou vle APWOUVE KYC pou ${full_name}? Kat ak terminal ap kreye otomatikman.`)) return; }
        setProcessingId(id);
        try {
            const res = await fetch('/api/admin/kyc-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: id, action: aksyon, reason: rezonReje || undefined }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erè pandan revizyon KYC.');

            const mesajE = aksyon === 'approved'
                ? `Felisitasyon ${full_name}! Dokiman w yo apwouve. Kat vityèl ou ak terminal ou aktive otomatikman.`
                : `Bonjou ${full_name}. \n\nMalerezman, nou pa ka aksepte dokiman KYC ou te soumèt yo.\n\nREZON: ${rezonReje}`;
            await voyeEmailKliyan(email, full_name, mesajE, `VERIFIKASYON ID ${aksyon === 'approved' ? 'APWOUVE' : 'REJTE'}`);
            alert(aksyon === 'approved' ? 'KYC apwouve — kat kreye otomatikman!' : 'KYC rejte avèk siksè!'); raleDone();
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
            const res = await fetch('/api/admin/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind: 'agent',
                    action: aksyon,
                    application_id: applicationId,
                    user_id: userId,
                    reason: aksyon === 'rejected' ? rezon : undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Echèk review ajan.');
            }

            const mesajE = aksyon === 'approved' 
                ? `Felisitasyon ${fullName}! Aplikasyon w pou vin Ajan Hatexcard la apwouve. Ou ka vizite pòtay ajan w lan kounye a pou w jwenn kòd inik ou a epi kòmanse travay.` 
                : `Bonjou ${fullName}. \n\nEkip nou an verifye aplikasyon ajan w lan epi nou oblije rejte l pou rezon sa a:\n\n${rezon}\n\n(N.B: Tout garanti ou te depoze yo tounen sou kont prensipal ou otomatikman).\n\nOu ka korije enfòmasyon yo epi soumèt yon nouvo demann.`;
            
            await voyeEmailKliyan(userEmail, fullName, mesajE, `REZILTA APLIKASYON AJAN ${aksyon === 'approved' ? 'APWOUVE' : 'REJTE'}`);
            alert(`Aplikasyon an ${aksyon === 'approved' ? 'Apwouve' : 'Rejte e Ranbouse'} avèk siksè!`); 
            if (aksyon === 'rejected') setAgentRejectionReason(prev => ({...prev, [applicationId]: ''}));
            raleDone();
        } catch (err: any) { alert("Erè nan pwosesis la: " + err.message); } finally { setProcessingId(null); }
    };

    // ====================================================
    // JERE APLIKASYON KONT ANTREPRIZ (Apwouve/Rejte)
    // ====================================================
    const jereAntrepriz = async (applicationId: string, userId: string, fullName: string, userEmail: string, aksyon: 'approved' | 'rejected') => {
        let rezon = "";
        if (aksyon === 'rejected') {
            rezon = enterpriseRejectionReason[applicationId] || "";
            if (!rezon.trim()) return alert("Tanpri ekri yon rezon pou w ka rejte aplikasyon sa a.");
        } else {
            if (!confirm(`Èske w sèten ou vle APWOUVE aplikasyon Antrepriz sa a pou ${fullName}?`)) return;
        }

        setProcessingId(applicationId);
        try {
            const res = await fetch('/api/admin/applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    kind: 'enterprise',
                    action: aksyon,
                    application_id: applicationId,
                    user_id: userId,
                    reason: aksyon === 'rejected' ? rezon : undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Echèk review antrepriz.');
            }

            const mesajE = aksyon === 'approved'
                ? `Felisitasyon ${fullName}! Kont Antrepriz ou apwouve. Ou kounye a gen transfè/retrè ilimite, limit kat pi wo, epi yon kont Ajan PRO gratis si w pat genyen l deja.`
                : `Bonjou ${fullName}. \n\nEkip nou an verifye aplikasyon Kont Antrepriz ou epi nou oblije rejte l pou rezon sa a:\n\n${rezon}\n\n(N.B: Frè ou te peye a tounen sou kont prensipal ou otomatikman).\n\nOu ka korije enfòmasyon yo epi soumèt yon nouvo demann.`;

            await voyeEmailKliyan(userEmail, fullName, mesajE, `REZILTA APLIKASYON ANTREPRIZ ${aksyon === 'approved' ? 'APWOUVE' : 'REJTE'}`);
            alert(`Aplikasyon Antrepriz la ${aksyon === 'approved' ? 'Apwouve' : 'Rejte e Ranbouse'} avèk siksè!`);
            if (aksyon === 'rejected') setEnterpriseRejectionReason(prev => ({...prev, [applicationId]: ''}));
            raleDone();
        } catch (err: any) { alert("Erè nan pwosesis la: " + err.message); } finally { setProcessingId(null); }
    };

    const jereAnplwaye = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return alert("Ou dwe mete yon imèl.");

        setProcessingId('invite_staff');
        try {
            const { data: existing } = await supabase.from('staff_users').select('*').eq('email', inviteEmail.trim().toLowerCase()).maybeSingle();
            if (existing) throw new Error("Imèl sa a gentan sourejistre nan ekip la.");

            const { data: profile } = await supabase.from('profiles').select('full_name').eq('email', inviteEmail.trim().toLowerCase()).maybeSingle();
            const staffName = profile?.full_name || 'Anplwaye';

            const { error } = await supabase.from('staff_users').insert({
                email: inviteEmail.trim().toLowerCase(),
                full_name: staffName,
                role: inviteRole,
                status: 'pending'
            });
            if (error) throw error;

            const roleNames: Record<string, string> = {
                'super_admin': 'Sipè Admin (CEO)',
                'finance': 'Depatman Finans',
                'compliance': 'Depatman Konfòmite (KYC & Ajan)',
                'support': 'Sèvis Kliyan (Support)'
            };
            
            // 🔒 SEKIRITE: Pa gen okenn lyen nan imel la ankò. Nou jis anonse
            // anplwaye a — li dwe konekte sou pwòp kont kliyan li (Dashboard),
            // epi klike sou bouton "Aksè Espas Travay" pou l kreye modpas fò
            // espas travay li a pou premye fwa.
            const msg = `Felisitasyon ${staffName}!\n\nAdministrasyon Hatexcard envite w vin travay kòm anplwaye nan depatman: "${roleNames[inviteRole]}".\n\nPou kòmanse:\n1) Konekte sou kont kliyan ou nòmal (menm imel sa a) sou Dashboard Hatexcard.\n2) Louvri meni an, klike sou bouton "Aksè Espas Travay".\n3) Kreye yon modpas fò espesyal pou espas travay ou (li apa de modpas kont kliyan ou a).\n\nPou rezon sekirite, pa gen okenn lyen nan mesaj sa a — sèvi ak Dashboard ou dirèkteman.`;
            
            await voyeEmailKliyan(inviteEmail, staffName, msg, "OU VIN YON ANPLWAYE HATEXCARD");
            await logAdminAudit('STAFF_INVITED', 'staff_users', inviteEmail, { role: inviteRole });

            alert(`Envitasyon an ale! ${staffName} ap resevwa yon mesaj imèl ki di l konekte sou Dashboard li epi klike sou bouton "Aksè Espas Travay".`);
            setInviteEmail('');
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const revokeAnplwaye = async (id: string, email: string) => {
        if (!confirm(`Èske w sèten ou vle revoke aksè anplwaye sa a (${email}) nèt?`)) return;
        setProcessingId(`revoke_${id}`);
        try {
            await supabase.from('staff_users').delete().eq('id', id);
            await logAdminAudit('STAFF_REVOKED', 'staff_users', id, { email });
            alert(`Aksè a revoke nèt pou ${email}.`); raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
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
            await supabase.from('global_settings').update({ announcement_text: anonsText, announcement_active: anonsActive }).eq('id', 1);
            alert("Notifikasyon an chanje avèk siksè e li rive sou tout kliyan yo!"); raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const filteredUsers = allUsers.filter(user => {
        if (!searchQuery) return true;
        const lowerQuery = searchQuery.toLowerCase();
        return user.email?.toLowerCase().includes(lowerQuery) || user.full_name?.toLowerCase().includes(lowerQuery);
    });

    // ====================================================
    // UI POU EKRAN SEKIRITE A SI W POKO METE MODPAS LA
    // ====================================================
    if (isCheckingSession) {
        return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-indigo-500"/></div>;
    }

    if (!accessGranted) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-md bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700">
                    <div className="w-16 h-16 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <KeyRound size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-white text-center tracking-tight mb-2">Pòtay Administratè</h2>
                    <p className="text-slate-400 text-sm text-center mb-8">Sa a se zòn sekrè a. Tanpri rantre modpas Vercel ou a.</p>
                    
                    <form onSubmit={handleUnlock} className="space-y-4">
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input 
                                type="password" 
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                                placeholder="••••••••••••"
                                className="w-full bg-slate-900 border border-slate-700 text-white pl-12 pr-4 py-4 rounded-xl focus:border-rose-500 outline-none transition-colors tracking-widest font-mono"
                                autoFocus
                            />
                        </div>
                        {unlockError && <p className="text-xs text-rose-400 font-bold text-center animate-pulse">{unlockError}</p>}
                        <button 
                            type="submit" 
                            disabled={isUnlocking || !adminPassword}
                            className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex justify-center gap-2"
                        >
                            {isUnlocking ? <Loader2 size={20} className="animate-spin" /> : "Ouvri Pòtay La"}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // ====================================================
    // UI NÒMAL POU KÈS BIZNIS LA 
    // ====================================================
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8 font-sans pb-24">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-8 border-b border-gray-200 pb-6 gap-4">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={28} className="text-indigo-600" />
                      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pòtay Sipè Admin</h1>
                    </div>
                    <button onClick={raleDone} className="bg-white border border-gray-200 text-slate-600 hover:text-indigo-600 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm">Rafrechi Done Yo</button>
                </div>

                <div className="flex gap-2 mb-8 bg-white p-2 rounded-2xl border border-gray-200 overflow-x-auto custom-scrollbar whitespace-nowrap shadow-sm">
                    <button onClick={() => setView('dashboard')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'dashboard' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        <Activity size={14}/> Tablodbò
                    </button>
                    
                    <button onClick={() => setView('ekip')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'ekip' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        <Users size={14}/> Jere Ekip
                    </button>

                    <button onClick={() => setView('kliyan')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'kliyan' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Kliyan ({allUsers.length})</button>
                    <button onClick={() => { setDossierUserId(null); setView('dosye'); }} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'dosye' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        <FileText size={14} /> Dosye
                    </button>
                    <button onClick={() => setView('depo')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'depo' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Depo ({deposits.filter(d => d.status === 'pending').length})</button>
                    <button onClick={() => setView('retre')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'retre' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Retrè ({withdrawals.filter(w => w.status === 'pending').length})</button>
                    <button onClick={() => setView('kyc')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'kyc' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>KYC ({pendingKyc.length})</button>
                    
                    <button onClick={() => setView('ajan')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all relative ${view === 'ajan' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        Ajan 
                        {pendingAgents.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] animate-pulse">{pendingAgents.length}</span>}
                    </button>

                    <button onClick={() => setView('antrepriz')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all relative ${view === 'antrepriz' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        Antrepriz
                        {pendingEnterprises.length > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] animate-pulse">{pendingEnterprises.length}</span>}
                    </button>

                    <button onClick={() => setView('anons')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'anons' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Anons</button>
                    <button onClick={() => setView('promo')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'promo' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Pwomo</button>
                    <button onClick={() => setView('sispandi')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'sispandi' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Sispandi</button>
                    <button onClick={() => setView('sekirite')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'sekirite' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        <Lock size={14}/> Sekirite
                    </button>
                </div>

                <div className="space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                           <Loader2 size={32} className="text-indigo-600 animate-spin" />
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ap Chaje Done Yo...</p>
                        </div>
                    ) : view === 'dashboard' ? (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            <div className="flex items-center gap-4 mb-6">
                                <span className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100"><Activity size={28}/></span>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Kès Global & Aktivite</h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1"><ShieldCheck size={14} className="text-emerald-500" /> Aksè Rezève (Sipè Admin)</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                                    <div className="absolute top-0 right-0 p-6 opacity-5"><Users size={80} /></div>
                                    <div className="relative z-10 mb-6">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Kòb Kliyan Yo (Wallet)</p>
                                        <h3 className="text-4xl font-bold text-slate-900 tracking-tight break-all">
                                            {Number(totalClientBal).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-sm text-slate-500">HTG</span>
                                        </h3>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-500">Total Kliyan ki Enskri:</span>
                                        <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">{allUsers.length} Moun</span>
                                    </div>
                                </div>

                                <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                                    <div className="absolute top-0 right-0 p-6 opacity-5 text-emerald-600"><DollarSign size={80} /></div>
                                    <div className="relative z-10 mb-6">
                                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Pwofi Biznis Disponib</p>
                                        <h3 className="text-4xl font-bold text-emerald-700 tracking-tight break-all">
                                            {Number(bizProfitAvailable).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-sm text-emerald-600">HTG</span>
                                        </h3>
                                        <p className="text-[11px] text-emerald-700/80 mt-2 font-medium">
                                            Frè kolèkte: {Number(totalBiznisProfit).toLocaleString()} HTG
                                            {bizProfitWithdrawn > 0 && (
                                                <> · Retire: <span className="text-rose-600">-{Number(bizProfitWithdrawn).toLocaleString()} HTG</span></>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setBizWithdrawError(''); setShowBizWithdrawModal(true); }}
                                        className="mb-4 w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
                                    >
                                        <MinusCircle size={16} /> Retrè Pwofi Biznis
                                    </button>
                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                        <div className="bg-white/60 p-3 rounded-xl border border-emerald-200/50">
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase">Frè Ajan</p>
                                            <p className="font-bold text-emerald-800">{feesBreakdown.ajan.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/60 p-3 rounded-xl border border-emerald-200/50">
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase">Frè Antrepriz</p>
                                            <p className="font-bold text-emerald-800">{feesBreakdown.antrepriz.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/60 p-3 rounded-xl border border-emerald-200/50">
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase">Frè KYC</p>
                                            <p className="font-bold text-emerald-800">{feesBreakdown.kyc.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/60 p-3 rounded-xl border border-emerald-200/50">
                                            <p className="text-[10px] text-emerald-600 font-bold uppercase">Lòt (Dep/Ret/Tra/Kat)</p>
                                            <p className="font-bold text-emerald-800">{(feesBreakdown.depo + feesBreakdown.retre + feesBreakdown.transfe + feesBreakdown.kat).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden flex flex-col justify-between">
                                    <div className="absolute top-0 right-0 p-6 opacity-10 text-white"><CreditCard size={80} /></div>
                                    <div className="relative z-10 mb-6">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lajan Kap Woule Sou Kat Yo</p>
                                        <h3 className="text-4xl font-bold text-white tracking-tight break-all">
                                            {Number(totalCardBal).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-sm text-slate-400">HTG</span>
                                        </h3>
                                    </div>
                                    <div className="bg-white/10 p-4 rounded-xl border border-white/5 flex items-center justify-between mt-auto backdrop-blur-sm">
                                        <span className="text-xs font-medium text-slate-300">Kat Vityèl ki Kreye:</span>
                                        <span className="text-sm font-bold text-white">{allUsers.filter(u => u.is_card_activated).length}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-600 p-8 rounded-3xl shadow-sm mt-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div>
                                    <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider mb-2">GRAN TOTAL KI SIPOZE NAN BANK LA (Kliyan + Biznis)</p>
                                    <p className="text-sm text-white font-medium">Sa se sòm Kòb Wallet yo ak Pwofi disponib konpayi an.</p>
                                </div>
                                <p className="text-3xl font-bold text-white tracking-tight">
                                    {Number(totalClientBal + bizProfitAvailable).toLocaleString('en-US', { minimumFractionDigits: 2 })} HTG
                                </p>
                            </div>

                            {/* ISTORIK FRÈ AJAN — Chak fwa yon ajan aktive kont li oswa ogmante kapasite l,
                                frè a antre otomatikman nan Kès Global la (anwo a) EPI parèt isit kòm mesaj istorik. */}
                            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Istorik Frè Ajan (Kès Global)</h3>
                                        <p className="text-xs text-slate-500 mt-1">Chak aktivasyon oswa ogmantasyon kapasite ajan ajoute otomatikman nan pwofi biznis la anwo a.</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg">
                                        Total: {feesBreakdown.ajan.toLocaleString()} HTG
                                    </span>
                                </div>
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
                                    {agentFeeHistory.length === 0 ? (
                                        <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Pa gen okenn frè ajan anrejistre pou kounye a.</p>
                                    ) : (
                                        agentFeeHistory.map(item => (
                                            <div key={item.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                                                        <DollarSign size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{item.agentName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.created_at).toLocaleString('fr-HT')}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-600 shrink-0">+{Math.abs(Number(item.amount)).toLocaleString()} HTG</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* ISTORIK FRÈ ANTREPRIZ — Se pwofi HatexCard, li PA ale sou kont ajan
                                moun ki soumèt aplikasyon an. Kont ajan PRO yo bay otomatikman a se
                                yon kont vid (0 HTG), pa yon transfè kòb sòti nan frè 49,000 HTG la. */}
                            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Istorik Frè Antrepriz (Kès Global)</h3>
                                        <p className="text-xs text-slate-500 mt-1">Frè pasaj 49,000 HTG kont Antrepriz yo — se pwofi HatexCard, li pa antre sou kont ajan pèsonn.</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg">
                                        Total: {feesBreakdown.antrepriz.toLocaleString()} HTG
                                    </span>
                                </div>
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
                                    {enterpriseFeeHistory.length === 0 ? (
                                        <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Pa gen okenn frè Antrepriz anrejistre pou kounye a.</p>
                                    ) : (
                                        enterpriseFeeHistory.map(item => (
                                            <div key={item.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                                                        <Building2Icon size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{item.clientName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.created_at).toLocaleString('fr-HT')}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-600 shrink-0">+{Math.abs(Number(item.amount)).toLocaleString()} HTG</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* ISTORIK FRÈ KYC — 1150 HTG (kat + verifikasyon enkli) */}
                            <div className="bg-white border border-emerald-200 rounded-3xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/40">
                                    <div>
                                        <h3 className="text-lg font-bold text-emerald-900">Istorik Frè KYC (Kès Global)</h3>
                                        <p className="text-xs text-emerald-800/70 mt-1">Frè 1150 HTG (verifikasyon ID + kat vityèl enkli) — tout antre nan pwofi biznis la.</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase bg-emerald-600 text-white px-3 py-1.5 rounded-lg">
                                        Total: {feesBreakdown.kyc.toLocaleString()} HTG
                                    </span>
                                </div>
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
                                    {kycFeeHistory.length === 0 ? (
                                        <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Pa gen okenn frè KYC anrejistre pou kounye a.</p>
                                    ) : (
                                        kycFeeHistory.map(item => (
                                            <div key={item.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                                                        <ShieldCheck size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{item.clientName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.created_at).toLocaleString('fr-HT')}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-600 shrink-0">+{Math.abs(Number(item.amount)).toLocaleString()} HTG</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* ISTORIK FRÈ KAT AKTIVASYON — 520 HTG (ansyen modèl, anvan KYC 1150)
                                li a. Frè sa a te envizib nan Kès Global la anvan, kounye a li konte
                                epi li gen pwòp istorik li tou (menm modèl ak Ajan/Antrepriz). */}
                            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Istorik Frè Kat Aktivasyon (Kès Global)</h3>
                                        <p className="text-xs text-slate-500 mt-1">Frè 520 HTG chak fwa yon kliyan aktive kat vityèl li a — se pwofi HatexCard.</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1.5 rounded-lg">
                                        Total: {feesBreakdown.kat.toLocaleString()} HTG
                                    </span>
                                </div>
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
                                    {cardActivationFeeHistory.length === 0 ? (
                                        <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Pa gen okenn frè Kat anrejistre pou kounye a.</p>
                                    ) : (
                                        cardActivationFeeHistory.map(item => (
                                            <div key={item.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                                                        <CreditCard size={18} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{item.clientName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{item.description}</p>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.created_at).toLocaleString('fr-HT')}</p>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-600 shrink-0">+{Math.abs(Number(item.amount)).toLocaleString()} HTG</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* 🔗 ISTORIK KONPLÈ KÈS GLOBAL — fusyone TOUT sous frè yo (Depo, Retrè,
                                Transfè, Ajan, Antrepriz, Kat) nan YON SÈL lis kwonolojik pou Sipè
                                Admin ka verifye TOUT mouvman kòb biznis la fè, nan yon sèl kote,
                                san bezwen gade chak seksyon apa. */}
                            <div className="bg-white border-2 border-indigo-200 rounded-3xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-indigo-100 bg-indigo-50/50 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2"><Activity size={18}/> Istorik Konplè Kès Global</h3>
                                        <p className="text-xs text-indigo-700/70 mt-1">TOUT sous frè yo fusyone (Depo, Retrè, Transfè, Ajan, Antrepriz, Kat) — triye pa dat, pi resan an anlè.</p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase bg-indigo-600 text-white px-3 py-1.5 rounded-lg">
                                        Disponib: {Number(bizProfitAvailable).toLocaleString()} HTG
                                    </span>
                                </div>
                                <div className="max-h-[560px] overflow-y-auto divide-y divide-gray-100">
                                    {unifiedFeeHistory.length === 0 ? (
                                        <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Pa gen okenn mouvman frè anrejistre pou kounye a.</p>
                                    ) : (
                                        unifiedFeeHistory.map((item: any) => (
                                            <div key={`${item.kalite}-${item.id}`} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg shrink-0 ${
                                                        item.kalite === 'Ajan' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                                        item.kalite === 'Antrepriz' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                                                        item.kalite === 'Kat' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                                        item.kalite === 'KYC' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                        item.kalite === 'Depo' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                                        item.kalite === 'Retrè' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                        item.kalite === 'Retrè Bank' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                                        'bg-rose-50 text-rose-700 border border-rose-100'
                                                    }`}>{item.kalite}</span>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 truncate">{item.nonMoun || item.description}</p>
                                                        {item.nonMoun && <p className="text-xs text-slate-500 truncate">{item.description}</p>}
                                                        <p className="text-[10px] text-slate-400 mt-0.5">{new Date(item.created_at).toLocaleString('fr-HT')}</p>
                                                    </div>
                                                </div>
                                                <p className={`text-sm font-bold shrink-0 ${Number(item.amount) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {Number(item.amount) < 0 ? '' : '+'}{Number(item.amount).toLocaleString()} HTG
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : view === 'ekip' ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100">
                                        <UserPlus size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Anboche yon Anplwaye</h2>
                                        <p className="text-xs text-slate-500 font-medium mt-1">
                                            Chwazi depatman moun nan ap travay ladan. Li ap resevwa yon mesaj (san lyen) pou l konekte sou Dashboard li e kreye yon modpas espas travay ki izole nèt. "Sipè Admin" bay aksè TOTAL sou tout depatman anndan Espas Travay la (Sèvis Kliyan + Finans + Konfòmite + Jounal Odit).
                                        </p>
                                    </div>
                                </div>

                                <form onSubmit={jereAnplwaye} className="flex flex-col md:flex-row items-end gap-4">
                                    <div className="w-full flex-1">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Imèl Moun W Ap Anboche a</label>
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            <input 
                                                type="email" 
                                                placeholder="anplwaye@imel.com" 
                                                value={inviteEmail} 
                                                onChange={(e) => setInviteEmail(e.target.value)} 
                                                className="w-full bg-slate-50 border border-gray-200 py-3.5 pl-12 pr-4 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 transition-all text-slate-900" 
                                                required 
                                            />
                                        </div>
                                    </div>

                                    <div className="w-full md:w-64">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Chwazi Depatman</label>
                                        <select 
                                            value={inviteRole} 
                                            onChange={(e) => setInviteRole(e.target.value)} 
                                            className="w-full bg-slate-50 border border-gray-200 py-3.5 px-4 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all"
                                        >
                                            <option value="support">🎧 Sèvis Kliyan</option>
                                            <option value="compliance">🛡️ Konfòmite & Ajan</option>
                                            <option value="finance">💰 Finans (Kesye)</option>
                                            <option value="super_admin">👑 Sipè Admin</option>
                                        </select>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={processingId === 'invite_staff'} 
                                        className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all shadow-sm flex justify-center items-center gap-2 h-[50px] shrink-0"
                                    >
                                        {processingId === 'invite_staff' ? <Loader2 className="animate-spin w-4 h-4" /> : 'Voye Envitasyon an'}
                                    </button>
                                </form>
                            </div>

                            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 border-b border-gray-100 pb-4">Anplwaye ki anrejistre yo ({staffMembers.length})</h3>
                                
                                <div className="space-y-4">
                                    {staffMembers.length === 0 ? (
                                        <div className="text-center py-10 text-slate-400 text-sm font-bold">Pa gen okenn anplwaye anrejistre ankò.</div>
                                    ) : (
                                        staffMembers.map(staff => (
                                            <div key={staff.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-gray-100 bg-slate-50 hover:bg-white hover:shadow-sm transition-all shadow-sm">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm ${
                                                        staff.role === 'super_admin' ? 'bg-slate-900' :
                                                        staff.role === 'finance' ? 'bg-emerald-600' :
                                                        staff.role === 'compliance' ? 'bg-blue-600' : 'bg-indigo-600'
                                                    }`}>
                                                        {staff.role === 'super_admin' ? <ShieldCheck size={20} /> :
                                                         staff.role === 'finance' ? <DollarSign size={20} /> :
                                                         staff.role === 'compliance' ? <UserCheckIcon size={20} /> : <Users size={20} />}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900">{staff.full_name || 'San Non'}</h4>
                                                        <p className="text-xs text-slate-500">{staff.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 border-t sm:border-none border-gray-200 pt-3 sm:pt-0">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${
                                                        staff.role === 'super_admin' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                                                        staff.role === 'finance' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        staff.role === 'compliance' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    }`}>
                                                        {staff.role.replace('_', ' ')}
                                                    </span>
                                                    {staff.status === 'pending' && <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold uppercase">Ap tann modpas</span>}
                                                    <button 
                                                        onClick={() => revokeAnplwaye(staff.id, staff.email)}
                                                        disabled={processingId === `revoke_${staff.id}`}
                                                        className="text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors border border-rose-100 ml-2"
                                                        title="Revoke aksè sa"
                                                    >
                                                        {processingId === `revoke_${staff.id}` ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
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
                                            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mt-2 md:mt-0">
                                                <button
                                                    type="button"
                                                    onClick={() => { setDossierUserId(user.id); setView('dosye'); }}
                                                    className="w-full md:w-auto bg-indigo-50 border border-indigo-200 text-indigo-700 px-5 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-100 transition-all shadow-sm flex items-center justify-center gap-1.5"
                                                >
                                                    <FileText size={14} /> Dosye
                                                </button>
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
                    ) : view === 'dosye' ? (
                        <AdminClientDossier initialUserId={dossierUserId} />
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
                                                {user.kyc_doc_type && <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 font-bold uppercase">{user.kyc_doc_type}</span>}
                                                {user.kyc_face_match_score != null && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 font-bold">Figi: {Number(user.kyc_face_match_score).toFixed(1)}%</span>}
                                                {user.kyc_front && <button onClick={() => handleOpenKycDocument(user.id, 'front', user.kyc_front)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Fasad Devan</button>}
                                                {user.kyc_back && <button onClick={() => handleOpenKycDocument(user.id, 'back', user.kyc_back)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Fasad Dèyè</button>}
                                                {user.kyc_selfie && <button onClick={() => handleOpenKycDocument(user.id, 'selfie', user.kyc_selfie)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Selfie</button>}
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
                                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">ID Kliyan: {agent.user_id}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md font-bold uppercase tracking-wider border border-indigo-100 mb-2">Plan: {agent.tier}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Depo Fèt: {Number(agent.metadata?.initial_deposit || 0).toLocaleString()} HTG</span>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Dokiman yo soumèt</p>
                                            <div className="flex flex-wrap gap-3">
                                                {agent.id_doc_url && <button onClick={() => handleOpenDocument(agent.id_doc_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Pyès Idantite</button>}
                                                {agent.address_doc_url && <button onClick={() => handleOpenDocument(agent.address_doc_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Prèv Adrès</button>}
                                                {agent.location_photo_url && <button onClick={() => handleOpenDocument(agent.location_photo_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Foto Lokal</button>}
                                                {agent.selfie_with_id_url && <button onClick={() => handleOpenDocument(agent.selfie_with_id_url)} className="text-[10px] bg-amber-50 px-4 py-2.5 rounded-lg text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Selfie + ID</button>}
                                                {agent.patente_url && <button onClick={() => handleOpenDocument(agent.patente_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Patant</button>}
                                                {agent.cif_url && <button onClick={() => handleOpenDocument(agent.cif_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> CIF</button>}
                                                {agent.criminal_record_url && <button onClick={() => handleOpenDocument(agent.criminal_record_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Kazye Jidisyè</button>}
                                                {agent.bank_statement_url && <button onClick={() => handleOpenDocument(agent.bank_statement_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Relve Bankè</button>}
                                                {agent.lease_doc_url && <button onClick={() => handleOpenDocument(agent.lease_doc_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Kontra Lokal</button>}
                                            </div>
                                        </div>

                                        <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 border border-gray-100 rounded-2xl p-4">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Dat Ekspirasyon ID</p>
                                                <p className="text-sm font-bold text-slate-800">{agent.id_expiry_date ? new Date(agent.id_expiry_date).toLocaleDateString('fr-HT') : '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Dat Prèv Adrès</p>
                                                <p className="text-sm font-bold text-slate-800">{agent.address_proof_date ? new Date(agent.address_proof_date).toLocaleDateString('fr-HT') : '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Referans</p>
                                                <p className="text-sm font-bold text-slate-800">{agent.reference_name || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Telefòn Referans</p>
                                                <p className="text-sm font-bold text-slate-800">{agent.reference_phone || '—'}</p>
                                            </div>
                                            {agent.tier === 'premium' && (
                                                <div className="sm:col-span-2">
                                                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border ${agent.confidentiality_accepted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                        {agent.confidentiality_accepted ? '✓ Angajman Konfidansyalite Siyen' : '✗ Angajman Konfidansyalite Poko Siyen'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-2 flex flex-col md:flex-row gap-4 items-start md:items-end border-t border-gray-100 pt-6">
                                            <div className="w-full md:flex-1">
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Si w ap rejte l, ekri rezon an la a (Lajan l ap retounen):</label>
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
                    ) : view === 'antrepriz' ? (
                        pendingEnterprises.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300 text-slate-500 text-sm font-bold uppercase tracking-wider">
                                <Building2Icon size={48} className="mx-auto mb-4 text-slate-300" />
                                Pa gen okenn aplikasyon Antrepriz kap tann
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {pendingEnterprises.map((app) => (
                                    <div key={app.id} className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm relative overflow-hidden flex flex-col gap-6 transition-all hover:shadow-md">

                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 border border-indigo-100"><Building2Icon size={24} /></div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">{app.profiles?.full_name || 'San Non'}</h3>
                                                    <p className="text-xs text-slate-500 mt-1">{app.profiles?.email}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1 font-mono">ID Kliyan: {app.user_id}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-md font-bold uppercase tracking-wider border border-indigo-100 mb-2">{app.business_name || 'Biznis San Non'}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Frè Peye: {Number(app.metadata?.fee_paid || 0).toLocaleString()} HTG</span>
                                            </div>
                                        </div>

                                        <div className="grid sm:grid-cols-2 gap-4 bg-slate-50 border border-gray-100 rounded-2xl p-4">
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Nimewo Anrejistreman</p>
                                                <p className="text-sm font-bold text-slate-800">{app.business_reg_number || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Aktivite Biznis</p>
                                                <p className="text-sm font-bold text-slate-800">{app.business_activity || '—'}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Dokiman yo soumèt</p>
                                            <div className="flex flex-wrap gap-3">
                                                {app.patente_url && <button onClick={() => handleOpenDocument(app.patente_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Patant</button>}
                                                {app.cif_url && <button onClick={() => handleOpenDocument(app.cif_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> CIF</button>}
                                                {app.business_registration_url && <button onClick={() => handleOpenDocument(app.business_registration_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Anrejistreman</button>}
                                                {app.bank_statement_url && <button onClick={() => handleOpenDocument(app.bank_statement_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Relve Bankè</button>}
                                                {app.lease_doc_url && <button onClick={() => handleOpenDocument(app.lease_doc_url)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Kontra Lokal</button>}
                                                {app.legal_rep_id_url && <button onClick={() => handleOpenDocument(app.legal_rep_id_url)} className="text-[10px] bg-amber-50 px-4 py-2.5 rounded-lg text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> ID Reprezantan</button>}
                                            </div>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border ${app.confidentiality_accepted ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                {app.confidentiality_accepted ? '✓ Angajman Konfidansyalite/Anti-Fwod Siyen' : '✗ Angajman Poko Siyen'}
                                            </span>
                                        </div>

                                        <div className="mt-2 flex flex-col md:flex-row gap-4 items-start md:items-end border-t border-gray-100 pt-6">
                                            <div className="w-full md:flex-1">
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Si w ap rejte l, ekri rezon an la a (Frè a ap ranbouse):</label>
                                                <input
                                                    type="text"
                                                    placeholder="Egz: Dokiman patant lan pa klè..."
                                                    value={enterpriseRejectionReason[app.id] || ''}
                                                    onChange={(e) => setEnterpriseRejectionReason({...enterpriseRejectionReason, [app.id]: e.target.value})}
                                                    className="w-full bg-slate-50 border border-gray-200 py-3 px-4 rounded-xl text-sm outline-none focus:border-rose-500 transition-colors"
                                                />
                                            </div>
                                            <div className="flex gap-3 w-full md:w-auto shrink-0">
                                                <button onClick={() => jereAntrepriz(app.id, app.user_id, app.profiles?.full_name, app.profiles?.email, 'rejected')} disabled={processingId === app.id} className="flex-1 md:flex-none bg-white border border-rose-200 text-rose-600 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center gap-2">
                                                    <XCircle size={16} /> Rejte (Ranbouse l)
                                                </button>
                                                <button onClick={() => jereAntrepriz(app.id, app.user_id, app.profiles?.full_name, app.profiles?.email, 'approved')} disabled={processingId === app.id} className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-2">
                                                    {processingId === app.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Apwouve</>}
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
                    ) : view === 'sekirite' ? (
                        <div className="space-y-6">
                            <AdminMfaSettings supabase={supabase} />
                            <AdminAuditLog />
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
                                                {isDepo && item.proof_img_1 && (<button onClick={() => handleOpenDocument(item.proof_img_1)} className="w-full bg-slate-50 text-slate-700 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-gray-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><EyeOff size={14}/> Gade Foto Prèv 1</button>)}
                                                {isDepo && item.proof_img_2 && (<button onClick={() => handleOpenDocument(item.proof_img_2)} className="w-full bg-slate-50 text-slate-700 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-wider border border-gray-200 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"><EyeOff size={14}/> Gade Foto Prèv 2</button>)}
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

            {showBizWithdrawModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !bizWithdrawLoading && setShowBizWithdrawModal(false)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><MinusCircle size={22} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Retrè Pwofi Biznis</h3>
                                <p className="text-xs text-slate-500">Lè ou retire lajan nan bank la, soustrè li isit pou kontwòl rete kòrèk.</p>
                            </div>
                        </div>

                        <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-4">
                            Disponib: {Number(bizProfitAvailable).toLocaleString('en-US', { minimumFractionDigits: 2 })} HTG
                        </p>

                        <form onSubmit={handleBizProfitWithdraw} className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Montan (HTG)</label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    max={bizProfitAvailable}
                                    value={bizWithdrawAmount}
                                    onChange={(e) => setBizWithdrawAmount(e.target.value)}
                                    placeholder="eg. 5000"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Nòt (opsyonèl)</label>
                                <input
                                    type="text"
                                    value={bizWithdrawNote}
                                    onChange={(e) => setBizWithdrawNote(e.target.value)}
                                    placeholder="eg. Retrè bank Moncash 06/07/2026"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block flex items-center gap-1.5">
                                    <KeyRound size={14} /> Modpas Admin (konfimasyon)
                                </label>
                                <input
                                    type="password"
                                    value={bizWithdrawPassword}
                                    onChange={(e) => setBizWithdrawPassword(e.target.value)}
                                    placeholder="Menm modpas Pòtay Admin lan"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            {bizWithdrawError && (
                                <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">{bizWithdrawError}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    disabled={bizWithdrawLoading}
                                    onClick={() => setShowBizWithdrawModal(false)}
                                    className="flex-1 border border-gray-200 text-slate-600 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Anile
                                </button>
                                <button
                                    type="submit"
                                    disabled={bizWithdrawLoading || bizProfitAvailable <= 0}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {bizWithdrawLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    Konfime Retrè
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}