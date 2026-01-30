"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function TransactionsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TOUT');

  // Kategori yo
  const tabs = ['TOUT', 'DEPO', 'TRANSFER', 'RETRÈ', 'KAT'];

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error) setTransactions(data || []);
      }
      setLoading(false);
    };
    fetchTransactions();
  }, [supabase]);

  // Lojik pou filtre tranzaksyon yo
  const filteredTransactions = transactions.filter(t => {
    if (activeTab === 'TOUT') return true;
    if (activeTab === 'DEPO') return t.type === 'DEPOSIT';
    if (activeTab === 'TRANSFER') return t.type === 'P2P' || t.type === 'TRANSFER';
    if (activeTab === 'RETRÈ') return t.type === 'WITHDRAWAL';
    if (activeTab === 'KAT') return t.type === 'CARD_RECHARGE' || t.type === 'PAYMENT';
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
  };

  const getIcon = (type: string, amount: number) => {
    switch (type.toUpperCase()) {
      case 'DEPOSIT': return '📥';
      case 'WITHDRAWAL': return '📤';
      case 'CARD_RECHARGE': return '💳';
      case 'PAYMENT': return '🛍️';
      case 'P2P': return '🔄';
      default: return amount > 0 ? '➕' : '➖';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic pb-24">
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 active:scale-90">
          <span className="text-xl">←</span>
        </button>
        <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Istorik Aktivite</h1>
      </div>

      {/* TABS FILTRE */}
      <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-full text-[10px] font-black transition-all whitespace-nowrap ${
              activeTab === tab 
              ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
              : 'bg-zinc-900 text-zinc-500 border border-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/20 rounded-[3rem] border border-dashed border-white/5">
          <p className="font-black uppercase text-[10px] text-zinc-600">Pa gen okenn tranzaksyon nan kategori sa a</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="bg-zinc-900/40 border border-white/5 p-5 rounded-[2.5rem] hover:bg-zinc-900/60 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-zinc-800/80 border border-white/5">
                    {getIcon(t.type, t.amount)}
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-tight text-zinc-200">
                      {t.description || t.type}
                    </h3>
                    <p className="text-[9px] text-zinc-500 font-bold mt-1 uppercase">
                      {formatDate(t.created_at)} • 
                      <span className={`ml-1 ${
                        ['success', 'approved', 'completed'].includes(t.status) ? 'text-green-500' : 
                        ['rejected', 'failed'].includes(t.status) ? 'text-red-500' : 'text-orange-500'
                      }`}>
                        {t.status}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-sm font-black ${t.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                    {t.amount > 0 ? '+' : ''}{Number(t.amount).toLocaleString()} 
                    <span className="text-[8px] ml-1">HTG</span>
                  </p>
                  <p className="text-[7px] text-zinc-600 font-black uppercase tracking-widest mt-1">
                    {t.type === 'P2P' ? 'TRANSFER' : t.type}
                  </p>
                </div>
              </div>

              {/* REZON ANILE SI LI EGZISTE */}
              {t.status === 'rejected' && t.admin_notes && (
                <div className="mt-4 p-3 bg-red-600/5 border border-red-600/10 rounded-2xl">
                  <p className="text-[8px] text-red-500 font-black uppercase">Mesaj Sistèm:</p>
                  <p className="text-[10px] text-zinc-400 mt-1 italic leading-tight">{t.admin_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}