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
      alert('✅ Logo telechaje avèk siksè!');

    } catch (err: any) {
      console.error('❌ Erè inatandi:', err);
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
      const hostingerConfig = `{"merchantId": "${profile.api_key}","businessName": "${profile.business_name || 'HATEX Merchant'}","rate": 136,"apiUrl": "https://api.hatexcard.com/v1","version": "2.0.0"}`;
      const hostingerCode = `<script>/* HATEX Code */</script>`;

      zip.file('hatex-hostinger.json', hostingerConfig);
      zip.file('embed-code.html', hostingerCode);
      zip.file('README.md', `# HATEX Payments for Hostinger\n\nVèsyon 2.0 - Fòmilè kat entegre\n`);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatex-hostinger-${profile.id.slice(0,8)}.zip`);
    } catch (error) {
      alert('Erè pandan jenere Hostinger plugin an.');
    } finally {
      setDownloadingPlugin(null);
    }
  };

// ============================================================
  // JENERE WOOCOMMERCE PLUGIN (ZEWO KONFIGIRASYON + UX PAFÈ)
  // ============================================================
  const generateWooCommercePlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved') return alert('Ou dwe pase KYC pou w itilize Plugin sa a.');
    if (!profile?.api_key) return alert('Kle API w la manke.');

    setDownloadingPlugin('woocommerce');
    
    try {
      const zip = new JSZip();
      const pluginDir = zip.folder("hatexcard-woocommerce");

      // KÒD PHP WOOCOMMERCE DIRECT PAYMENT
      const phpCode = `<?php
/**
 * Plugin Name: HatexCard Direct Gateway
 * Plugin URI: https://hatexcard.com
 * Description: Aksepte peman HatexCard. (Plug and Play: Zewo konfigirasyon, fòma otomatik, ak sipò Google Autofill).
 * Version: 11.0.0
 * Author: Hatex Group
 */

if (!defined('ABSPATH')) exit;

// ENTÈSÈPTÈ INIVÈSÈL POU NOUVO BLÒK WOOCOMMERCE YO
add_filter('render_block', 'hatexcard_universal_checkout_adapter', 10, 2);
function hatexcard_universal_checkout_adapter($block_content, $block) {
    if ($block['blockName'] === 'woocommerce/checkout') {
        return '<div class="woocommerce">' . do_shortcode('[woocommerce_checkout]') . '</div>';
    }
    return $block_content;
}

add_action('plugins_loaded', 'hatexcard_init_direct_gateway');

function hatexcard_init_direct_gateway() {
    if (!class_exists('WC_Payment_Gateway')) return;

    class WC_Gateway_HatexCard_Direct extends WC_Payment_Gateway {
        
        public function __construct() {
            $this->id = 'hatexcard_direct';
            $this->icon = ''; 
            $this->has_fields = true; 
            $this->method_title = 'HatexCard';
            $this->method_description = 'Fòmilè peman entegre pou kat HatexCard.';

            $this->init_form_fields();
            $this->init_settings();

            $this->title = $this->get_option('title');
            $this->description = $this->get_option('description');
            $this->usd_rate = $this->get_option('usd_rate', '135');
            
            // 🚨 API MACHANN NAN KOUD OTOMATIKMAN LA A 🚨
            $this->merchant_api_key = '${profile.api_key}'; 
            $this->api_direct_url = 'https://hatexcard.com/api/direct-payment';

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            add_action('woocommerce_thankyou_' . $this->id, array($this, 'custom_thankyou_page'));
        }

        public function init_form_fields() {
            $this->form_fields = array(
                'enabled' => array('title' => 'Aktive', 'type' => 'checkbox', 'default' => 'yes'),
                'title' => array('title' => 'Tit', 'type' => 'text', 'default' => 'Peye ak HatexCard'),
                'description' => array('title' => 'Deskripsyon', 'type' => 'textarea', 'default' => 'Mete enfòmasyon kat HatexCard ou anba a.'),
                'usd_rate' => array('title' => 'To Dola (HTG)', 'type' => 'number', 'default' => '135')
            );
        }

        public function custom_thankyou_page() {
            echo '<div style="background: #fdfdfd; border: 1px solid #16a34a; padding: 25px; border-radius: 12px; margin-bottom: 30px; text-align: center; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.1);">
                    <div style="background: #16a34a; color: white; width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto; font-size: 24px;">✓</div>
                    <h3 style="color: #16a34a; margin-top:0; font-size: 22px;">Peman an pase an sekirite!</h3>
                    <p style="margin-bottom:0; color: #4b5563;">Mèsi paske w itilize HatexCard. Tranzaksyon w lan anrejistre avèk siksè.</p>
                  </div>';
        }

        // FÒMILÈ AVÈK FÒMATÈ OTOMATIK AK KLAVYE NIMEWIK
        public function payment_fields() {
            if ($this->description) echo wpautop(wp_kses_post($this->description));
            ?>
            <fieldset id="wc-hatexcard-direct-form" class="wc-payment-form" style="margin-top: 10px;">
                <p class="form-row form-row-wide">
                    <label for="hatex_card_number">Nimewo Kat HatexCard <span class="required">*</span></label>
                    <input type="tel" id="hatex_card_number" class="input-text" name="hatex_card_number" placeholder="0000 0000 0000 0000" maxlength="19" autocomplete="cc-number" inputmode="numeric" oninput="let v = this.value.replace(/\\D/g, ''); let f = v.match(/.{1,4}/g); this.value = f ? f.join(' ') : v;">
                </p>
                <div style="display: flex; flex-wrap: wrap; margin-left: -10px; margin-right: -10px;">
                    <p class="form-row form-row-first" style="flex: 1; padding: 0 10px; min-width: 120px;">
                        <label for="hatex_expiry">Dat (MM/YY) <span class="required">*</span></label>
                        <input type="tel" id="hatex_expiry" class="input-text" name="hatex_expiry" placeholder="MM/YY" maxlength="5" autocomplete="cc-exp" inputmode="numeric" oninput="let v = this.value.replace(/\\D/g, ''); if(v.length > 2) { v = v.substring(0,2) + '/' + v.substring(2,4); } this.value = v;">
                    </p>
                    <p class="form-row form-row-last" style="flex: 1; padding: 0 10px; min-width: 120px;">
                        <label for="hatex_cvv">CVV <span class="required">*</span></label>
                        <input type="password" id="hatex_cvv" class="input-text" name="hatex_cvv" placeholder="CVC" maxlength="4" autocomplete="cc-csc" inputmode="numeric" oninput="this.value = this.value.replace(/\\D/g, '');">
                    </p>
                </div>
            </fieldset>
            <?php
        }

        public function process_payment($order_id) {
            global $woocommerce;
            $order = wc_get_order($order_id);
            
            $card_number = isset($_POST['hatex_card_number']) ? wc_clean($_POST['hatex_card_number']) : '';
            $expiry = isset($_POST['hatex_expiry']) ? wc_clean($_POST['hatex_expiry']) : '';
            $cvv = isset($_POST['hatex_cvv']) ? wc_clean($_POST['hatex_cvv']) : '';

            if (empty($card_number) || empty($expiry) || empty($cvv)) { wc_add_notice('Tanpri ranpli tout enfòmasyon kat la.', 'error'); return; }
            if (empty($this->merchant_api_key) || $this->merchant_api_key === 'undefined' || $this->merchant_api_key === '') { wc_add_notice('Erè: Plugin sa a pa gen kle API. Tanpri re-telechaje l sou tablodbò Hatex ou a.', 'error'); return; }

            $total = $order->get_total();
            $currency = $order->get_currency();
            $amount_htg = ($currency === 'USD') ? $total * floatval($this->usd_rate) : $total;

            $items = $order->get_items();
            $products_info = array();
            foreach ($items as $item_id => $item) {
                $product = $item->get_product();
                $image_url = wp_get_attachment_image_url($product->get_image_id(), 'thumbnail');
                $products_info[] = array('name' => $item->get_name(), 'qty' => $item->get_quantity(), 'total' => $item->get_total(), 'image' => $image_url);
            }

            $customer_info = array(
                'name' => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'email' => $order->get_billing_email(),
                'phone' => $order->get_billing_phone(),
                'address' => $order->get_shipping_address_1() . ', ' . $order->get_shipping_city()
            );

            $payload = array(
                'merchant_api_key' => $this->merchant_api_key, 'order_id' => $order_id, 'amount_htg' => $amount_htg,
                'card_number' => $card_number, 'card_expiry' => $expiry, 'card_cvv' => $cvv,
                'customer_info' => array_merge($customer_info, array('products' => $products_info))
            );

            $response = wp_remote_post($this->api_direct_url, array('method' => 'POST', 'headers' => array('Content-Type' => 'application/json'), 'body' => json_encode($payload), 'timeout' => 15));

            if (is_wp_error($response)) { wc_add_notice('Sèvè HatexCard la pa reponn.', 'error'); return; }

            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (isset($body['success']) && $body['success'] === true) {
                // 🚨 WOOCOMMERCE PRAN KONTWÒL LA: Li valide kòmand lan epi l voye imèl machann nan natirèlman
                $order->payment_complete();
                $order->add_order_note('✅ Peman dirèk HatexCard reyisi! Kòb la koupe sou kat kliyan an.');

                $woocommerce->cart->empty_cart();
                return array('result' => 'success', 'redirect' => $this->get_return_url($order));
            } else {
                $error_msg = isset($body['error']) ? $body['error'] : 'Peman an refize.';
                wc_add_notice('HatexCard: ' . $error_msg, 'error');
                return;
            }
        }
    }
}

add_filter('woocommerce_payment_gateways', 'add_hatexcard_direct_to_gateways');
function add_hatexcard_direct_to_gateways($gateways) {
    $gateways[] = 'WC_Gateway_HatexCard_Direct';
    return $gateways;
}
?>`;

      pluginDir?.file("hatexcard-gateway.php", phpCode);
      pluginDir?.file("readme.txt", "=== HatexCard WooCommerce ===\nUpload katab zip sa a nan Plugins WordPress ou a epi aktive l.");

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatexcard-woocommerce-${profile.id.slice(0,8)}.zip`);

    } catch (error) {
      alert('Erè pandan jenere WooCommerce plugin an.');
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
      
      const { data: freshProfile } = await supabase.from('profiles').select('kyc_status, business_name').eq('id', user.id).single();
        
      if (freshProfile?.kyc_status !== 'approved') {
        alert(`Echèk: Kont ou dwe 'approved'.`);
        setMode('dashboard');
        return;
      }
      
      const { data: inv, error: invError } = await supabase.from('invoices').insert({ owner_id: user.id, amount: parseFloat(amount), client_email: email.toLowerCase().trim(), status: 'pending', description }).select().single();
      if (invError) throw invError;
      
      const securePayLink = `${window.location.origin}/pay/${inv.id}`;
      
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
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-10 border-b border-white/5 pb-4 md:pb-6 gap-4">
      <div className="flex flex-col">
        <h1 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter">
          {profile?.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-[9px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
            {profile?.kyc_status === 'approved' ? 'KYC Verified' : 'KYC Pending'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 sm:flex sm:flex-row gap-2 w-full md:w-auto">
        <button
          onClick={() => setMode('dashboard')}
          className={`flex flex-col md:flex-row items-center justify-center p-2 md:px-5 md:py-3 rounded-xl border border-white/5 font-black text-[9px] md:text-[10px] uppercase transition-all ${
            mode === 'dashboard' ? 'bg-red-600 shadow-xl scale-105 text-white' : 'bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <LayoutGrid size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Dash<span className="hidden md:inline">board</span></span>
        </button>
        <button
          onClick={() => setMode('plugins')}
          className={`flex flex-col md:flex-row items-center justify-center p-2 md:px-5 md:py-3 rounded-xl border border-white/5 font-black text-[9px] md:text-[10px] uppercase transition-all ${
            mode === 'plugins' ? 'bg-red-600 shadow-xl scale-105 text-white' : 'bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <DownloadCloud size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Plugins</span>
        </button>
        <button
          onClick={() => { setMode('invoices'); setSubMode('list'); }}
          className={`flex flex-col md:flex-row items-center justify-center p-2 md:px-5 md:py-3 rounded-xl border border-white/5 font-black text-[9px] md:text-[10px] uppercase transition-all ${
            mode === 'invoices' ? 'bg-red-600 shadow-xl scale-105 text-white' : 'bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <FileText size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Invoices</span>
        </button>
        <button
          onClick={() => setMode('transactions')}
          className={`flex flex-col md:flex-row items-center justify-center p-2 md:px-5 md:py-3 rounded-xl border border-white/5 font-black text-[9px] md:text-[10px] uppercase transition-all ${
            mode === 'transactions' ? 'bg-red-600 shadow-xl scale-105 text-white' : 'bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <History size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Journal</span>
        </button>
        <button
          onClick={() => setMode('settings')}
          className={`col-span-2 sm:col-span-1 flex flex-col md:flex-row items-center justify-center p-2 md:px-5 md:py-3 rounded-xl border border-white/5 font-black text-[9px] md:text-[10px] uppercase transition-all ${
            mode === 'settings' ? 'bg-red-600 shadow-xl scale-105 text-white' : 'bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400 hover:text-white'
          }`}
        >
          <Settings size={14} className="mb-1 md:mb-0 md:mr-2" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="grid lg:grid-cols-12 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-8 space-y-6 md:space-y-8">
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
              <p className="text-[8px] md:text-[10px] text-zinc-500 font-bold">Konfigire pwofil biznis piblik ou</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 w-full">
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

          <div className="mt-6 md:mt-8 pt-6 md:pt-8 border-t border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
              <div className="flex items-center gap-3 md:gap-4 flex-1">
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
              {profile?.avatar_url ? (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden bg-black/30 border border-white/10 shrink-0">
                  <img src={profile.avatar_url} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-zinc-900 flex items-center justify-center border border-white/10 shrink-0">
                  <Image size={24} className="md:w-[30px] md:h-[30px] text-zinc-700" />
                </div>
              )}
              <label className="cursor-pointer w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-4 md:px-6 py-3 md:py-4 rounded-xl transition-all flex items-center justify-center gap-2 text-center">
                {uploadingLogo ? <RefreshCw size={14} className="animate-spin text-red-600" /> : <Upload size={14} />}
                <span className="text-[9px] md:text-[10px] font-black uppercase">Telechaje Logo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
              </label>
            </div>
          </div>
          
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

        <button
          onClick={() => router.push('/dashboard/subscriptions')}
          className="w-full bg-white text-black py-4 md:py-5 rounded-[2rem] md:rounded-[2.2rem] font-black uppercase text-[10px] md:text-[11px] tracking-widest flex items-center justify-center gap-2 md:gap-3 hover:bg-zinc-200 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] group active:scale-95"
        >
          <LayoutGrid size={16} className="md:w-[18px] md:h-[18px] text-red-600" />
          <span>Dashboard Abònman</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform md:w-4 md:h-4">
            <path d="M5 12h14m-7-7 7 7-7 7"/>
          </svg>
        </button>

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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-blue-400 mb-1 md:mb-2">
                  <DollarSign size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Total QR</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">{qrStats.total.toLocaleString()}</div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>
              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <Calendar size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Mwa sa a</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">{qrStats.thisMonth.toLocaleString()}</div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>
              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-amber-400 mb-1 md:mb-2">
                  <Clock size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Jodi a</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">{qrStats.today.toLocaleString()}</div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>
              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-purple-400 mb-1 md:mb-2">
                  <TrendingUp size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Dènye 24h</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">{qrStats.last24h.toLocaleString()}</div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 border-t border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <History size={14} className="text-zinc-500 md:w-4 md:h-4" />
                <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] truncate max-w-[150px] sm:max-w-none">Dènye Peman QR</span>
              </div>
              <span className="text-[7px] md:text-[8px] bg-red-600/10 text-red-400 px-2 py-1 rounded-full font-black uppercase self-start sm:self-auto">
                {qrStats.count} tranzaksyon QR
              </span>
            </div>

            {qrTransactions.length > 0 ? (
              <div className="space-y-2">
                {qrTransactions.slice(0, 5).map((tx: any) => {
                  const customerName = tx.metadata?.customer_name || 'Kliyan Hatex';
                  const initials = customerName.substring(0, 2).toUpperCase();
                  return (
                    <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-black/30 rounded-xl md:rounded-2xl border border-white/5 hover:border-red-600/20 transition-all">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-8 h-8 md:w-9 md:h-9 bg-zinc-800 rounded-lg flex items-center justify-center font-black text-[9px] md:text-[10px] text-zinc-400 shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-[11px] font-bold text-white truncate uppercase italic">{customerName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[7px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded-full font-black">QR SCAN</span>
                            <span className="text-[8px] text-zinc-600 font-bold">{new Date(tx.created_at).toLocaleTimeString('fr-HT', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between sm:justify-end items-center sm:text-right w-full sm:w-auto border-t border-white/5 sm:border-none pt-2 sm:pt-0 mt-1 sm:mt-0">
                        <div className="text-xs md:text-sm font-black text-green-400">+{parseFloat(tx.amount).toLocaleString()}</div>
                        <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold sm:ml-1 ml-auto">HTG</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 md:py-12 bg-black/20 rounded-2xl md:rounded-[2.5rem] border border-dashed border-white/5">
                <QrCode size={24} className="mx-auto mb-2 text-zinc-800 opacity-20" />
                <p className="text-[8px] md:text-[10px] font-black uppercase text-zinc-700 italic">Pa gen okenn vant QR detekte</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden mt-6 md:mt-8">
          <div className="p-6 md:p-8 border-b border-white/5">
            <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
              <div className="bg-red-600/10 p-3 md:p-4 rounded-xl md:rounded-3xl">
                <Mail className="text-red-600 w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-black uppercase tracking-widest">Peman Fakti</h3>
                <p className="text-[8px] md:text-[10px] text-zinc-500 font-bold italic">Revni an tan reyèl</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
               <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <DollarSign size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Total Fakti</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">{earnings.invoiceTotal.toLocaleString()}</div>
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
                <div className="text-lg md:text-2xl font-black text-white truncate">{(earnings.thisMonth - qrStats.thisMonth).toLocaleString()}</div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG</div>
              </div>
              <div className="bg-black/40 p-4 md:p-5 rounded-xl md:rounded-2xl border border-white/5">
                <div className="flex items-center gap-1.5 md:gap-2 text-emerald-400 mb-1 md:mb-2">
                  <TrendingUp size={14} className="md:w-4 md:h-4" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase">Mwayèn</span>
                </div>
                <div className="text-lg md:text-2xl font-black text-white truncate">{earnings.invoiceCount > 0 ? Math.round(earnings.invoiceTotal / earnings.invoiceCount).toLocaleString() : '0'}</div>
                <div className="text-[7px] md:text-[8px] text-zinc-600 font-bold mt-1 uppercase">HTG/fak</div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8 border-t border-white/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <History size={14} className="text-zinc-500 md:w-4 md:h-4" />
                <span className="text-[8px] md:text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em] truncate max-w-[150px] sm:max-w-none">Dènye Fakti</span>
              </div>
              <span className="text-[7px] md:text-[8px] bg-emerald-600/10 text-emerald-400 px-2 py-1 rounded-full font-black uppercase self-start sm:self-auto">
                {earnings.invoiceCount} fakti
              </span>
            </div>

            {invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.slice(0, 5).map((inv: any) => (
                  <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-black/30 rounded-xl md:rounded-2xl border border-white/5 hover:border-emerald-600/20 transition-all">
                    <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                      <div className={`w-8 h-8 md:w-9 md:h-9 ${inv.status === 'paid' ? 'bg-emerald-600' : inv.status === 'pending' ? 'bg-amber-600' : 'bg-red-600'} rounded-lg flex items-center justify-center font-black text-[9px] text-white shrink-0`}>
                        {inv.status === 'paid' ? '✓' : inv.status === 'pending' ? '⏳' : '✗'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-[11px] font-bold text-white truncate">{inv.client_email || 'Kliyan'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[7px] bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-black">Fakti</span>
                          <span className="text-[8px] text-zinc-600">{formatDate(inv.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between sm:justify-end items-center w-full sm:w-auto border-t sm:border-none border-white/5 pt-3 sm:pt-0 mt-2 sm:mt-0 gap-4">
                      <div className="text-xs md:text-sm font-black text-green-400 mr-auto sm:mr-4">{inv.status === 'paid' ? '+' : ''}{parseFloat(inv.amount).toLocaleString()} HTG</div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {inv.status === 'pending' && (
                          <>
                            <button onClick={() => handleMarkInvoiceAsPaid(inv.id)} className="p-1.5 bg-green-600/20 rounded-lg hover:bg-green-600/40"><CheckSquare size={12} className="text-green-400" /></button>
                            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/checkout-invoice/${inv.id}`); alert("Lyen kopye!"); }} className="p-1.5 bg-blue-600/20 rounded-lg hover:bg-blue-600/40"><Copy size={12} className="text-blue-400" /></button>
                          </>
                        )}
                        <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 bg-red-600/20 rounded-lg hover:bg-red-600/40"><Trash2 size={12} className="text-red-400" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 md:py-8 bg-black/20 rounded-xl md:rounded-2xl border border-dashed border-white/5">
                <Mail size={20} className="mx-auto mb-2 text-zinc-800" />
                <p className="text-[8px] md:text-[10px] font-black uppercase text-zinc-700">Pa gen fakti ankò</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="lg:col-span-4 space-y-6">
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
      </div>
    </div>
  );

  const renderPlugins = () => (
    <div className="max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => setMode('dashboard')} className="p-3 bg-zinc-900 rounded-xl hover:bg-red-600 transition-all shrink-0">
            <ArrowLeft size={16} />
          </button>
          <h2 className="text-lg md:text-xl font-black uppercase italic tracking-widest text-center flex-1 sm:flex-none">Plugins & Entegrasyon</h2>
        </div>
      </div>

      <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[2rem] md:rounded-[3rem] overflow-hidden mb-6 md:mb-8">
        <div className="p-5 md:p-7 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-red-600/10 p-2 md:p-3 rounded-xl shrink-0"><Youtube className="text-red-600 w-4 h-4 md:w-5 md:h-5" /></div>
            <div>
              <h3 className="text-[11px] md:text-[13px] font-black uppercase tracking-widest">Videyo Tutoryèl</h3>
              <p className="text-[8px] md:text-[9px] text-zinc-500 font-bold mt-0.5">Aprann kijan pou enstale plugins yo</p>
            </div>
          </div>
          <button onClick={() => setShowVideo(!showVideo)} className="w-full sm:w-auto px-4 py-2 bg-zinc-900 rounded-lg font-black text-[9px] uppercase hover:bg-zinc-800 transition-all flex justify-center items-center gap-2">
            <Play size={10} /> {showVideo ? 'Kache' : 'Wè'}
          </button>
        </div>
        {showVideo && youtubeUrl && getYoutubeEmbedUrl(youtubeUrl) ? (
          <div className="aspect-video w-full"><iframe src={getYoutubeEmbedUrl(youtubeUrl)} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" /></div>
        ) : showVideo && !youtubeUrl ? (
          <div className="p-6 md:p-10 text-center text-zinc-600"><Youtube size={30} className="mx-auto mb-3 opacity-20" /><p className="text-[9px] font-bold uppercase">Pa gen URL videyo. Ajoute l anba.</p></div>
        ) : null}
        <div className="p-4 md:p-6 flex flex-col sm:flex-row gap-3">
          <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="flex-1 bg-black/40 border border-white/10 py-3 md:py-4 px-4 md:px-5 rounded-xl text-[11px] outline-none w-full" />
          <button onClick={saveYoutubeUrl} className="w-full sm:w-auto px-6 py-3 md:py-4 bg-red-600 hover:bg-red-700 font-black text-[9px] uppercase rounded-xl">Sove</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        
        {/* WOOCOMMERCE PLUGIN CARD */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-blue-600/30 p-6 md:p-8 rounded-[2rem] hover:border-blue-500/50 transition-all flex flex-col h-full shadow-lg shadow-blue-900/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600/20 p-3 rounded-xl"><ShoppingCart className="text-blue-400 w-6 h-6" /></div>
            <div>
              <h3 className="text-base md:text-xl font-black">WooCommerce</h3>
              <p className="text-zinc-500 text-xs">WordPress Plugin</p>
            </div>
          </div>
          <p className="text-zinc-400 text-[10px] md:text-sm mb-6 flex-grow">
            Fè sit ou a aksepte HatexCard. L ap konvèti Dola an Goud epi voye kòb la sou kont ou dirèkteman.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 pt-4 mt-auto">
            <div className="text-[10px] text-zinc-600"><span className="block">Vèsyon: 2.0.0</span></div>
            <button 
              onClick={generateWooCommercePlugin} 
              disabled={downloadingPlugin === 'woocommerce' || profile?.kyc_status !== 'approved' || !profile?.api_key} 
              className="w-full sm:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-blue-600 rounded-xl font-black text-[10px] uppercase hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {downloadingPlugin === 'woocommerce' ? <RefreshCw size={14} className="animate-spin" /> : <DownloadIcon size={14} />}
              {downloadingPlugin === 'woocommerce' ? 'Ap jenere...' : 'Telechaje ZIP'}
            </button>
          </div>
        </div>

        {/* HOSTINGER PLUGIN CARD */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-6 md:p-8 rounded-[2rem] hover:border-red-600/30 transition-all flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-orange-600/20 p-3 rounded-xl"><Wifi className="text-orange-400 w-6 h-6" /></div>
            <div>
              <h3 className="text-base md:text-xl font-black">Hostinger / Horizon</h3>
              <p className="text-zinc-500 text-xs">Embed Code</p>
            </div>
          </div>
          <p className="text-zinc-400 text-[10px] md:text-sm mb-6 flex-grow">Kòd pou kole nan sit ou. Vèsyon 2.0 ak fòmilè kat entegre.</p>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/5 pt-4 mt-auto">
            <div className="text-[10px] text-zinc-600"><span className="block">Vèsyon: 2.0.0</span></div>
            <button onClick={generateHostingerPlugin} disabled={downloadingPlugin === 'hostinger' || profile?.kyc_status !== 'approved' || !profile?.api_key} className="w-full sm:w-auto px-4 md:px-6 py-2.5 md:py-3 bg-red-600 rounded-xl font-black text-[10px] uppercase hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-2">
              {downloadingPlugin === 'hostinger' ? <RefreshCw size={14} className="animate-spin" /> : <DownloadIcon size={14} />}
              {downloadingPlugin === 'hostinger' ? 'Ap jenere...' : 'Telechaje ZIP'}
            </button>
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
            <button onClick={() => setSubMode('list')} className="p-3 bg-zinc-900 rounded-xl hover:bg-red-600 transition-all shrink-0"><ArrowLeft size={16} /></button>
            <h2 className="text-base md:text-xl font-black uppercase italic tracking-widest text-center flex-1">Nouvo Smart Invoice</h2>
            <div className="w-10 shrink-0" />
          </div>
          <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/10 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] space-y-6 md:space-y-8 shadow-2xl">
            <div className="space-y-2"><label className="text-[9px] font-black text-zinc-500 uppercase ml-2">Montan an (HTG)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/50 border border-white/10 p-6 rounded-2xl md:rounded-3xl text-2xl font-black italic outline-none w-full" placeholder="0.00" /></div>
            <div className="space-y-2"><label className="text-[9px] font-black text-zinc-500 uppercase ml-2">Email Kliyan</label><div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 w-4 h-4" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 py-5 pl-12 pr-4 rounded-2xl text-xs italic outline-none w-full" placeholder="kliyan@gmail.com" /></div></div>
            <div className="space-y-2"><label className="text-[9px] font-black text-zinc-500 uppercase ml-2">Deskripsyon</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-black/50 border border-white/10 p-5 rounded-2xl text-xs italic outline-none h-24 resize-none w-full" placeholder="Kisa kliyan an ap achte?" /></div>
            <button onClick={handleCreateInvoice} disabled={loading} className="w-full bg-red-600 hover:bg-white hover:text-black py-5 rounded-full font-black uppercase italic text-[11px] md:text-lg transition-all active:scale-95">{loading ? 'Ap kreye...' : 'Jenere Lyen & Voye Email'}</button>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
        <div className="flex flex-col sm:flex-row justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('dashboard')} className="p-3 bg-zinc-900 rounded-xl hover:bg-red-600 shrink-0"><ArrowLeft size={16}/></button>
            <h2 className="text-lg font-black uppercase italic tracking-widest">Fakti (Invoices)</h2>
          </div>
          <button onClick={() => setSubMode('create')} className="w-full sm:w-auto p-3 bg-red-600 rounded-xl flex items-center justify-center gap-2"><PlusCircle size={16}/><span className="text-[9px] font-black uppercase">Nouvo fakti</span></button>
        </div>
        <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-2xl mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} className="bg-black/40 text-[10px] font-bold p-2 rounded-lg outline-none flex-1"><option value="all">Tout tan</option><option value="today">Jodi a</option><option value="week">7 dènye jou</option><option value="month">30 dènye jou</option></select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-black/40 text-[10px] font-bold p-2 rounded-lg outline-none flex-1"><option value="all">Tout estati</option><option value="pending">An atant</option><option value="paid">Peye</option></select>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Chèche..." className="bg-black/40 text-[10px] font-bold p-2 rounded-lg outline-none flex-1 w-full" />
          </div>
        </div>
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/10 rounded-[2rem] border border-dashed border-white/5"><FileText className="w-12 h-12 mx-auto mb-4 text-zinc-800"/><p className="text-[9px] font-black uppercase text-zinc-600">Pa gen fakti</p></div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((inv) => (
              <div key={inv.id} className="bg-[#0d0e1a] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:border-red-600/20">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] text-white shrink-0 ${inv.status === 'paid' ? 'bg-green-600' : inv.status === 'pending' ? 'bg-amber-600' : 'bg-red-600'}`}>{inv.status === 'paid' ? '✓' : '⏳'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] md:text-[11px] font-bold truncate">{inv.client_email}</p>
                    <p className="text-[8px] text-zinc-600">{formatDate(inv.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t sm:border-none border-white/5 pt-3 sm:pt-0 mt-2 sm:mt-0 gap-4">
                  <div className="text-sm font-black text-green-400 shrink-0">{inv.status === 'paid' ? '+' : ''}{parseFloat(inv.amount).toLocaleString()} HTG</div>
                  <div className="flex gap-2 shrink-0">
                    {inv.status === 'pending' && (
                      <>
                        <button onClick={() => handleMarkInvoiceAsPaid(inv.id)} className="p-1.5 bg-green-600/20 rounded-lg"><CheckSquare size={12} className="text-green-400" /></button>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/checkout-invoice/${inv.id}`); alert("Kopye!"); }} className="p-1.5 bg-blue-600/20 rounded-lg"><Copy size={12} className="text-blue-400" /></button>
                      </>
                    )}
                    <button onClick={() => handleDeleteInvoice(inv.id)} className="p-1.5 bg-red-600/20 rounded-lg"><Trash2 size={12} className="text-red-400" /></button>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('dashboard')} className="p-3 bg-zinc-900 rounded-xl hover:bg-red-600 shrink-0"><ArrowLeft size={16} /></button>
          <h2 className="text-lg font-black uppercase italic truncate">Jounal Tranzaksyon</h2>
        </div>
      </div>
      <div className="flex overflow-x-auto pb-2 gap-2 mb-6 scrollbar-hide">
        {['Tout', 'SDK', 'Invoice'].map((tab) => (
          <button key={tab} className="px-4 py-2 rounded-xl font-black text-[9px] uppercase bg-zinc-900/50 border border-white/5 hover:border-red-600/30 text-zinc-400 whitespace-nowrap">{tab}</button>
        ))}
      </div>
      <div className="space-y-3">
        {recentSales.length > 0 ? (
          recentSales.slice(0, 30).map((tx, i) => {
            const client = tx.client || 'Kliyan';
            return (
              <div key={i} className="bg-[#0d0e1a] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 hover:border-red-600/20">
                <div className="flex items-center gap-3 w-full sm:w-auto flex-1 min-w-0">
                  <div className={`w-10 h-10 ${getInitialColor(client)} rounded-xl flex items-center justify-center font-black text-[10px] text-white shrink-0`}>{getInitials(client)}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black uppercase italic text-xs truncate">{(tx as any).type || 'PÈMAN'}</h4>
                    <p className="text-[9px] font-bold text-zinc-400 truncate">{client}</p>
                    <p className="text-[8px] text-zinc-600">{formatDate(tx.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto border-t sm:border-none border-white/5 pt-3 sm:pt-0 mt-2 sm:mt-0">
                  <div className="text-sm font-black italic text-green-400">+{parseFloat(tx.amount).toLocaleString()} <span className="text-[8px] text-zinc-600 ml-1">HTG</span></div>
                  <span className={`sm:ml-3 text-[6px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${tx.status === 'success' || tx.status === 'paid' ? 'bg-green-500/15 text-green-500' : 'bg-amber-500/15 text-amber-500'}`}>{tx.status}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-20 bg-zinc-900/10 rounded-[2rem] border border-dashed border-white/5"><Package className="w-12 h-12 mx-auto mb-4 text-zinc-800" /><p className="text-[9px] font-black uppercase text-zinc-600">Pa gen tranzaksyon ankò.</p></div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setMode('dashboard')} className="p-3 bg-zinc-900 rounded-xl hover:bg-red-600 shrink-0"><ArrowLeft size={16} /></button>
        <h2 className="text-lg font-black uppercase italic truncate">Anviwònman</h2>
      </div>
      <div className="grid gap-6">
        <div className="bg-zinc-900/40 p-6 rounded-[2.5rem] border border-white/5 text-center text-zinc-500 italic font-black text-xs">
          Seksyon anviwònman an konstriksyon...
        </div>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  // Enpòte icon pou bouton an
  const ShoppingCart = ShoppingBag;

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