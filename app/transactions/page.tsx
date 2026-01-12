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

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id) // Nou sèvi ak user_id jan sa te ye nan SQL la
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Erè rale tranzaksyon:", error.message);
        } else {
          setTransactions(data || []);
        }
      }
      setLoading(false);
    };

    fetchTransactions();
  }, [supabase]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
  };

  // Fonksyon pou bay bèl ikòn daprè TIP tranzaksyon an nan SQL la
  const getIcon = (type: string, amount: number) => {
    if (type === 'DEPOSIT') return '💰';
    if (type === 'WITHDRAWAL') return '🏧';
    if (type === 'CARD_RECHARGE') return '💳';
    if (type === 'PAYMENT') return '🏪';
    if (type === 'TRANSFER') return '💸';
    return amount > 0 ? '➕' : '➖';
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800 active:scale-90 transition-all">
            <span className="text-xl">←</span>
          </button>
          <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Istorik</h1>
        </div>
        <div className="bg-zinc-900/50 px-4 py-2 rounded-full border border-white/5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase">{transactions.length} Aktivite</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em]">Chajman done...</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/20 rounded-[3rem] border border-dashed border-white/5">
          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Pa gen okenn tranzaksyon ankò</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((t) => (
            <div 
              key={t.id} 
              className="bg-zinc-900/40 border border-white/5 p-5 rounded-[2rem] flex items-center justify-between backdrop-blur-md hover:bg-zinc-900/60 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${
                  t.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  {getIcon(t.type, t.amount)}
                </div>
                
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-wide leading-tight">
                    {t.description || t.type}
                  </h3>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">
                    {formatDate(t.created_at)} • <span className={t.status === 'success' ? 'text-green-600' : 'text-orange-500'}>{t.status}</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className={`text-[13px] font-black italic ${t.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                  {t.amount > 0 ? '+' : ''}{Number(t.amount).toLocaleString()} 
                  <span className="text-[8px] ml-1">HTG</span>
                </p>
                <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-tighter">{t.method || 'SISTÈM'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TI DECORATION ANBA */}
      <div className="mt-10 text-center opacity-20">
         <p className="text-[8px] font-black uppercase tracking-[0.5em]">Hatex Security System</p>
      </div>
    </div>
  );
}