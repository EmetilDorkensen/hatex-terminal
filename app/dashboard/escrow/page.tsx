"use client";

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Clock, 
  CheckCircle2, 
  ShieldCheck,
  Loader2,
  Timer,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function EscrowPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ escrow: 0, released: 0 });
  const [pendingSubs, setPendingSubs] = useState<any[]>([]);
  const [completedSubs, setCompletedSubs] = useState<any[]>([]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchEscrowLogs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Rale kòb ki nan tann (Escrow)
        const { data: pending } = await supabase
          .from('subscriptions')
          .select('*, products(title)')
          .eq('merchant_id', user.id)
          .eq('status', 'pending_escrow')
          .order('created_at', { ascending: false });

        // 2. Rale kòb ki deja lage (Completed)
        const { data: completed } = await supabase
          .from('subscriptions')
          .select('*, products(title)')
          .eq('merchant_id', user.id)
          .eq('status', 'completed')
          .limit(10)
          .order('created_at', { ascending: false });

        setPendingSubs(pending || []);
        setCompletedSubs(completed || []);

        const totalEscrow = pending?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
        const totalReleased = completed?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
        setStats({ escrow: totalEscrow, released: totalReleased });

      } catch (error) {
        console.error("Erè:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEscrowLogs();
  }, [supabase]);

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <Loader2 className="animate-spin text-red-600" size={40} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-10">
        
        {/* BACK BUTTON POU RETOUNEN NAN BÈL DASHBOARD OU A */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest">
          <ArrowLeft size={16} /> Retounen nan Dashboard
        </Link>

        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black uppercase tracking-tighter">Sistèm Escrow</h1>
          <p className="text-zinc-500 text-sm font-medium">Jere peman ki an sekirite epi swiv lè y ap disponib nan balans ou.</p>
        </div>

        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0d0e1a] border border-orange-500/20 p-8 rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Timer size={80} className="text-orange-500" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-2">An Sekirite (Bloke)</p>
            <h2 className="text-4xl font-black">{stats.escrow.toLocaleString()} <span className="text-sm">HTG</span></h2>
            <div className="mt-6 flex items-center gap-2 text-[10px] bg-orange-500/10 text-orange-500 w-fit px-3 py-1 rounded-full font-bold">
              <Clock size={12} /> Lage apre 1h15 minit
            </div>
          </div>

          <div className="bg-[#0d0e1a] border border-green-500/20 p-8 rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldCheck size={80} className="text-green-500" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-green-500 mb-2">Total Lage nan Balans</p>
            <h2 className="text-4xl font-black">{stats.released.toLocaleString()} <span className="text-sm">HTG</span></h2>
            <div className="mt-6 flex items-center gap-2 text-[10px] bg-green-500/10 text-green-500 w-fit px-3 py-1 rounded-full font-bold">
              <CheckCircle2 size={12} /> Verifikasyon Hatex fini
            </div>
          </div>
        </div>

        {/* LISTING */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Clock size={18} className="text-orange-500" /> Tranzaksyon an kous
            </h3>
            <span className="text-[10px] text-zinc-600 font-bold">{pendingSubs.length} pending</span>
          </div>

          <div className="bg-[#0d0e1a] border border-white/5 rounded-[2rem] overflow-hidden">
            {pendingSubs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-zinc-500 uppercase font-black tracking-tighter">
                    <tr>
                      <th className="p-5">Pwodwi</th>
                      <th className="p-5 text-center">Montan</th>
                      <th className="p-5 text-right">Lè lage a</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pendingSubs.map((sub) => (
                      <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-5 font-bold uppercase tracking-tighter">{sub.products?.title}</td>
                        <td className="p-5 text-center font-black text-orange-500">{sub.amount} HTG</td>
                        <td className="p-5 text-right font-mono text-zinc-400">
                          {new Date(sub.escrow_release_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-16 text-center text-zinc-700 font-black uppercase tracking-widest text-[10px]">
                Pa gen kòb ki bloke pou kounye a.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}