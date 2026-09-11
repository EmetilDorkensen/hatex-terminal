"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import SafeImg from '@/components/SafeImg';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clipboard,
  Loader2,
  Package,
  Plus,
  Send,
  Trash2,
  MessageCircle,
  Share2,
} from 'lucide-react';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  share_token: string | null;
  description: string | null;
  image_url: string | null;
  price_htg: number;
  sales_count: number;
  total_received_htg: number;
  active: boolean;
  created_at: string;
};

function productUrl(p: { slug: string; share_token?: string | null }): string {
  return `${window.location.origin}/p/${p.share_token || p.slug}`;
}

export default function MerchantProductsPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [profile, setProfile] = useState<any>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: prof } = await supabase
      .from('profiles')
      .select('kyc_status, plan, account_type, business_name')
      .eq('id', user.id)
      .single();
    setProfile(prof);

    const { data: prods } = await supabase
      .from('hatex_products')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    setProducts((prods || []) as ProductRow[]);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const copyLink = async (p: ProductRow) => {
    try {
      await navigator.clipboard.writeText(productUrl(p));
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const toggleActive = async (p: ProductRow) => {
    setBusyId(p.id);
    setMessage({ type: '', text: '' });
    const { error } = await supabase
      .from('hatex_products')
      .update({ active: !p.active, updated_at: new Date().toISOString() })
      .eq('id', p.id);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x))
      );
    }
    setBusyId(null);
  };

  const removeProduct = async (p: ProductRow) => {
    if (!confirm(`Èske ou sèten ou vle efase «${p.name}»? Lyen an pap mache ankò.`)) return;
    setBusyId(p.id);
    const { error } = await supabase.from('hatex_products').delete().eq('id', p.id);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    }
    setBusyId(null);
  };

  const productUnlocked = profile?.kyc_status === 'approved';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={36} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-6"
        >
          <ArrowLeft size={18} /> Retounen nan Dashboard
        </button>

        <div className="flex items-start sm:items-center gap-4 mb-8 flex-col sm:flex-row">
          <div className="flex items-center gap-4 flex-1">
            <span className="p-4 bg-indigo-50 rounded-2xl text-indigo-600 border border-indigo-100">
              <Package size={28} />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pwodwi Mwen</h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Kreye yon pwodwi, jwenn yon lyen peman, epi voye l sou WhatsApp oswa Instagram.
                Kliyan an peye ak MonCash — lajan an ale sou kont ou chwazi a.
              </p>
            </div>
          </div>
          {productUnlocked ? (
            <Link
              href="/dashboard/products/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-3 rounded-xl flex items-center gap-2 shadow-sm transition-colors shrink-0"
            >
              <Plus size={18} /> Kreye yon pwodwi
            </Link>
          ) : (
            <span className="bg-slate-200 text-slate-500 text-sm font-bold px-5 py-3 rounded-xl flex items-center gap-2 shrink-0 cursor-not-allowed">
              <Plus size={18} /> Kreye yon pwodwi
            </span>
          )}
        </div>

        {!productUnlocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
            Konplete KYC ou (apwouve) anvan ou kreye pwodwi.{' '}
            <button type="button" className="font-bold underline" onClick={() => router.push('/kyc/v2')}>
              Ale nan KYC
            </button>
          </div>
        )}

        {message.text && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 mb-6 ${message.type === 'error' ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
            {message.type === 'error' ? <AlertTriangle size={18} className="shrink-0" /> : <Check size={18} className="shrink-0" />}
            <span className="leading-tight">{message.text}</span>
          </div>
        )}

        {products.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center shadow-sm">
            <span className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 border border-indigo-100">
              <Package size={28} />
            </span>
            <h2 className="text-lg font-bold text-slate-900">Ou poko kreye pwodwi</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              Kreyasyon an fasil: non, pri, yon foto (si ou vle), epi chwazi kote ou resevwa
              lajan an. Apre sa HatexCard ba ou yon lyen peman pou voye kliyan ou yo.
            </p>
            {productUnlocked ? (
              <Link
                href="/dashboard/products/new"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-6 py-3.5 rounded-xl mt-6 transition-colors"
              >
                <Plus size={18} /> Kreye premye pwodwi mwen
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/kyc/v2')}
                className="inline-flex items-center gap-2 bg-slate-200 text-slate-600 text-sm font-bold px-6 py-3.5 rounded-xl mt-6 transition-colors"
              >
                <Plus size={18} /> Ale nan KYC
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {products.map((p) => {
              const url = productUrl(p);
              const waText = `Achte «${p.name}» sou HatexCard — ${Math.round(p.price_htg).toLocaleString('fr-FR')} HTG. Peye ak Hatexcard isit la: ${url}`;
              const waLink = `https://wa.me/?text=${encodeURIComponent(waText)}`;
              const fbLink = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
              return (
                <div key={p.id} className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {p.image_url ? (
                        <SafeImg src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={24} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 truncate">{p.name}</h3>
                          <p className="text-xs text-slate-500 truncate">
                            {p.description || 'Pa gen deskripsyon'}
                          </p>
                        </div>
                        <span
                          className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg shrink-0 ${
                            p.active
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-100'
                          }`}
                        >
                          {p.active ? 'Aktif' : 'An pòz'}
                        </span>
                      </div>


                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                        <span className="font-black text-slate-900 text-base">
                          {Math.round(p.price_htg).toLocaleString('fr-FR')} HTG
                        </span>
                        <span>· {p.sales_count} vant</span>
                        <span>
                          ·{' '}
                          {p.total_received_htg > 0
                            ? `${Math.round(p.total_received_htg).toLocaleString('fr-FR')} HTG resevwa`
                            : '0 HTG resevwa'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => copyLink(p)}
                          className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg transition-colors"
                        >
                          {copiedId === p.id ? <Check size={14} /> : <Clipboard size={14} />}
                          {copiedId === p.id ? 'Kopiye!' : 'Kopiye lyen'}
                        </button>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg transition-colors"
                        >
                          <Send size={14} /> WhatsApp
                        </a>
                        <a
                          href={fbLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg transition-colors"
                        >
                          <MessageCircle size={14} /> Messenger
                        </a>
                        <button
                          type="button"
                          onClick={() => copyLink(p)}
                          title="Voye mesaj Instagram ak lyen an"
                          className="flex items-center gap-1.5 text-xs font-bold bg-white border border-gray-200 hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg transition-colors"
                        >
                          <Share2 size={14} /> Instagram
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => toggleActive(p)}
                        className="text-xs font-bold text-slate-600 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {busyId === p.id ? '…' : p.active ? 'Mete an pòz' : 'Aktive'}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === p.id}
                        onClick={() => removeProduct(p)}
                        title="Efase pwodwi"
                        className="text-slate-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-[10px] text-slate-400 truncate">
                    Lyen peman: <span className="font-mono">{url}</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

