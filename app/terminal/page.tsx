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

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // --- 1. INITIALIZASYON KONPLÈ ---
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

  // --- 2. BRANDING MANAGEMENT ---
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

  // --- 3. KREYASYON INVOICE AK EMAIL ---
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

      // Voye Email via Edge Function
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
      alert(`Siksè! Faktire a voye bay ${inv.client_email}.\n\nLyen an kopye.`);
      setAmount(''); setEmail(''); setMode('menu');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- 4. SENKRONIZASYON BALANS ---
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

  if (!profile) return (
    <div className="min-h-screen bg-[#0a0b14] flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-red-600 font-black italic animate-pulse tracking-widest">HATEX ENCRYPTING SYSTEM...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 italic font-sans selection:bg-red-600/30">
      
      {/* HEADER DINAMIK */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black uppercase italic tracking-tighter">
            {profile.business_name || 'Terminal'}<span className="text-red-600">.</span>
          </h1>
          <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-[0.3em]">Hatex Secure Interface</span>
        </div>
        <div className="flex gap-3">
            <button onClick={() => setMode('menu')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all duration-500 ${mode === 'menu' ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'bg-zinc-900'}`}>
                <LayoutGrid size={20} />
            </button>
            <button onClick={() => setMode('history')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border border-white/5 transition-all duration-500 ${mode === 'history' ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.3)]' : 'bg-zinc-900'}`}>
                <History size={20} />
            </button>
        </div>
      </div>

      {/* --- MENU / DASHBOARD --- */}
      {mode === 'menu' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[3rem] mb-8 italic shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <ShieldCheck size={80} className="text-red-600" />
              </div>
              <div className="flex items-center gap-3 mb-6">
                  <div className="bg-red-600/10 p-3 rounded-2xl">
                      <Lock className="text-red-600 w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[12px] font-black uppercase tracking-widest text-white">Security Branding</h3>
                    <p className="text-[8px] text-zinc-500 font-bold uppercase">Configure ton terminal de paiement</p>
                  </div>
              </div>
              <div className="space-y-4">
                  <div className="space-y-2 text-left">
                      <label className="text-[9px] text-zinc-500 font-black uppercase ml-4">Merchant Business Name</label>
                      <input 
                          type="text" 
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          readOnly={!!profile?.business_name}
                          className={`w-full bg-black/50 border border-white/10 p-6 rounded-3xl text-[13px] outline-none transition-all text-white italic ${
                            profile?.business_name ? "border-green-600/30 text-green-500 cursor-not-allowed" : "focus:border-red-600/50"
                          }`} 
                      />
                  </div>
                  {!profile?.business_name && (
                    <button onClick={updateBusinessName} disabled={loading} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[11px] hover:bg-zinc-200 transition-all active:scale-95">
                        {loading ? 'Processing...' : 'Link Business Account'}
                    </button>
                  )}
              </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMode('api')} className="bg-zinc-900/40 p-12 rounded-[3rem] border border-white/5 flex flex-col items-center gap-4 hover:bg-zinc-900/80 transition-all group">
              <div className="bg-red-600/10 p-5 rounded-3xl group-hover:scale-110 transition-transform"><Globe className="text-red-600" size={28} /></div>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase italic block">SDK Gateway</span>
                <span className="text-[7px] text-zinc-600 uppercase font-bold">API Integration</span>
              </div>
            </button>
            <button onClick={() => setMode('request')} className="bg-zinc-900/40 p-12 rounded-[3rem] border border-white/5 flex flex-col items-center gap-4 hover:bg-zinc-900/80 transition-all group">
              <div className="bg-red-600/10 p-5 rounded-3xl group-hover:scale-110 transition-transform"><Mail className="text-red-600" size={28} /></div>
              <div className="text-center">
                <span className="text-[10px] font-black uppercase italic block">Invoice Pay</span>
                <span className="text-[7px] text-zinc-600 uppercase font-bold">Direct Billing</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* --- SDK API SECTION (AliExpress Style) --- */}
      {mode === 'api' && (
        <div className="animate-in fade-in duration-500">
           <button onClick={() => setMode('menu')} className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600 mb-8 hover:tracking-widest transition-all">
             <ArrowLeft size={14} /> Back to Terminal
           </button>

           <div className="bg-zinc-900/20 p-8 rounded-[3rem] border border-white/5 mb-10 text-center">
             <div className="mb-6"><CreditCard className="mx-auto text-red-600/40" size={40} /></div>
             <p className="text-[10px] font-bold text-zinc-400 uppercase mb-4">Aperçu du Bouton de Paiement</p>
             <div id="hatex-secure-pay-wrapper" className="max-w-xs mx-auto"></div>
           </div>

           {/* CSS Pou SDK a parèt menm jan ak Foto AliExpress la */}
           <style dangerouslySetInnerHTML={{ __html: `
            .htx-btn { background: #dc2626; color: white; width: 100%; padding: 22px; border-radius: 18px; font-weight: 900; border: none; cursor: pointer; font-family: sans-serif; box-shadow: 0 10px 30px rgba(220,38,38,0.3); text-transform: uppercase; letter-spacing: 1.5px; transition: 0.3s; }
            .htx-btn:hover { background: #b91c1c; transform: translateY(-2px); }
            
            .htx-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.92); backdrop-filter: blur(12px); z-index: 999999; display: none; align-items: flex-end; justify-content: center; }
            
            .htx-modal { 
              background: #0a0a0a; width: 100%; max-width: 550px; border-radius: 40px 40px 0 0; 
              padding: 35px; box-sizing: border-box; color: white; font-family: sans-serif; 
              animation: htxSlideUp 0.5s cubic-bezier(0.2, 1, 0.3, 1); max-height: 90vh; 
              overflow-y: auto; border-top: 4px solid #dc2626; position: relative;
            }
            @keyframes htxSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            
            .htx-close-btn { position: absolute; top: 20px; right: 25px; font-size: 30px; color: #444; cursor: pointer; }
            
            .htx-item-box { background: #141414; padding: 20px; border-radius: 25px; display: flex; gap: 20px; margin-bottom: 25px; border: 1px solid #222; }
            .htx-product-img { width: 110px; height: 110px; object-fit: cover; border-radius: 18px; background: #000; border: 1px solid #333; }
            .htx-info { flex: 1; display: flex; flex-direction: column; justify-content: center; }
            .htx-title { font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 8px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .htx-price-htg { color: #dc2626; font-size: 26px; font-weight: 900; }
            .htx-badge-usd { background: #222; font-size: 10px; color: #888; padding: 4px 10px; border-radius: 6px; font-weight: bold; margin-top: 5px; display: inline-block; }
            
            .htx-form-title { font-[900] text-transform: uppercase; font-size: 11px; color: #555; letter-spacing: 2px; margin: 25px 0 15px 5px; display: block; }
            .htx-input-group { position: relative; margin-bottom: 15px; }
            .htx-input { width: 100%; background: #1a1a1a; border: 1px solid #222; padding: 18px 20px; border-radius: 18px; color: white; font-size: 14px; box-sizing: border-box; outline: none; transition: 0.3s; }
            .htx-input:focus { border-color: #dc2626; background: #000; }
            
            .htx-shipping-info { background: #dc26260d; border: 1px dashed #dc262644; padding: 15px; border-radius: 15px; margin-top: 20px; display: flex; gap: 12px; align-items: center; }
          ` }} />

          {/* SCRIPT AVANSE (DEEP SCRAPING) */}
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              const TID = "${profile.id}";
              const TAUX = 136;

              function deepScrape() {
                const title = document.querySelector('h1')?.innerText || document.title;
                const img = document.querySelector('meta[property="og:image"]')?.content || 
                            document.querySelector('.product-main-image, .wp-post-image, [class*="MainImage"]')?.src || 
                            document.querySelector('img')?.src;
                
                const priceElements = ['.price', '.amount', '[class*="current-price"]', '.product-price'];
                let rawPriceText = "0";
                for(let selector of priceElements) {
                  let el = document.querySelector(selector);
                  if(el) { rawPriceText = el.innerText; break; }
                }

                const priceValue = parseFloat(rawPriceText.replace(/[^0-9.]/g, '')) || 0;
                const isUSD = rawPriceText.includes('$') || priceValue < 1000;
                const totalHTG = isUSD ? (priceValue * TAUX) : priceValue;

                return { name: title, img: img, htg: totalHTG, original: rawPriceText };
              }

              const target = document.getElementById('hatex-secure-pay-wrapper');
              if(!target) return;
              target.innerHTML = '';

              const mainBtn = document.createElement('button');
              mainBtn.className = 'htx-btn';
              mainBtn.innerHTML = '🔒 PEYE AK HATEX CARD (HTG)';
              target.appendChild(mainBtn);

              const modal = document.createElement('div');
              modal.className = 'htx-modal-overlay';
              modal.id = 'htx-modal-ui';
              modal.innerHTML = \`
                <div class="htx-modal">
                  <span class="htx-close-btn" id="htx-close">&times;</span>
                  <div style="margin-bottom:30px;">
                    <h2 style="font-weight:900; font-size:22px; letter-spacing:-1px;">CONFIRMATION</h2>
                    <p style="font-size:10px; color:#555; font-weight:bold; text-transform:uppercase;">Sécurisé par Hatex Merchant v4.0</p>
                  </div>

                  <div id="htx-product-data"></div>

                  <span class="htx-form-title">Détails de Livraison</span>
                  <form id="htx-final-form">
                    <div class="htx-input-group"><input required id="h_name" class="htx-input" placeholder="Nom et Prénom"></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                      <input required id="h_phone" type="tel" class="htx-input" placeholder="WhatsApp">
                      <input required id="h_email" type="email" class="htx-input" placeholder="Email">
                    </div>
                    <div class="htx-input-group"><input required id="h_address" class="htx-input" placeholder="Adresse complète (No, Rue, Ville)"></div>
                    
                    <div class="htx-shipping-info">
                      <div style="color:#dc2626;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>
                      <p style="font-size:11px; font-weight:800; margin:0;">Livraison standard disponible en Haïti</p>
                    </div>

                    <button type="submit" class="htx-btn" style="margin-top:30px;" id="htx-submit">PROCÉDER AU PAIEMENT</button>
                  </form>
                </div>
              \`;
              document.body.appendChild(modal);

              mainBtn.onclick = (e) => {
                e.preventDefault();
                const data = deepScrape();
                document.getElementById('htx-product-data').innerHTML = \`
                  <div class="htx-item-box">
                    <img src="\${data.img}" class="htx-product-img">
                    <div class="htx-info">
                      <div class="htx-title">\${data.name}</div>
                      <div class="htx-price-htg">\${data.htg.toLocaleString()} HTG</div>
                      <div class="htx-badge-usd">Prix Original: \${data.original}</div>
                    </div>
                  </div>
                \`;
                document.getElementById('htx-modal-ui').style.display = 'flex';
              };

              document.getElementById('htx-close').onclick = () => { document.getElementById('htx-modal-ui').style.display = 'none'; };

              document.getElementById('htx-final-form').onsubmit = (e) => {
                e.preventDefault();
                const data = deepScrape();
                const payload = {
                  terminal: TID,
                  amount: data.htg,
                  product: data.name,
                  customer: {
                    name: document.getElementById('h_name').value,
                    phone: document.getElementById('h_phone').value,
                    email: document.getElementById('h_email').value,
                    address: document.getElementById('h_address').value
                  }
                };
                const token = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
                window.location.href = "https://hatexcard.com/checkout?token=" + token;
              };
            })();
          ` }} />

           {/* DOCUMENTATION / HELP */}
           <div className="mt-16 border-t border-white/5 pt-10">
              <div className="flex items-center gap-3 mb-6">
                <Info size={18} className="text-zinc-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Guide d'Intégration</h4>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-zinc-900/10 p-6 rounded-3xl border border-white/5">
                  <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                    Kopye script sa a epi mete l anba <code>&lt;body&gt;</code> sit ou a. 
                    Li detekte otomatikman pri pwodwi yo epi li ouvri yon modal nwa/wouj 
                    pwofesyonèl pou kliyan an peye an Goud (HTG).
                  </p>
                </div>
                <div className="flex items-center justify-center bg-red-600/5 rounded-3xl border border-red-600/10 p-6">
                  <div className="text-center">
                    <Truck className="mx-auto text-red-600 mb-2" size={24} />
                    <p className="text-[9px] font-black uppercase italic">Shipping Haiti Support</p>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* --- HISTORY SECTION --- */}
      {mode === 'history' && (
        <div className="space-y-6 text-left animate-in slide-in-from-bottom-5 duration-700">
          <div className="flex justify-between items-end mb-8">
            <div>
                <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Live Transactions</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">En direct de la Blockchain Hatex</p>
                </div>
            </div>
            <button onClick={handleSyncBalance} disabled={syncing} className="bg-white text-black px-6 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-zinc-200 transition-all">
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Sync Wallet
            </button>
          </div>

          <div className="space-y-4">
            {transactions.length > 0 ? transactions.map((tx) => (
              <div key={tx.id} className="bg-zinc-900/30 p-6 rounded-[2.5rem] border border-white/5 hover:border-red-600/30 transition-all group relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10">
                  <div className="flex gap-5 items-center">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${tx.type?.includes('SDK') ? 'bg-red-600/10' : 'bg-blue-600/10'}`}>
                      {tx.type?.includes('SDK') ? <Globe className="text-red-600 w-6 h-6" /> : <Mail className="text-blue-600 w-6 h-6" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-black uppercase tracking-tight text-white italic">
                            {tx.customer_name || 'Hatex User'}
                        </p>
                        <span className="text-[7px] bg-white/5 px-2 py-0.5 rounded-md text-zinc-500 font-black border border-white/5">
                            {tx.type === 'SALE_SDK' ? 'API' : 'INV'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-zinc-600 font-bold italic">
                         <span className="text-[9px] uppercase flex items-center gap-1"><Calendar size={11}/> {new Date(tx.created_at).toLocaleDateString()}</span>
                         <span className="text-[9px] uppercase flex items-center gap-1"><ExternalLink size={11}/> {tx.platform || 'System'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black italic text-green-500">+{tx.amount?.toLocaleString()} <span className="text-[10px]">HTG</span></p>
                    <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${tx.status === 'success' ? 'text-green-500/50' : 'text-yellow-500/50'}`}>
                        {tx.status === 'success' ? 'Settled' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            )) : (
                <div className="py-24 text-center bg-zinc-900/10 rounded-[4rem] border border-dashed border-white/5">
                    <Box className="mx-auto text-zinc-800 mb-4" size={50} />
                    <p className="text-[11px] font-black uppercase text-zinc-700 italic tracking-[0.2em]">Aucune donnée trouvée</p>
                </div>
            )}
          </div>
        </div>
      )}

      {/* --- REQUEST / INVOICE SECTION --- */}
      {mode === 'request' && (
        <div className="space-y-6 text-left animate-in fade-in slide-in-from-right-4 duration-500">
          <button onClick={() => setMode('menu')} className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600 mb-4"><ArrowLeft size={16} /> Retour</button>
          
          <div className="bg-[#0d0e1a] p-12 rounded-[4rem] border border-white/5 shadow-3xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-10 opacity-5">
                <AlertTriangle size={150} />
              </div>
              
              <div className="mb-12">
                <label className="text-[10px] text-zinc-600 font-black uppercase ml-2 italic tracking-widest block mb-4">Amount to Receive (HTG)</label>
                <div className="flex items-center border-b-2 border-zinc-900 pb-4 focus-within:border-red-600 transition-all">
                    <span className="text-2xl font-black text-red-600 mr-4">HTG</span>
                    <input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent text-7xl font-black w-full outline-none italic text-white placeholder:text-zinc-900/50" />
                </div>
              </div>

              <div className="space-y-5 relative z-10">
                  <div className="relative">
                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-700" size={18} />
                    <input type="email" placeholder="CUSTOMER EMAIL ADDRESS" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-black/40 border border-white/5 p-6 pl-16 rounded-[2rem] w-full text-[12px] font-bold outline-none italic text-white focus:border-red-600/30 transition-all" />
                  </div>
                  
                  <div className="bg-red-600/5 p-6 rounded-[2rem] border border-red-600/10 mb-4">
                    <p className="text-[10px] text-zinc-500 italic leading-relaxed">
                      Lè ou voye faktire sa a, kliyan an ap resevwa yon email sekirize ak non biznis ou <strong>{profile.business_name}</strong>.
                    </p>
                  </div>

                  <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 py-7 rounded-[2rem] font-black uppercase italic text-[12px] hover:bg-red-700 transition-all shadow-2xl shadow-red-600/20 active:scale-95 flex items-center justify-center gap-3">
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>ENVOUYER LA FACTURE <ChevronRight size={18} /></>
                    )}
                  </button>
              </div>
          </div>
        </div>
      )}

      <div className="mt-24 flex flex-col items-center justify-center space-y-2 opacity-30">
        <ShieldCheck size={20} className="text-zinc-700" />
        <p className="text-center text-[7px] text-zinc-700 font-black uppercase tracking-[0.5em]">
          Hatex Secure Terminal v4.0.2 • End-to-End Encrypted Node
        </p>
      </div>
    </div>
  );
}