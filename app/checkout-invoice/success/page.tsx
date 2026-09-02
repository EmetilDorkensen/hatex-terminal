'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, Loader2 } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stuck, setStuck] = useState(false);

  /**
   * DB = verite a: nou pa janm deklare "Peman reyisi" sèlman paske paramèt
   * navigatè a di 'success'. Nou li resi a (ki soti nan baz done a) epi nou
   * verifye jis DB di fakti a 'paid'. Pandan se tan, paj la ap verifye.
   */
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | null = null;
    const MAX_ATTEMPTS = 8;

    async function getDetails() {
      if (cancelled) return;
      if (!id) {
        if (!cancelled) setLoading(false);
        return;
      }
      let paidOnDb = false;
      try {
        const res = await fetch(`/api/checkout-invoice/${encodeURIComponent(String(id))}/receipt`);
        const data = await res.json();
        if (res.ok && data.ok) {
          paidOnDb = data.invoice?.status === 'paid';
          if (!cancelled) setDetails(data);
        }
      } catch {
        // Paj la mache menm si resi a pa ka chaje.
      }

      if (cancelled) return;
      if (paidOnDb) {
        setLoading(false);
        return;
      }

      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        setLoading(false);
        // DB pa janm konfime pandan tout tcheke yo — pa deklare siksè.
        if (status === 'success') setStuck(true);
        return;
      }
      // Konfimasyon an ka poko fin parèt nan baz done a — tcheke ankò.
      timer = window.setTimeout(() => void getDetails(), 2500);
    }

    void getDetails();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const inv = details?.invoice;
  // Sèlman DB ka konfime 'paid' — pa janm paramèt navigatè a.
  const paid = inv?.status === 'paid';
  const verifying = !paid && !loading && !stuck && !!id && status === 'success';
  const merchant = details?.merchant?.name || 'Machann';
  const cur = inv?.currency === 'USD' ? 'USD' : 'HTG';
  const shownRef = inv?.ref ? String(inv.ref).slice(0, 12) : String(id || '').slice(0, 12);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center p-6 pt-16 font-sans">
      <div id="receipt" className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-xl border border-gray-100 mb-6">
        <div className="text-center border-b border-dashed border-gray-200 pb-4 mb-4">
          {paid ? (
            <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={40} />
          ) : verifying ? (
            <Loader2 className="mx-auto text-indigo-500 mb-2 animate-spin" size={40} />
          ) : stuck ? (
            <HelpCircle className="mx-auto text-amber-500 mb-2" size={40} />
          ) : null}
          <h2 className="text-xl font-bold tracking-tight">
            {paid
              ? 'Peman reyisi'
              : verifying
                ? 'N ap verifye konfimasyon an'
                : stuck
                  ? 'Estati pa klè'
                  : status === 'failed'
                    ? 'Peman echwe'
                    : 'Resi peman'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{new Date().toLocaleString()}</p>
          {verifying && (
            <p className="mt-2 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1.5 leading-relaxed">
              Konfimasyon an ap verifye nan baz done a — ret tann kèk segond. Si kòb la te
              soti sou kont ou, machann nan ap resevwa notifikasyon an.
            </p>
          )}
          {stuck && (
            <p className="mt-2 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-relaxed">
              Konfimasyon an poko parèt nan baz done a. Si kòb la soti sou kont ou, pa
              enkyete w — machann nan ap verifye l ak MonCash. Tcheke istorik ou pita.
            </p>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Machann</span>
            <span className="font-bold text-right">{merchant}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Fakti</span>
            <span className="font-mono text-xs">#{shownRef}</span>
          </div>
          <hr className="border-gray-100" />
          <div className="flex justify-between items-center py-2">
            <span className="font-medium">Montan fakti</span>
            <span className="text-2xl font-black">
              {inv?.amount != null ? Number(inv.amount).toLocaleString() : '—'} {cur}
            </span>
          </div>
          {inv?.description && (
            <p className="text-xs text-slate-500">{inv.description}</p>
          )}
        </div>

        <p className="mt-8 text-center text-[10px] text-slate-400 uppercase tracking-wider">
          Mèsi paske ou itilize HatexCard
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          type="button"
          onClick={() => window.print()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition"
        >
          Telechaje resi
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/';
          }}
          className="w-full bg-white border border-gray-200 hover:bg-slate-50 text-slate-700 py-3 rounded-xl transition text-sm font-semibold"
        >
          Retounen
        </button>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          #receipt, #receipt * { visibility: visible; }
          #receipt { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
        }
      `}</style>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SuccessContent />
    </Suspense>
  );
}
