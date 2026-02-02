"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Script from 'next/script';

export default function TerminalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<'menu' | 'request' | 'api' | 'history'>('menu');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [bizName, setBizName] = useState('');

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    const initTerminal = async () => {
      // 1. Tcheke sesyon itilizatè a
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        router.push('/login');
        return;
      }

      // 2. Rale profil la
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!prof) return;
      setProfile(prof);

      // 3. Rale istorik vant tèminal (SALE_SDK ak SALE)
      const { data: inv } = await supabase
        .from('transactions')
        .select(`id, amount, created_at, status, description`)
        .eq('user_id', user.id) // Se ID mèt la nou itilize kounye a
        .in('type', ['SALE', 'SALE_SDK']) 
        .order('created_at', { ascending: false });

      setInvoices(inv || []);

      // 4. ACTIVE REALTIME NOTIFICATION
      const channel = supabase
        .channel('peman-live')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'terminal_notifications',
            filter: `terminal_owner_id=eq.${user.id}` 
        }, (payload) => {
            alert(`NOTIFIKASYON: Ou resevwa ${payload.new.amount} HTG nan men ${payload.new.customer_name}`);
            // Mizajou lis la otomatikman
            setInvoices(prev => [{
                id: payload.new.id,
                amount: payload.new.amount,
                created_at: new Date().toISOString(),
                status: 'success',
                description: `Vente à ${payload.new.customer_name}`
            }, ...prev]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    initTerminal();
  }, [supabase, router]);

  const handleCreateInvoice = async () => {
    if (!amount || !email) return alert("Ranpli detay yo");
    setLoading(true);
    const { error } = await supabase.from('invoices').insert([
      { owner_id: profile.id, client_email: email.toLowerCase().trim(), amount: parseFloat(amount), status: 'pending' }
    ]);
    if (!error) { 
        alert("Invoice voye!"); 
        setMode('menu'); 
        setAmount('');
        setEmail('');
    } else {
        alert("Erè: " + error.message);
    }
    setLoading(false);
  };

  if (!profile) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white italic uppercase font-black animate-pulse">Sekirite Hatex ap chaje...</div>;
  const totalVant = invoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);
  if (profile?.kyc_status !== 'approved') {
    return (
        <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center p-10 text-center text-white italic uppercase font-black">
            <span className="text-6xl mb-4">🔒</span>
            <p className="text-sm">KYC Obligatwa pou itilize Tèminal la.</p>
            <button onClick={() => router.push('/dashboard')} className="mt-6 text-[10px] text-red-600 underline">Tounen nan Dashboard</button>
        </div>
    );
  }

  if (mode === 'api' && !profile.business_name) {
    return (
      <div className="p-10 text-center">
        <p className="text-red-500 font-bold">Ou dwe mete non biznis ou anvan ou wè kòd API a.</p>
        <button onClick={() => setMode('menu')} className="mt-4 underline">Tounen pou ranpli l</button>
      </div>
    );
  }

  const updateBusinessName = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ business_name: bizName })
      .eq('id', profile.id);
    if (!error) {
      alert("Biznis anrejistre!");
      window.location.reload();
    }
  };
  
  // Nan pati HTML la, anlè MENU a:
  {!profile.business_name && (
    <div className="bg-red-600/10 p-6 rounded-[2rem] border border-red-600/20 mb-6 italic">
      <p className="text-[10px] font-black uppercase mb-3 text-red-500">Aksyon Obligatwa: Mete non Biznis ou</p>
      <div className="flex gap-2">
        <input 
          className="bg-black border border-white/10 p-3 rounded-xl flex-1 text-xs outline-none"
          placeholder="Egz: Hatex Shop"
          onChange={(e) => setBizName(e.target.value)}
        />
        <button onClick={updateBusinessName} className="bg-white text-black px-4 rounded-xl text-[10px] font-black uppercase">Sove</button>
      </div>
    </div>
  )}
  

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-xl font-black uppercase text-red-600">Hatex Terminal</h1>
          <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Terminal ID: {profile.id.slice(0, 18)}...</p>
        </div>
        <button onClick={() => setMode('history')} className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 shadow-lg active:scale-90 transition-all">
          <span className="text-xl">📊</span>
        </button>
      </div>

{/* AJOUTE BLÒK SA A KREYE A ISIT LA */}
<div className="grid grid-cols-2 gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
  <div className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5 shadow-xl shadow-black/20">
    <p className="text-[8px] text-zinc-500 uppercase font-black mb-1 tracking-widest">Vant Total</p>
    <p className="text-xl font-black italic text-red-600">{totalVant.toLocaleString()} <span className="text-[10px]">HTG</span></p>
  </div>
  <div className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5 shadow-xl shadow-black/20">
    <p className="text-[8px] text-zinc-500 uppercase font-black mb-1 tracking-widest">Aktivite</p>
    <p className="text-xl font-black italic">{invoices.length} <span className="text-[10px]">TX</span></p>
  </div>
