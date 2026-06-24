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
  
  const [transaction, setTransaction] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [payer, setPayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // FONKSYON POU MASKE IMÈL LA (3 premye lèt sèlman)
  const maskEmail = (email: string) => {
    if (!email) return 'N/A';
    const [user, domain] = email.split('@');
    if (user.length <= 3) return email;
    return `${user.substring(0, 3)}***@${domain}`;
  };

  useEffect(() => {
    async function loadTransaction() {
      if (!transactionId) {
        setError('ID tranzaksyon manke.');
        setLoading(false);
        return;
      }

      try {
        // 1. Chache tranzaksyon an
        const { data: tx, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', transactionId)
          .single();

        if (txError || !tx) {
          setError('Tranzaksyon pa jwenn.');
          setLoading(false);
          return;
        }
        setTransaction(tx);

        // 2. Chache enfòmasyon machann nan
        const { data: merch } = await supabase
          .from('profiles')
          .select('id, full_name, business_name, email, phone, avatar_url')
          .eq('id', tx.user_id)
          .single();

        if (merch) setMerchant(merch);

        // 3. Chache enfòmasyon kliyan an (depi nan metadata)
        if (tx.metadata?.customer_name) {
          setPayer({ 
            full_name: tx.metadata.customer_name,
            email: tx.metadata.customer_email || null 
          });
        }
      } catch (err) {
        setError('Erè pandan chajman done.');
      } finally {
        setLoading(false);
      }
    }

    loadTransaction();
  }, [transactionId, supabase]);

  const downloadReceipt = async () => {
    if (!transaction || !merchant) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Koule Bleu/Indigo pou tit PDF la
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // text-indigo-600
    doc.text('HATEXCARD', pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // text-slate-900
    doc.text('REÇU DE PAIEMENT', pageWidth / 2, 45, { align: 'center' });
    
    doc.setDrawColor(226, 232, 240); // text-slate-200
    doc.line(20, 50, pageWidth - 20, 50);

    doc.setFontSize(11);
    doc.text(`Transaction ID: ${transaction.id}`, 25, 65);
    doc.text(`Date: ${new Date(transaction.created_at).toLocaleString('fr-HT')}`, 25, 75);
    doc.text(`Montant: ${transaction.amount.toLocaleString()} HTG`, 25, 85);
    doc.text(`Marchand: ${merchant.business_name || merchant.full_name}`, 25, 95);
    doc.text(`Client: ${payer?.full_name || 'Hatex User'}`, 25, 105);

    doc.setFontSize(8);
    doc.text('Mèsi paske ou itilize Hatexcard pou tranzaksyon ou yo.', pageWidth / 2, 280, { align: 'center' });
    doc.save(`hatex-${transaction.id.slice(0, 8)}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center w-full max-w-md">
          <p className="text-slate-900 font-bold mb-4">{error}</p>
          <button onClick={() => router.push('/dashboard')} className="text-indigo-600 hover:underline text-sm font-semibold">Tounen nan Akey la</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-[500px] bg-white p-8 md:p-12 rounded-[2rem] border border-gray-200 shadow-xl relative overflow-hidden">
        
        {/* Dekorasyon Koule nan tèt */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>

        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-emerald-50 p-4 rounded-full border border-emerald-100">
              <CheckCircle2 className="text-emerald-500 w-12 h-12" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">Peman Reyisi</h1>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-8">Konfimasyon Tranzaksyon</p>

          {/* BOX DETAY PEMAN AN */}
          <div className="bg-slate-50 p-6 rounded-2xl mb-6 border border-gray-200">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">Montan total</span>
              <span className="text-3xl font-bold text-slate-900">{transaction.amount.toLocaleString()} <span className="text-emerald-600 text-sm">HTG</span></span>
            </div>
            
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Kliyan</span>
                <span className="text-sm font-semibold text-slate-900">{payer?.full_name || 'Hatex User'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Machann</span>
                <span className="text-sm font-semibold text-slate-900">{merchant?.business_name || merchant?.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-medium">Kontak Machann</span>
                <span className="text-sm text-slate-600">{merchant ? maskEmail(merchant.email) : '***@***'}</span>
              </div>
            </div>
          </div>

          {/* MESAJ ISTORIK */}
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-8 flex gap-3 items-start text-left">
            <Info className="text-indigo-600 shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-indigo-900 font-medium leading-relaxed">
              Tranzaksyon sa a anrejistre nan istorik ou ak pa machann nan. 
              Machann nan ({merchant?.business_name}) resevwa yon notifikasyon pou lavant sa a.
            </p>
          </div>

          {/* BOUTON YO */}
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

          {/* FOOTER MINI */}
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
    <Suspense fallback={
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}