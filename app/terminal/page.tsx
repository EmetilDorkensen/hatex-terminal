"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Package, MapPin, Phone, History, 
  Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, ShoppingCart, Globe, ExternalLink,
  Wallet, RefreshCw, ArrowDownCircle
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

  useEffect(() => {
    const initTerminal = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (prof) setProfile(prof);

      const { data: tx } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setTransactions(tx || []);
    };
    initTerminal();
  }, [supabase, router]);

  // Fonksyon pou de kalite balans yo (Wallet & Card)
  const handleSyncBalance = async () => {
    const totalVant = transactions
      .filter(tx => (tx.type === 'SALE_SDK' || tx.type === 'SALE') && tx.status === 'success')
      .reduce((acc, tx) => acc + (parseFloat(tx.amount) || 0), 0);
    
    if (totalVant <= 0) return alert("Pa gen okenn vant pou senkronize.");
    
    setSyncing(true);
    try {
      const { error } = await supabase.rpc('increment_merchant_balance', { 
        merchant_id: profile.id, 
        amount_to_add: totalVant 
      });
      if (error) throw error;
      alert("Balans Wallet ou moute avèk siksè!");
      window.location.reload();
    } catch (err: any) { alert(err.message); } finally { setSyncing(false); }
  };

  const handleCreateInvoice = async () => {
    if (!amount || !email) return alert("Ranpli tout detay yo");
    setLoading(true);
    const { error } = await supabase.from('invoices').insert([{ 
      owner_id: profile.id, client_email: email.toLowerCase().trim(), amount: parseFloat(amount), status: 'pending' 
    }]);
    if (!error) { alert("Invoice voye!"); setMode('menu'); }
    setLoading(false);
  };

  if (!profile) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-red-600 font-black italic">HATEX...</div>;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans selection:bg-red-600/30">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">{profile.business_name || 'Terminal'}<span className="text-red-600">.</span></h1>
        <button onClick={() => setMode('history')} className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center border border-white/5">
          <History className={mode === 'history' ? 'text-red-600' : 'text-zinc-500'} />
        </button>
      </div>


      <div className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2.5rem] mb-6 italic">
  <div className="flex items-center gap-3 mb-4">
    <div className="bg-red-600/10 p-2 rounded-xl">
      <ShieldCheck className="text-red-600 w-5 h-5" />
    </div>
    <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Identité de l'Entreprise</h3>
  </div>
  
  <div className="space-y-4">
    <div className="space-y-2 text-left">
      <label className="text-[9px] text-zinc-500 font-black uppercase ml-4">Non Biznis (Obligatwa)</label>
      <input 
        type="text" 
        value={businessName}
        onChange={(e) => setBusinessName(e.target.value)}
        placeholder="Ex: Hatex Store"
        className="w-full bg-black border border-white/10 p-4 rounded-2xl text-[12px] outline-none focus:border-red-600/50 transition-all text-white" 
      />
    </div>
    <button 
      onClick={updateBusinessName}
      className="w-full bg-white text-black py-4 rounded-2xl font-black uppercase text-[10px] hover:bg-zinc-200 transition-all"
    >
      Enregistrer le Branding
    </button>
  </div>
</div>



      {/* MENU */}
      {mode === 'menu' && (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setMode('api')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-3">
            <LayoutGrid className="text-red-600" />
            <span className="text-[10px] font-black uppercase italic">SDK API</span>
          </button>
          <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-3">
            <Mail className="text-red-600" />
            <span className="text-[10px] font-black uppercase italic">Invoice</span>
          </button>
        </div>
      )}

      {/* SDK SECTION - KÒD OU AN EGZAKTEMAN */}
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
              <button onClick={() => {navigator.clipboard.writeText(document.querySelector('pre')?.innerText || ""); alert("SDK Kopye!");}} className="absolute top-4 right-4 bg-red-600 p-3 rounded-xl text-[8px] font-black uppercase">KOPYE</button>
            </div>
          </div>
          <button onClick={() => setMode('menu')} className="w-full text-[10px] font-black uppercase text-zinc-600">Tounen</button>
        </div>
      )}

      {/* HISTORY */}
      {mode === 'history' && (
        <div className="space-y-4 text-left">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[11px] font-black uppercase text-zinc-500 italic">Tranzaksyon</h2>
            <button onClick={() => setMode('menu')} className="text-red-600 text-[10px] font-black uppercase underline">Dashboard</button>
          </div>
          {transactions.map((tx) => (
            <div key={tx.id} className="bg-zinc-900/60 p-6 rounded-[2rem] border border-white/5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase">{tx.platform || 'Vant SDK'}</p>
                    <p className="text-[7px] text-zinc-600 font-black uppercase">{new Date(tx.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="text-sm font-black italic text-green-500">+{tx.amount} HTG</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INVOICE */}
      {mode === 'request' && (
        <div className="space-y-4 text-left">
          <button onClick={() => setMode('menu')} className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600"><ArrowLeft className="w-4 h-4" /> Tounen</button>
          <div className="bg-zinc-900/60 p-8 rounded-[2.5rem] border border-white/5">
              <input type="number" placeholder="MONTAN" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-4xl font-black w-full outline-none italic mb-6" />
              <input type="email" placeholder="EMAIL KLIYAN" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/50 border border-white/5 p-4 rounded-xl w-full text-xs font-bold outline-none mb-6" />
              <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-5 rounded-xl font-black uppercase italic">Voye Invoice</button>
          </div>
        </div>


<div className="mt-12 space-y-6 italic">
  <div className="flex items-center gap-4">
    <div className="h-[1px] flex-1 bg-white/5"></div>
    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Guide d'Intégration</h2>
    <div className="h-[1px] flex-1 bg-white/5"></div>
  </div>

  <div className="grid md:grid-cols-2 gap-8 items-center bg-zinc-900/20 p-8 rounded-[3rem] border border-white/5">
    {/* VIDEO YOUTUBE */}
    <div className="aspect-video w-full rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative group">
      <iframe 
        className="w-full h-full"
        src="https://www.youtube.com/embed/YOUR_VIDEO_ID" 
        title="Comment intégrer Hatex SDK"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      ></iframe>
    </div>

    {/* EXPLICATION TEXTE */}
    <div className="text-left space-y-4">
      <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">
        Comment intégrer le terminal <span className="text-red-600">Hatex</span> sur votre site ?
      </h3>
      <p className="text-zinc-500 text-[11px] leading-relaxed font-medium">
        Suivez ce tutoriel vidéo pour apprendre à connecter votre site web à notre passerelle de paiement sécurisée. 
        Copiez simplement votre <span className="text-white">ID Terminal</span> et injectez-le dans votre code pour commencer à accepter des paiements en quelques minutes.
      </p>
      
      <div className="flex flex-wrap gap-3 pt-2">
        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[9px] font-black uppercase text-zinc-400">
          React / Next.js
        </div>
        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[9px] font-black uppercase text-zinc-400">
          PHP / Laravel
        </div>
        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[9px] font-black uppercase text-zinc-400">
          WordPress
        </div>
      </div>
    </div>
  </div>
</div>



      )}

      <p className="mt-20 text-center text-[7px] text-zinc-800 font-black uppercase tracking-[0.4em]">Hatex Secure Terminal v4.0</p>
    </div>
  );
}