'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Filter, MapPin, Search } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import {
  CATEGORY_LABELS,
  HAITI_ZONES,
  RESERVATION_CATEGORIES,
  type ReservationCategory,
} from '@/lib/reservations/types';

type Listing = {
  id: string;
  title: string;
  price: number;
  category: ReservationCategory;
  zone?: string;
  photos?: string[];
  merchant?: { business_name?: string; logo_url?: string };
};

export default function RezervasyonCatalogPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>('all');
  const [zone, setZone] = useState<string>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (zone !== 'all') params.set('zone', zone);
      const res = await fetch(`/api/reservations/listings?${params}`);
      const json = await res.json();
      if (!cancelled) {
        setListings(json.listings || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, zone]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return listings;
    return listings.filter(
      (l) =>
        l.title.toLowerCase().includes(term) ||
        (l.merchant?.business_name || '').toLowerCase().includes(term) ||
        (l.zone || '').toLowerCase().includes(term)
    );
  }, [listings, q]);

  return (
    <div className="min-h-screen bg-[#0c1222] text-white">
      <div
        className="relative min-h-[42vh] flex flex-col justify-end px-5 pb-10 pt-8 overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(99,102,241,0.35), transparent), linear-gradient(160deg, #0c1222 0%, #1e1b4b 55%, #312e81 100%)',
        }}
      >
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="absolute top-5 left-5 flex items-center gap-2 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft size={16} /> Retounen
        </button>
        <p className="text-indigo-300 text-xs font-bold tracking-[0.2em] uppercase mb-2">HatexCard</p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight max-w-xl leading-[1.05]">
          Rezèvasyon
        </h1>
        <p className="mt-3 text-white/70 max-w-md text-sm sm:text-base">
          Otèl, restoran, bar, machin ak abònman — peye ak wallet oswa kat HatexCard.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 -mt-6 relative z-10 pb-16">
        <div className="bg-white text-slate-900 rounded-2xl shadow-xl border border-white/10 p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Chèche…"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex gap-2 items-center text-xs font-bold text-slate-500">
              <Filter size={14} />
              <select
                className="border border-gray-200 rounded-xl px-3 py-2.5"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Tout kategori</option>
                {RESERVATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2.5"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              >
                <option value="all">Tout zòn</option>
                {HAITI_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <Link href="/rezervasyon/abonnman" className="text-indigo-600 font-semibold hover:underline">
              Jere abònman mwen
            </Link>
            <Link href="/terminal" className="text-indigo-600 font-semibold hover:underline">
              Machann: kreye ofri (Terminal)
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-white/60 py-16">Ap chaje…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-white/60 py-16">Pa gen ofri pou filtre sa a.</p>
        ) : (
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((l) => (
              <Link
                key={l.id}
                href={`/rezervasyon/${l.id}`}
                className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:bg-white/10 transition-colors"
              >
                <div className="aspect-[4/3] bg-slate-800 relative">
                  {l.photos?.[0] ? (
                    <SafeImg src={l.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                      San foto
                    </div>
                  )}
                  <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-black/50 backdrop-blur px-2 py-1 rounded-md">
                    {CATEGORY_LABELS[l.category]}
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-lg leading-snug group-hover:text-indigo-200 transition-colors">
                    {l.title}
                  </h2>
                  <p className="text-sm text-white/50 mt-1">{l.merchant?.business_name || 'Machann'}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-bold text-indigo-300">
                      {Number(l.price).toLocaleString()} HTG
                    </span>
                    {l.zone && (
                      <span className="text-xs text-white/40 flex items-center gap-1">
                        <MapPin size={12} /> {l.zone}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
