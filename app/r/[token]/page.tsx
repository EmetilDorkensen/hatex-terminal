'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeImg from '@/components/SafeImg';
import { CATEGORY_LABELS, type ReservationCategory } from '@/lib/reservations/types';

export default function MerchantSharePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [listings, setListings] = useState<any[]>([]);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/reservations/listings?token=${encodeURIComponent(token)}`);
      const json = await res.json();
      if (json.success) {
        setListings(json.listings || []);
        setMerchant(json.merchant || json.listings?.[0]?.merchant || null);
      }
      setLoading(false);
    })();
  }, [token]);

  // Load merchant name even if empty listings
  useEffect(() => {
    if (!loading && !merchant) {
      // noop — merchant embedded in listings
    }
  }, [loading, merchant]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <p className="text-indigo-300 text-xs font-bold tracking-widest uppercase">HatexCard Rezèvasyon</p>
        <h1 className="text-3xl font-semibold mt-2">{merchant?.business_name || 'Boutik machann'}</h1>
        <p className="text-white/60 text-sm mt-2">
          Peye ak kat HatexCard sou ofri sa yo.
        </p>

        {loading ? (
          <p className="py-16 text-center text-white/50">Ap chaje…</p>
        ) : listings.length === 0 ? (
          <p className="py-16 text-center text-white/50">Pa gen ofri aktif.</p>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {listings.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => router.push(`/rezervasyon/${l.id}?from=share`)}
                className="text-left bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10"
              >
                <div className="aspect-[4/3] bg-slate-800">
                  {l.photos?.[0] && (
                    <SafeImg src={l.photos[0]} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-[10px] uppercase font-bold text-indigo-300">
                    {CATEGORY_LABELS[l.category as ReservationCategory]}
                  </p>
                  <p className="font-semibold mt-1">{l.title}</p>
                  <p className="text-indigo-200 font-bold mt-2">
                    {Number(l.price).toLocaleString()} HTG
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-white/40">
          Ou gen kont?{' '}
          <Link href="/rezervasyon" className="text-indigo-300 hover:underline">
            Louvri katalòg konplè
          </Link>
        </p>
      </div>
    </div>
  );
}
