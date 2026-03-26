"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  CheckCircle2, 
  Calendar, 
  ShieldCheck, 
  Download,
  Home,
  Sparkles
} from 'lucide-react';

export default function SubscriptionSuccess() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function getProduct() {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      setProduct(data);
      setLoading(false);
    }
    if (id) getProduct();
  }, [id, supabase]);

  if (loading) return (
    <div className="min-h-screen bg-[#06070d] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#06070d] text-white flex items-center justify-center p-6 italic font-medium">
      {/* BACKGROUND EFFECTS */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-[500px] w-full bg-[#0d0e1a] border border-white/5 rounded-[4rem] p-10 md:p-14 text-center shadow-2xl relative z-10">
        
        {/* ANIMATED ICON */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
          <div className="relative bg-green-500 rounded-full w-full h-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.4)]">
            <CheckCircle2 size={48} className="text-black" strokeWidth={3} />
          </div>
          <Sparkles className="absolute -top-2 -right-2 text-yellow-500 animate-pulse" size={24} />
        </div>

        {/* TEXT CONTENT */}
        <div className="space-y-4 mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter italic">Peman <span className="text-green-500 text-4xl">Reyisi!</span></h1>
          <p className="text-zinc-500 text-[11px] font-black uppercase tracking-[0.2em] leading-relaxed">
            Abònman ou a aktive ak siksè sou rezo <span className="text-red-600">H-Pay</span> la.
          </p>
        </div>

        {/* TRANSACTION CARD */}
        <div className="bg-black/40 border border-white/5 rounded-[2.5rem] p-6 mb-8 text-left space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <div>
              <p className="text-[9px] text-zinc-500 font-black uppercase">Sèvis</p>
              <h4 className="text-sm font-black uppercase tracking-tight">{product?.title}</h4>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-500 font-black uppercase">Montan</p>
              <h4 className="text-sm font-black text-red-600 italic">{product?.price} HTG</h4>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-lg"><Calendar size={14} className="text-zinc-400" /></div>
              <div>
                <p className="text-[8px] text-zinc-500 font-black uppercase">Pwochen Peman</p>
                <p className="text-[10px] font-bold uppercase">Mwa Pwochain</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/5 rounded-lg"><ShieldCheck size={14} className="text-green-500/50" /></div>
              <div>
                <p className="text-[8px] text-zinc-500 font-black uppercase">Estati</p>
                <p className="text-[10px] font-bold uppercase text-green-500 italic">Aktif</p>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="space-y-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full bg-white text-black py-5 rounded-[2rem] font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-3 hover:bg-zinc-200 transition-all shadow-xl group"
          >
            <Home size={18} />
            Retounen nan Dashboard
          </button>
          
          <button className="w-full bg-white/5 border border-white/5 text-zinc-400 py-4 rounded-[1.8rem] font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 hover:bg-white/10 transition-all italic">
            <Download size={14} /> Telechaje Resi a (PDF)
          </button>
        </div>

        {/* FOOTER MESSAGE - KORIJE AK SVG POU EVITE ERÈ */}
        <p className="mt-8 text-[9px] text-zinc-600 font-black uppercase tracking-widest flex items-center justify-center gap-2">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Tranzaksyon Sekirize pa H-Pay Global
        </p>
      </div>
    </div>
  );
}