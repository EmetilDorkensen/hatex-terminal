'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock, MapPin } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import { CATEGORY_LABELS, type ListingMeta, type ReservationCategory } from '@/lib/reservations/types';

function ListingDetailInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const fromShare = searchParams.get('from') === 'share';
  const router = useRouter();
  const [listing, setListing] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [delivery, setDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/reservations/listings/${id}`);
      const json = await res.json();
      if (json.success) {
        setListing(json.listing);
        setMerchant(json.merchant);
      }
      setLoading(false);
    })();
  }, [id]);

  const meta = (listing?.meta || {}) as ListingMeta;
  const category = listing?.category as ReservationCategory;
  const isSub = category === 'subscription';

  const book = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/reservations/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: id,
          scheduled_at: isSub ? undefined : scheduledAt,
          scheduled_end: isSub ? undefined : scheduledEnd || undefined,
          quantity,
          delivery_requested: delivery,
          delivery_address: deliveryAddress,
          customer_note: customerNote.trim() || undefined,
          from_share: fromShare,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.message || 'Erè');
        return;
      }
      router.push(
        `/rezervasyon/pay/${json.booking.id}?card=1${fromShare ? '&from=share' : ''}`
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Ap chaje…
      </div>
    );
  }
  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Ofri pa jwenn.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button
          type="button"
          onClick={() => router.push('/rezervasyon')}
          className="flex items-center gap-2 text-sm text-slate-600 mb-4"
        >
          <ArrowLeft size={16} /> Katalòg
        </button>

        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {(listing.photos?.length ? listing.photos : [null])
            .slice(0, 5)
            .map((url: string | null, i: number) => (
              <div key={i} className="aspect-[4/3] rounded-2xl overflow-hidden bg-slate-200">
                {url ? <SafeImg src={url} alt="" className="w-full h-full object-cover" /> : null}
              </div>
            ))}
        </div>

        <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
          {CATEGORY_LABELS[category]}
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 mt-1">{listing.title}</h1>
        <p className="text-slate-500 mt-1">{merchant?.business_name}</p>
        <p className="text-2xl font-bold text-indigo-700 mt-3">
          {Number(listing.price).toLocaleString()} HTG
          {(category === 'hotel_room' || category === 'car_rental') && (
            <span className="text-sm font-medium text-slate-400">
              {' '}
              / {category === 'car_rental' ? 'jou' : 'nuit'}
            </span>
          )}
          {isSub && meta.billing_interval_days && (
            <span className="text-sm font-medium text-slate-400">
              {' '}
              / chak {meta.billing_interval_days} jou
            </span>
          )}
        </p>

        {listing.description && (
          <p className="mt-4 text-slate-700 text-sm leading-relaxed">{listing.description}</p>
        )}

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {meta.car_make && (
            <p>
              Machin: <strong>{meta.car_make}</strong>
              {meta.car_year ? ` (${meta.car_year})` : ''}
            </p>
          )}
          {listing.address && (
            <p className="flex items-center gap-2">
              <MapPin size={14} /> {listing.address}
              {meta.house_number ? ` · #${meta.house_number}` : ''}
            </p>
          )}
          {(meta.opens_at || meta.closes_at) && (
            <p className="flex items-center gap-2">
              <Clock size={14} /> {meta.opens_at} – {meta.closes_at}
            </p>
          )}
          {meta.conditions && (
            <p className="bg-white border rounded-xl p-3 text-sm">{meta.conditions}</p>
          )}
        </div>

        <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <h2 className="font-bold text-slate-900">
            {isSub ? 'Pran abònman' : 'Fè rezèvasyon'}
          </h2>

          {isSub ? (
            <>
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
                Abònman: peman ak kat HatexCard obligatwa. Sistèm nan ap debite chak{' '}
                {meta.billing_interval_days || 30} jou. Ou ka anile nenpòt lè nan « Abònman mwen ».
              </p>
              <Link
                href="/rezervasyon/abonnman"
                className="block text-xs font-semibold text-indigo-600 hover:underline"
              >
                Jere / anile abònman mwen →
              </Link>
            </>
          ) : (
            <>
              <label className="block text-xs font-semibold text-slate-600">
                Dat / lè ou pral vin
                <input
                  type="datetime-local"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </label>
              {(category === 'hotel_room' || category === 'car_rental') && (
                <label className="block text-xs font-semibold text-slate-600">
                  Dat fini (opsyonèl)
                  <input
                    type="datetime-local"
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                    value={scheduledEnd}
                    onChange={(e) => setScheduledEnd(e.target.value)}
                  />
                </label>
              )}
              {(category === 'restaurant_dish' || category === 'bar') && (
                <label className="block text-xs font-semibold text-slate-600">
                  Kantite
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  />
                </label>
              )}
              {category === 'restaurant_dish' && meta.delivery_enabled && (
                <div className="space-y-2 border border-indigo-50 bg-indigo-50/40 rounded-xl p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={delivery}
                      onChange={(e) => setDelivery(e.target.checked)}
                    />
                    Livre lakay (+{Number(meta.delivery_fee || 0).toLocaleString()} HTG)
                  </label>
                  {delivery && (
                    <input
                      placeholder="Adrès livrezon"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                    />
                  )}
                </div>
              )}
            </>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Sa ou ta renmen anplis? (opsyonèl)
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Egzanp: san piman, tab bò fenèt, randevou 6è, elatriye…"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-y min-h-[80px]"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
            />
            <span className="text-[10px] text-slate-400 font-medium">
              Nòt sa a ap ale nan WhatsApp ak imèl machann nan.
            </span>
          </label>

          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="button"
            disabled={busy || (!isSub && !scheduledAt)}
            onClick={() => void book()}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
          >
            {busy ? 'Ap kreye…' : isSub ? 'Kontinye pou peye abònman' : 'Kontinye pou peye'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ListingDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
          Ap chaje…
        </div>
      }
    >
      <ListingDetailInner />
    </Suspense>
  );
}
