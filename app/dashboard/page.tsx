"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { checkStrongPassword } from '@/lib/security/password-strength';
import { isKycApproved } from '@/lib/kyc/status';
import { MerchantShell } from '@/components/app-shell/MerchantShell';
import { LiveTransactionsPanel } from '@/components/dashboard/LiveTransactionsPanel';
import { ConnectBankModal } from '@/components/dashboard/ConnectBankModal';
import SafeImg from '@/components/SafeImg';
import {
  DASH_LANGS,
  getDashCopy,
  loadDashLang,
  saveDashLang,
  type DashCopy,
  type DashLang,
} from '@/lib/i18n/dashboard';
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  FileText,
  Globe2,
  Headset,
  Languages,
  Loader2,
  Lock,
  Package,
  Plug,
  Receipt,
  Search,
  BarChart3,
} from 'lucide-react';

function transferHistoryBody(status: string, t: DashCopy): string {
  if (status === 'success') return t.transferOk;
  if (status === 'wallet_full') return t.transferFull;
  return t.transferFail;
}

type HistoryItem = { id: string; title: string; body: string; created_at: string };

function mapRecentHistory(
  data: {
    notifications?: { id: string; title: string; body: string | null; created_at: string }[];
    transfers?: { id: string; amount: number; phone: string; status: string; created_at: string }[];
  },
  t: DashCopy
): HistoryItem[] {
  const transfers = Array.isArray(data.transfers) ? data.transfers : [];
  const notifs = Array.isArray(data.notifications) ? data.notifications : [];
  const items: HistoryItem[] = [
    ...transfers.map((tr) => ({
      id: `t-${tr.id}`,
      title: `${Number(tr.amount || 0).toLocaleString('fr-FR')} HTG · ${tr.phone}`,
      body: transferHistoryBody(tr.status, t),
      created_at: tr.created_at,
    })),
    ...notifs.map((n) => ({
      id: `n-${n.id}`,
      title: n.title,
      body: n.body || '',
      created_at: n.created_at,
    })),
  ];
  items.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return items.slice(0, 5);
}

async function confirmAndLoadBilling(): Promise<unknown> {
  try {
    await fetch('/api/billing/confirm', { method: 'POST' });
  } catch {
    /* peman pending ka poko konfime */
  }
  try {
    const bRes = await fetch('/api/billing/plan');
    if (bRes.ok) return bRes.json();
  } catch {
    /* ignore */
  }
  return null;
}

async function loadNotifsAndHistory(t: DashCopy): Promise<{ unread: number; history: HistoryItem[] }> {
  try {
    const [notifRes, histRes] = await Promise.all([
      fetch('/api/v2/notifications'),
      fetch('/api/v2/history?limit=5'),
    ]);
    const data = await notifRes.json();
    const histData = histRes.ok ? await histRes.json() : { transactions: [] };
    const fromNotifs = mapRecentHistory(data, t);
    const fromTx = (
      (histData.transactions || []) as {
        id: string;
        description: string;
        amount: number;
        created_at: string;
        type: string;
      }[]
    ).map((tx) => ({
      id: `h-${tx.id}`,
      title: tx.description,
      body: `${tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString('fr-FR')} HTG · ${tx.type}`,
      created_at: tx.created_at,
    }));
    const merged = [...fromNotifs, ...fromTx];
    merged.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return {
      unread: Number(data?.unread_count || 0),
      history: merged.slice(0, 5),
    };
  } catch {
    return { unread: 0, history: [] };
  }
}

