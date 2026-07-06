"use client";

import React, { useEffect, useState, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { 
    ShieldCheck, DollarSign, UserCheck as UserCheckIcon, Users, 
    Search, Loader2, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, 
    XCircle, AlertTriangle, Store, EyeOff, LogOut, MessageSquare, Clock, Send, Building2,
    Crown, MessageCircle, Activity, Radio
} from 'lucide-react';
import { checkBalanceCap } from '@/lib/security/spending-limits';

export default function WorkspacePage() {
    const router = useRouter();
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const [staffProfile, setStaffProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Done pou divès depatman yo
    const [users, setUsers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [deposits, setDeposits] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);
    const [pendingAgents, setPendingAgents] = useState<any[]>([]);
    const [pendingEnterprises, setPendingEnterprises] = useState<any[]>([]);
    const [enterpriseRejectionReason, setEnterpriseRejectionReason] = useState<{ [key: string]: string }>({});
    
    // Done pou Support (Tchat)
    const [tickets, setTickets] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [agentRejectionReason, setAgentRejectionReason] = useState<{ [key: string]: string }>({});
    const [montanModifye, setMontanModifye] = useState<{ [key: string]: number }>({});

    // Views pou anplwaye yo (Support gen 'clients' oswa 'tickets')
    const [activeTab, setActiveTab] = useState('main');

    // ==========================================
    // ETA POU DEPATMAN (Sipè Admin gen aksè total)
    // ==========================================
    const [activeDept, setActiveDept] = useState<'support' | 'finance' | 'compliance' | 'team' | 'activity'>('support');

    // ==========================================
    // ETA POU CHAT EKIP LA (Kominikasyon Ant Anplwaye)
    // ==========================================
    const [teamMessages, setTeamMessages] = useState<any[]>([]);
    const [teamMessageInput, setTeamMessageInput] = useState('');
    const [sendingTeamMessage, setSendingTeamMessage] = useState(false);
    const teamMessagesEndRef = useRef<HTMLDivElement>(null);

    // ==========================================
    // ETA POU JOUNAL ODIT (Sipè Admin sèlman)
    // ==========================================
    const [activityLog, setActivityLog] = useState<any[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    useEffect(() => {
        checkAuthAndFetchData();
    }, []);

    useEffect(() => {
        if (selectedTicket) scrollToBottom();
    }, [messages, selectedTicket]);

    useEffect(() => {
        if (activeDept === 'team') teamMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [teamMessages, activeDept]);

    // Chat ekip la an tan reyèl — chak nouvo mesaj yon anplwaye voye parèt
    // pou tout lòt anplwaye ki konekte a san yo pa bezwen rafrechi paj la.
    useEffect(() => {
        if (!staffProfile) return;
        const channel = supabase
            .channel('staff_messages_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_messages' }, (payload) => {
                setTeamMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staffProfile?.id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 🔒 SEKIRITE: pa gen okenn sesyon nan localStorage ankò. Aksè a baze
    // sou (1) vrè sesyon Supabase Auth (menm kont kliyan anplwaye a),
    // (2) yon liy aktif nan staff_users, ak (3) cookie "gate" serveur
    // ki pwouve anplwaye a antre modpas espas travay li kòrèkteman —
    // menm nivo sekirite ak middleware.ts.
    const checkAuthAndFetchData = async () => {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
            router.push('/login');
            return;
        }

        const [{ data: staff }, gateRes] = await Promise.all([
            supabase.from('staff_users').select('*').eq('email', user.email.trim().toLowerCase()).maybeSingle(),
            fetch('/api/workspace/verify-gate'),
        ]);

        if (!staff || staff.status === 'revoked' || !staff.workspace_password_hash || !gateRes.ok) {
            router.push('/dashboard');
            return;
        }

        const profile = staff;
        setStaffProfile(profile);

        // 👑 Sipè Admin (wòl entèn 'super_admin') gen AKSÈ TOTAL sou tout
        // depatman yo — Sèvis Kliyan, Finans, ak Konfòmite — anplis Jounal
        // Odit la. Chak lòt wòl gen aksè sèlman sou pwòp depatman li.
        const isSuperAdmin = profile.role === 'super_admin';
        const canSeeSupport = isSuperAdmin || profile.role === 'support';
        const canSeeFinance = isSuperAdmin || profile.role === 'finance';
        const canSeeCompliance = isSuperAdmin || profile.role === 'compliance';

        setActiveDept(canSeeSupport ? 'support' : canSeeFinance ? 'finance' : canSeeCompliance ? 'compliance' : 'team');

        const tasks: PromiseLike<any>[] = [];

        if (canSeeSupport) {
            setActiveTab('tickets');
            tasks.push(
                supabase.from('profiles').select('id, full_name, email, account_status, wallet_balance, kyc_status, created_at').order('created_at', { ascending: false })
                    .then(({ data }) => setUsers(data || [])),
                supabase.from('support_tickets').select('*, profiles(full_name, email)').order('created_at', { ascending: false })
                    .then(({ data }) => setTickets(data || []))
            );
        }

        if (canSeeFinance) {
            tasks.push(
                supabase.from('deposits').select('*').eq('status', 'pending').order('created_at', { ascending: false })
                    .then(({ data }) => setDeposits(data || [])),
                supabase.from('withdrawals').select('*').eq('status', 'pending').order('created_at', { ascending: false })
                    .then(({ data }) => setWithdrawals(data || []))
            );
        }

        if (canSeeCompliance) {
            tasks.push(
                supabase.from('profiles').select('*').eq('kyc_status', 'pending').not('kyc_selfie', 'is', null).order('created_at', { ascending: false })
                    .then(({ data }) => setPendingKyc(data || [])),
                supabase.from('agent_applications').select('*, profiles(full_name, email)').eq('status', 'pending').order('created_at', { ascending: false })
                    .then(({ data }) => setPendingAgents(data || [])),
                supabase.from('enterprise_applications').select('*, profiles(full_name, email)').eq('status', 'pending').order('created_at', { ascending: false })
                    .then(({ data }) => setPendingEnterprises(data || []))
            );
        }

        // Chat Ekip la disponib pou TOUT anplwaye, kèlkeswa depatman yo.
        tasks.push(
            supabase.from('staff_messages').select('*').order('created_at', { ascending: true }).limit(200)
                .then(({ data }) => setTeamMessages(data || []))
        );

        if (isSuperAdmin) {
            setLoadingActivity(true);
            tasks.push(
                supabase.from('staff_activity_log').select('*').order('created_at', { ascending: false }).limit(100)
                    .then(({ data }) => { setActivityLog(data || []); setLoadingActivity(false); })
            );
        }

        await Promise.all(tasks);
        setLoading(false);
    };

    // Jounal Odit: chak aksyon kritik yon anplwaye fè anrejistre isit la
    // pou responsablite ak sekirite (menm prensip ak zouti entèn Stripe/PayPal).
    const logActivity = async (action: string, targetType: string, targetId: string, details?: Record<string, unknown>) => {
        if (!staffProfile) return;
        try {
            await supabase.from('staff_activity_log').insert({
                staff_id: staffProfile.id,
                staff_name: staffProfile.full_name,
                staff_role: staffProfile.role,
                action,
                target_type: targetType,
                target_id: targetId,
                details: details || null,
            });
        } catch {
            // Pa bloke aksyon prensipal la si jounal odit la echwe pou yon rezon rezo.
        }
    };

    const handleSendTeamMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!teamMessageInput.trim() || !staffProfile) return;
        setSendingTeamMessage(true);
        try {
            const { data, error } = await supabase.from('staff_messages').insert({
                sender_id: staffProfile.id,
                sender_name: staffProfile.full_name || staffProfile.email,
                sender_role: staffProfile.role,
                message: teamMessageInput.trim(),
            }).select().single();
            if (error) throw error;
            setTeamMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
            setTeamMessageInput('');
        } catch {
            alert("Erè pandan voye mesaj la nan chat ekip la.");
        } finally {
            setSendingTeamMessage(false);
        }
    };

    const handleLogout = async () => {
        // Efase cookie gate espas travay la imedyatman sou sèvè a.
        try { await fetch('/api/workspace/verify-gate', { method: 'DELETE' }); } catch {}
        router.push('/dashboard');
    };
    // 👆 FEN KÒD OU TE MANDE M NAN 👆

    // ==========================================
    // FONKSYON POU SÈVIS KLIYAN (SUPPORT)
    // ==========================================
    const toggleAccountStatus = async (id: string, currentStatus: string, email: string) => {
        const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
        if (!confirm(`Èske w vle mete kont ${email} lan nan estati: ${newStatus.toUpperCase()} ?`)) return;
        
        setProcessingId(id);
        try {
            await supabase.from('profiles').update({ account_status: newStatus, failed_otp_attempts: 0 }).eq('id', id);
            alert("Estati kont lan chanje!");
            checkAuthAndFetchData();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const loadTicketChat = async (ticket: any) => {
        setSelectedTicket(ticket);
        setProcessingId(`loading_ticket_${ticket.id}`);
        try {
            const { data: m } = await supabase.from('support_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true });
            setMessages(m || []);
        } catch (e) {
            console.error(e);
        } finally {
            setProcessingId(null);
        }
    };

    const handleSendSupportReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyMessage.trim() || !selectedTicket) return;
        setSendingReply(true);

        try {
            const { error } = await supabase.from('support_messages').insert({
                ticket_id: selectedTicket.id,
                sender_id: staffProfile.id,
                message: replyMessage.trim(),
                is_staff_reply: true // Anplwaye a ap reponn
            });
            if (error) throw error;

            // Chanje estati a fè kliyan an konnen yo reponn li
            await supabase.from('support_tickets').update({ status: 'answered' }).eq('id', selectedTicket.id);

            setMessages([...messages, { 
                id: Date.now().toString(), 
                ticket_id: selectedTicket.id, 
                sender_id: staffProfile.id, 
                message: replyMessage.trim(), 
                is_staff_reply: true, 
                created_at: new Date().toISOString() 
            }]);

            // Mete a jou nan lis la sou kote a pou l chanje koulè a
            setTickets(tickets.map(t => t.id === selectedTicket.id ? { ...t, status: 'answered' } : t));
            setReplyMessage('');
        } catch (err: any) {
            alert("Erè nan voye repons lan.");
        } finally {
            setSendingReply(false);
        }
    };

    const handleCloseTicket = async () => {
        if (!confirm("Èske w sèten ou rezoud pwoblèm kliyan sa a epi w vle fèmen dosye a?")) return;
        setProcessingId(`closing_${selectedTicket.id}`);
        try {
            await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', selectedTicket.id);
            await logActivity('TICKET_CLOSED', 'support_ticket', selectedTicket.id, { subject: selectedTicket.subject });
            setTickets(tickets.map(t => t.id === selectedTicket.id ? { ...t, status: 'closed' } : t));
            setSelectedTicket({ ...selectedTicket, status: 'closed' });
        } catch (err) {
            alert("Erè nan fèmen dosye a.");
        } finally {
            setProcessingId(null);
        }
    };

    // ==========================================
    // FONKSYON POU FINANS
    // ==========================================
    const apwouveDepo = async (d: any) => {
        const isModified = montanModifye[d.id] !== undefined;
        const montanFinal = isModified ? montanModifye[d.id] : Number(d.amount);
        const frePouBiznisLa = isModified ? Number((montanFinal * 0.05).toFixed(2)) : Number(d.fee || 0);
        const totalPeye = montanFinal + frePouBiznisLa;

        if (!confirm(`Konfime Depo: \nKliyan resevwa: ${montanFinal} HTG\nFrè (Biznis): ${frePouBiznisLa} HTG`)) return;
        
        setProcessingId(d.id);
        try {
            const { data: p } = await supabase.from('profiles').select('wallet_balance, full_name, account_type').eq('id', d.user_id).single();

            const capCheck = checkBalanceCap(Number(p?.wallet_balance || 0), p?.account_type, montanFinal);
            if (!capCheck.allowed) {
                alert(capCheck.message || "Balans kliyan an ta depase limit maksimòm otorize a.");
                return;
            }

            await supabase.from('profiles').update({ wallet_balance: Number(p?.wallet_balance || 0) + montanFinal }).eq('id', d.user_id);
            await supabase.from('deposits').update({ status: 'approved', amount: montanFinal, fee: frePouBiznisLa, total_to_pay: totalPeye }).eq('id', d.id);
            await supabase.from('transactions').insert({ user_id: d.user_id, amount: montanFinal, type: 'DEPOSIT', description: `Depo konfime: +${montanFinal} HTG`, status: 'success' });
            await logActivity('DEPOSIT_APPROVED', 'deposit', d.id, { amount: montanFinal, fee: frePouBiznisLa, user_id: d.user_id });
            alert("Depo apwouve!"); checkAuthAndFetchData();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const anileTranzaksyon = async (item: any, table: string) => {
        const rezon = prompt("Rezon anilasyon?");
        if (!rezon) return;
        setProcessingId(item.id);
        try {
            await supabase.from(table).update({ status: 'rejected' }).eq('id', item.id);
            if (table === 'withdrawals') {
                const { data: p } = await supabase.from('profiles').select('wallet_balance').eq('id', item.user_id).single();
                const balansR = Number(p?.wallet_balance || 0) + Number(item.amount) + Number(item.fee || 0); 
                await supabase.from('profiles').update({ wallet_balance: balansR }).eq('id', item.user_id);
            }
            await supabase.from('transactions').insert({ user_id: item.user_id, amount: 0, type: 'REJECTED', description: `Anile: ${rezon}`, status: 'failed' });
            await logActivity(`${table.toUpperCase()}_CANCELLED`, table, item.id, { reason: rezon, amount: item.amount, user_id: item.user_id });
            alert("Anile avèk siksè."); checkAuthAndFetchData();
        } finally { setProcessingId(null); }
    };

    const apwouveRetre = async (w: any) => {
        if (!confirm(`Konfime retrè ${w.amount} HTG sa a?`)) return;
        setProcessingId(w.id);
        try {
            await supabase.from('withdrawals').update({ status: 'completed' }).eq('id', w.id);
            await supabase.from('transactions').insert({ user_id: w.user_id, amount: -Number(w.amount), type: 'WITHDRAWAL', description: `Retrè konfime: -${w.amount} HTG`, status: 'success' });
            await logActivity('WITHDRAWAL_APPROVED', 'withdrawal', w.id, { amount: w.amount, user_id: w.user_id });
            alert("Retrè Fini!"); checkAuthAndFetchData();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    // ==========================================
    // FONKSYON POU KONFÒMITE (KYC & AJAN)
    // ==========================================
    const handleOpenDocument = (url: string) => window.open(url, '_blank');

    const handleOpenKycDocument = async (userId: string, doc: 'front' | 'back' | 'selfie', legacyValue?: string | null) => {
        if (!legacyValue) return;
        if (legacyValue.startsWith('http://') || legacyValue.startsWith('https://')) {
            window.open(legacyValue, '_blank');
            return;
        }
        try {
            const res = await fetch(`/api/kyc/document?userId=${userId}&doc=${doc}`);
            const data = await res.json();
            if (res.ok && data.url) window.open(data.url, '_blank');
            else alert(data.error || 'Pa t kapab louvri dokiman an.');
        } catch {
            alert('Erè nan louvri dokiman an.');
        }
    };

    const jereKyc = async (id: string, full_name: string, aksyon: 'approved' | 'rejected') => {
        let rezon = "";
        if (aksyon === 'rejected') { rezon = prompt("Rezon ki fè w rejte l la:") || ""; if (!rezon) return; }
        else { if (!confirm(`Apwouve KYC pou ${full_name}? Kat ap kreye otomatikman.`)) return; }
        
        setProcessingId(id);
        try {
            const res = await fetch('/api/admin/kyc-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: id, action: aksyon, reason: rezon || undefined }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erè KYC');

            await logActivity(`KYC_${aksyon.toUpperCase()}`, 'profile', id, aksyon === 'rejected' ? { reason: rezon, full_name } : { full_name });
            alert(aksyon === 'approved' ? 'KYC apwouve — kat kreye otomatikman!' : 'KYC rejte!'); checkAuthAndFetchData();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const jereAjan = async (applicationId: string, userId: string, aksyon: 'approved' | 'rejected') => {
        let rezon = agentRejectionReason[applicationId] || "";
        if (aksyon === 'rejected' && !rezon.trim()) return alert("Tanpri ekri yon rezon pou rejè a.");
        if (aksyon === 'approved' && !confirm("Konfime apwobasyon ajan sa a?")) return;

        setProcessingId(applicationId);
        try {
            if (aksyon === 'rejected') {
                const { data: userProf } = await supabase.from('profiles').select('agent_guarantee_paid, wallet_balance').eq('id', userId).single();
                if (userProf && Number(userProf.agent_guarantee_paid) > 0) {
                    const totalRefund = Number(userProf.agent_guarantee_paid) + Math.floor((Number(userProf.agent_guarantee_paid) / 1000) * 7);
                    await supabase.from('profiles').update({ wallet_balance: Number(userProf.wallet_balance) + totalRefund, agent_balance: 0, agent_capacity: 0, agent_guarantee_paid: 0, agent_status: 'rejected' }).eq('id', userId);
                } else {
                    await supabase.from('profiles').update({ agent_status: 'rejected' }).eq('id', userId);
                }
            } else {
                await supabase.from('profiles').update({ agent_status: 'approved' }).eq('id', userId);
            }
            await supabase.from('agent_applications').update({ status: aksyon, rejection_reason: aksyon === 'rejected' ? rezon : null }).eq('id', applicationId);
            await logActivity(`AGENT_${aksyon.toUpperCase()}`, 'agent_application', applicationId, aksyon === 'rejected' ? { reason: rezon, user_id: userId } : { user_id: userId });
            alert("Aplikasyon trete!"); checkAuthAndFetchData();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    const jereAntrepriz = async (applicationId: string, userId: string, aksyon: 'approved' | 'rejected') => {
        let rezon = enterpriseRejectionReason[applicationId] || "";
        if (aksyon === 'rejected' && !rezon.trim()) return alert("Tanpri ekri yon rezon pou rejè a.");
        if (aksyon === 'approved' && !confirm("Konfime apwobasyon Kont Antrepriz sa a?")) return;

        setProcessingId(applicationId);
        try {
            if (aksyon === 'rejected') {
                const { data: userProf } = await supabase.from('profiles').select('wallet_balance, enterprise_fee_paid').eq('id', userId).single();
                const feePaid = Number(userProf?.enterprise_fee_paid || 0);
                await supabase.from('profiles').update({
                    wallet_balance: Number(userProf?.wallet_balance || 0) + feePaid,
                    enterprise_status: 'rejected',
                    enterprise_fee_paid: 0,
                }).eq('id', userId);
                if (feePaid > 0) {
                    await supabase.from('transactions').insert({ user_id: userId, type: 'REFUND', amount: feePaid, status: 'success', description: 'Ranbousman Frè Kont Antrepriz Rejte' });
                }
            } else {
                // Bay Ajan PRO otomatikman si li poko gen youn — se yon kont ajan VID (0 HTG).
                // Frè 49,000 HTG la se pwofi HatexCard sèlman, li PA janm transfere sou kont ajan an.
                const { data: userProf } = await supabase.from('profiles').select('agent_status').eq('id', userId).single();
                const updatePayload: any = { account_type: 'business', enterprise_status: 'approved' };
                if (!userProf || userProf.agent_status !== 'approved') {
                    updatePayload.agent_status = 'approved';
                    updatePayload.agent_tier = 'pro';
                    updatePayload.agent_capacity = 40000;
                    updatePayload.agent_balance = 0;
                    updatePayload.agent_guarantee_paid = 0;
                }
                await supabase.from('profiles').update(updatePayload).eq('id', userId);
            }
            await supabase.from('enterprise_applications').update({ status: aksyon, rejection_reason: aksyon === 'rejected' ? rezon : null }).eq('id', applicationId);
            await logActivity(`ENTERPRISE_${aksyon.toUpperCase()}`, 'enterprise_application', applicationId, aksyon === 'rejected' ? { reason: rezon, user_id: userId } : { user_id: userId });
            alert("Aplikasyon Antrepriz trete!"); checkAuthAndFetchData();
        } catch (err: any) { alert(err.message); } finally { setProcessingId(null); }
    };

    if (loading && !staffProfile) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>;
    if (!staffProfile) return null;

    const filteredUsers = users.filter(u => u.email?.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

    const isSuperAdmin = staffProfile.role === 'super_admin';
    const canSeeSupport = isSuperAdmin || staffProfile.role === 'support';
    const canSeeFinance = isSuperAdmin || staffProfile.role === 'finance';
    const canSeeCompliance = isSuperAdmin || staffProfile.role === 'compliance';

    const roleLabel = staffProfile.role === 'finance' ? 'Finans (Kesye)'
        : staffProfile.role === 'compliance' ? 'Konfòmite & Sekirite'
        : staffProfile.role === 'super_admin' ? 'Sipè Admin (Sipèvizyon Total)'
        : 'Sèvis Kliyan';

    const roleColor = staffProfile.role === 'finance' ? 'bg-emerald-600'
        : staffProfile.role === 'compliance' ? 'bg-blue-600'
        : staffProfile.role === 'super_admin' ? 'bg-slate-900'
        : 'bg-indigo-600';

    const RoleIcon = staffProfile.role === 'finance' ? DollarSign
        : staffProfile.role === 'compliance' ? ShieldCheck
        : staffProfile.role === 'super_admin' ? Crown
        : Users;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
            {/* HEADER ESPAS TRAVAY LA */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${roleColor}`}>
                            <RoleIcon size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight leading-tight text-slate-900">Workspace</h1>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Depatman: {roleLabel}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-gray-200">{staffProfile.full_name}</p>
                        <button onClick={handleLogout} className="text-slate-400 hover:text-rose-600 transition-colors bg-white border border-gray-200 p-2 rounded-lg shadow-sm"><LogOut size={16} /></button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 sm:p-6 mt-4 space-y-6">

                {/* ==================================================== */}
                {/* SWITCHER DEPATMAN — Sipè Admin wè tout, lòt yo wè */}
                {/* sèlman depatman pa yo + Ekip la ki disponib pou tout moun */}
                {/* ==================================================== */}
                <div className="flex gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm w-fit flex-wrap">
                    {canSeeSupport && (
                        <button onClick={() => { setActiveDept('support'); setActiveTab('tickets'); }} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeDept === 'support' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <Users size={14} /> Sèvis Kliyan
                        </button>
                    )}
                    {canSeeFinance && (
                        <button onClick={() => { setActiveDept('finance'); setActiveTab('deposits'); }} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeDept === 'finance' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <DollarSign size={14} /> Finans
                        </button>
                    )}
                    {canSeeCompliance && (
                        <button onClick={() => { setActiveDept('compliance'); setActiveTab('kyc'); }} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeDept === 'compliance' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <ShieldCheck size={14} /> Konfòmite
                        </button>
                    )}
                    <button onClick={() => setActiveDept('team')} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeDept === 'team' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                        <MessageCircle size={14} /> Ekip
                    </button>
                    {isSuperAdmin && (
                        <button onClick={() => setActiveDept('activity')} className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeDept === 'activity' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                            <Activity size={14} /> Aktivite
                        </button>
                    )}
                </div>

                {/* ==================================================== */}
                {/* ESPAS: SÈVIS KLIYAN (SUPPORT)                        */}
                {/* ==================================================== */}
                {activeDept === 'support' && canSeeSupport && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm w-fit mb-4">
                            <button onClick={() => { setActiveTab('tickets'); setSelectedTicket(null); }} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'tickets' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Mesaj Kliyan ({tickets.filter(t => t.status === 'open').length})</button>
                            <button onClick={() => { setActiveTab('clients'); setSelectedTicket(null); }} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'clients' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Jere Kont</button>
                        </div>

                        {activeTab === 'clients' ? (
                            <>
                                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
                                    <Search size={20} className="text-slate-400 ml-2" />
                                    <input type="text" placeholder="Chèche kliyan ak non oswa imèl pou w ede l..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none p-2 text-slate-900 outline-none font-medium text-sm" />
                                </div>

                                <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-gray-200">
                                                <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Kliyan</th>
                                                <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider">Estati Kont</th>
                                                <th className="p-4 text-xs font-bold uppercase text-slate-500 tracking-wider text-right">Aksyon</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(user => (
                                                <tr key={user.id} className="border-b border-gray-100 hover:bg-slate-50 transition-colors">
                                                    <td className="p-4">
                                                        <p className="font-bold text-slate-900 text-sm">{user.full_name || 'San Non'}</p>
                                                        <p className="text-xs text-slate-500">{user.email}</p>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold tracking-wider uppercase border ${
                                                            user.account_status === 'suspended' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        }`}>
                                                            {user.account_status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <button 
                                                            onClick={() => toggleAccountStatus(user.id, user.account_status, user.email)}
                                                            disabled={processingId === user.id}
                                                            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                                                                user.account_status === 'suspended' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white border border-rose-200 text-rose-600 hover:bg-rose-50'
                                                            }`}
                                                        >
                                                            {processingId === user.id ? <Loader2 size={14} className="animate-spin inline" /> : user.account_status === 'suspended' ? 'Debloke' : 'Sispann'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="grid lg:grid-cols-12 gap-6 items-start">
                                {/* Lis Mesaj yo */}
                                <div className={`lg:col-span-4 space-y-3 ${selectedTicket ? 'hidden lg:block' : 'block'}`}>
                                    {tickets.length === 0 ? (
                                        <p className="text-center text-slate-400 py-10 text-xs font-bold uppercase">Pa gen okenn mesaj</p>
                                    ) : (
                                        tickets.map(ticket => (
                                            <div 
                                                key={ticket.id}
                                                onClick={() => loadTicketChat(ticket)}
                                                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                                    selectedTicket?.id === ticket.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'bg-white border-gray-200 hover:border-indigo-300'
                                                }`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-xs font-bold text-slate-900 truncate pr-2">{ticket.profiles?.full_name}</p>
                                                    <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded border ${
                                                        ticket.status === 'open' ? 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse' :
                                                        ticket.status === 'answered' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                        {ticket.status === 'open' ? 'Nouvo' : ticket.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700 truncate">{ticket.subject}</p>
                                                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><Clock size={10}/> {new Date(ticket.created_at).toLocaleDateString('fr-HT')}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Tchat Anplwaye a */}
                                <div className={`lg:col-span-8 bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm h-[75vh] flex flex-col ${!selectedTicket ? 'hidden lg:flex items-center justify-center bg-slate-50' : 'flex'}`}>
                                    {!selectedTicket ? (
                                        <div className="text-center text-slate-400">
                                            <MessageSquare size={40} className="mx-auto mb-3 opacity-20" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Chwazi yon mesaj pou w reponn</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Chat Header */}
                                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Kliyan: {selectedTicket.profiles?.full_name}</p>
                                                    <h3 className="font-bold text-slate-900 truncate">{selectedTicket.subject}</h3>
                                                </div>
                                                <div className="flex gap-2">
                                                    {selectedTicket.status !== 'closed' && (
                                                        <button 
                                                            onClick={handleCloseTicket}
                                                            disabled={processingId === `closing_${selectedTicket.id}`}
                                                            className="text-[10px] font-bold uppercase bg-white border border-gray-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                                                        >
                                                            {processingId === `closing_${selectedTicket.id}` ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Fèmen Dosye a
                                                        </button>
                                                    )}
                                                    <button onClick={() => setSelectedTicket(null)} className="lg:hidden p-1.5 bg-slate-200 text-slate-600 rounded-lg"><XCircle size={16} /></button>
                                                </div>
                                            </div>

                                            {/* Chat Messages */}
                                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
                                                {processingId === `loading_ticket_${selectedTicket.id}` ? (
                                                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-400" /></div>
                                                ) : (
                                                    messages.map((msg, index) => {
                                                        if (!msg.is_staff_reply) {
                                                            // Kliyan an ap pale (Agoch)
                                                            return (
                                                                <div key={index} className="flex justify-start">
                                                                    <div className="max-w-[85%] bg-white border border-gray-200 text-slate-800 p-4 rounded-2xl rounded-tl-sm shadow-sm">
                                                                        <p className="text-xs font-bold text-slate-500 mb-1">{selectedTicket.profiles?.full_name}</p>
                                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                                                        <p className="text-[9px] text-slate-400 text-right mt-2 font-medium">{new Date(msg.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            // Anplwaye a ap pale (Adwat)
                                                            return (
                                                                <div key={index} className="flex justify-end">
                                                                    <div className="max-w-[85%] bg-indigo-600 text-white p-4 rounded-2xl rounded-tr-sm shadow-sm">
                                                                        <p className="text-xs font-bold text-indigo-200 mb-1">Mwen (Support)</p>
                                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                                                        <p className="text-[9px] text-indigo-300 text-right mt-2 font-medium">{new Date(msg.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    })
                                                )}
                                                <div ref={messagesEndRef} />
                                            </div>

                                            {/* Chat Input */}
                                            {selectedTicket.status !== 'closed' ? (
                                                <div className="p-3 sm:p-4 border-t border-gray-100 bg-white">
                                                    <form onSubmit={handleSendSupportReply} className="flex gap-2 relative">
                                                        <input 
                                                            type="text" 
                                                            value={replyMessage}
                                                            onChange={(e) => setReplyMessage(e.target.value)}
                                                            placeholder="Ekri yon repons pou kliyan an..."
                                                            className="flex-1 bg-slate-50 border border-gray-200 rounded-full py-3.5 pl-5 pr-14 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all text-slate-900"
                                                            required
                                                        />
                                                        <button 
                                                            type="submit" 
                                                            disabled={sendingReply || !replyMessage.trim()}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                                        >
                                                            {sendingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-1" />}
                                                        </button>
                                                    </form>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-100 p-4 border-t border-gray-200 text-center">
                                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ticket sa a fèmen.</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ==================================================== */}
                {/* ESPAS: FINANS (KESYE)                                */}
                {/* ==================================================== */}
                {activeDept === 'finance' && canSeeFinance && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm w-fit">
                            <button onClick={() => setActiveTab('deposits')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'deposits' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Depo ({deposits.length})</button>
                            <button onClick={() => setActiveTab('withdrawals')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'withdrawals' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Retrè ({withdrawals.length})</button>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(activeTab === 'deposits' ? deposits : withdrawals).map(item => (
                                <div key={item.id} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm relative flex flex-col">
                                    <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-4">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">ID: {item.user_id.slice(0,8)}</span>
                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{item.method}</span>
                                        </div>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${activeTab === 'deposits' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                            {activeTab === 'deposits' ? <ArrowDownToLine size={18}/> : <ArrowUpFromLine size={18}/>}
                                        </div>
                                    </div>
                                    <div className="mb-6 flex-1">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Montan Demande a:</p>
                                        <div className="flex justify-between items-center">
                                            <p className="text-3xl font-bold text-slate-900">{montanModifye[item.id] || item.amount} <span className="text-sm">HTG</span></p>
                                            {activeTab === 'deposits' && (
                                                <button onClick={() => { const val = prompt("Modifye montan:", item.amount); if(val) setMontanModifye({...montanModifye, [item.id]: Number(val)}); }} className="text-[9px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded">Modifye</button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-auto">
                                        <button disabled={processingId === item.id} onClick={() => activeTab === 'deposits' ? apwouveDepo(item) : apwouveRetre(item)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex justify-center items-center">
                                            {processingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} className="mr-1"/> Apwouve</>}
                                        </button>
                                        <button disabled={processingId === item.id} onClick={() => anileTranzaksyon(item, activeTab === 'deposits' ? 'deposits' : 'withdrawals')} className="bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 py-3 px-4 rounded-xl transition-all shadow-sm">
                                            <XCircle size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {(activeTab === 'deposits' ? deposits : withdrawals).length === 0 && <p className="text-sm font-bold text-slate-400 col-span-full text-center py-10 uppercase tracking-wider">Pa gen okenn demann k ap tann.</p>}
                        </div>
                    </div>
                )}

                {/* ==================================================== */}
                {/* ESPAS: KONFÒMITE (KYC & AJAN)                        */}
                {/* ==================================================== */}
                {activeDept === 'compliance' && canSeeCompliance && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex gap-2 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm w-fit">
                            <button onClick={() => setActiveTab('kyc')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'kyc' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>KYC ({pendingKyc.length})</button>
                            <button onClick={() => setActiveTab('ajan')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'ajan' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Ajan ({pendingAgents.length})</button>
                            <button onClick={() => setActiveTab('antrepriz')} className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'antrepriz' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Antrepriz ({pendingEnterprises.length})</button>
                        </div>

                        <div className="space-y-4">
                            {activeTab === 'kyc' ? pendingKyc.map(user => (
                                <div key={user.id} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                                    <div className="flex-1 text-center md:text-left w-full">
                                        <h3 className="text-lg font-bold text-slate-900">{user.full_name}</h3>
                                        <p className="text-xs text-slate-500 mb-4">{user.email}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {user.kyc_front && <button onClick={() => handleOpenKycDocument(user.id, 'front', user.kyc_front)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 transition-colors"><EyeOff size={14}/> Devan</button>}
                                            {user.kyc_back && <button onClick={() => handleOpenKycDocument(user.id, 'back', user.kyc_back)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 transition-colors"><EyeOff size={14}/> Dèyè</button>}
                                            {user.kyc_selfie && <button onClick={() => handleOpenKycDocument(user.id, 'selfie', user.kyc_selfie)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600 transition-colors"><EyeOff size={14}/> Selfie</button>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto">
                                        <button onClick={() => jereKyc(user.id, user.full_name, 'approved')} className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase shadow-sm">Apwouve</button>
                                        <button onClick={() => jereKyc(user.id, user.full_name, 'rejected')} className="flex-1 bg-white border border-rose-200 text-rose-600 px-6 py-3 rounded-xl text-xs font-bold uppercase shadow-sm">Rejte</button>
                                    </div>
                                </div>
                            )) : activeTab === 'ajan' ? pendingAgents.map(agent => (
                                <div key={agent.id} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-4">
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">{agent.profiles?.full_name}</h3>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase border border-indigo-100">Plan: {agent.tier}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {agent.id_doc_url && <button onClick={() => handleOpenDocument(agent.id_doc_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Idantite</button>}
                                        {agent.address_doc_url && <button onClick={() => handleOpenDocument(agent.address_doc_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Adrès</button>}
                                        {agent.location_photo_url && <button onClick={() => handleOpenDocument(agent.location_photo_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Lokal</button>}
                                        {agent.selfie_with_id_url && <button onClick={() => handleOpenDocument(agent.selfie_with_id_url)} className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-amber-100"><EyeOff size={12}/> Selfie+ID</button>}
                                        {agent.patente_url && <button onClick={() => handleOpenDocument(agent.patente_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Patant</button>}
                                        {agent.cif_url && <button onClick={() => handleOpenDocument(agent.cif_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> CIF</button>}
                                        {agent.criminal_record_url && <button onClick={() => handleOpenDocument(agent.criminal_record_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Kazye</button>}
                                        {agent.bank_statement_url && <button onClick={() => handleOpenDocument(agent.bank_statement_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Relve Bankè</button>}
                                        {agent.lease_doc_url && <button onClick={() => handleOpenDocument(agent.lease_doc_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Kontra Lokal</button>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-gray-100 rounded-xl p-3 text-xs">
                                        <p><span className="text-slate-400 font-bold uppercase text-[9px] block">Ekspirasyon ID</span>{agent.id_expiry_date ? new Date(agent.id_expiry_date).toLocaleDateString('fr-HT') : '—'}</p>
                                        <p><span className="text-slate-400 font-bold uppercase text-[9px] block">Dat Prèv Adrès</span>{agent.address_proof_date ? new Date(agent.address_proof_date).toLocaleDateString('fr-HT') : '—'}</p>
                                        <p><span className="text-slate-400 font-bold uppercase text-[9px] block">Referans</span>{agent.reference_name || '—'}</p>
                                        <p><span className="text-slate-400 font-bold uppercase text-[9px] block">Tel Referans</span>{agent.reference_phone || '—'}</p>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-gray-100">
                                        <input type="text" placeholder="Rezon si w ap rejte l..." value={agentRejectionReason[agent.id] || ''} onChange={(e) => setAgentRejectionReason({...agentRejectionReason, [agent.id]: e.target.value})} className="flex-1 bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500" />
                                        <button onClick={() => jereAjan(agent.id, agent.user_id, 'rejected')} className="bg-white border border-rose-200 text-rose-600 px-6 py-3 rounded-xl text-xs font-bold uppercase shadow-sm">Rejte</button>
                                        <button onClick={() => jereAjan(agent.id, agent.user_id, 'approved')} className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase shadow-sm">Apwouve</button>
                                    </div>
                                </div>
                            )) : pendingEnterprises.map(app => (
                                <div key={app.id} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col gap-4">
                                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">{app.profiles?.full_name}</h3>
                                            <p className="text-xs text-slate-500">{app.profiles?.email}</p>
                                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase border border-indigo-100 mt-1 inline-block">{app.business_name || 'Biznis San Non'}</span>
                                        </div>
                                        <Building2 className="text-indigo-600" size={22} />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {app.patente_url && <button onClick={() => handleOpenDocument(app.patente_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Patant</button>}
                                        {app.cif_url && <button onClick={() => handleOpenDocument(app.cif_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> CIF</button>}
                                        {app.business_registration_url && <button onClick={() => handleOpenDocument(app.business_registration_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Anrejistreman</button>}
                                        {app.bank_statement_url && <button onClick={() => handleOpenDocument(app.bank_statement_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Relve Bankè</button>}
                                        {app.lease_doc_url && <button onClick={() => handleOpenDocument(app.lease_doc_url)} className="text-[10px] bg-slate-50 border border-gray-200 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-blue-50 hover:text-blue-600"><EyeOff size={12}/> Kontra Lokal</button>}
                                        {app.legal_rep_id_url && <button onClick={() => handleOpenDocument(app.legal_rep_id_url)} className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg font-bold uppercase flex items-center gap-1 hover:bg-amber-100"><EyeOff size={12}/> ID Reprezantan</button>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-gray-100 rounded-xl p-3 text-xs">
                                        <p><span className="text-slate-400 font-bold uppercase text-[9px] block">Nimewo Anrejistreman</span>{app.business_reg_number || '—'}</p>
                                        <p><span className="text-slate-400 font-bold uppercase text-[9px] block">Aktivite</span>{app.business_activity || '—'}</p>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-gray-100">
                                        <input type="text" placeholder="Rezon si w ap rejte l..." value={enterpriseRejectionReason[app.id] || ''} onChange={(e) => setEnterpriseRejectionReason({...enterpriseRejectionReason, [app.id]: e.target.value})} className="flex-1 bg-slate-50 border border-gray-200 p-3 rounded-xl text-sm outline-none focus:border-blue-500" />
                                        <button onClick={() => jereAntrepriz(app.id, app.user_id, 'rejected')} className="bg-white border border-rose-200 text-rose-600 px-6 py-3 rounded-xl text-xs font-bold uppercase shadow-sm">Rejte</button>
                                        <button onClick={() => jereAntrepriz(app.id, app.user_id, 'approved')} className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase shadow-sm">Apwouve</button>
                                    </div>
                                </div>
                            ))}
                            {(activeTab === 'kyc' ? pendingKyc : activeTab === 'ajan' ? pendingAgents : pendingEnterprises).length === 0 && <p className="text-center py-10 text-slate-400 text-sm font-bold uppercase">Pa gen okenn dosye k ap tann.</p>}
                        </div>
                    </div>
                )}

                {/* ==================================================== */}
                {/* ESPAS: EKIP — Chat entèn ant TOUT anplwaye yo         */}
                {/* (disponib pou chak depatman, menm jan ak Slack entèn  */}
                {/* Stripe/PayPal genyen pou ekip sipò/finans/konfòmite)  */}
                {/* ==================================================== */}
                {activeDept === 'team' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden h-[75vh] flex flex-col">
                            <div className="p-4 border-b border-gray-100 bg-slate-50/50 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                                    <Radio size={16} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">Chat Ekip Hatexcard</h3>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tout depatman — Sipò, Finans, Konfòmite &amp; Sipè Admin</p>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
                                {teamMessages.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                        <MessageCircle size={40} className="mb-3 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Pa gen mesaj ankò. Salye ekip la!</p>
                                    </div>
                                ) : (
                                    teamMessages.map((msg) => {
                                        const isMe = msg.sender_id === staffProfile.id;
                                        return (
                                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-slate-800 rounded-tl-sm'}`}>
                                                    <p className={`text-xs font-bold mb-1 flex items-center gap-1.5 ${isMe ? 'text-indigo-200' : 'text-slate-500'}`}>
                                                        {isMe ? 'Mwen' : msg.sender_name}
                                                        <span className={`text-[8px] uppercase px-1.5 py-0.5 rounded ${isMe ? 'bg-white/20' : 'bg-slate-100'}`}>{msg.sender_role?.replace('_', ' ')}</span>
                                                    </p>
                                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                                    <p className={`text-[9px] text-right mt-2 font-medium ${isMe ? 'text-indigo-300' : 'text-slate-400'}`}>{new Date(msg.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</p>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={teamMessagesEndRef} />
                            </div>

                            <div className="p-3 sm:p-4 border-t border-gray-100 bg-white">
                                <form onSubmit={handleSendTeamMessage} className="flex gap-2 relative">
                                    <input
                                        type="text"
                                        value={teamMessageInput}
                                        onChange={(e) => setTeamMessageInput(e.target.value)}
                                        placeholder="Ekri yon mesaj pou ekip la..."
                                        className="flex-1 bg-slate-50 border border-gray-200 rounded-full py-3.5 pl-5 pr-14 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all text-slate-900"
                                        required
                                    />
                                    <button
                                        type="submit"
                                        disabled={sendingTeamMessage || !teamMessageInput.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:opacity-50"
                                    >
                                        {sendingTeamMessage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="ml-1" />}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================================================== */}
                {/* ESPAS: AKTIVITE — Jounal Odit (Sipè Admin sèlman)     */}
                {/* Menm prensip ak "audit log" entèn Stripe/PayPal:      */}
                {/* chak aksyon kritik yon anplwaye fè kite yon tras.     */}
                {/* ==================================================== */}
                {activeDept === 'activity' && isSuperAdmin && (
                    <div className="animate-in fade-in duration-500 space-y-4">
                        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-amber-800 leading-relaxed">
                                Jounal sa a montre chak aksyon kritik anplwaye yo fè (depo, retrè, KYC, ajan, antrepriz) — pou responsablite ak sekirite. Sèlman Sipè Admin ka wè l.
                            </p>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
                            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
                                {loadingActivity ? (
                                    <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>
                                ) : activityLog.length === 0 ? (
                                    <p className="text-center text-slate-400 text-xs font-bold uppercase py-10">Pa gen okenn aktivite anrejistre ankò.</p>
                                ) : (
                                    activityLog.map((log) => (
                                        <div key={log.id} className="p-4 sm:px-6 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                                    <Activity size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-slate-900 truncate">{log.action}</p>
                                                    <p className="text-xs text-slate-500 truncate">{log.staff_name} ({log.staff_role}) • {log.target_type} #{String(log.target_id || '').slice(0, 8)}</p>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 shrink-0">{new Date(log.created_at).toLocaleString('fr-HT')}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}