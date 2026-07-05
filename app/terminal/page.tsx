"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Terminal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
import { checkSpendingLimit } from '@/lib/security/spending-limits';
import { ensureMerchantApiCredentials, canAccessTerminal } from '@/lib/security/merchant-provisioning';
import { 
  History, Mail, LayoutGrid, Copy, CheckCircle2, 
  ArrowLeft, Globe, Wallet, RefreshCw, ShieldCheck,
  User, AlertTriangle, Lock, Box, FileText, Upload, 
  Filter, Download, TrendingUp, Package, BarChart3,
  ArrowUpRight, DollarSign, Zap, Play, Youtube,
  Code, CreditCard, Settings, Bell, HelpCircle,
  Clock, CheckSquare, XCircle, Eye, Edit, Trash2,
  PlusCircle, List, Grid, Search, Calendar,
  DownloadCloud, UploadCloud, Key, Shield, Link,
  Smartphone, Monitor, Server, Cloud, DownloadIcon,
  ShoppingBag, PenTool, Chrome, Wifi, Image, QrCode,
  Loader2 // 👈 MEN KOTE MWEN KORIJE ERÈ A
} from 'lucide-react';

// Konpozan QR (itilize qrcode pou desine canvas)
const QRCodeComponent = ({ value, size = 150 }: { value: string; size?: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, { width: size }, (error) => {
        if (error) console.error('QR Code generation error:', error);
      });
    }
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} className="mx-auto" />;
};

