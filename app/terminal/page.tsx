"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Package, MapPin, Phone, History, 
  Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, ShoppingCart, Globe, ExternalLink,
  RefreshCw, Wallet, Zap, ShieldCheck, ArrowDownCircle,
  CreditCard, Send, Plus
} from 'lucide-react';

export default function TerminalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<'menu' | 'request' | 'api' | 'history' | 'withdraw'>('menu');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [bizName, setBizName] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankInfo, setBankInfo] = useState('');

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
      .order('created_at', { ascending: false });
    setTransactions(tx || []);
  };

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncBalance = async () => {
    const totalVant = transactions
      .filter(tx => (tx.type === 'SALE_SDK' || tx.type === 'SALE') && tx.status === 'success')
      .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
  
    if (totalVant <= 0) return alert("Ou pa gen okenn vant SDK pou senkronize.");
    
    setSyncing(true);
    try {
      const { error } = await supabase.rpc('increment_merchant_balance', {
        merchant_id: profile.id,
        amount_to_add: totalVant
      });
      if (error) throw error;
      alert("Balans senkronize ak siksè!");
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
        alert("Invoice voye bay kliyan an!"); 
        setMode('menu'); setAmount(''); setEmail('');
    }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) > profile.balance) return alert("Balans ensifizan");
    setLoading(true);
    const { error } = await supabase.from('transactions').insert([{
      user_id: profile.id,
      amount: -parseFloat(withdrawAmount),
      type: 'WITHDRAWAL',
      status: 'pending',
      description: `Retrè vè: ${bankInfo}`
    }]);
    if (!error) {
      alert("Demann retrè voye!");
      setMode('menu');
    }
    setLoading(false);
  };

  const updateBusinessName = async () => {
    if (!bizName) return alert("Ekri non biznis la");
    const { error } = await supabase.from('profiles').update({ business_name: bizName }).eq('id', profile.id);
    if (!error) { alert("Biznis sove!"); refreshData(); }
  };

  if (!profile) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-red-600 font-black italic animate-pulse">HATEX TERMINAL...</div>;

