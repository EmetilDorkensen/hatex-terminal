"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Package, MapPin, Phone, History, 
  Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, ShoppingCart, Globe, ExternalLink,
  RefreshCw, Wallet, Zap, ShieldCheck 
} from 'lucide-react';

export default function TerminalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<'menu' | 'request' | 'api' | 'history'>('menu');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [bizName, setBizName] = useState('');

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const refreshData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (prof) setProfile(prof);

    const { data: tx } = await supabase
      .from('transactions')
      .select(`*`)
      .eq('user_id', user.id)
      .in('type', ['PAYMENT', 'SALE', 'SALE_SDK', 'INVOICE_PAYMENT'])
      .order('created_at', { ascending: false });
    setTransactions(tx || []);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000); // Rafrechi chak 10 segonn
    return () => clearInterval(interval);
  }, []);

  // FONKSYON POU SYNC BALANS
  const handleSyncBalance = async () => {
    const totalVant = transactions.reduce((acc, tx) => acc + (tx.amount > 0 ? tx.amount : 0), 0);
    if (totalVant <= 0) return alert("Ou pa gen okenn vant pou senkronize.");
    
    setSyncing(true);
    try {
      const { error } = await supabase.rpc('increment_merchant_balance', {
        merchant_id: profile.id,
        amount_to_add: totalVant
      });
      if (error) throw error;
      alert("Balans Prensipal ou ajou!");
      refreshData();
    } catch (err: any) {
      alert("Erè: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

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
        alert("Invoice voye!"); 
        setMode('menu'); setAmount(''); setEmail('');
    }
    setLoading(false);
  };

  const updateBusinessName = async () => {
    if (!bizName) return alert("Ekri non biznis la");
    const { error } = await supabase.from('profiles').update({ business_name: bizName }).eq('id', profile.id);
    if (!error) { alert("Biznis sove!"); refreshData(); }
  };

  if (!profile) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-red-600 font-black italic animate-pulse">HATEX TERMINAL AP CHAJE...</div>;

  const totalVantDisplay = transactions.reduce((acc, tx) => acc + (tx.amount > 0 ? tx.amount : 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans selection:bg-red-600/30">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-2xl font-black uppercase italic text-white tracking-tighter">
            {profile.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
          </h1>
          <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-[0.3em]">Merchant ID: {profile.id.slice(0, 18)}</p>
        </div>
        <button onClick={() => setMode('history')} className="w-14 h-14 bg-zinc-900 rounded-[1.5rem] flex items-center justify-center border border-white/5 shadow-2xl">
          <History className={`w-6 h-6 ${mode === 'history' ? 'text-red-600' : 'text-zinc-500'}`} />
        </button>
      </div>

      {/* KAT BALANS PRENSIPAL */}
      <div className="space-y-4 mb-10">
        <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-[3rem] border border-red-600/20 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 text-left">
            <p className="text-[9px] text-red-600 uppercase font-black mb-1 tracking-widest">Balans Prensipal (Disponib)</p>
            <p className="text-4xl font-black italic mb-6">{parseFloat(profile.balance || 0).toLocaleString()} <span className="text-xs opacity-50">HTG</span></p>
            <button 
              onClick={handleSyncBalance}
              disabled={syncing}
              className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg active:scale-95 transition-all"
            >
              {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />}
              {syncing ? 'Y ap senkronize...' : 'Mete kòb SDK sou balans'}
            </button>
          </div>
          <Zap className="absolute top-4 right-4 text-red-600/10 w-24 h-24 rotate-12" />
        </div>

        <div className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5 flex justify-between items-center text-left">
          <div>
            <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest">Revenu Terminal</p>
            <p className="text-xl font-black italic text-zinc-300">{totalVantDisplay.toLocaleString()} HTG</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-zinc-500 uppercase font-black tracking-widest text-red-600">Total Vant</p>
            <p className="text-xl font-black italic">{transactions.length}</p>
          </div>
        </div>
      </div>

      {/* MENU MODES */}
      {mode === 'menu' && (
        <div className="grid grid-cols-1 gap-4">
          {!profile.business_name && (
            <div className="bg-red-600/10 p-6 rounded-[2rem] border border-red-600/20 mb-2">
              <input className="bg-black border border-white/10 p-4 rounded-2xl w-full text-xs outline-none mb-3 text-white" placeholder="Non Biznis ou" onChange={(e) => setBizName(e.target.value)} />
              <button onClick={updateBusinessName} className="w-full bg-white text-black py-3 rounded-2xl text-[10px] font-black uppercase">Sove pou debloke SDK</button>
            </div>
          )}
          <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 flex flex-col items-center active:scale-95 transition-all">
            <Mail className="text-red-600 w-8 h-8 mb-4" />
            <span className="text-[12px] font-black uppercase italic tracking-widest">Invoice pa Email</span>
          </button>
          <button 
            onClick={() => profile.business_name ? setMode('api') : alert("Sove non biznis.")} 
            className={`bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 flex flex-col items-center active:scale-95 transition-all ${!profile.business_name && 'opacity-20'}`}
          >
            <LayoutGrid className="text-red-600 w-8 h-8 mb-4" />
            <span className="text-[12px] font-black uppercase italic tracking-widest">SDK Smart Checkout</span>
          </button>
        </div>
      )}

      {/* SDK SECTION - FULL UNIVERSAL CODE */}
      {mode === 'api' && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300 pb-10">
          <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10 text-left">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="text-red-600 w-5 h-5" />
              <h2 className="text-[11px] font-black uppercase italic text-white">SDK Smart Checkout Inivèsèl</h2>
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
  btn.style = "background:#dc2626;color:white;width:100%;padding:20px;border-radius:15px;font-weight:900;border:none;cursor:pointer;font-family:sans-serif;box-shadow:0 10px 20px rgba(220,38,38,0.2);transition:all 0.3s;";
  
  const formHtml = \`
    <div id="hatex-form" style="display:none;margin-top:20px;padding:25px;background:#111;border-radius:25px;border:1px solid #333;font-family:sans-serif;color:white;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
      <p style="font-size:10px;font-weight:900;text-transform:uppercase;color:#dc2626;margin-bottom:15px;letter-spacing:1px;">Informations de Livraison</p>
      <input id="htx_name" placeholder="Nom Complet" style="width:100%;background:#000;border:1px solid #333;padding:15px;border-radius:12px;color:white;margin-bottom:12px;font-size:13px;outline:none;">
      <input id="htx_phone" placeholder="Téléphone" style="width:100%;background:#000;border:1px solid #333;padding:15px;border-radius:12px;color:white;margin-bottom:12px;font-size:13px;outline:none;">
      <textarea id="htx_address" placeholder="Adresse complète pour livraison" style="width:100%;background:#000;border:1px solid #333;padding:15px;border-radius:12px;color:white;margin-bottom:12px;font-size:13px;height:80px;outline:none;resize:none;"></textarea>
      
      <div style="display:flex;gap:15px;align-items:center;margin-bottom:20px;background:#000;padding:12px;border-radius:12px;">
         <label style="font-size:10px;font-weight:bold;color:#666;">QUANTITÉ:</label>
         <input id="htx_qty" type="number" value="1" min="1" style="width:70px;background:transparent;border:none;color:white;font-weight:900;text-align:center;font-size:16px;outline:none;">
      </div>

      <div id="htx_preview" style="background:#000; padding:20px; border-radius:15px; margin-bottom:20px; text-align:center; border:1px dashed #dc2626;">
        <span style="font-size:9px; color:#666; display:block; margin-bottom:5px; font-weight:900;">TOTAL À PAYER</span>
        <span id="htx_total_val" style="font-size:24px; font-weight:900; color:#fff;">CALCUL...</span>
      </div>

      <button id="htx_confirm" style="width:100%;background:#dc2626;color:white;padding:18px;border-radius:12px;font-weight:900;border:none;cursor:pointer;text-transform:uppercase;letter-spacing:1px;">Confirmer le Paiement</button>
    </div>
  \`;
  target.innerHTML = formHtml;
  target.prepend(btn);

  function getUniversalPrice() {
    const productArea = document.querySelector('.product, .product-single, main, #main, .woocommerce-product-details, .shopify-section') || document.body;
    const selectors = ['meta[property="product:price:amount"]', '.price-item--sale', '.product__price .price-item', '.woocommerce-Price-amount', '.current-price', '.price', '#price', '[data-price]'];
    let foundText = ""; let foundVal = 0;
    for (let s of selectors) {
      const el = productArea.querySelector(s);
      if (el) {
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
    document.getElementById('htx_total_val').innerText = new Intl.NumberFormat().format(total) + " HTG";
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
            </div>
            <button onClick={() => {navigator.clipboard.writeText(document.querySelector('pre')?.innerText || ""); alert("SDK Kopye!");}} className="mt-6 w-full bg-red-600 py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-600/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              <Copy className="w-4 h-4" /> Kopye Kòd la pou sit ou
            </button>
          </div>
          <button onClick={() => setMode('menu')} className="w-full text-zinc-600 font-black uppercase text-[10px] tracking-widest">Tounen nan Menu</button>
        </div>
      )}

      {/* ISTORIK LIVREZON DETAYE */}
      {mode === 'history' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 pb-20">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em] italic">Istorik Livrezon & Vant</h2>
            <button onClick={() => setMode('menu')} className="text-red-600 text-[10px] font-black uppercase underline">Fèmen</button>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-zinc-900/40 p-10 rounded-[3rem] text-center border border-white/5 italic">
               <p className="text-zinc-600 text-[10px] font-black uppercase">Okenn vant poko fèt</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="bg-gradient-to-br from-zinc-900/60 to-black p-6 rounded-[2.5rem] border border-white/5 hover:border-red-600/30 transition-all space-y-5 shadow-2xl text-left">
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

                {(tx.product_name || tx.description) && (
                  <div className="flex gap-4 items-center bg-black/40 p-4 rounded-3xl border border-white/5">
                    {tx.product_image ? (
                      <img src={tx.product_image} className="w-14 h-14 rounded-2xl object-cover border border-white/10" alt="prod" />
                    ) : (
                      <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center italic text-[8px] text-zinc-600 uppercase font-black">No Pic</div>
                    )}
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] font-black uppercase text-zinc-200 truncate">{tx.product_name || tx.description}</p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase mt-1">Kantite: <span className="text-red-600">{tx.quantity || 1}</span></p>
                    </div>
                  </div>
                )}

                {tx.customer_name && (
                  <div className="pl-4 py-1 border-l-2 border-red-600/30 bg-white/[0.01] rounded-r-3xl space-y-2">
                    <p className="text-[10px] font-black uppercase text-white">{tx.customer_name} • <span className="text-red-500">{tx.customer_phone}</span></p>
                    <div className="flex items-start gap-2 text-zinc-500 italic">
                      <MapPin size={10} className="text-red-600 mt-1 shrink-0" />
                      <p className="text-[9px] font-bold leading-relaxed uppercase">{tx.customer_address}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* INVOICE MODE */}
      {mode === 'request' && (
        <div className="space-y-4 animate-in zoom-in-95">
          <div className="bg-zinc-900/60 p-10 rounded-[3rem] border border-white/5 text-center shadow-2xl">
              <span className="text-[8px] font-black text-red-600 uppercase italic">Montan HTG</span>
              <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-5xl font-black text-center w-full outline-none placeholder:text-zinc-800 italic text-white" />
          </div>
          <div className="bg-zinc-900/60 p-6 rounded-[2.5rem] border border-white/5">
              <input type="email" placeholder="EMAIL KLIYAN AN" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent text-center text-[11px] font-black w-full outline-none uppercase italic text-red-600" />
          </div>
          <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-8 rounded-[3rem] font-black uppercase italic shadow-red-600/20 active:scale-95 transition-all text-white">
             {loading ? 'Y ap voye...' : 'Voye Invoice'}
          </button>
          <button onClick={() => setMode('menu')} className="w-full text-[9px] font-black uppercase text-zinc-700">Anile</button>
        </div>
      )}

      <p className="mt-20 text-[7px] text-zinc-800 font-black uppercase tracking-[0.4em]">Hatex Secure Terminal v4.0</p>
    </div>
  );
}