"use client";

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Send, UserX, ShieldCheck, AlertTriangle, Search, Lock, DollarSign, EyeOff, Loader2, CheckCircle2, FileText, XCircle, Users, UserPlus, UserMinus, UserCheck as UserCheckIcon, Activity, KeyRound, Mail, Bell } from 'lucide-react';
import AdminMfaSettings from './AdminMfaSettings';
import AdminAuditLog from './AdminAuditLog';
import AdminClientDossier from './AdminClientDossier';
import AdminFeesPanel from './AdminFeesPanel';
import AdminPayoutsPanel from './AdminPayoutsPanel';
import ContactInboxPanel from './ContactInboxPanel';
import KycSurveyPanel from '@/components/KycSurveyPanel';

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
    const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [staffMembers, setStaffMembers] = useState<any[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('support');
    const [searchQuery, setSearchQuery] = useState('');
    const [anonsText, setAnonsText] = useState('');
    const [anonsActive, setAnonsActive] = useState(true);
    const [notifTitle, setNotifTitle] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [notifTargetEmail, setNotifTargetEmail] = useState('');
    const [view, setView] = useState<'dashboard' | 'anons' | 'kliyan' | 'dosye' | 'sispandi' | 'kyc' | 'kyc-survey' | 'ekip' | 'sekirite' | 'frais' | 'payout' | 'mesaj'>('dashboard');
    const [dossierUserId, setDossierUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [flushConfirmLoading, setFlushConfirmLoading] = useState(false);
    const [gateway, setGateway] = useState({
        platform_fees: 0,
        plan_fees: 0,
        paid_count: 0,
        paid_plans: 0,
        recent: [] as any[],
    });

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
    // FONKSYON RALE DONE — sèlman via API sèvè (service_role)
    // ====================================================
    const raleDone = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/dashboard-data', { credentials: 'include' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Pa t kapab chaje done admin nan baz la.');
            }

            setAllUsers(data.users || []);
            setSuspendedAccounts(data.suspendedAccounts || []);
            setPendingKyc(data.pendingKyc || []);
            setStaffMembers(data.staffMembers || []);

            if (data.announcement) {
                setAnonsText(data.announcement.text || '');
                setAnonsActive(data.announcement.active !== false);
            }

            if (data.gateway) {
                setGateway({
                    platform_fees: Number(data.gateway.platform_fees || 0),
                    plan_fees: Number(data.gateway.plan_fees || 0),
                    paid_count: Number(data.gateway.paid_count || 0),
                    paid_plans: Number(data.gateway.paid_plans || 0),
                    recent: data.gateway.recent || [],
                });
            }

        } catch (e: any) {
             console.error("Erè rale done:", e);
             alert(e.message || 'Erè chaje done admin.');
        } finally {
            setLoading(false);
        }
    };

    const adminOps = async (payload: Record<string, unknown>) => {
        const res = await fetch('/api/admin/ops', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) throw new Error(data.error || 'Aksyon echwe.');
        return data;
    };

    const handleOpenKycDocument = async (
      userId: string,
      doc: 'front' | 'back' | 'selfie' | 'business' | 'nif' | 'tax' | 'establishment' | 'address' | 'articles',
      legacyValue?: string | null
    ) => {
        if (!legacyValue && !userId) {
          alert('Pa gen dokiman sa a!');
          return;
        }
        try {
            // redirect=1 louvri signed URL dirèkteman (bucket prive kyc-documents-v2)
            const openUrl = `/api/kyc/document?userId=${encodeURIComponent(userId)}&doc=${doc}&redirect=1`;
            window.open(openUrl, '_blank', 'noopener,noreferrer');
        } catch (e: any) {
            alert(e.message || 'Pa t kapab louvri dokiman an.');
        }
    };

    const voyeEmailKliyan = async (email: string, non: string, mesaj: string, subject: string) => {
        if (!email) return;
        try { await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email.trim(), subject, non, mesaj }), }); } catch (error) {}
    };

    const deblokeKont = async (id: string, email: string) => {
        if (!confirm(`Èske w vle aktive kont sa a ankò? (${email})`)) return;
        setProcessingId(id);
        try {
            await adminOps({ action: 'unsuspend_account', user_id: id, target_email: email });
            alert(`Kont ${email} lan aktive!`);
            raleDone();
        } catch (err: any) {
            alert("Erè: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const sispannKont = async (id: string, email: string) => {
        if (!confirm(`Èske w sèten ou vle SISPANN kont sa a? (${email})`)) return;
        setProcessingId(id);
        try {
            await adminOps({ action: 'suspend_account', user_id: id, target_email: email });
            alert(`Kont ${email} lan sispandi!`);
            raleDone();
        } catch (err: any) {
            alert("Erè: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const voyeKycSurvey = async (userId: string, email: string, force = false) => {
        setProcessingId(`survey-${userId}`);
        try {
            let res = await fetch('/api/admin/kyc-survey/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, force }),
            });
            let data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Voye echwe.');
            if (data.already_recent && !force) {
                const ok = confirm('Email deja voye nan 24h. Renvoy ankò?');
                if (!ok) return;
                res = await fetch('/api/admin/kyc-survey/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, force: true }),
                });
                data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Voye echwe.');
            }
            alert(data.message || `Kesyonman voye bay ${email}`);
        } catch (err: any) {
            alert('Erè: ' + (err.message || 'Pa t kapab voye.'));
        } finally {
            setProcessingId(null);
        }
    };

    const reyinisyalizeKont = async (id: string, email: string, fullName: string) => {
        if (!confirm(
            `REYINISYALIZE kont ${fullName || email}?\n\n` +
            `• Wallet + kat → 0 HTG\n` +
            `• Kont ajan / antrepriz → siprime\n` +
            `• KYC → rete (pa bezwen refè)\n\n` +
            `Aksyon sa a pa ka anile fasil.`
        )) return;
        const password = prompt('Antre modpas admin pou konfime:');
        if (!password) return;
        setProcessingId(`reset-${id}`);
        try {
            const res = await fetch('/api/admin/reset-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: id, password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Echèk reyinisyalizasyon.');
            alert(data.message || 'Kont reyinisyalize.');
            raleDone();
        } catch (err: any) {
            alert(err.message || 'Erè.');
        } finally {
            setProcessingId(null);
        }
    };

    const jereKyc = async (id: string, full_name: string, email: string, aksyon: 'approved' | 'rejected') => {
        let rezonReje = "";
        if (aksyon === 'rejected') { const rep = prompt("Tanpri ekri rezon ki fè w rejte dokiman sa yo:"); if (!rep) return; rezonReje = rep; } 
        else { if (!confirm(`Èske w sèten ou vle APWOUVE KYC pou ${full_name}? Si li te peye abonnman an, kapasite jou a ap aktive.`)) return; }
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
                ? `Felisitasyon ${full_name}! Dokiman w yo apwouve. Si ou te peye abonnman Kapasite oswa Premyòm, kapasite jou ou ap ogmante.`
                : `Bonjou ${full_name}. \n\nMalerezman, nou pa ka aksepte dokiman KYC ou te soumèt yo.\n\nREZON: ${rezonReje}`;
            if (aksyon !== 'approved' || data.fresh_approval !== false) {
                await voyeEmailKliyan(email, full_name, mesajE, `VERIFIKASYON ID ${aksyon === 'approved' ? 'APWOUVE' : 'REJTE'}`);
            }
            if (aksyon === 'approved') {
                alert(data.message || 'KYC apwouve.');
            } else {
                alert('KYC rejte avèk siksè!');
            }
            raleDone();
        } catch (err: any) { alert("Erè: " + err.message); } finally { setProcessingId(null); }
    };

    const jereAnplwaye = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return alert("Ou dwe mete yon imèl.");

        setProcessingId('invite_staff');
        try {
            await adminOps({
                action: 'invite_staff',
                email: inviteEmail.trim().toLowerCase(),
                role: inviteRole,
            });

            const roleNames: Record<string, string> = {
                'super_admin': 'Sipè Admin (CEO)',
                'finance': 'Depatman Finans',
                'compliance': 'Depatman Konfòmite (KYC)',
                'support': 'Sèvis Kliyan (Support)'
            };
            const staffName = allUsers.find(u => u.email?.toLowerCase() === inviteEmail.trim().toLowerCase())?.full_name || 'Anplwaye';
            
            const msg = `Felisitasyon ${staffName}!\n\nAdministrasyon Hatexcard envite w vin travay kòm anplwaye nan depatman: "${roleNames[inviteRole]}".\n\nPou kòmanse:\n1) Konekte sou kont kliyan ou nòmal (menm imel sa a) sou Dashboard Hatexcard.\n2) Louvri meni an, klike sou bouton "Aksè Espas Travay".\n3) Kreye yon modpas fò espesyal pou espas travay ou (li apa de modpas kont kliyan ou a).\n\nPou rezon sekirite, pa gen okenn lyen nan mesaj sa a — sèvi ak Dashboard ou dirèkteman.`;
            
            await voyeEmailKliyan(inviteEmail, staffName, msg, "OU VIN YON ANPLWAYE HATEXCARD");

            alert(`Envitasyon an ale! ${staffName} ap resevwa yon mesaj imèl ki di l konekte sou Dashboard li epi klike sou bouton "Aksè Espas Travay".`);
            setInviteEmail('');
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const revokeAnplwaye = async (id: string, email: string) => {
        if (!confirm(`Èske w sèten ou vle revoke aksè anplwaye sa a (${email}) nèt?`)) return;
        setProcessingId(`revoke_${id}`);
        try {
            await adminOps({ action: 'revoke_staff', id, target_email: email });
            alert(`Aksè a revoke nèt pou ${email}.`);
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const handleSaveAnons = async (e: React.FormEvent) => {
        e.preventDefault();
        setProcessingId('saving_anons');
        try {
            await adminOps({ action: 'update_announcement', text: anonsText, active: anonsActive });
            alert("Notifikasyon an chanje avèk siksè e li rive sou tout kliyan yo!");
            raleDone();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const handleSendNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!notifTitle.trim()) return alert('Antre yon tit pou notifikasyon an.');
        if (!window.confirm(
            notifTargetEmail.trim()
                ? `Voye notifikasyon sa a bay ${notifTargetEmail.trim()}?`
                : 'Voye notifikasyon sa a bay TOUT kliyan yo?'
        )) return;
        setProcessingId('sending_notification');
        try {
            const data: any = await adminOps({
                action: 'broadcast_notification',
                title: notifTitle,
                body: notifBody,
                target_email: notifTargetEmail.trim(),
            });
            alert(`Notifikasyon an voye bay ${data.count ?? 'kliyan'} kliyan! Li ap parèt nan klòch "Notifikasyon" yo.`);
            setNotifTitle('');
            setNotifBody('');
            setNotifTargetEmail('');
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
                    <button onClick={() => setView('mesaj')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'mesaj' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        <Mail size={14}/> Imèl Kontak
                    </button>
                    
                    <button onClick={() => setView('ekip')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'ekip' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        <Users size={14}/> Jere Ekip
                    </button>

                    <button onClick={() => setView('kliyan')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'kliyan' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Kliyan ({allUsers.length})</button>
                    <button onClick={() => { setDossierUserId(null); setView('dosye'); }} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${view === 'dosye' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>
                        <FileText size={14} /> Dosye
                    </button>
                    <button onClick={() => setView('kyc')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'kyc' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>KYC ({pendingKyc.length})</button>
                    <button onClick={() => setView('kyc-survey')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'kyc-survey' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Kesyonman KYC</button>
                    <button onClick={() => setView('anons')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'anons' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Anons</button>
                    <button onClick={() => setView('frais')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'frais' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Frè</button>
                    <button onClick={() => setView('payout')} className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${view === 'payout' ? 'bg-indigo-600 shadow-sm text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}>Payout</button>
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
                                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pasrèl & Aktivite</h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5 mt-1"><ShieldCheck size={14} className="text-emerald-500" /> Kontwòl frè, KYC, ak abonnman</p>
                                </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setView('mesaj')}
                              className="w-full text-left bg-blue-50 border border-blue-100 hover:border-blue-300 rounded-2xl p-5 flex items-center justify-between gap-4 transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="p-3 bg-white rounded-xl text-[#1d4ed8] border border-blue-100"><Mail size={22} /></span>
                                <div>
                                  <p className="font-bold text-slate-900">Imèl Kontak</p>
                                  <p className="text-xs text-slate-500 mt-0.5">support@ / business@ / contact@ — li epi reponn isit la</p>
                                </div>
                              </div>
                              <span className="text-xs font-bold uppercase tracking-wider text-[#1d4ed8]">Louvri →</span>
                            </button>

                            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <p className="text-sm font-bold text-amber-900 flex items-center gap-2">
                                        <Mail size={16} /> Renouvle konfimasyon enskripsyon
                                    </p>
                                    <p className="text-xs text-amber-800/80 mt-1">
                                        Voye imèl konfimasyon (Resend) bay tout kont ki poko aktive imèl yo.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    disabled={flushConfirmLoading}
                                    onClick={async () => {
                                        if (!confirm('Voye nouvo imèl konfimasyon bay TOUT itilizatè ki poko konfime? Sa ka pran kèk minit.')) return;
                                        setFlushConfirmLoading(true);
                                        try {
                                            const res = await fetch('/api/admin/resend-confirmations', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({}),
                                            });
                                            const json = await res.json().catch(() => ({}));
                                            if (!res.ok || !json.success) {
                                                alert(json.message || 'Echwe.');
                                                return;
                                            }
                                            alert(`Fini: ${json.sent || 0} voye, ${json.failed || 0} echwe (sou ${json.pending_count || 0} ki te an atant).`);
                                        } catch {
                                            alert('Koneksyon echwe.');
                                        } finally {
                                            setFlushConfirmLoading(false);
                                        }
                                    }}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-60 shrink-0"
                                >
                                    {flushConfirmLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    Bat tout konfimasyon bloke
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kliyan enskri</p>
                                    <h3 className="text-4xl font-bold text-slate-900 tracking-tight">{allUsers.length}</h3>
                                    <p className="text-xs text-slate-500 mt-3">KYC an atant: {pendingKyc.length}</p>
                                </div>
                                <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 shadow-sm">
                                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Frè pasrèl kolèkte</p>
                                    <h3 className="text-4xl font-bold text-emerald-700 tracking-tight break-all">
                                        {Number(gateway.platform_fees).toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-sm">HTG</span>
                                    </h3>
                                    <p className="text-xs text-emerald-800/80 mt-3">Abonnman: {Number(gateway.plan_fees).toLocaleString()} HTG · {gateway.paid_count} peman peye</p>
                                </div>
                                <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl text-white">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Plan peye aktif</p>
                                    <h3 className="text-4xl font-bold tracking-tight">{gateway.paid_plans}</h3>
                                    <p className="text-xs text-slate-400 mt-3">Kapasite / Premyòm ki peye e aktif</p>
                                    <button type="button" onClick={() => setView('frais')} className="mt-4 w-full bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider">Jere frè ak kota</button>
                                </div>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                                <div className="p-6 border-b border-gray-100">
                                    <h3 className="text-lg font-bold text-slate-900">Dènye peman pasrèl</h3>
                                    <p className="text-xs text-slate-500 mt-1">Frè HatexCard ak abonnman ki deja peye sou MonCash.</p>
                                </div>
                                <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
                                    {gateway.recent.length === 0 ? (
                                        <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Pa gen peman peye pou kounye a.</p>
                                    ) : (
                                        gateway.recent.map((item: any) => (
                                            <div key={item.id} className="p-4 sm:px-6 flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{item.merchantName}</p>
                                                    <p className="text-xs text-slate-500 truncate">{item.purpose === 'plan_fee' ? 'Abonnman' : 'Frè pasrèl'} · {item.description || item.email}</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">{item.created_at ? new Date(item.created_at).toLocaleString('fr-HT') : ''}</p>
                                                </div>
                                                <p className="text-sm font-bold text-emerald-600 shrink-0">+{Math.abs(Number(item.amount)).toLocaleString()} HTG</p>
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
                                            <option value="compliance">🛡️ Konfòmite (KYC)</option>
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
                                                {(user.kyc_status !== 'approved' && user.kyc_status !== 'pending') && (
                                                    <button
                                                        type="button"
                                                        onClick={() => voyeKycSurvey(user.id, user.email)}
                                                        disabled={processingId === `survey-${user.id}`}
                                                        className="w-full md:w-auto bg-violet-50 border border-violet-200 text-violet-800 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-violet-100 transition-all shadow-sm flex items-center justify-center gap-1.5"
                                                    >
                                                        {processingId === `survey-${user.id}` ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                                                        Kesyonman
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => reyinisyalizeKont(user.id, user.email, user.full_name)}
                                                    disabled={processingId === `reset-${user.id}`}
                                                    className="w-full md:w-auto bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-amber-100 transition-all shadow-sm"
                                                >
                                                    {processingId === `reset-${user.id}` ? '...' : 'Reset 0'}
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
                        <>
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
                        <div className="bg-white p-8 rounded-3xl border border-indigo-200 mb-8 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Bell size={24} /></span>
                                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Voye Notifikasyon nan klòch kliyan yo</h2>
                            </div>
                            <p className="text-xs text-slate-500 mb-6">Mesaj sa a ap parèt dirèkteman nan pati « Notifikasyon » (klòch la) chak kliyan — pa sèlman sou paj dakèy la.</p>
                            <form onSubmit={handleSendNotification} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Tit notifikasyon an:</label>
                                    <input value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} placeholder="Pa egzanp: Nouvèl fason pou peye!" className="w-full bg-slate-50 border border-gray-200 px-5 py-4 rounded-2xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium text-sm text-slate-900 placeholder:text-slate-400" required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Detay (opsyonèl):</label>
                                    <textarea value={notifBody} onChange={(e) => setNotifBody(e.target.value)} placeholder="Ekri mesaj konplè kliyan an ap li nan notifikasyon an..." className="w-full bg-slate-50 border border-gray-200 p-5 rounded-2xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium text-sm min-h-[110px] text-slate-900 placeholder:text-slate-400 resize-none" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-wider ml-1">Voye bay (kite vid pou tout kliyan):</label>
                                    <input value={notifTargetEmail} onChange={(e) => setNotifTargetEmail(e.target.value)} type="email" placeholder="imèl yon kliyan espesifik (opsyonèl)" className="w-full bg-slate-50 border border-gray-200 px-5 py-4 rounded-2xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-medium text-sm text-slate-900 placeholder:text-slate-400" />
                                </div>
                                <button type="submit" disabled={processingId === 'sending_notification'} className="w-full bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-white shadow-sm flex items-center justify-center gap-2">
                                    {processingId === 'sending_notification' ? <Loader2 size={18} className="animate-spin" /> : "Voye Notifikasyon an"}
                                </button>
                            </form>
                        </div>
                        </>
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
                                                {user.account_type && <span className="text-[10px] bg-slate-50 text-slate-700 px-2 py-1 rounded border border-gray-200 font-bold uppercase">{user.account_type}</span>}
                                                {user.kyc_face_match_score != null && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100 font-bold">Figi: {Number(user.kyc_face_match_score).toFixed(1)}%</span>}
                                                {user.needs_manual_review && <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-1 rounded border border-amber-200 font-bold uppercase">Revizyon imen</span>}
                                                {user.account_type === 'business' && (
                                                  <div className="w-full text-left mt-3 bg-slate-50 border border-gray-100 rounded-xl p-3 space-y-1">
                                                    {user.service_description && <p className="text-[11px] text-slate-700"><span className="font-bold">Sèvis:</span> {user.service_description}</p>}
                                                    {user.business_nif && <p className="text-[11px] text-slate-700"><span className="font-bold">NIF:</span> {user.business_nif}</p>}
                                                    {user.business_rccm && <p className="text-[11px] text-slate-700"><span className="font-bold">RCCM:</span> {user.business_rccm}</p>}
                                                    <p className="text-[11px] text-slate-700"><span className="font-bold">Pati 1 WA/MC:</span> {user.party1_whatsapp || '—'} / {user.party1_moncash || '—'}</p>
                                                    <p className="text-[11px] text-slate-700"><span className="font-bold">Pati 2:</span> {user.party2_full_name || '—'} ({user.party2_role || '—'}) · WA {user.party2_whatsapp || '—'} · MC {user.party2_moncash || '—'}</p>
                                                  </div>
                                                )}
                                                {user.kyc_front && <button onClick={() => handleOpenKycDocument(user.id, 'front', user.kyc_front)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Fasad Devan</button>}
                                                {user.kyc_back && <button onClick={() => handleOpenKycDocument(user.id, 'back', user.kyc_back)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Fasad Dèyè</button>}
                                                {user.kyc_selfie && <button onClick={() => handleOpenKycDocument(user.id, 'selfie', user.kyc_selfie)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Selfie</button>}
                                                {user.business_registration && <button onClick={() => handleOpenKycDocument(user.id, 'business', user.business_registration)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Patant/RCCM</button>}
                                                {user.business_nif_doc && <button onClick={() => handleOpenKycDocument(user.id, 'nif', user.business_nif_doc)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> NIF</button>}
                                                {user.tax_clearance && <button onClick={() => handleOpenKycDocument(user.id, 'tax', user.tax_clearance)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Kitan</button>}
                                                {user.establishment_photo && <button onClick={() => handleOpenKycDocument(user.id, 'establishment', user.establishment_photo)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Lokal</button>}
                                                {user.proof_of_address && <button onClick={() => handleOpenKycDocument(user.id, 'address', user.proof_of_address)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Adrès</button>}
                                                {user.articles && <button onClick={() => handleOpenKycDocument(user.id, 'articles', user.articles)} className="text-[10px] bg-slate-50 px-4 py-2.5 rounded-lg text-slate-700 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all font-bold tracking-wider uppercase flex items-center gap-1.5"><EyeOff size={14}/> Statu</button>}
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
                    ) : view === 'kyc-survey' ? (
                        <KycSurveyPanel mode="admin" />
                    ) : view === 'frais' ? (
                        <AdminFeesPanel />
                    ) : view === 'payout' ? (
                        <AdminPayoutsPanel />
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
                    ) : view === 'mesaj' ? (
                        <ContactInboxPanel />
                    ) : view === 'sekirite' ? (
                        <div className="space-y-6">
                            <AdminMfaSettings supabase={supabase} />
                            <AdminAuditLog />
                        </div>
                    ) : null}
                </div>
            </div>

        </div>
    );
}
