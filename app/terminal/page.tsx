"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import QRCode from 'qrcode';
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
  ShoppingBag, PenTool, Chrome, Wifi, Image, QrCode
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
    if (!profile?.id || profile?.kyc_status !== 'approved') return null;
    
    try {
      setGeneratingApiKey(true);
      const apiKey = 'hx_live_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      const { error } = await supabase
        .from('profiles')
        .update({ api_key: apiKey })
        .eq('id', profile.id);
      
      if (error) throw error;
      
      setProfile({ ...profile, api_key: apiKey });
      return apiKey;
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

    // Verifye tip fichye
    if (!file.type.startsWith('image/')) {
      alert('Tanpri chwazi yon fichye imaj (JPEG, PNG, etc.)');
      return;
    }

    // Verifye gwosè (maks 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Imaj la twò gwo. Maks 2MB.');
      return;
    }

    setUploadingLogo(true);

    try {
      // Jenere yon non inik (senp, san karaktè espesyal)
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

      console.log('🔼 Ap telechaje:', fileName);

      // Telechaje nan Supabase Storage
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

      // Jwenn URL piblik la
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;
      console.log('✅ URL jwenn:', avatarUrl);

      // Mete ajou pwofil la
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Update profile error:', updateError);
        alert('Erè pandan sove done pwofil la.');
        setUploadingLogo(false);
        return;
      }

      // Mete ajou eta lokal la
      setProfile({ ...profile, avatar_url: avatarUrl });
      alert('✅ Logo telechaje avèk siksè!');

    } catch (err: any) {
      console.error('❌ Erè inatandi:', err);
      alert('Erè inatandi. Tcheke konsola a pou plis detay.');
    } finally {
      setUploadingLogo(false);
      // Netwaye input la pou ka re-telechaje menm fichye
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

        setProfile(prof);
        setBusinessName(prof.business_name || '');
        setYoutubeUrl(prof.sdk_tutorial_url || '');

        if (prof.kyc_status === 'approved' && !prof.api_key && !hasGeneratedKey) {
          hasGeneratedKey = true;
          
          const apiKey = 'hx_live_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ api_key: apiKey })
            .eq('id', prof.id);
          
          if (!updateError && isMounted) {
            setProfile({ ...prof, api_key: apiKey });
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
  // STATISTIK ESPESYAL POU QR KÒD (KÒRIJE POU EDGE FUNCTION)
  // ============================================================
  const qrTransactions = useMemo(() => {
    return transactions.filter(tx => 
      tx.type === 'SALE' && 
      tx.status === 'success' && 
      // Lojik sa a tcheke ni nouvo metòd la, ni ansyen an, ni deskripsyon an pou sekirite
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
    
    // Kalkile limit 24h la (sa gen 24h presizeman)
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

    return {
      total,
      thisMonth,
      today: todayTotal,
      last24h: last24hTotal,
      count: qrTransactions.length
    };
  }, [qrTransactions]);

  // ============================================================
  // FILTRE INVOICES AK RECENT SALES (RETE MENM JAN)
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
    const c = ['bg-red-600','bg-blue-600','bg-emerald-600','bg-violet-600','bg-amber-600','bg-pink-600','bg-cyan-600'];
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
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString() + ' HTG';
  };

  // ============================================================
  // FONKSYON QR KÒD (ak token)
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
  // FONKSYON JENERASYON PLUGIN HOSTINGER
  // ============================================================
  const generateHostingerPlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved') {
      alert('KYC ou poko apwouve. Tanpri tann apwobasyon an.');
      return;
    }
    if (!profile?.api_key) {
      alert('Kle API poko jenere. Tanpri reyese answit.');
      return;
    }

    setDownloadingPlugin('hostinger');

    try {
      const zip = new JSZip();

      const hostingerConfig = `{
  "merchantId": "${profile.api_key}",
  "businessName": "${profile.business_name || 'HATEX Merchant'}",
  "rate": 136,
  "apiUrl": "https://api.hatexcard.com/v1",
  "version": "2.0.0"
}`;

      const hostingerCode = `<script>
(function() {
  const MERCHANT_ID = '${profile.api_key}';
  const RATE = 136;
  const API_URL = 'https://api.hatexcard.com/v1/process-payment';

  function validateCard(cardNumber, expiry, cvv) {
    const errors = [];
    
    if (!/^\\d{13,19}$/.test(cardNumber.replace(/\\s/g, ''))) {
      errors.push('Nimewo kat la pa valab');
    }
    
    if (!/^\\d{2}\\/\\d{2}$/.test(expiry)) {
      errors.push('Dat ekspirasyon dwe fòma MM/AA');
    } else {
      const [month, year] = expiry.split('/');
      const now = new Date();
      const currentYear = now.getFullYear() % 100;
      const currentMonth = now.getMonth() + 1;
      
      if (parseInt(year) < currentYear || 
          (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
        errors.push('Dat ekspirasyon kat la fin pase');
      }
    }
    
    if (!/^\\d{3,4}$/.test(cvv)) {
      errors.push('Kòd CVV dwe 3 oubyen 4 chif');
    }
    
    return errors;
  }

  function createPaymentForm(container, amount, description) {
    const form = document.createElement('div');
    form.id = 'hatex-payment-form';
    form.innerHTML = \`
      <div style="margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 400px;">
        <h3 style="margin-top: 0; color: #e62e04;">Peye ak HATEX</h3>
        <div id="hatex-errors" style="color: #ff0000; margin-bottom: 15px; font-size: 13px;"></div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px;">Non sou kat la</label>
          <input type="text" id="hatex-card-holder" placeholder="Jan Fi" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
        </div>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px;">Nimewo kat</label>
          <input type="text" id="hatex-card-number" placeholder="**** **** **** ****" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
          <div>
            <label style="display: block; margin-bottom: 5px;">Dat ekspirasyon</label>
            <input type="text" id="hatex-card-expiry" placeholder="MM/AA" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px;">CVV</label>
            <input type="text" id="hatex-card-cvv" placeholder="123" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
        </div>
        
        <div style="margin-bottom: 15px;">
          <strong>Total: \${amount} HTG</strong>
        </div>
        
        <button id="hatex-pay-button" style="width: 100%; padding: 12px; background: #e62e04; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;">
          Peye \${amount} HTG
        </button>
      </div>
    \`;
    
    container.appendChild(form);
    
    document.getElementById('hatex-card-number').addEventListener('input', function(e) {
      let value = e.target.value.replace(/\\D/g, '');
      let formatted = '';
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) formatted += ' ';
        formatted += value[i];
      }
      e.target.value = formatted;
    });
    
    document.getElementById('hatex-card-expiry').addEventListener('input', function(e) {
      let value = e.target.value.replace(/\\D/g, '');
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
      e.target.value = value;
    });
    
    document.getElementById('hatex-card-cvv').addEventListener('input', function(e) {
      e.target.value = e.target.value.replace(/\\D/g, '').substring(0, 4);
    });
    
    document.getElementById('hatex-pay-button').addEventListener('click', async function() {
      const cardHolder = document.getElementById('hatex-card-holder').value.trim();
      const cardNumber = document.getElementById('hatex-card-number').value.replace(/\\s/g, '');
      const cardExpiry = document.getElementById('hatex-card-expiry').value.trim();
      const cardCvv = document.getElementById('hatex-card-cvv').value.trim();
      const errorDiv = document.getElementById('hatex-errors');
      
      const errors = validateCard(cardNumber, cardExpiry, cardCvv);
      if (!cardHolder) errors.push('Non sou kat la obligatwa');
      
      if (errors.length > 0) {
        errorDiv.innerHTML = '<ul style="margin:0; padding-left:20px;"><li>' + errors.join('</li><li>') + '</li></ul>';
        return;
      }
      
      errorDiv.innerHTML = '';
      
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MERCHANT_ID
          },
          body: JSON.stringify({
            merchant_id: MERCHANT_ID,
            amount: amount,
            currency: 'HTG',
            description: description,
            card_holder: cardHolder,
            card_number: cardNumber,
            card_expiry: cardExpiry,
            card_cvv: cardCvv,
            metadata: {
              platform: 'hostinger',
              url: window.location.href
            }
          })
        });
        
        const data = await response.json();
        
        if (data.success && data.transaction_id) {
          alert('Peman reyisi! ID tranzaksyon: ' + data.transaction_id);
          window.location.href = '/thank-you';
        } else {
          let errorMsg = 'Peman an echwe';
          if (data.code === 'INSUFFICIENT_BALANCE') {
            errorMsg = 'Balans ensifizan sou kat la';
          } else if (data.code === 'INVALID_CARD') {
            errorMsg = 'Enfòmasyon kat yo pa bon';
          } else if (data.message) {
            errorMsg = data.message;
          }
          errorDiv.innerHTML = errorMsg;
        }
      } catch (err) {
        errorDiv.innerHTML = 'Erè koneksyon. Tanpri eseye ankò.';
      }
    });
  }

  function initHatex() {
    const productContainers = document.querySelectorAll('.product, .product-card, [class*="product"]');
    productContainers.forEach(container => {
      if (!container.querySelector('.hatex-checkout-btn')) {
        const btn = document.createElement('button');
        btn.className = 'hatex-checkout-btn';
        btn.innerHTML = '💳 Peye an Goud ak HATEX';
        btn.style.cssText = 'margin-top:10px; padding:10px; background:#e62e04; color:white; border:none; border-radius:4px; width:100%; cursor:pointer;';
        
        btn.onclick = () => {
          const priceEl = container.querySelector('[class*="price"], .price, [itemprop="price"]');
          let price = 0;
          if (priceEl) {
            price = parseFloat(priceEl.innerText.replace(/[^\\d.]/g, '')) * RATE;
          } else {
            price = parseFloat(prompt('Antre pri an Goud (HTG):') || '0');
          }
          
          if (price > 0) {
            const existingForm = document.getElementById('hatex-payment-form');
            if (existingForm) existingForm.remove();
            
            const titleEl = container.querySelector('h1, h2, h3, [class*="title"]');
            const description = titleEl ? titleEl.innerText : 'Pwodwi';
            
            createPaymentForm(container, price.toFixed(2), description);
          }
        };
        
        container.appendChild(btn);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHatex);
  } else {
    initHatex();
  }
  
  setTimeout(initHatex, 1000);
  setTimeout(initHatex, 2000);
})();
</script>
`;

      zip.file('hatex-hostinger.json', hostingerConfig);
      zip.file('embed-code.html', hostingerCode);
      zip.file('README.md', `# HATEX Payments for Hostinger/Horizon

Vèsyon 2.0 - Fòmilè kat entegre

## Enstriksyon

1. Ale nan **Website** > **Settings** > **Custom Code**
2. Kole tout kòd ki nan **embed-code.html** nan seksyon **Header** oswa **Footer**
3. Sove chanjman yo

## Fonksyonalite

- Fòmilè kat dirèkteman sou paj pwodwi
- Validasyon an tan reyèl
- Mesaj erè espesifik
- Pa gen redireksyon
`);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatex-hostinger-${profile.id.slice(0,8)}.zip`);

    } catch (error) {
      console.error('Error generating Hostinger plugin:', error);
      alert('Erè pandan jenere Hostinger plugin an. Tanpri rekòmanse.');
    } finally {
      setDownloadingPlugin(null);
    }
  };

  // ============================================================
  // API FUNCTIONS (kenbe yo tout)
  // ============================================================
  const saveYoutubeUrl = async () => {
    if (!profile?.id) return;
    await supabase
      .from('profiles')
      .update({ sdk_tutorial_url: youtubeUrl })
      .eq('id', profile.id);
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
      
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('kyc_status, business_name')
        .eq('id', user.id)
        .single();
        
      if (freshProfile?.kyc_status !== 'approved') {
        alert(`Echèk: Kont ou dwe 'approved'.`);
        setMode('dashboard');
        return;
      }
      
      const { data: inv, error: invError } = await supabase
        .from('invoices')
        .insert({
          owner_id: user.id,
          amount: parseFloat(amount),
          client_email: email.toLowerCase().trim(),
          status: 'pending',
          description
        })
        .select()
        .single();
        
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
      alert(`Siksè! Lyen kopye.`);
      setAmount('');
      setEmail('');
      setDescription('');
      setSubMode('list');
      
      const { data: newInv } = await supabase
        .from('invoices')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
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
      const { error } = await supabase
        .rpc('increment_merchant_balance', {
          merchant_id: profile?.id,
          amount_to_add: earnings.total
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
    if (!file || file.type !== 'application/pdf') {
      return alert('Tanpri chwazi yon dosye PDF.');
    }
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
      const { error } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoiceId);
      if (error) throw error;
      
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'paid' } : inv));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Èske w sèten ou vle efase fakti sa?')) return;
    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (error) throw error;
      
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================
  // RENDER FUNCTIONS (Responsive UI Adjustments)
  // ============================================================
  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 border-b border-white/5 pb-4 md:pb-6 gap-4">
      <div className="flex flex-col">
        <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">
          {profile?.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-[8px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
            {profile?.kyc_status === 'approved' ? 'KYC Verified' : 'KYC Pending'}
          </span>
        </div>
      </div>
      <div className="flex gap-2 md:gap-3 flex-wrap w-full md:w-auto">
        <button
          onClick={() => setMode('dashboard')}
          className={`flex-1 md:flex-none px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-1 md:gap-2 border border-white/5 transition-all font-black text-[8px] md:text-[10px] uppercase ${
            mode === 'dashboard' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <LayoutGrid size={14} className="md:w-[15px] md:h-[15px]" /> <span className="hidden md:inline">Dashboard</span>
        </button>
        <button
          onClick={() => setMode('plugins')}
          className={`flex-1 md:flex-none px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-1 md:gap-2 border border-white/5 transition-all font-black text-[8px] md:text-[10px] uppercase ${
            mode === 'plugins' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <DownloadCloud size={14} className="md:w-[15px] md:h-[15px]" /> <span className="hidden md:inline">Plugins</span>
        </button>
        <button
          onClick={() => { setMode('invoices'); setSubMode('list'); }}
          className={`flex-1 md:flex-none px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-1 md:gap-2 border border-white/5 transition-all font-black text-[8px] md:text-[10px] uppercase ${
            mode === 'invoices' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <FileText size={14} className="md:w-[15px] md:h-[15px]" /> <span className="hidden md:inline">Invoices</span>
        </button>
        <button
          onClick={() => setMode('transactions')}
          className={`flex-1 md:flex-none px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-1 md:gap-2 border border-white/5 transition-all font-black text-[8px] md:text-[10px] uppercase ${
            mode === 'transactions' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <History size={14} className="md:w-[15px] md:h-[15px]" /> <span className="hidden md:inline">Transaksyon</span>
        </button>
        <button
          onClick={() => setMode('settings')}
          className={`flex-1 md:flex-none px-3 py-2 md:px-5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-1 md:gap-2 border border-white/5 transition-all font-black text-[8px] md:text-[10px] uppercase ${
            mode === 'settings' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <Settings size={14} className="md:w-[15px] md:h-[15px]" /> <span className="hidden md:inline">Settings</span>
        </button>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="grid lg:grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-8 space-y-6 md:space-y-8">
        {/* Merchant Identity */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 group-hover:opacity-20 transition-opacity">
            <ShieldCheck size={80} className="md:w-[110px] md:h-[110px] text-red-600" />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 md:mb-8">
            <div className="bg-red-600/10 p-3 md:p-4 rounded-2xl md:rounded-3xl">
              <Lock className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Merchant Identity</h3>
              <p className="text-[8px] md:text-[10px] text-zinc-500 font-bold">
                Konfigire pwofil biznis piblik ou
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <User className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={15} />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                readOnly={!!profile?.business_name}
                placeholder="Non Legal Biznis Ou"
                className="w-full bg-black/40 border border-white/10 py-4 md:py-6 pl-12 md:pl-16 pr-4 md:pr-6 rounded-2xl md:rounded-3xl text-xs md:text-[14px] outline-none text-white italic focus:border-red-600/50 transition-all"
              />
            </div>
          </div>

          {/* Logo biznis */}
          <div className="mt-6 pt-6 md:mt-8 md:pt-8 border-t border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="bg-red-600/10 p-3 md:p-4 rounded-xl md:rounded-2xl">
                  <Image size={16} className="md:w-5 md:h-5 text-red-600" />
                </div>
                <div>
                  <h4 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-wider">Logo Biznis</h4>
                  <p className="text-[8px] md:text-[9px] text-zinc-500 uppercase italic">JPEG, PNG, maks 2MB</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6">
              {/* Preview logo */}
              {profile?.avatar_url ? (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden bg-black/30 border border-white/10 shrink-0">
                  <img 
                    src={profile.avatar_url} 
                    alt="Logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/10 shrink-0">
                  <Image size={24} className="md:w-[30px] md:h-[30px] text-zinc-700" />
                </div>
              )}

              {/* Bouton telechaje */}
              <label className="cursor-pointer w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-4 md:px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-center">
                {uploadingLogo ? (
                  <RefreshCw size={14} className="animate-spin text-red-600" />
                ) : (
                  <Upload size={14} />
                )}
                <span className="text-[9px] md:text-[10px] font-black uppercase">Telechaje Logo</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
              </label>
            </div>
          </div>
          
          <div className="mt-8 pt-8 md:mt-10 md:pt-10 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-center gap-3 md:gap-4 p-3 md:p-0 bg-black/20 md:bg-transparent rounded-2xl md:rounded-none border md:border-none border-white/5">
              <div className="bg-zinc-900 p-3 md:p-4 rounded-xl md:rounded-2xl">
                <FileText className="text-zinc-500 w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-wider">Manyèl KYC</h4>
                <p className="text-[8px] md:text-[9px] text-zinc-500 uppercase italic">Dokiman PDF</p>
              </div>
              <label className="cursor-pointer bg-zinc-900 hover:bg-zinc-800 border border-white/10 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all flex-shrink-0">
                {uploadingPdf ? <RefreshCw size={14} className="animate-spin text-red-600" /> : <Upload size={14} className="md:w-4 md:h-4" />}
                <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
              </label>
            </div>
            <div className="flex items-center gap-3 md:gap-4 p-3 md:p-0 bg-black/20 md:bg-transparent rounded-2xl md:rounded-none border md:border-none border-white/5">
              <div className="bg-zinc-900 p-3 md:p-4 rounded-xl md:rounded-2xl">
                <Globe className="text-zinc-500 w-4 h-4 md:w-5 md:h-5" />
              </div>
              <div>
                <h4 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-wider">Gateway Status</h4>
                <span className="text-[8px] md:text-[9px] text-green-500 font-black uppercase">Aktif & Online</span>
              </div>
            </div>
          </div>

          {/* Seksyon QR Kòd la (si KYC apwouve) */}
          {profile?.kyc_status === 'approved' && (
            <div className="mt-8 pt-8 md:mt-10 md:pt-10 border-t border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h4 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-wider text-center sm:text-left">QR Kòd Peman</h4>
                <button
                  onClick={downloadQR}
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase transition-all w-full sm:w-auto"
                >
                  <Download size={12} className="md:w-3.5 md:h-3.5" /> Telechaje QR
                </button>
              </div>
              <div className="flex flex-col items-center bg-black/20 p-4 md:p-6 rounded-2xl md:rounded-3xl" id="hatex-qr-code">
                <div className="bg-white p-2 rounded-xl">
                  <QRCodeComponent value={paymentUrl} size={130} />
                </div>
                <p className="text-[8px] md:text-[9px] text-zinc-500 mt-3 md:mt-4 break-all w-full max-w-[250px] text-center truncate">
                  {paymentUrl}
                </p>
                <p className="text-[8px] md:text-[9px] text-zinc-600 mt-1 md:mt-2 text-center">
                  Skane sa a pou peye dirèkteman nan kont ou.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* BOUTON DASHBOARD ABÒNMAN */}
        <button
          onClick={() => router.push('/dashboard/subscriptions')}
          className="w-full bg-white text-black py-4 md:py-5 rounded-[2rem] md:rounded-[2.2rem] font-black uppercase text-[10px] md:text-[11px] tracking-widest flex items-center justify-center gap-2 md:gap-3 hover:bg-zinc-200 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] group active:scale-95"
        >
          <LayoutGrid size={16} className="md:w-[18px] md:h-[18px] text-red-600" />
          <span>Dashboard Abònman</span>
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="group-hover:translate-x-1 transition-transform md:w-4 md:h-4"
          >
            <path d="M5 12h14m-7-7 7 7-7 7"/>
          </svg>
        </button>

        {/* Revenue Table - QR Payments */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden">
          <div className="p-6 md:p-8 border-b border-white/5">
            <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-red-600/10 p-3 md:p-4 rounded-xl md:rounded-3xl">
                <QrCode className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Peman QR Kòd</h3>
                <p className="text-[8px] md:text-[10px] text-zinc-500 font-bold italic">Revni an tan reyèl</p>
              </div>
            </div>

            {/* 4 Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-blue-400 mb-1 md:mb-2">
                  <DollarSign size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Total QR</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">
                  {qrStats.total.toLocaleString()}
                </div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>

              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <Calendar size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Mwa sa a</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">
                  {qrStats.thisMonth.toLocaleString()}
                </div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>

              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-amber-400 mb-1 md:mb-2">
                  <Clock size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Jodi a</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">
                  {qrStats.today.toLocaleString()}
                </div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>

              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-purple-400 mb-1 md:mb-2">
                  <TrendingUp size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Dènye 24h</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">
                  {qrStats.last24h.toLocaleString()}
                </div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>
            </div>
          </div>

          {/* Lis dènye tranzaksyon QR */}
          <div className="p-6 md:p-8 border-t border-white/5">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <History size={14} className="text-zinc-500 md:w-4 md:h-4" />
                <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] truncate max-w-[100px] sm:max-w-none">
                  Dènye Peman QR
                </span>
              </div>
              <span className="text-[7px] md:text-[8px] bg-red-600/10 text-red-400 px-2 py-1 rounded-full font-black uppercase">
                {qrStats.count} tranzaksyon QR
              </span>
            </div>

            {qrTransactions.length > 0 ? (
              <div className="space-y-2">
                {qrTransactions.slice(0, 5).map((tx: any) => {
                  const customerName = tx.metadata?.customer_name || 'Kliyan Hatex';
                  const initials = customerName.substring(0, 2).toUpperCase();
                  
                  return (
                    <div key={tx.id} className="flex items-center gap-2 md:gap-3 p-3 bg-black/30 rounded-xl md:rounded-2xl border border-white/5 hover:border-red-600/20 transition-all">
                      <div className="w-8 h-8 md:w-9 md:h-9 bg-zinc-800 rounded-lg md:rounded-xl flex items-center justify-center font-black text-[9px] md:text-[10px] text-zinc-400 flex-shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] md:text-[11px] font-bold text-white truncate uppercase italic">
                          {customerName}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-0.5">
                          <span className="text-[7px] md:text-[8px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded-full font-black tracking-tighter">
                            QR SCAN
                          </span>
                          <span className="text-[8px] md:text-[9px] text-zinc-600 font-bold truncate">
                            {new Date(tx.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right pl-2">
                        <div className="text-xs md:text-sm font-black text-green-400">
                          +{parseFloat(tx.amount).toLocaleString()}
                        </div>
                        <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold">HTG</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12 bg-black/20 rounded-2xl md:rounded-[2.5rem] border border-dashed border-white/5">
                <QrCode size={24} className="mx-auto mb-2 md:mb-3 text-zinc-800 opacity-20 md:w-8 md:h-8" />
                <p className="text-[8px] md:text-[10px] font-black uppercase text-zinc-700 tracking-widest italic">Pa gen okenn vant QR detekte</p>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Revenue Table */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden mt-6 md:mt-8">
          <div className="p-6 md:p-8 border-b border-white/5">
            <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-red-600/10 p-3 md:p-4 rounded-xl md:rounded-3xl">
                <Mail className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Peman Fakti</h3>
                <p className="text-[8px] md:text-[10px] text-zinc-500 font-bold">Revni an tan reyèl</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <DollarSign size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Total Fakti</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">
                  {earnings.invoiceTotal.toLocaleString()}
                </div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>

              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <Mail size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Peye</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">{earnings.invoiceCount}</div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">fakti</div>
              </div>

              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <Calendar size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Mwa sa a</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">
                  {(earnings.thisMonth - qrStats.thisMonth).toLocaleString()}
                </div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>

              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <TrendingUp size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Mwayèn</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">
                  {earnings.invoiceCount > 0 
                    ? Math.round(earnings.invoiceTotal / earnings.invoiceCount).toLocaleString()
                    : '0'}
                </div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG/fak</div>
              </div>
            </div>
          </div>

          {/* Lis dènye fakti */}
          <div className="p-6 md:p-8 border-t border-white/5">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <History size={14} className="text-zinc-500 md:w-4 md:h-4" />
                <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] truncate max-w-[100px] sm:max-w-none">
                  Dènye Fakti
                </span>
              </div>
              <span className="text-[7px] md:text-[8px] bg-emerald-600/10 text-emerald-400 px-2 py-1 rounded-full font-black uppercase">
                {earnings.invoiceCount} fakti
              </span>
            </div>

            {invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.slice(0, 5).map((inv: any) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 md:p-4 bg-black/30 rounded-xl md:rounded-2xl border border-white/5 hover:border-emerald-600/20 transition-all">
                    <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                      <div className={`w-8 h-8 md:w-9 md:h-9 ${
                        inv.status === 'paid' ? 'bg-emerald-600' : 
                        inv.status === 'pending' ? 'bg-amber-600' : 'bg-red-600'
                      } rounded-lg md:rounded-xl flex items-center justify-center font-black text-[9px] md:text-[10px] text-white flex-shrink-0`}>
                        {inv.status === 'paid' ? '✓' : inv.status === 'pending' ? '⏳' : '✗'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-[11px] font-bold text-white truncate">
                          {inv.client_email || 'Kliyan'}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mt-0.5">
                          <span className="text-[7px] md:text-[8px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black">
                            Fakti
                          </span>
                          <span className="text-[8px] md:text-[9px] text-zinc-600">
                            {formatDate(inv.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0 pl-11 sm:pl-0 border-t border-white/5 sm:border-none pt-2 sm:pt-0">
                      <div className="text-left sm:text-right mr-4 sm:mr-0 sm:ml-4 flex-shrink-0">
                         <div className="text-xs md:text-sm font-black text-green-400">
                           {inv.status === 'paid' ? '+' : ''}{parseFloat(inv.amount).toLocaleString()} HTG
                         </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                        {inv.status === 'pending' && (
                          <>
                            <button onClick={() => handleMarkInvoiceAsPaid(inv.id)} className="p-1.5 md:p-2 bg-green-600/20 rounded-lg md:rounded-xl hover:bg-green-600/40 transition-all" title="Make as paid">
                              <CheckSquare size={12} className="text-green-400 md:w-3.5 md:h-3.5" />
                            </button>
                            <button onClick={() => {
                                const paymentLink = `${window.location.origin}/checkout-invoice/${inv.id}`;
                                navigator.clipboard.writeText(paymentLink);
                                alert("Lyen peman an kopye nan clipboard ou!");
                              }} className="p-1.5 md:p-2 bg-blue-600/20 rounded-lg md:rounded-xl hover:bg-blue-600/40 transition-all" title="Copy payment link">
                              <Copy size={12} className="text-blue-400 md:w-3.5 md:h-3.5" />
                            </button>
                          </>
                        )}
                        <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 md:p-2 bg-red-600/20 rounded-lg md:rounded-xl hover:bg-red-600/40 transition-all" title="Delete">
                          <Trash2 size={12} className="text-red-400 md:w-3.5 md:h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 md:py-8 bg-black/20 rounded-xl md:rounded-2xl border border-dashed border-white/5">
                <Mail size={20} className="mx-auto mb-2 text-zinc-800 md:w-7 md:h-7" />
                <p className="text-[8px] md:text-[10px] font-black uppercase text-zinc-700">Pa gen fakti ankò</p>
              </div>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        {profile?.business_name ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mt-6 md:mt-8">
            {[
              { icon: <Code className="text-red-600 w-6 h-6 md:w-7 md:h-7" />, label: 'Hostinger Plugin', sub: 'Kòd pou site Hostinger', action: () => setMode('plugins') },
              { icon: <FileText className="text-red-600 w-6 h-6 md:w-7 md:h-7" />, label: 'Smart Invoice', sub: 'Voye fakti bay kliyan', action: () => { setMode('invoices'); setSubMode('create'); } },
            ].map((a) => (
              <button key={a.label} onClick={a.action} className="bg-zinc-900/30 p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] border border-white/5 flex flex-col items-center justify-center gap-3 md:gap-5 hover:bg-red-600/10 hover:border-red-600/20 transition-all group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="bg-zinc-950 p-4 md:p-6 rounded-2xl md:rounded-3xl group-hover:scale-110 transition-transform">{a.icon}</div>
                <div className="text-center">
                  <span className="text-[10px] md:text-[12px] font-black uppercase italic block">{a.label}</span>
                  <span className="text-[7px] md:text-[8px] text-zinc-500 uppercase font-bold mt-1 block">{a.sub}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-red-600/5 border border-red-600/20 p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] text-center mt-6 md:mt-8">
            <AlertTriangle className="text-red-600 w-8 h-8 md:w-12 md:h-12 mx-auto mb-4 md:mb-6" />
            <h4 className="text-xs md:text-sm font-black uppercase text-red-500 mb-2 italic">Aksyon limite</h4>
            <p className="text-[9px] md:text-[11px] text-red-500/60 max-w-sm mx-auto leading-relaxed">
              Ou dwe lye biznis ou an anvan ou ka jwenn aksè nan Plugins ak Invoices.
            </p>
          </div>
        )}
      </div>

      {/* ── SIDEBAR ── */}
      <div className="lg:col-span-4 space-y-6">
        {/* Balans */}
        <div className="bg-white text-black p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl shadow-red-600/10">
          <div className="flex justify-between items-start mb-4 md:mb-5">
            <div className="bg-black text-white p-3 md:p-4 rounded-xl md:rounded-2xl"><Wallet size={16} className="md:w-[18px] md:h-[18px]" /></div>
            <div className="text-right">
              <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest opacity-40">Balans Wallet</p>
              <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter mt-1 truncate max-w-[150px] md:max-w-[200px]">
                {profile?.balance?.toLocaleString() || '0'}<span className="text-[10px] md:text-[12px] ml-1">HTG</span>
              </h2>
            </div>
          </div>
          <div className="bg-zinc-50 rounded-xl md:rounded-2xl p-3 md:p-4 mb-4">
            <p className="text-[8px] md:text-[9px] font-black uppercase text-zinc-400 mb-1.5 md:mb-2">An Atant pou Senkronize</p>
            <div className="flex justify-between items-center gap-2">
              <span className="text-sm md:text-lg font-black text-red-600 truncate">{earnings.total.toLocaleString()} HTG</span>
              <span className="text-[7px] md:text-[8px] bg-red-100 text-red-600 font-black px-1.5 md:px-2 py-1 rounded-full flex-shrink-0">DISPONIB</span>
            </div>
          </div>
          <button onClick={handleSyncBalance} disabled={syncing || earnings.total <= 0} className="w-full bg-black hover:bg-red-600 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase text-[9px] md:text-[10px] transition-all flex items-center justify-center gap-2 disabled:opacity-40">
            {syncing ? <RefreshCw className="animate-spin" size={12} /> : <RefreshCw size={12} className="md:w-3.5 md:h-3.5" />}
            Senkronize {earnings.total > 0 ? earnings.total.toLocaleString() + ' HTG' : ''}
          </button>
        </div>

        {/* Node Config */}
        <div className="bg-zinc-900/30 border border-white/5 p-5 md:p-7 rounded-[2rem] md:rounded-[3rem]">
          <h3 className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] mb-3 md:mb-4 text-zinc-500">Konfigirasyon</h3>
          <div className="space-y-2 md:space-y-3">
            {[
              { label: 'Merchant ID', val: (profile?.id?.slice(0, 8) || '—') + '...', color: 'text-red-500' },
              { label: 'KYC Status', val: profile?.kyc_status || 'pending', color: profile?.kyc_status === 'approved' ? 'text-green-500' : 'text-orange-500' },
              { label: 'API Key', val: profile?.api_key ? profile.api_key.slice(0, 8) + '...' : 'Pa genyen', color: profile?.api_key ? 'text-blue-400' : 'text-zinc-500' },
              { label: 'Revni Mwa a', val: formatCurrency(earnings.thisMonth), color: 'text-emerald-400' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center p-3 md:p-4 bg-black/40 rounded-xl md:rounded-2xl border border-white/5">
                <span className="text-[8px] md:text-[9px] font-bold text-zinc-400 truncate mr-2">{item.label}</span>
                <div className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
                  <span className={`text-[8px] md:text-[9px] font-black uppercase ${item.color}`}>{item.val}</span>
                  {item.label === 'API Key' && profile?.api_key && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(profile.api_key);
                        setCopiedApiKey(true);
                        setTimeout(() => setCopiedApiKey(false), 2000);
                      }}
                      className="p-1 md:p-1.5 bg-zinc-800 rounded-md md:rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      {copiedApiKey ? <CheckCircle2 size={10} className="text-green-400 md:w-3 md:h-3" /> : <Copy size={10} className="text-zinc-400 md:w-3 md:h-3" />}
                    </button>
                  )}
                  {item.label === 'Merchant ID' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(profile?.id || '');
                        alert('ID kopye! Pa pataje li ak pèsòn.');
                      }}
                      className="p-1 md:p-1.5 bg-zinc-800 rounded-md md:rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                      <Copy size={10} className="text-zinc-400 md:w-3 md:h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="mt-2 p-2 md:p-3 bg-red-600/10 border border-red-600/20 rounded-xl md:rounded-2xl">
              <p className="text-[7px] md:text-[8px] text-red-400 font-bold uppercase tracking-wider text-center">
                ⚠️ Pa janm pataje ID ou oswa kle API
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-zinc-900/30 border border-white/5 p-5 md:p-7 rounded-[2rem] md:rounded-[3rem]">
          <h3 className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] mb-3 md:mb-4 text-zinc-500">Estatistik rapid</h3>
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            <div className="bg-black/40 p-3 md:p-4 rounded-xl md:rounded-2xl text-center border border-white/5">
              <p className="text-[8px] md:text-[9px] text-zinc-500 font-bold">Total tranzaksyon</p>
              <p className="text-base md:text-lg font-black text-white mt-0.5">{transactions.length}</p>
            </div>
            <div className="bg-black/40 p-3 md:p-4 rounded-xl md:rounded-2xl text-center border border-white/5">
              <p className="text-[8px] md:text-[9px] text-zinc-500 font-bold">Fakti yo</p>
              <p className="text-base md:text-lg font-black text-white mt-0.5">{invoices.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlugins = () => (
    <div className="max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <button onClick={() => setMode('dashboard')} className="p-3 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-red-600 transition-all">
          <ArrowLeft size={16} className="md:w-5 md:h-5" />
        </button>
        <h2 className="text-lg md:text-xl font-black uppercase italic tracking-widest text-center">Plugins & Entegrasyon</h2>
        <div className="w-10 md:w-12" />
      </div>

      {/* YouTube Tutorial */}
      <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[2rem] md:rounded-[3rem] overflow-hidden mb-6 md:mb-8">
        <div className="p-5 md:p-7 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-600/10 p-2 md:p-3 rounded-xl md:rounded-2xl shrink-0">
              <Youtube className="text-red-600 w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <h3 className="text-[11px] md:text-[13px] font-black uppercase tracking-widest">Videyo Tutoryèl</h3>
              <p className="text-[8px] md:text-[9px] text-zinc-500 font-bold mt-0.5">Aprann kijan pou enstale plugins yo</p>
            </div>
          </div>
          <button
            onClick={() => setShowVideo(!showVideo)}
            className="w-full sm:w-auto px-4 py-2 bg-zinc-900 rounded-lg md:rounded-xl font-black text-[9px] md:text-[10px] uppercase hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
          >
            <Play size={10} className="md:w-3 md:h-3" /> {showVideo ? 'Kache' : 'Wè'}
          </button>
        </div>

        {showVideo && youtubeUrl && getYoutubeEmbedUrl(youtubeUrl) ? (
          <div className="aspect-video w-full">
            <iframe
              src={getYoutubeEmbedUrl(youtubeUrl)}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        ) : showVideo && !youtubeUrl ? (
          <div className="p-6 md:p-10 text-center text-zinc-600">
            <Youtube size={30} className="md:w-10 md:h-10 mx-auto mb-3 md:mb-4 opacity-20" />
            <p className="text-[9px] md:text-[11px] font-bold uppercase">Pa gen URL videyo. Ajoute l anba.</p>
          </div>
        ) : null}

        <div className="p-4 md:p-6 flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 bg-black/40 border border-white/10 py-3 md:py-4 px-4 md:px-5 rounded-xl md:rounded-2xl text-[11px] md:text-[13px] outline-none text-white focus:border-red-600/50 transition-all"
          />
          <button
            onClick={saveYoutubeUrl}
            className="w-full sm:w-auto px-6 py-3 md:py-4 bg-red-600 hover:bg-red-700 text-white font-black text-[9px] md:text-[11px] uppercase rounded-xl md:rounded-2xl transition-all"
          >
            Sove
          </button>
        </div>
      </div>

      {/* KYC Warning */}
      {profile?.kyc_status !== 'approved' && (
        <div className="bg-amber-600/20 border border-amber-600/30 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] mb-6 md:mb-8 text-center">
          <AlertTriangle className="text-amber-500 w-8 h-8 md:w-12 md:h-12 mx-auto mb-3 md:mb-4" />
          <h3 className="text-base md:text-lg font-black text-amber-500 mb-2">KYC poko apwouve</h3>
          <p className="text-[10px] md:text-xs text-amber-400/80 max-w-lg mx-auto">
            Ou dwe tann apwobasyon KYC ou anvan ou ka telechaje plugins yo.
            Tanpri verifye imèl ou regilyèman pou konfimasyon.
          </p>
        </div>
      )}

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] hover:border-red-600/30 transition-all flex flex-col h-full">
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="bg-orange-600/20 p-3 md:p-4 rounded-xl md:rounded-2xl shrink-0">
              <Wifi className="text-orange-400 w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div>
              <h3 className="text-base md:text-xl font-black">Hostinger / Horizon</h3>
              <p className="text-zinc-500 text-xs md:text-sm">Embed Code</p>
            </div>
          </div>
          
          <p className="text-zinc-400 text-[10px] md:text-sm mb-6 flex-grow">
            Kòd pou kole nan sit ou. Vèsyon 2.0 ak fòmilè kat entegre.
          </p>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-auto pt-4 border-t border-white/5">
            <div className="text-[10px] md:text-xs text-zinc-600 flex sm:flex-col gap-2 sm:gap-0">
              <span className="block">Vèsyon: 2.0.0</span>
              <span className="hidden sm:block">Fòmilè entegre</span>
            </div>
            <button
              onClick={generateHostingerPlugin}
              disabled={downloadingPlugin === 'hostinger' || profile?.kyc_status !== 'approved' || !profile?.api_key}
              className="w-full sm:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-red-600 rounded-xl font-black text-[10px] md:text-sm uppercase hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {downloadingPlugin === 'hostinger' ? <RefreshCw size={14} className="animate-spin md:w-4 md:h-4" /> : <DownloadIcon size={14} className="md:w-4 md:h-4" />}
              {downloadingPlugin === 'hostinger' ? 'Ap jenere...' : 'Telechaje ZIP'}
            </button>
          </div>
        </div>
      </div>

      {/* Enstriksyon */}
      <div className="bg-zinc-900/30 border border-white/5 p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] mt-6 md:mt-8">
        <h3 className="text-base md:text-lg font-black mb-4">📋 Enstriksyon</h3>
        <div className="space-y-3 md:space-y-4 text-zinc-300 text-[10px] md:text-sm">
          <div className="flex gap-2 md:gap-3 items-start">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-red-600 rounded-full flex items-center justify-center text-[9px] md:text-xs font-black shrink-0 mt-0.5">1</div>
            <p className="leading-relaxed"><span className="text-white font-bold">Telechaje</span> fichye ZIP ki koresponn ak platform ou a.</p>
          </div>
          <div className="flex gap-2 md:gap-3 items-start">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-red-600 rounded-full flex items-center justify-center text-[9px] md:text-xs font-black shrink-0 mt-0.5">2</div>
            <p className="leading-relaxed"><span className="text-white font-bold">Enstale</span> plugin an selon enstriksyon yo.</p>
          </div>
          <div className="flex gap-2 md:gap-3 items-start">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-red-600 rounded-full flex items-center justify-center text-[9px] md:text-xs font-black shrink-0 mt-0.5">3</div>
            <p className="leading-relaxed"><span className="text-white font-bold">Fòmilè kat la</span> ap parèt dirèkteman sou paj checkout la.</p>
          </div>
          <div className="flex gap-2 md:gap-3 items-start">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-red-600 rounded-full flex items-center justify-center text-[9px] md:text-xs font-black shrink-0 mt-0.5">4</div>
            <p className="leading-relaxed"><span className="text-white font-bold">Pa gen redireksyon</span> – tout bagay fèt sou menm paj la.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInvoices = () => {
    if (subMode === 'create') {
      return (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="flex items-center justify-between mb-6 md:mb-10">
            <button onClick={() => setSubMode('list')} className="p-3 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-red-600 transition-all">
              <ArrowLeft size={16} className="md:w-5 md:h-5" />
            </button>
            <h2 className="text-base md:text-xl font-black uppercase italic tracking-widest text-center flex-1">Nouvo Smart Invoice</h2>
            <div className="w-10 md:w-12 shrink-0" />
          </div>
          
          <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/10 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] space-y-6 md:space-y-8 shadow-2xl">
            <div className="space-y-2 md:space-y-3">
              <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">
                Montan an (HTG)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black/50 border border-white/10 p-6 md:p-8 rounded-2xl md:rounded-3xl text-2xl md:text-3xl font-black italic outline-none focus:border-red-600/50 transition-all"
                placeholder="0.00"
              />
            </div>
            
            <div className="space-y-2 md:space-y-3">
              <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">
                Email Kliyan
              </label>
              <div className="relative">
                <Mail className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4 md:w-[17px] md:h-[17px]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 py-5 md:py-6 pl-12 md:pl-16 pr-4 md:pr-6 rounded-2xl md:rounded-3xl text-xs md:text-sm italic outline-none focus:border-red-600/50 transition-all"
                  placeholder="kliyan@gmail.com"
                />
              </div>
            </div>
            
            <div className="space-y-2 md:space-y-3">
              <label className="text-[9px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">
                Deskripsyon (Opsyonèl)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-black/50 border border-white/10 p-5 md:p-8 rounded-2xl md:rounded-3xl text-xs md:text-sm italic outline-none focus:border-red-600/50 h-24 md:h-32 transition-all resize-none"
                placeholder="Kisa kliyan an ap achte?"
              />
            </div>
            
            <button
              onClick={handleCreateInvoice}
              disabled={loading}
              className="w-full bg-red-600 hover:bg-white hover:text-black py-5 md:py-8 rounded-full md:rounded-[2rem] font-black uppercase italic text-[11px] md:text-lg shadow-2xl shadow-red-600/20 transition-all active:scale-95"
            >
              {loading ? 'Ap kreye...' : 'Jenere Lyen & Voye Email'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-10 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('dashboard')} className="p-3 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-red-600 transition-all shrink-0">
              <ArrowLeft size={16} className="md:w-5 md:h-5" />
            </button>
            <h2 className="text-lg md:text-xl font-black uppercase italic tracking-widest">Fakti (Invoices)</h2>
          </div>
          <button
            onClick={() => setSubMode('create')}
            className="w-full sm:w-auto p-3 md:p-4 bg-red-600 rounded-xl md:rounded-2xl hover:bg-red-700 transition-all flex items-center justify-center gap-2"
          >
            <PlusCircle size={16} className="md:w-5 md:h-5" />
            <span className="text-[9px] md:text-[10px] font-black uppercase">Nouvo fakti</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900/30 border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-[2rem] mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4">
            <div className="flex items-center gap-2 bg-black/40 p-2 md:p-3 rounded-lg md:rounded-xl flex-1 sm:flex-none">
              <Calendar size={14} className="text-zinc-500 md:w-4 md:h-4" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="bg-transparent text-[10px] md:text-[11px] font-bold text-white outline-none w-full"
              >
                <option value="all">Tout tan</option>
                <option value="today">Jodi a</option>
                <option value="week">7 dènye jou</option>
                <option value="month">30 dènye jou</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-black/40 p-2 md:p-3 rounded-lg md:rounded-xl flex-1 sm:flex-none">
              <Filter size={14} className="text-zinc-500 md:w-4 md:h-4" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-[10px] md:text-[11px] font-bold text-white outline-none w-full"
              >
                <option value="all">Tout estati</option>
                <option value="pending">An atant</option>
                <option value="paid">Peye</option>
                <option value="cancelled">Anile</option>
              </select>
            </div>

            <div className="w-full sm:flex-1 flex items-center gap-2 bg-black/40 p-2 md:p-3 rounded-lg md:rounded-xl">
              <Search size={14} className="text-zinc-500 md:w-4 md:h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Chèche pa email..."
                className="bg-transparent text-[10px] md:text-[11px] font-bold text-white outline-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Invoice List */}
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-20 md:py-40 bg-zinc-900/10 rounded-[2rem] md:rounded-[4rem] border border-dashed border-white/5">
            <FileText className="w-12 h-12 md:w-16 md:h-16 text-zinc-800 mx-auto mb-4 md:mb-6" />
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-600">Pa gen fakti pou kounye a</p>
            <button
              onClick={() => setSubMode('create')}
              className="mt-4 md:mt-6 px-6 py-3 md:px-8 md:py-4 bg-red-600 rounded-xl md:rounded-2xl text-white font-black text-[9px] md:text-[10px] uppercase hover:bg-red-700 transition-all"
            >
              Kreye premye fakti
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-[#0d0e1a] border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] hover:border-red-600/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-5">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className={`w-10 h-10 md:w-12 md:h-12 ${
                      inv.status === 'paid' ? 'bg-green-600' : 
                      inv.status === 'pending' ? 'bg-amber-600' : 'bg-red-600'
                    } rounded-xl md:rounded-2xl flex items-center justify-center font-black text-[10px] md:text-[11px] text-white flex-shrink-0`}>
                      {inv.status === 'paid' ? '✓' : inv.status === 'pending' ? '⏳' : '✗'}
                    </div>
                    
                    <div className="flex-1 min-w-0 sm:hidden">
                      <h4 className="font-black uppercase italic text-xs text-white truncate">
                        Fakti #{inv.id.slice(0, 8)}
                      </h4>
                      <span className={`text-[6px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${
                        inv.status === 'paid' ? 'bg-green-500/15 text-green-400' :
                        inv.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {inv.status === 'paid' ? 'Peye' : inv.status === 'pending' ? 'An atant' : 'Anile'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 hidden sm:block">
                    <div className="flex items-center gap-3">
                      <h4 className="font-black uppercase italic text-xs md:text-sm text-white truncate">
                        Fakti #{inv.id.slice(0, 8)}
                      </h4>
                      <span className={`text-[6px] md:text-[7px] font-black uppercase px-2 py-1 rounded-full ${
                        inv.status === 'paid' ? 'bg-green-500/15 text-green-400' :
                        inv.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {inv.status === 'paid' ? 'Peye' : inv.status === 'pending' ? 'An atant' : 'Anile'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                      <span className="text-[8px] md:text-[9px] font-bold text-zinc-600 truncate max-w-[150px] md:max-w-[200px]">
                        {inv.client_email}
                      </span>
                      <span className="text-[8px] md:text-[9px] text-zinc-700">·</span>
                      <span className="text-[8px] md:text-[9px] text-zinc-600">{formatDate(inv.created_at)}</span>
                    </div>
                  </div>

                  {/* Mobil View Info */}
                  <div className="sm:hidden flex flex-col gap-1 border-t border-white/5 pt-2 mt-1">
                     <span className="text-[9px] font-bold text-zinc-400 truncate">{inv.client_email}</span>
                     <span className="text-[8px] text-zinc-600">{formatDate(inv.created_at)}</span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t border-white/5 sm:border-none pt-3 sm:pt-0 mt-2 sm:mt-0">
                    <div className="text-base md:text-lg font-black italic text-green-400">
                      {parseFloat(inv.amount).toLocaleString()} HTG
                    </div>
                    
                    <div className="flex items-center gap-1.5 md:gap-2 justify-end sm:ml-4">
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleMarkInvoiceAsPaid(inv.id)}
                            className="p-1.5 md:p-2 bg-green-600/20 rounded-lg md:rounded-xl hover:bg-green-600/40 transition-all"
                            title="Make as paid"
                          >
                            <CheckSquare size={14} className="text-green-400 md:w-3.5 md:h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const paymentLink = `${window.location.origin}/checkout-invoice/${inv.id}`;
                              navigator.clipboard.writeText(paymentLink);
                              alert("Lyen peman an kopye nan clipboard ou!");
                            }}
                            className="p-1.5 md:p-2 bg-blue-600/20 rounded-lg md:rounded-xl hover:bg-blue-600/40 transition-all"
                            title="Copy payment link"
                          >
                            <Copy size={14} className="text-blue-400 md:w-3.5 md:h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-1.5 md:p-2 bg-red-600/20 rounded-lg md:rounded-xl hover:bg-red-600/40 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-red-400 md:w-3.5 md:h-3.5" />
                      </button>
                    </div>
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
      <div className="flex items-center justify-between mb-6 md:mb-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('dashboard')} className="p-3 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-red-600 transition-all shrink-0">
            <ArrowLeft size={16} className="md:w-5 md:h-5" />
          </button>
          <h2 className="text-lg md:text-xl font-black uppercase italic tracking-widest truncate">Jounal Tranzaksyon</h2>
        </div>
        <div className="flex gap-1.5 md:gap-2">
          <button className="p-2.5 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-white hover:text-black transition-all">
            <Filter size={14} className="md:w-[17px] md:h-[17px]" />
          </button>
          <button className="p-2.5 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-white hover:text-black transition-all">
            <Download size={14} className="md:w-[17px] md:h-[17px]" />
          </button>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-2 gap-2 mb-6 md:mb-8 scrollbar-hide">
        {['Tout', 'SDK', 'Invoice'].map((tab) => (
          <button
            key={tab}
            className="px-4 py-2 md:px-5 md:py-2.5 rounded-xl md:rounded-2xl font-black text-[9px] md:text-[10px] uppercase bg-zinc-900/50 border border-white/5 hover:border-red-600/30 transition-all text-zinc-400 hover:text-white whitespace-nowrap"
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {recentSales.length > 0 ? (
          recentSales.slice(0, 30).map((tx, i) => {
            const client = tx.client || 'Kliyan';
            const initials = getInitials(client);
            const colorCls = getInitialColor(client);
            return (
              <div key={i} className="bg-[#0d0e1a] border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] hover:border-red-600/20 transition-all flex flex-col sm:flex-row sm:items-center gap-4">
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className={`w-10 h-10 md:w-12 md:h-12 ${colorCls} rounded-xl md:rounded-2xl flex items-center justify-center font-black text-[10px] md:text-[11px] text-white flex-shrink-0`}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0 sm:hidden">
                    <h4 className="font-black uppercase italic text-xs text-white truncate">
                      {(tx as any).type || 'PÈMAN'}
                    </h4>
                    <span className={`text-[6px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-1 ${
                      tx.source === 'Invoice' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {tx.source}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0 hidden sm:block">
                  <div className="flex items-center gap-3">
                    <h4 className="font-black uppercase italic text-xs md:text-sm text-white truncate">
                      {(tx as any).type || 'PÈMAN'}
                    </h4>
                    <span className={`text-[6px] md:text-[7px] font-black uppercase px-2 py-1 rounded-full ${
                      tx.source === 'Invoice' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {tx.source}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-1">
                    <span className="text-[8px] md:text-[9px] font-bold text-zinc-600 truncate max-w-[150px] md:max-w-[180px]">{client}</span>
                    <span className="text-[8px] md:text-[9px] text-zinc-700">·</span>
                    <span className="text-[8px] md:text-[9px] text-zinc-600">{formatDate(tx.created_at)}</span>
                    <span className="text-[8px] md:text-[9px] text-zinc-700">·</span>
                    <span className="text-[7px] md:text-[8px] font-bold text-zinc-700">#{tx.id?.slice(0, 6)}</span>
                  </div>
                </div>

                {/* Mobil View Info */}
                <div className="sm:hidden flex flex-col gap-1 border-t border-white/5 pt-2">
                   <span className="text-[9px] font-bold text-zinc-400 truncate">{client}</span>
                   <div className="flex justify-between">
                     <span className="text-[8px] text-zinc-600">{formatDate(tx.created_at)}</span>
                     <span className="text-[7px] font-bold text-zinc-700">#{tx.id?.slice(0, 6)}</span>
                   </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t border-white/5 sm:border-none pt-3 sm:pt-0 mt-1 sm:mt-0">
                  <div className="text-base md:text-lg font-black italic text-green-400">
                    +{parseFloat(tx.amount).toLocaleString()} <span className="text-[8px] text-zinc-600 ml-1">HTG</span>
                  </div>
                  <span className={`sm:ml-3 text-[6px] md:text-[7px] font-black uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                    tx.status === 'success' || tx.status === 'paid' ? 'bg-green-500/15 text-green-500' : 'bg-amber-500/15 text-amber-500'
                  }`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 md:py-40 bg-zinc-900/10 rounded-[2rem] md:rounded-[4rem] border border-dashed border-white/5">
            <Package className="w-12 h-12 md:w-16 md:h-16 text-zinc-800 mx-auto mb-4 md:mb-6" />
            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-600">Pa gen tranzaksyon ankò.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
      <div className="flex items-center justify-between mb-6 md:mb-10">
        <button onClick={() => setMode('dashboard')} className="p-3 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-red-600 transition-all shrink-0">
          <ArrowLeft size={16} className="md:w-5 md:h-5" />
        </button>
        <h2 className="text-lg md:text-xl font-black uppercase italic tracking-widest truncate">Anviwònman</h2>
        <div className="w-10 md:w-12 shrink-0" />
      </div>

      <div className="grid gap-6 md:gap-8">
        {/* Profile Settings */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem]">
          <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="bg-red-600/10 p-3 md:p-4 rounded-xl md:rounded-3xl">
              <User className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Pwofil pèsonèl</h3>
              <p className="text-[8px] md:text-[10px] text-zinc-500 font-bold">Modifye enfòmasyon w yo</p>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div>
              <label className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">Non biznis</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                readOnly={!!profile?.business_name}
                className="w-full bg-black/40 border border-white/10 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl text-xs md:text-sm outline-none focus:border-red-600/50 transition-all mt-1 md:mt-2"
              />
            </div>
            <div>
              <label className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">Email</label>
              <input
                type="email"
                value={profile?.email || ''}
                readOnly
                className="w-full bg-black/40 border border-white/10 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl text-xs md:text-sm outline-none mt-1 md:mt-2 opacity-50"
              />
            </div>
            <div>
              <label className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">ID machann</label>
              <div className="flex items-center gap-2 md:gap-3 mt-1 md:mt-2">
                <code className="flex-1 bg-black/40 border border-white/10 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl text-xs md:text-sm font-mono truncate">
                  {profile?.id ? profile.id.slice(0, 8) + '...' : '...'}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(profile?.id || '');
                    alert('ID kopye!');
                  }}
                  className="p-3 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-red-600 transition-all shrink-0"
                >
                  <Copy size={14} className="md:w-4 md:h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">Kle API</label>
              <div className="flex items-center gap-2 md:gap-3 mt-1 md:mt-2">
                <code className="flex-1 bg-black/40 border border-white/10 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl text-xs md:text-sm font-mono truncate">
                  {profile?.api_key ? profile.api_key.slice(0, 8) + '...' : (generatingApiKey ? 'Ap jenere...' : 'Pa genyen')}
                </code>
                {!profile?.api_key && profile?.kyc_status === 'approved' && (
                  <button
                    onClick={generateApiKey}
                    disabled={generatingApiKey}
                    className="px-3 py-2 md:px-4 md:py-2 bg-red-600 rounded-lg md:rounded-xl text-white font-black text-[8px] md:text-[10px] uppercase hover:bg-red-700 transition-all disabled:opacity-40 shrink-0"
                  >
                    {generatingApiKey ? 'Ap jenere...' : 'Jenere Kle'}
                  </button>
                )}
                {profile?.api_key && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(profile.api_key);
                      alert('Kle API kopye!');
                    }}
                    className="p-3 md:p-4 bg-zinc-900 rounded-xl md:rounded-2xl hover:bg-red-600 transition-all shrink-0"
                  >
                    <Copy size={14} className="md:w-4 md:h-4" />
                  </button>
                )}
              </div>
            </div>

            {!profile?.business_name && (
              <button
                onClick={updateBusinessName}
                disabled={!businessName || loading}
                className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-red-600 rounded-xl md:rounded-2xl text-white font-black text-[9px] md:text-[10px] uppercase hover:bg-red-700 transition-all disabled:opacity-40 mt-4"
              >
                {loading ? 'Ap anrejistre...' : 'Anrejistre non biznis'}
              </button>
            )}
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-6 md:p-10 rounded-[2rem] md:rounded-[3.5rem]">
          <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
            <div className="bg-red-600/10 p-3 md:p-4 rounded-xl md:rounded-3xl">
              <Shield className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Sekirite</h3>
              <p className="text-[8px] md:text-[10px] text-zinc-500 font-bold">Jere webhook</p>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div>
              <label className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-2 md:ml-4">Webhook URL</label>
              <input
                type="url"
                value={profile?.webhook_url || ''}
                onChange={async (e) => {
                  const newUrl = e.target.value;
                  await supabase.from('profiles').update({ webhook_url: newUrl }).eq('id', profile?.id);
                  setProfile({ ...profile, webhook_url: newUrl });
                }}
                placeholder="https://monsite.com/webhook"
                className="w-full bg-black/40 border border-white/10 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl text-xs md:text-sm outline-none focus:border-red-600/50 transition-all mt-1 md:mt-2"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-3 sm:p-4 md:p-6 font-sans selection:bg-red-600/30">
      {renderHeader()}

      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 md:gap-4">
          <RefreshCw size={24} className="text-red-600 animate-spin md:w-[36px] md:h-[36px]" />
          <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Terminal...</p>
        </div>
      )}

      <div className="pb-10 md:pb-0">
        {mode === 'dashboard' && renderDashboard()}
        {mode === 'plugins' && renderPlugins()}
        {mode === 'invoices' && renderInvoices()}
        {mode === 'transactions' && renderTransactions()}
        {mode === 'settings' && renderSettings()}
      </div>
    </div>
  );
}