// SDK KÒD (KONPLÈ AK FOTO PWODWI)
const sdkCodeStr = `<div id="hatex-secure-pay"></div>
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
    // 1. Nou chèche sèlman nan zòn PWODWI a pou evite nimewo nan PANIE anlè a
    const productArea = document.querySelector('.product, .product-single, main, #main, .woocommerce-product-details') || document.body;
   
    const selectors = [
      'meta[property="product:price:amount"]',
      '.price-item--sale',
      '.product__price .price-item',
      '.woocommerce-Price-amount',
      '.current-price',
      '.price'
    ];
   
    let foundText = "";
    let foundVal = 0;

    for (let s of selectors) {
      const el = productArea.querySelector(s); // Sèvi ak productArea olye de document
      if (el && !el.closest('.price--compare')) { // Evite pri ki bare yo
        let txt = (el.content || el.innerText || "").toUpperCase();
        let val = parseFloat(txt.replace(/[^\\d.]/g, ''));
        if (val > 0) {
          foundVal = val;
          foundText = txt;
          break;
        }
      }
    }
    return { val: foundVal, txt: foundText };
  }

  function calculateTotal() {
    const priceData = getUniversalPrice();
    const isUSD = priceData.txt.includes('$') || priceData.txt.includes('USD');
    const qty = parseInt(document.getElementById('htx_qty').value) || 1;
   
    let unitPriceHTG;
    if (isUSD) {
      // Limit 0.99$ si se USD
      const cleanUSD = Math.max(priceData.val, 0.99);
      unitPriceHTG = cleanUSD * TAUX;
    } else {
      // Limit 5 HTG si se G/HTG
      unitPriceHTG = Math.max(priceData.val, 5);
    }

    const total = (unitPriceHTG * qty).toFixed(2);
    document.getElementById('htx_total_val').innerText = total + " HTG";
    return total;
  }

  btn.onclick = () => {
    document.getElementById('hatex-form').style.display = 'block';
    btn.style.display = 'none';
    calculateTotal();
  };

  document.getElementById('htx_qty').oninput = calculateTotal;

  document.getElementById('htx_confirm').onclick = () => {
    const totalHTG = calculateTotal();
    const params = new URLSearchParams({
      terminal: TID,
      amount: totalHTG,
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
</script>`;
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans selection:bg-red-600/30 pb-20">
      
      {/* HEADER AVANSE */}
      <div className="flex justify-between items-center mb-10">
        <div className="text-left">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">
            {profile.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
          </h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <p className="text-[8px] text-zinc-600 uppercase font-black tracking-widest italic">Live Terminal System</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode('history')} className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5">
            <History className={`w-5 h-5 ${mode === 'history' ? 'text-red-600' : 'text-zinc-500'}`} />
          </button>
        </div>
      </div>

      {/* BALANS CARD - VÈSYON PWOLONJE */}
      <div className="space-y-4 mb-10">
        <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-[3rem] border border-red-600/20 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 text-left">
            <p className="text-[9px] text-red-600 uppercase font-black mb-1 tracking-[0.3em]">Balans Disponib</p>
            <p className="text-5xl font-black italic mb-8">{parseFloat(profile.balance || 0).toLocaleString()} <span className="text-xs opacity-40 font-bold">HTG</span></p>
            
            <div className="flex gap-3">
              <button 
                onClick={handleSyncBalance} 
                disabled={syncing}
                className="flex-1 bg-white text-black py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
              >
                {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wallet className="w-3 h-3" />}
                Sync SDK
              </button>
              <button 
                onClick={() => setMode('withdraw')}
                className="flex-1 bg-zinc-800 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 border border-white/5 active:scale-95 transition-all"
              >
                <ArrowDownCircle className="w-3 h-3 text-red-600" />
                Retrè
              </button>
            </div>
          </div>
          <Zap className="absolute top-4 right-4 text-red-600/5 w-32 h-32 rotate-12" />
        </div>
      </div>

      {/* MAIN MENU ACTIONS */}
      {mode === 'menu' && (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-500">
           {!profile.business_name && (
            <div className="bg-zinc-900 p-6 rounded-[2.5rem] border border-red-600/20 mb-2 text-left">
              <p className="text-[10px] font-black uppercase text-red-600 mb-3 tracking-widest italic">Konfigire Biznis Ou</p>
              <input className="bg-black border border-white/10 p-4 rounded-2xl w-full text-xs outline-none mb-3 text-white font-bold" placeholder="NON BIZNIS" onChange={(e) => setBizName(e.target.value)} />
              <button onClick={updateBusinessName} className="w-full bg-red-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest">Sove Detay Yo</button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-3 hover:bg-zinc-900/60 transition-colors">
              <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center"><Mail className="text-red-600" /></div>
              <span className="text-[10px] font-black uppercase italic tracking-widest text-zinc-400">Invoice</span>
            </button>
            
            <button onClick={() => profile.business_name ? setMode('api') : alert("Mete non biznis anvan.")} className="bg-zinc-900/40 p-8 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-3 hover:bg-zinc-900/60 transition-colors">
              <div className="w-12 h-12 bg-red-600/10 rounded-2xl flex items-center justify-center"><LayoutGrid className="text-red-600" /></div>
              <span className="text-[10px] font-black uppercase italic tracking-widest text-zinc-400">SDK API</span>
            </button>
          </div>

          <div className="bg-zinc-900/20 p-6 rounded-[2.5rem] border border-dashed border-white/10 flex items-center justify-between mt-4">
            <div className="flex items-center gap-3 text-left">
               <ShieldCheck className="text-green-500 w-5 h-5" />
               <div>
                 <p className="text-[9px] font-black uppercase">Sekirite Aktif</p>
                 <p className="text-[7px] text-zinc-600 font-bold uppercase tracking-widest text-left">Tout tranzaksyon yo chiffres</p>
               </div>
            </div>
            <p className="text-[8px] font-black text-zinc-500 uppercase italic">v4.0.2</p>
          </div>
        </div>
      )}

      {/* WITHDRAW MODE */}
      {mode === 'withdraw' && (
        <div className="space-y-4 animate-in zoom-in-95 text-left">
          <div className="flex items-center gap-2 mb-4" onClick={() => setMode('menu')}>
            <ArrowLeft className="w-4 h-4 text-red-600" />
            <span className="text-[10px] font-black uppercase italic">Tounen</span>
          </div>
          <div className="bg-zinc-900/80 p-8 rounded-[3rem] border border-white/5">
            <p className="text-[10px] font-black uppercase text-red-600 mb-6 italic tracking-widest">Mande yon Retrè</p>
            <input type="number" placeholder="MONTAN HTG" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="bg-black border border-white/10 p-5 rounded-2xl w-full text-xl font-black italic mb-4 text-white outline-none" />
            <textarea placeholder="ENFÒMASYON BANKÈ OSWA MONCASH" value={bankInfo} onChange={(e) => setBankInfo(e.target.value)} className="bg-black border border-white/10 p-5 rounded-2xl w-full text-xs font-bold mb-6 text-white outline-none h-24" />
            <button onClick={handleWithdraw} disabled={loading} className="w-full bg-white text-black py-5 rounded-2xl text-[10px] font-black uppercase shadow-2xl">
              {loading ? 'Y ap voye demann...' : 'Konfime Retrè'}
            </button>
          </div>
        </div>
      )}

      {/* API VIEW - VÈSYON PWOLONJE */}
      {mode === 'api' && (
        <div className="space-y-6 animate-in zoom-in-95 text-left">
          <div className="flex items-center gap-2" onClick={() => setMode('menu')}>
            <ArrowLeft className="w-4 h-4 text-red-600" />
            <span className="text-[10px] font-black uppercase italic">Tounen nan Dashboard</span>
          </div>
          <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="text-red-600 w-5 h-5" />
              <h2 className="text-[11px] font-black uppercase italic text-white tracking-widest">Entegre Hatex sou Sit Ou</h2>
            </div>
            <pre className="bg-black p-6 rounded-3xl border border-white/5 text-[9px] text-green-500 font-mono h-[400px] overflow-y-auto scrollbar-hide whitespace-pre-wrap">
              {sdkCodeStr}
            </pre>
            <button onClick={() => {navigator.clipboard.writeText(sdkCodeStr); alert("SDK Kopye!");}} className="mt-6 w-full bg-red-600 py-6 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl active:scale-95">Kopye Kòd SDK a</button>
          </div>
        </div>
      )}

      {/* INVOICE MODE */}
      {mode === 'request' && (
        <div className="space-y-4 animate-in zoom-in-95 text-left">
          <div className="flex items-center gap-2 mb-4" onClick={() => setMode('menu')}>
            <ArrowLeft className="w-4 h-4 text-red-600" />
            <span className="text-[10px] font-black uppercase italic">Tounen</span>
          </div>
          <div className="bg-zinc-900/60 p-10 rounded-[3.5rem] border border-white/5 text-center">
              <span className="text-[9px] font-black text-red-600 uppercase italic tracking-widest">Montan pou Invoice la</span>
              <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-6xl font-black text-center w-full outline-none italic text-white mt-4" />
          </div>
          <div className="bg-zinc-900/60 p-6 rounded-[2.5rem] border border-white/5">
              <input type="email" placeholder="EMAIL KLIYAN AN" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-transparent text-center text-[12px] font-black w-full outline-none uppercase italic text-red-600" />
          </div>
          <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-8 rounded-[3rem] font-black uppercase italic text-white shadow-2xl">
              {loading ? 'Y ap jenere...' : 'Voye Invoice la'}
          </button>
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

      {/* FOOTER */}
      <div className="mt-20 flex flex-col items-center gap-4 opacity-30">
        <div className="h-px w-20 bg-zinc-800"></div>
        <p className="text-[7px] text-zinc-500 font-black uppercase tracking-[0.5em]">Hatex Secure Terminal System</p>
      </div>
    </div>
  );
}