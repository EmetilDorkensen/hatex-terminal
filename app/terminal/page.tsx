"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
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
  ShoppingBag, PenTool, Chrome, Wifi
} from 'lucide-react';

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

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

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
      const weekAgo = new Date(now.setDate(now.getDate() - 7));
      filtered = filtered.filter(inv => new Date(inv.created_at) >= weekAgo);
    } else if (dateRange === 'month') {
      const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
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
        source: 'SDK', 
        client: tx.customer_name || tx.customer_email || 'Kliyan SDK' 
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
  // FONKSYON JENERASYON PLUGIN YO (VÈSYON 2.0 - FÒMILÈ ENTEGRE)
  // ============================================================

  // ---------- WOOCOMMERCE PLUGIN (VÈSYON 2.0) ----------
  const generateWooCommercePlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved') {
      alert('KYC ou poko apwouve. Tanpri tann apwobasyon an.');
      return;
    }
    if (!profile?.api_key) {
      alert('Kle API poko jenere. Tanpri reyese answit.');
      return;
    }

    setDownloadingPlugin('woocommerce');

    try {
      const zip = new JSZip();

      const mainFile = `<?php
/**
 * Plugin Name: HATEX Payments
 * Plugin URI: https://hatexcard.com
 * Description: Aksepte peman an Goud atravè HATEX. Fòmilè kat entegre dirèkteman sou paj checkout.
 * Version: 2.0.0
 * Author: HATEX
 * Author URI: https://hatexcard.com
 * License: GPL v2 or later
 * Text Domain: hatex-woocommerce
 * Domain Path: /languages
 * WC requires at least: 4.0
 * WC tested up to: 8.5
 */

if (!defined('ABSPATH')) {
    exit;
}

define('HATEX_WC_VERSION', '2.0.0');
define('HATEX_WC_PLUGIN_URL', plugin_dir_url(__FILE__));
define('HATEX_WC_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('HATEX_MERCHANT_ID', '${profile.api_key}');

function add_hatex_gateway($methods) {
    $methods[] = 'WC_Gateway_HATEX';
    return $methods;
}
add_filter('woocommerce_payment_gateways', 'add_hatex_gateway');

function init_hatex_gateway() {
    if (!class_exists('WooCommerce')) {
        return;
    }
    require_once HATEX_WC_PLUGIN_PATH . 'includes/class-wc-gateway-hatex.php';
}
add_action('plugins_loaded', 'init_hatex_gateway');

function hatex_add_settings_link($links) {
    $settings_url = admin_url('admin.php?page=wc-settings&tab=checkout&section=hatex');
    $settings_link = '<a href="' . esc_url($settings_url) . '">Konfigirasyon</a>';
    array_unshift($links, $settings_link);
    return $links;
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'hatex_add_settings_link');

add_action('before_woocommerce_init', function() {
    if (class_exists(\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::class)) {
        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

add_action('woocommerce_blocks_loaded', 'hatex_register_block_support');
function hatex_register_block_support() {
    if (class_exists('Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType')) {
        require_once HATEX_WC_PLUGIN_PATH . 'includes/class-wc-gateway-hatex-blocks-support.php';
        add_action(
            'woocommerce_blocks_payment_method_type_registration',
            function($payment_method_registry) {
                $payment_method_registry->register(new WC_Gateway_HATEX_Blocks_Support());
            }
        );
    }
}
`;

      const gatewayFile = `<?php
class WC_Gateway_HATEX extends WC_Payment_Gateway {

    public function __construct() {
        $this->id                 = 'hatex';
        $this->icon               = '';
        $this->has_fields         = true;
        $this->method_title       = __('HATEX Payments', 'hatex-woocommerce');
        $this->method_description = __('Aksepte peman an Goud atravè HATEX. Fòmilè kat entegre.', 'hatex-woocommerce');
        $this->supports           = array(
            'products',
            'refunds',
            'tokenization'
        );

        $this->init_form_fields();
        $this->init_settings();

        $this->title       = $this->get_option('title');
        $this->description = $this->get_option('description');
        $this->enabled     = $this->get_option('enabled');
        $this->merchant_id = HATEX_MERCHANT_ID;

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_api_wc_gateway_hatex', array($this, 'handle_webhook'));
        add_action('wp_enqueue_scripts', array($this, 'payment_scripts'));
    }

    public function init_form_fields() {
        $this->form_fields = array(
            'enabled' => array(
                'title'   => __('Aktive / Dezaktive', 'hatex-woocommerce'),
                'type'    => 'checkbox',
                'label'   => __('Aktive HATEX Payments', 'hatex-woocommerce'),
                'default' => 'no',
            ),
            'title' => array(
                'title'       => __('Tit', 'hatex-woocommerce'),
                'type'        => 'text',
                'description' => __('Tit metod peman an ap parèt pou kliyan yo.', 'hatex-woocommerce'),
                'default'     => __('Peye ak HATEX', 'hatex-woocommerce'),
                'desc_tip'    => true,
            ),
            'description' => array(
                'title'       => __('Deskripsyon', 'hatex-woocommerce'),
                'type'        => 'textarea',
                'description' => __('Deskripsyon metod peman an.', 'hatex-woocommerce'),
                'default'     => __('Peye byen vit ak HATEX an Goud.', 'hatex-woocommerce'),
            ),
            'merchant_id_display' => array(
                'title'       => __('ID Machann', 'hatex-woocommerce'),
                'type'        => 'text',
                'description' => __('ID machann ou nan sistèm HATEX la. Sa a konfigure otomatikman.', 'hatex-woocommerce'),
                'default'     => HATEX_MERCHANT_ID,
                'custom_attributes' => array('readonly' => 'readonly'),
            ),
        );
    }

    public function payment_scripts() {
        if (!is_checkout() || !$this->is_available()) {
            return;
        }
        
        wp_enqueue_script(
            'hatex-checkout',
            HATEX_WC_PLUGIN_URL . 'assets/js/hatex-checkout.js',
            array('jquery'),
            HATEX_WC_VERSION,
            true
        );
        
        wp_localize_script('hatex-checkout', 'hatex_params', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('hatex-payment'),
        ));
    }

    public function payment_fields() {
        if ($this->description) {
            echo wpautop(wp_kses_post($this->description));
        }
        ?>
        <div id="hatex-payment-errors" style="color: #ff0000; margin-bottom: 15px; font-size: 13px;"></div>
        
        <fieldset id="wc-<?php echo esc_attr($this->id); ?>-cc-form" class="wc-credit-card-form wc-payment-form" style="background: transparent; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
            <div class="form-row form-row-wide">
                <label for="hatex-card-holder"><?php _e('Non ak prenon sou kat la', 'hatex-woocommerce'); ?> <span class="required">*</span></label>
                <input type="text" id="hatex-card-holder" name="hatex_card_holder" placeholder="<?php _e('Jan Fi', 'hatex-woocommerce'); ?>" autocomplete="off" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div class="form-row form-row-wide">
                <label for="hatex-card-number"><?php _e('Nimewo kat', 'hatex-woocommerce'); ?> <span class="required">*</span></label>
                <input type="text" id="hatex-card-number" name="hatex_card_number" placeholder="**** **** **** ****" autocomplete="off" maxlength="19" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div class="form-row form-row-first">
                <label for="hatex-card-expiry"><?php _e('Dat ekspirasyon (MM/AA)', 'hatex-woocommerce'); ?> <span class="required">*</span></label>
                <input type="text" id="hatex-card-expiry" name="hatex_card_expiry" placeholder="MM / AA" maxlength="5" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div class="form-row form-row-last">
                <label for="hatex-card-cvv"><?php _e('Kòd CVV', 'hatex-woocommerce'); ?> <span class="required">*</span></label>
                <input type="text" id="hatex-card-cvv" name="hatex_card_cvv" placeholder="123" maxlength="4" autocomplete="off" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div class="clear"></div>
        </fieldset>
        <?php
    }

    public function validate_fields() {
        $card_holder = sanitize_text_field($_POST['hatex_card_holder'] ?? '');
        $card_number = preg_replace('/\\s+/', '', $_POST['hatex_card_number'] ?? '');
        $card_expiry = sanitize_text_field($_POST['hatex_card_expiry'] ?? '');
        $card_cvv    = sanitize_text_field($_POST['hatex_card_cvv'] ?? '');

        if (empty($card_holder)) {
            wc_add_notice(__('Non sou kat la obligatwa.', 'hatex-woocommerce'), 'error');
            return false;
        }

        if (!preg_match('/^\\d{13,19}$/', $card_number)) {
            wc_add_notice(__('Nimewo kat la pa valab (13-19 chif).', 'hatex-woocommerce'), 'error');
            return false;
        }

        if (!preg_match('/^\\d{2}\\/\\d{2}$/', $card_expiry)) {
            wc_add_notice(__('Dat ekspirasyon dwe fòma MM/AA.', 'hatex-woocommerce'), 'error');
            return false;
        }

        if (!preg_match('/^\\d{3,4}$/', $card_cvv)) {
            wc_add_notice(__('Kòd CVV dwe 3 oubyen 4 chif.', 'hatex-woocommerce'), 'error');
            return false;
        }

        return true;
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);

        $card_holder = sanitize_text_field($_POST['hatex_card_holder']);
        $card_number = preg_replace('/\\s+/', '', $_POST['hatex_card_number']);
        $card_expiry = sanitize_text_field($_POST['hatex_card_expiry']);
        $card_cvv    = sanitize_text_field($_POST['hatex_card_cvv']);

        $currency = $order->get_currency();
        $amount   = $order->get_total();

        if ($currency === 'USD') {
            $amount   = $amount * 136;
            $currency = 'HTG';
        }

        $payload = array(
            'merchant_id'   => $this->merchant_id,
            'amount'        => $amount,
            'currency'      => $currency,
            'description'   => sprintf(__('Kòmand #%s', 'hatex-woocommerce'), $order->get_order_number()),
            'card_holder'   => $card_holder,
            'card_number'   => $card_number,
            'card_expiry'   => $card_expiry,
            'card_cvv'      => $card_cvv,
            'metadata'      => array(
                'order_id'         => $order_id,
                'order_key'        => $order->get_order_key(),
                'customer_email'   => $order->get_billing_email(),
                'customer_name'    => $order->get_billing_first_name() . ' ' . $order->get_billing_last_name(),
                'customer_phone'   => $order->get_billing_phone(),
                'customer_address' => $order->get_billing_address_1(),
                'platform'         => 'woocommerce',
            ),
            'webhook_url'   => add_query_arg('wc-api', 'WC_Gateway_HATEX', home_url('/')),
        );

        $response = wp_remote_post('https://api.hatexcard.com/api/v1/process-payment', array(
            'headers' => array(
                'Content-Type' => 'application/json',
                'X-API-Key'    => $this->merchant_id,
            ),
            'body'    => json_encode($payload),
            'timeout' => 30,
        ));

        if (is_wp_error($response)) {
            error_log('HATEX API Error: ' . $response->get_error_message());
            wc_add_notice(__('Erè koneksyon ak HATEX. Tanpri eseye ankò.', 'hatex-woocommerce'), 'error');
            return array('result' => 'failure');
        }

        $code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        error_log("HATEX Direct Payment Response ($code): " . print_r($data, true));

        if ($code !== 200 || !isset($data['success']) || $data['success'] !== true) {
            $error_msg = __('Peman an echwe. ', 'hatex-woocommerce');
            
            if (isset($data['code'])) {
                switch ($data['code']) {
                    case 'INSUFFICIENT_BALANCE':
                        $error_msg = __('Balans ensifizan sou kat la.', 'hatex-woocommerce');
                        break;
                    case 'INVALID_CARD':
                        $error_msg = __('Enfòmasyon kat yo pa bon. Verifye epi eseye ankò.', 'hatex-woocommerce');
                        break;
                    case 'EXPIRED_CARD':
                        $error_msg = __('Dat ekspirasyon kat la fin pase.', 'hatex-woocommerce');
                        break;
                    case 'CARD_DECLINED':
                        $error_msg = __('Kat la refize. Kontakte labank ou.', 'hatex-woocommerce');
                        break;
                    default:
                        $error_msg = isset($data['message']) ? $data['message'] : __('Peman an echwe.', 'hatex-woocommerce');
                }
            } else {
                $error_msg = isset($data['message']) ? $data['message'] : __('Peman an echwe.', 'hatex-woocommerce');
            }
            
            wc_add_notice($error_msg, 'error');
            return array('result' => 'failure');
        }

        $order->payment_complete($data['transaction_id']);
        $order->add_order_note(sprintf(__('Peman HATEX konplete. ID tranzaksyon: %s', 'hatex-woocommerce'), $data['transaction_id']));
        $order->update_meta_data('_hatex_transaction_id', $data['transaction_id']);
        $order->save();

        WC()->cart->empty_cart();

        return array(
            'result'   => 'success',
            'redirect' => $this->get_return_url($order),
        );
    }

    public function handle_webhook() {
        $payload = file_get_contents('php://input');
        $data    = json_decode($payload, true);

        if (!$data || !isset($data['event'])) {
            status_header(400);
            exit;
        }

        if (!isset($data['metadata']['order_id'])) {
            status_header(400);
            exit;
        }

        $order_id = $data['metadata']['order_id'];
        $order    = wc_get_order($order_id);

        if (!$order) {
            status_header(404);
            exit;
        }

        switch ($data['event']) {
            case 'payment.succeeded':
                $order->payment_complete($data['transaction_id']);
                $order->add_order_note(sprintf(__('Peman HATEX konplete (webhook). ID tranzaksyon: %s', 'hatex-woocommerce'), $data['transaction_id']));
                $order->update_meta_data('_hatex_transaction_id', $data['transaction_id']);
                $order->save();
                break;

            case 'payment.failed':
                $order->update_status('failed', __('Peman HATEX echwe (webhook).', 'hatex-woocommerce'));
                break;

            case 'payment.pending':
                $order->update_status('on-hold', __('Peman HATEX an atant (webhook).', 'hatex-woocommerce'));
                break;
        }

        status_header(200);
        echo 'OK';
        exit;
    }

    public function process_refund($order_id, $amount = null, $reason = '') {
        $order = wc_get_order($order_id);
        $transaction_id = $order->get_meta('_hatex_transaction_id');

        if (empty($transaction_id)) {
            return false;
        }

        $response = wp_remote_post('https://api.hatexcard.com/api/v1/refunds', array(
            'headers' => array(
                'Content-Type'  => 'application/json',
                'X-API-Key' => $this->merchant_id,
            ),
            'body' => json_encode(array(
                'transaction_id' => $transaction_id,
                'amount'         => $amount,
                'reason'         => $reason,
            )),
        ));

        if (is_wp_error($response)) {
            return false;
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (isset($data['success']) && $data['success']) {
            $order->add_order_note(sprintf(__('Refon HATEX: %s HTG. Rezon: %s', 'hatex-woocommerce'), $amount, $reason));
            return true;
        }

        return false;
    }
}
`;

      const jsFile = `jQuery(function($) {
    $('form.checkout').on('checkout_place_order_hatex', function() {
        return hatexValidateForm();
    });

    $(document.body).on('updated_checkout', function() {});

    $('#hatex-card-number').on('input', function() {
        var value = $(this).val().replace(/\\D/g, '');
        var formatted = '';
        for (var i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) {
                formatted += ' ';
            }
            formatted += value[i];
        }
        $(this).val(formatted);
    });

    $('#hatex-card-expiry').on('input', function() {
        var value = $(this).val().replace(/\\D/g, '');
        if (value.length >= 2) {
            value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        $(this).val(value);
    });

    $('#hatex-card-cvv').on('input', function() {
        $(this).val($(this).val().replace(/\\D/g, ''));
    });
});

function hatexValidateForm() {
    var cardHolder = $('#hatex-card-holder').val().trim();
    var cardNumber = $('#hatex-card-number').val().replace(/\\s+/g, '');
    var cardExpiry = $('#hatex-card-expiry').val().trim();
    var cardCVV = $('#hatex-card-cvv').val().trim();
    var errors = [];

    $('#hatex-payment-errors').html('');

    if (cardHolder === '') {
        errors.push('Non sou kat la obligatwa.');
    }

    if (!/^\\d{13,19}$/.test(cardNumber)) {
        errors.push('Nimewo kat la pa valab (13-19 chif).');
    }

    if (!/^\\d{2}\\/\\d{2}$/.test(cardExpiry)) {
        errors.push('Dat ekspirasyon dwe fòma MM/AA.');
    } else {
        var parts = cardExpiry.split('/');
        var month = parseInt(parts[0], 10);
        var year = parseInt(parts[1], 10) + 2000;
        var now = new Date();
        var currentYear = now.getFullYear();
        var currentMonth = now.getMonth() + 1;
        
        if (year < currentYear || (year === currentYear && month < currentMonth)) {
            errors.push('Dat ekspirasyon kat la fin pase.');
        }
        
        if (month < 1 || month > 12) {
            errors.push('Mwa ekspirasyon an pa valab.');
        }
    }

    if (!/^\\d{3,4}$/.test(cardCVV)) {
        errors.push('Kòd CVV dwe 3 oubyen 4 chif.');
    }

    if (errors.length > 0) {
        $('#hatex-payment-errors').html('<ul style="margin:0; padding-left:20px;"><li>' + errors.join('</li><li>') + '</li></ul>');
        return false;
    }
    return true;
}
`;

      const blocksSupportFile = `<?php
use Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType;

final class WC_Gateway_HATEX_Blocks_Support extends AbstractPaymentMethodType {
    protected $name = 'hatex';
    private $gateway;

    public function initialize() {
        $this->settings = get_option("woocommerce_{$this->name}_settings", array());
        $this->gateway = new WC_Gateway_HATEX();
    }

    public function is_active() {
        return $this->gateway->is_available();
    }

    public function get_payment_method_script_handles() {
        wp_register_script(
            'wc-hatex-blocks-integration',
            plugins_url('assets/js/checkout.js', dirname(__FILE__)),
            array('wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities'),
            HATEX_WC_VERSION,
            true
        );
        return array('wc-hatex-blocks-integration');
    }

    public function get_payment_method_data() {
        return array(
            'title'       => $this->gateway->title,
            'description' => $this->gateway->description,
            'supports'    => array_filter($this->gateway->supports, array($this->gateway, 'supports')),
            'icon'        => '',
        );
    }
}
`;

      const blocksJsFile = `const settings = window.wc.wcSettings.getSetting('hatex_data', {});
const label = window.wp.htmlEntities.decodeEntities(settings.title) || window.wp.i18n.__('Peye ak HATEX', 'hatex-woocommerce');

const Content = () => {
    const [cardHolder, setCardHolder] = React.useState('');
    const [cardNumber, setCardNumber] = React.useState('');
    const [cardExpiry, setCardExpiry] = React.useState('');
    const [cardCvv, setCardCvv] = React.useState('');
    const [errors, setErrors] = React.useState([]);

    const formatCardNumber = (value) => {
        const v = value.replace(/\\s+/g, '').replace(/\\D/g, '');
        const matches = v.match(/\\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];
        for (let i = 0; i < match.length; i += 4) {
            parts.push(match.substring(i, i + 4));
        }
        return parts.length ? parts.join(' ') : value;
    };

    const formatExpiry = (value) => {
        const v = value.replace(/\\s+/g, '').replace(/\\D/g, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + (v.length > 2 ? '/' + v.substring(2, 4) : '');
        }
        return v;
    };

    return React.createElement('div', { className: 'wc-block-components-payment-method' },
        React.createElement('div', { className: 'wc-block-components-payment-method-content' },
            errors.length > 0 && React.createElement('div', { className: 'wc-block-components-notice-banner is-error', style: { marginBottom: '15px' } },
                React.createElement('ul', { style: { margin: '0', paddingLeft: '20px' } },
                    errors.map((err, i) => React.createElement('li', { key: i }, err))
                )
            ),
            React.createElement('fieldset', { className: 'wc-block-credit-card-form' },
                React.createElement('div', { className: 'wc-block-form-row' },
                    React.createElement('label', { htmlFor: 'hatex-card-holder' }, window.wp.i18n.__('Non ak prenon sou kat la', 'hatex-woocommerce')),
                    React.createElement('input', {
                        type: 'text',
                        id: 'hatex-card-holder',
                        name: 'hatex_card_holder',
                        value: cardHolder,
                        onChange: (e) => setCardHolder(e.target.value),
                        placeholder: 'Jan Fi',
                        className: 'wc-block-components-text-input',
                        required: true
                    })
                ),
                React.createElement('div', { className: 'wc-block-form-row' },
                    React.createElement('label', { htmlFor: 'hatex-card-number' }, window.wp.i18n.__('Nimewo kat', 'hatex-woocommerce')),
                    React.createElement('input', {
                        type: 'text',
                        id: 'hatex-card-number',
                        name: 'hatex_card_number',
                        value: cardNumber,
                        onChange: (e) => setCardNumber(formatCardNumber(e.target.value)),
                        placeholder: '**** **** **** ****',
                        className: 'wc-block-components-text-input',
                        maxLength: 19,
                        required: true
                    })
                ),
                React.createElement('div', { className: 'wc-block-form-row wc-block-form-row-two-thirds' },
                    React.createElement('label', { htmlFor: 'hatex-card-expiry' }, window.wp.i18n.__('Dat ekspirasyon (MM/AA)', 'hatex-woocommerce')),
                    React.createElement('input', {
                        type: 'text',
                        id: 'hatex-card-expiry',
                        name: 'hatex_card_expiry',
                        value: cardExpiry,
                        onChange: (e) => setCardExpiry(formatExpiry(e.target.value)),
                        placeholder: 'MM/AA',
                        className: 'wc-block-components-text-input',
                        maxLength: 5,
                        required: true
                    })
                ),
                React.createElement('div', { className: 'wc-block-form-row wc-block-form-row-one-third' },
                    React.createElement('label', { htmlFor: 'hatex-card-cvv' }, window.wp.i18n.__('Kòd CVV', 'hatex-woocommerce')),
                    React.createElement('input', {
                        type: 'text',
                        id: 'hatex-card-cvv',
                        name: 'hatex_card_cvv',
                        value: cardCvv,
                        onChange: (e) => setCardCvv(e.target.value.replace(/\\D/g, '').substring(0, 4)),
                        placeholder: '123',
                        className: 'wc-block-components-text-input',
                        maxLength: 4,
                        required: true
                    })
                )
            )
        )
    );
};

const Block_Gateway = {
    name: 'hatex',
    label: label,
    content: Object(window.wp.element.createElement)(Content, null),
    edit: Object(window.wp.element.createElement)(Content, null),
    canMakePayment: () => true,
    ariaLabel: label,
    supports: {
        features: settings.supports,
    },
};

window.wc.wcBlocksRegistry.registerPaymentMethod(Block_Gateway);
`;

      const readmeFile = `=== HATEX Payments ===
Contributors: hatexcard
Tags: payment, woocommerce, haitian gourde, htg, goud
Requires at least: 5.0
Tested up to: 6.8
Stable tag: 2.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Aksepte peman an Goud atravè HATEX. Senp, vit, an sekirite.

== Description ==

HATEX Payments se yon plugin ki pèmèt machann WooCommerce yo resevwa peman an Goud Ayisyen (HTG). Li konekte dirèkteman ak sistèm HATEX la pou trete peman yo an tan reyèl.

Fonksyonalite kle:
* Peman an Goud (konvèsyon USD → HTG otomatik)
* Koneksyon senp ak kont HATEX la
* Fòmilè kat entegre sou paj checkout (pa gen redireksyon)
* Validasyon an tan reyèl
* Webhooks pou met ajou estati kòmand otomatikman
* Konpatib ak checkout blocks (nouvo WooCommerce)

== Installation ==

1. Upload the plugin files to the \`/wp-content/plugins/hatex-woocommerce\` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Go to WooCommerce > Settings > Payments, then click "Configure" on HATEX Payments.
4. Klike sou "Connect with HATEX" pou konekte ak kont ou (w ap bezwen yon kont HATEX).

== Frequently Asked Questions ==

= Poukisa bouton an pa parèt sou paj checkout la? =
Verifye ke plugin an aktive, ke HATEX mete kòm disponib nan anviwònman peman yo, epi ke paj checkout la pa itilize yon fòmilè custom ki pa sipòte blocks. Si w ap itilize blocks, asire w ke plugin an sipòte yo (li sipòte).

= Ki jan konvèsyon USD → HTG fèt? =
Plugin an itilize taux 136. Si w bezwen chanje taux la, kontakte sipò HATEX.

= Kisa k ap pase si enfòmasyon kat la pa bon? =
Kliyan an ap wè yon mesaj erè klè sou paj checkout la, epi yo ka korije enfòmasyon yo.

== Changelog ==

= 2.0.0 =
* Nouvo sistèm: fòmilè kat entegre sou paj checkout
* Pa gen redireksyon ankò
* Validasyon an tan reyèl
* Mesaj erè espesifik (balans ensifizan, kat pa bon, elatriye)

= 1.0.0 =
* Premye vèsyon
`;

      zip.file('hatex-woocommerce.php', mainFile);
      zip.file('includes/class-wc-gateway-hatex.php', gatewayFile);
      zip.file('includes/class-wc-gateway-hatex-blocks-support.php', blocksSupportFile);
      zip.file('assets/js/hatex-checkout.js', jsFile);
      zip.file('assets/js/checkout.js', blocksJsFile);
      zip.file('readme.txt', readmeFile);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatex-woocommerce-${profile.id.slice(0,8)}.zip`);

    } catch (error) {
      console.error('Error generating WooCommerce plugin:', error);
      alert('Erè pandan jenere plugin an. Tanpri rekòmanse.');
    } finally {
      setDownloadingPlugin(null);
    }
  };

  // ---------- SHOPIFY PLUGIN (VÈSYON 2.0) ----------
  const generateShopifyPlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved') {
      alert('KYC ou poko apwouve. Tanpri tann apwobasyon an.');
      return;
    }
    if (!profile?.api_key) {
      alert('Kle API poko jenere. Tanpri reyese answit.');
      return;
    }

    setDownloadingPlugin('shopify');

    try {
      const zip = new JSZip();

      const shopifyConfig = `{
  "name": "HATEX Payments",
  "description": "Aksepte peman an Goud atravè HATEX - Fòmilè kat entegre",
  "version": "2.0.0",
  "merchant_id": "${profile.api_key}",
  "api_url": "https://api.hatexcard.com/v1",
  "rate": 136
}`;

      const extensionFile = `// HATEX Shopify Extension - Vèsyon 2.0 (Fòmilè entegre)
// Merchant ID: ${profile.api_key}

console.log('HATEX Payments initialized for merchant:', '${profile.api_key}');

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

function createPaymentForm(container, amount, currency, orderId) {
  const form = document.createElement('div');
  form.innerHTML = \`
    <div style="margin: 20px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h3 style="margin-top: 0;">Peye ak HATEX</h3>
      <div id="hatex-errors" style="color: #ff0000; margin-bottom: 15px; font-size: 13px;"></div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">Non sou kat la</label>
        <input type="text" id="hatex-card-holder" placeholder="Jan Fi" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;" />
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px;">Nimewo kat</label>
        <input type="text" id="hatex-card-number" placeholder="**** **** **** ****" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;" />
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <label style="display: block; margin-bottom: 5px;">Dat ekspirasyon (MM/AA)</label>
          <input type="text" id="hatex-card-expiry" placeholder="MM/AA" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;" />
        </div>
        <div>
          <label style="display: block; margin-bottom: 5px;">Kòd CVV</label>
          <input type="text" id="hatex-card-cvv" placeholder="123" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;" />
        </div>
      </div>
      
      <button id="hatex-pay-button" style="width: 100%; padding: 15px; background: #e62e04; color: white; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;">
        Peye \${amount} \${currency}
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
      const response = await fetch('https://api.hatexcard.com/api/v1/process-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': '${profile.api_key}'
        },
        body: JSON.stringify({
          merchant_id: '${profile.api_key}',
          amount: amount,
          currency: currency === 'HTG' ? 'HTG' : 'HTG',
          description: 'Shopify order #' + orderId,
          card_holder: cardHolder,
          card_number: cardNumber,
          card_expiry: cardExpiry,
          card_cvv: cardCvv,
          metadata: {
            platform: 'shopify',
            order_id: orderId
          }
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.transaction_id) {
        window.location.href = '/checkout/' + orderId + '/thank_you';
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

window.HatexShopify = {
  init: function() {
    console.log('HATEX Shopify ready');
    const checkoutInterval = setInterval(() => {
      const paymentContainer = document.querySelector('[data-payment-form]') || 
                              document.querySelector('.payment-method-list') ||
                              document.querySelector('#checkout-payment');
      if (paymentContainer) {
        clearInterval(checkoutInterval);
        const amount = parseFloat(document.querySelector('[data-checkout-total]')?.innerText || '0');
        const currency = 'HTG';
        const orderId = new URLSearchParams(window.location.search).get('order_id') || 'unknown';
        createPaymentForm(paymentContainer, amount, currency, orderId);
      }
    }, 500);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.HatexShopify.init());
} else {
  window.HatexShopify.init();
}
`;

      zip.file('hatex-shopify.json', shopifyConfig);
      zip.file('extension/index.js', extensionFile);
      zip.file('README.md', `# HATEX Payments for Shopify

Vèsyon 2.0 - Fòmilè kat entegre

## Enstriksyon

1. Ale nan **Online Store** > **Themes**
2. Klike sou **Actions** > **Edit code**
3. Nan **Layout**, louvri **theme.liquid**
4. Anvan \`</body>\`, ajoute:
   \`\`\`html
   <script src="{{ 'hatex-shopify.js' | asset_url }}"></script>
   \`\`\`
5. Telechaje fichye a nan dosye \`assets/\` epi renome l **hatex-shopify.js**
6. Sove chanjman yo

## Fonksyonalite

- Fòmilè kat dirèkteman sou paj checkout
- Validasyon an tan reyèl
- Mesaj erè espesifik
- Pa gen redireksyon
`);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatex-shopify-${profile.id.slice(0,8)}.zip`);

    } catch (error) {
      console.error('Error generating Shopify plugin:', error);
      alert('Erè pandan jenere Shopify plugin an. Tanpri rekòmanse.');
    } finally {
      setDownloadingPlugin(null);
    }
  };

  // ---------- WIX PLUGIN (VÈSYON 2.0) ----------
  const generateWixPlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved') {
      alert('KYC ou poko apwouve. Tanpri tann apwobasyon an.');
      return;
    }
    if (!profile?.api_key) {
      alert('Kle API poko jenere. Tanpri reyese answit.');
      return;
    }

    setDownloadingPlugin('wix');

    try {
      const zip = new JSZip();

      const wixConfig = `{
  "merchantId": "${profile.api_key}",
  "businessName": "${profile.business_name || 'HATEX Merchant'}",
  "rate": 136,
  "apiUrl": "https://api.hatexcard.com/v1",
  "version": "2.0.0"
}`;

      const wixCode = `// HATEX Wix App - Vèsyon 2.0 (Fòmilè entegre)
// Merchant ID: ${profile.api_key}

import { payment } from 'wix-payment';
import { local } from 'wix-storage';

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

export function initHatexPayments() {
  const config = {
    merchantId: '${profile.api_key}',
    apiUrl: 'https://api.hatexcard.com/v1',
    rate: 136
  };

  payment.registerPaymentMethod({
    name: 'HATEX Payments',
    label: 'Peye an Goud ak HATEX',
    
    renderPaymentMethod(container, order) {
      const form = document.createElement('div');
      form.innerHTML = \`
        <div style="margin: 20px 0;">
          <div id="hatex-errors" style="color: #ff0000; margin-bottom: 15px;"></div>
          
          <div style="margin-bottom: 15px;">
            <label>Non sou kat la</label>
            <input type="text" id="hatex-card-holder" class="wix-input" style="width: 100%; padding: 10px;" />
          </div>
          
          <div style="margin-bottom: 15px;">
            <label>Nimewo kat</label>
            <input type="text" id="hatex-card-number" class="wix-input" style="width: 100%; padding: 10px;" />
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div>
              <label>Dat ekspirasyon</label>
              <input type="text" id="hatex-card-expiry" placeholder="MM/AA" class="wix-input" style="width: 100%; padding: 10px;" />
            </div>
            <div>
              <label>CVV</label>
              <input type="text" id="hatex-card-cvv" placeholder="123" class="wix-input" style="width: 100%; padding: 10px;" />
            </div>
          </div>
        </div>
      \`;
      
      container.appendChild(form);
      
      document.getElementById('hatex-card-number').addEventListener('input', (e) => {
        let value = e.target.value.replace(/\\D/g, '');
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
          if (i > 0 && i % 4 === 0) formatted += ' ';
          formatted += value[i];
        }
        e.target.value = formatted;
      });
      
      document.getElementById('hatex-card-expiry').addEventListener('input', (e) => {
        let value = e.target.value.replace(/\\D/g, '');
        if (value.length >= 2) {
          value = value.substring(0, 2) + '/' + value.substring(2, 4);
        }
        e.target.value = value;
      });
      
      document.getElementById('hatex-card-cvv').addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\\D/g, '').substring(0, 4);
      });
    },
    
    async processPayment(order) {
      const cardHolder = document.getElementById('hatex-card-holder')?.value.trim();
      const cardNumber = document.getElementById('hatex-card-number')?.value.replace(/\\s/g, '');
      const cardExpiry = document.getElementById('hatex-card-expiry')?.value.trim();
      const cardCvv = document.getElementById('hatex-card-cvv')?.value.trim();
      const errorDiv = document.getElementById('hatex-errors');
      
      const errors = validateCard(cardNumber, cardExpiry, cardCvv);
      if (!cardHolder) errors.push('Non sou kat la obligatwa');
      
      if (errors.length > 0) {
        errorDiv.innerHTML = '<ul><li>' + errors.join('</li><li>') + '</li></ul>';
        return { success: false };
      }
      
      try {
        const response = await fetch(config.apiUrl + '/process-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.merchantId
          },
          body: JSON.stringify({
            merchant_id: config.merchantId,
            amount: order.total,
            currency: order.currency === 'USD' ? 'HTG' : order.currency,
            description: 'Wix order #' + order.number,
            card_holder: cardHolder,
            card_number: cardNumber,
            card_expiry: cardExpiry,
            card_cvv: cardCvv,
            metadata: {
              platform: 'wix',
              order_id: order.id
            }
          })
        });
        
        const data = await response.json();
        
        if (data.success && data.transaction_id) {
          return {
            success: true,
            transactionId: data.transaction_id
          };
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
          return { success: false };
        }
      } catch (err) {
        errorDiv.innerHTML = 'Erè koneksyon';
        return { success: false };
      }
    }
  });
}
`;

      zip.file('hatex-wix.json', wixConfig);
      zip.file('src/hatex-payments.js', wixCode);
      zip.file('README.md', `# HATEX Payments for Wix

Vèsyon 2.0 - Fòmilè kat entegre

## Enstriksyon

1. Ale nan **Wix App Market**
2. Kreye yon nouvo app
3. Telechaje kòd sa yo nan dosye \`src/hatex-payments.js\`
4. Konfigure app la ak kle API ou

## Fonksyonalite

- Fòmilè kat dirèkteman sou paj checkout
- Validasyon an tan reyèl
- Mesaj erè espesifik
- Pa gen redireksyon
`);

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `hatex-wix-${profile.id.slice(0,8)}.zip`);

    } catch (error) {
      console.error('Error generating Wix plugin:', error);
      alert('Erè pandan jenere Wix plugin an. Tanpri rekòmanse.');
    } finally {
      setDownloadingPlugin(null);
    }
  };

  // ---------- HOSTINGER PLUGIN (VÈSYON 2.0) ----------
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

      const hostingerCode = `<!-- HATEX Payments for Hostinger/Horizon - Vèsyon 2.0 (Fòmilè entegre) -->
<!-- Merchant ID: ${profile.api_key} -->
<script>
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
  // API FUNCTIONS
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
      
      const { data: newInv } = await supabase
        .from('invoices')
        .select('*')
        .eq('owner_id', profile?.id)
        .order('created_at', { ascending: false });
      setInvoices(newInv || []);
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
      
      setInvoices(invoices.filter(inv => inv.id !== invoiceId));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // ============================================================
  // RENDER FUNCTIONS (yo rete menm jan an)
  // ============================================================
  const renderHeader = () => (
    <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
      <div className="flex flex-col">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter">
          {profile?.business_name || 'Hatex Terminal'}<span className="text-red-600">.</span>
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
            {profile?.kyc_status === 'approved' ? 'KYC Verified' : 'KYC Pending'}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setMode('dashboard')}
          className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${
            mode === 'dashboard' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <LayoutGrid size={15} /> Dashboard
        </button>
        <button
          onClick={() => setMode('plugins')}
          className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${
            mode === 'plugins' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <DownloadCloud size={15} /> Plugins
        </button>
        <button
          onClick={() => { setMode('invoices'); setSubMode('list'); }}
          className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${
            mode === 'invoices' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <FileText size={15} /> Invoices
        </button>
        <button
          onClick={() => setMode('transactions')}
          className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${
            mode === 'transactions' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <History size={15} /> Transactions
        </button>
        <button
          onClick={() => setMode('settings')}
          className={`px-5 py-3 rounded-2xl flex items-center gap-2 border border-white/5 transition-all font-black text-[10px] uppercase ${
            mode === 'settings' ? 'bg-red-600 shadow-xl scale-105' : 'bg-zinc-900/50 hover:bg-zinc-900'
          }`}
        >
          <Settings size={15} /> Settings
        </button>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="grid lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="lg:col-span-8 space-y-8">
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-10 rounded-[3.5rem] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-20 transition-opacity">
            <ShieldCheck size={110} className="text-red-600" />
          </div>
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-red-600/10 p-4 rounded-3xl">
              <Lock className="text-red-600 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Merchant Identity</h3>
              <p className="text-[10px] text-zinc-500 font-bold">
                Konfigire pwofil biznis piblik ou
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <User className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={17} />
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                readOnly={!!profile?.business_name}
                placeholder="Non Legal Biznis Ou"
                className="w-full bg-black/40 border border-white/10 py-6 pl-16 pr-6 rounded-3xl text-[14px] outline-none text-white italic focus:border-red-600/50 transition-all"
              />
            </div>
          </div>
          
          <div className="mt-10 pt-10 border-t border-white/5 grid grid-cols-2 gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-zinc-900 p-4 rounded-2xl">
                <FileText className="text-zinc-500 w-5 h-5" />
              </div>
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
              <div className="bg-zinc-900 p-4 rounded-2xl">
                <Globe className="text-zinc-500 w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[11px] font-black text-white uppercase tracking-wider">Gateway Status</h4>
                <span className="text-[9px] text-green-500 font-black uppercase">Aktif & Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[3.5rem] overflow-hidden">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-red-600/10 p-4 rounded-3xl">
                <BarChart3 className="text-red-600 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest">Tablo Revni</h3>
                <p className="text-[9px] text-zinc-500 font-bold mt-0.5">SDK + Invoice konbine</p>
              </div>
            </div>
            <button
              onClick={handleSyncBalance}
              disabled={syncing}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase transition-all active:scale-95"
            >
              {syncing ? <RefreshCw className="animate-spin" size={13} /> : <Wallet size={13} />}
              Vire nan Wallet
            </button>
          </div>

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
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                            sale.source === 'SDK' ? 'bg-blue-600/20 text-blue-400' : 'bg-emerald-600/20 text-emerald-400'
                          }`}>
                            {sale.source}
                          </span>
                          <span className="text-[9px] text-zinc-600">{formatDate(sale.created_at)}</span>
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

        {profile?.business_name ? (
          <div className="grid grid-cols-2 gap-6">
            {[
              { icon: <Code className="text-red-600 w-7 h-7" />, label: 'SDK Deployment', sub: 'Konekte boutik ou', action: () => setMode('plugins') },
              { icon: <FileText className="text-red-600 w-7 h-7" />, label: 'Smart Invoice', sub: 'Voye fakti bay kliyan', action: () => { setMode('invoices'); setSubMode('create'); } },
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
            <p className="text-[11px] text-red-500/60 max-w-sm mx-auto leading-relaxed">
              Ou dwe lye biznis ou an anvan ou ka jwenn aksè nan Plugins ak Invoices.
            </p>
          </div>
        )}
      </div>

      <div className="lg:col-span-4 space-y-6">
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

        <div className="bg-zinc-900/30 border border-white/5 p-7 rounded-[3rem]">
          <h3 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-zinc-500">Konfigirasyon</h3>
          <div className="space-y-3">
            {[
              { 
                label: 'Merchant ID', 
                val: (profile?.id?.slice(0, 8) || '—') + '...', 
                color: 'text-red-500' 
              },
              { 
                label: 'KYC Status', 
                val: profile?.kyc_status || 'pending', 
                color: profile?.kyc_status === 'approved' ? 'text-green-500' : 'text-orange-500' 
              },
              { 
                label: 'API Key', 
                val: profile?.api_key ? profile.api_key.slice(0, 8) + '...' : 'Pa genyen',
                color: profile?.api_key ? 'text-blue-400' : 'text-zinc-500'
              },
              { 
                label: 'Revni Mwa a', 
                val: formatCurrency(earnings.thisMonth), 
                color: 'text-emerald-400' 
              },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                <span className="text-[9px] font-bold text-zinc-400">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black uppercase ${item.color}`}>{item.val}</span>
                  {item.label === 'API Key' && profile?.api_key && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(profile.api_key);
                        setCopiedApiKey(true);
                        setTimeout(() => setCopiedApiKey(false), 2000);
                      }}
                      className="p-1 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                      title="Kopye kle API"
                    >
                      {copiedApiKey ? <CheckCircle2 size={12} className="text-green-400" /> : <Copy size={12} className="text-zinc-400" />}
                    </button>
                  )}
                  {item.label === 'Merchant ID' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(profile?.id || '');
                        alert('ID kopye! Pa pataje li ak pèsòn.');
                      }}
                      className="p-1 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                      title="Kopye ID"
                    >
                      <Copy size={12} className="text-zinc-400" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="mt-2 p-3 bg-red-600/10 border border-red-600/20 rounded-2xl">
              <p className="text-[8px] text-red-400 font-bold uppercase tracking-wider text-center">
                ⚠️ Pa janm pataje ID ou oswa kle API ak pèsonn
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/30 border border-white/5 p-7 rounded-[3rem]">
          <h3 className="text-[9px] font-black uppercase tracking-[0.3em] mb-4 text-zinc-500">Estatistik rapid</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black/40 p-4 rounded-2xl text-center">
              <p className="text-[9px] text-zinc-500 font-bold">Total tranzaksyon</p>
              <p className="text-lg font-black text-white">{transactions.length}</p>
            </div>
            <div className="bg-black/40 p-4 rounded-2xl text-center">
              <p className="text-[9px] text-zinc-500 font-bold">Fakti yo</p>
              <p className="text-lg font-black text-white">{invoices.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlugins = () => (
    <div className="max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => setMode('dashboard')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-black uppercase italic tracking-widest">Plugins & Entegrasyon</h2>
        <div className="w-12" />
      </div>

      <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 rounded-[3rem] overflow-hidden mb-8">
        <div className="p-7 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600/10 p-3 rounded-2xl">
              <Youtube className="text-red-600 w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[13px] font-black uppercase tracking-widest">Videyo Tutoryèl</h3>
              <p className="text-[9px] text-zinc-500 font-bold mt-0.5">Aprann kijan pou enstale plugins yo</p>
            </div>
          </div>
          <button
            onClick={() => setShowVideo(!showVideo)}
            className="px-4 py-2 bg-zinc-900 rounded-xl font-black text-[10px] uppercase hover:bg-zinc-800 transition-all flex items-center gap-2"
          >
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
          <button
            onClick={saveYoutubeUrl}
            className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-black text-[11px] uppercase rounded-2xl transition-all"
          >
            Sove
          </button>
        </div>
      </div>

      {profile?.kyc_status !== 'approved' && (
        <div className="bg-amber-600/20 border border-amber-600/30 p-8 rounded-[3rem] mb-8 text-center">
          <AlertTriangle className="text-amber-500 w-12 h-12 mx-auto mb-4" />
          <h3 className="text-lg font-black text-amber-500 mb-2">KYC poko apwouve</h3>
          <p className="text-amber-400/80 max-w-lg mx-auto">
            Ou dwe tann apwobasyon KYC ou anvan ou ka telechaje plugins yo.
            Tanpri verifye imèl ou regilyèman pou konfimasyon.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WooCommerce */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-8 rounded-[3rem] hover:border-red-600/30 transition-all">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-purple-600/20 p-4 rounded-2xl">
              <ShoppingBag className="text-purple-400 w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black">WooCommerce</h3>
              <p className="text-zinc-500 text-sm">WordPress</p>
            </div>
          </div>
          
          <p className="text-zinc-400 text-sm mb-6">
            Plugin pou WooCommerce. Vèsyon 2.0 ak fòmilè kat entegre sou paj checkout.
          </p>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-600">
              <span className="block">Vèsyon: 2.0.0</span>
              <span className="block">Fòmilè entegre</span>
            </div>
            <button
              onClick={generateWooCommercePlugin}
              disabled={downloadingPlugin === 'woocommerce' || profile?.kyc_status !== 'approved' || !profile?.api_key}
              className="px-6 py-3 bg-red-600 rounded-xl font-black text-sm uppercase hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {downloadingPlugin === 'woocommerce' ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <DownloadIcon size={16} />
              )}
              {downloadingPlugin === 'woocommerce' ? 'Ap jenere...' : 'Telechaje ZIP'}
            </button>
          </div>
        </div>

        {/* Shopify */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-8 rounded-[3rem] hover:border-red-600/30 transition-all">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-green-600/20 p-4 rounded-2xl">
              <Chrome className="text-green-400 w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black">Shopify</h3>
              <p className="text-zinc-500 text-sm">Aplikasyon</p>
            </div>
          </div>
          
          <p className="text-zinc-400 text-sm mb-6">
            Aplikasyon pou Shopify. Vèsyon 2.0 ak fòmilè kat entegre.
          </p>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-600">
              <span className="block">Vèsyon: 2.0.0</span>
              <span className="block">Fòmilè entegre</span>
            </div>
            <button
              onClick={generateShopifyPlugin}
              disabled={downloadingPlugin === 'shopify' || profile?.kyc_status !== 'approved' || !profile?.api_key}
              className="px-6 py-3 bg-red-600 rounded-xl font-black text-sm uppercase hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {downloadingPlugin === 'shopify' ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <DownloadIcon size={16} />
              )}
              {downloadingPlugin === 'shopify' ? 'Ap jenere...' : 'Telechaje ZIP'}
            </button>
          </div>
        </div>

        {/* Wix */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-8 rounded-[3rem] hover:border-red-600/30 transition-all">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-blue-600/20 p-4 rounded-2xl">
              <Globe className="text-blue-400 w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black">Wix</h3>
              <p className="text-zinc-500 text-sm">Aplikasyon</p>
            </div>
          </div>
          
          <p className="text-zinc-400 text-sm mb-6">
            Aplikasyon pou Wix. Vèsyon 2.0 ak fòmilè kat entegre.
          </p>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-600">
              <span className="block">Vèsyon: 2.0.0</span>
              <span className="block">Fòmilè entegre</span>
            </div>
            <button
              onClick={generateWixPlugin}
              disabled={downloadingPlugin === 'wix' || profile?.kyc_status !== 'approved' || !profile?.api_key}
              className="px-6 py-3 bg-red-600 rounded-xl font-black text-sm uppercase hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {downloadingPlugin === 'wix' ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <DownloadIcon size={16} />
              )}
              {downloadingPlugin === 'wix' ? 'Ap jenere...' : 'Telechaje ZIP'}
            </button>
          </div>
        </div>

        {/* Hostinger / Horizon */}
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-8 rounded-[3rem] hover:border-red-600/30 transition-all">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-orange-600/20 p-4 rounded-2xl">
              <Wifi className="text-orange-400 w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black">Hostinger / Horizon</h3>
              <p className="text-zinc-500 text-sm">Embed Code</p>
            </div>
          </div>
          
          <p className="text-zinc-400 text-sm mb-6">
            Kòd pou kole nan sit ou. Vèsyon 2.0 ak fòmilè kat entegre.
          </p>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-600">
              <span className="block">Vèsyon: 2.0.0</span>
              <span className="block">Fòmilè entegre</span>
            </div>
            <button
              onClick={generateHostingerPlugin}
              disabled={downloadingPlugin === 'hostinger' || profile?.kyc_status !== 'approved' || !profile?.api_key}
              className="px-6 py-3 bg-red-600 rounded-xl font-black text-sm uppercase hover:bg-red-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {downloadingPlugin === 'hostinger' ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <DownloadIcon size={16} />
              )}
              {downloadingPlugin === 'hostinger' ? 'Ap jenere...' : 'Telechaje ZIP'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900/30 border border-white/5 p-8 rounded-[3rem] mt-8">
        <h3 className="text-lg font-black mb-4">📋 Enstriksyon enstalasyon (Vèsyon 2.0)</h3>
        <div className="space-y-4 text-zinc-300 text-sm">
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">1</div>
            <p><span className="text-white font-bold">Telechaje</span> fichye ZIP ki koresponn ak platform ou a.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">2</div>
            <p><span className="text-white font-bold">Enstale</span> plugin an selon enstriksyon yo.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">3</div>
            <p><span className="text-white font-bold">Fòmilè kat la</span> ap parèt dirèkteman sou paj checkout la.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">4</div>
            <p><span className="text-white font-bold">Pa gen redireksyon</span> – tout bagay fèt sou menm paj la.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInvoices = () => {
    if (subMode === 'create') {
      return (
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-right-8 duration-500">
          <div className="flex items-center justify-between mb-10">
            <button onClick={() => setSubMode('list')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-black uppercase italic tracking-widest">Nouvo Smart Invoice</h2>
            <div className="w-12" />
          </div>
          
          <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/10 p-12 rounded-[4rem] space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Montan an (HTG)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-black/50 border border-white/10 p-8 rounded-3xl text-3xl font-black italic outline-none focus:border-red-600/50 transition-all"
                placeholder="0.00"
              />
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Email Kliyan
              </label>
              <div className="relative">
                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 py-6 pl-16 pr-6 rounded-3xl text-sm italic outline-none focus:border-red-600/50"
                  placeholder="kliyan@gmail.com"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Deskripsyon (Opsyonèl)
              </label>
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
              {loading ? 'Ap kreye...' : 'Jenere Lyen & Voye Email'}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
        <div className="flex items-center justify-between mb-10">
          <button onClick={() => setMode('dashboard')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-black uppercase italic tracking-widest">Jesyon Fakti (Invoices)</h2>
          <button
            onClick={() => setSubMode('create')}
            className="p-4 bg-red-600 rounded-2xl hover:bg-red-700 transition-all flex items-center gap-2"
          >
            <PlusCircle size={20} />
            <span className="text-[10px] font-black uppercase">Nouvo fakti</span>
          </button>
        </div>

        <div className="bg-zinc-900/30 border border-white/5 p-6 rounded-[2rem] mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl">
              <Calendar size={16} className="text-zinc-500" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="bg-transparent text-[11px] font-bold text-white outline-none"
              >
                <option value="all">Tout tan</option>
                <option value="today">Jodi a</option>
                <option value="week">7 dènye jou</option>
                <option value="month">30 dènye jou</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl">
              <Filter size={16} className="text-zinc-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-white outline-none"
              >
                <option value="all">Tout estati</option>
                <option value="pending">An atant</option>
                <option value="paid">Peye</option>
                <option value="cancelled">Anile</option>
              </select>
            </div>

            <div className="flex-1 flex items-center gap-2 bg-black/40 p-2 rounded-xl">
              <Search size={16} className="text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Chèche pa email oswa deskripsyon..."
                className="bg-transparent text-[11px] font-bold text-white outline-none w-full"
              />
            </div>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-40 bg-zinc-900/10 rounded-[4rem] border border-dashed border-white/5">
            <FileText className="w-16 h-16 text-zinc-800 mx-auto mb-6" />
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pa gen fakti pou kounye a</p>
            <button
              onClick={() => setSubMode('create')}
              className="mt-6 px-8 py-4 bg-red-600 rounded-2xl text-white font-black text-[10px] uppercase hover:bg-red-700 transition-all"
            >
              Kreye premye fakti
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2.5rem] hover:border-red-600/20 transition-all"
              >
                <div className="flex flex-wrap items-center gap-5">
                  <div className={`w-12 h-12 ${
                    inv.status === 'paid' ? 'bg-green-600' : 
                    inv.status === 'pending' ? 'bg-amber-600' : 'bg-red-600'
                  } rounded-2xl flex items-center justify-center font-black text-[11px] text-white flex-shrink-0`}>
                    {inv.status === 'paid' ? '✓' : inv.status === 'pending' ? '⏳' : '✗'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h4 className="font-black uppercase italic text-sm text-white truncate">
                        Fakti #{inv.id.slice(0, 8)}
                      </h4>
                      <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-full ${
                        inv.status === 'paid' ? 'bg-green-500/15 text-green-400' :
                        inv.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {inv.status === 'paid' ? 'Peye' : inv.status === 'pending' ? 'An atant' : 'Anile'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-bold text-zinc-600 truncate max-w-[200px]">
                        {inv.client_email}
                      </span>
                      <span className="text-[9px] text-zinc-700">·</span>
                      <span className="text-[9px] text-zinc-600">{formatDate(inv.created_at)}</span>
                      {inv.description && (
                        <>
                          <span className="text-[9px] text-zinc-700">·</span>
                          <span className="text-[9px] text-zinc-400 truncate max-w-[200px]">
                            {inv.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-lg font-black italic text-green-400">
                      {parseFloat(inv.amount).toLocaleString()} HTG
                    </div>
                    <div className="flex items-center gap-2 justify-end mt-2">
                      {inv.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleMarkInvoiceAsPaid(inv.id)}
                            className="p-2 bg-green-600/20 rounded-xl hover:bg-green-600/40 transition-all"
                            title="Make as paid"
                          >
                            <CheckSquare size={14} className="text-green-400" />
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/pay/${inv.id}`)}
                            className="p-2 bg-blue-600/20 rounded-xl hover:bg-blue-600/40 transition-all"
                            title="Copy payment link"
                          >
                            <Copy size={14} className="text-blue-400" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        className="p-2 bg-red-600/20 rounded-xl hover:bg-red-600/40 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} className="text-red-400" />
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
      <div className="flex items-center justify-between mb-10">
        <button onClick={() => setMode('dashboard')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-black uppercase italic tracking-widest">Jounal Tranzaksyon</h2>
        <div className="flex gap-2">
          <button className="p-4 bg-zinc-900 rounded-2xl hover:bg-white hover:text-black transition-all">
            <Filter size={17} />
          </button>
          <button className="p-4 bg-zinc-900 rounded-2xl hover:bg-white hover:text-black transition-all">
            <Download size={17} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        {['Tout', 'SDK', 'Invoice'].map((tab) => (
          <button
            key={tab}
            className="px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase bg-zinc-900/50 border border-white/5 hover:border-red-600/30 transition-all text-zinc-400 hover:text-white"
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
              <div key={i} className="bg-[#0d0e1a] border border-white/5 p-6 rounded-[2.5rem] flex items-center gap-5 hover:border-red-600/20 transition-all">
                <div className={`w-12 h-12 ${colorCls} rounded-2xl flex items-center justify-center font-black text-[11px] text-white flex-shrink-0`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-black uppercase italic text-sm text-white truncate">
                      {(tx as any).type || 'PÈMAN'}
                    </h4>
                    <span className={`text-[7px] font-black uppercase px-2 py-1 rounded-full ${
                      tx.source === 'Invoice' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {tx.source}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[9px] font-bold text-zinc-600 truncate max-w-[180px]">{client}</span>
                    <span className="text-[9px] text-zinc-700">·</span>
                    <span className="text-[9px] text-zinc-600">{formatDate(tx.created_at)}</span>
                    <span className="text-[9px] text-zinc-700">·</span>
                    <span className="text-[8px] font-bold text-zinc-700">#{tx.id?.slice(0, 6)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-black italic text-green-400">
                    +{parseFloat(tx.amount).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2 justify-end mt-1">
                    <span className="text-[8px] text-zinc-600">HTG</span>
                    <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${
                      tx.status === 'success' || tx.status === 'paid' ? 'bg-green-500/15 text-green-500' : 'bg-amber-500/15 text-amber-500'
                    }`}>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pa gen tranzaksyon ankò.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-top-8 duration-500">
      <div className="flex items-center justify-between mb-10">
        <button onClick={() => setMode('dashboard')} className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-black uppercase italic tracking-widest">Anviwònman Terminal</h2>
        <div className="w-12" />
      </div>

      <div className="grid gap-8">
        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-10 rounded-[3.5rem]">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-red-600/10 p-4 rounded-3xl">
              <User className="text-red-600 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Pwofil pèsonèl</h3>
              <p className="text-[10px] text-zinc-500 font-bold">Modifye enfòmasyon pèsonèl ou</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Non biznis
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                readOnly={!!profile?.business_name}
                className="w-full bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm outline-none focus:border-red-600/50 transition-all mt-2"
              />
              {profile?.business_name && (
                <p className="text-[8px] text-red-400 mt-1">Non biznis pa ka modifye apre anrejistreman.</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                readOnly
                className="w-full bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm outline-none mt-2 opacity-50"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                ID machann
              </label>
              <div className="flex items-center gap-3 mt-2">
                <code className="flex-1 bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm font-mono">
                  {profile?.id ? profile.id.slice(0, 8) + '...' : '...'}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(profile?.id || '');
                    alert('ID kopye! Pa pataje li ak pèsonn.');
                  }}
                  className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Kle API
              </label>
              <div className="flex items-center gap-3 mt-2">
                <code className="flex-1 bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm font-mono">
                  {profile?.api_key ? profile.api_key.slice(0, 8) + '...' : (generatingApiKey ? 'Ap jenere...' : 'Pa genyen')}
                </code>
                {!profile?.api_key && profile?.kyc_status === 'approved' && (
                  <button
                    onClick={generateApiKey}
                    disabled={generatingApiKey}
                    className="px-4 py-2 bg-red-600 rounded-xl text-white font-black text-[10px] uppercase hover:bg-red-700 transition-all disabled:opacity-40"
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
                    className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"
                  >
                    <Copy size={16} />
                  </button>
                )}
              </div>
              <p className="text-[8px] text-red-400 mt-1">⚠️ Pa janm pataje kle API sa a. Se tankou modpas ou.</p>
            </div>

            {!profile?.business_name && (
              <button
                onClick={updateBusinessName}
                disabled={!businessName || loading}
                className="px-8 py-4 bg-red-600 rounded-2xl text-white font-black text-[10px] uppercase hover:bg-red-700 transition-all disabled:opacity-40"
              >
                {loading ? 'Ap anrejistre...' : 'Anrejistre non biznis'}
              </button>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-10 rounded-[3.5rem]">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-red-600/10 p-4 rounded-3xl">
              <Shield className="text-red-600 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Sekirite</h3>
              <p className="text-[10px] text-zinc-500 font-bold">Jere kle API ak webhooks</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Kle API (pou entegrasyon)
              </label>
              <div className="flex items-center gap-3 mt-2">
                <code className="flex-1 bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm font-mono">
                  {profile?.api_key || (generatingApiKey ? 'Ap jenere...' : 'sk_live_...')}
                </code>
                <button
                  onClick={generateApiKey}
                  disabled={generatingApiKey || !profile?.api_key}
                  className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"
                  title="Jenere nouvo kle API"
                >
                  <RefreshCw size={16} className={generatingApiKey ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(profile?.api_key || '');
                    alert('API key copied!');
                  }}
                  disabled={!profile?.api_key}
                  className="p-4 bg-zinc-900 rounded-2xl hover:bg-red-600 transition-all"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-4">
                Webhook URL (kote pou voye notifikasyon)
              </label>
              <input
                type="url"
                value={profile?.webhook_url || ''}
                onChange={async (e) => {
                  const newUrl = e.target.value;
                  await supabase.from('profiles').update({ webhook_url: newUrl }).eq('id', profile?.id);
                  setProfile({ ...profile, webhook_url: newUrl });
                }}
                placeholder="https://monsite.com/webhook"
                className="w-full bg-black/40 border border-white/10 py-4 px-6 rounded-2xl text-sm outline-none focus:border-red-600/50 transition-all mt-2"
              />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0d0e1a] to-black border border-white/5 p-10 rounded-[3.5rem]">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-red-600/10 p-4 rounded-3xl">
              <Bell className="text-red-600 w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest">Notifikasyon</h3>
              <p className="text-[10px] text-zinc-500 font-bold">Konfigire fason ou vle resevwa alèt</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold">Resevwa imèl pou chak peman</span>
              <input type="checkbox" className="w-5 h-5 accent-red-600" defaultChecked />
            </label>
            <label className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold">Resevwa SMS pou chak peman</span>
              <input type="checkbox" className="w-5 h-5 accent-red-600" />
            </label>
            <label className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
              <span className="text-[11px] font-bold">Resevwa notifikasyon pou fakti ki peye</span>
              <input type="checkbox" className="w-5 h-5 accent-red-600" defaultChecked />
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 font-sans selection:bg-red-600/30">
      {renderHeader()}

      {loading && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <RefreshCw size={36} className="text-red-600 animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Loading Terminal...</p>
        </div>
      )}

      {mode === 'dashboard' && renderDashboard()}
      {mode === 'plugins' && renderPlugins()}
      {mode === 'invoices' && renderInvoices()}
      {mode === 'transactions' && renderTransactions()}
      {mode === 'settings' && renderSettings()}
    </div>
  );
}