"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CheckCircle2, Download, Info } from 'lucide-react';
import jsPDF from 'jspdf';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const transactionId = searchParams.get('id');
  const amountParam = searchParams.get('amount');
  const refParam = searchParams.get('ref');

  const [transaction, setTransaction] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [payer, setPayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  /** Si peman te reyisi men lekti resi echwe — pa janm di "tranzaksyon pa jwenn" */
  const [confirmedWithoutDetail, setConfirmedWithoutDetail] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const maskEmail = (email: string) => {
    if (!email) return 'N/A';
    const [user, domain] = email.split('@');
    if (user.length <= 3) return email;
    return `${user.substring(0, 3)}***@${domain}`;
  };

  useEffect(() => {
    async function loadTransaction() {
      if (!transactionId && !refParam) {
        // Pa gen ID — montre siksè jenerik pou evite kliyan peye 2 fwa
        setConfirmedWithoutDetail(true);
        setLoading(false);
        return;
      }

      try {
        let tx: any = null;

        if (transactionId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            transactionId
          );
          if (isUuid) {
            const { data } = await supabase
              .from('transactions')
              .select('*')
              .eq('id', transactionId)
              .maybeSingle();
            tx = data;
          } else {
            // Ansyen fòma HTX-XXXX — chèche pa reference_id oswa metadata
            const { data } = await supabase
              .from('transactions')
              .select('*')
              .or(
                `reference_id.eq.${transactionId},reference_id.eq.${transactionId}-C,reference_id.eq.${transactionId}-M`
              )
              .limit(1)
              .maybeSingle();
            tx = data;
          }
        }

        if (!tx && refParam) {
          const { data } = await supabase
            .from('transactions')
            .select('*')
            .or(`reference_id.eq.${refParam}-C,reference_id.eq.${refParam}-M,reference_id.eq.${refParam}`)
            .limit(1)
            .maybeSingle();
          tx = data;
        }

        if (!tx) {
          // Peman deja pase sou sèvè — montre siksè san detay pou pa fo-alarme kliyan
          setConfirmedWithoutDetail(true);
          setTransaction(
            amountParam
              ? { id: transactionId || refParam, amount: Number(amountParam), created_at: new Date().toISOString() }
              : { id: transactionId || refParam, amount: null, created_at: new Date().toISOString() }
          );
          setLoading(false);
          return;
        }

        setTransaction(tx);

        const { data: merch } = await supabase
          .from('profiles')
          .select('id, full_name, business_name, email, phone, avatar_url')
          .eq('id', tx.user_id)
          .maybeSingle();

        if (merch) setMerchant(merch);

        if (tx.metadata?.customer_name) {
          setPayer({
            full_name: tx.metadata.customer_name,
            email: tx.metadata.customer_email || null,
          });
        }
      } catch {
        setConfirmedWithoutDetail(true);
        setTransaction(
          amountParam
            ? { id: transactionId, amount: Number(amountParam), created_at: new Date().toISOString() }
            : { id: transactionId, amount: null, created_at: new Date().toISOString() }
        );
      } finally {
        setLoading(false);
      }
    }

    loadTransaction();
  }, [transactionId, refParam, amountParam, supabase]);

  const downloadReceipt = async () => {
    if (!transaction) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229);
    doc.text('HATEXCARD', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('REÇU DE PAIEMENT', pageWidth / 2, 45, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 50, pageWidth - 20, 50);

    doc.setFontSize(11);
    doc.text(`Transaction ID: ${transaction.id || 'N/A'}`, 25, 65);
    doc.text(`Date: ${new Date(transaction.created_at).toLocaleString('fr-HT')}`, 25, 75);
    if (transaction.amount != null) {
      doc.text(`Montant: ${Number(transaction.amount).toLocaleString()} HTG`, 25, 85);
    }
    doc.text(`Marchand: ${merchant?.business_name || merchant?.full_name || 'Hatex Marchand'}`, 25, 95);
    doc.text(`Client: ${payer?.full_name || 'Hatex User'}`, 25, 105);

    doc.setFontSize(8);
    doc.text('Mèsi paske ou itilize Hatexcard pou tranzaksyon ou yo.', pageWidth / 2, 280, {
      align: 'center',
    });
    doc.save(`hatex-${String(transaction.id || 'receipt').slice(0, 8)}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const displayAmount =
    transaction?.amount != null
      ? Math.abs(Number(transaction.amount))
      : amountParam
        ? Number(amountParam)
        : null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-[500px] bg-white p-8 md:p-12 rounded-[2rem] border border-gray-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>

        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-50 p-4 rounded-full border border-emerald-100">
              <CheckCircle2 className="text-emerald-500 w-12 h-12" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">Peman Reyisi</h1>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-8">
            Konfimasyon Tranzaksyon
          </p>

          <div className="bg-slate-50 p-6 rounded-2xl mb-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Montan total</span>
              <span className="text-3xl font-bold text-slate-900">
                {displayAmount != null ? displayAmount.toLocaleString() : '—'}{' '}
                <span className="text-emerald-600 text-sm">HTG</span>
              </span>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Kliyan</span>
                <span className="text-sm font-semibold text-slate-900">
                  {payer?.full_name || 'Hatex User'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Machann</span>
                <span className="text-sm font-semibold text-slate-900">
                  {merchant?.business_name || merchant?.full_name || 'Machann Hatex'}
                </span>
              </div>
              {merchant?.email && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Kontak Machann</span>
                  <span className="text-sm text-slate-600">{maskEmail(merchant.email)}</span>
                </div>
              )}
              {(transactionId || refParam) && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-medium">Referans</span>
                  <span className="text-xs font-mono text-slate-700">
                    {String(transactionId || refParam).slice(0, 16)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-8 flex gap-3 items-start text-left">
            <Info className="text-indigo-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-indigo-900 font-medium leading-relaxed">
              {confirmedWithoutDetail
                ? 'Peman ou a te pase. Lajan an deja debite. Pa eseye peye ankò. Ou ka wè tranzaksyon an nan istorik ou apre ou konekte.'
                : `Tranzaksyon sa a anrejistre nan istorik ou. Machann nan resevwa yon notifikasyon pou lavant sa a.`}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={downloadReceipt}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Download size={18} /> Telechaje Resi PDF
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 py-4 rounded-xl font-bold text-sm transition-all shadow-sm"
            >
              Tounen nan Akey
            </button>
          </div>

          <div className="mt-8 flex justify-center items-center gap-2">
            <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-4 h-4 rounded-sm" />
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
              Hatexcard Secure Network © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-slate-50 min-h-screen flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
