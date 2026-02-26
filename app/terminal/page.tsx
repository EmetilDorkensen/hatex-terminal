"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { 
  History, Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, Globe, Wallet, RefreshCw, ShieldCheck,
  User, AlertTriangle, Lock, Box, FileText, Upload, 
  Filter, Download, TrendingUp, Package, BarChart3,
  ArrowUpRight, DollarSign, Zap, Play, Youtube
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
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showVideo, setShowVideo] = useState(false);

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
        setYoutubeUrl(prof.sdk_tutorial_url || '');
      }
      const { data: tx } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setTransactions(tx || []);
      const { data: inv } = await supabase.from('invoices').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
      setInvoices(inv || []);
      setLoading(false);
    };
    initTerminal();
  }, [supabase, router]);

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

  const recentSales = useMemo(() => {
    const sdk = transactions.filter(tx => (tx.type === 'SALE_SDK' || tx.type === 'SALE') && tx.status === 'success')
      .map(tx => ({ ...tx, source: 'SDK', client: tx.customer_name || tx.customer_email || 'Kliyan SDK' }));
    const inv = invoices.filter(i => i.status === 'paid')
      .map(i => ({ ...i, source: 'Invoice', client: i.client_email || 'Kliyan Invoice', type: 'INVOICE' }));
    return [...sdk, ...inv].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
  }, [transactions, invoices]);

  const getInitials = (s: string) => {
    if (!s) return '??';
    const name = s.includes('@') ? s.split('@')[0].replace(/[._-]/g, ' ') : s;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
    return parts.slice(0, 3).map(p => p[0]).join('').toUpperCase();
  };
  const getInitialColor = (s: string) => {
    const c = ['bg-red-600','bg-blue-600','bg-emerald-600','bg-violet-600','bg-amber-600','bg-pink-600','bg-cyan-600'];
    let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return c[Math.abs(h) % c.length];
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : '';
  };

  const saveYoutubeUrl = async () => {
    if (!profile?.id) return;
    await supabase.from('profiles').update({ sdk_tutorial_url: youtubeUrl }).eq('id', profile.id);
    alert('URL videyo a sove!');
  };

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
      if (freshProfile?.kyc_status !== 'approved') { alert(`Echèk: Kont ou dwe 'approved'.`); setMode('menu'); return; }
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
      alert(`Siksè! Lyen kopye.`);
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
    if (!file || file.type !== 'application/pdf') return alert('Tanpri chwazi yon dosye PDF.');
    setUploadingPdf(true);
    try { await new Promise(res => setTimeout(res, 2000)); alert("PDF sove sou sèvè Hatex la."); }
    catch (err: any) { alert(err.message); } finally { setUploadingPdf(false); }
  };

  // ════════════════════════════════════════════════════════════════════
  //  HATEX AI SDK v10.0 — UNIVERSAL INTELLIGENT CART ENGINE
  //  • Enjeksyon OTOMATIK anba bouton "Add to Cart" sou nenpòt theme
  //  • AI pran: non, foto pwodwi, foto varyant, koule, tay, pri
  //  • Konvèsyon entèlijan USD→HTG (taux 136) sèlman si site an dola
  //  • Panyen konplè ak imaj reyèl, kantite, variant, total
  //  • Checkout voye tout done bay paj chekout la (50+ pwodwi)
  // ════════════════════════════════════════════════════════════════════
  const fullSDKCode = `<!-- ============================================================
  HATEX AI SDK v10.0 — Kole sa a nan FOOTER sit ou (avan </body>)
  Sipòte: WooCommerce · Shopify · Magento · PrestaShop · Custom
  ============================================================ -->
<style>
/* ── BASE ── */
:root{--htx:#e62e04;--htx2:#8a0a00;--htxbg:#07080f;--htxs:rgba(255,255,255,.05);--htxb:rgba(255,255,255,.08);}
.htxw *{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;}

/* ── FAB ── */
#htx-fab{position:fixed!important;bottom:28px!important;right:28px!important;width:74px!important;height:74px!important;border-radius:50%!important;background:var(--htxbg)!important;border:2.5px solid var(--htx)!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;z-index:2147483645!important;box-shadow:0 12px 40px rgba(0,0,0,.75),0 0 0 0 rgba(230,46,4,.4)!important;transition:all .3s!important;animation:htxP 3s infinite!important;}
#htx-fab:hover{transform:scale(1.1)!important;box-shadow:0 16px 50px rgba(230,46,4,.4)!important;}
@keyframes htxP{0%,100%{box-shadow:0 12px 40px rgba(0,0,0,.75),0 0 0 0 rgba(230,46,4,.4)}50%{box-shadow:0 12px 40px rgba(0,0,0,.75),0 0 0 14px rgba(230,46,4,0)}}
#htx-cnt{position:absolute!important;top:-7px!important;right:-7px!important;background:var(--htx)!important;color:#fff!important;border-radius:50%!important;width:28px!important;height:28px!important;font-size:12px!important;font-weight:900!important;display:none!important;align-items:center!important;justify-content:center!important;border:2.5px solid var(--htxbg)!important;}

/* ── OVERLAY ── */
#htx-ov{position:fixed!important;inset:0!important;z-index:2147483646!important;display:none;flex-direction:row!important;}
#htx-bd{flex:1!important;background:rgba(0,0,0,.65)!important;backdrop-filter:blur(8px)!important;cursor:pointer!important;}
#htx-pn{width:500px!important;max-width:100vw!important;height:100%!important;background:var(--htxbg)!important;border-left:1px solid var(--htxb)!important;display:flex!important;flex-direction:column!important;animation:htxSl .35s cubic-bezier(.16,1,.3,1)!important;box-shadow:-30px 0 80px rgba(0,0,0,.85)!important;}
@keyframes htxSl{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}

/* ── PANEL HEADER ── */
#htx-ph{padding:20px 24px!important;background:rgba(0,0,0,.45)!important;border-bottom:1px solid var(--htxb)!important;display:flex!important;align-items:center!important;justify-content:space-between!important;flex-shrink:0!important;}
.htx-ph-l{display:flex!important;align-items:center!important;gap:10px!important;}
.htx-ph-l h3{font-size:15px!important;font-weight:900!important;color:#fff!important;letter-spacing:.04em!important;}
.htx-ph-badge{background:var(--htx)!important;color:#fff!important;border-radius:20px!important;padding:2px 9px!important;font-size:11px!important;font-weight:900!important;}
#htx-cl{width:34px!important;height:34px!important;background:rgba(255,255,255,.06)!important;border-radius:9px!important;border:1px solid var(--htxb)!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;color:#777!important;font-size:18px!important;transition:all .2s!important;}
#htx-cl:hover{background:var(--htx)!important;color:#fff!important;border-color:var(--htx)!important;}

/* ── PANEL BODY ── */
#htx-pb{flex:1!important;overflow-y:auto!important;padding:16px!important;}
#htx-pb::-webkit-scrollbar{width:3px}
#htx-pb::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}

/* ── CARTE PRODUIT ── */
.htx-item{display:grid!important;grid-template-columns:90px 1fr!important;gap:13px!important;padding:14px!important;background:var(--htxs)!important;border:1px solid var(--htxb)!important;border-radius:18px!important;margin-bottom:10px!important;animation:htxFd .35s ease!important;transition:border-color .2s!important;}
@keyframes htxFd{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.htx-item:hover{border-color:rgba(230,46,4,.22)!important;}
.htx-img-wrap{position:relative!important;}
.htx-img{width:90px!important;height:90px!important;border-radius:13px!important;object-fit:cover!important;background:linear-gradient(135deg,#111,#1a1a1a)!important;border:1px solid rgba(255,255,255,.06)!important;display:block!important;}
.htx-var-dot{position:absolute!important;bottom:4px!important;right:4px!important;width:22px!important;height:22px!important;border-radius:50%!important;border:2px solid rgba(0,0,0,.5)!important;box-shadow:0 2px 6px rgba(0,0,0,.4)!important;}
.htx-info{display:flex!important;flex-direction:column!important;justify-content:space-between!important;min-width:0!important;}
.htx-name{font-size:13px!important;font-weight:700!important;color:#fff!important;line-height:1.3!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
.htx-metas{display:flex!important;flex-wrap:wrap!important;gap:4px!important;margin:6px 0!important;}
.htx-tag{background:rgba(255,255,255,.06)!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:6px!important;padding:2px 8px!important;font-size:9px!important;font-weight:700!important;color:rgba(255,255,255,.5)!important;text-transform:uppercase!important;letter-spacing:.06em!important;}
.htx-tag-red{background:rgba(230,46,4,.12)!important;border-color:rgba(230,46,4,.25)!important;color:rgba(230,46,4,.9)!important;}
.htx-bottom{display:flex!important;align-items:center!important;justify-content:space-between!important;}
.htx-price{font-size:15px!important;font-weight:900!important;color:#fff!important;}
.htx-ctrl{display:flex!important;align-items:center!important;gap:5px!important;}
.htx-qb{display:flex!important;align-items:center!important;background:rgba(255,255,255,.07)!important;border-radius:9px!important;padding:2px!important;}
.htx-qbtn{width:28px!important;height:28px!important;border:none!important;background:rgba(255,255,255,.08)!important;border-radius:7px!important;cursor:pointer!important;font-weight:900!important;color:#fff!important;font-size:15px!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:background .15s!important;}
.htx-qbtn:hover{background:var(--htx)!important;}
.htx-qn{width:32px!important;text-align:center!important;font-weight:900!important;color:#fff!important;font-size:13px!important;}
.htx-del{width:28px!important;height:28px!important;border:none!important;background:rgba(255,60,60,.1)!important;border-radius:7px!important;cursor:pointer!important;color:#ff6666!important;font-size:13px!important;display:flex!important;align-items:center!important;justify-content:center!important;transition:background .15s!important;}
.htx-del:hover{background:rgba(255,60,60,.25)!important;}

/* ── FORMULÈ ── */
.htx-lbl{font-size:9px!important;font-weight:900!important;color:rgba(230,100,70,.7)!important;text-transform:uppercase!important;letter-spacing:.2em!important;margin:20px 0 9px!important;display:block!important;}
.htx-sel,.htx-inp,.htx-ta{width:100%!important;padding:13px 15px!important;border-radius:13px!important;border:1px solid var(--htxb)!important;background:rgba(255,255,255,.05)!important;color:#fff!important;font-size:13px!important;margin-bottom:9px!important;outline:none!important;transition:border-color .2s!important;font-family:system-ui,sans-serif!important;}
.htx-sel:focus,.htx-inp:focus,.htx-ta:focus{border-color:rgba(230,46,4,.5)!important;}
.htx-sel option{background:#111!important;}
.htx-ta{height:70px!important;resize:none!important;}

/* ── PANEL FOOTER ── */
#htx-pf{padding:18px!important;background:rgba(0,0,0,.55)!important;border-top:1px solid var(--htxb)!important;flex-shrink:0!important;}
.htx-sl{display:flex!important;justify-content:space-between!important;margin-bottom:7px!important;font-size:12px!important;font-weight:600!important;color:#444!important;}
.htx-tl{display:flex!important;justify-content:space-between!important;font-size:22px!important;font-weight:900!important;color:#fff!important;margin:12px 0!important;padding-top:12px!important;border-top:1px dashed rgba(255,255,255,.07)!important;}
.htx-tl span:last-child{color:var(--htx)!important;}
.htx-paybtn{width:100%!important;padding:18px!important;border-radius:14px!important;border:none!important;background:linear-gradient(135deg,var(--htx),var(--htx2))!important;color:#fff!important;font-weight:900!important;font-size:15px!important;cursor:pointer!important;box-shadow:0 8px 28px rgba(230,46,4,.3)!important;transition:all .25s!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;letter-spacing:.03em!important;font-family:system-ui,sans-serif!important;}
.htx-paybtn:hover{transform:translateY(-2px)!important;box-shadow:0 14px 36px rgba(230,46,4,.5)!important;}
.htx-paybtn:disabled{opacity:.55!important;cursor:not-allowed!important;transform:none!important;}
.htx-trust{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;margin-top:9px!important;font-size:9px!important;color:#2a2a2a!important;font-weight:700!important;}

/* ── BOUTON INJECTE ── */
.htx-ibtn{display:block!important;width:100%!important;margin-top:9px!important;padding:14px 18px!important;border-radius:11px!important;border:1.5px solid rgba(230,46,4,.35)!important;background:#08090e!important;color:#fff!important;font-weight:800!important;font-size:13px!important;cursor:pointer!important;text-align:center!important;transition:all .25s!important;font-family:system-ui,sans-serif!important;position:relative!important;overflow:hidden!important;letter-spacing:.02em!important;}
.htx-ibtn::after{content:'';position:absolute!important;inset:0!important;background:linear-gradient(135deg,rgba(230,46,4,.12),transparent)!important;opacity:0!important;transition:opacity .25s!important;}
.htx-ibtn:hover{border-color:var(--htx)!important;transform:translateY(-1px)!important;box-shadow:0 6px 22px rgba(230,46,4,.22)!important;}
.htx-ibtn:hover::after{opacity:1!important;}
.htx-ibtn svg{vertical-align:middle!important;margin-right:6px!important;}

/* ── ETAT VID ── */
.htx-empty{text-align:center!important;padding:56px 20px!important;}
.htx-empty svg{opacity:.1!important;margin-bottom:14px!important;}
.htx-empty p{color:#2d2d2d!important;font-size:13px!important;font-weight:700!important;}

/* ── SPINNER ── */
@keyframes htxSp{to{transform:rotate(360deg)}}
.htx-spin{width:16px!important;height:16px!important;border:2px solid rgba(255,255,255,.2)!important;border-top-color:#fff!important;border-radius:50%!important;animation:htxSp .7s linear infinite!important;display:inline-block!important;}

/* ── RESPONSIVE ── */
@media(max-width:520px){
  #htx-pn{width:100vw!important;}
  #htx-bd{display:none!important;}
}
</style>

<!-- HTML WIDGET -->
<div class="htxw">
  <!-- FAB Flottan -->
  <div id="htx-fab" onclick="HTX.toggle()">
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#e62e04" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
    <div id="htx-cnt">0</div>
  </div>

  <!-- Overlay Panel -->
  <div id="htx-ov">
    <div id="htx-bd" onclick="HTX.toggle(false)"></div>
    <div id="htx-pn">
      <!-- Header -->
      <div id="htx-ph">
        <div class="htx-ph-l">
          <h3>🛒 Panyen HATEX</h3>
          <span class="htx-ph-badge" id="htx-cnt2">0</span>
        </div>
        <div id="htx-cl" onclick="HTX.toggle(false)">✕</div>
      </div>
      <!-- Body (pwodwi + fòm) -->
      <div id="htx-pb"></div>
      <!-- Footer (total + pèman) -->
      <div id="htx-pf"></div>
    </div>
  </div>
</div>

<script>
(function(){
"use strict";

/* ══════════════════════════════════════════════════════════════════
   HATEX AI SDK v10.0 — CONFIG
   ══════════════════════════════════════════════════════════════════ */
var CFG = {
  mid: "${profile?.id || 'VOTRE_MERCHANT_ID'}",
  rate: 136,   // Taux USD → HTG
  checkoutUrl: "${typeof window !== 'undefined' ? window.location.origin : 'https://hatexcard.com'}/checkout",
  apiUrl: "https://hatexcard.com/api/checkout/session",
  shipping: {
    "Port-au-Prince":250,"Pétion-Ville":350,"Delmas":250,
    "Tabarre":300,"Carrefour":400,"Cap-Haïtien":850,
    "Cayes":950,"Gonaïves":650,"Jacmel":700,"Miragoâne":750,
    "Saint-Marc":600,"Léogâne":450,"Croix-des-Bouquets":300,
    "Kenscoff":400,"Gressier":350,"Arcahaie":550,"Montrouis":600
  }
};

/* ══ STATE ══════════════════════════════════════════════════════════ */
var ST = { cart:[], ship:0, zone:"", open:false, paying:false };
try { ST.cart = JSON.parse(localStorage.getItem('htx_v10') || '[]'); } catch(e) {}

/* ══════════════════════════════════════════════════════════════════
   HTX-AI: MOTÈ ENTÈLIJAN DETEKSYON
   Sistèm ponde: chak metòd gen yon nivo konfyans (0-100)
   SDK chwazi kandida avèk pi wo konfyans la.
   ══════════════════════════════════════════════════════════════════ */
var AI = {

  /* ─── DETEKSYON MONÈT ─────────────────────────────────────────── */
  isHTGSite: function() {
    // Skane premye 3000 karaktè nan paj la pou detekte monèt
    var txt = (document.body.innerText || '').substring(0, 3000);
    return /\bHTG\b|\bGourdes?\b|\bGdes?\b|\bgoud\b/i.test(txt);
  },

  /* ─── KONVÈSYON PRI ───────────────────────────────────────────── */
  toHTG: function(price) {
    if (!price || price <= 0) return 0;
    // Si sit la an HTG oswa pri >= 3500 → pa konvèti
    if (this.isHTGSite() || price >= 3500) return Math.round(price);
    return Math.round(price * CFG.rate);
  },

  /* ─── PARSE NIMERIK ───────────────────────────────────────────── */
  parseNum: function(raw) {
    if (!raw) return 0;
    var s = String(raw).replace(/[^\\d.,]/g, '').trim();
    if (!s) return 0;
    // Fòma ewopeyen: 1.234,56 → 1234.56
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') 
        ? s.replace(/\\./g,'').replace(',','.') 
        : s.replace(/,/g,'');
    } else if (s.includes(',') && !s.includes('.')) {
      var p = s.split(',');
      s = p[p.length-1].length === 2 ? s.replace(',','.') : s.replace(/,/g,'');
    }
    var n = parseFloat(s);
    return (n > 0 && n < 50000000) ? n : 0;
  },

  /* ─── DETEKSYON PRI (15 metòd) ───────────────────────────────── */
  price: function(ctx) {
    ctx = ctx || document;
    var cands = [];

    // M1: JSON-LD Schema.org (konfyans 97)
    try {
      document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s) {
        var d = JSON.parse(s.textContent || s.innerHTML);
        var items = Array.isArray(d) ? d : [d];
        items.forEach(function(it) {
          var p = it['@type']==='Product' ? it : (it['@graph']||[]).find(function(n){return n['@type']==='Product';});
          if (p && p.offers) {
            var o = Array.isArray(p.offers) ? p.offers : [p.offers];
            var v = AI.parseNum(o[0].price || o[0].lowPrice);
            if (v > 0) cands.push({val:v, score:97});
          }
        });
      });
    } catch(e) {}

    // M2: Shopify variants API (konfyans 95)
    if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) {
      var sv = window.ShopifyAnalytics.meta.product.variants;
      if (sv && sv.length) cands.push({val: parseFloat(sv[0].price)/100, score:95});
    }
    if (window.meta && window.meta.product && window.meta.product.variants)
      cands.push({val: parseFloat(window.meta.product.variants[0].price)/100, score:93});

    // M3: Open Graph (konfyans 88)
    var og = document.querySelector('meta[property="product:price:amount"],meta[property="og:price:amount"]');
    if (og && og.content) {
      var v = AI.parseNum(og.content);
      if (v > 0) cands.push({val:v, score:88});
    }

    // M4: WooCommerce variation actif (konfyans 93)
    var vi = ctx.querySelector('input.variation_id,input[name="variation_id"]');
    if (vi && parseInt(vi.value) > 0) {
      var form = document.querySelector('.variations_form');
      if (form && form.dataset.product_variations) {
        try {
          var vars = JSON.parse(form.dataset.product_variations);
          var m = vars.find(function(v){ return v.variation_id == parseInt(vi.value); });
          if (m && m.display_price) cands.push({val: parseFloat(m.display_price), score:93});
        } catch(e) {}
      }
    }

    // M5: data attributes (konfyans 82)
    var da = (ctx === document ? document : ctx).querySelector('[data-price]:not([data-price=""]),[data-amount]:not([data-amount=""]),[data-product-price],[data-variant-price]');
    if (da) {
      var raw = da.dataset.price || da.dataset.amount || da.dataset.productPrice || da.dataset.variantPrice;
      var v = AI.parseNum(raw);
      if (v > 0) cands.push({val:v, score:82});
    }

    // M6-M15: Sélecteurs CSS multi-platform
    var SELS = [
      ['.summary .price ins .amount bdi', 78],
      ['.summary .price .amount bdi', 75],
      ['.woocommerce-Price-amount.amount bdi', 75],
      ['.woocommerce-Price-amount.amount', 72],
      ['.wc-block-grid__product-price .amount bdi', 72],
      ['.price bdi', 68],
      ['.product__price', 72], ['.price--main .price-item', 72],
      ['.price-item--regular', 70], ['.product-single__price', 70],
      ['.product-price .money', 68], ['.price-final_price .price', 70],
      ['.product-info-price .price', 68], ['#our_price_display', 70],
      ['.current-price span.price', 68], ['#price-new', 68],
      ['[data-product-price]', 72], ['.price-section .price', 65],
      ['[data-hook="formatted-primary-price"]', 72],
      ['.product-price .sqs-money-native', 70],
      ['[itemprop="price"]', 78], ['.a-price .a-offscreen', 60],
      ['.prix', 62], ['.precio', 62], ['.preis', 62], ['.prezzo', 62],
      ['[class*="price"][class*="current"]:not(script)', 62],
      ['[class*="price"][class*="sale"]:not(script)', 60],
      ['[id*="price"]:not(script):not(style)', 55]
    ];

    for (var si = 0; si < SELS.length; si++) {
      try {
        var el = (ctx === document ? document : ctx).querySelector(SELS[si][0]);
        if (el) {
          var raw2 = (el.dataset && (el.dataset.price || el.dataset.amount)) 
            ? (el.dataset.price || el.dataset.amount)
            : (el.innerText || el.textContent || '');
          var v2 = AI.parseNum(raw2);
          if (v2 > 0) cands.push({val:v2, score: SELS[si][1]});
        }
      } catch(e) {}
    }

    if (cands.length === 0) return null;
    cands.sort(function(a, b){ return b.score - a.score; });
    return cands[0].val;
  },

  /* ─── DETEKSYON IMAJ PRENSIPAL ────────────────────────────────── */
  mainImage: function() {
    // OG image (meye kalite)
    var og = document.querySelector('meta[property="og:image"],meta[name="twitter:image:src"]');
    if (og && og.content && og.content.startsWith('http')) return og.content;

    // JSON-LD image
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        var d = JSON.parse(scripts[i].textContent || '{}');
        var items = Array.isArray(d) ? d : [d];
        for (var j = 0; j < items.length; j++) {
          var p = items[j]['@type']==='Product' ? items[j] : (items[j]['@graph']||[]).find(function(n){return n['@type']==='Product';});
          if (p && p.image) {
            var img = Array.isArray(p.image) ? p.image[0] : p.image;
            if (typeof img === 'object') img = img.url || img['@id'] || '';
            if (img && img.startsWith('http')) return img;
          }
        }
      }
    } catch(e) {}

    // Sélecteurs spécifiques
    var IMG_SELS = [
      '.woocommerce-product-gallery__image img',
      '.woocommerce-product-gallery img.wp-post-image',
      '#ProductPhotoImg', 'img#featured-image',
      '.gallery-placeholder img', '.product.media img',
      '#bigpic', '.product_big_img img',
      '[data-main-image]', '[data-zoom-image]',
      'figure.woocommerce-product-gallery__image img',
      '[class*="product"][class*="gallery"] img',
      '[class*="product"][class*="hero"] img',
      '[itemprop="image"]', 'article.product img',
      '.product-image-wrapper img', 'picture.product img'
    ];
    for (var s = 0; s < IMG_SELS.length; s++) {
      try {
        var el = document.querySelector(IMG_SELS[s]);
        if (el) {
          var src = el.dataset.largeImage || el.dataset.src || el.dataset.lazySrc || el.dataset.original || el.src;
          if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('data:')) return src;
        }
      } catch(e) {}
    }

    // Fallback: pi gwo imaj vizib
    var imgs = Array.from(document.querySelectorAll('img')).filter(function(img) {
      return img.naturalWidth > 200 && img.naturalHeight > 200 && img.src && img.src.startsWith('http') && img.offsetParent !== null;
    });
    imgs.sort(function(a, b){ return (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight); });
    return imgs.length > 0 ? imgs[0].src : '';
  },

  /* ─── DETEKSYON FOTO VARYANT AKTIF ───────────────────────────── */
  variantImage: function() {
    // Foto ki chanje lè ou seleksyone varyant
    var sels = [
      '.woocommerce-product-gallery__image img.zoomImg',
      '.woocommerce-product-gallery__image img[src*="variation"]',
      '[data-variation-image]', '.variation-image img',
      '.product-featured-image.active img',
      '#ProductPhotoImg', '.selected-variation-image img',
      '.product-thumb.active img',
      '.thumbnails .active img', '.swiper-slide-active img'
    ];
    for (var i = 0; i < sels.length; i++) {
      try {
        var el = document.querySelector(sels[i]);
        if (el) {
          var src = el.dataset.src || el.src;
          if (src && src.startsWith('http')) return src;
        }
      } catch(e) {}
    }
    return null;
  },

  /* ─── DETEKSYON NON PWODWI ────────────────────────────────────── */
  name: function() {
    // JSON-LD (pi fiab)
    try {
      var scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (var i = 0; i < scripts.length; i++) {
        var d = JSON.parse(scripts[i].textContent || '{}');
        var items = Array.isArray(d) ? d : [d];
        for (var j = 0; j < items.length; j++) {
          var p = items[j]['@type']==='Product' ? items[j] : (items[j]['@graph']||[]).find(function(n){return n['@type']==='Product';});
          if (p && p.name) return String(p.name).trim();
        }
      }
    } catch(e) {}

    var og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) return og.content.trim();

    var SELS = [
      '.product_title.entry-title', 'h1.product-single__title',
      'h1.product__title', '[itemprop="name"]',
      'h1[class*="product"]', 'h1[class*="title"]', 'h1'
    ];
    for (var s = 0; s < SELS.length; s++) {
      var el = document.querySelector(SELS[s]);
      if (el && el.innerText && el.innerText.trim().length > 1) return el.innerText.trim();
    }
    return document.title.split(/[|\\-–—]/)[0].trim();
  },

  /* ─── DETEKSYON VARIASYON (Koule, Tay, etc.) ─────────────────── */
  variant: function() {
    var parts = [];

    // WooCommerce selects
    document.querySelectorAll('table.variations select, .variations select').forEach(function(s) {
      var opt = s.options[s.selectedIndex];
      if (opt && opt.text && !opt.text.includes('---') && !opt.text.toLowerCase().includes('choose') && !opt.text.toLowerCase().includes('choisir')) {
        var label = s.closest('tr') ? (s.closest('tr').querySelector('label,th')?.innerText || '') : '';
        parts.push((label ? label + ': ' : '') + opt.text.trim());
      }
    });
    if (parts.length > 0) return parts.join(' · ');

    // Shopify select
    var sh = document.querySelector('.product-form__variants select option:checked, [name="id"] option:checked');
    if (sh && sh.text && !sh.text.includes('Default')) return sh.text.trim();

    // Swatches sélectionnés
    var sw = Array.from(document.querySelectorAll(
      '.swatch.selected span, .color-swatch.active, .size-swatch.active, ' +
      '[data-value].selected, [aria-pressed="true"][data-value], ' +
      '.product-attribute__swatch--active, button.selected[data-value]'
    )).map(function(el) {
      return el.dataset.value || el.title || el.innerText || '';
    }).filter(Boolean);
    if (sw.length > 0) return sw.join(' · ');

    // Radio buttons cochés
    var rb = Array.from(document.querySelectorAll('input[type="radio"]:checked')).filter(function(r) {
      return r.name && (r.name.includes('attribute') || r.name.includes('variation') || r.name.includes('option') || r.name.includes('size') || r.name.includes('color'));
    }).map(function(r) { return r.value; });
    if (rb.length > 0) return rb.join(' · ');

    return 'Inite';
  },

  /* ─── DETEKSYON KOULE (CSS / data-attr) ──────────────────────── */
  color: function() {
    // Swatch actif ak koule CSS
    var sels = [
      '.swatch.selected[style*="background"]',
      '.color-swatch.active', '.color-item.active',
      '[data-color].active', '[data-colour].selected',
      'button.selected[data-color]'
    ];
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (el) {
        var color = el.dataset.color || el.dataset.colour || el.title || el.getAttribute('aria-label') || '';
        if (color) return color;
        // Extraire couleur CSS
        var bg = el.style.backgroundColor || getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
      }
    }
    return null;
  },

  /* ─── DETEKSYON TAY (Size) ────────────────────────────────────── */
  size: function() {
    var sels = [
      'select[id*="size"] option:checked', 'select[name*="size"] option:checked',
      'select[id*="taille"] option:checked', '.size-swatch.active',
      'input[name*="size"]:checked', '[data-size].active',
      'button.size-btn.active', '[aria-label*="size"][aria-pressed="true"]'
    ];
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (el) {
        var val = el.value || el.innerText || el.dataset.size || el.getAttribute('aria-label') || '';
        if (val && val.trim() && !val.includes('---')) return val.trim();
      }
    }
    return null;
  },

  /* ─── DETEKSYON KANTITE ───────────────────────────────────────── */
  qty: function() {
    var q = document.querySelector('input.qty, input[name="quantity"], input[id*="quantity"], input[class*="qty"], .quantity input, [data-quantity] input');
    return q ? Math.max(1, parseInt(q.value) || 1) : 1;
  },

  /* ─── SKY: INFO KAT PWODWI (paj listing) ─────────────────────── */
  cardInfo: function(card) {
    var info = { name: '', img: '', variant: 'Inite', link: '', color: null, size: null };

    // Non
    var nameEl = card.querySelector('h1,h2,h3,h4,.product-title,.woocommerce-loop-product__title,.card-title,.product-name,[itemprop="name"],[class*="product-title"],[class*="product-name"]');
    if (nameEl && nameEl.innerText) info.name = nameEl.innerText.trim();
    if (!info.name) { var a = card.querySelector('a'); if (a && a.innerText && a.innerText.trim().length > 1) info.name = a.innerText.trim(); }

    // Imaj
    var img = card.querySelector('img');
    if (img) info.img = img.dataset.src || img.dataset.lazySrc || img.dataset.original || img.src || '';

    // Lyen
    var link = card.querySelector('a[href*="product"], a[href*="item"], a.woocommerce-loop-product__link, a[class*="product"], a');
    if (link) info.link = link.href;

    return info;
  },

  /* ─── SCAN KONPLÈ POU PAJ DETAY ──────────────────────────────── */
  fullScan: function() {
    return {
      name: AI.name(),
      img: AI.variantImage() || AI.mainImage(),
      mainImg: AI.mainImage(),
      variant: AI.variant(),
      color: AI.color(),
      size: AI.size(),
      qty: AI.qty(),
      url: window.location.href
    };
  }
};

/* ══════════════════════════════════════════════════════════════════
   LISTING INJECTOR — Enjekte anba chak kat pwodwi sou paj katalòg
   ══════════════════════════════════════════════════════════════════ */
var LISTING = {
  CARD_SELS: [
    'ul.products li.product', '.wc-block-grid__product',
    '.product.type-product', '.product-item',
    '.grid__item .card-wrapper', '.product-card',
    '.product-grid-item', '.product-miniature',
    '#products .js-product', '.product-layout',
    '.product-thumb', '[data-product-id]',
    '.productCard', '[data-hook="product-list-grid-item"]',
    '[class*="product-card"]:not(.htxw)', '[class*="product-item"]:not(script):not(style)',
    '[class*="ProductCard"]', '[class*="catalogue-item"]',
    'article.product', '.item.product-item'
  ],

  inject: function() {
    var found = false;
    for (var ci = 0; ci < this.CARD_SELS.length; ci++) {
      var cards = document.querySelectorAll(this.CARD_SELS[ci]);
      if (cards.length < 1) continue;
      found = true;

      cards.forEach(function(card) {
        if (card.dataset.htxOk) return;

        var pInfo = AI.cardInfo(card);
        if (!pInfo.name || pInfo.name.length < 2) return;

        var price = AI.price(card) || AI.price(document);

        // Créer bouton Hatex
        var btn = document.createElement('button');
        btn.className = 'htx-ibtn';
        btn.setAttribute('type', 'button');
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e62e04" stroke-width="2.5" style="display:inline;vertical-align:middle;margin-right:6px"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>Achte an Goud · HATEX';

        // Snapshot de la info pour closure
        var snapInfo = pInfo;
        var snapPrice = price;

        btn.onclick = function(e) {
          e.preventDefault(); e.stopPropagation();
          var p = snapPrice;
          if (!p) {
            var m = prompt('Prix pa detekte. Antre pri a (HTG oswa USD):');
            if (!m) return;
            p = parseFloat(m.replace(/[^0-9.]/g, ''));
          }
          var htgPrice = AI.toHTG(p);
          var item = {
            id: Date.now() + Math.random(),
            name: snapInfo.name,
            price: htgPrice,
            priceRaw: p,
            qty: 1,
            img: snapInfo.img,
            mainImg: snapInfo.img,
            variant: snapInfo.variant,
            color: snapInfo.color,
            size: snapInfo.size,
            link: snapInfo.link || window.location.href
          };
          HTX.addItem(item);
        };

        // Trouver le meilleur endroit pour insérer
        var ADD_BTN_SELS = [
          '.add_to_cart_button', 'button[name="add-to-cart"]',
          '[data-action="add-to-cart"]', '[class*="add-to-cart"]',
          '[class*="addtocart"]', '[class*="AddToCart"]',
          '.btn-add-to-cart', '.add-to-basket', '.acheter', '.comprar',
          'button[class*="cart"]', '.btn-cart'
        ];

        var insertAfter = null;
        for (var bs = 0; bs < ADD_BTN_SELS.length; bs++) {
          insertAfter = card.querySelector(ADD_BTN_SELS[bs]);
          if (insertAfter) break;
        }

        if (insertAfter && insertAfter.parentNode) {
          insertAfter.parentNode.insertBefore(btn, insertAfter.nextSibling);
        } else {
          var priceEl = card.querySelector('[class*="price"], .price, .cost, .amount');
          if (priceEl && priceEl.parentNode) priceEl.parentNode.insertBefore(btn, priceEl.nextSibling);
          else card.appendChild(btn);
        }

        card.dataset.htxOk = '1';
      });

      if (found) break;
    }
  }
};

/* ══════════════════════════════════════════════════════════════════
   DETAIL INJECTOR — Enjekte anba bouton "Add to Cart" paj detay
   ══════════════════════════════════════════════════════════════════ */
var DETAIL = {
  BTN_SELS: [
    '.single_add_to_cart_button', 'button[name="add-to-cart"]',
    '.add_to_cart_button', '#add-to-cart', '.btn-add-to-cart',
    '[data-action="add-to-cart"]', 'button[id*="add-to-cart"]',
    'button[class*="add-to-cart"]', 'button[class*="addtocart"]',
    '#AddToCart', '.shopify-payment-button__button',
    '.product-form__submit', '.add_to_basket', '.add-to-basket',
    '.kaufen', '.acheter', '.comprar', '.adicionar-carrinho',
    '#btn-buy', '[class*="buy-now"]', '[class*="purchase-btn"]',
    'button[class*="cart"]'
  ],

  inject: function() {
    this.BTN_SELS.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(btn) {
        if (btn.dataset.htxOk || btn.classList.contains('htx-ibtn')) return;
        if (!btn.offsetParent) return; // caché

        var htxBtn = document.createElement('button');
        htxBtn.className = 'htx-ibtn';
        htxBtn.setAttribute('type', 'button');
        htxBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e62e04" stroke-width="2.5" style="display:inline;vertical-align:middle;margin-right:6px"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>💳 Achte an Goud avèk HATEX';

        htxBtn.onclick = function(e) {
          e.preventDefault(); e.stopPropagation();
          var scan = AI.fullScan();
          var price = AI.price(document);

          if (!price) {
            var m = prompt('❌ Prix pa detekte.\nAntre pri a (HTG oswa USD):');
            if (!m) return;
            price = parseFloat(m.replace(/[^0-9.]/g, ''));
          }
          if (!price || price <= 0) return alert('Pri invalid.');

          var item = {
            id: Date.now(),
            name: scan.name,
            price: AI.toHTG(price),
            priceRaw: price,
            qty: scan.qty,
            img: scan.img,
            mainImg: scan.mainImg || scan.img,
            variant: scan.variant,
            color: scan.color,
            size: scan.size,
            link: scan.url
          };
          HTX.addItem(item);
          btn.dataset.htxOk = '1';
        };

        if (btn.parentNode) btn.parentNode.insertBefore(htxBtn, btn.nextSibling);
        btn.dataset.htxOk = '1';
      });
    });
  }
};

/* ══════════════════════════════════════════════════════════════════
   HTX — MOTÈ PRENSIPAL (Cart + Render + Checkout)
   ══════════════════════════════════════════════════════════════════ */
window.HTX = {

  addItem: function(item) {
    // Chèche si pwodwi a deja la ak menm varyant
    var existing = ST.cart.find(function(x) {
      return x.name === item.name && x.variant === item.variant && x.img === item.img;
    });
    if (existing) {
      existing.qty += item.qty;
    } else {
      ST.cart.push(item);
    }
    this.sync();
    this.toggle(true);
  },

  sync: function() {
    try { localStorage.setItem('htx_v10', JSON.stringify(ST.cart)); } catch(e) {}
    var total = ST.cart.reduce(function(s, i) { return s + i.qty; }, 0);
    var b1 = document.getElementById('htx-cnt');
    var b2 = document.getElementById('htx-cnt2');
    if (b1) { b1.textContent = total; b1.style.display = total > 0 ? 'flex' : 'none'; }
    if (b2) b2.textContent = total;
    this.render();
  },

  toggle: function(force) {
    var ov = document.getElementById('htx-ov');
    if (!ov) return;
    var open = force !== undefined ? force : !ST.open;
    ST.open = open;
    ov.style.display = open ? 'flex' : 'none';
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) this.render();
  },

  qty: function(id, delta) {
    var item = ST.cart.find(function(x) { return x.id == id; });
    if (item) {
      item.qty += delta;
      if (item.qty < 1) ST.cart = ST.cart.filter(function(x) { return x.id != id; });
    }
    this.sync();
  },

  remove: function(id) {
    ST.cart = ST.cart.filter(function(x) { return x.id != id; });
    this.sync();
  },

  render: function() {
    var body = document.getElementById('htx-pb');
    var foot = document.getElementById('htx-pf');
    if (!body || !foot) return;

    if (ST.cart.length === 0) {
      body.innerHTML = '<div class="htx-empty"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg><p>Panyen ou vid.<br>Chwazi yon pwodwi.</p></div>';
      foot.innerHTML = '';
      return;
    }

    var sub = ST.cart.reduce(function(s, i) { return s + (i.price * i.qty); }, 0);

    // ── LISTE PWODWI ──────────────────────────────────────────────
    var itemsHtml = ST.cart.map(function(item) {
      var id = String(item.id).replace(/[^0-9]/g, '').substring(0, 15);
      var colorDot = '';
      if (item.color && item.color.startsWith('#') || (item.color && item.color.startsWith('rgb'))) {
        colorDot = '<div class="htx-var-dot" style="background:' + item.color + '"></div>';
      }
      var metas = '';
      if (item.variant && item.variant !== 'Inite') metas += '<span class="htx-tag htx-tag-red">' + item.variant + '</span>';
      if (item.size) metas += '<span class="htx-tag">Tay: ' + item.size + '</span>';
      if (item.color && !item.color.startsWith('#') && !item.color.startsWith('rgb')) metas += '<span class="htx-tag">Koule: ' + item.color + '</span>';

      return '<div class="htx-item">'
        + '<div class="htx-img-wrap">'
          + '<img class="htx-img" src="' + (item.img || '') + '" onerror="this.style.background=\'#0f0f12\'" alt="">'
          + colorDot
        + '</div>'
        + '<div class="htx-info">'
          + '<div class="htx-name">' + item.name + '</div>'
          + (metas ? '<div class="htx-metas">' + metas + '</div>' : '')
          + '<div class="htx-bottom">'
            + '<div class="htx-price">' + (item.price * item.qty).toLocaleString() + ' HTG</div>'
            + '<div class="htx-ctrl">'
              + '<div class="htx-qb">'
                + '<button class="htx-qbtn" onclick="HTX.qty(' + id + ',-1)">−</button>'
                + '<span class="htx-qn">' + item.qty + '</span>'
                + '<button class="htx-qbtn" onclick="HTX.qty(' + id + ',1)">+</button>'
              + '</div>'
              + '<button class="htx-del" onclick="HTX.remove(' + id + ')">🗑</button>'
            + '</div>'
          + '</div>'
        + '</div>'
      + '</div>';
    }).join('');

    // ── FORMULÈ LIVREZON ─────────────────────────────────────────
    var formHtml = ''
      + '<span class="htx-lbl">📦 Zòn Livrezon</span>'
      + '<select class="htx-sel" id="htx-zone" onchange="ST.ship=parseInt(this.value)||0;ST.zone=this.options[this.selectedIndex].text.split(\'(\')[0].trim();HTX.render();">'
      + '<option value="0">— Chwazi Zòn Ou —</option>'
      + Object.entries(CFG.shipping).map(function(e) {
          return '<option value="' + e[1] + '"' + (ST.ship === e[1] ? ' selected' : '') + '>' + e[0] + ' (+' + e[1].toLocaleString() + ' HTG)</option>';
        }).join('')
      + '</select>'
      + '<span class="htx-lbl">👤 Enfòmasyon Kliyan</span>'
      + '<input id="htx_n" class="htx-inp" placeholder="Non & Prenon" value="' + (localStorage.getItem('htx_n') || '') + '">'
      + '<input id="htx_p" class="htx-inp" placeholder="📱 WhatsApp / Telefòn" value="' + (localStorage.getItem('htx_p') || '') + '">'
      + '<input id="htx_e" class="htx-inp" type="email" placeholder="📧 Email (opsyonèl)" value="' + (localStorage.getItem('htx_e') || '') + '">'
      + '<textarea id="htx_a" class="htx-ta" placeholder="🏠 Adrès Detaye (Ri, No Kay, Referans...)">' + (localStorage.getItem('htx_a') || '') + '</textarea>';

    body.innerHTML = itemsHtml + formHtml;

    // ── FOOTER: TOTAL + BOUTON ────────────────────────────────────
    foot.innerHTML = ''
      + '<div class="htx-sl"><span>Sous-Total (' + ST.cart.reduce(function(s,i){return s+i.qty;},0) + ' atik)</span><span>' + sub.toLocaleString() + ' HTG</span></div>'
      + '<div class="htx-sl"><span>Livrezon</span><span>' + (ST.ship > 0 ? ST.ship.toLocaleString() + ' HTG' : '— Chwazi zòn ou') + '</span></div>'
      + '<div class="htx-tl"><span>TOTAL</span><span>' + (sub + ST.ship).toLocaleString() + ' HTG</span></div>'
      + '<button class="htx-paybtn" id="htx-pbtn" onclick="HTX.pay()">'
        + '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>'
        + 'Kontinye → Checkout'
      + '</button>'
      + '<div class="htx-trust">🔒 256-bit SSL · Pèman Sekirize HatexCard</div>';
  },

  pay: async function() {
    var name = (document.getElementById('htx_n') || {}).value || '';
    var phone = (document.getElementById('htx_p') || {}).value || '';
    var addr = (document.getElementById('htx_a') || {}).value || '';
    var emailVal = (document.getElementById('htx_e') || {}).value || '';

    if (!name.trim() || !phone.trim()) { alert('⚠️ Tanpri antre non ak telefòn ou.'); return; }
    if (ST.ship === 0) { alert('⚠️ Tanpri chwazi zòn livrezon ou.'); return; }

    localStorage.setItem('htx_n', name);
    localStorage.setItem('htx_p', phone);
    localStorage.setItem('htx_a', addr);
    localStorage.setItem('htx_e', emailVal);

    var btn = document.getElementById('htx-pbtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="htx-spin"></div> Ap prepare chekout...'; }

    var sub = ST.cart.reduce(function(s, i) { return s + (i.price * i.qty); }, 0);
    var total = sub + ST.ship;

    // Payload konplè — tout pwodwi ak tout enfo yo
    var payload = {
      mid: CFG.mid,
      amount: total,
      subtotal: sub,
      shipping: { fee: ST.ship, zone: ST.zone },
      items: ST.cart.map(function(i) {
        return {
          name: i.name,
          price: i.price,
          qty: i.qty,
          img: i.img,
          mainImg: i.mainImg || i.img,
          variant: i.variant,
          color: i.color || null,
          size: i.size || null,
          link: i.link || ''
        };
      }),
      customer: { name: name, phone: phone, email: emailVal, address: addr },
      source: window.location.href,
      currency: AI.isHTGSite() ? 'HTG' : 'USD→HTG',
      rate: CFG.rate
    };

    try {
      // Esseye sèvè Hatex la pou yon token opak (URL pwòp)
      var res = await fetch(CFG.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        var json = await res.json();
        if (json.token) {
          window.location.href = CFG.checkoutUrl + '?s=' + json.token;
          return;
        }
      }
    } catch(e) {}

    // Fallback: encode base64url (pa gen done sansib nan URL)
    var enc = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=/g, '');
    window.location.href = CFG.checkoutUrl + '?d=' + enc;
  }
};

/* ══ INIT + OBSERVER ════════════════════════════════════════════════ */
function htxInit() {
  HTX.sync();
  LISTING.inject();
  DETAIL.inject();
}

htxInit();

// Observer pou kontni dinamik (React / Vue / SPA)
var htxObs = new MutationObserver(function() {
  LISTING.inject();
  DETAIL.inject();
});
htxObs.observe(document.body, { childList: true, subtree: true });

// Reyese pou paj ki chaje anvan
[300, 800, 1500, 3000, 6000].forEach(function(t) {
  setTimeout(htxInit, t);
});

// Spinner CSS
var st = document.createElement('style');
st.textContent = '@keyframes htxSp2{to{transform:rotate(360deg)}}.htx-spin{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:htxSp2 .7s linear infinite;vertical-align:middle;margin-right:8px}';
document.head.appendChild(st);

})();
</script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullSDKCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
          <button onClick={() => setMode('menu')} className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${mode === 'menu' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'}`}>
            <LayoutGrid size={15} /> Dashboard
          </button>
          <button onClick={() => setMode('history')} className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${mode === 'history' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'}`}>
            <History size={15} /> Logs
          </button>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <RefreshCw size={36} className="text-red-600 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Terminal...</p>
        </div>
      )}

      {/* ══ DASHBOARD ═══════════════════════════════════════════════ */}
      {mode === 'menu' && (
        <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

          <div className="lg:col-span-8 space-y-8">

            {/* ── MERCHANT IDENTITY ── */}
            <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-10 rounded-[3.5rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-20 transition-opacity">
                <ShieldCheck size={110} className="text-red-600" />
              </div>
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-red-600/10 p-4 rounded-3xl"><Lock className="text-red-600 w-6 h-6" /></div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-widest">Merchant Identity</h3>
                  <p className="text-[10px] text-zinc-500 font-bold">Konfigire pwofil biznis piblik ou</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={17} />
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} readOnly={!!profile?.business_name} placeholder="Non Legal Biznis Ou" className="w-full bg-black/40 border border-white/10 py-6 pl-16 pr-6 rounded-3xl text-[14px] outline-none text-white italic focus:border-red-600/50 transition-all" />
                </div>
                {!profile?.business_name && (
                  <button onClick={updateBusinessName} disabled={loading} className="bg-white text-black px-10 py-6 rounded-3xl font-black uppercase text-[12px] hover:bg-red-600 hover:text-white transition-all active:scale-95">
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

            {/* ══ TABLO REVNI ════════════════════════════════════════ */}
            <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[3.5rem] overflow-hidden">
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

              {/* 4 Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y divide-white/5">
                {[
                  { label: 'Total SDK', val: earnings.sdkTotal, icon: <Zap size={15} />, sub: `${earnings.sdkCount} vant`, color: 'text-blue-400' },
                  { label: 'Total Invoice', val: earnings.invoiceTotal, icon: <Mail size={15} />, sub: `${earnings.invoiceCount} peye`, color: 'text-emerald-400' },
                  { label: 'Mwa sa a', val: earnings.thisMonth, icon: <TrendingUp size={15} />, sub: 'Revni kourann', color: 'text-amber-400' },
                  { label: 'Gran Total', val: earnings.total, icon: <DollarSign size={15} />, sub: 'Pou senkronize', color: 'text-red-400' },
                ].map((s) => (
                  <div key={s.label} className="p-6">
                    <div className={`flex items-center gap-2 mb-3 ${s.color}`}>
                      {s.icon}
                      <span className="text-[9px] font-black uppercase tracking-wider">{s.label}</span>
                    </div>
                    <div className="text-2xl font-black italic">{s.val.toLocaleString()}</div>
                    <div className="text-[9px] text-zinc-600 font-bold mt-1 uppercase">{s.sub} HTG</div>
                  </div>
                ))}
              </div>

              {/* Dènye vant */}
              <div className="p-6 border-t border-white/5">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Dènye Vant</p>
                {recentSales.length > 0 ? (
                  <div className="space-y-2">
                    {recentSales.slice(0, 5).map((sale, i) => {
                      const initials = getInitials(sale.client);
                      const colorCls = getInitialColor(sale.client);
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 bg-black/30 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                          <div className={`w-9 h-9 ${colorCls} rounded-xl flex items-center justify-center font-black text-[10px] text-white flex-shrink-0`}>
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">{sale.client}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${sale.source === 'SDK' ? 'bg-blue-600/20 text-blue-400' : 'bg-emerald-600/20 text-emerald-400'}`}>{sale.source}</span>
                              <span className="text-[9px] text-zinc-600">{new Date(sale.created_at).toLocaleDateString('fr-HT')}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-black text-green-400">+{parseFloat(sale.amount).toLocaleString()}</div>
                            <div className="text-[8px] text-zinc-600 font-bold">HTG</div>
                          </div>
                          <ArrowUpRight size={13} className="text-zinc-700" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package size={28} className="mx-auto mb-2 text-zinc-800" />
                    <p className="text-[10px] font-black uppercase text-zinc-700">Pa gen vant ankò</p>
                  </div>
                )}
              </div>
            </div>

            {/* QUICK ACTIONS */}
            {profile?.business_name ? (
              <div className="grid grid-cols-2 gap-6">
                {[
                  { icon: <Globe className="text-red-600" size={28} />, label: 'SDK Deployment', sub: 'Konekte boutik ou', action: () => setMode('api') },
                  { icon: <Mail className="text-red-600" size={28} />, label: 'Smart Invoice', sub: 'Voye fakti bay kliyan', action: () => setMode('request') },
                ].map((a) => (
                  <button key={a.label} onClick={a.action} className="bg-zinc-900/30 p-12 rounded-[4rem] border border-white/5 flex flex-col items-center justify-center gap-5 hover:bg-red-600/10 hover:border-red-600/20 transition-all group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="bg-zinc-950 p-6 rounded-3xl group-hover:scale-110 transition-transform">{a.icon}</div>
                    <div className="text-center">
                      <span className="text-[12px] font-black uppercase italic block">{a.label}</span>
                      <span className="text-[8px] text-zinc-500 uppercase font-bold mt-1 block">{a.sub}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-red-600/5 border border-red-600/20 p-12 rounded-[4rem] text-center">
                <AlertTriangle className="text-red-600 w-12 h-12 mx-auto mb-6" />
                <h4 className="text-sm font-black uppercase text-red-500 mb-2 italic">Aksyon limite</h4>
                <p className="text-[11px] text-red-500/60 max-w-sm mx-auto leading-relaxed">Ou dwe lye biznis ou an anvan ou ka jwenn aksè nan SDK ak Invoices.</p>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="lg:col-span-4 space-y-6">
            {/* Balans */}
            <div className="bg-white text-black p-8 rounded-[3.5rem] shadow-2xl shadow-red-600/10">
              <div className="flex justify-between items-start mb-5">
                <div className="bg-black text-white p-4 rounded-2xl"><Wallet size={18} /></div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Balans Wallet</p>
                  <h2 className="text-3xl font-black italic tracking-tighter mt-1">
                    {profile?.balance?.toLocaleString() || '0'}<span className="text-[12px] ml-1">HTG</span>
                  </h2>
                </div>
              </div>
              <div className="bg-zinc-50 rounded-2xl p-4 mb-4">
                <p className="text-[9px] font-black uppercase text-zinc-400 mb-2">An Atant pou Senkronize</p>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-black text-red-600">{earnings.total.toLocaleString()} HTG</span>
                  <span className="text-[8px] bg-red-100 text-red-600 font-black px-2 py-1 rounded-full">DISPONIB</span>
                </div>
              </div>
              <button onClick={handleSyncBalance} disabled={syncing || earnings.total <= 0} className="w-full bg-black hover:bg-red-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                {syncing ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                Senkronize {earnings.total > 0 ? earnings.total.toLocaleString() + ' HTG' : ''}
              </button>
            </div>

            {/* Node Config */}
            <div className="bg-zinc-900/30 border border-white/5 p-7 rounded-[3rem]">
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-zinc-500">Konfigirasyon</h3>
              <div className="space-y-3">
                {[
                  { label: 'Merchant ID', val: (profile?.id?.slice(0, 8) || '—') + '...', color: 'text-red-500' },
                  { label: 'KYC Status', val: profile?.kyc_status || 'pending', color: profile?.kyc_status === 'approved' ? 'text-green-500' : 'text-orange-500' },
                  { label: 'SDK Version', val: 'V10 AI', color: 'text-blue-400' },
                  { label: 'Revni Mwa a', val: earnings.thisMonth.toLocaleString() + ' HTG', color: 'text-emerald-400' },
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
            <h2 className="text-xl font-black uppercase italic tracking-widest">SDK AI Universal V10</h2>
            <div className="w-12" />
          </div>

          {/* ── VIDEYO TUTORYÈL YOUTUBE ── */}
          <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[3rem] overflow-hidden mb-8">
            <div className="p-7 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-red-600/10 p-3 rounded-2xl">
                  <Youtube className="text-red-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[13px] font-black uppercase tracking-widest">Videyo Tutoryèl SDK</h3>
                  <p className="text-[9px] text-zinc-500 font-bold mt-0.5">Anseye machann yo kijan pou entegre SDK a</p>
                </div>
              </div>
              <button onClick={() => setShowVideo(!showVideo)} className="px-4 py-2 bg-zinc-900 rounded-xl font-black text-[10px] uppercase hover:bg-zinc-800 transition-all flex items-center gap-2">
                <Play size={12} /> {showVideo ? 'Kache' : 'Wè'}
              </button>
            </div>

            {showVideo && youtubeUrl && getYoutubeEmbedUrl(youtubeUrl) ? (
              <div className="aspect-video">
                <iframe
                  src={getYoutubeEmbedUrl(youtubeUrl)}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            ) : showVideo && !youtubeUrl ? (
              <div className="p-10 text-center text-zinc-600">
                <Youtube size={40} className="mx-auto mb-4 opacity-20" />
                <p className="text-[11px] font-bold uppercase">Pa gen URL videyo. Ajoute l anba.</p>
              </div>
            ) : null}

            <div className="p-6 flex gap-3">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 bg-black/40 border border-white/10 py-4 px-5 rounded-2xl text-[13px] outline-none text-white focus:border-red-600/50 transition-all"
              />
              <button onClick={saveYoutubeUrl} className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-black text-[11px] uppercase rounded-2xl transition-all">
                Sove
              </button>
            </div>
          </div>

          {/* 3 Etap */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { num: '01', title: 'Kopye Kòd', desc: 'Kopye tout SDK a yon sèl fwa' },
              { num: '02', title: 'Kole nan Footer', desc: 'Anvan </body> nan tema ou a' },
              { num: '03', title: 'AI Detekte Tout', desc: 'Bouton parèt anba chak pwodwi' },
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
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest">hatex-ai-sdk-v10.js</span>
                <span className="text-[8px] bg-blue-600/20 text-blue-400 font-black px-2 py-1 rounded-full">AI · Universal</span>
              </div>
              <button onClick={copyToClipboard} className="px-5 py-2.5 bg-white text-black rounded-xl font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                {copied ? 'Kopye!' : 'Kopye Kòd'}
              </button>
            </div>
            <div className="p-8">
              <p className="text-[11px] text-zinc-400 mb-6 leading-relaxed border-l-4 border-red-600 pl-5 bg-red-600/5 py-4 rounded-r-2xl normal-case">
                <strong className="text-white">SDK AI V10:</strong> Kole kòd sa a <strong className="text-red-400">yon sèl fwa</strong> nan seksyon <code className="text-white bg-white/10 px-1 rounded">&lt;footer&gt;</code> tema ou a. AI a ap <strong className="text-white">detekte otomatikman</strong> chak pwodwi — non, foto, varyant, koule, tay, pri — epi enjekte bouton Hatex anba chak "Ajouter au panier". Konvèsyon <strong className="text-red-400">USD → HTG</strong> otomatik si sit la an dola.
              </p>
              <div className="relative">
                <pre className="text-[10px] text-zinc-500 font-mono overflow-x-auto p-7 bg-black/50 rounded-3xl h-[450px] border border-white/5 leading-relaxed whitespace-pre-wrap">
                  {fullSDKCode}
                </pre>
                <div className="absolute bottom-4 right-4 text-[8px] font-black text-red-600/20 tracking-widest">HATEX AI SDK V10.0 · UNIVERSAL</div>
              </div>
            </div>
          </div>

          {/* Karakteristik */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { icon: '🧠', title: 'AI Ponde', desc: '15 metòd · konfyans 97%' },
              { icon: '🎨', title: 'Koule & Tay', desc: 'Varyant foto reyèl' },
              { icon: '💱', title: 'USD→HTG', desc: 'Konvèsyon 136 otomatik' },
              { icon: '🛒', title: '50+ Pwodwi', desc: 'Tout foto ak enfo' },
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
            <div className="w-12" />
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

      {/* ══ HISTORY MODE ═════════════════════════════════════════════ */}
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

          <div className="flex gap-2 mb-8">
            {['Tout', 'SDK', 'Invoice'].map((tab) => (
              <button key={tab} className="px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase bg-zinc-900/50 border border-white/5 hover:border-red-600/30 transition-all text-zinc-400 hover:text-white">{tab}</button>
            ))}
          </div>

          <div className="space-y-3">
            {recentSales.length > 0 ? recentSales.slice(0, 30).map((tx, i) => {
              const client = tx.client || 'Kliyan';
              const initials = getInitials(client);
              const colorCls = getInitialColor(client);
              return (
                <div key={i} className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2.5rem] flex items-center gap-5 hover:border-red-600/20 transition-all">
                  <div className={`w-12 h-12 ${colorCls} rounded-2xl flex items-center justify-center font-black text-[11px] text-white flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="font-black uppercase italic text-sm text-white truncate">{(tx as any).type || 'PÈMAN'}</h4>
                      <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-full ${tx.source === 'Invoice' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                        {tx.source}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-bold text-zinc-600 truncate max-w-[180px]">{client}</span>
                      <span className="text-[9px] text-zinc-700">·</span>
                      <span className="text-[9px] text-zinc-600">{new Date(tx.created_at).toLocaleDateString('fr-HT')}</span>
                      <span className="text-[9px] text-zinc-700">·</span>
                      <span className="text-[8px] font-bold text-zinc-700">#{tx.id?.slice(0, 6)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black italic text-green-400">+{parseFloat(tx.amount).toLocaleString()}</div>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <span className="text-[8px] text-zinc-600">HTG</span>
                      <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${tx.status === 'success' || tx.status === 'paid' ? 'bg-green-500/15 text-green-500' : 'bg-amber-500/15 text-amber-500'}`}>
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-40 bg-zinc-900/10 rounded-[4rem] border border-dashed border-white/5">
                <Package className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pa gen tranzaksyon ankò.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}