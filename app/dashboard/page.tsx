"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ShieldCheck,
  CreditCard
} from 'lucide-react';

export default function MerchantSubscriptionDashboard() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [stats, setStats] = useState({
    totalRevenue: 0,
    activeClients: 0,
    pendingKYC: false
  });
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    const fetchMerchantData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // 1. Tcheke si Machann nan verifye (KYC)
        const { data: profile } = await supabase
          .from('profiles')
          .select('kyc_status, wallet_balance')
          .eq('id', user.id)
          .single();

        // 2. Jwenn tout abònman aktif pou pwodwi machann sa a
        // Nou itilize .select('*, products(*)') pou nou ka gen pri a
        const { data: subs, error } = await supabase
          .from('subscriptions')
          .select(`
            *,
            products (
              title,
              price
            ),
            profiles:client_id (
              full_name,
              email
            )
          `)
          .eq('merchant_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (subs) {
          const total = subs.reduce((acc, curr: any) => acc + (curr.products?.price || 0), 0);
          setStats({
            totalRevenue: total,
            activeClients: subs.length,
            pendingKYC: profile?.kyc_status !== 'verified'
          });
          setSubscriptions(subs);
        }

        setLoading(false);
      } catch (err) {
        console.error("Erè nan chaje done machann:", err);
        setLoading(false);
      }
    };

    fetchMerchantData();
  }, [supabase, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 font-sans italic">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER STATS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">Mache <span className="text-red-600 text-4xl">Abònman</span></h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Jere kliyan ak revni H-Pay ou yo</p>
          </div>
          {stats.pendingKYC && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-2xl flex items-center gap-3">
              <ShieldCheck className="text-yellow-500" size={20} />
              <p className="text-[9px] font-black uppercase text-yellow-500">KYC PENDING: Verifye kont ou pou w ka retire kòb</p>
            </div>
          )}
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-red-600/30 transition-all shadow-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <DollarSign size={80} />
            </div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Total Revenu Mansyèl</p>
            <h3 className="text-5xl font-black italic tracking-tighter">{stats.totalRevenue.toLocaleString()} <span className="text-xs text-red-600 uppercase">HTG</span></h3>
            <div className="mt-4 flex items-center gap-2 text-green-500">
              <TrendingUp size={14} />
              <span className="text-[9px] font-black uppercase">Nan kous</span>
            </div>
          </div>

          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem] shadow-2xl">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Kliyan Aktif</p>
            <div className="flex items-center gap-4">
               <h3 className="text-5xl font-black italic tracking-tighter">{stats.activeClients}</h3>
               <div className="p-3 bg-blue-500/10 rounded-2xl">
                 <Users className="text-blue-500" size={24} />
               </div>
            </div>
          </div>

          <div className="bg-red-600 p-8 rounded-[2.5rem] shadow-2xl shadow-red-600/10 flex flex-col justify-between">
            <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">Sistèm Sekirite</p>
            <h3 className="text-xl font-black uppercase leading-tight italic">Tout peman yo verifye pa <span className="text-black">H-Pay Shield</span></h3>
            <button className="mt-4 bg-black text-white py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-zinc-900 transition-all">Wè Rapò</button>
          </div>
        </div>

        {/* LIS KLIYAN YO */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-4">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Dènye Abònman yo</h4>
            <button className="text-[9px] font-black uppercase text-red-600 hover:underline">Telechaje Lis (CSV)</button>
          </div>

          <div className="grid gap-4">
            {subscriptions.length === 0 ? (
              <div className="bg-[#0d0e1a] border border-white/5 p-12 rounded-[3rem] text-center">
                <p className="text-zinc-600 font-black uppercase text-[10px] tracking-widest italic">Ou pa gen okenn abònman aktif pou kounye a.</p>
              </div>
            ) : (
              subscriptions.map((sub) => (
                <div key={sub.id} className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2.5rem] flex flex-wrap items-center justify-between gap-6 hover:bg-white/[0.02] transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white/5 rounded-[1.5rem] flex items-center justify-center text-red-600 group-hover:scale-110 transition-transform">
                      <CreditCard size={24} />
                    </div>
                    <div>
                      <h5 className="font-black uppercase text-sm italic tracking-tight">{sub.profiles?.full_name || "Kliyan Anonim"}</h5>
                      <p className="text-[9px] text-zinc-500 font-bold lowercase">{sub.profiles?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-12">
                    <div className="text-center">
                      <p className="text-[8px] text-zinc-600 font-black uppercase">Pwodwi</p>
                      <p className="text-[10px] font-black uppercase text-zinc-300 italic">{sub.products?.title}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-zinc-600 font-black uppercase">Pwochen Peman</p>
                      <p className="text-[10px] font-black text-white italic">
                        {new Date(sub.next_billing_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="bg-green-500/10 px-4 py-2 rounded-xl border border-green-500/20">
                      <p className="text-green-500 text-[9px] font-black uppercase italic">Aktif</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black italic">{sub.products?.price} <span className="text-[10px]">HTG</span></p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* FOOTER NAV (Kliyan ka tounen nan Terminal la fasil) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-2xl border border-white/10 px-8 py-4 rounded-[2.5rem] flex items-center gap-10 shadow-2xl z-50">
        <button onClick={() => router.push('/dashboard')} className="opacity-40 hover:opacity-100 transition-opacity flex flex-col items-center">
          <div className="w-1 h-1 bg-white rounded-full mb-1"></div>
          <span className="text-[8px] font-black uppercase">Akey</span>
        </button>
        <button onClick={() => router.push('/terminal')} className="bg-red-600 p-4 rounded-2xl -mt-12 shadow-xl shadow-red-600/40 rotate-12 hover:rotate-0 transition-all">
          <ArrowUpRight className="text-white" size={24} />
        </button>
        <button className="flex flex-col items-center text-red-600">
          <div className="w-1 h-1 bg-red-600 rounded-full mb-1"></div>
          <span className="text-[8px] font-black uppercase">Mache</span>
        </button>
      </div>
    </div>
  );
}