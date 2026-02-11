"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Package, MapPin, Phone, History, 
  Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, ShoppingCart, Globe 
} from 'lucide-react';

export default function TerminalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<'menu' | 'request' | 'api' | 'history'>('menu');
  const [transactions, setTransactions] = useState<any[]>([]);
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
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) return router.push('/login');

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!prof) return;
      setProfile(prof);

      // Rale tout tranzaksyon ki gen rapò ak lavant
      const { data: tx } = await supabase
        .from('transactions')
        .select(`*`)
        .eq('user_id', user.id)
        .in('type', ['PAYMENT', 'SALE', 'SALE_SDK', 'INVOICE_PAYMENT'])
        .order('created_at', { ascending: false });

      setTransactions(tx || []);

      // Realtime Notification
      const channel = supabase
        .channel('peman-live')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'transactions',
            filter: `user_id=eq.${user.id}` 
        }, (payload) => {
            setTransactions(prev => [payload.new, ...prev]);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    initTerminal();
  }, [supabase, router]);

  const handleCreateInvoice = async () => {
    if (!amount || !email) return alert("Ranpli tout detay yo");
    setLoading(true);
    const { error } = await supabase.from('invoices').insert([{ 
      owner_id: profile.id, 
      client_email: email.toLowerCase().trim(), 
      amount: parseFloat(amount), 
      status: 'pending',
      business_name: profile.business_name 
    }]);

    if (!error) { 
        alert("Invoice voye bay " + email); 
        setMode('menu'); setAmount(''); setEmail('');
    } else { alert("Erè: " + error.message); }
    setLoading(false);
  };

  const updateBusinessName = async () => {
    if (!bizName) return alert("Ekri non biznis la");
    const { error } = await supabase.from('profiles').update({ business_name: bizName }).eq('id', profile.id);
    if (!error) { alert("Biznis anrejistre!"); setProfile({...profile, business_name: bizName}); }
  };

  if (!profile) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-red-600 font-black italic animate-pulse uppercase">Hatex Terminal ap chaje...</div>;

  const totalVant = transactions.reduce((acc, tx) => acc + (tx.amount > 0 ? tx.amount : 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans selection:bg-red-600/30">
      
      {/* 1. SEKSYON CONFIGURATION NON BIZNIS */}
      {!profile.business_name && (
        <div className="bg-red-600/10 p-6 rounded-[2rem] border border-red-600/20 mb-6 animate-bounce">
          <p className="text-[10px] font-black uppercase mb-3 text-red-500 tracking-tighter">Konfigire non biznis ou pou debloke SDK a</p>
          <div className="flex gap-2">
            <input className="bg-black border border-white/10 p-4 rounded-2xl flex-1 text-xs outline-none" placeholder="Egz: Hatex Shop" onChange={(e) => setBizName(e.target.value)} />
            <button onClick={updateBusinessName} className="bg-white text-black px-6 rounded-2xl text-[10px] font-black uppercase">Sove</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic text-white tracking-tighter">
            {profile.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
          </h1>
          <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-[0.3em]">Merchant ID: {profile.id.slice(0, 18)}</p>
        </div>
        <button onClick={() => setMode('history')} className="w-14 h-14 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center border border-white/5 shadow-2xl active:scale-90 transition-all group">
          <History className={`w-6 h-6 ${mode === 'history' ? 'text-red-600' : 'text-zinc-500'} group-hover:text-red-600 transition-colors`} />
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
          <p className="text-[8px] text-zinc-500 uppercase font-black mb-1 tracking-widest text-red-600">Revenu Total</p>
          <p className="text-2xl font-black italic">{totalVant.toLocaleString()} <span className="text-[10px] opacity-50">HTG</span></p>
        </div>
        <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
          <p className="text-[8px] text-zinc-500 uppercase font-black mb-1 tracking-widest">Transactions</p>
          <p className="text-2xl font-black italic">{transactions.length} <span className="text-[10px] opacity-50 text-red-600">TX</span></p>
        </div>
      </div>

      {/* MAIN MENU */}
      {mode === 'menu' && (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
          <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 flex flex-col items-center group active:scale-95 transition-all">
            <div className="bg-red-600/10 p-5 rounded-[2rem] mb-4 group-hover:bg-red-600/20 transition-colors">
              <Mail className="text-red-600 w-8 h-8" />
            </div>
            <span className="text-[12px] font-black uppercase tracking-widest italic">Invoice pa Email</span>
            <span className="text-[8px] text-zinc-600 font-bold mt-1 uppercase">Peman rapid a distans</span>
          </button>
          
          <button 
            onClick={() => profile.business_name ? setMode('api') : alert("Sove non biznis ou anvan.")} 
            className={`bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 flex flex-col items-center group active:scale-95 transition-all ${!profile.business_name && 'opacity-20 cursor-not-allowed'}`}
          >
            <div className="bg-red-600/10 p-5 rounded-[2rem] mb-4 group-hover:bg-red-600/20 transition-colors">
              <LayoutGrid className="text-red-600 w-8 h-8" />
            </div>
            <span className="text-[12px] font-black uppercase tracking-widest italic">SDK Smart Checkout</span>
            <span className="text-[8px] text-zinc-600 font-bold mt-1 uppercase">Vant sou Shopify / WordPress</span>
          </button>
        </div>
      )}

{mode === 'api' && profile.business_name && (
  <div className="space-y-6 animate-in zoom-in duration-300">
    <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10">
      <h2 className="text-[14px] font-black uppercase text-red-600 mb-4 italic tracking-widest text-center">SDK Smart Checkout (Livrezon Inclus)</h2>
      
      <div className="space-y-4">
        <p className="text-[9px] text-zinc-500 uppercase font-black text-center leading-relaxed">
          Kopye kòd sa a sou sit ou (Shopify, WordPress, HTML). 
          Li detekte pri a, mande adrès livrezon, epi trete peman an otomatikman.
        </p>
        
        <div className="relative group">
          <pre className="bg-black p-6 rounded-3xl border border-white/5 text-[9px] text-green-500 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed text-left h-96 scrollbar-hide">
{`<div id="hatex-secure-pay"></div>
<script>
(function() {
  const TID = "${profile.id}"; 
  const TAUX = 135; 
  const target = document.getElementById('hatex-secure-pay');

  const btn = document.createElement('button');
  btn.innerHTML = "ACHETER MAINTENANT (HTG)";
  btn.style = "background:#dc2626;color:white;width:100%;padding:20px;border-radius:15px;font-weight:900;border:none;cursor:pointer;font-family:sans-serif;box-shadow:0 10px 20px rgba(220,38,38,0.2);text-transform:uppercase;";
  
  const formHtml = \`
    <div id="hatex-form" style="display:none;margin-top:20px;padding:25px;background:#111;border-radius:25px;border:1px solid #333;font-family:sans-serif;color:white;">
      <p style="font-size:11px;font-weight:900;text-transform:uppercase;color:#dc2626;margin-bottom:15px;">📦 Détails de Livraison</p>
      <input id="htx_name" placeholder="Nom Complet" style="width:100%;background:#000;border:1px solid #222;padding:14px;border-radius:12px;color:white;margin-bottom:12px;font-size:13px;outline:none;">
      <input id="htx_phone" placeholder="Téléphone" style="width:100%;background:#000;border:1px solid #222;padding:14px;border-radius:12px;color:white;margin-bottom:12px;font-size:13px;outline:none;">
      <textarea id="htx_address" placeholder="Adresse complète de livraison" style="width:100%;background:#000;border:1px solid #222;padding:14px;border-radius:12px;color:white;margin-bottom:12px;font-size:13px;height:70px;outline:none;resize:none;"></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;background:#000;padding:15px;border-radius:15px;margin-bottom:20px;">
         <span style="font-size:11px;font-weight:bold;color:#666;">KANTITE:</span>
         <input id="htx_qty" type="number" value="1" min="1" style="width:60px;background:#111;border:1px solid #dc2626;padding:8px;border-radius:8px;color:white;text-align:center;">
      </div>
      <div style="background:#000; padding:15px; border-radius:15px; margin-bottom:15px; text-align:center; border:1px dashed #444;">
        <span style="font-size:10px; color:#666; display:block;">TOTAL À PAYER</span>
        <span id="htx_total_val" style="font-size:20px; font-weight:900; color:#fff;">CALCUL...</span>
      </div>
      <button id="htx_confirm" style="width:100%;background:#dc2626;color:white;padding:18px;border-radius:12px;font-weight:900;border:none;cursor:pointer;text-transform:uppercase;">PAYER MAINTENANT</button>
    </div>
  \`;
  target.innerHTML = formHtml;
  target.prepend(btn);

  function calculate() {
    const qty = parseInt(document.getElementById('htx_qty').value) || 1;
    const priceEl = document.querySelector('.price, .product-price, .amount, .woocommerce-Price-amount');
    let raw = priceEl ? priceEl.innerText.replace(/[^\\d.]/g, '') : "0";
    let val = parseFloat(raw) || 0;
    const isUSD = (priceEl?.innerText || "").includes('$');
    const unitHTG = isUSD ? (val * TAUX) : val;
    const total = (unitHTG * qty).toFixed(2);
    document.getElementById('htx_total_val').innerText = total + " HTG";
    return { total, qty };
  }

  btn.onclick = () => {
    document.getElementById('hatex-form').style.display = 'block';
    btn.style.display = 'none';
    calculate();
  };

  document.getElementById('htx_qty').oninput = calculate;

  document.getElementById('htx_confirm').onclick = () => {
    const data = calculate();
    const name = document.getElementById('htx_name').value;
    const phone = document.getElementById('htx_phone').value;
    const addr = document.getElementById('htx_address').value;
    if(!name || !phone || !addr) return alert("Ranpli tout enfòmasyon livrezon yo");

    const params = new URLSearchParams({
      terminal: TID,
      amount: data.total,
      order_id: "HTX-" + Date.now(),
      customer_name: name,
      customer_phone: phone,
      customer_address: addr,
      product_name: document.querySelector('h1')?.innerText || document.title,
      product_image: document.querySelector('meta[property="og:image"]')?.content || "",
      quantity: data.qty,
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
              alert("SDK Smart Checkout kopye!");
            }}
            className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 p-3 rounded-xl text-[8px] uppercase font-black shadow-lg active:scale-90 transition-all text-white"
          >
            KOPYE KÒD LA
          </button>
        </div>
      </div>
    </div>
    <button onClick={() => setMode('menu')} className="w-full text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em] text-center mt-4">Tounen nan Menu</button>
  </div>
)}

      {/* MODE HISTORY (LIVREZON) */}
      {mode === 'history' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-10">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em] italic">Istorik Livrezon & Vant</h2>
            <button onClick={() => setMode('menu')} className="text-red-600 text-[10px] font-black uppercase underline">Fèmen</button>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-zinc-900/40 p-10 rounded-[3rem] text-center border border-white/5 italic">
               <p className="text-zinc-600 text-[10px] font-black uppercase">Okenn vant poko fèt sou tèminal sa</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-gradient-to-br from-zinc-900/60 to-black p-6 rounded-[2.5rem] border border-white/5 hover:border-red-600/30 transition-all space-y-5 shadow-2xl">
                
                {/* Header TX */}
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-red-600/10 rounded-2xl flex items-center justify-center">
                      <ShoppingCart className="text-red-600 w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-white tracking-tighter">{tx.platform || 'Vant Direct'}</p>
                      <p className="text-[7px] text-zinc-600 font-bold uppercase">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black italic text-green-500">+{Math.abs(tx.amount).toLocaleString()} HTG</p>
                    <span className="text-[7px] text-zinc-700 uppercase font-black">Success ✅</span>
                  </div>
                </div>

                {/* Detay Pwodwi */}
                {(tx.product_name || tx.description) && (
                  <div className="flex gap-4 items-center bg-black/40 p-4 rounded-3xl border border-white/5">
                    {tx.product_image ? (
                      <img src={tx.product_image} className="w-14 h-14 rounded-2xl object-cover border border-white/10 shadow-lg" alt="prod" />
                    ) : (
                      <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center italic text-[8px] text-zinc-600 uppercase font-black">No Pic</div>
                    )}
                    <div className="flex-1 overflow-hidden text-left">
                      <p className="text-[10px] font-black uppercase text-zinc-200 truncate">{tx.product_name || tx.description}</p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase mt-1">Kantite: <span className="text-red-600">{tx.quantity || 1}</span></p>
                    </div>
                  </div>
                )}

                {/* Detay Kliyan & Livrezon */}
                {tx.customer_name && (
                  <div className="pl-4 py-1 border-l-2 border-red-600/30 bg-white/[0.01] rounded-r-3xl space-y-2">
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] font-black uppercase text-white">{tx.customer_name}</p>
                       <span className="text-zinc-800">•</span>
                       <div className="flex items-center gap-1 text-red-500 font-black text-[9px]">
                         <Phone size={10} /> {tx.customer_phone}
                       </div>
                    </div>
                    {tx.customer_address && (
                      <div className="flex items-start gap-2 text-zinc-500 italic">
                        <MapPin size={10} className="text-red-600 mt-1 shrink-0" />
                        <p className="text-[9px] font-bold leading-relaxed uppercase">{tx.customer_address}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* MODE REQUEST (INVOICE) */}
      {mode === 'request' && (
        <div className="space-y-4 animate-in zoom-in-95 duration-300">
           <div className="bg-zinc-900/60 p-10 rounded-[3rem] border border-white/5 text-center shadow-2xl">
              <span className="text-[8px] font-black text-red-600 uppercase tracking-widest block mb-4 italic">Montan Acha</span>
              <div className="flex items-center justify-center gap-2">
                 <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-5xl font-black text-center w-full outline-none placeholder:text-zinc-800 italic" />
                 <span className="text-xl font-black opacity-20 italic">HTG</span>
              </div>
           </div>
           
           <div className="bg-zinc-900/60 p-6 rounded-[2.5rem] border border-white/5 shadow-xl">
              <input type="email" placeholder="EMAIL KLIYAN AN" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent text-center text-[11px] font-black w-full outline-none uppercase italic text-red-600" />
           </div>

           <button 
             onClick={handleCreateInvoice} 
             disabled={loading} 
             className="w-full bg-red-600 hover:bg-red-700 py-8 rounded-[3rem] font-black uppercase italic shadow-2xl shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50"
           >
             {loading ? 'Y ap voye...' : 'Voye Invoice kounye a'}
           </button>
           
           <button onClick={() => setMode('menu')} className="w-full text-[9px] font-black uppercase text-zinc-700 py-4 tracking-widest italic">Anile Operasyon</button>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-auto pt-10 text-center">
        <p className="text-[7px] text-zinc-700 font-black uppercase tracking-[0.4em]">Hatex Secure Terminal • Versyon 4.0.2</p>
      </div>

    </div>
  );
}