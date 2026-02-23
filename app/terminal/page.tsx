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
  Lock, CreditCard, Box, Truck, FileText, Upload, 
  Search, Filter, Download, MoreVertical, Eye
} from 'lucide-react';

export default function TerminalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<'menu' | 'request' | 'api' | 'history'>('menu');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  
  // Invoice states
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  
  // Branding states
  const [businessName, setBusinessName] = useState('');
  const [copied, setCopied] = useState(false);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    const initTerminal = async () => {
      setLoading(true);
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
      setLoading(false);
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
        owner_id: user.id, 
        amount: parseFloat(amount), 
        client_email: email.toLowerCase().trim(), 
        status: 'pending',
        description: description
      }).select().single();
      
      if (invError) throw invError;
      
      const securePayLink = `${window.location.origin}/pay/${inv.id}`;
      
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
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
      setAmount(''); setEmail(''); setDescription(''); setMode('menu');
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
        merchant_id: profile?.id, 
        amount_to_add: totalVant 
      });
      if (error) throw error;
      alert("Balans Wallet ou moute avèk siksè!");
      window.location.reload();
    } catch (err: any) { 
      alert(err.message); 
    } finally { 
      setSyncing(false); 
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return alert('Tanpri chwazi yon dosye PDF.');
    
    setUploadingPdf(true);
    try {
      await new Promise(res => setTimeout(res, 2000));
      alert("PDF manyèl la sove sou sèvè Hatex la.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const fullSDKCode = `
<style>
    /* --- MASTER STYLES --- */
    :root {
        --htx-primary: #e62e04;
        --htx-secondary: #8a1c02;
        --htx-bg-dark: #0a0a0a;
        --htx-glass: rgba(255, 255, 255, 0.08);
        --htx-glass-dark: rgba(0, 0, 0, 0.90);
    }

    .htx-app-wrapper * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, sans-serif; transition: all 0.3s ease; }

    #htx-master-fab {
        position: fixed !important; bottom: 30px !important; right: 30px !important;
        width: 80px !important; height: 80px !important; background: var(--htx-bg-dark) !important;
        border-radius: 50% !important; display: flex !important; align-items: center !important;
        justify-content: center !important; cursor: pointer !important; z-index: 2147483645 !important;
        box-shadow: 0 15px 45px rgba(0,0,0,0.8) !important; border: 2.5px solid var(--htx-primary) !important;
    }
    #htx-master-fab:hover { transform: scale(1.1) rotate(8deg) !important; box-shadow: 0 20px 50px var(--htx-primary) !important; }
    
    #htx-fab-count {
        position: absolute !important; top: -5px !important; right: -5px !important;
        background: var(--htx-primary) !important; color: #fff !important; border-radius: 50% !important;
        width: 32px !important; height: 32px !important; font-size: 15px !important; font-weight: 900 !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        border: 3px solid var(--htx-bg-dark) !important;
    }

    #htx-main-overlay {
        position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important;
        background: radial-gradient(circle at top left, #1d0505, #000) !important;
        z-index: 2147483646 !important; display: none; flex-direction: column !important;
        backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    }

    .htx-header {
        padding: 30px !important; display: flex !important; align-items: center !important; justify-content: space-between !important;
        background: var(--htx-glass-dark) !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important;
    }
    .htx-header h2 { margin: 0; font-size: 24px; color: #fff; font-weight: 900; letter-spacing: 1px; }

    .htx-body { flex: 1 !important; overflow-y: auto !important; padding: 25px !important; }
    .htx-max-container { max-width: 600px !important; margin: 0 auto !important; width: 100% !important; }

    .htx-item-card {
        background: #fff !important; border-radius: 25px !important; padding: 20px !important; margin-bottom: 20px !important;
        display: flex !important; gap: 18px !important; position: relative !important; animation: htxFadeIn 0.5s ease;
        box-shadow: 0 15px 35px rgba(0,0,0,0.4) !important;
    }
    @keyframes htxFadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    
    .htx-item-img { width: 100px !important; height: 100px !important; border-radius: 18px !important; object-fit: cover !important; border: 1px solid #eee !important; }
    .htx-item-details { flex: 1 !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
    .htx-item-name { font-weight: 800 !important; font-size: 17px !important; color: #111 !important; line-height: 1.2 !important; }
    .htx-item-meta { font-size: 12px !important; color: var(--htx-primary) !important; font-weight: 700 !important; text-transform: uppercase; margin-top: 4px; }
    
    .htx-qty-wrapper { display: flex !important; align-items: center !important; background: #f0f2f5 !important; border-radius: 12px !important; padding: 5px !important; width: fit-content !important; }
    .htx-qty-btn { width: 35px !important; height: 35px !important; border: none !important; background: #fff !important; border-radius: 8px !important; cursor: pointer !important; font-weight: 900 !important; color: #000; }
    .htx-qty-val { width: 45px !important; text-align: center !important; font-weight: 800 !important; color: #000 !important; font-size: 16px; }

    .htx-section-title { font-size: 14px !important; font-weight: 900 !important; color: #ff9d8a !important; text-transform: uppercase !important; margin: 35px 0 15px 10px !important; display: block; letter-spacing: 2px; }
    .htx-form-box { background: var(--htx-glass) !important; border-radius: 30px !important; padding: 30px !important; border: 1px solid rgba(255,255,255,0.1) !important; margin-bottom: 20px; }
    .htx-input {
        width: 100% !important; padding: 20px !important; border-radius: 18px !important; border: 2px solid transparent !important;
        background: #fff !important; color: #000 !important; font-size: 16px !important; margin-bottom: 15px !important; outline: none !important;
    }
    .htx-input:focus { border-color: var(--htx-primary) !important; box-shadow: 0 0 20px rgba(230,46,4,0.4) !important; }

    .htx-footer { background: #fff !important; color: #000 !important; padding: 40px !important; border-radius: 45px 45px 0 0 !important; box-shadow: 0 -20px 60px rgba(0,0,0,0.6) !important; }
    .htx-line { display: flex !important; justify-content: space-between !important; margin-bottom: 10px !important; font-weight: 600 !important; color: #555 !important; }
    .htx-total-line { display: flex !important; justify-content: space-between !important; font-size: 30px !important; font-weight: 900 !important; margin-top: 20px !important; border-top: 3px dashed #eee !important; padding-top: 25px !important; }

    .htx-pay-button {
        background: linear-gradient(135deg, var(--htx-primary), var(--htx-secondary)) !important;
        color: #fff !important; width: 100% !important; padding: 25px !important; border-radius: 22px !important;
        border: none !important; font-weight: 900 !important; font-size: 22px !important; cursor: pointer !important;
        margin-top: 30px !important; box-shadow: 0 15px 35px rgba(230, 46, 4, 0.5) !important;
    }

    .htx-btn-injected {
        background: var(--htx-primary) !important; color: #fff !important; width: 100% !important;
        padding: 22px !important; border-radius: 18px !important; border: none !important;
        font-weight: 900 !important; font-size: 18px !important; cursor: pointer !important;
        margin-top: 15px !important; display: block !important; text-align: center !important;
        box-shadow: 0 10px 25px rgba(230, 46, 4, 0.25) !important;
    }
</style>

<div class="htx-app-wrapper">
    <div id="htx-master-fab" onclick="window.htx_toggle()">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
        <div id="htx-fab-count" style="display:none;">0</div>
    </div>

    <div id="htx-main-overlay">
        <div class="htx-header">
            <h2>🛒 HATEX MASTER CHECKOUT</h2>
            <div onclick="window.htx_toggle()" style="cursor:pointer; font-weight:900; color:white; font-size:14px; opacity:0.7;">[ FÈMEN ]</div>
        </div>
        <div class="htx-body">
            <div id="htx-render-list" class="htx-max-container"></div>
            <div id="htx-render-form" class="htx-max-container"></div>
        </div>
        <div id="htx-render-footer"></div>
    </div>
</div>

<script>
(function() {
    "use strict";

    window.HTX_CORE = {
        config: {
            mid: "${profile?.id || '3fb21333-1b91-458d-a63b-002b344076fb'}",
            rate: 136,
            shipping: {
                "Port-au-Prince": 250, "Pétion-Ville": 350, "Delmas": 250, "Tabarre": 300,
                "Carrefour": 400, "Cap-Haïtien": 850, "Cayes": 950, "Gonaïves": 650, "Jacmel": 700
            }
        },
        cart: JSON.parse(localStorage.getItem('htx_v6_cart')) || [],
        shipCost: 0,
        shipZone: ""
    };

    window.htx_getPrice = function() {
        let vInput = document.querySelector('input.variation_id, .variation_id');
        if (vInput && vInput.value > 0) {
            let form = document.querySelector('.variations_form');
            if (form && form.dataset.product_variations) {
                let data = JSON.parse(form.dataset.product_variations);
                let match = data.find(v => v.variation_id == vInput.value);
                if (match) return parseFloat(match.display_price);
            }
        }
        if (window.Shopify && window.meta?.product) {
            return window.meta.product.variants[0].price / 100;
        }
        let pEl = document.querySelector('.summary .price .amount bdi, .summary .price .amount, .product-price, .price, [class*="price"]');
        if (pEl) {
            let val = parseFloat(pEl.innerText.replace(/[^0-9.]/g, ''));
            if (val > 0) return val;
        }
        return null;
    };

    window.htx_add = function() {
        let price = window.htx_getPrice();
        if (!price) return alert("❌ Tanpri chwazi opsyon pwodwi a (gwosè/koulè) anvan.");
        let htgPrice = (price < 3500) ? Math.round(price * window.HTX_CORE.config.rate) : Math.round(price);
        let name = document.querySelector('h1')?.innerText || document.title;
        let img = document.querySelector('meta[property="og:image"]')?.content || document.querySelector('.wp-post-image')?.src || document.querySelector('img')?.src;
        let variant = Array.from(document.querySelectorAll('select')).map(s => s.options[s.selectedIndex]?.text).filter(t => t && !t.includes('---')).join(' / ') || "Inite";
        let qty = parseInt(document.querySelector('input.qty, .quantity input')?.value || 1);
        window.HTX_CORE.cart.push({ id: Date.now(), name, price: htgPrice, qty, img, variant });
        window.htx_sync();
        window.htx_toggle(true);
    };

    window.htx_sync = function() {
        localStorage.setItem('htx_v6_cart', JSON.stringify(window.HTX_CORE.cart));
        let badge = document.getElementById('htx-fab-count');
        badge.innerText = window.HTX_CORE.cart.length;
        badge.style.display = window.HTX_CORE.cart.length > 0 ? 'flex' : 'none';
        window.htx_render();
    };

    window.htx_toggle = function(force) {
        let overlay = document.getElementById('htx-main-overlay');
        overlay.style.display = (force || overlay.style.display !== 'flex') ? 'flex' : 'none';
        if (overlay.style.display === 'flex') window.htx_render();
    };

    window.htx_qty = function(id, delta) {
        let item = window.HTX_CORE.cart.find(x => x.id === id);
        if (item) {
            item.qty += delta;
            if (item.qty < 1) window.HTX_CORE.cart = window.HTX_CORE.cart.filter(x => x.id !== id);
            window.htx_sync();
        }
    };

    window.htx_render = function() {
        const listEl = document.getElementById('htx-render-list');
        const formEl = document.getElementById('htx-render-form');
        const footEl = document.getElementById('htx-render-footer');
        if (window.HTX_CORE.cart.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; padding:100px 0; color:#888;"><h3>Panyen ou vid...</h3></div>';
            formEl.innerHTML = ""; footEl.innerHTML = ""; return;
        }
        let subtotal = window.HTX_CORE.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        listEl.innerHTML = window.HTX_CORE.cart.map(item => \`
            <div class="htx-item-card">
                <img src="\${item.img}" class="htx-item-img">
                <div class="htx-item-details">
                    <div class="htx-item-name">\${item.name}</div>
                    <div class="htx-item-meta">\${item.variant}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="font-size:18px; color:var(--htx-primary);">\${(item.price * item.qty).toLocaleString()} HTG</b>
                        <div class="htx-qty-wrapper">
                            <button class="htx-qty-btn" onclick="window.htx_qty(\${item.id}, -1)">-</button>
                            <div class="htx-qty-val">\${item.qty}</div>
                            <button class="htx-qty-btn" onclick="window.htx_qty(\${item.id}, 1)">+</button>
                        </div>
                    </div>
                </div>
            </div>
        \`).join('');

        formEl.innerHTML = \`
            <span class="htx-section-title">LIVREZON</span>
            <div class="htx-form-box">
                <select class="htx-input" onchange="window.HTX_CORE.shipCost=parseInt(this.value); window.HTX_CORE.shipZone=this.options[this.selectedIndex].text.split('(')[0].trim(); window.htx_render()">
                    <option value="0">--- Chwazi Zòn Ou ---</option>
                    \${Object.entries(window.HTX_CORE.config.shipping).map(([z, p]) => \`<option value="\${p}" \${window.HTX_CORE.shipCost==p?'selected':''}>\${z} (+\${p} HTG)</option>\`).join('')}
                </select>
            </div>
            <span class="htx-section-title">ENFÒMASYON</span>
            <div class="htx-form-box">
                <input id="htx_f_n" class="htx-input" placeholder="Non konplè" value="\${localStorage.getItem('htx_n')||''}">
                <input id="htx_f_p" class="htx-input" placeholder="WhatsApp / Telefòn" value="\${localStorage.getItem('htx_p')||''}">
                <textarea id="htx_f_a" class="htx-input" placeholder="Adrès Rezidans" style="height:80px;">\${localStorage.getItem('htx_a')||''}</textarea>
            </div>
        \`;

        footEl.innerHTML = \`
            <div class="htx-footer">
                <div class="htx-max-container">
                    <div class="htx-line"><span>Sous-Total</span><span>\${subtotal.toLocaleString()} HTG</span></div>
                    <div class="htx-line"><span>Livrezon</span><span>\${window.HTX_CORE.shipCost.toLocaleString()} HTG</span></div>
                    <div class="htx-total-line">
                        <span>TOTAL</span>
                        <span style="color:var(--htx-primary);">\${(subtotal + window.HTX_CORE.shipCost).toLocaleString()} HTG</span>
                    </div>
                    <button class="htx-pay-button" onclick="window.htx_pay()">PEYE SEKIRIZE ➔</button>
                </div>
            </div>
        \`;
    };

    window.htx_pay = function() {
        const n = document.getElementById('htx_f_n').value.trim();
        const p = document.getElementById('htx_f_p').value.trim();
        const a = document.getElementById('htx_f_a').value.trim();
        if (!n || !p || window.HTX_CORE.shipCost === 0) return alert("⚠️ Ranpli tout enfòmasyon yo!");
        localStorage.setItem('htx_n', n); localStorage.setItem('htx_p', p); localStorage.setItem('htx_a', a);
        
        let subtotal = window.HTX_CORE.cart.reduce((s, i) => s + (i.price * i.qty), 0);
        let total = subtotal + window.HTX_CORE.shipCost;
        
        const payload = { 
            terminal: window.HTX_CORE.config.mid, 
            amount: total, 
            order_details: {
                items: window.HTX_CORE.cart,
                subtotal: subtotal,
                shipping_fee: window.HTX_CORE.shipCost,
                shipping_zone: window.HTX_CORE.shipZone
            },
            customer: { full_name: n, phone: p, address: a } 
        };

        let token = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        window.location.href = "https://hatexcard.com/checkout?token=" + token;
    };

    function htx_inject() {
        const targets = ['.single_add_to_cart_button', 'button[name="add-to-cart"]', '.add_to_cart_button', '#add-to-cart', '.elementor-button-add-to-cart'];
        targets.forEach(sel => {
            document.querySelectorAll(sel).forEach(btn => {
                if (!btn.dataset.htxInjected) {
                    const myBtn = document.createElement('button');
                    myBtn.className = 'htx-btn-injected';
                    myBtn.innerHTML = '💳 ACHETER EN GOURDES (HATEX)';
                    myBtn.type = "button";
                    myBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); window.htx_add(); };
                    btn.parentNode.insertBefore(myBtn, btn.nextSibling);
                    btn.dataset.htxInjected = "true";
                }
            });
        });
    }
    const observer = new MutationObserver(htx_inject);
    observer.observe(document.body, { childList: true, subtree: true });
    htx_inject();
    window.htx_sync();
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
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">
            {profile?.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Secure Node Connected</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setMode('menu')} className={`px-6 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${mode === 'menu' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'}`}><LayoutGrid size={16} /> Dashboard</button>
          <button onClick={() => setMode('history')} className={`px-6 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${mode === 'history' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'}`}><History size={16} /> Logs</button>
        </div>
      </div>

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <RefreshCw size={40} className="text-red-600 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Terminal Data...</p>
        </div>
      )}

      {/* DASHBOARD MENU */}
      {mode === 'menu' && (
        <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="lg:col-span-8 space-y-8">
            {/* BRANDING CARD */}
            <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-10 rounded-[3.5rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-20 transition-opacity"><ShieldCheck size={120} className="text-red-600" /></div>
              <div className="flex items-center gap-4 mb-8">
                  <div className="bg-red-600/10 p-4 rounded-3xl"><Lock className="text-red-600 w-6 h-6" /></div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-widest">Merchant Identity</h3>
                    <p className="text-[10px] text-zinc-500 font-bold">Configure your public business profile</p>
                  </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input 
                      type="text" 
                      value={businessName} 
                      onChange={(e) => setBusinessName(e.target.value)} 
                      readOnly={!!profile?.business_name} 
                      placeholder="Business Legal Name" 
                      className="w-full bg-black/40 border border-white/10 py-6 pl-16 pr-6 rounded-3xl text-[14px] outline-none text-white italic focus:border-red-600/50 transition-all" 
                    />
                  </div>
                  {!profile?.business_name && (
                    <button 
                      onClick={updateBusinessName} 
                      disabled={loading} 
                      className="bg-white text-black px-10 py-6 rounded-3xl font-black uppercase text-[12px] hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-2xl"
                    >
                      {loading ? 'Processing...' : 'Verify Identity'}
                    </button>
                  )}
              </div>

              <div className="mt-10 pt-10 border-t border-white/5 grid grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-zinc-900 p-4 rounded-2xl"><FileText className="text-zinc-500 w-5 h-5" /></div>
                  <div>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-wider">KYC Manual</h4>
                    <p className="text-[9px] text-zinc-500 uppercase italic">PDF Documentation</p>
                  </div>
                  <label className="ml-auto cursor-pointer bg-zinc-900 hover:bg-zinc-800 border border-white/10 p-4 rounded-2xl transition-all">
                    {uploadingPdf ? <RefreshCw size={16} className="animate-spin text-red-600" /> : <Upload size={16} />}
                    <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
                  </label>
                </div>
                <div className="flex items-center gap-4">
                  <div className="bg-zinc-900 p-4 rounded-2xl"><Globe className="text-zinc-500 w-5 h-5" /></div>
                  <div>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-wider">Gateway Status</h4>
                    <span className="text-[9px] text-green-500 font-black uppercase">Active & Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            {profile?.business_name ? (
              <div className="grid grid-cols-2 gap-8">
                <button 
                  onClick={() => setMode('api')} 
                  className="bg-zinc-900/30 p-16 rounded-[4rem] border border-white/5 flex flex-col items-center justify-center gap-6 hover:bg-red-600/10 hover:border-red-600/20 transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="bg-zinc-950 p-6 rounded-3xl group-hover:scale-110 transition-transform"><Globe className="text-red-600" size={32} /></div>
                  <div className="text-center">
                    <span className="text-[12px] font-black uppercase italic block">SDK Deployment</span>
                    <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter mt-1 block">Connect your web store</span>
                  </div>
                </button>
                <button 
                  onClick={() => setMode('request')} 
                  className="bg-zinc-900/30 p-16 rounded-[4rem] border border-white/5 flex flex-col items-center justify-center gap-6 hover:bg-red-600/10 hover:border-red-600/20 transition-all group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="bg-zinc-950 p-6 rounded-3xl group-hover:scale-110 transition-transform"><Mail className="text-red-600" size={32} /></div>
                  <div className="text-center">
                    <span className="text-[12px] font-black uppercase italic block">Smart Invoice</span>
                    <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-tighter mt-1 block">Direct payment links</span>
                  </div>
                </button>
              </div>
            ) : (
               <div className="bg-red-600/5 border border-red-600/20 p-12 rounded-[4rem] text-center">
                  <AlertTriangle className="text-red-600 w-12 h-12 mx-auto mb-6" />
                  <h4 className="text-sm font-black uppercase text-red-500 mb-2 italic">Aksyon limite pou kounya</h4>
                  <p className="text-[11px] text-red-500/60 max-w-sm mx-auto leading-relaxed">
                    Ou dwe lye biznis ou an anvan ou ka jwenn aksè nan SDK ak Invoices.
                  </p>
               </div>
            )}
          </div>

          {/* SIDEBAR - WALLET INFO */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white text-black p-10 rounded-[3.5rem] shadow-2xl shadow-red-600/10 relative overflow-hidden">
                <div className="flex justify-between items-start mb-10">
                  <div className="bg-black text-white p-4 rounded-2xl"><Wallet size={20} /></div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Available Balance</p>
                    <h2 className="text-4xl font-black italic tracking-tighter mt-1">
                      {profile?.balance?.toLocaleString() || '0'}<span className="text-[14px] ml-1">HTG</span>
                    </h2>
                  </div>
                </div>
                <button 
                  onClick={handleSyncBalance}
                  disabled={syncing}
                  className="w-full bg-zinc-100 hover:bg-red-600 hover:text-white py-6 rounded-3xl font-black uppercase text-[11px] transition-all flex items-center justify-center gap-3 border border-black/5"
                >
                  {syncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                  Senkronize Vant
                </button>
            </div>

            <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[3rem]">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-zinc-500">Node Configuration</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-5 bg-black/40 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-bold text-zinc-400">Merchant ID</span>
                  <span className="text-[10px] font-mono text-red-500 uppercase">{profile?.id?.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between items-center p-5 bg-black/40 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-bold text-zinc-400">KYC Status</span>
                  <span className={`text-[10px] font-black uppercase ${profile?.kyc_status === 'approved' ? 'text-green-500' : 'text-orange-500'}`}>
                    {profile?.kyc_status || 'pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API / SDK MODE */}
      {mode === 'api' && (
        <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
           <div className="flex items-center justify-between mb-8">
             <button onClick={() => setMode('menu')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"><ArrowLeft size={20} /></button>
             <h2 className="text-xl font-black uppercase italic tracking-widest">Master SDK Integration</h2>
             <div className="w-10"></div>
           </div>

           <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] overflow-hidden">
              <div className="p-8 border-b border-white/5 flex items-center justify-between bg-zinc-900/20">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                  <span className="text-[11px] font-black uppercase tracking-widest">hatex-v6-core.js</span>
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="px-6 py-3 bg-white text-black rounded-xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                >
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy Code'}
                </button>
              </div>
              <div className="p-10">
                <p className="text-[12px] text-zinc-400 mb-8 leading-relaxed italic border-l-4 border-red-600 pl-6 bg-red-600/5 py-4 rounded-r-2xl">
                  Kopye tout kòd sa a epi mete l nan seksyon <span className="text-white font-bold">&lt;head&gt;</span> oswa <span className="text-white font-bold">&lt;footer&gt;</span> sou sit entènèt ou an (Shopify, WooCommerce, Custom). Li pral detekte pri yo otomatikman epi ajoute bouton peman Hatex la.
                </p>
                <div className="relative">
                  <pre className="text-[12px] text-zinc-500 font-mono overflow-x-auto p-8 bg-black/50 rounded-3xl h-[400px] border border-white/5">
                    {fullSDKCode}
                  </pre>
                  <div className="absolute bottom-4 right-4 text-[10px] font-bold text-red-600/30">V6.2.0 SECURE CORE</div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* INVOICE MODE */}
      {mode === 'request' && (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="flex items-center justify-between mb-10">
             <button onClick={() => setMode('menu')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"><ArrowLeft size={20} /></button>
             <h2 className="text-xl font-black uppercase italic tracking-widest">New Smart Invoice</h2>
             <div className="w-10"></div>
          </div>

          <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/10 p-12 rounded-[4rem] space-y-8">
             <div className="space-y-4">
               <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Montan an (HTG)</label>
               <input 
                 type="number" 
                 value={amount} 
                 onChange={(e) => setAmount(e.target.value)} 
                 className="w-full bg-black/50 border border-white/10 p-8 rounded-3xl text-3xl font-black italic outline-none focus:border-red-600/50 transition-all" 
                 placeholder="0.00"
               />
             </div>

             <div className="space-y-4">
               <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Email Kliyan</label>
               <div className="relative">
                 <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                 <input 
                   type="email" 
                   value={email} 
                   onChange={(e) => setEmail(e.target.value)} 
                   className="w-full bg-black/50 border border-white/10 py-6 pl-16 pr-6 rounded-3xl text-sm italic outline-none focus:border-red-600/50" 
                   placeholder="kliyan@gmail.com"
                 />
               </div>
             </div>

             <div className="space-y-4">
               <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Deskripsyon (Opsyonèl)</label>
               <textarea 
                 value={description} 
                 onChange={(e) => setDescription(e.target.value)} 
                 className="w-full bg-black/50 border border-white/10 p-8 rounded-3xl text-sm italic outline-none focus:border-red-600/50 h-32" 
                 placeholder="Kisa kliyan an ap achte?"
               />
             </div>

             <button 
               onClick={handleCreateInvoice} 
               disabled={loading} 
               className="w-full bg-red-600 hover:bg-white hover:text-black py-8 rounded-[2rem] font-black uppercase italic text-lg shadow-2xl shadow-red-600/20 transition-all active:scale-95"
             >
               {loading ? 'Creating...' : 'Jenere Lyen & Voye Email'}
             </button>
          </div>
        </div>
      )}

      {/* LOGS / HISTORY MODE */}
      {mode === 'history' && (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
           <div className="flex items-center justify-between mb-10">
             <button onClick={() => setMode('menu')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"><ArrowLeft size={20} /></button>
             <h2 className="text-xl font-black uppercase italic tracking-widest">Transaction Logs</h2>
             <div className="flex gap-2">
               <button className="p-4 bg-zinc-900 rounded-2xl hover:bg-white hover:text-black transition-all"><Filter size={18} /></button>
               <button className="p-4 bg-zinc-900 rounded-2xl hover:bg-white hover:text-black transition-all"><Download size={18} /></button>
             </div>
           </div>

           <div className="space-y-4">
             {transactions.length > 0 ? transactions.map((tx) => (
               <div key={tx.id} className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[2.5rem] flex items-center justify-between group hover:border-red-600/20 transition-all">
                  <div className="flex items-center gap-6">
                    <div className={`p-5 rounded-3xl ${tx.status === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                      <Box size={24} />
                    </div>
                    <div>
                      <h4 className="font-black uppercase italic text-sm">{tx.type || 'PAYMENT'}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">{new Date(tx.created_at).toLocaleDateString()}</span>
                        <span className="text-[10px] text-zinc-700">•</span>
                        <span className="text-[10px] font-bold text-zinc-500">ID: {tx.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black italic">{parseFloat(tx.amount).toLocaleString()} HTG</div>
                    <span className={`text-[9px] font-black uppercase tracking-widest ${tx.status === 'success' ? 'text-green-500' : 'text-orange-500'}`}>{tx.status}</span>
                  </div>
               </div>
             )) : (
               <div className="text-center py-40 bg-zinc-900/10 rounded-[4rem] border border-dashed border-white/5">
                 <Package className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">No transactions recorded on this terminal node.</p>
               </div>
             )}
           </div>
        </div>
      )}

    </div>
  );
}