export default function Dashboard() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [lang, setLang] = useState<DashLang>('ht');
  const [langOpen, setLangOpen] = useState(false);
  const t = useMemo(() => getDashCopy(lang), [lang]);

  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState<{ text: string; active: boolean }>({
    text: '',
    active: false,
  });
  const [staffRecord, setStaffRecord] = useState<any>(null);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [billing, setBilling] = useState<any>(null);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [workspacePassword, setWorkspacePassword] = useState('');
  const [workspacePasswordConfirm, setWorkspacePasswordConfirm] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [isLoggingAdmin, setIsLoggingAdmin] = useState(false);

  useEffect(() => {
    setLang(loadDashLang());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select(
            'id, full_name, email, phone, account_status, account_type, kyc_status, created_at, business_name, avatar_url, plan, plan_status, plan_period_end, intended_plan'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        const next = { ...(profile || { id: user.id }), email: user.email };
        setUserData(next);

        const { data: settings } = await supabase
          .from('global_settings')
          .select('announcement_text, announcement_active')
          .eq('id', 1)
          .maybeSingle();

        if (cancelled) return;
        if (settings) {
          setAnnouncement({
            text: String(settings.announcement_text || '').trim(),
            active: settings.announcement_active !== false,
          });
        }

        const [billingData, notifPack] = await Promise.all([
          confirmAndLoadBilling(),
          loadNotifsAndHistory(getDashCopy(loadDashLang())),
        ]);
        if (cancelled) return;
        if (billingData) setBilling(billingData);
        setUnreadNotifs(notifPack.unread);
        setRecentHistory(notifPack.history);

        if (user.email) {
          const { data: staff } = await supabase
            .from('staff_users')
            .select('id, role, status, workspace_password_hash, full_name')
            .eq('email', user.email.trim().toLowerCase())
            .maybeSingle();
          if (!cancelled && staff && staff.status !== 'revoked') {
            setStaffRecord({
              ...staff,
              has_workspace_password: !!staff.workspace_password_hash,
              workspace_password_hash: staff.workspace_password_hash ? 'set' : null,
            });
          }
        }
      } catch (err) {
        console.error('Erè Dashboard:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  const changeLang = (code: DashLang) => {
    setLang(code);
    saveDashLang(code);
    setLangOpen(false);
  };

  const antreNanAdmin = async () => {
    const pass = prompt('Antre Modpas Sipè Admin lan pou w ka konekte:');
    if (!pass) return;
    setIsLoggingAdmin(true);
    try {
      const verifyRes = await fetch('/api/admin/verify-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (verifyRes.ok) {
        window.location.href = '/admin';
      } else {
        alert(data.message || 'Modpas la pa bon.');
      }
    } catch {
      alert('Erè nan sistèm nan. Tanpri eseye ankò.');
    } finally {
      setIsLoggingAdmin(false);
    }
  };

  const isFirstTimeWorkspaceSetup = staffRecord && !staffRecord.workspace_password_hash;

  const handleWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkspaceError('');
    if (isFirstTimeWorkspaceSetup) {
      const strength = checkStrongPassword(workspacePassword);
      if (!strength.valid) {
        setWorkspaceError(strength.message || 'Modpas la twò fèb.');
        return;
      }
      if (workspacePassword !== workspacePasswordConfirm) {
        setWorkspaceError('Modpas yo pa menm.');
        return;
      }
    }
    setWorkspaceLoading(true);
    try {
      const endpoint = isFirstTimeWorkspaceSetup
        ? '/api/workspace/set-password'
        : '/api/workspace/verify-gate';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: workspacePassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWorkspaceError(data.message || 'Yon erè pase.');
        return;
      }
      setShowWorkspaceModal(false);
      window.location.href = '/workspace';
    } catch {
      setWorkspaceError('Erè rezo. Tanpri eseye ankò.');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#1d4ed8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdmin = userData?.email === 'adminhatexcard@gmail.com';
  const kycOk = isKycApproved(userData?.kyc_status);
  const kycPending = userData?.kyc_status === 'pending';
  const firstName = (userData?.full_name || 'Machann').split(/\s+/)[0];
  const gate = null;
  const walletFull = billing?.wallet_full_payouts || [];
  const usage = billing?.usage;
  const effectivePlan = billing?.profile?.effective_plan || userData?.plan || 'free';
  const nearLimit =
    usage?.limit != null && usage.limit > 0 && usage.used / usage.limit >= 0.7;
  const needsKyc = !kycOk;

  type Task = {
    id: string;
    tone: 'danger' | 'warn' | 'info';
    title: string;
    body: string;
    href?: string;
    action?: () => void;
    cta: string;
  };

  const tasks: Task[] = [];
  if (walletFull.length > 0) {
    tasks.push({
      id: 'wallet',
      tone: 'danger',
      title: t.taskWallet,
      body: t.taskWalletBody,
      action: () => setShowBankModal(true),
      cta: t.connectBank,
    });
  }
  if (needsKyc) {
    tasks.push({
      id: 'kyc',
      tone: 'warn',
      title: kycPending ? t.taskKycPending : t.taskKyc,
      body: t.taskKycBody,
      href: '/kyc/v2',
      cta: kycPending ? t.viewKyc : t.startKyc,
    });
  }
  if (nearLimit) {
    tasks.push({
      id: 'limit',
      tone: 'warn',
      title: t.taskLimit,
      body: t.taskLimitBody,
      href: '/plan',
      cta: t.expandPlan,
    });
  }
  if (effectivePlan === 'free' && !nearLimit) {
    tasks.push({
      id: 'free',
      tone: 'info',
      title: t.taskFree,
      body: t.taskFreeBody,
      href: '/plan',
      cta: t.expandPlan,
    });
  }

  const quickActions = [
    {
      href: '/dashboard/products/new',
      title: t.qaAccept,
      desc: t.qaAcceptDesc,
      icon: CreditCard,
      tone: 'primary' as const,
    },
    {
      href: '/transactions',
      title: t.qaFind,
      desc: t.qaFindDesc,
      icon: Search,
      tone: 'default' as const,
    },
    {
      href: '/invoice',
      title: t.qaInvoice,
      desc: t.qaInvoiceDesc,
      icon: Receipt,
      tone: 'default' as const,
    },
    {
      href: '/transactions',
      title: t.qaReports,
      desc: t.qaReportsDesc,
      icon: BarChart3,
      tone: 'default' as const,
    },
  ];

  const toneBorder = {
    danger: 'border-rose-200 bg-rose-50',
    warn: 'border-amber-200 bg-amber-50',
    info: 'border-indigo-100 bg-indigo-50/70',
  };
  const toneText = {
    danger: 'text-rose-900',
    warn: 'text-amber-900',
    info: 'text-indigo-950',
  };

  return (
    <MerchantShell
      user={userData}
      staffRecord={staffRecord}
      isAdmin={isAdmin}
      isLoggingAdmin={isLoggingAdmin}
      hideTopChrome
      onOpenWorkspace={() => {
        setWorkspaceError('');
        setWorkspacePassword('');
        setWorkspacePasswordConfirm('');
        setShowWorkspaceModal(true);
      }}
      onOpenAdmin={antreNanAdmin}
    >
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-14">
        {/* Header — Authorize.net style welcome + tools */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7 lg:mb-9">
          <div className="flex items-center gap-3 min-w-0">
            <label htmlFor="avatarUpload" className="relative shrink-0 cursor-pointer group">
              <input
                type="file"
                id="avatarUpload"
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !userData) return;
                  try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${userData.id}/${Date.now()}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage
                      .from('avatars')
                      .upload(fileName, file, { upsert: true });
                    if (uploadError) throw uploadError;
                    const {
                      data: { publicUrl },
                    } = supabase.storage.from('avatars').getPublicUrl(fileName);
                    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userData.id);
                    setUserData({ ...userData, avatar_url: publicUrl });
                  } catch (err: any) {
                    alert('Erè nan mete foto a: ' + err.message);
                  }
                }}
              />
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full border-2 border-white shadow-sm overflow-hidden bg-indigo-50 ring-1 ring-indigo-100">
                {userData?.avatar_url ? (
                  <SafeImg src={userData.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#1d4ed8] text-lg font-bold">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </label>
            <div className="min-w-0">
              <p className="text-[11px] lg:text-xs text-slate-500 font-medium">
                {t.hello}, <span className="font-semibold text-slate-700">{firstName}</span>
              </p>
              <h1 className="text-lg lg:text-2xl font-bold text-slate-900 truncate tracking-tight">
                {t.welcome}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {/* Language switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                className="h-10 lg:h-11 px-3 rounded-xl bg-white border border-gray-200 flex items-center gap-2 text-slate-700 hover:border-[#1d4ed8]/40 hover:text-[#1d4ed8] transition-colors text-xs font-bold"
                aria-label={t.translate}
              >
                <Languages size={16} strokeWidth={1.75} />
                <span>{DASH_LANGS.find((l) => l.code === lang)?.short || 'HT'}</span>
              </button>
              {langOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[150]"
                    aria-label="Close"
                    onClick={() => setLangOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 z-[160] w-40 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    {DASH_LANGS.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => changeLang(l.code)}
                        className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                          lang === l.code
                            ? 'bg-indigo-50 text-[#1d4ed8]'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Link
              href="/notifikasyon"
              className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-700 hover:border-[#1d4ed8]/40 hover:text-[#1d4ed8] transition-colors"
              aria-label={t.notifications}
            >
              <Bell size={18} strokeWidth={1.75} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadNotifs > 9 ? '9+' : unreadNotifs}
                </span>
              )}
            </Link>
            <Link
              href="/support"
              className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-slate-700 hover:border-[#1d4ed8]/40 hover:text-[#1d4ed8] transition-colors"
              aria-label={t.support}
            >
              <Headset size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        {/* Wallet-full critical banner */}
        {walletFull.length > 0 && (
          <div className="mb-6 bg-rose-600 text-white rounded-2xl p-5 lg:p-6 shadow-lg">
            <p className="text-sm font-black uppercase tracking-wide leading-snug">{t.taskWallet}</p>
            <p className="text-xs mt-2 text-rose-50 leading-relaxed">{t.taskWalletBody}</p>
            <p className="text-[11px] mt-3 font-semibold text-rose-100">
              {walletFull.length} · {Number(walletFull[0]?.amount || 0).toLocaleString('fr-FR')} HTG
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* LEFT COLUMN */}
          <div className="xl:col-span-8 space-y-6 lg:space-y-8">
            {/* Tasks */}
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">{t.tasks}</h2>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {tasks.length}
                </span>
              </div>
              {tasks.length === 0 ? (
                <div className="px-5 py-8 flex items-start gap-3">
                  <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                  <p className="text-sm text-slate-600">{t.tasksEmpty}</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {tasks.map((task) => (
                    <li key={task.id} className={`px-5 py-4 ${toneBorder[task.tone]}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                        <div className="min-w-0">
                          <p className={`text-sm font-bold ${toneText[task.tone]}`}>{task.title}</p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{task.body}</p>
                        </div>
                        {task.href ? (
                          <Link
                            href={task.href}
                            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8] hover:underline"
                          >
                            {task.cta} <ChevronRight size={14} />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={task.action}
                            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8] hover:underline"
                          >
                            {task.cta} <ChevronRight size={14} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Quick Actions — Authorize.net style 2x2 */}
            <section>
              <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-3 px-0.5">
                {t.quickActions}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {quickActions.map((qa) => (
                  <Link
                    key={qa.title + qa.href}
                    href={gate ?? qa.href}
                    className={`group rounded-2xl border p-5 flex items-start gap-4 transition-all ${
                      qa.tone === 'primary'
                        ? 'bg-[#1d4ed8] border-[#1d4ed8] text-white hover:bg-[#1e40af] shadow-md shadow-blue-600/15'
                        : 'bg-white border-gray-200 hover:border-[#1d4ed8]/35 hover:shadow-sm'
                    }`}
                  >
                    <span
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        qa.tone === 'primary'
                          ? 'bg-white/15 text-white'
                          : 'bg-indigo-50 text-[#1d4ed8]'
                      }`}
                    >
                      <qa.icon size={20} strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-bold ${
                          qa.tone === 'primary' ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {qa.title}
                      </p>
                      <p
                        className={`text-xs mt-1 leading-relaxed ${
                          qa.tone === 'primary' ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        {qa.desc}
                      </p>
                    </div>
                    <ArrowUpRight
                      size={16}
                      className={`ml-auto shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ${
                        qa.tone === 'primary' ? 'text-white' : 'text-slate-400'
                      }`}
                    />
                  </Link>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowBankModal(true)}
                  className="w-full bg-white border border-slate-900/70 rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2.5 font-bold text-sm text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <Globe2 size={18} className="text-[#1d4ed8]" />
                  {t.connectBank}
                </button>
                <Link
                  href="/plugin"
                  className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2.5 font-bold text-sm text-slate-800 hover:border-[#1d4ed8]/30 hover:bg-indigo-50/40 transition-colors"
                >
                  <Plug size={16} className="text-[#1d4ed8]" />
                  {t.plugin}
                </Link>
              </div>
            </section>

            {/* Business Insights */}
            <section>
              <div className="flex items-center justify-between mb-3 px-0.5">
                <h2 className="text-base lg:text-lg font-bold text-slate-900">{t.businessInsights}</h2>
              </div>

              {usage && (
                <div className="mb-3 bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {t.planUsage} · {effectivePlan}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">
                      {Number(usage.used || 0).toLocaleString('fr-FR')} HTG
                      {usage.limit != null
                        ? ` / ${Number(usage.limit).toLocaleString('fr-FR')} HTG`
                        : ` · ${t.noLimit}`}
                    </p>
                    {usage.limit != null && (
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${nearLimit ? 'bg-amber-500' : 'bg-[#1d4ed8]'}`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((Number(usage.used || 0) / usage.limit) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <Link
                    href="/plan"
                    className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-[#1d4ed8] border border-indigo-200 rounded-xl px-3 py-2 hover:bg-indigo-50"
                  >
                    {t.expandPlan}
                  </Link>
                </div>
              )}

              {userData?.id && <LiveTransactionsPanel userId={userData.id} gate={gate} />}
            </section>

            {/* Recent activity */}
            <section>
              <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-3 px-0.5">
                {t.recentHistory}
              </h2>
              {recentHistory.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-4 text-xs text-slate-500">
                  {t.historyEmpty}
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentHistory.map((h) => (
                    <li
                      key={h.id}
                      className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{h.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{h.body}</p>
                      </div>
                      <p className="text-[10px] text-slate-400 shrink-0">
                        {new Date(h.created_at).toLocaleString(
                          lang === 'en' ? 'en-US' : 'fr-FR',
                          {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN — News + Help */}
          <aside className="xl:col-span-4 space-y-6">
            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-slate-900">{t.newsCenter}</h2>
              </div>
              <div className="p-5 flex gap-4">
                <div className="flex-1 min-w-0">
                  {announcement.active && announcement.text ? (
                    <>
                      <p className="text-sm font-bold text-slate-900 mb-1.5">{t.announcement}</p>
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {announcement.text}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-slate-900 mb-1.5">{t.newsDefaultTitle}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{t.newsDefaultBody}</p>
                    </>
                  )}
                </div>
                <div className="w-16 shrink-0 flex items-start justify-center">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-indigo-500 flex items-center justify-center shadow-md">
                    <img
                      src="https://i.imgur.com/xDk58Xk.png"
                      alt="Hatexcard"
                      className="w-9 h-9 rounded-lg object-cover border border-white/30"
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-base font-bold text-slate-900">{t.needHelp}</h2>
              </div>
              <div className="p-3 space-y-1">
                <Link
                  href="/support"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-[#1d4ed8] transition-colors"
                >
                  <Headset size={18} className="text-[#1d4ed8]" /> {t.support}
                </Link>
                <Link
                  href="/developer/docs"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-[#1d4ed8] transition-colors"
                >
                  <FileText size={18} className="text-[#1d4ed8]" /> {t.docs}
                </Link>
                <Link
                  href="/dashboard/products"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-[#1d4ed8] transition-colors"
                >
                  <Package size={18} className="text-[#1d4ed8]" /> {t.products}
                </Link>
                <Link
                  href="/plugin"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-indigo-50 hover:text-[#1d4ed8] transition-colors"
                >
                  <Plug size={18} className="text-[#1d4ed8]" /> {t.plugin}
                </Link>
              </div>
            </section>

            {kycOk && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                <CheckCircle2 size={14} className="shrink-0" />
                {t.kycOk}
              </div>
            )}

            {isAdmin && (
              <button
                type="button"
                onClick={antreNanAdmin}
                disabled={isLoggingAdmin}
                className="w-full bg-rose-50 border border-rose-200 text-rose-700 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggingAdmin ? <Loader2 size={14} className="animate-spin" /> : <Briefcase size={14} />}
                {t.superAdmin}
              </button>
            )}
          </aside>
        </div>
      </main>

      {showBankModal && <ConnectBankModal onClose={() => setShowBankModal(false)} />}

      {showWorkspaceModal && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 relative">
            <button
              type="button"
              onClick={() => setShowWorkspaceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#1d4ed8] text-white rounded-xl flex items-center justify-center shadow-md">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isFirstTimeWorkspaceSetup ? t.workspaceCreate : t.workspaceTitle}
                </h2>
              </div>
            </div>
            <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
              <input
                type="password"
                required
                autoFocus
                value={workspacePassword}
                onChange={(e) => setWorkspacePassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1d4ed8]"
              />
              {isFirstTimeWorkspaceSetup && (
                <input
                  type="password"
                  required
                  value={workspacePasswordConfirm}
                  onChange={(e) => setWorkspacePasswordConfirm(e.target.value)}
                  placeholder={t.workspaceConfirm}
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1d4ed8]"
                />
              )}
              {workspaceError && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-rose-700 text-xs font-bold">{workspaceError}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={workspaceLoading}
                className="w-full bg-[#1d4ed8] hover:bg-[#1e40af] disabled:bg-indigo-400 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2"
              >
                {workspaceLoading ? <Loader2 size={16} className="animate-spin" /> : t.enter}
              </button>
            </form>
          </div>
        </div>
      )}
    </MerchantShell>
  );
}
