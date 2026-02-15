"use client";
import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Lock, ShieldCheck, CreditCard, CheckCircle2, Building2, AlertTriangle } from 'lucide-react';

export default function SecurePayPage() {
  const { id } = useParams(); // Nou pran sèlman ID a nan URL la
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);
  const [form, setForm] = useState({ card: '', expiry: '', cvv: '' });
  const [msg, setMsg] = useState({ type: '', text: '' });

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // 1. CHACHE DONE YO NAN BAZ DONE A (SEKIRITE)
  useEffect(() => {
    const fetchInvoice = async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, profiles:owner_id(business_name, kyc_status)')
        .eq('id', id)
        .single();

      if (error || !data) {
        setMsg({ type: 'error', text: 'Fakti sa a pa egziste oswa li ekspire.' });
      } else {
        setInvoice(data);
      }
      setLoading(false);
    };
    fetchInvoice();
  }, [id, supabase]);

  // 2. EKSEKITE PEMAN AN (KREDITE WALLET LA OTO)
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setMsg({ type: '', text: '' });

    try {
      // Nou rele RPC nou te kreye a ki jere kòb la nan backend la
      const { data, error } = await supabase.rpc('process_invoice_payment', {
        p_invoice_id: id,
        p_card_number: form.card.replace(/\s/g, ''),
        p_card_cvv: form.cvv,
        p_card_expiry: form.expiry
      });

      if (error) throw error;

      if (data.success) {
        setMsg({ type: 'success', text: 'Peman Resevwa! Balans machann nan mete ajou.' });
        setInvoice({ ...invoice, status: 'paid' }); // Mizajou UI a
      } else {
        setMsg({ type: 'error', text: data.message });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Echèk tranzaksyon. Verifikasyon nesesè.' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-zinc-500 font-black text-[10px] tracking-[0.3em] uppercase">Hatex Secure Encryption...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 flex flex-col items-center justify-center italic">
      <div className="w-full max-w-md">
        
        {/* HEADER BIZNIS */}
        <div className="text-center mb-8 space-y-3">
          <div className="w-16 h-16 bg-gradient-to-tr from-red-600 to-red-400 rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-red-600/20">
            <Building2 size={32} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">{invoice?.profiles?.business_name || 'Hatex Merchant'}</h2>
            {invoice?.profiles?.kyc_status === 'approved' && (
              <span className="text-[9px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                Business Verified
              </span>
            )}
          </div>
        </div>

        {/* BOX PEMAN AN */}
        <div className="bg-[#0c0d15] border border-white/5 rounded-[2.5rem] p-8 shadow-3xl relative overflow-hidden">
          
          {invoice?.status === 'paid' ? (
            <div className="py-12 text-center space-y-6 animate-in zoom-in-75 duration-500">
               <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center">
                  <CheckCircle2 size={40} className="text-black" />
               </div>
               <div>
                  <h3 className="text-3xl font-black uppercase italic">Peye ak Siksè</h3>
                  <p className="text-zinc-500 text-sm mt-2">Mèsi! Tranzaksyon an konfime.</p>
               </div>
               <button onClick={() => window.print()} className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-bold uppercase text-xs">Telechaje Resi</button>
            </div>
          ) : (
            <form onSubmit={handlePayment} className="space-y-8">
              {/* MONTAN KI BLOKE (Kliyan paka chanje l) */}
              <div className="text-center border-b border-white/5 pb-8">
                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Montant à payer</p>
                <div className="flex items-center justify-center gap-2">
                   <span className="text-6xl font-black tracking-tighter tabular-nums">{Number(invoice?.amount).toLocaleString()}</span>
                   <span className="text-2xl font-bold text-red-600 italic">HTG</span>
                </div>
              </div>

              {/* FÒM KAT LA */}
              <div className="space-y-5">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Numéro de Carte Hatex</label>
                    <div className="relative">
                       <input 
                         required 
                         placeholder="0000 0000 0000 0000"
                         className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 transition-all font-mono text-lg"
                         onChange={e => setForm({...form, card: e.target.value})}
                       />
                       <CreditCard className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-700" size={20} />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <input 
                      required placeholder="MM/YY" maxLength={5}
                      className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 text-center font-mono"
                      onChange={e => setForm({...form, expiry: e.target.value})}
                    />
                    <input 
                      required type="password" placeholder="CVV" maxLength={3}
                      className="w-full bg-black border border-white/10 p-5 rounded-2xl outline-none focus:border-red-600 text-center font-mono"
                      onChange={e => setForm({...form, cvv: e.target.value})}
                    />
                 </div>
              </div>

              <button 
                disabled={processing}
                className="w-full bg-red-600 hover:bg-red-700 py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {processing ? "Traitement..." : "Confirmer le Paiement"}
              </button>
            </form>
          )}

          {msg.text && (
            <div className={`mt-6 p-4 rounded-2xl flex items-center gap-3 border ${msg.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
               <AlertTriangle size={18} />
               <p className="text-[10px] font-black uppercase">{msg.text}</p>
            </div>
          )}
        </div>

        {/* FOOTER SEKIRITE */}
        <div className="mt-8 flex flex-col items-center gap-4 opacity-30">
           <div className="flex items-center gap-2">
              <ShieldCheck size={14} />
              <p className="text-[9px] font-black uppercase tracking-[0.3em]">Hatex Payment Gateway</p>
           </div>
           <p className="text-[8px] text-center uppercase tracking-widest leading-loose">
              Tranzaksyon sa a chifre ak AES-256. <br/> Pa pataje kòd sekirite ou ak pèsonn.
           </p>
        </div>

      </div>
    </div>
  );
}