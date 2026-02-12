"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Package, MapPin, Phone, History, 
  Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, ShoppingCart, Globe, ExternalLink 
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

      // Rale tranzaksyon yo
      const { data: tx } = await supabase
        .from('transactions')
        .select(`*`)
        .eq('user_id', user.id)
        .in('type', ['PAYMENT', 'SALE', 'SALE_SDK', 'INVOICE_PAYMENT'])
        .order('created_at', { ascending: false });

      setTransactions(tx || []);

      // Realtime listener pou nouvo vant
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
      
      {/* HEADER BIZNIS */}
      {!profile.business_name && (
        <div className="bg-red-600/10 p-6 rounded-[2rem] border border-red-600/20 mb-6 animate-pulse">
          <p className="text-[10px] font-black uppercase mb-3 text-red-500 tracking-tighter">Konfigire non biznis ou pou debloke SDK a</p>
          <div className="flex gap-2">
            <input className="bg-black border border-white/10 p-4 rounded-2xl flex-1 text-xs outline-none" placeholder="Egz: Hatex Shop" onChange={(e) => setBizName(e.target.value)} />
            <button onClick={updateBusinessName} className="bg-white text-black px-6 rounded-2xl text-[10px] font-black uppercase">Sove</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic text-white tracking-tighter">
            {profile.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
          </h1>
          <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-[0.3em]">ID: {profile.id.slice(0, 18)}...</p>
        </div>
        <button onClick={() => setMode('history')} className="w-14 h-14 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center border border-white/5 shadow-2xl active:scale-90 transition-all">
          <History className={`w-6 h-6 ${mode === 'history' ? 'text-red-600' : 'text-zinc-500'}`} />
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-[2.5rem] border border-white/5">
          <p className="text-[8px] text-zinc-500 uppercase font-black mb-1 tracking-widest text-red-600">Revenu</p>
          <p className="text-2xl font-black italic">{totalVant.toLocaleString()} <span className="text-[10px] opacity-50">HTG</span></p>
        </div>
        <div className="bg-gradient-to-br from-zinc-900 to-black p-6 rounded-[2.5rem] border border-white/5">
          <p className="text-[8px] text-zinc-500 uppercase font-black mb-1 tracking-widest">Ventes</p>
          <p className="text-2xl font-black italic">{transactions.length}</p>
        </div>
      </div>

      {/* MODES */}
      {mode === 'menu' && (
        <div className="grid grid-cols-1 gap-4">
          <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 flex flex-col items-center active:scale-95 transition-all">
            <Mail className="text-red-600 w-8 h-8 mb-4" />
            <span className="text-[12px] font-black uppercase italic">Invoice pa Email</span>
          </button>
          
          <button 
            onClick={() => profile.business_name ? setMode('api') : alert("Sove non biznis ou anvan.")} 
            className={`bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 flex flex-col items-center active:scale-95 transition-all ${!profile.business_name && 'opacity-20'}`}
          >
            <LayoutGrid className="text-red-600 w-8 h-8 mb-4" />
            <span className="text-[12px] font-black uppercase italic">SDK Smart Checkout</span>
          </button>
        </div>
      )}

      {/* SDK SECTION (YOUR UNIVERSAL CODE) */}
      {mode === 'api' && profile.business_name && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10 text-left">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="text-red-600 w-5 h-5" />
              <h2 className="text-[11px] font-black uppercase italic">SDK Inivèsèl (Shopify/Woo)</h2>
            </div>
            <div className="relative">
              <pre className="bg-black p-6 rounded-3xl border border-white/5 text-[9px] text-green-500 font-mono h-96 overflow-y-auto scrollbar-hide whitespace-pre-wrap">
{`<div id="hatex-secure-pay"></div>
<script>
(function() {
  const TID = "${profile.id}";
  const TAUX = 135;
  const target = document.getElementById('hatex-secure-pay');

  const btn = document.createElement('button');
  btn.innerHTML = "ACHETER MAINTENANT (HTG)";
  btn.style = "background:#dc2626;color:white;width:100%;padding:20px;border-radius:15px;font-weight:900;border:none;cursor:pointer;font-family:sans-serif;box-shadow:0 10px 20px rgba(220,38,38,0.2);";
  
  const formHtml = \`
    <div id="hatex-form" style="display:none;margin-top:20px;padding:20px;background:#1a1a1a;border-radius:20px;border:1px solid #333;font-family:sans-serif;color:white;">
      <p style="font-size:10px;font-weight:900;text-transform:uppercase;color:#dc2626;margin-bottom:15px;">Détails de la commande</p>
      <input id="htx_name" placeholder="Nom Complet" style="width:100%;background:#000;border:1px solid #333;padding:12px;border-radius:10px;color:white;margin-bottom:10px;font-size:12px;">
      <input id="htx_phone" placeholder="Téléphone" style="width:100%;background:#000;border:1px solid #333;padding:12px;border-radius:10px;color:white;margin-bottom:10px;font-size:12px;">
      <textarea id="htx_address" placeholder="Adresse de livraison" style="width:100%;background:#000;border:1px solid #333;padding:12px;border-radius:10px;color:white;margin-bottom:10px;font-size:12px;height:60px;"></textarea>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:15px;">
         <label style="font-size:10px;font-weight:bold;">KANTITE:</label>
         <input id="htx_qty" type="number" value="1" min="1" style="width:60px;background:#000;border:1px solid #333;padding:8px;border-radius:8px;color:white;text-align:center;">
      </div>
      <div id="htx_preview" style="background:#000; padding:15px; border-radius:10px; margin-bottom:15px; text-align:center; border:1px dashed #dc2626;">
        <span style="font-size:10px; color:#999; display:block;">TOTAL À PAYER</span>
        <span id="htx_total_val" style="font-size:20px; font-weight:900; color:#fff;">CALCUL...</span>
      </div>
      <button id="htx_confirm" style="width:100%;background:#dc2626;color:white;padding:15px;border-radius:10px;font-weight:900;border:none;cursor:pointer;">PAYER MAINTENANT</button>
    </div>
  \`;
  target.innerHTML = formHtml;
  target.prepend(btn);

  function getUniversalPrice() {
    const productArea = document.querySelector('.product, .product-single, main, #main, .woocommerce-product-details') || document.body;
    const selectors = ['meta[property="product:price:amount"]', '.price-item--sale', '.product__price .price-item', '.woocommerce-Price-amount', '.current-price', '.price'];
    let foundText = ""; let foundVal = 0;
    for (let s of selectors) {
      const el = productArea.querySelector(s);
      if (el && !el.closest('.price--compare')) {
        let txt = (el.content || el.innerText || "").toUpperCase();
        let val = parseFloat(txt.replace(/[^\\d.]/g, ''));
        if (val > 0) { foundVal = val; foundText = txt; break; }
      }
    }
    return { val: foundVal, txt: foundText };
  }

  function calculateTotal() {
    const priceData = getUniversalPrice();
    const isUSD = priceData.txt.includes('$') || priceData.txt.includes('USD');
    const qty = parseInt(document.getElementById('htx_qty').value) || 1;
    let unitHTG = isUSD ? (Math.max(priceData.val, 0.99) * TAUX) : Math.max(priceData.val, 5);
    const total = (unitHTG * qty).toFixed(2);
    document.getElementById('htx_total_val').innerText = total + " HTG";
    return total;
  }

  btn.onclick = () => { document.getElementById('hatex-form').style.display = 'block'; btn.style.display = 'none'; calculateTotal(); };
  document.getElementById('htx_qty').oninput = calculateTotal;

  document.getElementById('htx_confirm').onclick = () => {
    const params = new URLSearchParams({
      terminal: TID,
      amount: calculateTotal(),
      order_id: "HTX-" + Date.now(),
      customer_name: document.getElementById('htx_name').value,
      customer_phone: document.getElementById('htx_phone').value,
      customer_address: document.getElementById('htx_address').value,
      product_name: document.querySelector('h1')?.innerText || document.title,
      product_image: document.querySelector('meta[property="og:image"]')?.content || "",
      quantity: document.getElementById('htx_qty').value,
      platform: window.location.hostname
    });
    window.location.href = "https://hatexcard.com/checkout?" + params.toString();
  };
})();
</script>`}
              </pre>
              <button onClick={() => {navigator.clipboard.writeText(document.querySelector('pre')?.innerText || ""); alert("SDK Kopye!");}} className="absolute top-4 right-4 bg-red-600 p-3 rounded-xl text-[8px] font-black uppercase">KOPYE KÒD LA</button>
            </div>
          </div>
          <button onClick={() => setMode('menu')} className="w-full text-[10px] font-black uppercase text-zinc-600">Tounen</button>
        </div>
      )}

{/* HISTORY VIEW - DETAYE */}
{mode === 'history' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 text-left">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.3em] italic">Istorik Tranzaksyon</h2>
            <button onClick={() => setMode('menu')} className="text-red-600 text-[10px] font-black uppercase underline">Dashboard</button>
          </div>
          
          {transactions.length === 0 && (
            <div className="py-20 text-center opacity-20 italic uppercase font-black text-xs">Okenn aktivite ankò</div>
          )}

          {transactions.map((tx) => (
            <div key={tx.id} className="bg-gradient-to-br from-zinc-900/80 to-black p-6 rounded-[2.5rem] border border-white/5 space-y-5 shadow-2xl">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {tx.type === 'WITHDRAWAL' ? <ArrowDownCircle className="text-red-500" /> : <ShoppingCart className="text-green-500" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-white tracking-tighter">
                      {tx.type === 'WITHDRAWAL' ? 'Retrè Fon' : (tx.platform || 'Vant SDK')}
                    </p>
                    <p className="text-[7px] text-zinc-600 font-black uppercase mt-1">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-black italic ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} HTG
                  </p>
                  <p className="text-[6px] font-black uppercase text-zinc-700 mt-1 italic">{tx.status}</p>
                </div>
              </div>

              {/* PWODWI INFO NAN ISTORIK */}
              {(tx.product_name || tx.product_image) && (
                <div className="flex gap-4 items-center bg-black/60 p-4 rounded-[2rem] border border-white/5">
                  <img 
                    src={tx.product_image || "https://placehold.co/200x200?text=HATEX"} 
                    className="w-14 h-14 rounded-2xl object-cover border border-white/10" 
                    alt="prod" 
                  />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[9px] font-black uppercase text-zinc-200 truncate italic">{tx.product_name}</p>
                    <div className="flex justify-between mt-1">
                       <p className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest">Qty: {tx.quantity || 1}</p>
                       <ExternalLink className="w-2 h-2 text-zinc-700" />
                    </div>
                  </div>
                </div>
              )}


{/* KLIYAN INFO */}
{tx.customer_name && (
                <div className="pl-4 py-2 border-l-2 border-red-600/30 bg-white/5 rounded-r-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-2 h-2 text-red-600" />
                    <p className="text-[9px] font-black uppercase text-white tracking-tighter">{tx.customer_name}</p>
                  </div>
                  <p className="text-[8px] font-bold text-zinc-500 uppercase flex items-center gap-2">
                    <Phone className="w-2 h-2" /> {tx.customer_phone}
                  </p>
                  <p className="text-[8px] font-bold text-zinc-400 uppercase leading-relaxed mt-1 flex items-start gap-2">
                    <MapPin className="w-2 h-2 mt-0.5 text-red-600" /> {tx.customer_address}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* INVOICE MODE */}
      {mode === 'request' && (
        <div className="space-y-4 animate-in zoom-in-95">
          <div className="bg-zinc-900/60 p-10 rounded-[3rem] border border-white/5 text-center shadow-2xl">
              <span className="text-[8px] font-black text-red-600 uppercase italic">Montan HTG</span>
              <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-5xl font-black text-center w-full outline-none placeholder:text-zinc-800 italic" />
          </div>
          <div className="bg-zinc-900/60 p-6 rounded-[2.5rem] border border-white/5">
              <input type="email" placeholder="EMAIL KLIYAN AN" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent text-center text-[11px] font-black w-full outline-none uppercase italic text-red-600" />
          </div>
          <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-8 rounded-[3rem] font-black uppercase italic shadow-red-600/20 active:scale-95 transition-all">
             {loading ? 'Y ap voye...' : 'Voye Invoice'}
          </button>
          <button onClick={() => setMode('menu')} className="w-full text-[9px] font-black uppercase text-zinc-700">Anile</button>
        </div>
      )}

      <p className="mt-20 text-[7px] text-zinc-800 font-black uppercase tracking-[0.4em]">Hatex Secure Terminal v4.0</p>
    </div>
  );
}