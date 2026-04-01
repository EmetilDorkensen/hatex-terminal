"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { RefreshCcw } from 'lucide-react'; // Mwen enpòte ikon an pou bouton an

export default function TransactionsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TOUT');

  // NOUVO: Mwen ajoute tab 'ABÒNMAN' an pou li rete nan paj sa a si yo vle filtre la
  const tabs = ['TOUT', 'DEPO', 'TRANSFER', 'RETRÈ', 'KAT', 'ABÒNMAN'];

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error) {
          setTransactions(data || []);
        }
      }
      setLoading(false);
    };
    fetchTransactions();
  }, [supabase]);

  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return "";
    const [name, domain] = email.split('@');
    if (name.length <= 3) return `${name}...@${domain}`;
    return `${name.substring(0, 3)}.....@${domain}`;
  };

  // FONKSYON POU DESKRIPSYON KI PRIYORIZE NON BIZNIS LA AK ABÒNMAN
  const getDynamicDescription = (t: any) => {
    // Si se yon Abònman
    if (t.type === 'SUBSCRIPTION' || t.metadata?.is_subscription) {
      const planName = t.metadata?.plan_name || 'PLAN';
      const merchantName = t.metadata?.merchant_name || 'BIZNIS';
      return `ABÒNMAN ${planName.toUpperCase()} - ${merchantName.toUpperCase()}`;
    }
    // Si se yon LAVANT (pou machann nan)
    if (t.type === 'SALE') {
      return `VANT BAY ${t.metadata?.customer_name || 'KLIYAN'}`;
    }
    // Si se yon ACHA (pou kliyan an)
    if (t.type === 'PAYMENT') {
      const businessName = t.metadata?.merchant_name || 'BIZNIS';
      return `ACHA NAN ${businessName.toUpperCase()}`;
    }
    return t.description || t.type;
  };

  const filteredTransactions = transactions.filter(t => {
    const isManualOldRecord = t.description?.includes("Voye bay") || t.description?.includes("Resevwa nan men yon zanmi");
    if (isManualOldRecord && t.type === 'TRANSFER') return false;

    if (activeTab === 'TOUT') return true;
    if (activeTab === 'DEPO') return t.type === 'DEPOSIT';
    if (activeTab === 'TRANSFER') return t.type === 'P2P' || t.type === 'TRANSFER';
    if (activeTab === 'RETRÈ') return t.type === 'WITHDRAWAL';
    if (activeTab === 'KAT') return t.type === 'CARD_RECHARGE' || t.type === 'PAYMENT' || t.type === 'SALE';
    // NOUVO: Filtre sèlman abònman yo pou tab ABÒNMAN an
    if (activeTab === 'ABÒNMAN') return t.type === 'SUBSCRIPTION' || t.metadata?.is_subscription === true;
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const getIcon = (type: string, amount: number, isSub: boolean) => {
    if (isSub) return '🔁';
    switch (type.toUpperCase()) {
      case 'DEPOSIT': return '📥';
      case 'WITHDRAWAL': return '📤';
      case 'CARD_RECHARGE': return '💳';
      case 'PAYMENT': return '🛍️';
      case 'SALE': return '💰';
      case 'P2P': return '🔄';
      case 'TRANSFER': return '🔄';
      default: return amount > 0 ? '➕' : '➖';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic pb-24">
      {/* HEADER AK BOUTON ABÒNMAN AN */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 active:scale-95 transition-all">
            <span className="text-xl">←</span>
          </button>
          <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Istorik</h1>
        </div>
        
        {/* BOUTON POU JERE ABÒNMAN YO */}
        <button 
          onClick={() => router.push('/dashboard/my-subscriptions')}
          className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 text-red-500 px-4 py-2 rounded-full font-black uppercase text-[10px] tracking-widest transition-all shadow-[0_4px_15px_rgba(230,46,4,0.1)] active:scale-95"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Jere Abònman
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-full text-[10px] font-black transition-all border whitespace-nowrap ${
              activeTab === tab
              ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-600/20'
              : 'bg-zinc-900 text-zinc-500 border-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/20 rounded-[3rem] border border-dashed border-white/5">
          <p className="text-[10px] font-black uppercase text-zinc-600">Pa gen aktivite nan kategori sa a</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransactions.map((t) => {
            const isSubscription = t.type === 'SUBSCRIPTION' || t.metadata?.is_subscription;
            
            return (
              <div key={t.id} className={`bg-zinc-900/40 border ${isSubscription ? 'border-red-600/20 shadow-[0_4px_20px_rgba(230,46,4,0.05)]' : 'border-white/5'} p-5 rounded-[2.5rem] backdrop-blur-sm transition-all hover:bg-zinc-900/60`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${isSubscription ? 'bg-red-600/10 border border-red-600/20 text-red-500' : 'bg-zinc-800/80 border border-white/5'}`}>
                      {getIcon(t.type, t.amount, isSubscription)}
                    </div>
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-tight text-zinc-100">
                        {getDynamicDescription(t)}
                      </h3>
                      
                      <p className="text-[9px] text-zinc-500 font-bold lowercase mt-0.5">
                        {t.type === 'SALE'
                          ? (t.metadata?.customer_email ? maskEmail(t.metadata.customer_email) : 'Kliyan Hatex')
                          : (t.metadata?.merchant_email ? maskEmail(t.metadata.merchant_email) : maskEmail(t.user_email))}
                      </p>

                      <p className="text-[9px] text-zinc-600 font-bold mt-1 uppercase">
                        {formatDate(t.created_at)} •
                        <span className={['success', 'approved', 'completed'].includes(t.status) ? 'text-green-500' : 'text-orange-500'}> {t.status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-[13px] font-black ${t.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                      {t.amount > 0 ? '+' : ''}{Math.abs(t.amount).toLocaleString()}
                      <span className="text-[8px] ml-1">HTG</span>
                    </p>
                    <p className={`text-[7px] font-black uppercase tracking-widest mt-1 ${isSubscription ? 'text-red-400' : 'text-zinc-700'}`}>
                      {isSubscription ? 'ABÒNMAN' : (t.type === 'SALE' ? 'LAVANT' : (t.type === 'PAYMENT' ? 'ACHA' : t.type))}
                    </p>
                  </div>
                </div>

                {/* Zòn kote mesaj abònman yo afiche a si yo egziste nan metadata */}
                {(t.metadata?.merchant_message || t.metadata?.customer_message) && (
                  <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                    {/* Mesaj Machann nan kite pou kliyan an */}
                    {t.metadata?.merchant_message && (
                      <div className="bg-black/30 rounded-2xl p-3 border border-white/5">
                        <span className="text-[7px] text-red-500 font-black uppercase tracking-widest block mb-1">Mesaj Machann:</span>
                        <p className="text-[10px] text-zinc-300 font-medium leading-relaxed">"{t.metadata.merchant_message}"</p>
                      </div>
                    )}
                    
                    {/* Nòt kliyan an te kite lè l t ap peye a */}
                    {t.metadata?.customer_message && (
                      <div className="bg-zinc-800/30 rounded-2xl p-3 border border-white/5">
                        <span className="text-[7px] text-blue-400 font-black uppercase tracking-widest block mb-1">Nòt Kliyan:</span>
                        <p className="text-[10px] text-zinc-300 font-medium leading-relaxed">"{t.metadata.customer_message}"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}