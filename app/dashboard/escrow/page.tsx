"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Wallet, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  Timer, 
  ShieldCheck,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function MerchantDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ escrow: 0, released: 0 });
  const [pendingSubs, setPendingSubs] = useState<any[]>([]);
  const [completedSubs, setCompletedSubs] = useState<any[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchMerchantData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Rale abònman ki an Escrow (Pending)
        const { data: pending } = await supabase
          .from('subscriptions')
          .select('*, products(title)')
          .eq('merchant_id', user.id)
          .eq('status', 'pending_escrow')
          .order('created_at', { ascending: false });

        // 2. Rale abònman ki fini (Completed)
        const { data: completed } = await supabase
          .from('subscriptions')
          .select('*, products(title)')
          .eq('merchant_id', user.id)
          .eq('status', 'completed')
          .limit(10)
          .order('created_at', { ascending: false });

        setPendingSubs(pending || []);
        setCompletedSubs(completed || []);

        // Kalkile estatistik
        const totalEscrow = pending?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
        const totalReleased = completed?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
        setStats({ escrow: totalEscrow, released: totalReleased });

      } catch (error) {
        console.error("Erè:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchantData();
  }, [supabase]);

  if (loading) return <div className="min-h-screen bg-[#06070d] flex items-center justify-center"><Loader2 className="animate-spin text-red-600" size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-4 md:p-10">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER AK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-orange-500/20 to-transparent border border-orange-500/20 p-8 rounded-[2.5rem] relative overflow-hidden">
            <Timer className="absolute -right-4 -bottom-4 text-orange-500/10" size={120} />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-2">Kòb ki Bloke (Escrow)</p>
            <h2 className="text-4xl font-black">{stats.escrow.toLocaleString()} <span className="text-sm">HTG</span></h2>
            <p className="text-xs text-zinc-500 mt-4 font-bold flex items-center gap-2">
              <Clock size={14} /> Ap lage otomatikman apre 1h15
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-500/20 to-transparent border border-green-500/20 p-8 rounded-[2.5rem] relative overflow-hidden">
            <CheckCircle2 className="absolute -right-4 -bottom-4 text-green-500/10" size={120} />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500 mb-2">Total Kòb Lage</p>
            <h2 className="text-4xl font-black">{stats.released.toLocaleString()} <span className="text-sm">HTG</span></h2>
            <p className="text-xs text-zinc-500 mt-4 font-bold flex items-center gap-2">
              <ShieldCheck size={14} /> Tranzaksyon verifye epi disponib
            </p>
          </div>
        </div>

        {/* TABLO PEMAN KI PENDING (ESCROW) */}
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Clock className="text-orange-500" /> Abònman an sekirite (Escrow)
          </h3>
          <div className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] overflow-hidden">
            {pendingSubs.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="p-6">Pwodwi</th>
                    <th className="p-6">Montan</th>
                    <th className="p-6">Lè l lage</th>
                    <th className="p-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pendingSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-6 font-bold">{sub.products?.title}</td>
                      <td className="p-6 font-black text-orange-500">{sub.amount} HTG</td>
                      <td className="p-6 text-zinc-400 text-xs">
                        {new Date(sub.escrow_release_at).toLocaleTimeString()}
                      </td>
                      <td className="p-6 text-right">
                        <span className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-orange-500/20">
                          Bloke
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-20 text-center text-zinc-600 font-bold uppercase tracking-widest text-xs">
                Ou pa gen okenn kòb ki bloke pou kounye a.
              </div>
            )}
          </div>
        </div>

        {/* TABLO PEMAN KI FINI */}
        <div className="space-y-6">
          <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
            <CheckCircle2 className="text-green-500" /> Dènye Peman ki Lage
          </h3>
          <div className="bg-[#0d0e1a] border border-white/5 rounded-[2.5rem] overflow-hidden">
            {completedSubs.length > 0 ? (
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="p-6">Pwodwi</th>
                    <th className="p-6">Montan</th>
                    <th className="p-6">Dat Siksè</th>
                    <th className="p-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {completedSubs.map((sub) => (
                    <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-6 font-bold">{sub.products?.title}</td>
                      <td className="p-6 font-black text-green-500">{sub.amount} HTG</td>
                      <td className="p-6 text-zinc-400 text-xs">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-6 text-right">
                        <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[9px] font-black uppercase border border-green-500/20">
                          Lage
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-20 text-center text-zinc-600 font-bold uppercase tracking-widest text-xs">
                Ou poko gen peman ki lage nan balans ou.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}