</div>

      {mode === 'menu' && (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
          <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 text-center active:scale-95 transition-all group">
            <span className="block text-4xl mb-4 group-hover:scale-110 transition-transform">📧</span>
            <span className="text-[11px] font-black uppercase tracking-widest block">Invoice pa Email</span>
          </button>
          <button onClick={() => setMode('api')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 text-center active:scale-95 transition-all group">
            <span className="block text-4xl mb-4 group-hover:scale-110 transition-transform">🔗</span>
            <span className="text-[11px] font-black uppercase tracking-widest block">Link sou Sit Web</span>
          </button>
        </div>
      )}

      {mode === 'api' && (
        <div className="space-y-6 animate-in zoom-in duration-300">
          <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10">
            <h2 className="text-[14px] font-black uppercase text-red-600 mb-4 italic tracking-widest text-center">SDK Entegrasyon</h2>
            <div className="space-y-6">
              <p className="text-[9px] text-zinc-500 uppercase font-black text-center">Kopye kòd dinamik sa a pou panyen sit ou a.</p>
              <div className="relative group">
                <pre className="bg-black p-6 rounded-3xl border border-white/5 text-[9px] text-green-500 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`<a href="https://hatexcard.com/checkout?terminal=${profile?.id}&amount=PRI_PANYEN&order_id=LOD_ID" 
   style="background:#dc2626;color:white;padding:15px 30px;border-radius:50px;text-decoration:none;font-weight:900;font-style:italic;display:inline-flex;align-items:center;gap:10px;">
   <span>💳</span> PEYE AK HATEXCARD
</a>`}
                </pre>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`<a href="https://hatexcard.com/checkout?terminal=${profile?.id}&amount=PRI_PANYEN&order_id=LOD_ID" style="...">PEYE AK HATEXCARD</a>`);
                    alert("Kòd kopye!");
                  }}
                  className="absolute top-4 right-4 bg-white/10 p-2 rounded-lg text-[8px] uppercase font-black hover:bg-white/20"
                >
                  KOPYE
                </button>
              </div>
            </div>
          </div>
          <button onClick={() => setMode('menu')} className="w-full text-zinc-500 font-black uppercase text-[10px] tracking-widest">Tounen nan Menu</button>
        </div>
      )}
{/* VIDEO TUTORIAL */}
<div className="mt-8 bg-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
  <div className="p-4 bg-zinc-900/50 border-b border-white/5">
    <p className="text-[10px] font-black uppercase text-red-600 italic">Titoryèl Entegrasyon</p>
  </div>
  <div className="aspect-video w-full">
    <iframe 
      className="w-full h-full"
      src="https://www.youtube.com/embed/VIDEO_ID_OU" 
      title="HatexCard Integration"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowFullScreen
    ></iframe>
  </div>
</div>
      {mode === 'history' && (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em]">Vant Live</h2>
            <button onClick={() => setMode('menu')} className="text-[10px] font-bold text-red-600 underline uppercase">FÈMEN</button>
          </div>
          {invoices.length === 0 ? (
            <p className="text-center text-[10px] text-zinc-700 py-10 uppercase font-black italic">Okenn tranzaksyon poko fèt</p>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} className="bg-zinc-900/60 p-5 rounded-[2rem] border border-white/5 flex justify-between items-center hover:border-red-600/20 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 font-black text-[9px]">
                    SDK
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-tighter">{inv.description || 'Vente Terminal'}</p>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">
                      {new Date(inv.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white italic">+{inv.amount} HTG</p>
                  <span className="text-[7px] font-black uppercase px-2 py-0.5 rounded-md bg-green-500/10 text-green-500">
                    {inv.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {mode === 'request' && (
        <div className="space-y-4 animate-in zoom-in duration-300">
          <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-white/5 text-center">
            <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-5xl font-black text-center w-full outline-none placeholder:text-zinc-800" />
          </div>
          <div className="bg-zinc-900/40 p-6 rounded-[2rem] border border-white/5">
            <input type="email" placeholder="EMAIL KLIYAN" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent text-center text-xs font-bold w-full outline-none uppercase" />
          </div>
          <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-8 rounded-[4rem] font-black uppercase italic shadow-xl shadow-red-600/20 active:scale-95 transition-all">
            {loading ? 'Y ap voye...' : 'Voye Invoice'}
          </button>
          <button onClick={() => setMode('menu')} className="w-full text-[9px] font-black uppercase text-zinc-700 py-4 tracking-widest">Anile</button>
        </div>
      )}
    </div>
  );
}