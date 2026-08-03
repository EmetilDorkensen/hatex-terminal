'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

export default function ManageSubscriptionsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id || null);
    const res = await fetch('/api/reservations/subscriptions');
    const json = await res.json();
    setSubs(json.subscriptions || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const cancel = async (id: string) => {
    if (!confirm('Anile abònman sa a?')) return;
    setBusyId(id);
    try {
      await fetch('/api/reservations/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription_id: id }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const mine = subs.filter((s) => s.buyer_id === userId);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => router.push('/rezervasyon')}
          className="flex items-center gap-2 text-sm text-slate-600 mb-6"
        >
          <ArrowLeft size={16} /> Rezèvasyon
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Abònman mwen</h1>
        {loading ? (
          <Loader2 className="animate-spin text-indigo-600" />
        ) : mine.length === 0 ? (
          <p className="text-slate-500 text-sm">Ou pa gen abònman marketplace aktif.</p>
        ) : (
          <div className="space-y-3">
            {mine.map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                <p className="font-semibold text-slate-900">{s.listing?.title || 'Abònman'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {s.status} · {Number(s.amount).toLocaleString()} HTG chak {s.billing_interval_days} jou
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Pwochen: {new Date(s.next_billing_date).toLocaleDateString('fr-HT')}
                </p>
                {s.status !== 'cancelled' && (
                  <button
                    type="button"
                    disabled={busyId === s.id}
                    onClick={() => void cancel(s.id)}
                    className="mt-3 text-xs font-bold text-red-600 hover:underline"
                  >
                    {busyId === s.id ? '…' : 'Anile abònman'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
