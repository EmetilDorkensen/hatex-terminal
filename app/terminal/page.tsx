"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  Package, MapPin, Phone, History, 
  Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, ShoppingCart, Globe, ExternalLink,
  Wallet, RefreshCw, ArrowDownCircle, ShieldCheck,
  User, Tag, Calendar, ChevronRight, Info, AlertTriangle,
  Lock, CreditCard, Box, Truck
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
  const [businessName, setBusinessName] = useState('');
  const [copied, setCopied] = useState(false);

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

      const { data: tx } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setTransactions(tx || []);
    };
    initTerminal();
  }, [supabase, router]);

  const updateBusinessName = async () => {
    if (!businessName) return alert("Tanpri antre yon non biznis.");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ business_name: businessName })
        .eq('id', profile?.id);
      if (error) throw error;
      alert("Branding anrejistre ak siksè!");
      setProfile({ ...profile, business_name: businessName });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!amount || parseFloat(amount) <= 0 || !email) {
      alert("Tanpri mete yon montan ak yon email valid.");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ou dwe konekte");
      
      const { data: freshProfile } = await supabase.from('profiles').select('kyc_status, business_name').eq('id', user.id).single();
      if (freshProfile?.kyc_status !== 'approved') {
        alert(`Echèk: Kont ou dwe 'approved' pou voye invoice.`);
        setMode('menu'); 
        return;
      }

      const { data: inv, error: invError } = await supabase.from('invoices').insert({
        owner_id: user.id, amount: parseFloat(amount), client_email: email.toLowerCase().trim(), status: 'pending'
      }).select().single();
      
      if (invError) throw invError;
      
      const securePayLink = `${window.location.origin}/pay/${inv.id}`;
      
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ table: 'invoices', record: { id: inv.id, amount: inv.amount, client_email: inv.client_email, business_name: freshProfile.business_name || "Merchant Hatex", pay_url: securePayLink } })
      });
      
      await navigator.clipboard.writeText(securePayLink);
      alert(`Siksè! Faktire a voye bay ${inv.client_email}.\n\nLyen an kopye.`);
      setAmount(''); setEmail(''); setMode('menu');
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
      const { error } = await supabase.rpc('increment_merchant_balance', { merchant_id: profile?.id, amount_to_add: totalVant });
      if (error) throw error;
      alert("Balans Wallet ou moute avèk siksè!");
      window.location.reload();
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setSyncing(false); 
    }
  };

  // --- KÒD SDK A NAN YON TEXT STRING POU L PA KRAZE NEXT.JS EPI POU W KA KOPYE L ---
  const fullSDKCode = `
<style>
  /* Bouton Ajoute nan Panyen an */
  .htx-add-cart-btn { 
    background: #dc2626; color: white; width: 100%; padding: 18px; 
    border-radius: 12px; font-weight: 900; border: none; cursor: pointer; 
    text-transform: uppercase; font-size: 12px; letter-spacing: 1px;
    transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .htx-add-cart-btn:hover { background: #b91c1c; transform: scale(1.02); }

  /* Modal Prensipal */
  .htx-overlay { 
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,0,0,0.95); backdrop-filter: blur(10px); 
    z-index: 999999; display: none; align-items: flex-end; justify-content: center; 
  }
  
  .htx-cart-container { 
    background: #0f0f0f; width: 100%; max-width: 500px; border-radius: 35px 35px 0 0; 
    padding: 30px; box-sizing: border-box; color: white; font-family: sans-serif; 
    animation: htxUp 0.4s ease-out; max-height: 95vh; overflow-y: auto;
    border-top: 5px solid #dc2626;
  }
  @keyframes htxUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

  /* Header Panyen */
  .htx-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
  .htx-step-indicator { font-size: 10px; font-weight: 900; color: #dc2626; text-transform: uppercase; }

  /* Item nan Panyen an (Foto & Enfò) */
  .htx-product-card { 
    background: #181818; border-radius: 20px; padding: 15px; 
    display: flex; gap: 15px; margin-bottom: 25px; border: 1px solid #252525;
  }
  .htx-img { width: 90px; height: 90px; object-fit: cover; border-radius: 12px; background: #000; }
  .htx-details { flex: 1; }
  .htx-name { font-size: 14px; font-weight: 700; margin-bottom: 5px; color: #efefef; }
  .htx-price { color: #dc2626; font-size: 20px; font-weight: 900; }

  /* Fòm Adrès */
  .htx-section-title { font-size: 11px; font-weight: 900; color: #555; text-transform: uppercase; margin: 20px 0 10px 5px; display: block; }
  .htx-input { 
    width: 100%; background: #1a1a1a; border: 1px solid #222; padding: 15px 20px; 
    border-radius: 15px; color: white; font-size: 14px; margin-bottom: 10px; outline: none; box-sizing: border-box;
  }
  .htx-input:focus { border-color: #dc2626; }

  /* Rezime (Step 2) */
  .htx-summary-box { background: #1a1a1a; padding: 20px; border-radius: 20px; margin-bottom: 20px; border-left: 4px solid #dc2626; }
  .htx-summary-line { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: #aaa; }
  .htx-total-line { border-top: 1px solid #333; padding-top: 10px; margin-top: 10px; color: white; font-weight: 900; font-size: 18px; }
</style>

<div id="hatex-sdk-inject-point">
  <button class="htx-add-cart-btn" id="htx-add-to-cart">🛒 AJOUTER AU PANIER HATEX</button>
</div>

<script>
  (function() {
    const MERCHANT_ID = "${profile?.id || 'YOUR_MERCHANT_ID'}";
    const RATE_HTG = 136;

    // --- SCRAPER ---
    function getProductData() {
      const title = document.querySelector('h1')?.innerText || document.title;
      const image = document.querySelector('meta[property="og:image"]')?.content || 
                    document.querySelector('.product-main-image, .wp-post-image, [class*="MainImage"]')?.src || 
                    document.querySelector('img')?.src;
      
      let rawPrice = "0";
      const selectors = ['.price', '.amount', '[class*="current-price"]', '.product-price'];
      for(let s of selectors) {
        let el = document.querySelector(s);
        if(el) { rawPrice = el.innerText; break; }
      }
      
      const val = parseFloat(rawPrice.replace(/[^0-9.]/g, '')) || 0;
      const isUSD = rawPrice.includes('$') || val < 1000;
      return {
        name: title,
        img: image,
        price_htg: isUSD ? (val * RATE_HTG) : val,
        original: rawPrice
      };
    }

    // Modal HTML Structure
    const modal = document.createElement('div');
    modal.className = 'htx-overlay';
    modal.id = 'htx-main-modal';
    document.body.appendChild(modal);

    // --- STEP 1: CART & ADDRESS ---
    function showStep1() {
      const data = getProductData();
      modal.innerHTML = \`
        <div class="htx-cart-container">
          <div class="htx-header">
            <span class="htx-step-indicator">Étape 1: Panier & Livraison</span>
            <span style="cursor:pointer; font-size:24px;" onclick="document.getElementById('htx-main-modal').style.display='none'">&times;</span>
          </div>

          <div class="htx-product-card">
            <img src="\${data.img}" class="htx-img">
            <div class="htx-details">
              <div class="htx-name">\${data.name}</div>
              <div class="htx-price">\${data.price_htg.toLocaleString()} HTG</div>
              <div style="font-size:9px; color:#555;">Basé sur: \${data.original}</div>
            </div>
          </div>

          <span class="htx-section-title">Informations de Livraison</span>
          <form id="htx-cart-form">
            <input required id="htx_name" class="htx-input" placeholder="Nom et Prénom">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <input required id="htx_phone" type="tel" class="htx-input" placeholder="WhatsApp">
              <input required id="htx_email" type="email" class="htx-input" placeholder="Email">
            </div>
            <input required id="htx_address" class="htx-input" placeholder="Adresse complète (No, Rue, Ville)">
            
            <button type="submit" class="htx-add-cart-btn" style="margin-top:20px;">CONTINUER VERS RÉSUMÉ</button>
          </form>
        </div>
      \`;
      
      document.getElementById('htx-cart-form').onsubmit = (e) => {
        e.preventDefault();
        const customer = {
          name: document.getElementById('htx_name').value,
          phone: document.getElementById('htx_phone').value,
          email: document.getElementById('htx_email').value,
          address: document.getElementById('htx_address').value
        };
        showStep2(data, customer);
      };
    }

    // --- STEP 2: SUMMARY & FINAL PAY ---
    function showStep2(product, customer) {
      modal.innerHTML = \`
        <div class="htx-cart-container">
          <div class="htx-header">
            <span class="htx-step-indicator">Étape 2: Résumé de la Commande</span>
            <span style="cursor:pointer; font-size:24px;" onclick="showStep1()">&larr;</span>
          </div>

          <div class="htx-summary-box">
            <p style="font-size:10px; font-weight:900; color:#dc2626; margin-bottom:10px;">LIVRÉ À:</p>
            <div style="font-size:13px; font-weight:bold;">\${customer.name}</div>
            <div style="font-size:12px; color:#777;">\${customer.address}</div>
            <div style="font-size:12px; color:#777;">\${customer.phone}</div>
          </div>

          <div class="htx-summary-box">
             <div class="htx-summary-line"><span>Produit:</span> <span style="color:white; font-weight:bold;">\${product.name.substring(0,25)}...</span></div>
             <div class="htx-summary-line"><span>Frais de livraison:</span> <span style="color:#00ff00;">GRATUIT</span></div>
             <div class="htx-total-line"><span>TOTAL:</span> <span>\${product.price_htg.toLocaleString()} HTG</span></div>
          </div>

          <button id="htx-final-pay" class="htx-add-cart-btn" style="background:#000; border:1px solid #dc2626; box-shadow: 0 10px 30px rgba(220,38,38,0.2);">
            🔒 CONFIRMER ET PAYER
          </button>
          <p style="text-align:center; font-size:9px; color:#444; margin-top:15px; text-transform:uppercase; font-weight:900;">Cryptage SSL 256-bit par Hatex</p>
        </div>
      \`;

      document.getElementById('htx-final-pay').onclick = () => {
        const payload = {
          terminal: MERCHANT_ID,
          amount: product.price_htg,
          product: product.name,
          customer: customer
        };
        const token = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        window.location.href = "https://hatexcard.com/checkout?token=" + token;
      };
    }

    // Evènman sou bouton an
    const cartBtn = document.getElementById('htx-add-to-cart');
    if(cartBtn) {
      cartBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        showStep1();
      });
    }

  })();
</script>
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullSDKCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans selection:bg-red-600/30">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">
            {profile?.business_name || 'Terminal'}<span className="text-red-600">.</span>
          </h1>
          <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.3em]">Hatex Secure Interface</span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setMode('menu')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all ${mode === 'menu' ? 'bg-red-600 shadow-lg' : 'bg-zinc-900'}`}><LayoutGrid size={20} /></button>
          <button onClick={() => setMode('history')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all ${mode === 'history' ? 'bg-red-600 shadow-lg' : 'bg-zinc-900'}`}><History size={20} /></button>
        </div>
      </div>

      {/* MENU */}
      {mode === 'menu' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[3rem] mb-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck size={80} className="text-red-600" /></div>
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-600/10 p-3 rounded-2xl"><Lock className="text-red-600 w-5 h-5" /></div>
                <div><h3 className="text-[12px] font-black uppercase tracking-widest">Security Branding</h3></div>
            </div>
            <div className="space-y-4">
                <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} readOnly={!!profile?.business_name} className="w-full bg-black/50 border border-white/10 p-6 rounded-3xl text-[13px] outline-none text-white italic" />
                {!profile?.business_name && (
                  <button onClick={updateBusinessName} disabled={loading} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[11px]">{loading ? 'Processing...' : 'Link Business Account'}</button>
                )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMode('api')} className="bg-zinc-900/40 p-12 rounded-[3rem] border border-white/5 flex flex-col items-center gap-4 hover:bg-zinc-900/80 transition-all group">
              <Globe className="text-red-600 group-hover:scale-110 transition-transform" size={28} />
              <span className="text-[10px] font-black uppercase italic">SDK Gateway</span>
            </button>
            <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-12 rounded-[3rem] border border-white/5 flex flex-col items-center gap-4 hover:bg-zinc-900/80 transition-all group">
              <Mail className="text-red-600 group-hover:scale-110 transition-transform" size={28} />
              <span className="text-[10px] font-black uppercase italic">Invoice Pay</span>
            </button>
          </div>
        </div>
      )}

      {/* --- SDK API SECTION (KOTE POU KOPYE KÒD LA) --- */}
      {mode === 'api' && (
        <div className="animate-in fade-in duration-500">
          <button onClick={() => setMode('menu')} className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600 mb-8 hover:tracking-widest transition-all">
            <ArrowLeft size={14} /> Back to Terminal
          </button>

          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Bwat Preview */}
            <div className="bg-zinc-900/20 p-8 rounded-[3rem] border border-white/5 flex flex-col items-center justify-center text-center">
              <ShoppingCart className="text-red-600/40 mb-4" size={40} />
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-4">Preview Bouton SDK a</p>
              
              {/* Sa se jis yon fo bouton pou l wè sa l sanble, paske reyèl bouton an ap nan kòd la */}
              <button className="bg-[#dc2626] text-white w-full max-w-xs p-[18px] rounded-xl font-black uppercase text-[12px] tracking-widest pointer-events-none opacity-50">
                🛒 AJOUTER AU PANIER HATEX
              </button>
              
              <p className="text-[9px] text-zinc-600 mt-6 uppercase">Bouton sa ap parèt sou sit kliyan ou yo.</p>
            </div>

            {/* Bwat pou Kopye Kòd la */}
            <div className="bg-black/80 border border-white/5 rounded-[2.5rem] p-6 relative group">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase text-zinc-500 italic">Integration Code</span>
                <button 
                  onClick={copyToClipboard}
                  className="bg-red-600 p-2 px-4 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-red-700 transition-colors"
                >
                  {copied ? <CheckCircle2 size={12}/> : <Copy size={12}/>} {copied ? 'COPIÉ !' : 'COPY'}
                </button>
              </div>
              
              <pre className="text-[9px] text-zinc-500 h-[300px] overflow-auto bg-black/50 p-4 rounded-xl font-mono leading-relaxed scrollbar-thin scrollbar-thumb-red-600/30">
                {fullSDKCode}
              </pre>
            </div>
            
          </div>

          {/* DOCUMENTATION */}
          <div className="mt-16 border-t border-white/5 pt-10">
            <div className="bg-red-600/5 p-6 rounded-3xl border border-red-600/10 flex items-start gap-4">
              <Info className="text-red-600 mt-1 flex-shrink-0" size={20} />
              <div>
                <h4 className="text-[10px] font-black uppercase text-red-600 mb-2">Note d'intégration</h4>
                <p className="text-[11px] text-zinc-500 italic leading-relaxed">
                  Sistèm sa a ap rale enfòmasyon pwodwi a otomatikman. Lè kliyan an klike "Confirmer", tout done yo (Pwodwi, Pri HTG, Adrès) ap ankode nan yon jeton (Token) pou ale nan paj chèkout la. Done yo ap parèt nan istwa tranzaksyon ou tou. Kopye kòd ki anlè a epi mete l nan paj html sit ou a.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      {mode === 'history' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-700">
          <div className="flex justify-between items-end mb-8">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Live Transactions</h2>
            <button onClick={handleSyncBalance} disabled={syncing} className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2">
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Sync Wallet
            </button>
          </div>
          <div className="space-y-4">
            {transactions.length > 0 ? transactions.map((tx) => (
              <div key={tx.id} className="bg-zinc-900/30 p-6 rounded-[2.5rem] border border-white/5 flex justify-between items-center">
                <div className="flex gap-5 items-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tx.type?.includes('SDK') ? 'bg-red-600/10' : 'bg-blue-600/10'}`}>
                    {tx.type?.includes('SDK') ? <Globe className="text-red-600 w-6 h-6" /> : <Mail className="text-blue-600 w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-[12px] font-black uppercase italic">{tx.customer_name || 'Hatex User'}</p>
                    <span className="text-[9px] text-zinc-600 uppercase flex items-center gap-1"><Calendar size={11}/> {new Date(tx.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black italic text-green-500">+{tx.amount?.toLocaleString()} HTG</p>
                  <p className="text-[8px] font-black uppercase text-green-500/50">{tx.status}</p>
                </div>
              </div>
            )) : <div className="py-24 text-center border border-dashed border-white/5 rounded-[4rem] text-zinc-700 font-black uppercase">Aucune donnée</div>}
          </div>
        </div>
      )}

      {/* REQUEST INVOICE */}
      {mode === 'request' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <button onClick={() => setMode('menu')} className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600 mb-4"><ArrowLeft size={16} /> Retour</button>
          <div className="bg-[#0d0e1a] p-12 rounded-[4rem] border border-white/5">
              <div className="mb-12">
                <label className="text-[10px] text-zinc-600 font-black uppercase block mb-4">Amount to Receive (HTG)</label>
                <div className="flex items-center border-b-2 border-zinc-900 pb-4">
                    <span className="text-2xl font-black text-red-600 mr-4">HTG</span>
                    <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-7xl font-black w-full outline-none italic" />
                </div>
              </div>
              <div className="space-y-5">
                  <input type="email" placeholder="CUSTOMER EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/40 border border-white/5 p-6 rounded-[2rem] w-full text-[12px] font-bold outline-none italic" />
                  <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-7 rounded-[2rem] font-black uppercase italic text-[12px] shadow-2xl shadow-red-600/20">
                    {loading ? 'Processing...' : 'ENVOUYER LA FACTURE'}
                  </button>
              </div>
          </div>
        </div>
      )}

      <div className="mt-24 text-center opacity-30">
        <p className="text-[7px] font-black uppercase tracking-[0.5em]">Hatex Secure Terminal v4.0.2</p>
      </div>
    </div>
  );
}