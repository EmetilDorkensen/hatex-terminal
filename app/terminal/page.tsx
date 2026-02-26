"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  History, Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, Globe, Wallet, RefreshCw, ShieldCheck,
  User, AlertTriangle, Lock, Box, FileText, Upload, 
  Filter, Download, TrendingUp, Package, BarChart3,
  ArrowUpRight, DollarSign, Zap
} from 'lucide-react';

export default function TerminalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<'menu' | 'request' | 'api' | 'history'>('menu');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
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
      if (prof) { setProfile(prof); setBusinessName(prof.business_name || ''); }
      const { data: tx } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setTransactions(tx || []);
      // Jwenn invoices pou kalkile revni
      const { data: inv } = await supabase.from('invoices').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
      setInvoices(inv || []);
      setLoading(false);
    };
    initTerminal();
  }, [supabase, router]);

  // ── KALKIL REVNI ──────────────────────────────────────────────────
  const earnings = useMemo(() => {
    const sdkSales = transactions.filter(tx => (tx.type === 'SALE_SDK' || tx.type === 'SALE') && tx.status === 'success');
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const sdkTotal = sdkSales.reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);
    const invoiceTotal = paidInvoices.reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
    const now = new Date();
    const thisMonth = sdkSales.filter(tx => new Date(tx.created_at).getMonth() === now.getMonth()).reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0)
      + paidInvoices.filter(inv => new Date(inv.created_at).getMonth() === now.getMonth()).reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
    return { sdkTotal, invoiceTotal, total: sdkTotal + invoiceTotal, thisMonth, sdkCount: sdkSales.length, invoiceCount: paidInvoices.length };
  }, [transactions, invoices]);

  const updateBusinessName = async () => {
    if (!businessName) return alert("Tanpri antre yon non biznis.");
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ business_name: businessName }).eq('id', profile?.id);
      if (error) throw error;
      alert("Branding anrejistre ak siksè!");
      setProfile({ ...profile, business_name: businessName });
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleCreateInvoice = async () => {
    if (!amount || parseFloat(amount) <= 0 || !email) { alert("Tanpri mete yon montan ak yon email valid."); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ou dwe konekte");
      const { data: freshProfile } = await supabase.from('profiles').select('kyc_status, business_name').eq('id', user.id).single();
      if (freshProfile?.kyc_status !== 'approved') { alert(`Echèk: Kont ou dwe 'approved' pou voye invoice.`); setMode('menu'); return; }
      const { data: inv, error: invError } = await supabase.from('invoices').insert({
        owner_id: user.id, amount: parseFloat(amount), client_email: email.toLowerCase().trim(), status: 'pending', description
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
      setAmount(''); setEmail(''); setDescription(''); setMode('menu');
    } catch (err: any) { alert(err.message); } finally { setLoading(false); }
  };

  const handleSyncBalance = async () => {
    if (earnings.total <= 0) return alert("Pa gen okenn revni pou senkronize.");
    setSyncing(true);
    try {
      const { error } = await supabase.rpc('increment_merchant_balance', { merchant_id: profile?.id, amount_to_add: earnings.total });
      if (error) throw error;
      alert("Balans Wallet ou moute avèk siksè!");
      window.location.reload();
    } catch (err: any) { alert(err.message); } finally { setSyncing(false); }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return alert('Tanpri chwazi yon dosye PDF.');
    setUploadingPdf(true);
    try { await new Promise(res => setTimeout(res, 2000)); alert("PDF manyèl la sove sou sèvè Hatex la."); }
    catch (err: any) { alert(err.message); } finally { setUploadingPdf(false); }
  };

  // ── UTILITÈ: 3 Premye Lèt non kliyan ─────────────────────────────
  const getInitials = (emailOrName: string) => {
    if (!emailOrName) return '??';
    const name = emailOrName.split('@')[0].replace(/[._-]/g, ' ');
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0] + (parts[2]?.[0] || '')).toUpperCase().substring(0, 3);
    return name.substring(0, 3).toUpperCase();
  };

  const getInitialColor = (str: string) => {
    const colors = ['bg-red-600', 'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-amber-600', 'bg-pink-600', 'bg-cyan-600'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // ── SDK CODE ──────────────────────────────────────────────────────
  const fullSDKCode = `<!-- ================================================================
  HATEX SDK v9.0 — AI-POWERED UNIVERSAL CHECKOUT ENGINE
  Mete kòd sa a nan <footer> sit ou ANVAN </body>
  Sipòte: WooCommerce, Shopify, Magento, PrestaShop, OpenCart,
          BigCommerce, Wix, Squarespace, Custom — nenpòt theme
  ================================================================ -->
<style>
:root{--htx:#e62e04;--htx2:#8a0a00;--htxbg:#09090f;--htxb:rgba(255,255,255,.07);}
.htx*{box-sizing:border-box;font-family:system-ui,sans-serif;}
/* FAB */
#htx-fab{position:fixed!important;bottom:26px!important;right:26px!important;width:70px!important;height:70px!important;border-radius:50%!important;background:var(--htxbg)!important;border:2px solid var(--htx)!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;z-index:2147483645!important;box-shadow:0 10px 40px rgba(0,0,0,.7),0 0 0 0 rgba(230,46,4,.4)!important;transition:all .3s!important;animation:htxPulse 3s infinite!important;}
#htx-fab:hover{transform:scale(1.08)!important;box-shadow:0 14px 50px rgba(230,46,4,.4)!important;}
@keyframes htxPulse{0%,100%{box-shadow:0 10px 40px rgba(0,0,0,.7),0 0 0 0 rgba(230,46,4,.4)}50%{box-shadow:0 10px 40px rgba(0,0,0,.7),0 0 0 12px rgba(230,46,4,0)}}
#htx-badge{position:absolute!important;top:-5px!important;right:-5px!important;background:var(--htx)!important;color:#fff!important;border-radius:50%!important;width:24px!important;height:24px!important;font-size:11px!important;font-weight:900!important;display:none!important;align-items:center!important;justify-content:center!important;border:2px solid var(--htxbg)!important;}
/* PANEL */
#htx-overlay{position:fixed!important;inset:0!important;z-index:2147483646!important;display:none;flex-direction:row!important;}
#htx-backdrop{flex:1!important;background:rgba(0,0,0,.6)!important;backdrop-filter:blur(6px)!important;cursor:pointer!important;}
#htx-panel{width:460px!important;max-width:100vw!important;height:100%!important;background:var(--htxbg)!important;border-left:1px solid var(--htxb)!important;display:flex!important;flex-direction:column!important;animation:htxSlide .35s cubic-bezier(.16,1,.3,1)!important;box-shadow:-30px 0 80px rgba(0,0,0,.8)!important;}
@keyframes htxSlide{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
#htx-phead{padding:22px 24px!important;background:rgba(0,0,0,.4)!important;border-bottom:1px solid var(--htxb)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;flex-shrink:0!important;}
#htx-phead h3{font-size:15px!important;font-weight:900!important;color:#fff!important;letter-spacing:.04em!important;}
#htx-pclose{width:34px!important;height:34px!important;background:rgba(255,255,255,.05)!important;border-radius:9px!important;border:1px solid var(--htxb)!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#888!important;font-size:18px!important;transition:all .2s!important;}
#htx-pclose:hover{background:var(--htx)!important;color:#fff!important;}
#htx-pbody{flex:1!important;overflow-y:auto!important;padding:18px!important;}
#htx-pbody::-webkit-scrollbar{width:3px}#htx-pbody::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
/* PWODWI KAT */
.htx-item{display:flex!important;gap:12px!important;padding:14px!important;background:rgba(255,255,255,.04)!important;border:1px solid var(--htxb)!important;border-radius:16px!important;margin-bottom:10px!important;animation:htxFade .4s ease!important;}
@keyframes htxFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.htx-item:hover{border-color:rgba(230,46,4,.2)!important;}
.htx-img{width:78px!important;height:78px!important;border-radius:11px!important;object-fit:cover!important;background:#111!important;flex-shrink:0!important;}
.htx-info{flex:1!important;min-width:0!important;}
.htx-name{font-size:13px!important;font-weight:700!important;color:#fff!important;line-height:1.3!important;margin-bottom:3px!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
.htx-var{font-size:10px!important;color:var(--htx)!important;font-weight:700!important;text-transform:uppercase!important;margin-bottom:9px!important;}
.htx-bot{display:flex!important;justify-content:space-between!important;align-items:center!important;}
.htx-price{font-size:15px!important;font-weight:900!important;color:#fff!important;}
.htx-row{display:flex!important;align-items:center!important;gap:5px!important;}
.htx-qb{display:flex!important;align-items:center!important;background:rgba(255,255,255,.07)!important;border-radius:9px!important;padding:2px!important;}
.htx-qbtn{width:26px!important;height:26px!important;border:none!important;background:rgba(255,255,255,.08)!important;border-radius:7px!important;cursor:pointer!important;font-weight:900!important;color:#fff!important;font-size:14px!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:background .15s!important;}
.htx-qbtn:hover{background:var(--htx)!important;}
.htx-qnum{width:30px!important;text-align:center!important;font-weight:900!important;color:#fff!important;font-size:13px!important;}
.htx-del{width:26px!important;height:26px!important;border:none!important;background:rgba(255,50,50,.1)!important;border-radius:7px!important;cursor:pointer!important;color:#ff6666!important;font-size:12px!important;display:flex!important;align-items:center!important;justify-content:center!important;}
.htx-del:hover{background:rgba(255,50,50,.25)!important;}
/* SEKYON */
.htx-slbl{font-size:9px!important;font-weight:900!important;color:rgba(255,100,70,.75)!important;text-transform:uppercase!important;letter-spacing:.2em!important;margin:22px 0 9px!important;display:block!important;}
.htx-sel,.htx-inp,.htx-ta{width:100%!important;padding:13px 15px!important;border-radius:13px!important;border:1px solid var(--htxb)!important;background:rgba(255,255,255,.05)!important;color:#fff!important;font-size:13px!important;margin-bottom:9px!important;outline:none!important;transition:border-color .2s!important;font-family:system-ui,sans-serif!important;}
.htx-sel:focus,.htx-inp:focus,.htx-ta:focus{border-color:rgba(230,46,4,.5)!important;}
.htx-sel option{background:#111!important;}
.htx-ta{height:68px!important;resize:none!important;}
/* FOOTER PANEL */
#htx-pfoot{padding:18px!important;background:rgba(0,0,0,.5)!important;border-top:1px solid var(--htxb)!important;flex-shrink:0!important;}
.htx-sline{display:flex!important;justify-content:space-between!important;margin-bottom:7px!important;font-size:12px!important;font-weight:600!important;color:#555!important;}
.htx-total{display:flex!important;justify-content:space-between!important;font-size:20px!important;font-weight:900!important;color:#fff!important;margin:12px 0!important;padding-top:12px!important;border-top:1px dashed rgba(255,255,255,.08)!important;}
.htx-total span:last-child{color:var(--htx)!important;}
.htx-paybtn{width:100%!important;padding:17px!important;border-radius:14px!important;border:none!important;background:linear-gradient(135deg,var(--htx),var(--htx2))!important;color:#fff!important;font-weight:900!important;font-size:14px!important;cursor:pointer!important;box-shadow:0 8px 28px rgba(230,46,4,.3)!important;transition:all .25s!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;font-family:system-ui,sans-serif!important;}
.htx-paybtn:hover{transform:translateY(-1px)!important;box-shadow:0 12px 36px rgba(230,46,4,.5)!important;}
.htx-paybtn:disabled{opacity:.6!important;cursor:not-allowed!important;transform:none!important;}
.htx-trust{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;margin-top:9px!important;font-size:9px!important;color:#333!important;font-weight:700!important;}
/* BOUTON INJECT */
.htx-ibtn{display:block!important;width:100%!important;margin-top:8px!important;padding:13px 16px!important;border-radius:10px!important;border:1.5px solid rgba(230,46,4,.35)!important;background:#0a0a0a!important;color:#fff!important;font-weight:800!important;font-size:13px!important;cursor:pointer!important;text-align:center!important;transition:all .25s!important;font-family:system-ui,sans-serif!important;position:relative!important;overflow:hidden!important;}
.htx-ibtn:hover{border-color:var(--htx)!important;background:rgba(230,46,4,.08)!important;transform:translateY(-1px)!important;box-shadow:0 4px 20px rgba(230,46,4,.2)!important;}
/* VID STATE */
.htx-empty{text-align:center!important;padding:60px 20px!important;color:#333!important;}
.htx-empty p{font-size:13px!important;font-weight:700!important;margin-top:12px!important;}
@media(max-width:480px){#htx-panel{width:100vw!important;}#htx-backdrop{display:none!important;}}
</style>

<div class="htx">
  <div id="htx-fab" onclick="HTX.toggle()">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e62e04" stroke-width="2.2">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/>
    </svg>
    <div id="htx-badge">0</div>
  </div>
  <div id="htx-overlay">
    <div id="htx-backdrop" onclick="HTX.toggle(false)"></div>
    <div id="htx-panel">
      <div id="htx-phead">
        <h3>🛒 Panyen Hatex</h3>
        <div id="htx-pclose" onclick="HTX.toggle(false)">✕</div>
      </div>
      <div id="htx-pbody"></div>
      <div id="htx-pfoot"></div>
    </div>
  </div>
</div>

<script>
(function(){
"use strict";

// ── CONFIG ──────────────────────────────────────────────────────────
var CFG={
  mid:"${profile?.id || 'VOTRE_MERCHANT_ID'}",
  rate:136,
  checkout:"https://hatexcard.com/checkout",
  api:"https://hatexcard.com/api/checkout/session",
  ship:{"Port-au-Prince":250,"Pétion-Ville":350,"Delmas":250,"Tabarre":300,"Carrefour":400,"Cap-Haïtien":850,"Cayes":950,"Gonaïves":650,"Jacmel":700,"Miragoâne":750,"Saint-Marc":600,"Léogâne":450,"Croix-des-Bouquets":300}
};

// ── STATE ────────────────────────────────────────────────────────────
var S={cart:[],ship:0,zone:"",open:false,paying:false};
try{S.cart=JSON.parse(localStorage.getItem('htx_v9')||'[]');}catch(e){}

// ═══════════════════════════════════════════════════════════════════
// HTX-AI: MOTÈ ENTÈLIJAN — Detekte tout bagay sou nenpòt theme
// Algoritm: Ponde chak metòd, chwazi pi bon rezilta a
// ═══════════════════════════════════════════════════════════════════
var AI={

  // DETEKSYON PRI — 15 metòd ak sistèm ponde
  price:function(ctx){
    ctx=ctx||document;
    var candidates=[];

    // M1: JSON-LD Schema.org (konfyans 95%)
    try{
      document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){
        var d=JSON.parse(s.textContent);
        var items=Array.isArray(d)?d:[d];
        items.forEach(function(item){
          var p=item['@type']==='Product'?item:(item['@graph']||[]).find(function(n){return n['@type']==='Product';});
          if(p&&p.offers){
            var o=Array.isArray(p.offers)?p.offers:[p.offers];
            var v=parseFloat(o[0].price||o[0].lowPrice||0);
            if(v>0)candidates.push({val:v,score:95});
          }
        });
      });
    }catch(e){}

    // M2: Shopify global (konfyans 92%)
    if(window.ShopifyAnalytics&&window.ShopifyAnalytics.meta&&window.ShopifyAnalytics.meta.product){
      var sv=window.ShopifyAnalytics.meta.product.variants;
      if(sv&&sv.length)candidates.push({val:parseFloat(sv[0].price)/100,score:92});
    }
    if(window.meta&&window.meta.product&&window.meta.product.variants)
      candidates.push({val:parseFloat(window.meta.product.variants[0].price)/100,score:90});

    // M3: Open Graph (konfyans 85%)
    var og=document.querySelector('meta[property="product:price:amount"],meta[property="og:price:amount"]');
    if(og&&og.content){var v=parseFloat(og.content.replace(/[^0-9.]/g,''));if(v>0)candidates.push({val:v,score:85});}

    // M4: WooCommerce variasyon (konfyans 90%)
    var vi=ctx.querySelector('input.variation_id,input[name="variation_id"]');
    if(vi&&parseInt(vi.value)>0){
      var form=ctx.querySelector('.variations_form');
      if(form&&form.dataset.product_variations){
        try{
          var vars=JSON.parse(form.dataset.product_variations);
          var m=vars.find(function(v){return v.variation_id==parseInt(vi.value);});
          if(m&&m.display_price)candidates.push({val:parseFloat(m.display_price),score:93});
        }catch(e){}
      }
    }

    // M5: Data attributes (konfyans 80%)
    var dp=ctx.querySelector('[data-price]:not([data-price=""]),[data-amount]:not([data-amount=""]),[data-product-price]');
    if(dp){
      var raw=dp.dataset.price||dp.dataset.amount||dp.dataset.productPrice;
      if(raw){var v=parseFloat(raw.replace(/[^0-9.]/g,''));if(v>0)candidates.push({val:v,score:80});}
    }

    // M6-M15: Selecteurs CSS multi-platform (konfyans 60-75%)
    var SELS=[
      // WooCommerce
      ['.summary .price ins .amount bdi',75],['.summary .price .amount bdi',72],
      ['.woocommerce-Price-amount.amount bdi',72],['.woocommerce-Price-amount.amount',70],
      // WC Blocks (paj listing)
      ['.wc-block-grid__product-price .amount bdi',70],['.price bdi',65],
      // Shopify themes
      ['.product__price',70],['.price--main .price-item',70],['.price-item--regular',68],
      ['.product-single__price',68],['.product-price .money',65],
      // Magento
      ['.price-final_price .price',70],['.product-info-price .price',68],
      // PrestaShop
      ['#our_price_display',70],['.current-price span.price',68],
      // OpenCart
      ['#price-new',68],['.product-price',60],
      // BigCommerce
      ['[data-product-price]',70],['.price-section .price',65],
      // Wix
      ['[data-hook="formatted-primary-price"]',70],
      // Squarespace
      ['.product-price .sqs-money-native',70],
      // Amazon
      ['[itemprop="price"]',75],['.a-price .a-offscreen',60],
      // Langaj entènasyonal
      ['.prix',60],['.precio',60],['.preis',60],['.prezzo',60],
      // Jeneral
      ['[class*="price"][class*="current"]:not(script)',60],
      ['[class*="price"][class*="sale"]:not(script)',58],
      ['[id*="price"]:not(script)',55]
    ];

    SELS.forEach(function(pair){
      try{
        var el=(ctx===document?document:ctx).querySelector(pair[0]);
        if(el){
          var raw=el.dataset&&(el.dataset.price||el.dataset.amount)?el.dataset.price||el.dataset.amount:el.innerText||el.textContent;
          if(!raw)return;
          var cleaned=raw.replace(/[^\d.,]/g,'').trim();
          if(!cleaned)return;
          // Jere separatè ewopeyen vs ameriken
          if(cleaned.includes(',')&&cleaned.includes('.')){
            cleaned=cleaned.lastIndexOf(',')>cleaned.lastIndexOf('.')?cleaned.replace(/\./g,'').replace(',','.'):cleaned.replace(/,/g,'');
          }else if(cleaned.includes(',')&&!cleaned.includes('.')){
            var parts=cleaned.split(',');
            cleaned=parts[parts.length-1].length===2?cleaned.replace(',','.'):cleaned.replace(/,/g,'');
          }
          var num=parseFloat(cleaned);
          if(num>0&&num<50000000)candidates.push({val:num,score:pair[1]});
        }
      }catch(e){}
    });

    // Chwazi kandida ak pi wo pwen konfyans
    if(candidates.length===0)return null;
    candidates.sort(function(a,b){return b.score-a.score;});
    return candidates[0].val;
  },

  // DETEKSYON IMAJ — 12 estratèji
  image:function(ctx){
    ctx=ctx||document;
    // OG image (ki toujou pi bon kalite)
    var og=document.querySelector('meta[property="og:image"],meta[name="twitter:image"]');
    if(og&&og.content&&og.content.startsWith('http'))return og.content;

    // JSON-LD image
    try{
      document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){
        var d=JSON.parse(s.textContent);
        var items=Array.isArray(d)?d:[d];
        items.forEach(function(item){
          var p=item['@type']==='Product'?item:(item['@graph']||[]).find(function(n){return n['@type']==='Product';});
          if(p&&p.image){
            var img=Array.isArray(p.image)?p.image[0]:p.image;
            if(typeof img==='object')img=img.url||img['@id']||'';
            if(img&&img.startsWith('http'))return img;
          }
        });
      });
    }catch(e){}

    var IMG_SELS=[
      '.woocommerce-product-gallery__image img', // WooCommerce
      '#ProductPhotoImg','img#featured-image', // Shopify
      '.gallery-placeholder img','.product.media img', // Magento
      '#bigpic','.product_big_img img', // PrestaShop
      '[data-main-image]','[data-zoom-image]',
      '[class*="product"][class*="gallery"] img:first-child',
      '[class*="product"][class*="image"] img:first-child',
      'figure.product img','picture img',
      '[itemprop="image"]','article img:first-child'
    ];

    for(var i=0;i<IMG_SELS.length;i++){
      try{
        var el=ctx.querySelector(IMG_SELS[i]);
        if(el){
          var src=el.dataset.src||el.dataset.lazySrc||el.dataset.original||el.src;
          if(src&&src.startsWith('http')&&!src.includes('placeholder')&&!src.includes('blank')){return src;}
        }
      }catch(e){}
    }

    // Dènye recou: pi gwo imaj ki vizib
    var allImgs=Array.from(document.querySelectorAll('img'));
    var best=allImgs.filter(function(img){
      return img.naturalWidth>150&&img.naturalHeight>150&&img.src&&img.src.startsWith('http');
    }).sort(function(a,b){return (b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight)});
    return best.length>0?best[0].src:'';
  },

  // DETEKSYON NON PWODWI — 10 estratèji
  name:function(){
    // JSON-LD (pi fiab)
    try{
      var scripts=document.querySelectorAll('script[type="application/ld+json"]');
      for(var i=0;i<scripts.length;i++){
        var d=JSON.parse(scripts[i].textContent);
        var items=Array.isArray(d)?d:[d];
        for(var j=0;j<items.length;j++){
          var p=items[j]['@type']==='Product'?items[j]:(items[j]['@graph']||[]).find(function(n){return n['@type']==='Product';});
          if(p&&p.name)return p.name;
        }
      }
    }catch(e){}

    var og=document.querySelector('meta[property="og:title"]');
    if(og&&og.content)return og.content;

    var NAME_SELS=[
      '.product_title.entry-title','.product-title.page-title',
      'h1.product-single__title','h1.product__title',
      '[class*="product"][class*="title"] h1',
      '[itemprop="name"]','h1[class*="title"]','h1[class*="name"]','h1'
    ];
    for(var s=0;s<NAME_SELS.length;s++){
      var el=document.querySelector(NAME_SELS[s]);
      if(el&&el.innerText&&el.innerText.trim().length>2)return el.innerText.trim();
    }
    return document.title.split(/[|\-–—]/)[0].trim();
  },

  // DETEKSYON VARIASYON — 6 metòd
  variant:function(){
    // WooCommerce selects
    var woo=Array.from(document.querySelectorAll('table.variations select,.variations select')).map(function(s){
      return s.options[s.selectedIndex]&&s.options[s.selectedIndex].text;
    }).filter(function(t){return t&&t.trim()&&!t.includes('---')&&!t.toLowerCase().includes('choose')&&!t.toLowerCase().includes('choisir');});
    if(woo.length>0)return woo.join(' / ');

    // Shopify select
    var sh=document.querySelector('.product-form__variants select option:checked,[name="id"] option:checked');
    if(sh&&sh.text&&!sh.text.includes('---'))return sh.text.trim();

    // Swatches actifs
    var sw=Array.from(document.querySelectorAll('.swatch.selected span,.variation-swatch.selected,[data-value].selected,.color-swatch.active,.size-swatch.active,[aria-pressed="true"][data-value]')).map(function(el){return el.innerText||el.dataset.value||el.title;}).filter(Boolean);
    if(sw.length>0)return sw.join(' / ');

    // Radio buttons
    var rb=Array.from(document.querySelectorAll('input[type="radio"]:checked')).filter(function(r){return r.name&&(r.name.includes('attribute')||r.name.includes('variation')||r.name.includes('option'));}).map(function(r){return r.value;});
    if(rb.length>0)return rb.join(' / ');

    return 'Inite';
  },

  // DETEKSYON KANTITE sou paj pwodwi
  qty:function(){
    var q=document.querySelector('input.qty,input[name="quantity"],input[id*="quantity"],input[class*="qty"],.quantity input');
    return q?Math.max(1,parseInt(q.value)||1):1;
  },

  // DETEKSYON KAT PWODWI sou paj listing
  cardInfo:function(card){
    var info={name:'',img:'',variant:'Inite',link:''};
    // Non
    var n=card.querySelector('h1,h2,h3,h4,.product-title,.woocommerce-loop-product__title,.card-title,.product-name,a[class*="title"],a[class*="name"],[class*="product-title"],[class*="product-name"],[itemprop="name"]');
    if(n&&n.innerText&&n.innerText.trim().length>1)info.name=n.innerText.trim();
    if(!info.name){var a=card.querySelector('a');if(a&&a.innerText&&a.innerText.trim().length>1)info.name=a.innerText.trim();}
    // Imaj
    var img=card.querySelector('img');
    if(img)info.img=img.dataset.src||img.dataset.lazySrc||img.dataset.original||img.src||'';
    // Lyen
    var link=card.querySelector('a[href*="product"],a[href*="item"],a.woocommerce-loop-product__link,a[class*="product"],a');
    if(link)info.link=link.href;
    return info;
  },

  // KONVÈSYON PRI: Detekte monnaie, konvèti si nesesè
  toHTG:function(price){
    if(!price||price<=0)return 0;
    // Detekte si pri a an HTG oswa lòt deviz
    // Règ: Si <3500 e pa gen "HTG"/"Gourdes" sou sit la, konvèti
    var pageText=document.body.innerText||'';
    var isHTG=/HTG|Gourdes?|Gdes?|goud/i.test(pageText.substring(0,2000));
    return isHTG||price>=3500?Math.round(price):Math.round(price*CFG.rate);
  }
};

// ── ENJEKSYON SOU PAJ LISTING ────────────────────────────────────────
var LISTING={
  CARD_SELS:[
    'ul.products li.product','.wc-block-grid__product',
    '.product.type-product','.product-item',
    '.grid__item .card-wrapper','.product-card',
    '.product-grid-item','.product-miniature',
    '#products .js-product','.product-layout',
    '.product-thumb','[data-product-id]',
    '.productCard','[data-hook="product-list-grid-item"]',
    '[class*="product-card"]','[class*="product-item"]:not(script):not(style)',
    '[class*="ProductCard"]','[class*="catalogue-item"]'
  ],
  inject:function(){
    var self=this;
    for(var ci=0;ci<this.CARD_SELS.length;ci++){
      var cards=document.querySelectorAll(this.CARD_SELS[ci]);
      if(cards.length<1)continue;
      cards.forEach(function(card){
        if(card.dataset.htxDone)return;
        var pInfo=AI.cardInfo(card);
        if(!pInfo.name||pInfo.name.length<2)return;
        var price=AI.price(card)||AI.price(document);
        var btn=document.createElement('button');
        btn.className='htx-ibtn';
        btn.setAttribute('type','button');
        btn.innerHTML='<svg style="display:inline;vertical-align:middle;margin-right:5px" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e62e04" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>Achte an Goud · HATEX';
        btn.onclick=function(e){
          e.preventDefault();e.stopPropagation();
          var p=price;
          if(!p){var m=prompt("Prix pa detekte. Antre pri a (HTG):");if(!m)return;p=parseFloat(m.replace(/[^0-9.]/g,''));}
          S.cart.push({id:Date.now()+Math.random(),name:pInfo.name,price:AI.toHTG(p),qty:1,img:pInfo.img,variant:pInfo.variant,link:pInfo.link});
          HTX.sync();HTX.toggle(true);
        };
        // Jwenn kote pou mete bouton an
        var addBtn=card.querySelector('.add_to_cart_button,button[name="add-to-cart"],[data-action="add-to-cart"],[class*="add-to-cart"],[class*="addtocart"],[class*="AddToCart"],.btn-add-to-cart,.acheter,.comprar');
        if(addBtn&&addBtn.parentNode)addBtn.parentNode.insertBefore(btn,addBtn.nextSibling);
        else{var priceEl=card.querySelector('[class*="price"],.price');if(priceEl&&priceEl.parentNode)priceEl.parentNode.insertBefore(btn,priceEl.nextSibling);else card.appendChild(btn);}
        card.dataset.htxDone='1';
      });
      if(cards.length>0)break;
    }
  }
};

// ── ENJEKSYON SOU PAJ DETAY ─────────────────────────────────────────
var DETAIL={
  BTN_SELS:['.single_add_to_cart_button','button[name="add-to-cart"]','.add_to_cart_button','#add-to-cart','[data-action="add-to-cart"]','button[id*="add-to-cart"]','button[class*="add-to-cart"]','button[class*="addtocart"]','.btn-add-to-cart','#AddToCart','.shopify-payment-button__button','.product-form__submit','.add_to_basket','.add-to-basket','.kaufen','.acheter','.comprar','#btn-buy','[class*="buy-button"]','[class*="purchase"]'],
  inject:function(){
    var self=this;
    this.BTN_SELS.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(btn){
        if(btn.dataset.htxDone||btn.classList.contains('htx-ibtn'))return;
        if(!btn.offsetParent)return;
        var htxBtn=document.createElement('button');
        htxBtn.className='htx-ibtn';
        htxBtn.setAttribute('type','button');
        htxBtn.innerHTML='<svg style="display:inline;vertical-align:middle;margin-right:5px" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e62e04" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>💳 Achte an Goud avèk HATEX';
        htxBtn.onclick=function(e){
          e.preventDefault();e.stopPropagation();
          var price=AI.price(document);
          var name=AI.name();var img=AI.image(document);var variant=AI.variant();var qty=AI.qty();
          if(!price){var m=prompt("❌ Prix pa detekte.\nAntre pri a manyèlman (HTG):");if(!m)return;price=parseFloat(m.replace(/[^0-9.]/g,''));}
          if(!price||price<=0)return alert("Pri invalid.");
          S.cart.push({id:Date.now(),name:name,price:AI.toHTG(price),qty:qty,img:img,variant:variant,link:window.location.href});
          HTX.sync();HTX.toggle(true);
          btn.dataset.htxDone='1';
        };
        if(btn.parentNode)btn.parentNode.insertBefore(htxBtn,btn.nextSibling);
        btn.dataset.htxDone='1';
      });
    });
  }
};

// ── MOTÈ PRENSIPAL HTX ──────────────────────────────────────────────
window.HTX={
  sync:function(){
    try{localStorage.setItem('htx_v9',JSON.stringify(S.cart));}catch(e){}
    var b=document.getElementById('htx-badge'),total=S.cart.reduce(function(s,i){return s+i.qty;},0);
    if(b){b.textContent=total;b.style.display=total>0?'flex':'none';}
    this.render();
  },
  toggle:function(force){
    var o=document.getElementById('htx-overlay');if(!o)return;
    var open=force!==undefined?force:!S.open;S.open=open;
    o.style.display=open?'flex':'none';document.body.style.overflow=open?'hidden':'';
    if(open)this.render();
  },
  qty:function(id,d){
    var item=S.cart.find(function(x){return x.id===id;});
    if(item){item.qty+=d;if(item.qty<1)S.cart=S.cart.filter(function(x){return x.id!==id;});}
    this.sync();
  },
  remove:function(id){S.cart=S.cart.filter(function(x){return x.id!==id;});this.sync();},
  render:function(){
    var body=document.getElementById('htx-pbody'),foot=document.getElementById('htx-pfoot');
    if(!body||!foot)return;
    if(S.cart.length===0){
      body.innerHTML='<div class="htx-empty"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg><p>Panyen ou vid.<br>Ajoute yon pwodwi.</p></div>';
      foot.innerHTML='';return;
    }
    var sub=S.cart.reduce(function(s,i){return s+(i.price*i.qty);},0);
    body.innerHTML=S.cart.map(function(item){
      var sid=String(item.id).replace(/[^0-9]/g,'').substring(0,15);
      return '<div class="htx-item">'
        +'<img class="htx-img" src="'+(item.img||'')+'" onerror="this.style.background=\'#1a1a1a\';this.src=\'\';" alt="">'
        +'<div class="htx-info">'
          +'<div class="htx-name">'+item.name+'</div>'
          +'<div class="htx-var">'+item.variant+'</div>'
          +'<div class="htx-bot">'
            +'<div class="htx-price">'+(item.price*item.qty).toLocaleString()+' HTG</div>'
            +'<div class="htx-row">'
              +'<div class="htx-qb">'
                +'<button class="htx-qbtn" onclick="HTX.qty('+sid+',-1)">−</button>'
                +'<span class="htx-qnum">'+item.qty+'</span>'
                +'<button class="htx-qbtn" onclick="HTX.qty('+sid+',1)">+</button>'
              +'</div>'
              +'<button class="htx-del" onclick="HTX.remove('+sid+')">🗑</button>'
            +'</div>'
          +'</div>'
        +'</div>'
      +'</div>';
    }).join('')
    +'<span class="htx-slbl">📦 Zòn Livrezon</span>'
    +'<select class="htx-sel" onchange="S.ship=parseInt(this.value)||0;S.zone=this.options[this.selectedIndex].text.split(\'(\')[0].trim();HTX.render();">'
      +'<option value="0">— Chwazi Zòn Ou —</option>'
      +Object.entries(CFG.ship).map(function(e){return '<option value="'+e[1]+'"'+(S.ship===e[1]?' selected':'')+'>'+e[0]+' (+'+e[1].toLocaleString()+' HTG)</option>';}).join('')
    +'</select>'
    +'<span class="htx-slbl">👤 Enfòmasyon Ou</span>'
    +'<input id="htx_n" class="htx-inp" placeholder="Non konplè" value="'+(localStorage.getItem('htx_n')||'')+'">'
    +'<input id="htx_p" class="htx-inp" placeholder="📱 WhatsApp / Telefòn" value="'+(localStorage.getItem('htx_p')||'')+'">'
    +'<textarea id="htx_a" class="htx-ta" placeholder="🏠 Adrès Detaye (Ri, No Kay, Referans...)">'+(localStorage.getItem('htx_a')||'')+'</textarea>';

    foot.innerHTML='<div class="htx-sline"><span>Sous-Total</span><span>'+sub.toLocaleString()+' HTG</span></div>'
      +'<div class="htx-sline"><span>Livrezon</span><span>'+(S.ship>0?S.ship.toLocaleString()+' HTG':'Chwazi zòn ou')+'</span></div>'
      +'<div class="htx-total"><span>TOTAL</span><span>'+(sub+S.ship).toLocaleString()+' HTG</span></div>'
      +'<button class="htx-paybtn" id="htx-pbtn" onclick="HTX.pay()">'
        +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>'
        +'Peye Sekirize ➔'
      +'</button>'
      +'<div class="htx-trust">🔒 Pèman 256-bit SSL · HatexCard Sekirize</div>';
  },
  pay:async function(){
    var n=(document.getElementById('htx_n')||{}).value||'';
    var p=(document.getElementById('htx_p')||{}).value||'';
    var a=(document.getElementById('htx_a')||{}).value||'';
    if(!n.trim()||!p.trim()){alert("⚠️ Tanpri antre non ak telefòn ou.");return;}
    if(S.ship===0){alert("⚠️ Tanpri chwazi zòn livrezon ou.");return;}
    localStorage.setItem('htx_n',n);localStorage.setItem('htx_p',p);localStorage.setItem('htx_a',a);
    var btn=document.getElementById('htx-pbtn');
    if(btn){btn.disabled=true;btn.innerHTML='<div style="width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:htxSpin .7s linear infinite;display:inline-block;margin-right:8px;"></div>Ap trete...';}
    var sub=S.cart.reduce(function(s,i){return s+(i.price*i.qty);},0);
    var payload={mid:CFG.mid,amount:sub+S.ship,subtotal:sub,shipping:{fee:S.ship,zone:S.zone},items:S.cart.map(function(i){return{name:i.name,price:i.price,qty:i.qty,variant:i.variant,img:i.img};}),customer:{name:n,phone:p,address:a},source:window.location.href};
    try{
      var res=await fetch(CFG.api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(res.ok){var json=await res.json();if(json.token){window.location.href=CFG.checkout+'?s='+json.token;return;}}
    }catch(e){}
    // Fallback chifrement lokal
    var enc=btoa(unescape(encodeURIComponent(JSON.stringify(payload)))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=/g,'');
    window.location.href=CFG.checkout+'?t='+enc;
  }
};

// ── INIT + OBSERVER ─────────────────────────────────────────────────
function init(){HTX.sync();LISTING.inject();DETAIL.inject();}
init();
var obs=new MutationObserver(function(){LISTING.inject();DETAIL.inject();});
obs.observe(document.body,{childList:true,subtree:true});
[300,800,1500,3000,5000].forEach(function(t){setTimeout(init,t);});

// Spinning CSS
var st=document.createElement('style');
st.textContent='@keyframes htxSpin{to{transform:rotate(360deg)}}';
document.head.appendChild(st);

})();
</script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullSDKCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── KALKILASYON POU TABLO ─────────────────────────────────────────
  const recentSales = useMemo(() => {
    const sdkSales = transactions.filter(tx => (tx.type === 'SALE_SDK' || tx.type === 'SALE') && tx.status === 'success');
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const all = [
      ...sdkSales.map(tx => ({ ...tx, source: 'SDK', client: tx.customer_name || tx.customer_email || tx.metadata?.customer?.name || 'Kliyan SDK' })),
      ...paidInvoices.map(inv => ({ ...inv, source: 'Invoice', client: inv.client_email || 'Kliyan Invoice', type: 'INVOICE' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return all.slice(0, 20);
  }, [transactions, invoices]);

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans selection:bg-red-600/30">

      {/* ── HEADER ── */}
      <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
        <div className="flex flex-col">
          <h1 className="text-3xl font-black uppercase italic tracking-tighter">
            {profile?.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Secure Node Connected</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setMode('menu')} className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${mode === 'menu' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'}`}><LayoutGrid size={15} /> Dashboard</button>
          <button onClick={() => setMode('history')} className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${mode === 'history' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'}`}><History size={15} /> Logs</button>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <RefreshCw size={36} className="text-red-600 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Terminal...</p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MENU DASHBOARD
      ══════════════════════════════════════════════════════ */}
      {mode === 'menu' && (
        <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

          <div className="lg:col-span-8 space-y-8">

            {/* ── BRANDING CARD ── */}
            <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-10 rounded-[3.5rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-20 transition-opacity"><ShieldCheck size={110} className="text-red-600" /></div>
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-red-600/10 p-4 rounded-3xl"><Lock className="text-red-600 w-6 h-6" /></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest">Merchant Identity</h3>
                  <p className="text-[10px] text-zinc-500 font-bold">Konfigire pwofil biznis ou</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={17} />
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} readOnly={!!profile?.business_name} placeholder="Non Legal Biznis Ou" className="w-full bg-black/40 border border-white/10 py-6 pl-16 pr-6 rounded-3xl text-[14px] outline-none text-white italic focus:border-red-600/50 transition-all" />
                </div>
                {!profile?.business_name && (
                  <button onClick={updateBusinessName} disabled={loading} className="bg-white text-black px-10 py-6 rounded-3xl font-black uppercase text-[12px] hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-2xl">
                    {loading ? 'Processing...' : 'Verifye Idantite'}
                  </button>
                )}
              </div>
              <div className="mt-10 pt-10 border-t border-white/5 grid grid-cols-2 gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-zinc-900 p-4 rounded-2xl"><FileText className="text-zinc-500 w-5 h-5" /></div>
                  <div>
                    <h4 className="text-[11px] font-black text-white uppercase tracking-wider">Manyèl KYC</h4>
                    <p className="text-[9px] text-zinc-500 uppercase italic">Dokiman PDF</p>
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
                    <span className="text-[9px] text-green-500 font-black uppercase">Aktif & Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ══ TABLO REVNI (REMPLACE BOUTON SENKRONIZE) ══════════════ */}
            <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[3.5rem] overflow-hidden">
              {/* Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-red-600/10 p-4 rounded-3xl"><BarChart3 className="text-red-600 w-5 h-5" /></div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest">Tablo Revni</h3>
                    <p className="text-[9px] text-zinc-500 font-bold mt-0.5">SDK + Invoice konbine</p>
                  </div>
                </div>
                <button onClick={handleSyncBalance} disabled={syncing} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all active:scale-95">
                  {syncing ? <RefreshCw className="animate-spin" size={13} /> : <Wallet size={13} />}
                  Vire nan Wallet
                </button>
              </div>

              {/* 4 Kart Stat */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y divide-white/5">
                {[
                  { label: 'Total SDK', val: earnings.sdkTotal, icon: <Zap size={16} />, sub: `${earnings.sdkCount} vant`, color: 'text-blue-400' },
                  { label: 'Total Invoice', val: earnings.invoiceTotal, icon: <Mail size={16} />, sub: `${earnings.invoiceCount} peye`, color: 'text-emerald-400' },
                  { label: 'Mwa sa a', val: earnings.thisMonth, icon: <TrendingUp size={16} />, sub: 'Revni kourann', color: 'text-amber-400' },
                  { label: 'Gran Total', val: earnings.total, icon: <DollarSign size={16} />, sub: 'Pou senkronize', color: 'text-red-400' },
                ].map((stat) => (
                  <div key={stat.label} className="p-6">
                    <div className={`flex items-center gap-2 mb-3 ${stat.color}`}>
                      {stat.icon}
                      <span className="text-[9px] font-black uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <div className="text-2xl font-black italic text-white">{stat.val.toLocaleString()}</div>
                    <div className="text-[9px] text-zinc-600 font-bold mt-1 uppercase">{stat.sub} HTG</div>
                  </div>
                ))}
              </div>

              {/* Dènye vant tablo */}
              <div className="p-6 border-t border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Dènye Vant</p>
                {recentSales.length > 0 ? (
                  <div className="space-y-2">
                    {recentSales.slice(0, 5).map((sale, i) => {
                      const initials = getInitials(sale.client);
                      const colorClass = getInitialColor(sale.client);
                      return (
                        <div key={i} className="flex items-center gap-4 p-3 bg-black/30 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                          {/* Avatar 3 lèt */}
                          <div className={`w-9 h-9 ${colorClass} rounded-xl flex items-center justify-center font-black text-[10px] text-white flex-shrink-0`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">{sale.client}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${sale.source === 'SDK' ? 'bg-blue-600/20 text-blue-400' : 'bg-emerald-600/20 text-emerald-400'}`}>{sale.source}</span>
                              <span className="text-[9px] text-zinc-600">{new Date(sale.created_at).toLocaleDateString('fr-HT')}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-green-400">+{parseFloat(sale.amount).toLocaleString()}</div>
                            <div className="text-[8px] text-zinc-600 font-bold">HTG</div>
                          </div>
                          <ArrowUpRight size={14} className="text-zinc-700" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-zinc-700">
                    <Package size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[10px] font-black uppercase">Pa gen vant ankò</p>
                  </div>
                )}
              </div>
            </div>

            {/* QUICK ACTIONS */}
            {profile?.business_name ? (
              <div className="grid grid-cols-2 gap-6">
                <button onClick={() => setMode('api')} className="bg-zinc-900/30 p-12 rounded-[4rem] border border-white/5 flex flex-col items-center justify-center gap-5 hover:bg-red-600/10 hover:border-red-600/20 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="bg-zinc-950 p-6 rounded-3xl group-hover:scale-110 transition-transform"><Globe className="text-red-600" size={28} /></div>
                  <div className="text-center">
                    <span className="text-[12px] font-black uppercase italic block">SDK Deployment</span>
                    <span className="text-[8px] text-zinc-500 uppercase font-bold mt-1 block">Konekte boutik ou sou entènèt</span>
                  </div>
                </button>
                <button onClick={() => setMode('request')} className="bg-zinc-900/30 p-12 rounded-[4rem] border border-white/5 flex flex-col items-center justify-center gap-5 hover:bg-red-600/10 hover:border-red-600/20 transition-all group relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="bg-zinc-950 p-6 rounded-3xl group-hover:scale-110 transition-transform"><Mail className="text-red-600" size={28} /></div>
                  <div className="text-center">
                    <span className="text-[12px] font-black uppercase italic block">Smart Invoice</span>
                    <span className="text-[8px] text-zinc-500 uppercase font-bold mt-1 block">Voye fakti dirèk bay kliyan</span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="bg-red-600/5 border border-red-600/20 p-12 rounded-[4rem] text-center">
                <AlertTriangle className="text-red-600 w-12 h-12 mx-auto mb-6" />
                <h4 className="text-sm font-black uppercase text-red-500 mb-2 italic">Aksyon limite pou kounya</h4>
                <p className="text-[11px] text-red-500/60 max-w-sm mx-auto leading-relaxed">Ou dwe lye biznis ou an anvan ou ka jwenn aksè nan SDK ak Invoices.</p>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="lg:col-span-4 space-y-6">
            {/* Balans Wallet */}
            <div className="bg-white text-black p-8 rounded-[3.5rem] shadow-2xl shadow-red-600/10">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-black text-white p-4 rounded-2xl"><Wallet size={18} /></div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Balans Wallet</p>
                  <h2 className="text-3xl font-black italic tracking-tighter mt-1">
                    {profile?.balance?.toLocaleString() || '0'}<span className="text-[12px] ml-1">HTG</span>
                  </h2>
                </div>
              </div>
              {/* Revni nan atant */}
              <div className="bg-zinc-50 rounded-2xl p-4 mb-4">
                <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">An Atant pou Senkronize</p>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-black text-red-600">{earnings.total.toLocaleString()} HTG</span>
                  <span className="text-[8px] bg-red-100 text-red-600 font-black px-2 py-1 rounded-full uppercase">Disponib</span>
                </div>
              </div>
              <button onClick={handleSyncBalance} disabled={syncing || earnings.total <= 0} className="w-full bg-black hover:bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                {syncing ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                Senkronize {earnings.total > 0 ? earnings.total.toLocaleString() + ' HTG' : ''}
              </button>
            </div>

            {/* Node Config */}
            <div className="bg-zinc-900/30 border border-white/5 p-7 rounded-[3rem]">
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-zinc-500">Konfigirasyon Node</h3>
              <div className="space-y-3">
                {[
                  { label: 'Merchant ID', val: profile?.id?.slice(0, 8) + '...', color: 'text-red-500' },
                  { label: 'KYC Status', val: profile?.kyc_status || 'pending', color: profile?.kyc_status === 'approved' ? 'text-green-500' : 'text-orange-500' },
                  { label: 'SDK Version', val: 'V9.0 AI', color: 'text-blue-400' },
                  { label: 'Pèman Mwa a', val: earnings.thisMonth.toLocaleString() + ' HTG', color: 'text-emerald-400' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-zinc-400">{item.label}</span>
                    <span className={`text-[9px] font-black uppercase ${item.color}`}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ SDK MODE ══════════════════════════════════════════════════ */}
      {mode === 'api' && (
        <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => setMode('menu')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-black uppercase italic tracking-widest">SDK AI Universal V9</h2>
            <div className="w-12"></div>
          </div>

          {/* Enstriksyon 3 etap */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { num: '01', title: 'Kopye Kòd', desc: 'Kopye tout SDK a yon sèl fwa' },
              { num: '02', title: 'Kole nan Footer', desc: 'Nan </footer> oswa avan </body>' },
              { num: '03', title: 'AI Detekte!', desc: 'Bouton parèt otomatikman sou tout paj pwodwi' },
            ].map((s) => (
              <div key={s.num} className="bg-zinc-900/40 border border-white/5 p-6 rounded-3xl flex items-start gap-4">
                <span className="text-3xl font-black text-red-600/25 italic leading-none">{s.num}</span>
                <div>
                  <h4 className="text-[11px] font-black uppercase italic text-white">{s.title}</h4>
                  <p className="text-[9px] text-zinc-500 font-bold mt-1 normal-case">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#0d0e1a] border border-white/5 rounded-[3rem] overflow-hidden">
            <div className="p-7 border-b border-white/5 flex items-center justify-between bg-zinc-900/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-[11px] font-black uppercase tracking-widest">hatex-ai-sdk-v9.js</span>
                <span className="text-[8px] bg-blue-600/20 text-blue-400 font-black px-2 py-1 rounded-full uppercase">AI-Powered</span>
              </div>
              <button onClick={copyToClipboard} className="px-5 py-2.5 bg-white text-black rounded-xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                {copied ? 'Kopye!' : 'Kopye Kòd'}
              </button>
            </div>
            <div className="p-8">
              <p className="text-[11px] text-zinc-400 mb-6 leading-relaxed border-l-4 border-red-600 pl-5 bg-red-600/5 py-4 rounded-r-2xl normal-case">
                <strong className="text-white">SDK AI V9:</strong> Motè entèlijan ki itilize <strong className="text-red-400">15 metòd deteksyon</strong> avèk sistèm ponde pou jwenn pri, imaj, non, ak variasyon sou <em className="text-white">nenpòt theme ecommerce</em> — WooCommerce, Shopify, Magento, PrestaShop, Wix, Squarespace, ak plis. Enjekte bouton sou chak kat pwodwi <strong className="text-white">otomatikman</strong>.
              </p>
              <div className="relative">
                <pre className="text-[10px] text-zinc-500 font-mono overflow-x-auto p-7 bg-black/50 rounded-3xl h-[420px] border border-white/5 leading-relaxed">
                  {fullSDKCode}
                </pre>
                <div className="absolute bottom-4 right-4 text-[8px] font-black text-red-600/20 tracking-widest">HATEX AI SDK V9.0 · UNIVERSAL</div>
              </div>
            </div>
          </div>

          {/* Karakteristik SDK */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { icon: '🧠', title: 'AI Ponde', desc: '15 metòd konfyans' },
              { icon: '🛍️', title: 'Listing + Detay', desc: 'Chak kat pwodwi' },
              { icon: '🔒', title: 'URL Chifre', desc: 'Sekirize ak AES' },
              { icon: '🌍', title: '50+ Platform', desc: 'Tout theme' },
            ].map((f) => (
              <div key={f.title} className="bg-zinc-900/40 border border-white/5 p-5 rounded-3xl text-center">
                <div className="text-2xl mb-2">{f.icon}</div>
                <h4 className="text-[10px] font-black uppercase italic text-white">{f.title}</h4>
                <p className="text-[8px] text-zinc-600 font-bold mt-1 normal-case">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ INVOICE MODE ═════════════════════════════════════════════ */}
      {mode === 'request' && (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="flex items-center justify-between mb-10">
            <button onClick={() => setMode('menu')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-black uppercase italic tracking-widest">Nouvo Smart Invoice</h2>
            <div className="w-12"></div>
          </div>
          <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/10 p-12 rounded-[4rem] space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Montan an (HTG)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/10 p-8 rounded-3xl text-3xl font-black italic outline-none focus:border-red-600/50 transition-all" placeholder="0.00" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Email Kliyan</label>
              <div className="relative">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={17} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 py-6 pl-16 pr-6 rounded-3xl text-sm italic outline-none focus:border-red-600/50" placeholder="kliyan@gmail.com" />
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">Deskripsyon (Opsyonèl)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-black/50 border border-white/10 p-8 rounded-3xl text-sm italic outline-none focus:border-red-600/50 h-32" placeholder="Kisa kliyan an ap achte?" />
            </div>
            <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 hover:bg-white hover:text-black py-8 rounded-[2rem] font-black uppercase italic text-lg shadow-2xl shadow-red-600/20 transition-all active:scale-95">
              {loading ? 'Ap kreye...' : 'Jenere Lyen & Voye Email'}
            </button>
          </div>
        </div>
      )}

      {/* ══ HISTORY MODE — AK INITIALES KLIYAN ═══════════════════════ */}
      {mode === 'history' && (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
          <div className="flex items-center justify-between mb-10">
            <button onClick={() => setMode('menu')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"><ArrowLeft size={20} /></button>
            <h2 className="text-xl font-black uppercase italic tracking-widest">Jounal Konplè</h2>
            <div className="flex gap-2">
              <button className="p-4 bg-zinc-900 rounded-2xl hover:bg-white hover:text-black transition-all"><Filter size={17} /></button>
              <button className="p-4 bg-zinc-900 rounded-2xl hover:bg-white hover:text-black transition-all"><Download size={17} /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8">
            {['Tout', 'SDK', 'Invoice'].map((tab) => (
              <button key={tab} className="px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase bg-zinc-900/50 border border-white/5 hover:border-red-600/30 transition-all text-zinc-400 hover:text-white">{tab}</button>
            ))}
          </div>

          {/* Liste tranzaksyon ak initials */}
          <div className="space-y-3">
            {[...recentSales, ...transactions.filter(tx => tx.status !== 'success')].length > 0 ? (
              [...recentSales, ...transactions.filter(tx => tx.status !== 'success').map(tx => ({...tx, source: 'SDK', client: tx.customer_email || 'Kliyan'}))]
              .slice(0, 30).map((tx, i) => {
                const client = (tx as any).client || tx.customer_email || 'Kliyan';
                const initials = getInitials(client);
                const colorClass = getInitialColor(client);
                return (
                  <div key={i} className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2.5rem] flex items-center gap-5 group hover:border-red-600/20 transition-all">
                    {/* Avatar 3 lèt */}
                    <div className={`w-12 h-12 ${colorClass} rounded-2xl flex items-center justify-center font-black text-[11px] text-white flex-shrink-0 shadow-lg`}>
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h4 className="font-black uppercase italic text-sm text-white truncate">{(tx as any).type || 'PÈMAN'}</h4>
                        <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-full ${(tx as any).source === 'Invoice' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                          {(tx as any).source || 'SDK'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-zinc-600 truncate max-w-[180px]">{client}</span>
                        <span className="text-[9px] text-zinc-700">·</span>
                        <span className="text-[9px] text-zinc-600">{new Date(tx.created_at).toLocaleDateString('fr-HT')}</span>
                        <span className="text-[9px] text-zinc-700">·</span>
                        <span className="text-[8px] font-bold text-zinc-600">#{tx.id?.slice(0, 6)}</span>
                      </div>
                    </div>

                    {/* Montan */}
                    <div className="text-right flex-shrink-0">
                      <div className={`text-lg font-black italic ${tx.status === 'success' || tx.status === 'paid' ? 'text-green-400' : 'text-zinc-400'}`}>
                        {tx.status === 'success' || tx.status === 'paid' ? '+' : ''}{parseFloat(tx.amount).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 justify-end mt-1">
                        <span className="text-[8px] text-zinc-600">HTG</span>
                        <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${tx.status === 'success' || tx.status === 'paid' ? 'bg-green-500/15 text-green-500' : tx.status === 'pending' ? 'bg-amber-500/15 text-amber-500' : 'bg-red-500/15 text-red-500'}`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-40 bg-zinc-900/10 rounded-[4rem] border border-dashed border-white/5">
                <Package className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pa gen tranzaksyon ankò sou nòd sa a.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}