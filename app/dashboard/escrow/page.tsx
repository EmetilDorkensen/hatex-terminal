"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Loader2, 
  ShieldCheck, 
  TrendingUp, 
  Users, 
  Search, 
  Clock, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function EscrowPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [escrowSubs, setEscrowSubs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total_pending: 0, active_count: 0 });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function fetchEscrowData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Sekirite: Sèlman kontinye si nou gen yon USER (ranje erè undefined la)
      if (!user) return;

      // 1. Rale pwofil la (ranje erè avatar_url la ak optional chaining nan UI a)
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(prof);

      // 2. Rale abònman ki nan Escrow (pending_escrow)
      const { data: subs } = await supabase
        .from('subscriptions')
        .select('*, products(title)')
        .eq('merchant_id', user.id)
        .order('created_at', { ascending: false });

      if (subs) {
        setEscrowSubs(subs);
        const pending = subs.filter(s => s.status === 'pending_escrow').reduce((acc, curr) => acc + curr.amount, 0);
        const active = subs.filter(s => s.status === 'completed').length;
        setStats({ total_pending: pending, active_count: active });
      }

      setLoading(false);
    }

    fetchEscrowData();
  }, [supabase]);

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 md:p-10 italic font-medium">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">
              MACHE <span className="text-red-600">ABÒNMAN</span>
            </h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2">
              Jere kliyan ak revni H-Pay ou yo
            </p>
          </div>
          
          {/* KYC Status (si profile la null li p ap crash) */}
          {profile?.kyc_status !== 'verified' && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-6 py-3 rounded-2xl font-black uppercase text-[9px] flex items-center gap-3">
              <AlertCircle size={14} /> KYC PENDING: VERIFYE KONT OU POU W KA RETIRE KÒB
            </div>
          )}
        </div>

        {/* STATS (Jan sa te ye nan image_8e0917.png) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
            <TrendingUp className="absolute -right-4 -bottom-4 text-zinc-600/10 w-32 h-32" />
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-2 italic">Total Revenu Mansyèl</p>
            <h3 className="text-4xl font-black italic">{stats.total_pending.toLocaleString()} <span className="text-sm text-red-600">HTG</span></h3>
            <span className="text-[9px] text-green-500 font-black uppercase mt-4 block">↗ Nan kous</span>
          </div>

          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem]">
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-2">Kliyan Aktif</p>
            <div className="flex items-center gap-4">
               <h3 className="text-4xl font-black italic">{stats.active_count}</h3>
               <Users className="text-blue-500/20" size={30} />
            </div>
          </div>

          <div className="bg-red-600 p-8 rounded-[2.5rem] shadow-2xl shadow-red-600/20 relative overflow-hidden">
             <div className="relative z-10 space-y-4">
                <p className="text-[9px] font-black uppercase opacity-60">Sistèm Sekirite</p>
                <h2 className="text-xl font-black uppercase leading-tight italic">Tout peman yo verifye pa H-Pay Shield</h2>
                <button className="w-full bg-black py-3 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all">
                  Wè Rapò
                </button>
             </div>
          </div>
        </div>

        {/* TABLO TRANZAKSYON YO */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Dènye Abònman yo</h2>
            <button className="text-[9px] font-black uppercase text-red-600 hover:underline">Telechaje lis (CSV)</button>
          </div>

          <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] overflow-hidden min-h-[300px] flex flex-col items-center justify-center p-10">
            {escrowSubs.length === 0 ? (
              <p className="text-zinc-600 font-black uppercase text-[10px] italic tracking-widest text-center">
                Ou pa gen okenn abònman aktif pou kounye a.
              </p>
            ) : (
              <div className="w-full space-y-4">
                {escrowSubs.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between p-6 bg-black/40 rounded-[2rem] border border-white/5 hover:border-red-600/20 transition-all">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-full ${sub.status === 'pending_escrow' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}`}>
                        {sub.status === 'pending_escrow' ? <Clock size={20} /> : <CheckCircle2 size={20} />}
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tighter">{sub.products?.title || 'Sèvis'}</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">{new Date(sub.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black italic">{sub.amount.toLocaleString()} HTG</p>
                      <p className={`text-[8px] font-black uppercase ${sub.status === 'pending_escrow' ? 'text-orange-500' : 'text-green-500'}`}>
                        {sub.status === 'pending_escrow' ? 'Bloke nan Escrow' : 'Lage sou kont'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}