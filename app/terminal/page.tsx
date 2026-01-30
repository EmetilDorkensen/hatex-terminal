"use client";
import React, { useState, useEffect, useMemo } from 'react'; // Ajoute useMemo
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

  // Sèvi ak useMemo pou anpeche erè "supabaseKey is required" pandan Build
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    const initTerminal = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      // Si profil la pa jwenn oswa li poko pase KYC
      if (!prof) return;
      setProfile(prof);

      // Rale istorik vant tèminal (SALE)
      const { data: inv } = await supabase
        .from('transactions')
        .select(`id, amount, created_at, status, user_id`)
        .eq('type', 'SALE') 
        .eq('merchant_id', user.id) // Asire w ou filtre pa ID machann nan
        .order('created_at', { ascending: false });

      setInvoices(inv || []);
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

  // Sekirite pou Build: Si profil la poko chaje
  if (!profile) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-white italic uppercase font-black">Y ap chaje...</div>;

  if (profile?.kyc_status !== 'approved') {
    return (
        <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center p-10 text-center text-white italic uppercase font-black">
            <span className="text-6xl mb-4">🔒</span>
            <p>KYC Obligatwa pou itilize Tèminal la.</p>
            <button onClick={() => router.push('/dashboard')} className="mt-6 text-[10px] text-red-600 underline">Tounen nan Dashboard</button>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans">
      {/* Sèlman si ou gen dosye sa a nan folder public/ */}
      {/* <Script src="/sdk-hatex.js" strategy="afterInteractive" /> */}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-xl font-black uppercase text-red-600">Hatex Terminal</h1>
          <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Terminal ID: {profile.id.slice(0, 18)}...</p>
        </div>
        <button onClick={() => setMode('history')} className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 shadow-lg">
          <span className="text-xl">📊</span>
        </button>
      </div>

      {/* MENU PRENSIPAL */}
      {mode === 'menu' && (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
          <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 text-center active:scale-95 transition-all">
            <span className="block text-4xl mb-4">📧</span>
            <span className="text-[11px] font-black uppercase tracking-widest block">Invoice pa Email</span>
          </button>
          <button onClick={() => setMode('api')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 text-center active:scale-95 transition-all">
            <span className="block text-4xl mb-4">🔗</span>
            <span className="text-[11px] font-black uppercase tracking-widest block">Link sou Sit Web</span>
          </button>
        </div>
      )}

      {/* GID API (Bouton Otomatik) */}
      {mode === 'api' && (
        <div className="space-y-6 animate-in zoom-in duration-300">
          <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10">
            <h2 className="text-[14px] font-black uppercase text-red-600 mb-4 italic tracking-widest text-center">API Entegrasyon</h2>
            <div className="space-y-6">
              <p className="text-[9px] text-zinc-500 uppercase font-black text-center">Kopye kòd sa a epi mete l sou sit ou a.</p>
              <div className="relative group">
                <pre className="bg-black p-6 rounded-3xl border border-white/5 text-[10px] text-green-500 font-mono overflow-x-auto whitespace-pre-wrap">
{`<a href="https://hatexcard.com/checkout?terminal=${profile?.id}&amount=100" 
   style="background:#dc2626;color:white;padding:15px 30px;border-radius:50px;text-decoration:none;font-weight:900;font-family:sans-serif;display:inline-flex;align-items:center;gap:10px;font-style:italic;">
   <span>💳</span> PEYE AK HATEXCARD
</a>`}
                </pre>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`<a href="https://hatexcard.com/checkout?terminal=${profile?.id}&amount=100" style="...">PEYE AK HATEXCARD</a>`);
                    alert("Kòd kopye!");
                  }}
                  className="absolute top-4 right-4 bg-white/10 p-2 rounded-lg text-[8px] uppercase font-black"
                >
                  KOPYE
                </button>
              </div>
            </div>
          </div>
          <button onClick={() => setMode('menu')} className="w-full text-zinc-500 font-black uppercase text-[10px]">Tounen nan Menu</button>
        </div>
      )}

      {/* ISTORIK VANT */}
      {mode === 'history' && (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[11px] font-black uppercase text-zinc-500">Vant Tèminal</h2>
            <button onClick={() => setMode('menu')} className="text-[10px] font-bold text-red-600 underline">FÈMEN</button>
          </div>
          {invoices.length === 0 ? (
            <p className="text-center text-[10px] text-zinc-700 py-10 uppercase font-black">Okenn tranzaksyon</p>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} className="bg-zinc-900/60 p-5 rounded-[2rem] border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-red-600/10 rounded-full flex items-center justify-center text-red-600 font-black text-[10px]">
                    TX
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-tighter">ID: {inv.id.slice(0, 8)}</p>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white italic">+{inv.amount} HTG</p>
                  <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-md ${inv.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* FORMULAIRE INVOICE */}
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
          <button onClick={() => setMode('menu')} className="w-full text-[9px] font-black uppercase text-zinc-700 py-4">Anile</button>
        </div>
      )}
    </div>
  );
}