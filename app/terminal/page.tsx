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
        .eq('user_id', user.id) 
        .in('type', ['SALE', 'SALE_SDK', 'INVOICE_PAYMENT']) 
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
    
    // N ap sove invoice la. Sa ap deklanche Edge Function imèl la otomatikman.
    const { error } = await supabase.from('invoices').insert([
      { 
        owner_id: profile.id, 
        client_email: email.toLowerCase().trim(), 
        amount: parseFloat(amount), 
        status: 'pending',
        business_name: profile.business_name // Enpòtan pou imèl la konnen ki moun ki voye l
      }
    ]);

    if (!error) { 
        alert("Invoice voye bay " + email); 
        setMode('menu'); 
        setAmount('');
        setEmail('');
    } else {
        alert("Erè: " + error.message);
    }
    setLoading(false);
  };

  const updateBusinessName = async () => {
    if (!bizName) return alert("Ekri non biznis la");
    const { error } = await supabase
      .from('profiles')
      .update({ business_name: bizName })
      .eq('id', profile.id);
    if (!error) {
      alert("Biznis anrejistre!");
      setProfile({...profile, business_name: bizName});
    }
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

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans">
      
      {/* 1. SEKSYON POU METE NON BIZNIS SI LI POKO LA */}
      {!profile.business_name && (
        <div className="bg-red-600/10 p-6 rounded-[2rem] border border-red-600/20 mb-6 italic">
          <p className="text-[10px] font-black uppercase mb-3 text-red-500">Aksyon Obligatwa: Mete non Biznis ou anvan ou wè kòd API a</p>
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

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-xl font-black uppercase text-red-600">{profile.business_name || 'Hatex Terminal'}</h1>
          <p className="text-[8px] text-zinc-500 uppercase tracking-widest">Terminal ID: {profile.id.slice(0, 18)}...</p>
        </div>
        <button onClick={() => setMode('history')} className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5 shadow-lg active:scale-90 transition-all">
          <span className="text-xl">📊</span>
        </button>
      </div>

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
          
          {/* 2. BLOKE BOUTON API SI NON BIZNIS POKO VALIDE */}
          <button 
            onClick={() => profile.business_name ? setMode('api') : alert("Ou dwe sove non biznis ou anvan.")} 
            className={`bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 text-center active:scale-95 transition-all group ${!profile.business_name && 'opacity-30'}`}
          >
            <span className="block text-4xl mb-4 group-hover:scale-110 transition-transform">🔗</span>
            <span className="text-[11px] font-black uppercase tracking-widest block">Link sou Sit Web</span>
          </button>
        </div>
      )}

{mode === 'api' && profile.business_name && (
  <div className="space-y-6 animate-in zoom-in duration-300">
    <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10">
      <h2 className="text-[14px] font-black uppercase text-red-600 mb-4 italic tracking-widest text-center">SDK Smart Checkout (Livrezon Inclus)</h2>
      <div className="space-y-4">
        <p className="text-[9px] text-zinc-500 uppercase font-black text-center">
          Kòd sa a ap louvri yon fòm pou kliyan an antre enfòmasyon livrezon li anvan li peye.
        </p>
        
        <div className="relative group">
          <pre className="bg-black p-6 rounded-3xl border border-white/5 text-[9px] text-green-500 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed text-left h-96">
{`<div id="hatex-secure-pay"></div>
<script>
(function() {
  const TID = "${profile?.id}"; 
  const TAUX = 135; 
  const target = document.getElementById('hatex-secure-pay');

  // 1. KREYE BOUTON PEMAN AN
  const btn = document.createElement('button');
  btn.innerHTML = "ACHETER MAINTENANT (HTG)";
  btn.style = "background:#dc2626;color:white;width:100%;padding:20px;border-radius:15px;font-weight:900;border:none;cursor:pointer;font-family:sans-serif;box-shadow:0 10px 20px rgba(220,38,38,0.2);";
  
  // 2. KREYE FÒM LIVREZON AN (Hidden pa defo)
  const formHtml = \`
    <div id="hatex-form" style="display:none;margin-top:20px;padding:20px;background:#1a1a1a;border-radius:20px;border:1px solid #333;font-family:sans-serif;color:white;">
      <p style="font-size:10px;font-weight:900;text-transform:uppercase;color:#dc2626;margin-bottom:15px;">Informations de Livraison</p>
      <input id="htx_name" placeholder="Nom Complet" style="width:100%;background:#000;border:1px solid #333;padding:12px;border-radius:10px;color:white;margin-bottom:10px;font-size:12px;">
      <input id="htx_phone" placeholder="Téléphone" style="width:100%;background:#000;border:1px solid #333;padding:12px;border-radius:10px;color:white;margin-bottom:10px;font-size:12px;">
      <textarea id="htx_address" placeholder="Adresse complète de livraison" style="width:100%;background:#000;border:1px solid #333;padding:12px;border-radius:10px;color:white;margin-bottom:10px;font-size:12px;height:60px;"></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:15px;">
         <label style="font-size:10px;font-weight:bold;">KANTITE:</label>
         <input id="htx_qty" type="number" value="1" min="1" style="width:60px;background:#000;border:1px solid #333;padding:8px;border-radius:8px;color:white;text-align:center;">
      </div>
      <button id="htx_confirm" style="width:100%;background:#dc2626;color:white;padding:15px;border-radius:10px;font-weight:900;border:none;cursor:pointer;">CONFIRMER ET PAYER</button>
    </div>
  \`;
  target.innerHTML = formHtml;
  target.prepend(btn);

  btn.onclick = () => {
    document.getElementById('hatex-form').style.display = 'block';
    btn.style.display = 'none';
  };

  document.getElementById('htx_confirm').onclick = () => {
    const name = document.getElementById('htx_name').value;
    const phone = document.getElementById('htx_phone').value;
    const address = document.getElementById('htx_address').value;
    const qty = document.getElementById('htx_qty').value;

    if(!name || !phone || !address) return alert("Tanpri ranpli tout bwat yo.");

    // RALE PRI PWODWI A SOU PAJ LA
    const priceSelectors = ['.product-price', '.price', '.woocommerce-Price-amount'];
    let rawAmount = "0";
    for (let s of priceSelectors) {
      const el = document.querySelector(s);
      if (el) { ra = el.innerText.replace(/[^\\d.]/g, ''); break; }
    }

    const amountHTG = (parseFloat(ra || 0) * TAUX * qty).toFixed(2);
    const productName = document.querySelector('h1')?.innerText || document.title;
    const productImage = document.querySelector('meta[property="og:image"]')?.content || "";

    const params = new URLSearchParams({
      terminal: TID,
      amount: amountHTG,
      order_id: "HTX-" + Date.now(),
      customer_name: name,
      customer_phone: phone,
      customer_address: address,
      product_name: productName,
      product_image: productImage,
      quantity: qty,
      platform: window.location.hostname
    });

    window.location.href = "https://hatexcard.com/checkout?" + params.toString();
  };
})();
</script>`}
          </pre>
          <button 
            onClick={() => {
              const code = document.querySelector('pre')?.innerText || "";
              navigator.clipboard.writeText(code);
              alert("SDK Konplè kopye!");
            }}
            className="absolute top-4 right-4 bg-red-600 p-2 rounded-lg text-[8px] uppercase font-black shadow-lg active:scale-90 transition-all"
          >
            KOPYE KÒD KONPLÈ
          </button>
        </div>
      </div>
    </div>
    <button onClick={() => setMode('menu')} className="w-full text-zinc-500 font-black uppercase text-[10px] tracking-widest text-center">Tounen nan Menu</button>
  </div>
)}
      <div className="mt-8 bg-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
        <div className="p-4 bg-zinc-900/50 border-b border-white/5">
          <p className="text-[10px] font-black uppercase text-red-600 italic">Titoryèl Entegrasyon</p>
        </div>
        <div className="aspect-video w-full">
          <iframe 
            className="w-full h-full"
            src="https://www.youtube.com/embed/VIDEO_ID_OU" 
            title="HatexCard Integration"
            allowFullScreen
          ></iframe>
        </div>
      </div>

      {mode === 'history' && (
  <div className="space-y-4 animate-in slide-in-from-right-4">
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em]">Istorik Vant SDK</h2>
      <button onClick={() => setMode('menu')} className="text-[10px] font-bold text-red-600 underline uppercase">FÈMEN</button>
    </div>
    
    {invoices.length === 0 ? (
      <p className="text-center text-[10px] text-zinc-700 py-10 uppercase font-black italic">Okenn vant poko fèt</p>
    ) : (
      invoices.map((inv) => (
        <div key={inv.id} className="bg-zinc-900/40 p-5 rounded-[2.5rem] border border-white/5 hover:border-red-600/20 transition-all space-y-4">
          
          {/* Tèt: Platfòm ak Montan */}
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className="w-10 h-10 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-600 font-black text-[9px]">
                {inv.platform ? inv.platform.slice(0,3).toUpperCase() : 'SDK'}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-white leading-none mb-1">{inv.platform || 'Vant Anliy'}</p>
                <p className="text-[7px] text-zinc-600 uppercase font-bold">
                  {new Date(inv.created_at).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            {/* Nou itilize abs(inv.amount) paske nan transactions li sove an negatif pou kliyan an */}
            <p className="text-sm font-black text-green-500 italic">
              +{Math.abs(inv.amount).toLocaleString()} HTG
            </p>
          </div>

          {/* Seksyon Pwodwi: Foto ak Detay */}
          {inv.product_name && (
            <div className="flex gap-3 items-center bg-black/40 p-3 rounded-2xl border border-white/5">
              {inv.product_image ? (
                <img 
                  src={inv.product_image} 
                  alt="Pwodwi"
                  className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow-lg" 
                />
              ) : (
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-[8px] text-zinc-600 uppercase font-black">No img</div>
              )}
              <div className="flex-1 overflow-hidden">
                <p className="text-[9px] font-black text-zinc-300 truncate uppercase tracking-tighter">{inv.product_name}</p>
                <p className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">
                  Kantite: <span className="text-red-600">{inv.quantity || 1}</span>
                </p>
                {inv.product_url && (
                  <a href={inv.product_url} target="_blank" rel="noopener noreferrer" className="text-[7px] text-blue-500 underline uppercase font-black mt-1 block">Wè atik la</a>
                )}
              </div>
            </div>
          )}

          {/* Seksyon Kliyan & Livrezon */}
          {(inv.customer_name || inv.customer_address) && (
            <div className="pl-3 py-1 border-l-2 border-red-600/30 bg-white/[0.02] rounded-r-xl">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[9px] text-white font-black uppercase tracking-tight">
                  {inv.customer_name || 'Kliyan Enkoni'}
                </p>
                <span className="text-[7px] text-zinc-600">•</span>
                <p className="text-[8px] text-red-500 font-black">{inv.customer_phone}</p>
              </div>
              {inv.customer_address && (
                <div className="flex items-start gap-1">
                  <span className="text-[8px]">📍</span>
                  <p className="text-[8px] text-zinc-400 font-medium leading-tight italic max-w-[200px]">
                    {inv.customer_address}
                  </p>
                </div>
              )}
            </div>
          )}
          
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