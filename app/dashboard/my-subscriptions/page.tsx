"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Calendar, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  CreditCard,
  History,
  ShieldOff
} from 'lucide-react';

export default function MySubscriptions() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchMySubs();
  }, []);

  async function fetchMySubs() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Rale abònman yo ak tout detay pwodwi a (JOIN)
    const { data } = await supabase
      .from('subscriptions')
      .select(`
        *,
        products (
          title,
          price,
          billing_cycle,
          image_url,
          category
        )
      `)
      .eq('client_id', user.id)
      .eq('status', 'active');

    setSubscriptions(data || []);
    setLoading(false);
  }

  const handleCancel = async (subId: string) => {
    const confirmCancel = confirm("Èske ou sèten ou vle anile abònman sa a? Ou pap debite ankò.");
    if (!confirmCancel) return;

    setCancellingId(subId);
    
    // Mete estati a sou 'cancelled'
    const { error } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString() 
      })
      .eq('id', subId);

    if (!error) {
      setSubscriptions(subscriptions.filter(s => s.id !== subId));
      alert("Abònman anile ak siksè.");
    }
    setCancellingId(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 md:p-12 italic font-medium">
      <div className="max-w-5xl mx-auto space-y-10">
        
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tighter italic">
            Mes <span className="text-red-600">Abonnements</span>
          </h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2">
            <History size={12} /> Jere peman otomatik ou yo
          </p>
        </div>

        {subscriptions.length === 0 ? (
          <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] p-20 text-center space-y-4">
            <ShieldOff className="mx-auto text-zinc-800" size={60} />
            <p className="text-zinc-600 font-black uppercase text-[10px]">Ou pa gen okenn abònman aktif pou kounye a.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 hover:border-red-600/20 transition-all">
                
                {/* ENFO PWODWI */}
                <div className="flex items-center gap-6 w-full md:w-auto">
                  <div className="w-20 h-20 bg-zinc-900 rounded-3xl overflow-hidden border border-white/5 flex-shrink-0">
                    <img 
                      src={sub.products.image_url || "/api/placeholder/80/80"} 
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-red-600 font-black uppercase tracking-widest">{sub.products.category}</span>
                    <h3 className="text-xl font-black uppercase tracking-tighter">{sub.products.title}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <p className="text-xs font-bold text-white italic">{sub.products.price} HTG <span className="text-[9px] text-zinc-500">/ {sub.products.billing_cycle}</span></p>
                      <div className="h-1 w-1 bg-zinc-700 rounded-full"></div>
                      <p className="text-[10px] text-green-500 font-black uppercase flex items-center gap-1">
                        <CreditCard size={10} /> Aktif
                      </p>
                    </div>
                  </div>
                </div>

                {/* DAT PWOKSENN PEMAN */}
                <div className="bg-black/40 px-6 py-4 rounded-2xl border border-white/5 text-center md:text-left min-w-[180px]">
                  <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Pwochen Debid</p>
                  <p className="text-[11px] font-black uppercase flex items-center justify-center md:justify-start gap-2 text-zinc-300">
                    <Calendar size={14} className="text-red-600" />
                    {new Date(sub.next_billing_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {/* BOUTON ANILE */}
                <button
                  disabled={cancellingId === sub.id}
                  onClick={() => handleCancel(sub.id)}
                  className="bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 border border-red-600/20 group disabled:opacity-50"
                >
                  {cancellingId === sub.id ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                  Anile
                </button>

              </div>
            ))}
          </div>
        )}

        {/* TI KONSÈY SEKIRITE */}
        <div className="p-6 bg-yellow-600/5 border border-yellow-600/10 rounded-[2rem] flex items-start gap-4">
          <AlertTriangle className="text-yellow-600 flex-shrink-0" size={20} />
          <p className="text-[10px] text-zinc-500 font-bold leading-relaxed uppercase italic">
            Lè ou anile yon abònman, li sispann debite kòb sou balans ou imedyatman. Si ou gen pwoblèm ak yon machann, kontakte sipò H-Pay la.
          </p>
        </div>

      </div>
    </div>
  );
}