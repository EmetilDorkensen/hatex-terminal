'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { ReservationReceiptActions, type ReceiptSnapshot } from '@/components/reservations/ReceiptActions';

export default function ReservationSuccessPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<ReceiptSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    (async () => {
      const { data } = await supabase
        .from('reservation_bookings')
        .select('id, status, receipt_snapshot, reference_id, amount')
        .eq('id', bookingId)
        .maybeSingle();
      if (data?.receipt_snapshot) {
        setSnapshot(data.receipt_snapshot as ReceiptSnapshot);
      } else if (data) {
        setSnapshot({
          amount: Number(data.amount),
        });
      }
      setLoading(false);
    })();
  }, [bookingId]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-8 shadow-sm text-center space-y-5">
        <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
        <h1 className="text-2xl font-bold text-slate-900">Peman reyisi</h1>
        <p className="text-sm text-slate-500">
          Telechaje resi a pou montre l lè ou rive. Ou ka kontakte machann nan sou WhatsApp.
        </p>
        {!loading && <ReservationReceiptActions snapshot={snapshot} />}
        <button
          type="button"
          onClick={() => router.push('/rezervasyon')}
          className="text-sm font-semibold text-indigo-600 hover:underline"
        >
          Retounen nan katalòg
        </button>
      </div>
    </div>
  );
}
