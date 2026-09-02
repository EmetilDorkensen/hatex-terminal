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
  AlertCircle,
  ArrowUpRight,
  Bell,
  Briefcase,
  CheckCircle2,
  Code2,
  Globe2,
  Headset,
  Loader2,
  Lock,
  Package,
  Plug,
  Receipt,
  ShieldCheck,
} from 'lucide-react';

function transferHistoryBody(status: string): string {
  if (status === 'success') return 'Depoze sou nimewo sa a';
  if (status === 'wallet_full') return 'Kont MonCash plen — an atant';
  return 'Transfè pa t pase';
}

type HistoryItem = { id: string; title: string; body: string; created_at: string };

function mapRecentHistory(data: {
  notifications?: { id: string; title: string; body: string | null; created_at: string }[];
  transfers?: { id: string; amount: number; phone: string; status: string; created_at: string }[];
}): HistoryItem[] {
  const transfers = Array.isArray(data.transfers) ? data.transfers : [];
  const notifs = Array.isArray(data.notifications) ? data.notifications : [];
  const items: HistoryItem[] = [
    ...transfers.map((t) => ({
      id: `t-${t.id}`,
      title: `${Number(t.amount || 0).toLocaleString('fr-FR')} HTG · ${t.phone}`,
      body: transferHistoryBody(t.status),
      created_at: t.created_at,
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

async function loadNotifsAndHistory(): Promise<{ unread: number; history: HistoryItem[] }> {
  try {
    const [notifRes, histRes] = await Promise.all([
      fetch('/api/v2/notifications'),
      fetch('/api/v2/history?limit=5'),
    ]);
    const data = await notifRes.json();
    const histData = histRes.ok ? await histRes.json() : { transactions: [] };
    const fromNotifs = mapRecentHistory(data);
    const fromTx = ((histData.transactions || []) as { id: string; description: string; amount: number; created_at: string; type: string }[]).map(
      (t) => ({
        id: `h-${t.id}`,
        title: t.description,
        body: `${t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toLocaleString('fr-FR')} HTG · ${t.type}`,
        created_at: t.created_at,
      })
    );
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

const SHORTCUTS = [
  { href: '/plugin', label: 'Plugin', icon: Plug },
  { href: '/invoice', label: 'Fakti', icon: Receipt },
  { href: '/dashboard/products', label: 'Pwodwi', icon: Package },
  { href: '/developer', label: 'API', icon: Code2 },
] as const;

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
  const [recentHistory, setRecentHistory] = useState<
    { id: string; title: string; body: string; created_at: string }[]
  >([]);
  const [workspacePassword, setWorkspacePassword] = useState('');
  const [workspacePasswordConfirm, setWorkspacePasswordConfirm] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [isLoggingAdmin, setIsLoggingAdmin] = useState(false);

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
          loadNotifsAndHistory(),
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
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
      <main className="flex-grow w-full max-w-lg mx-auto px-4 pt-4 pb-28 sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl lg:px-6 lg:pt-6 lg:pb-12">
        {/* Header Meru-style: avatar + non + 3 ikòn */}
        <header className="flex items-center justify-between gap-3 mb-6 lg:mb-8">
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
                  <div className="w-full h-full flex items-center justify-center text-indigo-600 text-lg font-bold">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </label>
            <div className="min-w-0">
              <p className="text-[11px] lg:text-xs text-slate-500 font-medium">Bonjou</p>
              <h1 className="text-lg lg:text-2xl font-bold text-slate-900 truncate">{firstName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
            <Link
              href="/notifikasyon"
              className="relative w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              aria-label="Notifikasyon"
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
              className="w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              aria-label="Sipò"
            >
              <Headset size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <DashboardAlerts
          walletFull={walletFull}
          usage={usage}
          effectivePlan={effectivePlan}
          nearLimit={nearLimit}
          kycOk={kycOk}
          kycPending={kycPending}
          intendedPlan={userData?.intended_plan || billing?.profile?.intended_plan}
        />

        {/* Layout: sou gwo ekran, tab live ak aksyon kote a kote */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start mb-7">
          <div className="lg:col-span-3 order-2 lg:order-1">
            {userData?.id && <LiveTransactionsPanel userId={userData.id} gate={gate} />}
          </div>

          <div className="lg:col-span-2 order-1 lg:order-2 space-y-3 mb-5 lg:mb-0">
            {/* Bank anvan Kreye peman / Fakti */}
            <button
              type="button"
              onClick={() => setShowBankModal(true)}
              className="w-full bg-white border border-slate-900/80 rounded-2xl py-3.5 lg:py-4 px-4 flex items-center justify-center gap-2.5 font-bold text-sm text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <Globe2 size={18} className="text-indigo-600" />
              KONEKTE KONT BANK OU
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard/products/new"
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-3.5 lg:py-4 px-3 sm:px-4 flex items-center justify-center gap-2 font-bold text-sm shadow-sm transition-colors"
              >
                <ArrowUpRight size={16} /> Kreye yon pwodwi
              </Link>
              <Link
                href="/plugin"
                className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-900/80 rounded-2xl py-3.5 lg:py-4 px-3 sm:px-4 flex items-center justify-center gap-2 font-bold text-sm transition-colors"
              >
                <Plug size={16} /> Plugin
              </Link>
            </div>
          </div>
        </div>

        {/* Rakoursi — orizontal sou mobil, griy sou desktop */}
        <section className="mb-8">
          <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-4">Rakoursi ou yo</h2>
          <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none sm:grid sm:grid-cols-3 md:grid-cols-6 sm:overflow-visible sm:mx-0 sm:px-0">
            {SHORTCUTS.map((item) => (
              <Link
                key={item.href}
                href={gate ?? item.href}
                className="flex flex-col items-center gap-2 shrink-0 w-[72px] sm:w-auto sm:py-3 sm:px-2 sm:rounded-2xl sm:hover:bg-white sm:border sm:border-transparent sm:hover:border-gray-200 sm:transition-colors"
              >
                <span className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
                  <item.icon size={22} strokeWidth={1.75} />
                </span>
                <span className="text-[11px] lg:text-xs font-semibold text-slate-700 text-center leading-tight px-0.5">
                  {item.label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-3">5 dènye mesaj istorik</h2>
          {recentHistory.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 text-xs text-slate-500">
              Lè sistèm nan depoze yon kòb sou MonCash ou, 5 dènye mesaj yo ap parèt isit la.
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
                    {new Date(h.created_at).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Anons */}
        <section className="mb-8">
          <h2 className="text-base lg:text-lg font-bold text-slate-900 mb-3">Avèk HatexCard ou kapab!</h2>
          <div className="bg-white border border-gray-200 rounded-3xl p-5 lg:p-6 shadow-sm flex gap-4 overflow-hidden relative max-w-3xl">
            <div className="flex-1 min-w-0 z-10">
              {announcement.active && announcement.text ? (
                <>
                  <p className="text-sm font-bold text-slate-900 mb-1.5">Anons HatexCard</p>
                  <p className="text-xs lg:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {announcement.text}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-slate-900 mb-1.5">Pasèl MonCash pou machann</p>
                  <p className="text-xs lg:text-sm text-slate-600 leading-relaxed">
                    Kliyan peye, HatexCard pran yon ti frè, rès la ale sou nimewo MonCash ou. Pa gen
                    wallet — ou se machann, nou se pasèl.
                  </p>
                </>
              )}
            </div>
            <div className="w-24 shrink-0 flex items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center shadow-md">
                <img
                  src="https://i.imgur.com/xDk58Xk.png"
                  alt="Hatexcard"
                  className="w-12 h-12 rounded-xl object-cover border border-white/30"
                />
              </div>
            </div>
          </div>
        </section>

        {kycOk && (
          <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={14} className="shrink-0" />
            Kont machann aktif — peman ale sou MonCash ou.
          </div>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={antreNanAdmin}
            disabled={isLoggingAdmin}
            className="mt-6 w-full bg-rose-50 border border-rose-200 text-rose-700 py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoggingAdmin ? <Loader2 size={14} className="animate-spin" /> : <Briefcase size={14} />}
            Sipè Admin
          </button>
        )}
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
              <div className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md">
                <Lock size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isFirstTimeWorkspaceSetup ? 'Kreye Modpas Espas Travay' : 'Aksè Espas Travay'}
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
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500"
              />
              {isFirstTimeWorkspaceSetup && (
                <input
                  type="password"
                  required
                  value={workspacePasswordConfirm}
                  onChange={(e) => setWorkspacePasswordConfirm(e.target.value)}
                  placeholder="Konfime modpas"
                  className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-indigo-500"
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
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2"
              >
                {workspaceLoading ? <Loader2 size={16} className="animate-spin" /> : 'Antre'}
              </button>
            </form>
          </div>
        </div>
      )}
    </MerchantShell>
  );
}

function DashboardAlerts({
  walletFull,
  usage,
  effectivePlan,
  nearLimit,
  kycOk,
  kycPending,
  intendedPlan,
}: Readonly<{
  walletFull: { amount?: number }[];
  usage?: { used?: number; limit?: number | null } | null;
  effectivePlan: string;
  nearLimit: boolean;
  kycOk: boolean;
  kycPending: boolean;
  intendedPlan?: string | null;
}>) {
  const needsKyc =
    !kycOk && (intendedPlan === 'capacity' || intendedPlan === 'premium');
  return (
    <>
      {walletFull.length > 0 && (
        <div className="mb-5 lg:mb-6 bg-rose-600 text-white rounded-3xl p-5 lg:p-6 shadow-lg">
          <p className="text-sm font-black uppercase tracking-wide leading-snug">
            Sistèm nan ap eseye depoze yon kòb sou kont ou men sanble kont MonCash ou plen
          </p>
          <p className="text-xs mt-2 text-rose-50 leading-relaxed">
            Fè retrè pi rapid ke posib. Si kòb la fè 10 jou nan sistèm nan san nou pa ka depoze l
            sou kont pèsonèl ou, kòb sa a ap konsidere kòm lajan pèdi. Mete yon dezyèm nimewo
            MonCash nan « Konekte kont bank ou » — sistèm nan ap eseye yo youn pa youn.
          </p>
          <p className="text-[11px] mt-3 font-semibold text-rose-100">
            {walletFull.length} transfè an atant · {Number(walletFull[0]?.amount || 0).toLocaleString('fr-FR')} HTG
          </p>
        </div>
      )}

      {usage && (
        <div className="mb-5 bg-white border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Kota jodi a · Plan {effectivePlan}
            </p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {Number(usage.used || 0).toLocaleString('fr-FR')} HTG
              {usage.limit != null ? ` / ${Number(usage.limit).toLocaleString('fr-FR')} HTG` : ' · san limit'}
            </p>
            {usage.limit != null && (
              <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${nearLimit ? 'bg-amber-500' : 'bg-indigo-600'}`}
                  style={{ width: `${Math.min(100, Math.round((Number(usage.used || 0) / usage.limit) * 100))}%` }}
                />
              </div>
            )}
          </div>
          <Link
            href="/plan"
            className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-indigo-600 border border-indigo-200 rounded-xl px-3 py-2 hover:bg-indigo-50"
          >
            Elaji kont ou
          </Link>
        </div>
      )}

      {effectivePlan === 'free' && (
        <div className="mb-5 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 leading-relaxed">
          <strong>Elaji kont ou</strong> — sou plan Gratis ou ka resevwa 25 000 HTG/jou sou tout
          chanèl (API, fakti, lyen, vann sèvis). Lè kota a rive, kliyan yo wè:{' '}
          « Kont machann nan pa elaji pou l resevwa lajan an. »
        </div>
      )}

      {needsKyc && (
        <div className="mb-5 lg:mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 lg:p-5 flex items-start gap-3">
          <ShieldCheck className="text-amber-600 shrink-0 mt-0.5" size={20} />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {kycPending ? 'Dokiman KYC ou nan revizyon' : 'KYC obligatwa pou plan peye'}
            </p>
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Ou ka itilize sistèm nan ak limit 25 000 HTG/jou pandan w ap fini KYC.
            </p>
            <Link
              href="/kyc/v2"
              className="mt-2 inline-block text-[11px] font-bold uppercase tracking-wider text-amber-900 underline"
            >
              {kycPending ? 'Gade dosye a' : 'Kòmanse KYC'}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
