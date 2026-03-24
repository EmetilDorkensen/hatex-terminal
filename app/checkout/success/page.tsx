"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CheckCircle2, ShoppingBag, Hash, Calendar, Download, Store, User, Mail, Phone, Info } from 'lucide-react';
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

    doc.setFontSize(22);
    doc.setTextColor(230, 46, 4);
    doc.text('HATEXCARD', pageWidth / 2, 30, { align: 'center' });
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('REÇU DE PAIEMENT', pageWidth / 2, 45, { align: 'center' });
    
    doc.setDrawColor(230, 46, 4);
    doc.line(20, 50, pageWidth - 20, 50);

    doc.setFontSize(11);
    doc.text(`Transaction ID: ${transaction.id}`, 25, 65);
    doc.text(`Date: ${new Date(transaction.created_at).toLocaleString('fr-HT')}`, 25, 75);
    doc.text(`Montant: ${transaction.amount.toLocaleString()} HTG`, 25, 85);
    doc.text(`Marchand: ${merchant.business_name || merchant.full_name}`, 25, 95);
    doc.text(`Client: ${payer?.full_name || 'Hatex User'}`, 25, 105);

    doc.setFontSize(8);
    doc.text('Mèsi paske ou itilize HatexCard pou tranzaksyon ou yo.', pageWidth / 2, 280, { align: 'center' });
    doc.save(`hatex-${transaction.id.slice(0, 8)}.pdf`);
  };

  if (loading) return <div className="min-h-screen bg-[#06070d] flex items-center justify-center text-green-500 font-black animate-pulse">VERIFIKASYON...</div>;

  return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-4">
      <div className="w-full max-w-[550px] bg-[#0d0e1a] p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden italic text-white">
        
        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-green-500/20 p-5 rounded-[2rem] border border-green-500/30">
              <CheckCircle2 className="text-green-500 w-12 h-12" />
            </div>
          </div>

          <h1 className="text-3xl font-black uppercase tracking-tighter mb-1">Peman Reyisi !</h1>
          <p className="text-zinc-500 text-[9px] font-bold uppercase mb-8 tracking-[0.3em]">Konfimasyon Tranzaksyon</p>

          {/* BOX DETAY */}
          <div className="bg-zinc-900/40 p-8 rounded-[2.5rem] mb-6 border border-white/5">
            <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/5">
              <span className="text-[10px] font-black text-zinc-500 uppercase">Montan total</span>
              <span className="text-3xl font-black text-white">{transaction.amount.toLocaleString()} <span className="text-green-500 text-xs">HTG</span></span>
            </div>
            
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold">Kliyan</span>
                <span className="text-xs font-bold text-white">{payer?.full_name || 'Hatex User'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold">Machann</span>
                <span className="text-xs font-bold text-white">{merchant?.business_name || merchant?.full_name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-zinc-500 uppercase font-bold">Kontak Machann</span>
                <span className="text-xs font-mono text-zinc-400">{merchant ? maskEmail(merchant.email) : '***@***'}</span>
              </div>
            </div>
          </div>

          {/* MESAJ ISTORIK */}
          <div className="bg-blue-500/5 p-5 rounded-3xl border border-blue-500/10 mb-8 flex gap-3 items-start text-left">
            <Info className="text-blue-500 shrink-0" size={18} />
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Tranzaksyon sa a anrejistre nan **istorik** ou ak pa machann nan. 
              Machann nan ({merchant?.business_name}) resevwa yon notifikasyon pou lavant sa a.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={downloadReceipt}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-5 rounded-[1.8rem] font-black text-[11px] uppercase flex items-center justify-center gap-3 transition-all"
            >
              <Download size={16} /> Telechaje Resi PDF
            </button>

            <button 
              onClick={() => router.push('/')}
              className="w-full bg-white text-black py-5 rounded-[1.8rem] font-black text-[11px] uppercase hover:bg-zinc-200 transition-all"
            >
              Tounen nan Dashboard
            </button>
          </div>

          <p className="mt-10 text-[7px] text-zinc-700 font-black uppercase tracking-[0.5em]">
            HatexCard Secure Network © 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="bg-[#06070d] min-h-screen"></div>}>
      <SuccessContent />
    </Suspense>
  );
}