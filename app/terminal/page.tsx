"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Package, MapPin, Phone, History, 
  Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, ShoppingCart, Globe, ExternalLink,
  Wallet, RefreshCw, ArrowDownCircle, ShieldCheck,
  User, Tag, Calendar, ChevronRight
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
  
  // Korije erè varyab ki te manke yo
  const [businessName, setBusinessName] = useState('');

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    const initTerminal = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (prof) {
        setProfile(prof);
        setBusinessName(prof.business_name || '');
      }

      // Istorik ak plis detay (Kliyan, Tip)
      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setTransactions(tx || []);
    };
    initTerminal();
  }, [supabase, router]);



  const handleCreateInvoice = async () => {
    if (!amount || parseFloat(amount) <= 0 || !email) {
      alert("Tanpri mete yon montan ak yon email valid.");
      return;
    }
  
    setLoading(true);
    try {
      // 1. Jwenn enfòmasyon moun k ap voye a (Machann nan)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ou dwe konekte");
  
      // 2. BLOKIS: Anpeche moun nan voye invoice bay pwòp tèt li
      if (user.email === email) {
        alert("Ou pa kapab voye yon invoice bay tèt ou.");
        setLoading(false);
        return;
      }
  
      // 3. TCHEKE KYC: Verifye si machann nan gen dwa resevwa kòb
      const { data: profile } = await supabase
        .from('profiles')
        .select('kyc_status, business_name')
        .eq('id', user.id)
        .single();
  
      if (profile?.kyc_status !== 'verified') {
        alert("Kont ou dwe verifye (KYC) anvan ou voye yon invoice.");
        setLoading(false);
        return;
      }
  
      // 4. KREYE INVOICE LA
      const { data: inv, error } = await supabase.from('invoices').insert({
        owner_id: user.id,
        amount: parseFloat(amount),
        client_email: email,
        business_name: profile.business_name,
        status: 'pending'
      }).select().single();
  
      if (error) throw error;
  
      // 5. VOYE EMAIL VIA EDGE FUNCTION (Sa ap deklanche KA 1 nan index.ts ou a)
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          table: 'invoices',
          record: {
            id: inv.id,
            amount: inv.amount,
            client_email: inv.client_email,
            business_name: profile.business_name
          }
        })
      });
  
      alert("Invoice voye bay kliyan an ak siksè!");
      setMode('menu');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };



  // Fonksyon pou sove Branding la
  const updateBusinessName = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ business_name: businessName })
        .eq('id', profile.id);
      if (error) throw error;
      alert("Branding anrejistre!");
      setProfile({...profile, business_name: businessName});
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  if (!profile) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center text-red-600 font-black italic animate-pulse">HATEX ENCRYPTING...</div>;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans selection:bg-red-600/30">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-2xl font-black uppercase italic tracking-tighter">{profile.business_name || 'Terminal'}<span className="text-red-600">.</span></h1>
        <div className="flex gap-3">
            <button onClick={() => setMode('menu')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all ${mode === 'menu' ? 'bg-red-600 border-red-600' : 'bg-zinc-900'}`}>
                <LayoutGrid size={20} />
            </button>
            <button onClick={() => setMode('history')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all ${mode === 'history' ? 'bg-red-600 border-red-600' : 'bg-zinc-900'}`}>
                <History size={20} />
            </button>
        </div>
      </div>

