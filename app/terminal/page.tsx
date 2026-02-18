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
  const [businessName, setBusinessName] = useState('');

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // --- INITIALIZASYON ---
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

  // --- BRANDING ---
  const updateBusinessName = async () => {
    if (!businessName) return alert("Tanpri antre yon non biznis.");
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ business_name: businessName })
        .eq('id', profile.id);
      if (error) throw error;
      alert("Branding anrejistre ak siksè!");
      setProfile({ ...profile, business_name: businessName });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- KREYASYON INVOICE ---
  const handleCreateInvoice = async () => {
    if (!amount || parseFloat(amount) <= 0 || !email) {
      alert("Tanpri mete yon montan ak yon email valid.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ou dwe konekte");

      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('kyc_status, business_name')
        .eq('id', user.id)
        .single();

      if (freshProfile?.kyc_status !== 'approved') {
        alert(`Echèk: Kont ou dwe 'approved' pou voye invoice.`);
        setMode('menu'); 
        return;
      }

      const { data: inv, error: invError } = await supabase.from('invoices').insert({
        owner_id: user.id,
        amount: parseFloat(amount),
        client_email: email.toLowerCase().trim(),
        status: 'pending'
      }).select().single();

      if (invError) throw invError;

      const securePayLink = `${window.location.origin}/pay/${inv.id}`;

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
            business_name: freshProfile.business_name || "Merchant Hatex",
            pay_url: securePayLink
          }
        })
      });

      await navigator.clipboard.writeText(securePayLink);
      alert(`Siksè! Faktire a voye bay ${inv.client_email}.\n\nLyen peman an kopye otomatikman: ${securePayLink}`);
      
      setAmount('');
      setEmail('');
      setMode('menu');
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- SENKRONIZASYON BALANS ---
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
                <h3 className="text-[11px] font-black uppercase tracking-widest text-white">Idantite Biznis ou</h3>
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
                        readOnly={!!profile?.business_name}
                        placeholder="Ex: Hatex Store"
                        className={`w-full bg-black border border-white/10 p-5 rounded-2xl text-[12px] outline-none transition-all text-white italic ${
                          profile?.business_name ? "opacity-60 cursor-not-allowed border-green-600/30 text-green-500" : "focus:border-red-600/50"
                        }`} 
                    />
                </div>
                {!profile?.business_name && (
                  <button 
                      onClick={updateBusinessName}
                      disabled={loading}
                      className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-[10px] hover:scale-[0.98] transition-all"
                  >
                      {loading ? 'Sincronisation...' : 'Enregistrer le Branding'}
                  </button>
                )}
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
            <span className="text-[10px] font-black uppercase italic tracking-widest">Voye Invoice</span>
          </button>
        </div>
      )}

