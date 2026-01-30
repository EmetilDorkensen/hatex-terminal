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

  // FONKSYON POU KACHE MITAN EMAIL LA (dor.....@gmail.com)
  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return "";
    const [name, domain] = email.split('@');
    if (name.length <= 3) return `${name}...@${domain}`;
    return `${name.substring(0, 3)}.....@${domain}`;
  };

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
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
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
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
          <span className="text-xl">←</span>
        </button>
        <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Istorik</h1>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-6 no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-full text-[10px] font-black transition-all ${
              activeTab === tab ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-500'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="bg-zinc-900/40 border border-white/5 p-5 rounded-[2.5rem]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-zinc-800/80">
                    {getIcon(t.type, t.amount)}
                  </div>
                  <div>
                    {/* NON AN ANLE */}
                    <h3 className="text-[11px] font-black uppercase tracking-tight text-zinc-200">
                      {t.description || t.type}
                    </h3>
                    {/* EMAIL LA TOUT PITI ANBA L (MASKED) */}
                    {t.user_email && (
                      <p className="text-[8px] text-zinc-600 font-bold lowercase tracking-wider">
                        {maskEmail(t.user_email)}
                      </p>
                    )}
                    <p className="text-[9px] text-zinc-500 font-bold mt-1 uppercase">
                      {formatDate(t.created_at)} • 
                      <span className={['success', 'approved', 'completed'].includes(t.status) ? 'text-green-500' : 'text-orange-500'}> {t.status}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-sm font-black ${t.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                    {t.amount > 0 ? '+' : ''}{Number(t.amount).toLocaleString()} <span className="text-[8px]">HTG</span>
                  </p>
                  <p className="text-[7px] text-zinc-600 font-black uppercase">{t.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}