{/* BRANDING SECTION */}
{mode === 'menu' && (
  <div className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2.5rem] mb-6 italic shadow-2xl">
      <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-600/10 p-2 rounded-xl">
              <ShieldCheck className="text-red-600 w-5 h-5" />
          </div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Identité de l'Entreprise</h3>
      </div>
      <div className="space-y-4">
          <div className="space-y-2 text-left">
              <label className="text-[9px] text-zinc-500 font-black uppercase ml-4">
                {profile?.business_name ? "Nom du Business (Vérifié)" : "Nom du Business (Branding)"}
              </label>
              <input 
                  type="text" 
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  // Si profile.business_name pa NULL, li paka ekri anyen ankò
                  readOnly={!!profile?.business_name}
                  placeholder="Ex: Hatex Store"
                  className={`w-full bg-black border border-white/10 p-5 rounded-2xl text-[12px] outline-none transition-all text-white italic ${
                    profile?.business_name ? "opacity-60 cursor-not-allowed border-green-600/30 text-green-500" : "focus:border-red-600/50"
                  }`} 
              />
          </div>

          {/* Bouton an ap parèt SÈLMAN si profile.business_name vid nan baz de done a */}
          {!profile?.business_name && (
            <button 
                onClick={updateBusinessName}
                disabled={loading}
                className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-[10px] hover:scale-[0.98] transition-all"
            >
                {loading ? 'Sincronisation...' : 'Enregistrer le Branding'}
            </button>
          )}

          {/* Ti mesaj konfimasyon si non an deja anrejistre */}
          {profile?.business_name && (
            <div className="flex items-center justify-center gap-2 pt-2">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <p className="text-[8px] text-zinc-500 font-black uppercase tracking-tighter">Votre identité est verrouillée et sécurisée</p>
            </div>
          )}
      </div>
  </div>
)}

      {/* MENU OPTIONS */}
      {mode === 'menu' && (
        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setMode('api')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-3 hover:bg-zinc-900 transition-all">
            <div className="bg-red-600/20 p-4 rounded-2xl"><Globe className="text-red-600" /></div>
            <span className="text-[10px] font-black uppercase italic tracking-widest">SDK API Gateway</span>
          </button>
          <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-10 rounded-[2.5rem] border border-white/5 flex flex-col items-center gap-3 hover:bg-zinc-900 transition-all">
            <div className="bg-red-600/20 p-4 rounded-2xl"><Mail className="text-red-600" /></div>
            <span className="text-[10px] font-black uppercase italic tracking-widest">Générer Invoice</span>
          </button>
        </div>
      )}

      {/* SDK SECTION */}
      {mode === 'api' && profile.business_name && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          <div className="bg-zinc-900/50 p-8 rounded-[3rem] border border-red-600/10 text-left">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="text-red-600 w-5 h-5" />
              <h2 className="text-[11px] font-black uppercase italic">SDK Inivèsèl (Shopify/Woo/Custom)</h2>
            </div>
            <div className="relative">
              <pre className="bg-black p-6 rounded-3xl border border-white/5 text-[9px] text-green-500 font-mono h-[500px] overflow-y-auto scrollbar-hide whitespace-pre-wrap">
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

  // FONKSYON SYNC PRI OTOMATIK SOU NENPÒT SIT
  function getUniversalPrice() {
    const productArea = document.querySelector('.product, .product-single, main, #main, .woocommerce-product-details, [itemtype*="Product"]') || document.body;
    const selectors = [
        'meta[property="product:price:amount"]', 
        '[data-price]', 
        '.price-item--sale', 
        '.product__price .price-item', 
        '.woocommerce-Price-amount', 
        '.current-price', 
        '.price',
        '#priceblock_ourprice',
        '.a-price-whole'
    ];
    let foundText = ""; let foundVal = 0;
    for (let s of selectors) {
      const el = productArea.querySelector(s);
      if (el && !el.closest('.price--compare')) {
        let txt = (el.content || el.innerText || el.getAttribute('data-price') || "").toUpperCase();
        let val = parseFloat(txt.replace(/[^\\d.]/g, ''));
        if (val > 0) { foundVal = val; foundText = txt; break; }
      }
    }
    return { val: foundVal, txt: foundText };
  }

  function calculateTotal() {
    const priceData = getUniversalPrice();
    const isUSD = priceData.txt.includes('$') || priceData.txt.includes('USD') || priceData.val < 1000; 
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
      product_name: document.querySelector('h1, .product_title')?.innerText || document.title,
      product_image: document.querySelector('meta[property="og:image"], .wp-post-image, .product-featured-img')?.content || document.querySelector('img')?.src || "",
      quantity: document.getElementById('htx_qty').value,
      platform: window.location.hostname
    });
    window.location.href = "https://hatexcard.com/checkout?" + params.toString();
  };
})();
</script>`}
              </pre>
              <button onClick={() => {navigator.clipboard.writeText(document.querySelector('pre')?.innerText || ""); alert("SDK Kopye!");}} className="absolute top-4 right-4 bg-red-600 p-3 rounded-xl text-[8px] font-black uppercase shadow-lg">KOPYE KÒD</button>
            </div>
          </div>
          <button onClick={() => setMode('menu')} className="w-full text-[10px] font-black uppercase text-zinc-600 hover:text-white transition-all italic">Tounen nan Dashboard</button>
        </div>
      )}

      {/* PROFESSIONAL HISTORY SECTION */}
      {mode === 'history' && (
        <div className="space-y-4 text-left animate-in slide-in-from-bottom-5 duration-500">
          <div className="flex justify-between items-center mb-6">
            <div>
                <h2 className="text-xl font-black uppercase italic text-white tracking-tighter">Flux des Transactions</h2>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Suivi en temps réel de vos ventes</p>
            </div>
            <button onClick={handleSyncBalance} disabled={syncing} className="bg-white text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase flex items-center gap-2">
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> Sync Balans
            </button>
          </div>

          <div className="space-y-3">
            {transactions.length > 0 ? transactions.map((tx) => (
              <div key={tx.id} className="bg-zinc-900/40 p-5 rounded-[2rem] border border-white/5 hover:border-red-600/20 transition-all group relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex gap-4 items-center">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.type?.includes('SDK') ? 'bg-red-600/10' : 'bg-blue-600/10'}`}>
                      {tx.type?.includes('SDK') ? <Globe className="text-red-600 w-5 h-5" /> : <Mail className="text-blue-600 w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black uppercase tracking-tight text-white italic">
                            {tx.customer_name || 'Client Anonyme'}
                        </p>
                        <span className="text-[7px] bg-white/5 px-2 py-0.5 rounded-md text-zinc-500 font-black uppercase italic border border-white/5">
                            {tx.type === 'SALE_SDK' ? 'TERMINAL' : 'INVOICE'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-zinc-500 font-bold italic">
                         <span className="text-[8px] uppercase flex items-center gap-1"><Calendar size={10}/> {new Date(tx.created_at).toLocaleDateString()}</span>
                         <span className="text-[8px] uppercase flex items-center gap-1"><ExternalLink size={10}/> {tx.platform || 'Direct'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black italic text-green-500">+{tx.amount?.toLocaleString()} <span className="text-[10px]">HTG</span></p>
                    <p className={`text-[7px] font-black uppercase tracking-widest ${tx.status === 'success' ? 'text-green-500/50' : 'text-yellow-500/50'}`}>
                        {tx.status === 'success' ? 'Confirmé' : 'En attente'}
                    </p>
                  </div>
                </div>
              </div>
            )) : (
                <div className="py-20 text-center bg-zinc-900/20 rounded-[3rem] border border-dashed border-white/5">
                    <History className="mx-auto text-zinc-800 mb-4" size={40} />
                    <p className="text-[10px] font-black uppercase text-zinc-600 italic">Aucune transaction trouvée</p>
                </div>
            )}
          </div>
        </div>
      )}

      {/* INVOICE SECTION */}
      {mode === 'request' && (
        <div className="space-y-4 text-left animate-in fade-in duration-300">
          <button onClick={() => setMode('menu')} className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600 mb-4"><ArrowLeft className="w-4 h-4" /> Retour au Menu</button>
          <div className="bg-zinc-900/60 p-10 rounded-[3rem] border border-white/5 shadow-2xl">
              <div className="mb-8">
                <label className="text-[9px] text-zinc-500 font-black uppercase ml-2 italic">Montant à facturer (HTG)</label>
                <div className="flex items-baseline gap-2">
                    <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-6xl font-black w-full outline-none italic text-white placeholder:text-zinc-800" />
                </div>
              </div>
              <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input type="email" placeholder="EMAIL DU CLIENT" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/50 border border-white/5 p-5 pl-12 rounded-2xl w-full text-[11px] font-bold outline-none italic text-white focus:border-red-600/30" />
                  </div>
                  <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase italic text-sm hover:bg-red-700 transition-all shadow-xl shadow-red-600/10">
                    {loading ? 'Génération...' : 'Envoyer la Facture'}
                  </button>
              </div>
          </div>
        </div>
      )}

      {/* GUIDE SECTION */}
      {mode === 'api' && (
        <div className="mt-12 space-y-6 italic animate-in fade-in-50 duration-700">
            <div className="flex items-center gap-4">
                <div className="h-[1px] flex-1 bg-white/5"></div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Documentation Technique</h2>
                <div className="h-[1px] flex-1 bg-white/5"></div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center bg-zinc-900/20 p-8 rounded-[3rem] border border-white/5">
                <div className="aspect-video w-full rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl relative group">
                    <iframe 
                        className="w-full h-full"
                        src="https://www.youtube.com/embed/YOUR_VIDEO_ID" 
                        title="Comment intégrer Hatex SDK"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    ></iframe>
                </div>

                <div className="text-left space-y-4">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-tight">
                        Intégrez <span className="text-red-600">Hatex API</span> <br/> sur votre store.
                    </h3>
                    <p className="text-zinc-500 text-[11px] leading-relaxed font-medium">
                        Suivez ce tutoriel pour apprendre à connecter votre boutique au réseau Hatex. 
                        Le script détecte automatiquement les prix de vos produits et gère la conversion monétaire.
                    </p>
                    
                    <div className="flex flex-wrap gap-3 pt-2">
                        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[8px] font-black uppercase text-zinc-400">Shopify</div>
                        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[8px] font-black uppercase text-zinc-400">WooCommerce</div>
                        <div className="bg-white/5 px-4 py-2 rounded-full border border-white/5 text-[8px] font-black uppercase text-zinc-400">React/PHP</div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <p className="mt-20 text-center text-[7px] text-zinc-800 font-black uppercase tracking-[0.4em]">Hatex Secure Terminal v4.0 • E2E Encrypted</p>
    </div>
  );
}