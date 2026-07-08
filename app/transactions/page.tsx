"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { RefreshCcw, Copy, CheckCircle2, ArrowLeft, Download, Upload, CreditCard, ShoppingBag, ArrowRightLeft, Repeat, History } from 'lucide-react';

export default function TransactionsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TOUT');
  const [copiedId, setCopiedId] = useState<string | null>(null); 

  const tabs = ['TOUT', 'DEPO', 'TRANSFER', 'RETRÈ', 'KAT', 'ABÒNMAN'];

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Li rale tout done yo, enkli nouvo kolòn order_id la
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

  const getDynamicDescription = (t: any) => {
    if (t.type === 'SUBSCRIPTION' || t.metadata?.is_subscription) {
      const planName = t.metadata?.plan_name || 'PLAN';
      const merchantName = t.metadata?.merchant_name || 'BIZNIS';
      return `ABÒNMAN ${planName.toUpperCase()} - ${merchantName.toUpperCase()}`;
    }
    if (t.type === 'SALE') return `VANT BAY ${t.metadata?.customer_name || 'KLIYAN'}`;
    if (t.type === 'PAYMENT') {
      const businessName = t.metadata?.merchant_name || 'BIZNIS';
      return `ACHA NAN ${businessName.toUpperCase()}`;
    }
    if (t.type === 'P2P' && Number(t.amount) < 0) {
      const base = (t.description || 'TRANSFÈ BAY').replace(/\s*@\S+/g, '').trim();
      const fee = Number(t._pairedFee || t.metadata?.transfer_fee || 0);
      if (fee > 0) {
        return `${base} (+ ${fee.toLocaleString()} HTG frè)`;
      }
      return base;
    }
    return t.description || t.type;
  };

  const displayTransactions = useMemo(() => {
    const feeWindowMs = 3000;
    const fees: Array<{ userId: string; at: number; amount: number }> = [];

    for (const t of transactions) {
      if (t.type === 'TRANSFER_FEE') {
        fees.push({
          userId: t.user_id,
          at: new Date(t.created_at).getTime(),
          amount: Math.abs(Number(t.amount || 0)),
        });
      }
    }

    const findPairedFee = (t: any) => {
      const at = new Date(t.created_at).getTime();
      const match = fees.find(
        (f) => f.userId === t.user_id && Math.abs(f.at - at) <= feeWindowMs && Number(t.amount) < 0
      );
      return match?.amount || 0;
    };

    return transactions
      .filter((t) => t.type !== 'TRANSFER_FEE')
      .map((t) => {
        if (t.type === 'P2P' && Number(t.amount) < 0) {
          return { ...t, _pairedFee: findPairedFee(t) };
        }
        return t;
      });
  }, [transactions]);

  const filteredTransactions = displayTransactions.filter((t) => {
    const isManualOldRecord = t.description?.includes("Voye bay") || t.description?.includes("Resevwa nan men yon zanmi");
    if (isManualOldRecord && t.type === 'TRANSFER') return false;

    if (activeTab === 'TOUT') return true;
    if (activeTab === 'DEPO') return t.type === 'DEPOSIT';
    if (activeTab === 'TRANSFER') return t.type === 'P2P' || t.type === 'TRANSFER';
    if (activeTab === 'RETRÈ') return t.type === 'WITHDRAWAL';
    if (activeTab === 'KAT') return t.type === 'CARD_RECHARGE' || t.type === 'PAYMENT' || t.type === 'SALE';
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
    if (isSub) return <Repeat size={20} className="text-indigo-600" />;
    switch (type.toUpperCase()) {
      case 'DEPOSIT': return <Download size={20} className="text-emerald-600" />;
      case 'WITHDRAWAL': return <Upload size={20} className="text-rose-600" />;
      case 'CARD_RECHARGE': return <CreditCard size={20} className="text-indigo-600" />;
      case 'PAYMENT': return <ShoppingBag size={20} className="text-amber-600" />;
      case 'SALE': return <ShoppingBag size={20} className="text-emerald-600" />;
      case 'P2P': return <ArrowRightLeft size={20} className="text-blue-600" />;
      case 'TRANSFER': return <ArrowRightLeft size={20} className="text-blue-600" />;
      default: return amount > 0 ? <Download size={20} className="text-emerald-600" /> : <Upload size={20} className="text-slate-600" />;
    }
  };

  // NOUVO: Fonksyon pou kopye ID la, kèlkeswa sa l ye a
  const handleCopyId = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(textToCopy);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 font-sans pb-24">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 mt-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Istorik</h1>
          </div>
          
          <button 
            onClick={() => router.push('/dashboard/my-subscriptions')}
            className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-4 py-2.5 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all shadow-sm w-full sm:w-auto"
          >
            <RefreshCcw size={14} /> Jere Abònman
          </button>
        </div>

        {/* TABS POU FILTRAJ */}
        <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${
                activeTab === tab
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-gray-200 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300">
            <History size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Pa gen aktivite nan kategori sa a</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((t) => {
              const isSubscription = t.type === 'SUBSCRIPTION' || t.metadata?.is_subscription;
              
              // NOUVO: Sistèm nan ap chache 'order_id' ki sot nan SQL la an premye. 
              // Si l pa jwenn li (pou ansyen tranzaksyon yo), l ap itilize 12 lèt nan ansyen ID a.
              const displayId = t.order_id || t.id.replace(/-/g, '').substring(0, 12).toUpperCase();
              
              return (
                <div key={t.id} className={`bg-white border ${isSubscription ? 'border-indigo-200 shadow-sm' : 'border-gray-200'} p-4 sm:p-5 rounded-2xl transition-all hover:shadow-md group`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isSubscription ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50 border border-gray-100'}`}>
                        {getIcon(t.type, t.amount, isSubscription)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                          {getDynamicDescription(t)}
                        </h3>
                        
                        {/* ID Tranzaksyon an ak bouton Kopye a */}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-slate-100 text-[10px] text-slate-600 font-mono font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider border border-gray-200">
                            ID: {displayId}
                          </span>
                          <button 
                            onClick={() => handleCopyId(displayId)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-50"
                            title="Kopye ID Tranzaksyon an"
                          >
                            {copiedId === displayId ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-slate-500 font-medium">{formatDate(t.created_at)}</span>
                          <span className="text-slate-300 text-[10px]">•</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${['success', 'approved', 'completed'].includes(t.status) ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end w-full sm:w-auto border-t sm:border-none border-gray-100 pt-3 sm:pt-0 shrink-0">
                      <div className="flex items-baseline gap-1">
                        <p className={`text-base sm:text-lg font-bold ${t.amount > 0 ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {t.amount > 0 ? '+' : ''}{Math.abs(t.amount).toLocaleString()}
                        </p>
                        <span className="text-xs text-slate-500 font-semibold uppercase">HTG</span>
                      </div>
                      <p className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isSubscription ? 'text-indigo-500' : 'text-slate-400'}`}>
                        {isSubscription ? 'ABÒNMAN' : (t.type === 'SALE' ? 'LAVANT' : (t.type === 'PAYMENT' ? 'ACHA' : t.type))}
                      </p>
                    </div>
                  </div>

                  {(t.metadata?.merchant_message || t.metadata?.customer_message) && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {t.metadata?.merchant_message && (
                        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50">
                          <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-widest block mb-1">Mesaj Machann:</span>
                          <p className="text-xs text-indigo-900 font-medium leading-relaxed">"{t.metadata.merchant_message}"</p>
                        </div>
                      )}
                      {t.metadata?.customer_message && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-gray-100">
                          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Nòt Kliyan:</span>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">"{t.metadata.customer_message}"</p>
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
    </div>
  );
}