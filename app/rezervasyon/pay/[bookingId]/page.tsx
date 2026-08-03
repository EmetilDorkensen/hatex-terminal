'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { CreditCard, Wallet } from 'lucide-react';

function PayInner() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const forceCard = searchParams.get('card') === '1';
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [method, setMethod] = useState<'wallet' | 'card'>(forceCard ? 'card' : 'wallet');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const [cardBal, setCardBal] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase
          .from('profiles')
          .select('wallet_balance, card_balance')
          .eq('id', user.id)
          .maybeSingle();
        setWalletBal(Number(p?.wallet_balance || 0));
        setCardBal(Number(p?.card_balance || 0));
      }
      const res = await fetch(`/api/reservations/bookings?id=${bookingId}`);
      const json = await res.json();
      const b = json.booking || (json.bookings || []).find((x: any) => x.id === bookingId);
      setBooking(b || null);
      if (b?.listing?.category === 'subscription' || forceCard) setMethod('card');
    })();
  }, [bookingId, forceCard]);

  const pay = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, string> = {
        booking_id: bookingId,
        payment_method: method,
      };
      if (method === 'card') {
        body.card_number = card;
        body.expiry = expiry;
        body.cvv = cvv;
      }
      const res = await fetch('/api/reservations/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.message || 'Peman echwe');
        return;
      }
      router.push(`/rezervasyon/success/${bookingId}`);
    } finally {
      setBusy(false);
    }
  };

  const isSub = booking?.listing?.category === 'subscription';
  const amount = Number(booking?.amount || 0);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-5">
        <h1 className="text-xl font-bold text-slate-900">Peye rezèvasyon</h1>
        {booking ? (
          <>
            <p className="text-sm text-slate-600">{booking.listing?.title || 'Rezèvasyon'}</p>
            <p className="text-3xl font-bold text-indigo-700">{amount.toLocaleString()} HTG</p>
          </>
        ) : (
          <p className="text-sm text-slate-500">Ap chaje detay…</p>
        )}

        {!isSub && !forceCard && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMethod('wallet')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold ${
                method === 'wallet' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200'
              }`}
            >
              <Wallet size={16} /> Wallet
            </button>
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold ${
                method === 'card' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200'
              }`}
            >
              <CreditCard size={16} /> Kat
            </button>
          </div>
        )}

        {method === 'wallet' && walletBal != null && (
          <p className="text-xs text-slate-500">Balans wallet: {walletBal.toLocaleString()} HTG</p>
        )}
        {method === 'card' && cardBal != null && !forceCard && (
          <p className="text-xs text-slate-500">Balans kat ou: {cardBal.toLocaleString()} HTG</p>
        )}

        {method === 'card' && (
          <div className="space-y-3">
            <input
              placeholder="Nimewo kat"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
              value={card}
              onChange={(e) => setCard(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="MM/YY"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
              />
              <input
                placeholder="CVV"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
              />
            </div>
          </div>
        )}

        {isSub && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2">
            Abònman mande peman ak kat HatexCard.
          </p>
        )}

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="button"
          disabled={busy || !booking}
          onClick={() => void pay()}
          className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-50"
        >
          {busy ? 'Ap trete…' : `Peye ${amount ? amount.toLocaleString() + ' HTG' : ''}`}
        </button>
      </div>
    </div>
  );
}

export default function ReservationPayPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">Ap chaje…</div>
      }
    >
      <PayInner />
    </Suspense>
  );
}
