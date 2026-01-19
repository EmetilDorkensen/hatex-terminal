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
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error) setTransactions(data || []);
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

  const getIcon = (type: string, amount: number) => {
    switch (type.toUpperCase()) {
      case 'DEPOSIT': return '💰';
      case 'WITHDRAWAL': return '🏧';
      case 'CARD_RECHARGE': return '💳';
      case 'PAYMENT': return '🏪';
      case 'P2P': return '💸';
      case 'TRANSFER': return '🔁';
      default: return amount > 0 ? '➕' : '➖';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
      case 'approved': 
      case 'completed': return 'text-green-500';
      case 'rejected':
      case 'failed':
      case 'cancelled': return 'text-red-500';
      case 'pending': return 'text-orange-500';
      default: return 'text-zinc-500';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans italic pb-20">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
            <span className="text-xl">←</span>
          </button>
          <h1 className="text-lg font-black uppercase tracking-widest text-red-600">Istorik</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/20 rounded-[3rem] border border-dashed border-white/5 font-black uppercase text-[10px] text-zinc-600">
          Pa gen aktivite ankò
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((t) => (
            <div key={t.id} className="bg-zinc-900/40 border border-white/5 p-5 rounded-[2rem] backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-zinc-800/50`}>
                    {getIcon(t.type, t.amount)}
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black uppercase tracking-wide leading-tight">
                      {t.description || t.type}
                    </h3>
                    <p className="text-[9px] text-zinc-500 font-bold mt-1 uppercase">
                      {formatDate(t.created_at)} • <span className={getStatusColor(t.status)}>{t.status}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className={`text-[13px] font-black ${t.amount > 0 ? 'text-green-500' : 'text-white'}`}>
                    {t.amount > 0 ? '+' : ''}{Number(t.amount).toLocaleString()} <span className="text-[8px]">HTG</span>
                  </p>
                  <p className="text-[8px] text-zinc-600 font-bold uppercase">{t.method || 'HATEX'}</p>
                </div>
              </div>

              {/* REZON ANILE (ADMIN NOTES) */}
              {(t.status === 'rejected' || t.status === 'cancelled') && t.admin_notes && (
                <div className="mt-4 p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                  <p className="text-[9px] text-red-500 font-black uppercase">⚠️ Nòt Admin:</p>
                  <p className="text-[10px] text-zinc-400 mt-1 normal-case">{t.admin_notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}