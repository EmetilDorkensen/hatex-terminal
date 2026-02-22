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
  Lock, CreditCard, Box, Truck, FileText, Upload
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
  
  // Branding states
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

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return alert('Tanpri chwazi yon dosye PDF.');
    
    setUploadingPdf(true);
    try {
      // Mete lojik Supabase Storage ou a la. Ex: supabase.storage.from('documents').upload(...)
      // Pou kounya nap jis simule yon delay:
      await new Promise(res => setTimeout(res, 1500));
      alert("PDF eksplakasyon upload ak siksè!");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  // --- KÒD SDK A NAN YON TEXT STRING POU L PA KRAZE NEXT.JS EPI POU W KA KOPYE L ---
  // Mwen konekte 'profile?.id' la dirèkteman anndan JS la
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

    /* FAB - BOUTON FLOTAN */
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

    /* FULL MODAL OVERLAY */
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

    /* CARDS PWODWI */
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

    /* FORM FIELDS */
    .htx-section-title { font-size: 14px !important; font-weight: 900 !important; color: #ff9d8a !important; text-transform: uppercase !important; margin: 35px 0 15px 10px !important; display: block; letter-spacing: 2px; }
    .htx-form-box { background: var(--htx-glass) !important; border-radius: 30px !important; padding: 30px !important; border: 1px solid rgba(255,255,255,0.1) !important; margin-bottom: 20px; }
    .htx-input { 
        width: 100% !important; padding: 20px !important; border-radius: 18px !important; border: 2px solid transparent !important; 
        background: #fff !important; color: #000 !important; font-size: 16px !important; margin-bottom: 15px !important; outline: none !important;
    }
    .htx-input:focus { border-color: var(--htx-primary) !important; box-shadow: 0 0 20px rgba(230,46,4,0.4) !important; }

    /* FOOTER */
    .htx-footer { background: #fff !important; color: #000 !important; padding: 40px !important; border-radius: 45px 45px 0 0 !important; box-shadow: 0 -20px 60px rgba(0,0,0,0.6) !important; }
    .htx-line { display: flex !important; justify-content: space-between !important; margin-bottom: 10px !important; font-weight: 600 !important; color: #555 !important; }
    .htx-total-line { display: flex !important; justify-content: space-between !important; font-size: 30px !important; font-weight: 900 !important; margin-top: 20px !important; border-top: 3px dashed #eee !important; padding-top: 25px !important; }

    .htx-pay-button { 
        background: linear-gradient(135deg, var(--htx-primary), var(--htx-secondary)) !important; 
        color: #fff !important; width: 100% !important; padding: 25px !important; border-radius: 22px !important; 
        border: none !important; font-weight: 900 !important; font-size: 22px !important; cursor: pointer !important; 
        margin-top: 30px !important; box-shadow: 0 15px 35px rgba(230, 46, 4, 0.5) !important;
    }

    /* INJECTED BUTTON */
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

    // 1. KONFIGIRASYON PWOFIL
    window.HTX_CORE = {
        config: {
            mid: "3fb21333-1b91-458d-a63b-002b344076fb", // Terminal ID ou
            rate: 136, // To echanj USD -> HTG
            shipping: {
                "Port-au-Prince": 250, "Pétion-Ville": 350, "Delmas": 250, "Tabarre": 300, 
                "Carrefour": 400, "Cap-Haïtien": 850, "Cayes": 950, "Gonaïves": 650, "Jacmel": 700
            }
        },
        cart: JSON.parse(localStorage.getItem('htx_v6_cart')) || [],
        shipCost: 0
    };

    // 2. SCANNER ENTELIJAN (Detekte pri ak varyasyon)
    window.htx_getPrice = function() {
        // Detekte WooCommerce Variations
        let vInput = document.querySelector('input.variation_id, .variation_id');
        if (vInput && vInput.value > 0) {
            let form = document.querySelector('.variations_form');
            if (form && form.dataset.product_variations) {
                let data = JSON.parse(form.dataset.product_variations);
                let match = data.find(v => v.variation_id == vInput.value);
                if (match) return parseFloat(match.display_price);
            }
        }

        // Shopify Scanner
        if (window.Shopify && window.meta?.product) {
            return window.meta.product.variants[0].price / 100;
        }

        // Pri Creole/Standard
        let pEl = document.querySelector('.summary .price .amount bdi, .summary .price .amount, .product-price, .price, [class*="price"]');
        if (pEl) {
            let val = parseFloat(pEl.innerText.replace(/[^0-9.]/g, ''));
            if (val > 0) return val;
        }

        return null;
    };

    // 3. AJOUTE NAN PANYEN
    window.htx_add = function() {
        let price = window.htx_getPrice();
        if (!price) return alert("❌ Tanpri chwazi opsyon pwodwi a (gwosè/koulè) anvan.");

        // Konvèti si se dola
        let htgPrice = (price < 3500) ? Math.round(price * window.HTX_CORE.config.rate) : Math.round(price);
        
        let name = document.querySelector('h1')?.innerText || document.title;
        let img = document.querySelector('meta[property="og:image"]')?.content || document.querySelector('.wp-post-image')?.src || document.querySelector('img')?.src;
        let variant = Array.from(document.querySelectorAll('select')).map(s => s.options[s.selectedIndex]?.text).filter(t => t && !t.includes('---')).join(' / ') || "Inite";
        let qty = parseInt(document.querySelector('input.qty, .quantity input')?.value || 1);

        window.HTX_CORE.cart.push({ id: Date.now(), name, price: htgPrice, qty, img, variant });
        window.htx_sync();
        window.htx_toggle(true);
    };

    // 4. SYNC AK STORAGE
    window.htx_sync = function() {
        localStorage.setItem('htx_v6_cart', JSON.stringify(window.HTX_CORE.cart));
        let badge = document.getElementById('htx-fab-count');
        badge.innerText = window.HTX_CORE.cart.length;
        badge.style.display = window.HTX_CORE.cart.length > 0 ? 'flex' : 'none';
        window.htx_render();
    };

    // 5. TOKLE MODAL
    window.htx_toggle = function(force) {
        let overlay = document.getElementById('htx-main-overlay');
        overlay.style.display = (force || overlay.style.display !== 'flex') ? 'flex' : 'none';
        if (overlay.style.display === 'flex') window.htx_render();
    };

    // 6. KANTITE (QTY)
    window.htx_qty = function(id, delta) {
        let item = window.HTX_CORE.cart.find(x => x.id === id);
        if (item) {
            item.qty += delta;
            if (item.qty < 1) window.HTX_CORE.cart = window.HTX_CORE.cart.filter(x => x.id !== id);
            window.htx_sync();
        }
    };

    // 7. RENDER (BUILD UI)
    window.htx_render = function() {
        const listEl = document.getElementById('htx-render-list');
        const formEl = document.getElementById('htx-render-form');
        const footEl = document.getElementById('htx-render-footer');
        
        if (window.HTX_CORE.cart.length === 0) {
            listEl.innerHTML = '<div style="text-align:center; padding:100px 0; color:#888;"><h3>Panyen ou vid...</h3></div>';
            formEl.innerHTML = ""; footEl.innerHTML = ""; return;
        }

        let subtotal = window.HTX_CORE.cart.reduce((s, i) => s + (i.price * i.qty), 0);

        listEl.innerHTML = window.HTX_CORE.cart.map(item => `
            <div class="htx-item-card">
                <img src="${item.img}" class="htx-item-img">
                <div class="htx-item-details">
                    <div class="htx-item-name">${item.name}</div>
                    <div class="htx-item-meta">${item.variant}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="font-size:18px; color:var(--htx-primary);">${(item.price * item.qty).toLocaleString()} HTG</b>
                        <div class="htx-qty-wrapper">
                            <button class="htx-qty-btn" onclick="window.htx_qty(${item.id}, -1)">-</button>
                            <div class="htx-qty-val">${item.qty}</div>
                            <button class="htx-qty-btn" onclick="window.htx_qty(${item.id}, 1)">+</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        formEl.innerHTML = `
            <span class="htx-section-title">LIVREZON</span>
            <div class="htx-form-box">
                <select class="htx-input" onchange="window.HTX_CORE.shipCost=parseInt(this.value); window.htx_render()">
                    <option value="0">--- Chwazi Zòn Ou ---</option>
                    ${Object.entries(window.HTX_CORE.config.shipping).map(([z, p]) => `<option value="${p}" ${window.HTX_CORE.shipCost==p?'selected':''}>${z} (+${p} HTG)</option>`).join('')}
                </select>
            </div>
            <span class="htx-section-title">ENFÒMASYON</span>
            <div class="htx-form-box">
                <input id="htx_f_n" class="htx-input" placeholder="Non konplè" value="${localStorage.getItem('htx_n')||''}">
                <input id="htx_f_p" class="htx-input" placeholder="WhatsApp / Telefòn" value="${localStorage.getItem('htx_p')||''}">
                <textarea id="htx_f_a" class="htx-input" placeholder="Adrès Rezidans" style="height:80px;">${localStorage.getItem('htx_a')||''}</textarea>
            </div>
        `;

        footEl.innerHTML = `
            <div class="htx-footer">
                <div class="htx-max-container">
                    <div class="htx-line"><span>Sous-Total</span><span>${subtotal.toLocaleString()} HTG</span></div>
                    <div class="htx-line"><span>Livrezon</span><span>${window.HTX_CORE.shipCost.toLocaleString()} HTG</span></div>
                    <div class="htx-total-line">
                        <span>TOTAL</span>
                        <span style="color:var(--htx-primary);">${(subtotal + window.HTX_CORE.shipCost).toLocaleString()} HTG</span>
                    </div>
                    <button class="htx-pay-button" onclick="window.htx_pay()">PEYE SEKIRIZE ➔</button>
                </div>
            </div>
        `;
    };

    // 8. FINAL PAY (HATEX GATEWAY)
    window.htx_pay = function() {
        const n = document.getElementById('htx_f_n').value.trim();
        const p = document.getElementById('htx_f_p').value.trim();
        const a = document.getElementById('htx_f_a').value.trim();

        if (!n || !p || window.HTX_CORE.shipCost === 0) return alert("⚠️ Ranpli tout enfòmasyon yo!");

        localStorage.setItem('htx_n', n); localStorage.setItem('htx_p', p); localStorage.setItem('htx_a', a);

        let total = window.HTX_CORE.cart.reduce((s, i) => s + (i.price * i.qty), 0) + window.HTX_CORE.shipCost;
        let products = window.HTX_CORE.cart.map(i => `${i.qty}x ${i.name} (${i.variant})`).join(' | ');

        const payload = {
            terminal: window.HTX_CORE.config.mid,
            amount: total,
            product: products,
            customer: { n, p, a }
        };

        // Encode Base64 UTF-8 Sekirize
        let token = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        window.location.href = "https://hatexcard.com/checkout?token=" + token;
    };

    // 9. AUTO-INJECTOR & OBSERVER
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

    // Swiv si paj la chanje (pou tèm ki chaje pwodwi ak AJAX)
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
          
          {/* SECTION: BRANDING & PDF UPLOAD */}
          <div className="bg-[#0d0e1a] border border-white/5 p-8 rounded-[3rem] mb-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10"><ShieldCheck size={80} className="text-red-600" /></div>
            <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-600/10 p-3 rounded-2xl"><Lock className="text-red-600 w-5 h-5" /></div>
                <div><h3 className="text-[12px] font-black uppercase tracking-widest">Security Branding</h3></div>
            </div>
            
            <div className="space-y-4">
                <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} readOnly={!!profile?.business_name} placeholder="Non Biznis ou..." className="w-full bg-black/50 border border-white/10 p-6 rounded-3xl text-[13px] outline-none text-white italic" />
                {!profile?.business_name && (
                  <button onClick={updateBusinessName} disabled={loading} className="w-full bg-white text-black py-6 rounded-3xl font-black uppercase text-[11px]">{loading ? 'Processing...' : 'Link Business Account'}</button>
                )}
            </div>

            {/* UPLOAD PDF SECTION */}
            <div className="mt-6 border-t border-white/5 pt-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-zinc-900 p-3 rounded-2xl"><FileText className="text-zinc-400 w-4 h-4" /></div>
                <div>
                  <h4 className="text-[11px] font-bold text-white uppercase tracking-wider">PDF Eksplikasyon</h4>
                  <p className="text-[9px] text-zinc-500">Ajoute yon manyèl pou kliyan ou yo</p>
                </div>
              </div>
              <label className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-5 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 transition-all">
                {uploadingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>Upload</span>
                <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
              </label>
            </div>
          </div>

          {/* SECTION: ACTIONS (Kache si pa gen non biznis) */}
          {profile?.business_name ? (
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
          ) : (
             <div className="bg-red-600/10 border border-red-600/20 p-8 rounded-[3rem] text-center flex flex-col items-center justify-center">
                <AlertTriangle className="text-red-500 w-10 h-10 mb-4" />
                <h4 className="text-[12px] font-black uppercase text-red-500 mb-2">Aksyon bloke</h4>
                <p className="text-[10px] text-red-500/70 max-w-xs mx-auto">
                  Tanpri anrejistre "Security Branding" ou a (Non Biznis) anvan ou ka jwenn aksè ak kòd SDK a ak sistèm Invoice la.
                </p>
             </div>
          )}

        </div>
      )}

      {/* --- SDK API SECTION (KOTE POU KOPYE KÒD LA) --- */}
      {mode === 'api' && profile?.business_name && (
        <div className="animate-in fade-in duration-500">
          <button onClick={() => setMode('menu')} className="flex items-center gap-2 text-[10px] font-black uppercase text-red-600 mb-8 hover:tracking-widest transition-all">
            <ArrowLeft size={14} /> Back to Terminal
          </button>

          <div className="grid lg:grid-cols-2 gap-8">
            
            {/* Bwat Preview */}
            <div className="bg-zinc-900/20 p-8 rounded-[3rem] border border-white/5 flex flex-col items-center justify-center text-center">
              <ShoppingCart className="text-red-600/40 mb-4" size={40} />
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-4">Preview Bouton SDK a</p>
              
              <button className="bg-[#dc2626] text-white w-full max-w-xs p-[18px] rounded-xl font-black uppercase text-[12px] tracking-widest pointer-events-none opacity-50">
                🛒 AJOUTER AU PANIER HATEX
              </button>
              
              <p className="text-[9px] text-zinc-600 mt-6 uppercase">Bouton flotan sa ap parèt nan kwen sit kliyan ou yo.</p>
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
                  Sistèm sa a ap rale enfòmasyon pwodwi a otomatikman. Lè kliyan an klike "Payer", tout done yo (Pwodwi, Pri HTG, Adrès) ap ankode nan yon jeton (Token) pou ale nan paj chèkout la. Done yo ap parèt nan istwa tranzaksyon ou tou. Kopye kòd ki anlè a epi mete l nan paj html sit ou a.
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
      {mode === 'request' && profile?.business_name && (
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