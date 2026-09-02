'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Bell, CheckCircle2, History, Loader2, Smartphone } from 'lucide-react';
import { MerchantShell } from '@/components/app-shell/MerchantShell';

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

type Transfer = {
  id: string;
  phone: string;
  amount: number;
  status: string;
  error: string | null;
  tx: string | null;
  created_at: string;
};

export default function NotifikasyonPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [user, setUser] = useState<{
    id?: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v2/notifications');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setItems(data.notifications || []);
      setTransfers(data.transfers || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    void (async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', authUser.id)
        .maybeSingle();
      setUser(data);
    })();
    void load();
  }, []);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await fetch('/api/v2/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      });
      await load();
    } finally {
      setMarking(false);
    }
  };

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <MerchantShell user={user} hideTopChrome>
      <main className="flex-grow w-full max-w-lg mx-auto px-4 pt-6 pb-28">
        <header className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold text-slate-900">Notifikasyon</h1>
          <button
            type="button"
            onClick={markAllRead}
            disabled={marking || unread === 0}
            className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 disabled:text-slate-300"
          >
            {marking ? 'Ap sove…' : 'Make tout li'}
          </button>
        </header>

        {loading ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : (
          <>
            {items.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-200 p-8 text-center shadow-sm">
                <div className="w-14 h-14 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                  <Bell size={22} />
                </div>
                <p className="text-sm font-bold text-slate-900 mb-1">Pa gen notifikasyon</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Lè yon kliyan peye, KYC ou apwouve, oswa gen kèk chanjman enpòtan, w ap wè yo isit
                  la.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((n) => (
                  <li key={n.id}>
                    <NotifRow n={n} />
                  </li>
                ))}
              </ul>
            )}

            <section className="mt-8 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <History size={16} className="text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">Istorik depo MonCash</h2>
              </div>
              {transfers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 text-xs text-slate-500 leading-relaxed">
                  Lè sistèm nan depoze yon kòb sou nimewo MonCash ou, mesaj la ap parèt isit la —
                  ak nimewo kote lajan an te ale.
                </div>
              ) : (
                <ul className="space-y-2">
                  {transfers.map((t) => (
                    <li
                      key={t.id}
                      className="bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-3"
                    >
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${transferTone(t.status)}`}
                      >
                        <Smartphone size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {t.amount.toLocaleString('fr-FR')} HTG · {t.phone}
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {transferLabel(t.status, t.error)}
                        </p>
                        {t.tx && (
                          <p className="text-[10px] font-mono text-slate-400 mt-1 truncate">
                            Tx {t.tx}
                          </p>
                        )}
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-1">
                          {new Date(t.created_at).toLocaleString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </MerchantShell>
  );
}

function transferTone(status: string): string {
  if (status === 'success') return 'bg-emerald-50 text-emerald-600';
  if (status === 'wallet_full') return 'bg-rose-50 text-rose-600';
  return 'bg-amber-50 text-amber-600';
}

function transferLabel(status: string, error?: string | null): string {
  if (status === 'success') return 'Depoze sou nimewo sa a';
  if (status === 'wallet_full') return 'Kont plen — an atant';
  return error || 'Echwe';
}

function NotifRow({ n }: { n: Notif }) {
  const isUnread = !n.read_at;
  const inner = (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
        isUnread ? 'bg-white border-indigo-200 shadow-sm' : 'bg-white/60 border-gray-200'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          isUnread ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {isUnread ? <Bell size={16} /> : <CheckCircle2 size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{n.title}</p>
        {n.body && <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.body}</p>}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-2">
          {new Date(n.created_at).toLocaleString('fr-FR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );

  return n.href ? <Link href={n.href}>{inner}</Link> : inner;
}
