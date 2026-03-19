"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CheckCircle2, ShoppingBag, ShieldCheck, Hash, Calendar, Download, Store, User, Mail, Phone } from 'lucide-react';
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

  useEffect(() => {
    async function loadTransaction() {
      if (!transactionId) {
        setError('ID tranzaksyon manke.');
        setLoading(false);
        return;
      }

      try {
        // 1. Chache tranzaksyon an (SALE)
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
        const { data: merch, error: merchError } = await supabase
          .from('profiles')
          .select('id, full_name, business_name, email, phone, avatar_url')
          .eq('id', tx.user_id)
          .single();

        if (!merchError && merch) {
          setMerchant(merch);
        }

        // 3. Chache enfòmasyon moun k ap peye a (nan metadata)
        if (tx.metadata?.customer_name) {
          setPayer({ full_name: tx.metadata.customer_name });
        } else if (tx.metadata?.customer_id) {
          const { data: payerData } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', tx.metadata.customer_id)
            .single();
          if (payerData) setPayer(payerData);
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

    // Logo si disponib
    if (merchant.avatar_url) {
      try {
        const response = await fetch(merchant.avatar_url);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => {
          const logoData = reader.result as string;
          doc.addImage(logoData, 'PNG', 20, 20, 30, 30);
        };
      } catch (e) {
        console.error('Impossible de charger le logo:', e);
      }
    }

    // Tit
    doc.setFontSize(22);
    doc.setTextColor(230, 46, 4);
    doc.text('HATEX', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Reçu de paiement', pageWidth / 2, 45, { align: 'center' });

    doc.setDrawColor(200, 200, 200);
    doc.line(20, 55, pageWidth - 20, 55);

    // Detay tranzaksyon
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);

    const details = [
      ['ID tranzaksyon:', transaction.id],
      ['Dat:', new Date(transaction.created_at).toLocaleString('fr-HT')],
      ['Montan:', `${transaction.amount.toLocaleString()} HTG`],
      ['Estati:', 'Rezilta'],
    ];

    let y = 70;
    details.forEach(([label, value]) => {
      doc.text(label, 25, y);
      doc.text(value.toString(), 80, y);
      y += 8;
    });

    // Enfòmasyon machann
    y += 10;
    doc.setFontSize(14);
    doc.setTextColor(230, 46, 4);
    doc.text('Marchand', 25, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    
    const merchantLines = [
      `Nom: ${merchant.business_name || merchant.full_name || 'Marchand'}`,
      `Email: ${merchant.email || 'Non disponible'}`,
      `Tél: ${merchant.phone || 'Non disponible'}`,
    ];
    merchantLines.forEach(line => {
      doc.text(line, 25, y);
      y += 6;
    });

    // Enfòmasyon kliyan
    if (payer) {
      y += 10;
      doc.setFontSize(14);
      doc.setTextColor(230, 46, 4);
      doc.text('Client', 25, y);
      y += 8;
      doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      doc.text(`Nom: ${payer.full_name || ''}`, 25, y);
    }

    // Pye paj
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Ce reçu est valable comme preuve de paiement.', pageWidth / 2, 285, { align: 'center' });

    doc.save(`hatex-recu-${transaction.id.slice(0,8)}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
        <div className="text-green-500 font-black animate-pulse text-xl">Chargement...</div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-6">
        <div className="bg-red-600/10 border border-red-600/30 p-10 rounded-[3rem] text-center max-w-md">
          <h2 className="text-2xl font-black text-red-500 mb-4">Erreur</h2>
          <p className="text-zinc-400">{error || 'Transaction non trouvée.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center p-6">
      <div className="w-full max-w-[600px] bg-[#0d0e1a] p-10 md:p-14 rounded-[4rem] border border-white/5 shadow-2xl relative overflow-hidden italic text-white">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-green-600/10 blur-[100px] rounded-full"></div>
        
        <div className="relative z-10 text-center">
          <div className="flex justify-center mb-8">
            <div className="bg-green-500/10 p-6 rounded-[2.5rem] border border-green-500/20">
              <CheckCircle2 className="text-green-500 w-16 h-16 stroke-[1.5px]" />
            </div>
          </div>

          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 italic">Merci ! ✅</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase mb-12 tracking-[0.4em]">Transaction complétée</p>

          {/* RECU BOX */}
          <div className="bg-zinc-900/40 p-10 rounded-[3rem] mb-10 border border-white/5">
            <div className="flex justify-between items-center mb-8 pb-8 border-b border-white/5">
              <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Montant payé</span>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white italic">{transaction.amount.toLocaleString()}</span>
                <span className="text-xs font-black text-green-500 uppercase">HTG</span>
              </div>
            </div>
            
            <div className="space-y-5 text-left">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Hash size={14} />
                  <span className="text-[10px] font-black uppercase">Transaction</span>
                </div>
                <span className="text-[10px] font-mono text-white opacity-70">{transaction.id.slice(0, 12)}...</span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-zinc-500">
                  <Calendar size={14} />
                  <span className="text-[10px] font-black uppercase">Date</span>
                </div>
                <span className="text-[10px] font-black text-white">
                  {new Date(transaction.created_at).toLocaleString('fr-HT')}
                </span>
              </div>
            </div>
          </div>

          {/* Enfòmasyon machann ak logo */}
          {merchant && (
            <div className="bg-zinc-900/20 p-6 rounded-3xl mb-10 text-left">
              <div className="flex items-center gap-4 mb-4">
                {merchant.avatar_url ? (
                  <img 
                    src={merchant.avatar_url} 
                    alt={merchant.business_name || merchant.full_name}
                    className="w-12 h-12 rounded-xl object-cover border border-white/10"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
                    <Store size={20} className="text-zinc-500" />
                  </div>
                )}
                <div>
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    Marchand
                  </h3>
                  <p className="text-sm font-bold text-white">
                    {merchant.business_name || merchant.full_name}
                  </p>
                </div>
              </div>
              
              {merchant.email && (
                <p className="text-[9px] text-zinc-400 flex items-center gap-2 mt-2">
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

          {/* Enfòmasyon kliyan si disponib */}
          {payer && (
            <div className="bg-zinc-900/20 p-6 rounded-3xl mb-10 text-left">
              <div className="flex items-center gap-2 mb-2">
                <User size={14} className="text-zinc-500" />
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Client</h3>
              </div>
              <p className="text-sm font-bold text-white">{payer.full_name}</p>
            </div>
          )}

          {/* FOOTER MESSAGE */}
          <div className="bg-green-500/5 p-6 rounded-3xl border border-green-500/10 mb-10">
            <p className="text-[10px] text-green-500 font-bold uppercase leading-relaxed">
              Votre paiement a été vérifié. Les détails ont été enregistrés dans votre historique et celui du marchand.
            </p>
          </div>

          {/* BOUTON RESI */}
          <button
            onClick={downloadReceipt}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-[2.2rem] font-black text-[12px] uppercase flex items-center justify-center gap-4 transition-all mb-4"
          >
            <Download size={18} /> Télécharger reçu
          </button>

          <button 
            onClick={() => router.push('/')}
            className="w-full bg-white text-black py-7 rounded-[2.2rem] font-black text-[12px] uppercase flex items-center justify-center gap-4 hover:bg-zinc-200 transition-all"
          >
            <ShoppingBag size={18} /> Retour à l'accueil
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
    <Suspense fallback={<div className="min-h-screen bg-[#06070d] flex items-center justify-center text-green-500 font-black">Chargement...</div>}>
      <SuccessContent />
    </Suspense>
  );
}