<div id="hatex-secure-pay-wrapper"></div>
<style>
  /* Style Pwofesyonèl Hatex - Enspire de Temu/AliExpress */
  .htx-btn { background: #dc2626; color: white; width: 100%; padding: 18px; border-radius: 12px; font-weight: 900; border: none; cursor: pointer; font-family: sans-serif; box-shadow: 0 8px 20px rgba(220,38,38,0.25); transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; margin-top: 10px; }
  .htx-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); z-index: 999999; display: none; align-items: flex-end; justify-content: center; }
  .htx-modal { background: #0a0a0a; width: 100%; max-width: 500px; border-radius: 32px 32px 0 0; padding: 30px; box-sizing: border-box; color: white; font-family: sans-serif; animation: htxSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); max-height: 95vh; overflow-y: auto; border-top: 2px solid #dc2626; }
  @keyframes htxSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
  .htx-input { width: 100%; background: #161616; border: 1px solid #333; padding: 16px; border-radius: 14px; color: white; margin-bottom: 12px; font-size: 14px; box-sizing: border-box; outline: none; }
  .htx-input:focus { border-color: #dc2626; background: #000; }
  .htx-row { display: flex; gap: 10px; }
  .htx-item-card { background: #161616; padding: 15px; border-radius: 18px; display: flex; gap: 15px; margin-bottom: 12px; border: 1px solid #262626; position: relative; }
  .htx-item-img { width: 70px; height: 70px; object-fit: cover; border-radius: 12px; background: #000; border: 1px solid #333; }
  .htx-badge { background: #dc2626; font-size: 10px; padding: 4px 10px; border-radius: 6px; color: #fff; font-weight: bold; }
  .htx-total-box { background: linear-gradient(135deg, #220000, #0a0a0a); padding: 25px; border-radius: 20px; text-align: center; border: 1px solid #dc2626; margin: 20px 0; }
  .htx-close { float: right; cursor: pointer; font-size: 28px; color: #999; line-height: 1; }
</style>

<script>
(function() {
  const TID = "${profile.id}";
  const TAUX = 136;
  let cartData = [];
  let isSubmitting = false;

  function findVariations() {
    let variants = [];
    document.querySelectorAll('select').forEach(sel => {
      if(sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text !== sel.options[0].text) {
        variants.push(sel.options[sel.selectedIndex].text);
      }
    });
    document.querySelectorAll('input[type="radio"]:checked, .swatch.selected, .variant-active').forEach(el => {
      variants.push(el.value || el.innerText || el.getAttribute('data-value'));
    });
    return variants.filter(v => v && v.trim() !== '').join(', ');
  }

  function extractPriceDetails(text) {
    if(!text) return { val: 0, isUSD: false };
    const val = parseFloat(text.replace(/[^0-9.]/g, '')); 
    const isUSD = text.includes('$') || text.toUpperCase().includes('USD') || val < 1000;
    return { val, isUSD };
  }

  function scrapeProductPage() {
    const title = document.querySelector('h1')?.innerText || document.title;
    const img = document.querySelector('meta[property="og:image"]')?.content || document.querySelector('img[class*="product"], .wp-post-image')?.src || '';
    const priceText = document.querySelector('.price, .amount, [class*="price"]')?.innerText;
    const pDetails = extractPriceDetails(priceText);
    const qty = parseInt(document.querySelector('input[name="quantity"], .qty')?.value) || 1;
    const vars = findVariations();

    return { 
      name: title, 
      img: img, 
      qty: qty, 
      priceRaw: pDetails.val, 
      isUSD: pDetails.isUSD, 
      variants: vars,
      url: window.location.href // Rale URL prodwi a
    };
  }

  const target = document.getElementById('hatex-secure-pay-wrapper');
  if(!target) return;

  const btn = document.createElement('button');
  btn.className = 'htx-btn';
  btn.innerHTML = '🔒 PEYE AK HATEX CARD (HTG)';
  target.appendChild(btn);

  const modalHtml = `
    <div class="htx-modal-overlay" id="htx-modal">
      <div class="htx-modal">
        <span class="htx-close" id="htx-close">&times;</span>
        <h3 style="margin:0 0 20px 0; font-size:20px; font-weight:900; letter-spacing:-1px;">PANYEN HATEX</h3>
        
        <div id="htx-items-container" style="margin-bottom:20px;"></div>

        <div class="htx-total-box">
          <span style="font-size:10px; color:#888; display:block; margin-bottom:5px; font-weight:bold; letter-spacing:1px;">TOTAL KOMANN</span>
          <span id="htx-total-display" style="font-size:32px; font-weight:900; color:#fff;">...</span>
        </div>

        <form id="htx-checkout-form">
          <input required id="h_name" class="htx-input" placeholder="Non ak Siyati">
          <div class="htx-row">
            <input required id="h_phone" type="tel" class="htx-input" placeholder="WhatsApp">
            <input required id="h_email" type="email" class="htx-input" placeholder="Email">
          </div>
          <input required id="h_address" class="htx-input" placeholder="Adrès Livraison">
          <textarea id="h_notes" class="htx-input" style="height:80px; padding:12px;" placeholder="Nòt siplemantè (Koulè, Size, etc.)"></textarea>
          <button type="submit" class="htx-btn" id="htx-submit-btn">KONFIME AK PEYE</button>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  btn.onclick = (e) => {
    e.preventDefault();
    const item = scrapeProductPage();
    if(!cartData.find(i => i.name === item.name)) cartData.push(item);
    
    const container = document.getElementById('htx-items-container');
    container.innerHTML = '';
    let totalHTG = 0;

    cartData.forEach(i => {
      let price = i.isUSD ? (i.priceRaw * TAUX) : i.priceRaw;
      totalHTG += (price * i.qty);
      container.innerHTML += `
        <div class="htx-item-card">
          <img src="\${i.img}" class="htx-item-img">
          <div style="flex:1;">
            <div style="font-size:13px; font-weight:bold;">\${i.name}</div>
            <div style="font-size:10px; color:#666; margin:4px 0;">\${i.variants}</div>
            <span class="htx-badge">\${i.qty}x</span>
          </div>
        </div>`;
    });

    document.getElementById('htx-total-display').innerText = totalHTG.toLocaleString() + ' HTG';
    document.getElementById('htx-modal').style.display = 'flex';
  };

  document.getElementById('htx-close').onclick = () => { document.getElementById('htx-modal').style.display = 'none'; };

  document.getElementById('htx-checkout-form').onsubmit = (e) => {
    e.preventDefault();
    if(isSubmitting) return;
    isSubmitting = true;
    document.getElementById('htx-submit-btn').innerText = 'TRAITEMENT...';

    const payload = {
      terminal: TID,
      amount: document.getElementById('htx-total-display').innerText.replace(/[^0-9]/g, ''),
      customer: {
        name: document.getElementById('h_name').value,
        phone: document.getElementById('h_phone').value,
        email: document.getElementById('h_email').value,
        address: document.getElementById('h_address').value,
        notes: document.getElementById('h_notes').value
      },
      items: cartData,
      shop_name: document.title,
      platform: window.location.hostname
    };

    const token = btoa(encodeURIComponent(JSON.stringify(payload)));
    window.location.href = "https://hatexcard.com/checkout?token=" + token;
  };
})();
</script>

      {/* RÈS KÒD LA (HISTORY, REQUEST, VIDEO) RETE EGZAKTEMAN MENM JAN AN... */}
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
                    <p className="text-[10px] font-black uppercase text-zinc-600 italic">Pagen Tranzaksyon</p>
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
                        Gade videyo a pouw ka konnen kijan pouw konekte Hatex sou sit Biznis ou. 
                        Script la detekte pri pwodwi yo ak jere konvesyon yo an HTG nan TO 136.
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