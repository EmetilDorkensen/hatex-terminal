"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, ShoppingBag, ShieldCheck, Hash, ArrowRight, Download, FileText, Calendar, User, Mail, Phone } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const transactionId = searchParams.get('id') || searchParams.get('transaction_id') || '';
  const amountParam = searchParams.get('amount') || "0";
  
  const [transaction, setTransaction] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Chaje done tranzaksyon an depi nan baz done
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

        // 2. Chache enfòmasyon machann nan (moun ki resevwa lajan an)
        if (tx.user_id) {
          const { data: prof, error: profError } = await supabase
            .from('profiles')
            .select('business_name, full_name, email, phone')
            .eq('id', tx.user_id)
            .single();

          if (!profError && prof) {
            setMerchant(prof);
          }
        }
      } catch (err) {
        console.error('Error loading transaction:', err);
        setError('Erè pandan chajman done.');
      } finally {
        setLoading(false);
      }
    }

    loadTransaction();
  }, [transactionId, supabase]);

  // Fonksyon pou jenere resi an PDF
  const downloadReceipt = () => {
    if (!transaction) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Tit
    doc.setFontSize(22);
    doc.setTextColor(230, 46, 4); // #e62e04
    doc.text('HATEX', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Reçu de paiement', pageWidth / 2, 45, { align: 'center' });

    // Liy separe
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 55, pageWidth - 20, 55);

    // Detay tranzaksyon
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);

    const details = [
      ['ID tranzaksyon:', transaction.id],
      ['Dat:', new Date(transaction.created_at).toLocaleString('fr-HT')],
      ['Montan:', `${Number(transaction.amount).toLocaleString()} HTG`],
      ['Estati:', transaction.status === 'success' ? 'Rezilta' : transaction.status],
      ['Tip:', transaction.type === 'SALE' ? 'Vant' : 'Acha'],
    ];

    let y = 70;
    details.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value.toString(), 80, y);
      y += 8;
    });

    // Enfòmasyon machann
    if (merchant) {
      y += 10;
      doc.setFontSize(14);
      doc.setTextColor(230, 46, 4);
      doc.text('Machand', 25, y);
      y += 8;
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      
      const merchantLines = [
        `Non: ${merchant.business_name || merchant.full_name || 'Machand'}`,
        `Imèl: ${merchant.email || 'Pa disponib'}`,
        `Telefòn: ${merchant.phone || 'Pa disponib'}`,
      ];
      merchantLines.forEach(line => {
        doc.text(line, 25, y);
        y += 6;
      });
    }

    // Metadata si genyen
    if (transaction.metadata && Object.keys(transaction.metadata).length > 0) {
      y += 10;
      doc.setFontSize(12);
      doc.setTextColor(230, 46, 4);
      doc.text('Metadone', 25, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      
      Object.entries(transaction.metadata).forEach(([key, value]) => {
        if (typeof value === 'object') {
          doc.text(`${key}: ${JSON.stringify(value).substring(0, 60)}`, 25, y);
        } else {
          doc.text(`${key}: ${value}`, 25, y);
        }
        y += 5;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });
    }

    // Pye paj
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Reçu sa a valab kòm prèv peman. Mesi pou konfyans ou.', pageWidth / 2, 285, { align: 'center' });

    // Anrejistre PDF la
    doc.save(`hatex-recu-${transaction.id.slice(0,8)}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
        <div className="text-green-500 font-black animate-pulse text-xl">Chajman done yo...</div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-6">
        <div className="bg-red-600/10 border border-red-600/30 p-10 rounded-[3rem] text-center max-w-md">
          <h2 className="text-2xl font-black text-red-500 mb-4">Erè</h2>
          <p className="text-zinc-400">{error || 'Tranzaksyon pa jwenn.'}</p>
        </div>
      </div>
    );
  }

  const amount = transaction.amount || parseFloat(amountParam) || 0;

  return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-6 selection:bg-green-500/30">
      <div className="w-full max-w-[600px] bg-[#0d0e1a] p-10 md:p-14 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden italic text-white">
        
        {/* GLOW EFFECT */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-600/10 blur-[100px] rounded-full"></div>
        
        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-green-500/10 p-6 rounded-[2.5rem] border border-green-500/20 animate-in zoom-in duration-500">
              <CheckCircle2 className="text-green-500 w-16 h-16 stroke-[1.5px]" />
            </div>
          </div>

          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 italic">Merci ! ✅</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase mb-12 tracking-[0.4em] opacity-60">Transaction complétée avec succès</p>

          {/* RECU BOX */}
          <div className="bg-zinc-900/40 p-10 rounded-[3rem] mb-10 border border-white/5 relative">
            <div className="flex justify-between items-center mb-8 pb-8 border-b border-white/5">
              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Montant Payé</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white italic">{amount.toLocaleString()}</span>
                <span className="text-xs font-black text-green-500 uppercase">HTG</span>
              </div>
            </div>
            
            <div className="space-y-5 text-left">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-zinc-500">
                  <ShieldCheck size={14} />
                  <span className="text-[10px] font-black uppercase">Transaction ID</span>
                </div>
                <span className="text-[10px] font-mono text-white opacity-70">{transaction.id}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Hash size={14} />
                  <span className="text-[10px] font-black uppercase">Référence lòd</span>
                </div>
                <span className="text-[10px] font-black text-white">
                  {transaction.metadata?.order_id || transaction.order_id || 'N/A'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Calendar size={14} />
                  <span className="text-[10px] font-black uppercase">Dat</span>
                </div>
                <span className="text-[10px] font-black text-white">
                  {new Date(transaction.created_at).toLocaleString('fr-HT')}
                </span>
              </div>
            </div>
          </div>

          {/* Enfòmasyon machann si disponib */}
          {merchant && (
            <div className="bg-zinc-900/20 p-6 rounded-3xl mb-10 text-left">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase mb-4 tracking-widest flex items-center gap-2">
                <User size={14} /> Machand
              </h3>
              <p className="text-sm font-bold text-white mb-2">{merchant.business_name || merchant.full_name}</p>
              {merchant.email && (
                <p className="text-[9px] text-zinc-400 flex items-center gap-2 mt-1">
                  <Mail size={12} /> {merchant.email}
                </p>
              )}
              {merchant.phone && (
                <p className="text-[9px] text-zinc-400 flex items-center gap-2 mt-1">
                  <Phone size={12} /> {merchant.phone}
                </p>
              )}
            </div>
          )}

          {/* FOOTER MESSAGE */}
          <div className="bg-green-500/5 p-6 rounded-3xl border border-green-500/10 mb-10">
            <p className="text-[10px] text-green-500 font-bold uppercase leading-relaxed tracking-tight">
              Votre paiement a été vérifié. Les détails ont été enregistrés dans votre historique et celui du marchand. 
              {transaction.metadata?.order_id && ` Lòd #${transaction.metadata.order_id} konfime.`}
            </p>
          </div>

          {/* BOUTON TELECHAJMAN RESI */}
          <button
            onClick={downloadReceipt}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-[2.2rem] font-black text-[12px] uppercase flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-2xl mb-4"
          >
            <Download size={18} /> Telechaje resi
          </button>

          <button 
            onClick={() => router.push('/')}
            className="w-full bg-white text-black py-7 rounded-[2.2rem] font-black text-[12px] uppercase flex items-center justify-center gap-4 hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-2xl"
          >
            <ShoppingBag size={18} /> Retour au Portail
          </button>

          <p className="mt-14 text-[8px] text-zinc-800 font-black uppercase tracking-[0.6em] opacity-50">
            HatexCard Secure Gateway © 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#06070d] flex items-center justify-center text-green-500 font-black animate-pulse">FINALISATION...</div>}>
      <SuccessContent />
    </Suspense>
  );
}