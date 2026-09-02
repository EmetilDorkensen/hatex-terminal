"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  CheckCircle2,
  ArrowLeft,
  Download,
  Upload,
  CreditCard,
  ShoppingBag,
  Repeat,
  History,
  ArrowRightLeft,
} from 'lucide-react';

type HistoryRow = {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  order_id: string | null;
  purpose: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('TOUT');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tabs = ['TOUT', 'PEMAN', 'ABÒNMAN'];

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const res = await fetch('/api/v2/history');
        const data = await res.json();
        if (res.ok) {
          setTransactions(data.transactions || []);
        }
      } finally {
        setLoading(false);
      }
    };
    void fetchTransactions();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (activeTab === 'TOUT') return true;
      if (activeTab === 'PEMAN') {
        return (
          t.type === 'PAYMENT' ||
          t.type === 'SALE' ||
          t.type === 'KYC_FEE' ||
          t.type === 'PAYOUT' ||
          t.purpose === 'merchant' ||
          t.purpose === 'invoice'
        );
      }
      if (activeTab === 'ABÒNMAN') {
        return t.type === 'SUBSCRIPTION' || t.type === 'PLAN_FEE';
      }
      return true;
    });
  }, [transactions, activeTab]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SALE':
        return 'LAVANT';
      case 'PAYMENT':
        return 'PEMAN';
      case 'PAYOUT':
        return 'DEPO';
      case 'KYC_FEE':
        return 'KYC';
      case 'PLAN_FEE':
      case 'SUBSCRIPTION':
        return 'ABÒNMAN';
      default:
        return type;
    }
  };

  const getIcon = (type: string, amount: number) => {
    if (type === 'SUBSCRIPTION' || type === 'PLAN_FEE') {
      return <Repeat size={20} className="text-indigo-600" />;
    }
    switch (type) {
      case 'PAYOUT':
        return <ArrowRightLeft size={20} className="text-emerald-600" />;
      case 'KYC_FEE':
        return <CreditCard size={20} className="text-indigo-600" />;
      case 'PAYMENT':
        return <ShoppingBag size={20} className="text-amber-600" />;
      case 'SALE':
        return <ShoppingBag size={20} className="text-emerald-600" />;
      default:
        return amount > 0 ? (
          <Download size={20} className="text-emerald-600" />
        ) : (
          <Upload size={20} className="text-slate-600" />
        );
    }
  };

  const handleCopyId = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(textToCopy);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 font-sans pb-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 mt-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-sm shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Istorik</h1>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar mb-4">
          {tabs.map((tab) => (
            <button
              type="button"
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

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filteredTransactions.length === 0 && (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300">
            <History size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Pa gen aktivite nan kategori sa a
            </p>
          </div>
        )}

        {!loading && filteredTransactions.length > 0 && (
          <div className="space-y-3">
            {filteredTransactions.map((t) => {
              const isSubscription = t.type === 'SUBSCRIPTION' || t.type === 'PLAN_FEE';
              const displayId =
                t.order_id || t.id.replace(/^payout-|^sub-/, '').replaceAll('-', '').substring(0, 12).toUpperCase();
              const paid = ['success', 'approved', 'completed', 'paid', 'active'].includes(
                (t.status || '').toLowerCase()
              );

              return (
                <div
                  key={t.id}
                  className={`bg-white border ${isSubscription ? 'border-indigo-200 shadow-sm' : 'border-gray-200'} p-4 sm:p-5 rounded-2xl transition-all hover:shadow-md`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isSubscription
                            ? 'bg-indigo-50 border border-indigo-100'
                            : 'bg-slate-50 border border-gray-100'
                        }`}
                      >
                        {getIcon(t.type, t.amount)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
                          {t.description}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="bg-slate-100 text-[10px] text-slate-600 font-mono font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider border border-gray-200">
                            ID: {displayId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(displayId)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-slate-50"
                            title="Kopye ID Tranzaksyon an"
                          >
                            {copiedId === displayId ? (
                              <CheckCircle2 size={14} className="text-emerald-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-slate-500 font-medium">
                            {formatDate(t.created_at)}
                          </span>
                          <span className="text-slate-300 text-[10px]">•</span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              paid ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end w-full sm:w-auto border-t sm:border-none border-gray-100 pt-3 sm:pt-0 shrink-0">
                      <div className="flex items-baseline gap-1">
                        <p
                          className={`text-base sm:text-lg font-bold ${
                            t.amount > 0 ? 'text-emerald-600' : 'text-slate-900'
                          }`}
                        >
                          {t.amount > 0 ? '+' : ''}
                          {Math.abs(t.amount).toLocaleString()}
                        </p>
                        <span className="text-xs text-slate-500 font-semibold uppercase">HTG</span>
                      </div>
                      <p
                        className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${
                          isSubscription ? 'text-indigo-500' : 'text-slate-400'
                        }`}
                      >
                        {getTypeLabel(t.type)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