export default function TerminalPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [mode, setMode] = useState<'dashboard' | 'plugins' | 'invoices' | 'transactions' | 'settings'>('dashboard');
  const [subMode, setSubMode] = useState<'list' | 'create' | 'details'>('list');
  
  // Data states
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  

  const [activeTab, setActiveTab] = useState('plugins'); 
  const [copiedKey, setCopiedKey] = useState(false);
  const [defaultUsdRate, setDefaultUsdRate] = useState('135');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [downloadingPlugin, setDownloadingPlugin] = useState<string | null>(null);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  
  // Form states
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  
  // Filter states
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Token pou QR kòd la (sekirite)
  const [paymentToken, setPaymentToken] = useState<string | null>(null);

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // ============================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================
  useEffect(() => {
    if (!profile?.id) return;

    const transactionChannel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTransactions(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTransactions(prev => prev.map(tx => tx.id === payload.new.id ? payload.new : tx));
          } else if (payload.eventType === 'DELETE') {
            setTransactions(prev => prev.filter(tx => tx.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const invoiceChannel = supabase
      .channel('invoices-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `owner_id=eq.${profile.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setInvoices(prev => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setInvoices(prev => prev.map(inv => inv.id === payload.new.id ? payload.new : inv));
          } else if (payload.eventType === 'DELETE') {
            setInvoices(prev => prev.filter(inv => inv.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(transactionChannel);
      supabase.removeChannel(invoiceChannel);
    };
  }, [profile?.id, supabase]);

  // ============================================================
  // Jwenn token pou QR kòd (lè KYC apwouve)
  // ============================================================
  useEffect(() => {
    if (profile?.kyc_status === 'approved') {
      fetch('/api/payment-token')
        .then(res => res.json())
        .then(data => {
          if (data.token) setPaymentToken(data.token);
        })
        .catch(err => console.error('Error fetching payment token:', err));
    }
  }, [profile?.kyc_status]);

  // ============================================================
  // FONKSYON POU JENERE API KEY
  // ============================================================
  const generateApiKey = useCallback(async () => {
    if (!profile?.id) return null;

    try {
      setGeneratingApiKey(true);

      let result: Awaited<ReturnType<typeof ensureMerchantApiCredentials>> | null = null;
      try {
        const res = await fetch('/api/developer/provision', { method: 'POST' });
        const payload = await res.json();
        if (res.ok) {
          result = {
            api_key: payload.api_key,
            is_merchant: payload.is_merchant,
            webhook_secret: payload.webhook_secret,
            provisioned: payload.provisioned,
            eligibility: payload.eligibility,
          };
        } else if (payload.eligibility) {
          result = {
            api_key: profile.api_key || null,
            is_merchant: profile.is_merchant === true,
            webhook_secret: profile.webhook_secret || null,
            provisioned: false,
            eligibility: payload.eligibility,
          };
        }
      } catch {
        /* fallback kliyan */
      }

      if (!result) {
        result = await ensureMerchantApiCredentials(supabase, profile);
      }

      if (!result.eligibility.eligible) {
        if (result.eligibility.missingKyc) {
          alert('KYC kont ou poko apwouve. Tanpri tann apwobasyon admin sou paj /kyc la.');
        } else if (result.eligibility.missingCardActivation) {
          alert('Ou dwe peye frè aktivasyon Kat Vityèl la (520 HTG) sou paj /kat anvan w jwenn aksè API a.');
        }
        return null;
      }

      setProfile({
        ...profile,
        api_key: result.api_key,
        is_merchant: true,
        webhook_secret: result.webhook_secret,
      });
      return result.api_key;
    } catch (error) {
      console.error('Error generating API key:', error);
      return null;
    } finally {
      setGeneratingApiKey(false);
    }
  }, [profile, supabase]);

  // ============================================================
  // FONKSYON POU TELECHAJE LOGO
  // ============================================================
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Tanpri chwazi yon fichye imaj (JPEG, PNG, etc.)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Imaj la twò gwo. Maks 2MB.');
      return;
    }

    setUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        if (uploadError.message.includes('bucket')) {
          alert('Bucket "avatars" pa egziste. Tanpri kreye l nan Supabase Storage.');
        } else {
          alert('Erè pandan telechajman: ' + uploadError.message);
        }
        setUploadingLogo(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) {
        alert('Erè pandan sove done pwofil la.');
        setUploadingLogo(false);
        return;
      }

      setProfile({ ...profile, avatar_url: avatarUrl });
      alert('Logo telechaje avèk siksè!');

    } catch (err: any) {
      console.error('Erè inatandi:', err);
      alert('Erè inatandi. Tcheke konsola a pou plis detay.');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  // ============================================================
  // INITIALIZATION
  // ============================================================
  useEffect(() => {
    let isMounted = true;
    let hasGeneratedKey = false;

    const init = async () => {
      try {
        setLoading(true);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        let { data: prof, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code === 'PGRST116') {
          const { data: newProf, error: insertError } = await supabase
            .from('profiles')
            .insert({ id: user.id, email: user.email })
            .select()
            .single();
          
          if (insertError) throw insertError;
          prof = newProf;
        } else if (error) {
          throw error;
        }

        if (!isMounted) return;

        if (!canAccessTerminal(prof)) {
          alert('Ou dwe gen KYC apwouve epi kat aktive anvan w itilize Terminal la.');
          router.push('/dashboard');
          return;
        }

        setProfile(prof);
        setBusinessName(prof.business_name || '');
        setYoutubeUrl(prof.sdk_tutorial_url || '');

        // 🔐 Oto-pwovizyone kredansyèl API SÈLMAN si kont lan elijib
        // (KYC apwouve E kat aktive). Helper la konplete sa ki manke san
        // regenere api_key ki egziste deja (pou pa kraze entegrasyon k ap mache).
        if (!hasGeneratedKey && (!prof.api_key || !prof.is_merchant || !prof.webhook_secret)) {
          hasGeneratedKey = true;
          try {
            const provRes = await fetch('/api/developer/provision', { method: 'POST' });
            if (provRes.ok) {
              const result = await provRes.json();
              if (isMounted) {
                setProfile({ ...prof, api_key: result.api_key, is_merchant: true, webhook_secret: result.webhook_secret });
              }
            } else {
              const clientProv = await ensureMerchantApiCredentials(supabase, prof);
              if (clientProv.provisioned && isMounted) {
                setProfile({ ...prof, api_key: clientProv.api_key, is_merchant: true, webhook_secret: clientProv.webhook_secret });
              }
            }
          } catch {
            try {
              const clientProv = await ensureMerchantApiCredentials(supabase, prof);
              if (clientProv.provisioned && isMounted) {
                setProfile({ ...prof, api_key: clientProv.api_key, is_merchant: true, webhook_secret: clientProv.webhook_secret });
              }
            } catch {
              /* pwovizyone ap eseye ankò lè itilizatè a klike API */
            }
          }
        }

        const [txResult, invResult] = await Promise.all([
          supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('invoices').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
        ]);

        if (isMounted) {
          setTransactions(txResult.data || []);
          setInvoices(invResult.data || []);
        }

      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();

    return () => { isMounted = false; };
  }, [supabase, router]);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================
  const earnings = useMemo(() => {
    const sdkSales = transactions.filter(tx => 
      (tx.type === 'SALE_SDK' || tx.type === 'SALE') && tx.status === 'success'
    );
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    
    const sdkTotal = sdkSales.reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);
    const invoiceTotal = paidInvoices.reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
    
    const now = new Date();
    const thisMonth = 
      sdkSales.filter(tx => new Date(tx.created_at).getMonth() === now.getMonth())
        .reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0) +
      paidInvoices.filter(inv => new Date(inv.created_at).getMonth() === now.getMonth())
        .reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0);
    
    return { 
      sdkTotal, 
      invoiceTotal, 
      total: sdkTotal + invoiceTotal, 
      thisMonth, 
      sdkCount: sdkSales.length, 
      invoiceCount: paidInvoices.length 
    };
  }, [transactions, invoices]);

  // ============================================================
  // STATISTIK ESPESYAL POU QR KÒD
  // ============================================================
  const qrTransactions = useMemo(() => {
    return transactions.filter(tx => 
      tx.type === 'SALE' && 
      tx.status === 'success' && 
      (
        tx.metadata?.payment_method === 'qrcode' || 
        tx.metadata?.platform === 'qr' || 
        tx.description?.toLowerCase().includes('qr')
      )
    );
  }, [transactions]);

  const qrStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const last24hLimit = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    const total = qrTransactions.reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);
    const thisMonth = qrTransactions
      .filter(tx => new Date(tx.created_at).getMonth() === now.getMonth() && new Date(tx.created_at).getFullYear() === now.getFullYear())
      .reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);
    const todayTotal = qrTransactions
      .filter(tx => new Date(tx.created_at).toDateString() === todayStr)
      .reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);
    const last24hTotal = qrTransactions
      .filter(tx => new Date(tx.created_at) >= last24hLimit)
      .reduce((s, tx) => s + (parseFloat(tx.amount) || 0), 0);

    return { total, thisMonth, today: todayTotal, last24h: last24hTotal, count: qrTransactions.length };
  }, [qrTransactions]);

  // ============================================================
  // FILTRE INVOICES AK RECENT SALES
  // ============================================================
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices];
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }
    const now = new Date();
    if (dateRange === 'today') {
      const today = now.toDateString();
      filtered = filtered.filter(inv => new Date(inv.created_at).toDateString() === today);
    } else if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      filtered = filtered.filter(inv => new Date(inv.created_at) >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      filtered = filtered.filter(inv => new Date(inv.created_at) >= monthAgo);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv => 
        inv.client_email?.toLowerCase().includes(term) ||
        inv.description?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [invoices, statusFilter, dateRange, searchTerm]);

  const recentSales = useMemo(() => {
    const sdk = transactions
      .filter(tx => (tx.type === 'SALE_SDK' || tx.type === 'SALE') && tx.status === 'success')
      .map(tx => ({ 
        ...tx, 
        source: tx.metadata?.payment_method === 'qrcode' ? 'QR' : 'SDK', 
        client: tx.metadata?.customer_name || tx.customer_name || tx.customer_email || 'Kliyan Hatex' 
      }));
      
    const inv = invoices
      .filter(i => i.status === 'paid')
      .map(i => ({ 
        ...i, 
        source: 'Invoice', 
        client: i.client_email || 'Kliyan Invoice', 
        type: 'INVOICE' 
      }));
      
    return [...sdk, ...inv]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 20);
  }, [transactions, invoices]);

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  const getInitials = (s: string) => {
    if (!s) return '??';
    const name = s.includes('@') ? s.split('@')[0].replace(/[._-]/g, ' ') : s;
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
    return parts.slice(0, 3).map(p => p[0]).join('').toUpperCase();
  };
  
  const getInitialColor = (s: string) => {
    const c = ['bg-indigo-600','bg-blue-600','bg-emerald-600','bg-violet-600','bg-amber-600','bg-pink-600','bg-cyan-600'];
    let h = 0; 
    for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
    return c[Math.abs(h) % c.length];
  };

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : '';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-HT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + ' HTG';
  };

  const paymentUrl = useMemo(() => {
    if (!paymentToken) return '';
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    return `${baseUrl}/checkout?token=${paymentToken}`;
  }, [paymentToken]);

  const downloadQR = () => {
    const canvas = document.querySelector('#hatex-qr-code canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `hatex-qr-${profile?.id?.slice(0,8)}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  // ============================================================
  // JENERE HOSTINGER
  // ============================================================
  const generateHostingerPlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved') return alert('KYC ou poko apwouve. Tanpri tann apwobasyon an.');
    if (!profile?.api_key) return alert('Kle API poko jenere. Tanpri reyese answit.');

    setDownloadingPlugin('hostinger');
    try {
      const zip = new JSZip();

      // 🔧 KORIJE: ansyen vèsyon an te jenere yon config .json ki pwente sou
      // "https://api.hatexcard.com/v1" (yon domèn/vèsyon ki PA JANM egziste)
      // ak yon "embed-code.html" ki te yon script vid san okenn fonksyon reyèl.
      // Kounye a nou jenere yon entegrasyon PHP+HTML FONKSYONÈL ki rele
      // VRÈ API ofisyèl la (/api/public/payments), ki mache sou tout
      // ebèjman Hostinger ki sipòte PHP (plan pati aza yo genyen PHP+cURL).
      const checkoutPhp = `<?php
/**
 * HatexCard — Entegrasyon Sekirize pou Hostinger
 * Machann: ${profile.business_name || 'HATEX Merchant'}
 *
 * Fichye sa a rele API OFISYÈL HatexCard la (/api/public/payments) ak kle
 * sekrè w la GADE SÈLMAN BÒ SÈVÈ a (li pa janm ekspoze nan navigatè kliyan an).
 * Kole "embed-code.html" nan paj peman w lan, epi telechaje fichye sa a nan
 * rasin sit ou a sou Hostinger (bò kote fichye HTML/PHP ou yo).
 */

if (\$_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Metòd sa a pa sipòte.']);
    exit;
}

header('Content-Type: application/json');

\$HATEX_API_KEY = '${profile.api_key}';
\$HATEX_API_URL = 'https://hatexcard.com/api/public/payments';

\$amount = isset(\$_POST['amount']) ? floatval(\$_POST['amount']) : 0;
\$order_id = isset(\$_POST['order_id']) ? substr(preg_replace('/[^a-zA-Z0-9_-]/', '', \$_POST['order_id']), 0, 50) : ('CMD-' . time());
\$card_number = isset(\$_POST['card_number']) ? preg_replace('/\\D/', '', \$_POST['card_number']) : '';
\$card_exp = isset(\$_POST['card_exp']) ? preg_replace('/\\D/', '', \$_POST['card_exp']) : '';
\$card_cvv = isset(\$_POST['card_cvv']) ? preg_replace('/\\D/', '', \$_POST['card_cvv']) : '';

if (\$amount <= 0 || strlen(\$card_number) < 15 || strlen(\$card_cvv) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'Done kat oswa montan an pa valab.']);
    exit;
}

\$payload = json_encode([
    'amount' => \$amount,
    'currency' => 'HTG',
    'order_id' => \$order_id,
    'card_info' => [
        'number' => \$card_number,
        'exp' => \$card_exp,
        'cvv' => \$card_cvv,
    ],
]);

\$ch = curl_init(\$HATEX_API_URL);
curl_setopt(\$ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt(\$ch, CURLOPT_POST, true);
curl_setopt(\$ch, CURLOPT_POSTFIELDS, \$payload);
curl_setopt(\$ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . \$HATEX_API_KEY,
]);
curl_setopt(\$ch, CURLOPT_TIMEOUT, 30);

\$response = curl_exec(\$ch);
\$statusCode = curl_getinfo(\$ch, CURLINFO_HTTP_CODE);
\$curlErr = curl_error(\$ch);
curl_close(\$ch);

if (\$response === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Pa ka kontakte sèvè HatexCard la: ' . \$curlErr]);
    exit;
}

http_response_code(\$statusCode ?: 500);
echo \$response;
`;

      const embedHtml = `<!-- HatexCard — Fòmilè Peman (kole sa nan paj peman w lan) -->
<form id="hatex-payment-form" style="max-width:380px;margin:0 auto;font-family:sans-serif;">
  <div style="margin-bottom:10px;">
    <label>Nimewo Kat HatexCard</label>
    <input type="tel" id="hatex-card-number" maxlength="19" placeholder="0000 0000 0000 0000" required style="width:100%;padding:10px;box-sizing:border-box;">
  </div>
  <div style="display:flex;gap:10px;margin-bottom:10px;">
    <div style="flex:1;">
      <label>Dat (MM/YY)</label>
      <input type="tel" id="hatex-card-exp" maxlength="5" placeholder="MM/YY" required style="width:100%;padding:10px;box-sizing:border-box;">
    </div>
    <div style="flex:1;">
      <label>CVV</label>
      <input type="password" id="hatex-card-cvv" maxlength="4" placeholder="123" required style="width:100%;padding:10px;box-sizing:border-box;">
    </div>
  </div>
  <button type="submit" style="width:100%;padding:12px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Peye Kounye a</button>
  <p id="hatex-payment-status" style="margin-top:10px;font-size:14px;"></p>
</form>

<script>
document.getElementById('hatex-payment-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  const status = document.getElementById('hatex-payment-status');
  status.textContent = 'Y ap trete peman an...';

  // ⚠️ RANPLASE valè sa yo ak vrè montan/ID kòmand ou an anvan w mete l an pwodiksyon
  const AMOUNT_HTG = 1500;
  const ORDER_ID = 'CMD-' + Date.now();

  const formData = new FormData();
  formData.append('amount', AMOUNT_HTG);
  formData.append('order_id', ORDER_ID);
  formData.append('card_number', document.getElementById('hatex-card-number').value);
  formData.append('card_exp', document.getElementById('hatex-card-exp').value);
  formData.append('card_cvv', document.getElementById('hatex-card-cvv').value);

  try {
    const res = await fetch('/hatex-checkout.php', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      status.style.color = '#16a34a';
      status.textContent = '✅ Peman reyisi! Referans: ' + data.transaction_id;
    } else {
      status.style.color = '#dc2626';
      status.textContent = '❌ ' + (data.error || 'Peman refize.');
    }
  } catch (err) {
    status.style.color = '#dc2626';
    status.textContent = '❌ Erè koneksyon ak sèvè a.';
  }
});
</script>`;

      const readme = `# HatexCard — Entegrasyon Hostinger

Pake sa a jenere pou: **${profile.business_name || 'HATEX Merchant'}**

## Enstalasyon

1. Telechaje \`hatex-checkout.php\` nan rasin sit ou a sou Hostinger (bò kote paj HTML/PHP ou yo). Ebèjman an dwe sipòte PHP ak ekstansyon cURL (aktive pa default sou Hostinger).
2. Kole kontni \`embed-code.html\` la nan paj peman w lan (kote w vle fòmilè kat la parèt).
3. Nan \`embed-code.html\`, ranplase \`AMOUNT_HTG\` ak \`ORDER_ID\` ak vrè valè kòmand kliyan an (dinamik, selon panye acha w la).
4. Sa se sa: fòmilè a rele \`/hatex-checkout.php\` ki limenm rele API ofisyèl HatexCard la (\`https://hatexcard.com/api/public/payments\`) ak kle API w la — kle a rete SÈLMAN bò sèvè a, li pa janm vizib nan navigatè kliyan an.

## Enpòtan

- Sa a se yon PEMAN IMEDYA (kòb la transfere san eskwo/OTP). Si w bezwen yon sistèm eskwo ak kòd livrezon, kontakte sipò HatexCard.
- Pa janm mete \`hatex-checkout.php\` nan yon dosye piblik ki lis fichye otomatikman.
- Kle API w la se yon sekrè — pa janm mete l nan kòd JavaScript kliyan (navigatè).
`;

      zip.file('hatex-checkout.php', checkoutPhp);
      zip.file('embed-code.html', embedHtml);
      zip.file('README.md', readme);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatex-hostinger-${profile.id.slice(0,8)}.zip`);
    } catch (error) {
      alert('Erè pandan jenere Hostinger plugin an.');
    } finally {
      setDownloadingPlugin(null);
    }
  };

// ============================================================
  // JENERE WOOCOMMERCE PLUGIN (VÈSYON 22.0 - AK BOUTON TELECHAJE PDF)
  // ============================================================
  const generateWooCommercePlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved') return alert('Ou dwe pase KYC pou w itilize Plugin sa a.');
    if (!profile?.api_key) return alert('Kle API w la manke.');

    setDownloadingPlugin('woocommerce');
    
    try {
      const zip = new JSZip();
      const pluginDir = zip.folder("hatexcard-woocommerce");

      const phpCode = `<?php
/**
 * Plugin Name: HatexCard Direct Gateway PRO
 * Plugin URI: https://hatexcard.com
 * Description: Peman Ultra-Sekirize (imedya). Skane foto, size, ak Resi PDF pou kliyan an.
 * Version: 22.0.0
 * Author: Hatex Group
 */

if (!defined('ABSPATH')) exit;

add_filter('render_block', 'hatexcard_universal_checkout_adapter', 10, 2);
function hatexcard_universal_checkout_adapter(\$block_content, \$block) {
    if (\$block['blockName'] === 'woocommerce/checkout') {
        return '<div class="woocommerce">' . do_shortcode('[woocommerce_checkout]') . '</div>';
    }
    return \$block_content;
}

add_action('plugins_loaded', 'hatexcard_init_direct_gateway');

function hatexcard_init_direct_gateway() {
    if (!class_exists('WC_Payment_Gateway')) return;

    class WC_Gateway_HatexCard_Direct extends WC_Payment_Gateway {
        
        public function __construct() {
            \$this->id = 'hatexcard_direct';
            \$this->has_fields = true; 
            \$this->method_title = 'HatexCard';
            \$this->method_description = 'Peman imedya sekirize pa kat HatexCard, ak resi PDF pou kliyan an.';

            \$this->init_form_fields();
            \$this->init_settings();

            \$this->title = \$this->get_option('title');
            \$this->description = \$this->get_option('description');
            \$this->usd_rate = \$this->get_option('usd_rate', '${defaultUsdRate}');
            
            \$this->merchant_api_key = '${profile.api_key}'; 
            \$this->api_direct_url = 'https://hatexcard.com/api/public/payments';

            add_action('woocommerce_update_options_payment_gateways_' . \$this->id, array(\$this, 'process_admin_options'));
            add_action('woocommerce_thankyou_' . \$this->id, array(\$this, 'custom_thankyou_page'));
        }

        public function init_form_fields() {
            \$this->form_fields = array(
                'enabled' => array('title' => 'Aktive', 'type' => 'checkbox', 'default' => 'yes'),
                'title' => array('title' => 'Tit', 'type' => 'text', 'default' => 'Peye ak HatexCard'),
                'description' => array('title' => 'Deskripsyon', 'type' => 'textarea', 'default' => 'Mete enfòmasyon kat HatexCard ou anba a.'),
                'usd_rate' => array('title' => 'To Dola (1 USD = ? HTG)', 'type' => 'number', 'default' => '${defaultUsdRate}')
            );
        }

        // BA BÈL RESI A AK BOUTON PDF LA
        public function custom_thankyou_page(\$order_id) {
            \$order = wc_get_order(\$order_id);
            \$ref = \$order->get_meta('_hatexcard_transaction_id');
            if (!\$ref) return;

            echo '<style>
                    @media print {
                        body * { visibility: hidden; }
                        #hatex-receipt-area, #hatex-receipt-area * { visibility: visible; }
                        #hatex-receipt-area { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; padding: 20px; }
                        .no-print { display: none !important; }
                    }
                  </style>';

            echo '<div id="hatex-receipt-area" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 30px; border-radius: 16px; margin-bottom: 40px; text-align: center;">
                    <div style="margin-bottom: 20px;">
                        <span style="background: #4f46e5; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 12px; text-transform: uppercase;">Prèv Peman HatexCard</span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #475569; font-weight: 600; text-transform: uppercase;">Referans Tranzaksyon:</p>
                    <h2 style="margin: 15px 0; font-size: 32px; color: #1e293b; font-family: monospace; font-weight: 900; letter-spacing: 4px;">' . esc_html(\$ref) . '</h2>
                    <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 20px;">Kòmand #' . \$order_id . ' - Peman an konfime imedyatman.</p>
                    
                    <button class="no-print" onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; cursor: pointer; text-transform: uppercase; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        Enprime / Sove kòm PDF
                    </button>
                  </div>';
        }

        public function payment_fields() {
            if (\$this->description) echo wpautop(wp_kses_post(\$this->description));
            ?>
            <fieldset id="wc-hatexcard-direct-form" class="wc-payment-form" style="background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 15px;">
                <style>
                    .hatex-field { margin-bottom: 15px; }
                    .hatex-field label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #475569; margin-bottom: 6px; }
                    .hatex-input { width: 100% !important; padding: 12px !important; border-radius: 8px !important; border: 1px solid #cbd5e1 !important; font-size: 15px !important; }
                    .hatex-input:focus { border-color: #4f46e5 !important; outline: none; }
                </style>
                <div class="hatex-field">
                    <label>Nimewo Kat HatexCard <span class="required">*</span></label>
                    <input type="tel" name="hatex_card_number" class="hatex-input" placeholder="0000 0000 0000 0000" maxlength="19" inputmode="numeric">
                </div>
                <div style="display: flex; gap: 15px;">
                    <div class="hatex-field" style="flex: 1;">
                        <label>Dat (MM/YY) <span class="required">*</span></label>
                        <input type="tel" name="hatex_expiry" class="hatex-input" placeholder="MM/YY" maxlength="5" inputmode="numeric">
                    </div>
                    <div class="hatex-field" style="flex: 1;">
                        <label>CVV <span class="required">*</span></label>
                        <input type="password" name="hatex_cvv" class="hatex-input" placeholder="***" maxlength="4" inputmode="numeric">
                    </div>
                </div>
            </fieldset>

            <script>
                jQuery(document).ready(function(\$) {
                    \$(document).on('input', 'input[name="hatex_card_number"]', function() {
                        var v = \$(this).val().replace(/\\D/g, '').substring(0, 16);
                        var p = v.match(/.{1,4}/g);
                        \$(this).val(p ? p.join(' ') : v);
                    });
                    \$(document).on('input', 'input[name="hatex_expiry"]', function() {
                        var v = \$(this).val().replace(/\\D/g, '').substring(0, 4);
                        if (v.length > 2) \$(this).val(v.substring(0, 2) + '/' + v.substring(2, 4));
                        else \$(this).val(v);
                    });
                });
            </script>
            <?php
        }

        public function process_payment(\$order_id) {
            global \$woocommerce;
            \$order = wc_get_order(\$order_id);
            
            \$items = \$order->get_items();
            \$products_array = array();
            foreach (\$items as \$item) {
                \$product = \$item->get_product();
                \$image_id = \$product->get_image_id();
                \$image_url = \$image_id ? wp_get_attachment_image_url(\$image_id, 'full') : '';
                
                \$meta_string = '';
                if (\$item->get_variation_id()) {
                    \$meta_string = wc_get_formatted_variation(\$product, true);
                }

                \$products_array[] = array(
                    'name'  => \$item->get_name(),
                    'qty'   => \$item->get_quantity(),
                    'total' => \$item->get_total(), 
                    'image' => \$image_url,
                    'meta'  => \$meta_string
                );
            }

            \$total_usd = \$order->get_total();
            \$amount_htg = \$total_usd * floatval(\$this->usd_rate);
            \$full_address = \$order->get_formatted_shipping_address() ?: \$order->get_formatted_billing_address();

            \$payload = array(
                'amount' => \$amount_htg,
                'currency' => 'HTG',
                'order_id' => \$order_id,
                'card_info' => array(
                    'number' => str_replace(' ', '', \$_POST['hatex_card_number']),
                    'exp' => \$_POST['hatex_expiry'],
                    'cvv' => \$_POST['hatex_cvv']
                ),
                'customer_info' => array(
                    'name' => \$order->get_billing_first_name() . ' ' . \$order->get_billing_last_name(),
                    'email' => \$order->get_billing_email(),
                    'phone' => \$order->get_billing_phone(),
                    'address' => \$full_address,
                    'products' => \$products_array,
                    'usd_total' => \$total_usd
                )
            );

            \$response = wp_remote_post(\$this->api_direct_url, array(
                'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . \$this->merchant_api_key),
                'body'    => json_encode(\$payload),
                'timeout' => 30
            ));

            if (is_wp_error(\$response)) { wc_add_notice('Sèvè HatexCard pa reponn.', 'error'); return; }

            \$body = json_decode(wp_remote_retrieve_body(\$response), true);

            if (isset(\$body['success']) && \$body['success'] === true) {
                \$txRef = isset(\$body['transaction_id']) ? \$body['transaction_id'] : '';
                \$order->update_meta_data('_hatexcard_transaction_id', \$txRef);
                \$order->payment_complete();
                \$order->add_order_note('Peman reyisi ak HatexCard. Referans: ' . \$txRef);
                \$woocommerce->cart->empty_cart();
                return array('result' => 'success', 'redirect' => \$this->get_return_url(\$order));
            } else {
                wc_add_notice('HatexCard: ' . (\$body['error'] ?? 'Peman refize.'), 'error');
                return;
            }
        }
    }
}

add_filter('woocommerce_payment_gateways', function(\$methods) {
    \$methods[] = 'WC_Gateway_HatexCard_Direct';
    return \$methods;
});
?>`;

      pluginDir?.file("hatexcard-gateway.php", phpCode);
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatexcard-woocommerce.zip`);

    } catch (error) {
      alert('Erè nan jenere Plugin nan.');
    } finally {
      setDownloadingPlugin(null);
    }
  };

  const saveYoutubeUrl = async () => {
    if (!profile?.id) return;
    await supabase.from('profiles').update({ sdk_tutorial_url: youtubeUrl }).eq('id', profile.id);
    alert('URL videyo a sove!');
  };

  const updateBusinessName = async () => {
    if (!businessName) return alert("Tanpri antre yon non biznis.");
    if (profile?.business_name) {
      alert("Ou pa ka modifye non biznis apre li fin anrejistre.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({ business_name: businessName }).eq('id', profile?.id);
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
      
      const { data: freshProfile } = await supabase.from('profiles').select('kyc_status, business_name, account_type').eq('id', user.id).single();
        
      if (freshProfile?.kyc_status !== 'approved') {
        alert(`Echèk: Kont ou dwe 'approved'.`);
        setMode('dashboard');
        return;
      }

      // Limit anti-fwod: kont endividyèl kanpe a 85,000 HTG/jou an fakti; kont Antrepriz ilimite.
      const limitCheck = await checkSpendingLimit(supabase, user.id, freshProfile?.account_type, parseFloat(amount), 'invoice');
      if (!limitCheck.allowed) {
        alert(limitCheck.message || "Ou depase limit jounalye fakti a.");
        setLoading(false);
        return;
      }
      
      const { data: inv, error: invError } = await supabase.from('invoices').insert({ owner_id: user.id, amount: parseFloat(amount), client_email: email.toLowerCase().trim(), status: 'pending', description }).select().single();
      if (invError) throw invError;
      
      const securePayLink = `${window.location.origin}/checkout-invoice/${inv.id}`;
      
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ table: 'invoices', record: { id: inv.id, amount: inv.amount, client_email: inv.client_email, business_name: freshProfile.business_name || "Merchant Hatex", pay_url: securePayLink }})
      });
      
      await navigator.clipboard.writeText(securePayLink);
      alert(`Siksè! Lyen kopye.`);
      setAmount(''); setEmail(''); setDescription(''); setSubMode('list');
      
      const { data: newInv } = await supabase.from('invoices').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
      setInvoices(newInv || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBalance = async () => {
    if (earnings.total <= 0) return alert("Pa gen okenn revni pou senkronize.");
    setSyncing(true);
    try {
      const { error } = await supabase.rpc('increment_merchant_balance', { merchant_id: profile?.id, amount_to_add: earnings.total });
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
    if (!file || file.type !== 'application/pdf') return alert('Tanpri chwazi yon dosye PDF.');
    setUploadingPdf(true);
    try {
      await new Promise(res => setTimeout(res, 2000));
      alert("PDF sove sou sèvè Hatex la.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleMarkInvoiceAsPaid = async (invoiceId: string) => {
    try {
      const { error } = await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
      if (error) throw error;
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'paid' } : inv));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Èske w sèten ou vle efase fakti sa?')) return;
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
      if (error) throw error;
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    } catch (err: any) {
      alert(err.message);
    }
  };

// ============================================================
  // RENDER FUNCTIONS
  // ============================================================
  
  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 border-b border-gray-200 pb-4 md:pb-6 gap-4">
      <div className="flex items-center gap-3">
        <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-10 h-10 rounded-xl border border-gray-200 shadow-sm bg-white p-1" />
        <div className="flex flex-col">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            {profile?.business_name || 'Hatex Terminal'}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`w-2 h-2 ${profile?.kyc_status === 'approved' ? 'bg-emerald-500' : 'bg-amber-500'} rounded-full animate-pulse`}></span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {profile?.kyc_status === 'approved' ? 'KYC Verified' : 'KYC Pending'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 sm:flex sm:flex-row flex-wrap gap-2 w-full md:w-auto">
        <button
          onClick={() => setMode('dashboard')}
          className={`flex flex-col md:flex-row items-center justify-center p-2 sm:px-4 sm:py-2.5 rounded-lg border font-bold text-[10px] uppercase transition-all ${
            mode === 'dashboard' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <LayoutGrid size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Dash<span className="hidden md:inline">board</span></span>
        </button>

        <button
          onClick={() => setMode('plugins')}
          className={`flex flex-col md:flex-row items-center justify-center p-2 sm:px-4 sm:py-2.5 rounded-lg border font-bold text-[10px] uppercase transition-all ${
            mode === 'plugins' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <DownloadCloud size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Plugins</span>
        </button>

        <button
          onClick={() => { setMode('invoices'); setSubMode('list'); }}
          className={`flex flex-col md:flex-row items-center justify-center p-2 sm:px-4 sm:py-2.5 rounded-lg border font-bold text-[10px] uppercase transition-all ${
            mode === 'invoices' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <FileText size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Invoices</span>
        </button>

        <button
          onClick={() => setMode('transactions')}
          className={`flex flex-col md:flex-row items-center justify-center p-2 sm:px-4 sm:py-2.5 rounded-lg border font-bold text-[10px] uppercase transition-all ${
            mode === 'transactions' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <History size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Journal</span>
        </button>

        <button
          onClick={() => router.push('/developer')}
          className="flex flex-col md:flex-row items-center justify-center p-2 sm:px-4 sm:py-2.5 rounded-lg border font-bold text-[10px] uppercase transition-all bg-white border-gray-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50"
        >
          <Terminal size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>API <span className="hidden md:inline">/ Dev</span></span>
        </button>

        <button
          onClick={() => setMode('settings')}
          className={`flex flex-col md:flex-row items-center justify-center p-2 sm:px-4 sm:py-2.5 rounded-lg border font-bold text-[10px] uppercase transition-all ${
            mode === 'settings' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-gray-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
          }`}
        >
          <Settings size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="grid lg:grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-8 space-y-6 md:space-y-8">
        <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-sm group">
          <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <ShieldCheck size={100} className="text-indigo-600" />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 md:mb-8 relative z-10">
            <div className="bg-indigo-50 border border-indigo-100 p-3 md:p-4 rounded-xl">
              <Lock className="text-indigo-600 w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold tracking-tight text-slate-900">Merchant Identity</h3>
              <p className="text-xs text-slate-500 font-medium">Konfigire pwofil biznis piblik ou</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 relative z-10">
            <div className="relative flex-1 w-full">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                readOnly={!!profile?.business_name}
                placeholder="Non Legal Biznis Ou"
                className="w-full bg-slate-50 border border-gray-200 py-4 pl-12 pr-4 rounded-xl text-sm outline-none text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>
          </div>

          <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-gray-100 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-indigo-50 border border-indigo-100 p-3 md:p-4 rounded-xl">
                  <Image size={16} className="text-indigo-600 md:w-5 md:h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Logo Biznis</h4>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">JPEG, PNG, maks 2MB</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
              {profile?.avatar_url ? (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden bg-slate-100 border border-gray-200 shrink-0 shadow-sm">
                  <img src={profile.avatar_url} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-50 flex items-center justify-center border border-gray-200 shrink-0">
                  <Image size={24} className="text-slate-400" />
                </div>
              )}
              <label className="cursor-pointer w-full sm:w-auto bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-center font-bold text-xs shadow-sm">
                {uploadingLogo ? <RefreshCw size={16} className="animate-spin text-indigo-600" /> : <UploadCloud size={16} className="text-indigo-600" />}
                <span>Telechaje Logo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
            </div>
          </div>
          
          {profile?.kyc_status === 'approved' && (
            <div className="mt-8 pt-8 border-t border-gray-100 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">QR Kòd Peman</h4>
                <button
                  onClick={downloadQR}
                  className="flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-slate-700 px-4 py-2.5 rounded-lg font-bold text-xs transition-all shadow-sm w-full sm:w-auto"
                >
                  <Download size={14} className="text-indigo-600" /> Telechaje QR
                </button>
              </div>
              <div className="flex flex-col items-center bg-slate-50 border border-gray-100 p-6 md:p-8 rounded-2xl" id="hatex-qr-code">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200">
                  <QRCodeComponent value={paymentUrl} size={150} />
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-4 break-all w-full max-w-[250px] text-center truncate">
                  {paymentUrl}
                </p>
                <p className="text-xs text-slate-600 font-medium mt-2 text-center">
                  Skane sa a pou peye dirèkteman nan kont ou.
                </p>
              </div>
            </div>
          )}
        </div>



        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <QrCode className="text-emerald-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Peman QR Kòd</h3>
                <p className="text-xs text-slate-500 font-medium">Revni an tan reyèl</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <DollarSign size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Total QR</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{qrStats.total.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">HTG</div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <Calendar size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Mwa sa a</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{qrStats.thisMonth.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">HTG</div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <Clock size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Jodi a</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{qrStats.today.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">HTG</div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <TrendingUp size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Dènye 24h</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{qrStats.last24h.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">HTG</div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dènye Peman QR</span>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full font-bold uppercase w-fit">
                {qrStats.count} tranzaksyon QR
              </span>
            </div>

            {qrTransactions.length > 0 ? (
              <div className="space-y-3">
                {qrTransactions.slice(0, 5).map((tx: any) => {
                  const customerName = tx.metadata?.customer_name || 'Kliyan Hatex';
                  const initials = customerName.substring(0, 2).toUpperCase();
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xs text-slate-600 shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 truncate">{customerName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">QR SCAN</span>
                            <span className="text-[10px] text-slate-400 font-medium">{new Date(tx.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600">+{parseFloat(tx.amount).toLocaleString()}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">HTG</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-gray-200">
                <QrCode size={24} className="mx-auto mb-3 text-slate-300" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pa gen okenn vant QR detekte</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm mt-6 md:mt-8">
          <div className="p-6 md:p-8 border-b border-gray-100">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                <Mail className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">Peman Fakti</h3>
                <p className="text-xs text-slate-500 font-medium">Revni an tan reyèl</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <DollarSign size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Total Fakti</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{earnings.invoiceTotal.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">HTG</div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <CheckCircle2 size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Peye</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{earnings.invoiceCount}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">fakti</div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <Calendar size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Mwa sa a</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{(earnings.thisMonth - qrStats.thisMonth).toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">HTG</div>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                  <TrendingUp size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-wider">Mwayèn</span>
                </div>
                <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">{earnings.invoiceCount > 0 ? Math.round(earnings.invoiceTotal / earnings.invoiceCount).toLocaleString() : '0'}</div>
                <div className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase">HTG/fak</div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dènye Fakti</span>
              </div>
              <span className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold uppercase w-fit">
                {earnings.invoiceCount} fakti peye
              </span>
            </div>

            {invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.slice(0, 5).map((inv: any) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${inv.status === 'paid' ? 'bg-emerald-500' : inv.status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                        {inv.status === 'paid' ? <CheckCircle2 size={16} /> : inv.status === 'pending' ? <Clock size={16} /> : <XCircle size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{inv.client_email || 'Kliyan'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Fakti</span>
                          <span className="text-[10px] text-slate-400 font-medium">{formatDate(inv.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t sm:border-none border-gray-100 pt-3 sm:pt-0 gap-4">
                      <div className={`text-sm font-bold ${inv.status === 'paid' ? 'text-emerald-600' : 'text-slate-900'} shrink-0`}>
                        {inv.status === 'paid' ? '+' : ''}{parseFloat(inv.amount).toLocaleString()} HTG
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {inv.status === 'pending' && (
                          <>
                            <button onClick={() => handleMarkInvoiceAsPaid(inv.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-colors"><CheckSquare size={16} /></button>
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/checkout-invoice/${inv.id}`); alert("Lyen kopye!"); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 border border-indigo-100 transition-colors"><Copy size={16} /></button>
                          </>
                        )}
                        <button onClick={() => handleDeleteInvoice(inv.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 border border-rose-100 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-gray-200">
                <FileText size={24} className="mx-auto mb-3 text-slate-300" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pa gen fakti ankò</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl border border-indigo-100">
              <Wallet size={20} />
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Balans Wallet</p>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-1">
                {profile?.balance?.toLocaleString() || '0'}<span className="text-sm text-slate-500 ml-1">HTG</span>
              </h2>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-gray-100 rounded-2xl p-4 mb-6">
            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">An Atant pou Senkronize</p>
            <div className="flex justify-between items-center gap-2">
              <span className="text-lg font-bold text-indigo-600 truncate">{earnings.total.toLocaleString()} HTG</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-md uppercase tracking-wider">Disponib</span>
            </div>
          </div>
          
          <button 
            onClick={handleSyncBalance} 
            disabled={syncing || earnings.total <= 0} 
            className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {syncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Senkronize {earnings.total > 0 ? earnings.total.toLocaleString() + ' HTG' : ''}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPlugins = () => {
    return (
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
        <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Entegrasyon & API</h2>
          </div>
        </div>

        <div className="flex overflow-x-auto pb-4 gap-2 mb-6 custom-scrollbar">
          <button 
            onClick={() => setActiveTab('plugins')} 
            className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider whitespace-nowrap transition-all border ${activeTab === 'plugins' ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border-gray-200'}`}
          >
            Plugins
          </button>
        </div>

        {/* ZÒN KONTNI TABS YO */}
        {activeTab === 'plugins' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* WOOCOMMERCE PLUGIN CARD */}
            <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm flex flex-col h-full hover:border-indigo-300 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl"><ShoppingBag className="text-blue-600 w-6 h-6" /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">WooCommerce</h3>
                  <p className="text-slate-500 text-xs font-medium">WordPress Plugin</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-6 leading-relaxed">
                Fè sit ou a aksepte HatexCard. Konfigirasyon an gentan fèt otomatikman nan ZIP ou pral telechaje a.
              </p>
              
              <div className="mb-8">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-2">To Echanj Dola (1 USD = ? HTG)</label>
                <input 
                  type="number" 
                  value={defaultUsdRate} 
                  onChange={(e) => setDefaultUsdRate(e.target.value)} 
                  className="bg-slate-50 border border-gray-200 py-3 px-4 rounded-xl text-sm outline-none w-full text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                  placeholder="135"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-6 mt-auto">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vèsyon: 3.0.0</div>
                <button 
                  onClick={generateWooCommercePlugin} 
                  disabled={downloadingPlugin === 'woocommerce' || profile?.kyc_status !== 'approved' || !profile?.api_key} 
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  {downloadingPlugin === 'woocommerce' ? <RefreshCw size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
                  {downloadingPlugin === 'woocommerce' ? 'Ap jenere...' : 'Telechaje ZIP'}
                </button>
              </div>
            </div>

            {/* HOSTINGER PLUGIN CARD */}
            <div className="bg-white border border-gray-200 p-6 md:p-8 rounded-3xl shadow-sm flex flex-col h-full hover:border-indigo-300 transition-colors">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl"><Wifi className="text-orange-600 w-6 h-6" /></div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Hostinger / Horizon</h3>
                  <p className="text-slate-500 text-xs font-medium">Embed Code</p>
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-8 leading-relaxed flex-grow">Kòd pou kole nan sit ou. Vèsyon 2.0 ak fòmilè kat entegre.</p>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-6 mt-auto">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vèsyon: 2.0.0</div>
                <button 
                  onClick={generateHostingerPlugin} 
                  disabled={downloadingPlugin === 'hostinger' || profile?.kyc_status !== 'approved' || !profile?.api_key} 
                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  {downloadingPlugin === 'hostinger' ? <RefreshCw size={16} className="animate-spin" /> : <DownloadIcon size={16} />}
                  {downloadingPlugin === 'hostinger' ? 'Ap jenere...' : 'Telechaje ZIP'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-10 shadow-sm">
            {/* SEKSYON API DEVLOPÈ A */}
            <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-2">API Piblik & Kle Sekrè</h3>
            <p className="text-slate-500 text-sm mb-8">Entegre HatexCard sou lòt aplikasyon ak sit ki pa sèvi ak WordPress.</p>

            <div className="bg-slate-50 border border-gray-200 p-6 rounded-2xl mb-8">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Kle Prive (Secret Key)</label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={profile?.api_key || "Y ap chaje kle a..."}
                  className="flex-1 w-full bg-white border border-gray-300 text-indigo-700 text-sm rounded-xl p-3.5 font-mono outline-none shadow-sm font-semibold"
                />
                <button
                  onClick={() => {
                    if (profile?.api_key) {
                      navigator.clipboard.writeText(profile.api_key);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }
                  }}
                  className="w-full sm:w-auto bg-slate-900 hover:bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {copiedKey ? <><CheckCircle2 size={16}/> Kopye</> : <><Copy size={16}/> Kopye Kle a</>}
                </button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Egzanp Kòd Peman & Sekirite (Javascript)</h4>
              <pre className="bg-slate-900 border border-slate-800 text-emerald-400 p-6 rounded-2xl overflow-x-auto text-xs font-mono leading-relaxed shadow-inner">
<code>{`const response = await fetch('https://hatexcard.com/api/public/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${profile?.api_key || 'KLE_W_LA'}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 1500, // HTG
    currency: 'HTG',
    order_id: 'CMD-123',
    card_info: {
       number: '0000 0000 0000 0000',
       exp: '12/28',
       cvv: '123'
    }
  })
});
const data = await response.json();

if (data.success) {
  // Peman an fèt IMEDYATMAN (kòb la deja sou balans ou). Konsève
  // 'data.transaction_id' la kòm referans pou sipò/verifikasyon.
  alert("Peman pase ak siksè! Referans: " + data.transaction_id);
} else {
  alert("Peman refize: " + data.error);
}`}</code>
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderInvoices = () => {
    if (subMode === 'create') {
      return (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
            <button onClick={() => setSubMode('list')} className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors text-slate-600 hover:text-indigo-600 shrink-0"><ArrowLeft size={18} /></button>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 flex-1 text-center">Nouvo Smart Invoice</h2>
            <div className="w-10 shrink-0" />
          </div>
          <div className="bg-white border border-gray-200 p-6 md:p-10 rounded-3xl space-y-6 md:space-y-8 shadow-sm">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Montan an (HTG)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-xl font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow text-slate-900 placeholder:text-gray-400" placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Email Kliyan</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-gray-200 py-4 pl-12 pr-4 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow text-slate-900 placeholder:text-gray-400" placeholder="kliyan@gmail.com" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Deskripsyon</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-50 border border-gray-200 p-4 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow text-slate-900 h-28 resize-none placeholder:text-gray-400" placeholder="Kisa kliyan an ap achte?" />
            </div>
            <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-sm disabled:bg-indigo-300 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Ap kreye...</> : 'Jenere Lyen & Voye Email'}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
        <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4 border-b border-gray-200 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Fakti (Invoices)</h2>
          </div>
          <button onClick={() => setSubMode('create')} className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm font-bold text-xs uppercase tracking-wider">
            <PlusCircle size={16}/> Nouvo Fakti
          </button>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-2xl mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="bg-slate-50 border border-gray-200 text-slate-700 text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-500 flex-1">
              <option value="all">Tout tan</option>
              <option value="today">Jodi a</option>
              <option value="week">7 dènye jou</option>
              <option value="month">30 dènye jou</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-50 border border-gray-200 text-slate-700 text-xs font-bold p-3 rounded-xl outline-none focus:border-indigo-500 flex-1">
              <option value="all">Tout estati</option>
              <option value="pending">An atant</option>
              <option value="paid">Peye</option>
            </select>
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Chèche..." className="w-full bg-slate-50 border border-gray-200 text-slate-900 text-xs font-bold p-3 pl-10 rounded-xl outline-none focus:border-indigo-500 placeholder:text-gray-400" />
            </div>
          </div>
        </div>
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300"/>
            <p className="text-sm font-bold text-slate-500">Pa gen fakti ki koresponn ak rechèch ou a</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="bg-white border border-gray-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:border-indigo-300 hover:shadow-sm transition-all shadow-sm">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${inv.status === 'paid' ? 'bg-emerald-500' : inv.status === 'pending' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                    {inv.status === 'paid' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{inv.client_email}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(inv.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t sm:border-none border-gray-100 pt-4 sm:pt-0 mt-2 sm:mt-0 gap-6">
                  <div className="text-base font-bold text-slate-900 shrink-0">
                    {inv.status === 'paid' ? <span className="text-emerald-600">+</span> : ''}{parseFloat(inv.amount).toLocaleString()} <span className="text-xs text-slate-500">HTG</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {inv.status === 'pending' && (
                      <>
                        <button onClick={() => handleMarkInvoiceAsPaid(inv.id)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 border border-emerald-100 transition-colors" title="Marke kòm peye"><CheckSquare size={16} /></button>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/checkout-invoice/${inv.id}`); alert("Lyen kopye!"); }} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 border border-indigo-100 transition-colors" title="Kopye lyen an"><Copy size={16} /></button>
                      </>
                    )}
                    <button onClick={() => handleDeleteInvoice(inv.id)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 border border-rose-100 transition-colors" title="Efase"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTransactions = () => (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
      <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Jounal Tranzaksyon</h2>
        </div>
      </div>
      <div className="flex overflow-x-auto pb-4 gap-2 mb-4 custom-scrollbar">
        {['Tout', 'SDK', 'Invoice'].map((tab) => (
          <button key={tab} className="px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-white border border-gray-200 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 whitespace-nowrap shadow-sm">{tab}</button>
        ))}
      </div>
      <div className="space-y-3">
        {recentSales.length > 0 ? (
          recentSales.slice(0, 30).map((tx, i) => {
            const client = tx.client || 'Kliyan';
            return (
              <div key={i} className="bg-white border border-gray-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:border-indigo-300 hover:shadow-sm transition-all shadow-sm">
                <div className="flex items-center gap-4 w-full sm:w-auto flex-1 min-w-0">
                  <div className={`w-10 h-10 ${getInitialColor(client)} rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-sm`}>{getInitials(client)}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 truncate">{(tx as any).type || 'PÈMAN'}</h4>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{client}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t sm:border-none border-gray-100 pt-3 sm:pt-0 mt-2 sm:mt-0 gap-4">
                  <div className="text-base font-bold text-emerald-600 shrink-0">+{parseFloat(tx.amount).toLocaleString()} <span className="text-xs text-slate-500">HTG</span></div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shrink-0 ${tx.status === 'success' || tx.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>{tx.status}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-gray-300"><Package className="w-16 h-16 mx-auto mb-4 text-slate-300" /><p className="text-sm font-bold text-slate-500">Pa gen tranzaksyon ankò.</p></div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
      <div className="flex items-center gap-3 mb-6 border-b border-gray-200 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Anviwònman</h2>
      </div>
      <div className="grid gap-6">
        <div className="bg-white p-8 rounded-3xl border border-gray-200 text-center shadow-sm">
          <Settings size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-bold text-sm">Seksyon anviwònman an konstriksyon...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 md:p-8 font-sans selection:bg-indigo-100">
      <div className="max-w-7xl mx-auto">
        {renderHeader()}

        {loading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={36} className="text-indigo-600 animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Ap Chaje...</p>
          </div>
        )}

        <div className="pb-10">
          {mode === 'dashboard' && renderDashboard()}
          {mode === 'plugins' && renderPlugins()}
          {mode === 'invoices' && renderInvoices()}
          {mode === 'transactions' && renderTransactions()}
          {mode === 'settings' && renderSettings()}
        </div>
      </div>
    </div>
  );
}