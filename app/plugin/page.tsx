"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Plug,
  RotateCw,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { MerchantShell } from '@/components/app-shell/MerchantShell';
import { ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';
import { profileHasApiKey, maskApiKey } from '@/lib/security/api-key';

export default function PluginPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [user, setUser] = useState<{
    id?: string;
    full_name?: string;
    email?: string;
    avatar_url?: string;
  } | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [generatingApiKey, setGeneratingApiKey] = useState(false);
  const [rotatingApiKey, setRotatingApiKey] = useState(false);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (!authUser) {
          router.push('/login');
          return;
        }
        const { data: prof } = await supabase
          .from('profiles')
          .select(
            'id, full_name, email, avatar_url, business_name, kyc_status, plan, api_key, api_key_hash, api_key_prefix, api_key_pk, api_key_pk_hash, api_key_pk_prefix, is_merchant, webhook_secret'
          )
          .eq('id', authUser.id)
          .maybeSingle();
        if (cancelled) return;
        if (prof) {
          setProfile(prof);
          setUser({
            id: prof.id,
            full_name: prof.full_name,
            email: prof.email,
            avatar_url: prof.avatar_url,
          });
        }
      } catch {
        /* laj la ap jere aksè */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ==========================================================================
  // KLE API — menm lojik ak ansyen Terminal (depo kle hash sou sèvè)
  // ==========================================================================
  const generateApiKey = useCallback(async (): Promise<string | null> => {
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
            api_key_prefix: payload.api_key_prefix ?? null,
            api_key_pk: payload.api_key_pk ?? null,
            api_key_pk_prefix: payload.api_key_pk_prefix ?? null,
            is_merchant: payload.is_merchant,
            webhook_secret: payload.webhook_secret,
            provisioned: payload.provisioned,
            rotated: false,
            eligibility: payload.eligibility,
          };
        } else if (payload.eligibility) {
          result = {
            api_key: profile.api_key || null,
            api_key_prefix: profile.api_key_prefix || null,
            api_key_pk: profile.api_key_pk || null,
            api_key_pk_prefix: profile.api_key_pk_prefix || null,
            is_merchant: profile.is_merchant === true,
            webhook_secret: profile.webhook_secret || null,
            provisioned: false,
            rotated: false,
            eligibility: payload.eligibility,
          };
        }
      } catch {
        /* sevè indisponib — eseye lokal */
      }

      if (!result) {
        result = await ensureMerchantApiCredentials(supabase, profile);
      }

      if (!result.eligibility.eligible) {
        if (result.eligibility.missingKyc) {
          alert('KYC kont ou poko apwouve. Tanpri tann apwobasyon admin sou paj /kyc la.');
        }
        return null;
      }

      setProfile({
        ...profile,
        api_key_prefix: result.api_key_prefix || profile.api_key_prefix,
        api_key_pk_prefix: result.api_key_pk_prefix || profile.api_key_pk_prefix,
        is_merchant: true,
        webhook_secret: result.webhook_secret,
      });
      if (result.api_key) setRevealedApiKey(result.api_key);
      return result.api_key;
    } catch {
      return null;
    } finally {
      setGeneratingApiKey(false);
    }
  }, [profile, supabase]);

  const rotateApiKey = useCallback(async (): Promise<string | null> => {
    setRotatingApiKey(true);
    try {
      const res = await fetch('/api/developer/api-key/rotate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè');
      setRevealedApiKey(data.api_key);
      setProfile((prev: any) =>
        prev
          ? {
              ...prev,
              api_key: null,
              api_key_prefix: data.api_key_prefix,
              api_key_hash: 'set',
              api_key_pk_prefix: data.api_key_pk_prefix || prev.api_key_pk_prefix,
            }
          : prev
      );
      return data.api_key as string;
    } catch (err: any) {
      alert(err.message || 'Pa kapab jenere nouvo kle a.');
      return null;
    } finally {
      setRotatingApiKey(false);
    }
  }, []);

  const handleRotateApiKey = useCallback(async () => {
    if (!window.confirm('Ou pral jenere yon NOUVO kle API. Ansyen kle a pa mache ankò. Kontinye?'))
      return null;
    return rotateApiKey();
  }, [rotateApiKey]);

  /**
   * Telechajman ZIP: sèvi ak kle ki deja revele si li la.
   * Rotate SÈLMAN si pa gen kle an klè (obligatwa pou antre nan ZIP).
   * Pa rotate chak fwa — sa kraze plugin ki deja enstale.
   */
  const ensureFreshApiKeyForDownload = useCallback(async (): Promise<string | null> => {
    if (revealedApiKey && revealedApiKey.startsWith('hx_live_')) {
      return revealedApiKey;
    }
    if (!profileHasApiKey(profile)) {
      return generateApiKey();
    }
    const ok = window.confirm(
      'Pou mete yon kle valab nan plugin la, n ap jenere yon NOUVO kle API.\n\n' +
        'Enpòtan:\n' +
        '1) Telechaje ZIP la sou hatexcard.com (pa localhost)\n' +
        '2) Delete ansyen plugin WordPress la\n' +
        '3) Enstale nouvo ZIP la\n\n' +
        'Ansyen kle a pap mache ankò. Kontinye?'
    );
    if (!ok) return null;
    return rotateApiKey();
  }, [revealedApiKey, profile, generateApiKey, rotateApiKey]);

  const displayedApiKey =
    revealedApiKey || maskApiKey(profile?.api_key_prefix) || 'hx_live_' + '•'.repeat(24);

  const copyApiKey = async () => {
    if (!revealedApiKey) {
      alert('Kle konplè a pa estoke sou sèvè a. Klike "Rotate kle" pou jwenn yon nouvo kle.');
      return;
    }
    await navigator.clipboard.writeText(revealedApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // ==========================================================================
  // JENERE WOOCOMMERCE PLUGIN (v26.6 — UI Peye ak Hatexcard + USSD)
  // ==========================================================================
  const generateWooCommercePlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved')
      return alert('Ou dwe pase KYC pou w itilize Plugin sa a.');
    if (
      typeof window !== 'undefined' &&
      /localhost|127\.0\.0\.1/i.test(window.location.hostname)
    ) {
      alert(
        'Telechaje plugin la sou https://hatexcard.com (pa sou localhost).\n\n' +
          'Sou localhost, kle API a pa valide lè WordPress rele sèvè live a — se sa ki bay mesaj « Kle API sa a pa valab ».'
      );
      return;
    }
    const apiKey = await ensureFreshApiKeyForDownload();
    if (!apiKey) return;

    setDownloading(true);

    try {
      const zip = new JSZip();
      const pluginDir = zip.folder('hatexcard-woocommerce');
      // Kle a pa rete an tèks klè — base64 nan ZIP, kripsyon AES nan WP options.
      const embeddedB64 = typeof btoa === 'function'
        ? btoa(apiKey)
        : Buffer.from(apiKey, 'utf8').toString('base64');
      // Toujou vize sèvè pwodiksyon (oswa NEXT_PUBLIC_SITE_URL) — pa localhost.
      // Si ZIP la te gen localhost, WordPress ta rele yon URL kle a pa valide sou li.
      const browserOrigin =
        typeof window !== 'undefined' && window.location?.origin
          ? String(window.location.origin).replace(/\/$/, '')
          : '';
      const configuredOrigin = String(
        process.env.NEXT_PUBLIC_SITE_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          'https://hatexcard.com'
      ).replace(/\/$/, '');
      const apiOrigin =
        browserOrigin && !/localhost|127\.0\.0\.1/i.test(browserOrigin)
          ? browserOrigin
          : configuredOrigin || 'https://hatexcard.com';

      const phpCode = `<?php
/**
 * Plugin Name: HatexCard Plugin
 * Plugin URI: https://hatexcard.com
 * Description: Peman HatexCard pou WooCommerce. Kliyan peye san redireksyon; machann nan resevwa sou kont li.
 * Version: 26.6.0
 * Author: Hatex Group
 */

if (!defined('ABSPATH')) exit;

if (!defined('HATEXCARD_PLUGIN_VERSION')) define('HATEXCARD_PLUGIN_VERSION', '26.6.0');
if (!defined('HATEXCARD_EMBEDDED_B64')) define('HATEXCARD_EMBEDDED_B64', '${embeddedB64}');
if (!defined('HATEXCARD_API_ORIGIN')) define('HATEXCARD_API_ORIGIN', '${apiOrigin}');

function hatexcard_endpoint($which) {
    // URL yo rete sèlman bò PHP (sèvè) — pa janm localize nan JS / HTML kliyan.
    $base = rtrim((string) HATEXCARD_API_ORIGIN, '/');
    static $paths = array(
        'pay'    => '/api/moncash/payments',
        'rotate' => '/api/merchant/api-key/rotate',
        'status' => '/api/moncash/payments',
    );
    return isset($paths[$which]) ? $base . $paths[$which] : '';
}

function hatexcard_embedded_plaintext() {
    $raw = base64_decode((string) HATEXCARD_EMBEDDED_B64, true);
    return (is_string($raw) && $raw !== '') ? $raw : '';
}

function hatexcard_embedded_fingerprint() {
    return substr(hash('sha256', hatexcard_embedded_plaintext()), 0, 16);
}

function hatexcard_crypto_key() {
    return hash('sha256', (string) wp_salt('auth') . '|hatexcard-moncash', true);
}

function hatexcard_encrypt_secret($plain) {
    $plain = (string) $plain;
    if ($plain === '') return '';
    if (!function_exists('openssl_encrypt')) {
        return 'b64:' . base64_encode($plain);
    }
    $iv = random_bytes(16);
    $cipher = openssl_encrypt($plain, 'AES-256-CBC', hatexcard_crypto_key(), OPENSSL_RAW_DATA, $iv);
    if ($cipher === false) return '';
    return 'enc:' . base64_encode($iv . $cipher);
}

function hatexcard_decrypt_secret($stored) {
    $stored = is_string($stored) ? $stored : '';
    if ($stored === '') return '';
    if (strpos($stored, 'b64:') === 0) {
        $raw = base64_decode(substr($stored, 4), true);
        return is_string($raw) ? $raw : '';
    }
    if (strpos($stored, 'enc:') === 0) {
        if (!function_exists('openssl_decrypt')) return '';
        $bin = base64_decode(substr($stored, 4), true);
        if (!is_string($bin) || strlen($bin) < 17) return '';
        $iv = substr($bin, 0, 16);
        $cipher = substr($bin, 16);
        $plain = openssl_decrypt($cipher, 'AES-256-CBC', hatexcard_crypto_key(), OPENSSL_RAW_DATA, $iv);
        return is_string($plain) ? $plain : '';
    }
    // Ansyen fòma plaintext (migrasyon) — re-kripsyon otomatik.
    return $stored;
}

function hatexcard_store_api_key($plain) {
    $plain = trim((string) $plain);
    if ($plain === '') return;
    update_option('hatexcard_moncash_api_key_enc', hatexcard_encrypt_secret($plain), 'no');
    delete_option('hatexcard_moncash_api_key'); // retire ansyen plaintext
}

function hatexcard_ensure_key_synced() {
    $fp = get_option('hatexcard_moncash_embedded_fp', '');
    $need = !is_string($fp) || $fp !== hatexcard_embedded_fingerprint();
    $enc = get_option('hatexcard_moncash_api_key_enc', '');
    $legacy = get_option('hatexcard_moncash_api_key', '');
    if ($need || (empty($enc) && empty($legacy))) {
        $plain = hatexcard_embedded_plaintext();
        if ($plain !== '') {
            hatexcard_store_api_key($plain);
            update_option('hatexcard_moncash_embedded_fp', hatexcard_embedded_fingerprint(), 'no');
        }
    } elseif (!empty($legacy) && empty($enc)) {
        hatexcard_store_api_key((string) $legacy);
    }
}

function hatexcard_merchant_api_key() {
    hatexcard_ensure_key_synced();
    $enc = get_option('hatexcard_moncash_api_key_enc', '');
    $plain = hatexcard_decrypt_secret($enc);
    if (is_string($plain) && strpos($plain, 'hx_live_') === 0) {
        return $plain;
    }
    $legacy = get_option('hatexcard_moncash_api_key', '');
    if (is_string($legacy) && strpos($legacy, 'hx_live_') === 0) {
        hatexcard_store_api_key($legacy);
        return $legacy;
    }
    $embedded = hatexcard_embedded_plaintext();
    if (strpos($embedded, 'hx_live_') === 0) {
        hatexcard_store_api_key($embedded);
        return $embedded;
    }
    return '';
}

function hatexcard_key_masked() {
    $key = hatexcard_merchant_api_key();
    if (strlen($key) <= 8) return '••••••••';
    return substr($key, 0, 6) . str_repeat('•', 14) . substr($key, -4);
}

function hatexcard_ensure_gateway_settings() {
    $settings = get_option('woocommerce_hatexcard_moncash_settings', array());
    if (!is_array($settings)) $settings = array();
    $changed = false;
    if (empty($settings['enabled'])) { $settings['enabled'] = 'yes'; $changed = true; }
    if (empty($settings['title']) || $settings['title'] === 'Peye ak MonCash') {
        $settings['title'] = 'Peye ak Hatexcard';
        $changed = true;
    }
    if (!isset($settings['description']) || $settings['description'] === '' || strpos((string)$settings['description'], 'USSD sou telefòn li') !== false || strpos((string)$settings['description'], 'nimewo MonCash ou') !== false) {
        $settings['description'] = 'Antre nimewo telefòn ou epi konfime PIN sou telefòn ou.';
        $changed = true;
    }
    if (empty($settings['usd_rate'])) { $settings['usd_rate'] = '135'; $changed = true; }
    if ($changed) {
        update_option('woocommerce_hatexcard_moncash_settings', $settings);
    }
    return $settings;
}

register_activation_hook(__FILE__, function () {
    hatexcard_ensure_key_synced();
    hatexcard_ensure_gateway_settings();
});

// ==========================================================================
// ROTASYON KLE API depi admin WooCommerce (sèvè-a-sèvè). Bouton an nan
// WooCommerce > Retrete > Peman > HatexCard Plugin. Ansyen kle a pa valab
// ankò imedyatman apre repons HatexCard lan.
//
// NÒT: apre rotasyon, option 'hatexcard_moncash_embedded_fp' PA dwe chanje.
// Anprint sa a swiv DÈNYE zip ki te enstale a (pou detekte yon nouvo zip).
// Si nou mete l sou anprint nouvo kle a, pwochen chaj paj la ta re-adopte
// ansyen kle a ki nan konstan an epi li ta anile rotasyon an.
// ==========================================================================
function hatexcard_ajax_rotate_api_key() {
    check_ajax_referer('hatexcard_rotate_api_key', 'nonce');
    if (!current_user_can('manage_woocommerce')) {
        wp_send_json_error(array('message' => 'Ou pa gen dwa aksè pou rotate kle API a.'), 403);
    }
    $current = hatexcard_merchant_api_key();
    if ($current === '') {
        wp_send_json_error(array('message' => 'Pa gen kle API pou rotate.'), 400);
    }
    $response = wp_remote_post(hatexcard_endpoint('rotate'), array(
        'method'  => 'POST',
        'timeout' => 30,
        'headers' => array(
            'Authorization' => 'Bearer ' . $current,
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
        ),
        'body'    => '{}',
    ));
    if (is_wp_error($response)) {
        wp_send_json_error(array('message' => 'Sèvè HatexCard pa reponn. Eseye ankò.'), 502);
    }
    $code = wp_remote_retrieve_response_code($response);
    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (is_array($body) && !empty($body['ok']) && !empty($body['api_key']) && is_string($body['api_key'])) {
        hatexcard_store_api_key($body['api_key']);
        // Pa touche 'hatexcard_moncash_embedded_fp' isit — li toujou endike
        // anprint konstan an nan zip ACTUEL la.
        wp_send_json_success(array(
            'message' => 'Nouvo kle API jenere epi aktive. Ansyen kle a pa valab ankò.',
            'masked'  => hatexcard_key_masked(),
        ));
    }
    $message = (is_array($body) && !empty($body['message'])) ? wp_strip_all_tags((string) $body['message']) : 'Rotasyon kle API echwe. Eseye ankò.';
    wp_send_json_error(array('message' => 'HatexCard: ' . $message), 400);
}
add_action('wp_ajax_hatexcard_rotate_api_key', 'hatexcard_ajax_rotate_api_key');

// ==========================================================================
// WC_Payment_Gateway — klas la defini SÈLMAN lè WooCommerce aktive (ki chaje
// WC_Payment_Gateway). Plizyè pwen antre (plugins_loaded, woocommerce_loaded,
// init) pou gateway la toujou dispo pou filtre
// 'woocommerce_payment_gateways', menm si WooCommerce chaje apre plugin sa.
// ==========================================================================
function hatexcard_ensure_gateway_available() {
    if (class_exists('WC_Gateway_HatexCard_MonCash', false)) {
        return true;
    }
    if (!class_exists('WC_Payment_Gateway')) {
        return false;
    }

    class WC_Gateway_HatexCard_MonCash extends WC_Payment_Gateway {

        public function __construct() {
            $this->id = 'hatexcard_moncash';
            $this->has_fields = true;
            $this->method_title = 'HatexCard Plugin';
            $this->method_description = 'Peman HatexCard. Kliyan antre nimewo li epi konfime PIN sou telefòn — san redireksyon.';
            $this->version = HATEXCARD_PLUGIN_VERSION;

            $this->init_form_fields();
            $this->init_settings();
            hatexcard_ensure_gateway_settings();

            $this->enabled = $this->get_option('enabled', 'yes');
            $this->title = $this->get_option('title', 'Peye ak Hatexcard');
            $this->description = $this->get_option('description');
            $this->merchant_api_key = hatexcard_merchant_api_key();
            $this->api_base_url = hatexcard_endpoint('pay');
            $this->supports = array('products');

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            add_action('woocommerce_thankyou_' . $this->id, array($this, 'custom_thankyou_page'));

            if (is_admin()) {
                add_action('admin_footer', array($this, 'admin_footer_rotate_script'));
            }
        }

        public function init_form_fields() {
            $this->form_fields = array(
                'enabled' => array(
                    'title' => __('Aktive', 'hatexcard'),
                    'type' => 'checkbox',
                    'label' => __('Aktive HatexCard Plugin', 'hatexcard'),
                    'default' => 'yes',
                ),
                'title' => array(
                    'title' => __('Tit (bouton checkout)', 'hatexcard'),
                    'type' => 'text',
                    'default' => 'Peye ak Hatexcard',
                ),
                'description' => array(
                    'title' => __('Deskripsyon', 'hatexcard'),
                    'type' => 'textarea',
                    'default' => 'Antre nimewo telefòn ou epi konfime PIN sou telefòn ou.',
                ),
                'usd_rate' => array(
                    'title' => __('To konvèsyon USD → HTG', 'hatexcard'),
                    'type' => 'text',
                    'description' => __('Itilize sèlman si monnen boutik la se USD. Chak 1 USD vin N Goud (HTG). Egzanp: 135 = 1 USD → 135 HTG. Lè boutik la an HTG, yo pa sèvi ak jaden sa a.', 'hatexcard'),
                    'default' => '135',
                ),
                'hatexcard_key_row' => array(
                    'title' => __('Kle API (sekrè)', 'hatexcard'),
                    'type' => 'hatexcard_key_row',
                    'default' => '',
                ),
            );
        }

        private function get_usd_rate() {
            $raw = trim((string) $this->get_option('usd_rate', '135'));
            $raw = str_replace(',', '.', $raw); // Aksepte '137,75' (vigil) kòm '137.75'.
            return (float) $raw;
        }

        public function is_available() {
            hatexcard_ensure_gateway_settings();
            if ('yes' !== $this->get_option('enabled', 'yes')) {
                return false;
            }
            $key = trim((string) hatexcard_merchant_api_key());
            if ($key === '') {
                return false;
            }
            $currency = function_exists('get_woocommerce_currency') ? strtoupper((string) get_woocommerce_currency()) : 'HTG';
            if ($currency === 'USD') {
                return $this->get_usd_rate() > 0;
            }
            // Aksepte HTG (ak varyasyon komen)
            return in_array($currency, array('HTG', 'HT', 'GOURDE'), true);
        }

        public function admin_options() {
            $currency = function_exists('get_woocommerce_currency') ? strtoupper((string) get_woocommerce_currency()) : 'HTG';
            if ($currency !== 'HTG' && $currency !== 'USD') {
                echo '<div class="notice notice-warning inline"><p>' . esc_html__('Atansyon: monnen boutik la dwe HTG (Goud) oswa USD. Pou lòt monnen, peman MonCash pa disponib nan checkout.', 'hatexcard') . '</p></div>';
            } elseif ($currency === 'USD') {
                $rate = $this->get_usd_rate();
                if ($rate <= 0) {
                    echo '<div class="notice notice-error inline"><p>' . esc_html__('Erè: monnen boutik la se USD, kidonk ou dwe mete yon to konvèsyon USD → HTG valab nan jaden ki anwo a pou gateway la parèt nan checkout.', 'hatexcard') . '</p></div>';
                } else {
                    echo '<div class="notice notice-info inline"><p>' . sprintf(esc_html__('Remak: boutik la an USD. Montan chak kòmand ap konvèti an HTG ak to a (%s) anvan yo voye l bay MonCash. Verifye to a regilyèman.', 'hatexcard'), esc_html(number_format_i18n($rate, 2))) . '</p></div>';
                }
            }
            parent::admin_options();
        }

        public function generate_hatexcard_key_row_html($key, $data) {
            $field_key = $this->get_field_key($key);
            ob_start();
            ?>
            <tr valign="top">
                <th scope="row" class="titledesc">
                    <label for="<?php echo esc_attr($field_key); ?>"><?php echo esc_html__('Kle API (sekrè)', 'hatexcard'); ?></label>
                </th>
                <td class="forminp">
                    <fieldset>
                        <legend class="screen-reader-text"><span><?php echo esc_html__('Kle API (sekrè)', 'hatexcard'); ?></span></legend>
                        <code id="hatexcard-key-display" style="display:inline-block;padding:6px 10px;background:#f1f2f3;border:1px solid #e2e4e7;border-radius:6px;font-size:12px;margin-bottom:8px;"><?php echo esc_html(hatexcard_key_masked()); ?></code>
                        <button type="button" class="button" id="hatexcard-rotate-key" style="margin-left:8px;"><?php echo esc_html__('Rotate API Key', 'hatexcard'); ?></button>
                        <p class="description"><?php echo esc_html__('Kle a rete an sekrè sou sèvè WordPress la (option). Si w sispèk li fuit, klike Rotate: ansyen kle a sispann mache imedyatman epi yon nouvo parèt.', 'hatexcard'); ?></p>
                        <p id="hatexcard-rotate-status" style="font-weight:600;margin:4px 0 0;"></p>
                    </fieldset>
                </td>
            </tr>
            <?php
            return ob_get_clean();
        }

        public function admin_footer_rotate_script() {
            $screen = function_exists('get_current_screen') ? get_current_screen() : null;
            $isWcSettings = $screen && isset($screen->id) && strpos((string) $screen->id, 'wc-settings') !== false;
            if (!is_admin() || !$isWcSettings) {
                return;
            }
            $nonce = wp_create_nonce('hatexcard_rotate_api_key');
            ?>
            <script type="text/javascript">
            (function(){
                var btn = document.getElementById('hatexcard-rotate-key');
                if (!btn || window.__hatexcardRotateBound) return;
                window.__hatexcardRotateBound = true;
                var statusEl = document.getElementById('hatexcard-rotate-status');
                var displayEl = document.getElementById('hatexcard-key-display');
                btn.addEventListener('click', function(){
                    if (!window.confirm('Rotasyon an ap jenere yon NOUVO kle API. Ansyen kle a ap sispann mache imedyatman. Kontinye?')) return;
                    btn.disabled = true;
                    if (statusEl) { statusEl.style.color = '#50575e'; statusEl.textContent = 'Ap jenere nouvo kle...'; }
                    var data = new URLSearchParams();
                    data.append('action', 'hatexcard_rotate_api_key');
                    data.append('nonce', '<?php echo esc_js($nonce); ?>');
                    if (typeof ajaxurl === 'undefined') {
                        if (statusEl) { statusEl.style.color = '#b32d2e'; statusEl.textContent = 'Ajax URL manke.'; }
                        btn.disabled = false;
                        return;
                    }
                    fetch(ajaxurl, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: data.toString()
                    }).then(function(r){ return r.json(); }).then(function(res){
                        if (res && res.success && res.data && res.data.masked) {
                            if (displayEl) displayEl.textContent = res.data.masked;
                            if (statusEl) { statusEl.style.color = '#007a2b'; statusEl.textContent = res.data.message || 'Nouvo kle API jenere epi aktive.'; }
                        } else if (res && res.data && res.data.message) {
                            if (statusEl) { statusEl.style.color = '#b32d2e'; statusEl.textContent = res.data.message; }
                        } else {
                            if (statusEl) { statusEl.style.color = '#b32d2e'; statusEl.textContent = 'Rotasyon kle API echwe. Eseye ankò.'; }
                        }
                    }).catch(function(){
                        if (statusEl) { statusEl.style.color = '#b32d2e'; statusEl.textContent = 'Erè rezo. Eseye ankò.'; }
                    }).then(function(){ btn.disabled = false; });
                });
            })();
            </script>
            <?php
        }

        public function payment_fields() {
            $prefill = '';
            if (function_exists('WC') && WC()->customer) {
                $prefill = (string) WC()->customer->get_billing_phone();
            }
            $uid = 'hxpay_' . wp_generate_password(6, false, false);
            ?>
            <div class="hatexcard-pay-ui" style="margin:6px 0 2px;max-width:420px;">
              <button type="button" id="<?php echo esc_attr($uid); ?>_cta" class="hatexcard-pay-cta" style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:#4f46e5;color:#fff;font-weight:700;font-size:15px;border:none;border-radius:16px;padding:16px 20px;box-shadow:0 10px 24px rgba(79,70,229,0.28);cursor:pointer;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                <span>Peye ak Hatexcard</span>
              </button>
              <p id="<?php echo esc_attr($uid); ?>_hint" style="text-align:center;font-size:12px;color:#94a3b8;margin:10px 0 0;line-height:1.4;">Peman fèt ak HatexCard: nou voye yon USSD sou telefòn ou pou konfime PIN ou.</p>
              <div id="<?php echo esc_attr($uid); ?>_panel" style="display:none;margin-top:12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:16px;padding:16px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#0f172a;">Antre nimewo MonCash ou</p>
                <p style="margin:0 0 12px;font-size:12px;color:#64748b;line-height:1.5;">HatexCard ap voye yon <strong>USSD</strong> sou telefòn ou pou konfime peman an ak PIN ou — san ou pa bezwen peye sou yon lòt sit.</p>
                <input id="hatexcard_moncash_phone" name="hatexcard_moncash_phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="509 12 34 5678" value="<?php echo esc_attr($prefill); ?>" style="width:100%;box-sizing:border-box;background:#fff;border:1.5px solid #a5b4fc;border-radius:12px;padding:14px 16px;font-size:16px;font-weight:600;color:#0f172a;outline:none;" />
                <p style="margin:10px 0 0;font-size:11px;color:#64748b;">Apre sa, klike <strong>Place order</strong> — n ap voye USSD la epi ou konfime PIN sou telefòn ou.</p>
              </div>
            </div>
            <script>
            (function(){
              var cta=document.getElementById(<?php echo wp_json_encode($uid . '_cta'); ?>);
              var panel=document.getElementById(<?php echo wp_json_encode($uid . '_panel'); ?>);
              var hint=document.getElementById(<?php echo wp_json_encode($uid . '_hint'); ?>);
              if(!cta||!panel) return;
              cta.addEventListener('click', function(){
                cta.style.display='none';
                if(hint) hint.style.display='none';
                panel.style.display='block';
                var input=panel.querySelector('input');
                if(input) input.focus();
              });
            })();
            </script>
            <?php
        }

        public function validate_fields() {
            $phone = isset($_POST['hatexcard_moncash_phone'])
                ? preg_replace('/\\D+/', '', (string) wp_unslash($_POST['hatexcard_moncash_phone']))
                : '';
            if ($phone === '' && function_exists('WC') && WC()->customer) {
                $phone = preg_replace('/\\D+/', '', (string) WC()->customer->get_billing_phone());
            }
            if (strlen($phone) < 8) {
                wc_add_notice(__('Antre yon nimewo telefòn valab (oswa ranpli telefòn nan adrès faktirasyon).', 'hatexcard'), 'error');
                return false;
            }
            return true;
        }

        // Paj resi — tankou checkout pwodwi HatexCard: tann PIN, poll estati, san redireksyon MonCash.
        public function custom_thankyou_page($order_id) {
            $order = wc_get_order($order_id);
            if (!$order) return;
            $payment_id = $order->get_meta('_hatexcard_payment_id');
            if (!$payment_id) return;

            $api_key = hatexcard_merchant_api_key();
            $status_url = add_query_arg('id', rawurlencode($payment_id), hatexcard_endpoint('status'));
            $response = wp_remote_get($status_url, array(
                'headers' => array('Authorization' => 'Bearer ' . $api_key),
                'timeout' => 15
            ));
            $body = is_wp_error($response) ? null : json_decode(wp_remote_retrieve_body($response), true);
            $status = isset($body['payment']['status']) ? $body['payment']['status'] : '';
            $paid = ($status === 'paid');

            if ($paid && !$order->is_paid()) {
                $order->payment_complete($payment_id);
                $order->add_order_note('Peman HatexCard konfime. Referans: ' . $payment_id);
            }

            $amount = $order->get_meta('_hatexcard_amount_htg');
            $payer_phone = $order->get_meta('_hatexcard_payer_phone', true);
            $mode = $order->get_meta('_hatexcard_checkout_mode', true);
            $checkout_url = $order->get_meta('_hatexcard_checkout_url', true);

            if ($paid) {
                echo '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;">';
                echo '<h3 style="margin-top:0">Peman HatexCard reyisi</h3>';
                echo '<p style="margin-bottom:6px">Referans: <strong>' . esc_html($payment_id) . '</strong></p>';
                if ($amount) {
                    echo '<p style="margin-bottom:0">Montan: <strong>' . esc_html(number_format((float) $amount)) . ' HTG</strong></p>';
                }
                echo '</div>';
                return;
            }

            echo '<div id="hx-pay-wait" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:16px;margin:16px 0;">';
            echo '<h3 style="margin-top:0">Konfime PIN sou telefòn ou</h3>';
            echo '<p style="margin-bottom:6px">Referans: <strong>' . esc_html($payment_id) . '</strong></p>';
            if ($amount) {
                echo '<p style="margin-bottom:6px">Montan: <strong>' . esc_html(number_format((float) $amount)) . ' HTG</strong></p>';
            }
            echo '<p style="margin-bottom:10px">Nou voye yon demann sou <strong>' . esc_html($payer_phone ? $payer_phone : 'telefòn ou') . '</strong>. Louvri mesaj la / USSD a epi antre PIN ou. Paj sa a ap verifye otomatikman.</p>';
            if ($mode !== 'ussd' && $checkout_url) {
                echo '<p style="margin-bottom:10px"><a class="button" style="background:#1d4ed8;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-weight:bold;" href="' . esc_url($checkout_url) . '" rel="noopener noreferrer" target="_blank">Si w pa resevwa demann lan, louvri paj peman</a></p>';
            }
            echo '<p id="hx-pay-status" style="margin:0;font-size:13px;color:#1e40af;">Ap tann konfimasyon...</p>';
            echo '</div>';

            if (!$order->is_paid()) {
                $poll = esc_url(admin_url('admin-ajax.php'));
                $nonce = wp_create_nonce('hatexcard_poll_' . $order_id);
                echo '<script>(function(){var tries=0;function tick(){tries++;if(tries>80){return;}var fd=new FormData();fd.append("action","hatexcard_poll_payment");fd.append("order_id","' . esc_js((string)$order_id) . '");fd.append("nonce","' . esc_js($nonce) . '");fetch("' . $poll . '",{method:"POST",body:fd,credentials:"same-origin"}).then(function(r){return r.json();}).then(function(j){var el=document.getElementById("hx-pay-status");if(j&&j.paid){if(el)el.textContent="Peman konfime!";window.location.reload();}else if(el){el.textContent="Ap tann konfimasyon... ("+tries+")";}}).catch(function(){});}setInterval(tick,4000);tick();})();</script>';
            }
        }

        public function process_payment($order_id) {
            $order = wc_get_order($order_id);
            if (!$order) {
                wc_add_notice('Kòmand lan pa jwenn. Eseye ankò.', 'error');
                return array('result' => 'failure');
            }

            $api_key = trim((string) hatexcard_merchant_api_key());
            if ($api_key === '' || strpos($api_key, 'hx_live_') !== 0) {
                wc_add_notice('Kle API HatexCard la pa kòrèk. Re-telechaje plugin la depi HatexCard epi re-enstale l.', 'error');
                return array('result' => 'failure');
            }

            $phone = '';
            if (isset($_POST['hatexcard_moncash_phone'])) {
                $phone = preg_replace('/\\D+/', '', (string) wp_unslash($_POST['hatexcard_moncash_phone']));
            } elseif (isset($_POST['payment_data']) && is_array($_POST['payment_data']) && isset($_POST['payment_data']['hatexcard_moncash_phone'])) {
                $phone = preg_replace('/\\D+/', '', (string) wp_unslash($_POST['payment_data']['hatexcard_moncash_phone']));
            }
            if ($phone === '') {
                $phone = preg_replace('/\\D+/', '', (string) $order->get_billing_phone());
            }
            if (strlen($phone) < 8) {
                wc_add_notice('Antre yon nimewo telefòn valab pou peye.', 'error');
                return array('result' => 'failure');
            }

            $store_currency = function_exists('get_woocommerce_currency') ? strtoupper((string) get_woocommerce_currency()) : 'HTG';
            if ($store_currency === 'USD') {
                $rate = $this->get_usd_rate();
                if ($rate <= 0) {
                    wc_add_notice('To konvèsyon USD → HTG pa konfigire.', 'error');
                    return array('result' => 'failure');
                }
                $amount_htg = round((float) $order->get_total() * $rate);
            } elseif (in_array($store_currency, array('HTG', 'HT', 'GOURDE'), true)) {
                $amount_htg = round((float) $order->get_total());
            } else {
                wc_add_notice('Peman HatexCard sipòte sèlman boutik an HTG oswa USD.', 'error');
                return array('result' => 'failure');
            }
            if ($amount_htg <= 0) {
                wc_add_notice('Montan peman an pa valid.', 'error');
                return array('result' => 'failure');
            }

            $order_id_safe = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $order->get_order_number());
            $order_id_safe = $order_id_safe !== '' ? $order_id_safe : (string) $order->get_id();

            $payload = array(
                'amount' => $amount_htg,
                'order_id' => 'WC-' . $order_id_safe,
                'description' => 'Kòmand WooCommerce #' . $order_id_safe . ' — ' . get_bloginfo('name'),
                'customer_phone' => $phone,
                'flow' => 'ussd',
            );

            $response = wp_remote_post(hatexcard_endpoint('pay'), array(
                'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $api_key),
                'body'    => wp_json_encode($payload),
                'timeout' => 45,
            ));

            if (is_wp_error($response)) {
                wc_add_notice('Sèvè HatexCard pa reponn. Eseye ankò.', 'error');
                return array('result' => 'failure');
            }

            $code = (int) wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (isset($body['ok']) && $body['ok'] === true && !empty($body['payment_id'])) {
                $order->update_meta_data('_hatexcard_payment_id', $body['payment_id']);
                $order->update_meta_data('_hatexcard_amount_htg', isset($body['client_total']) ? $body['client_total'] : $amount_htg);
                $mode = isset($body['checkout_mode']) ? $body['checkout_mode'] : 'ussd';
                $order->update_meta_data('_hatexcard_checkout_mode', $mode);
                if (!empty($body['checkout_url'])) {
                    $order->update_meta_data('_hatexcard_checkout_url', $body['checkout_url']);
                }
                $order->update_meta_data('_hatexcard_payer_phone', $phone);
                $order->save();
                $order->add_order_note('Peman HatexCard kòmanse (USSD). Referans: ' . $body['payment_id']);
                if (function_exists('WC') && WC()->cart) {
                    WC()->cart->empty_cart();
                }
                return array('result' => 'success', 'redirect' => $this->get_return_url($order));
            }

            $msg = isset($body['message']) ? $body['message'] : ('Peman refize (HTTP ' . $code . ').');
            wc_add_notice('HatexCard: ' . esc_html($msg), 'error');
            return array('result' => 'failure');
        }
    }
    return true;
}

add_action('wp_ajax_hatexcard_poll_payment', 'hatexcard_ajax_poll_payment');
add_action('wp_ajax_nopriv_hatexcard_poll_payment', 'hatexcard_ajax_poll_payment');
function hatexcard_ajax_poll_payment() {
    $order_id = isset($_POST['order_id']) ? absint($_POST['order_id']) : 0;
    $nonce = isset($_POST['nonce']) ? (string) $_POST['nonce'] : '';
    if (!$order_id || !wp_verify_nonce($nonce, 'hatexcard_poll_' . $order_id)) {
        wp_send_json(array('paid' => false));
    }
    $order = wc_get_order($order_id);
    if (!$order) {
        wp_send_json(array('paid' => false));
    }
    if ($order->is_paid()) {
        wp_send_json(array('paid' => true));
    }
    $payment_id = $order->get_meta('_hatexcard_payment_id');
    if (!$payment_id) {
        wp_send_json(array('paid' => false));
    }
    $api_key = hatexcard_merchant_api_key();
    $status_url = add_query_arg('id', rawurlencode($payment_id), hatexcard_endpoint('status'));
    $response = wp_remote_get($status_url, array(
        'headers' => array('Authorization' => 'Bearer ' . $api_key),
        'timeout' => 15,
    ));
    $body = is_wp_error($response) ? null : json_decode(wp_remote_retrieve_body($response), true);
    $status = isset($body['payment']['status']) ? $body['payment']['status'] : '';
    if ($status === 'paid') {
        if (!$order->is_paid()) {
            $order->payment_complete($payment_id);
            $order->add_order_note('Peman HatexCard konfime (poll). Referans: ' . $payment_id);
        }
        wp_send_json(array('paid' => true));
    }
    wp_send_json(array('paid' => false, 'status' => $status));
}

add_filter('woocommerce_payment_gateways', function($methods) {
    if (hatexcard_ensure_gateway_available()) {
        $methods[] = 'WC_Gateway_HatexCard_MonCash';
    }
    return $methods;
});

function hatexcard_bootstrap() {
    hatexcard_ensure_key_synced();
    hatexcard_ensure_gateway_settings();
    hatexcard_ensure_gateway_available();
}
add_action('plugins_loaded', 'hatexcard_bootstrap', 20);
add_action('woocommerce_loaded', 'hatexcard_bootstrap', 5);
add_action('init', 'hatexcard_bootstrap', 5);

// ==========================================================================
// SOUTIEN CHECKOUT BLÒK — v26.6.0
// Fichye aparte + auto-enable + fallback enqueue (evite "no payment methods").
// ==========================================================================
add_action('before_woocommerce_init', function () {
    if (class_exists('\\Automattic\\WooCommerce\\Utilities\\FeaturesUtil')) {
        \\Automattic\\WooCommerce\\Utilities\\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

add_action('woocommerce_blocks_loaded', function () {
    if (!class_exists('\\Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType')) {
        return;
    }
    $file = dirname(__FILE__) . '/includes/class-hatexcard-blocks.php';
    if (file_exists($file)) {
        require_once $file;
    }
    if (class_exists('HatexCard_MonCash_Blocks_Support', false)) {
        add_action(
            'woocommerce_blocks_payment_method_type_registration',
            function ($payment_method_registry) {
                $payment_method_registry->register(new HatexCard_MonCash_Blocks_Support());
            }
        );
    }
});

// Fallback: si Blocks registry pa t chaje script nan tan, enskri JS nan checkout.
add_action('wp_enqueue_scripts', function () {
    if (is_admin() || !function_exists('is_checkout') || !is_checkout()) {
        return;
    }
    if (wp_script_is('hatexcard-moncash-payment-method', 'enqueued')) {
        return;
    }
    if (!wp_script_is('wc-blocks-registry', 'registered') && !wp_script_is('wc-blocks-registry', 'enqueued')) {
        return;
    }
    wp_register_script(
        'hatexcard-moncash-payment-method',
        plugins_url('hatexcard-moncash-payment-method.js', __FILE__),
        array('wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities'),
        HATEXCARD_PLUGIN_VERSION,
        true
    );
    // Pa voye kle / URL sekrè nan navigatè — sèlman tit/deskripsyon.
    $settings = hatexcard_ensure_gateway_settings();
    wp_localize_script('hatexcard-moncash-payment-method', 'hatexcardMonCashBlockData', array(
        'title'       => isset($settings['title']) ? $settings['title'] : 'Peye ak Hatexcard',
        'description' => isset($settings['description']) ? $settings['description'] : 'Antre nimewo telefòn ou epi konfime PIN sou telefòn ou.',
        'supports'    => array('products'),
    ));
    wp_enqueue_script('hatexcard-moncash-payment-method');
}, 100);
?>`;

      const blocksPhp = `<?php
if (!defined('ABSPATH')) exit;

use Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType;

final class HatexCard_MonCash_Blocks_Support extends AbstractPaymentMethodType {
    protected $name = 'hatexcard_moncash';

    public function initialize() {
        $this->settings = function_exists('hatexcard_ensure_gateway_settings')
            ? hatexcard_ensure_gateway_settings()
            : get_option('woocommerce_hatexcard_moncash_settings', array());
    }

    public function is_active() {
        $enabled = isset($this->settings['enabled']) ? $this->settings['enabled'] : 'yes';
        if ($enabled !== 'yes') {
            return false;
        }
        if (function_exists('WC') && WC()->payment_gateways()) {
            $gateways = WC()->payment_gateways()->payment_gateways();
            if (isset($gateways[$this->name]) && is_object($gateways[$this->name])) {
                return (bool) $gateways[$this->name]->is_available();
            }
        }
        return true;
    }

    public function get_payment_method_script_handles() {
        $gateway_file = dirname(__DIR__) . '/hatexcard-gateway.php';
        wp_register_script(
            'hatexcard-moncash-payment-method',
            plugins_url('hatexcard-moncash-payment-method.js', $gateway_file),
            array('wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities', 'wp-i18n'),
            defined('HATEXCARD_PLUGIN_VERSION') ? HATEXCARD_PLUGIN_VERSION : '26.6.0',
            true
        );
        return array('hatexcard-moncash-payment-method');
    }

    public function get_payment_method_script_handles_for_admin() {
        return $this->get_payment_method_script_handles();
    }

    public function get_payment_method_data() {
        // Sèlman done piblik pou UI — pa gen kle API, pa gen URL sekrè.
        return array(
            'title'       => $this->get_setting('title', 'Peye ak Hatexcard'),
            'description' => $this->get_setting('description', 'Antre nimewo telefòn ou epi konfime PIN sou telefòn ou.'),
            'supports'    => $this->get_supported_features(),
        );
    }
}
`;

      const readme = `# HatexCard Plugin — WooCommerce

Pake sa a jenere pou: **${profile.business_name || 'HATEX Merchant'}**

API: \`${apiOrigin}\`

## Enstalasyon

1. WordPress → **Plugins** → *Add New* → *Upload* → chwazi zip la → *Install* → *Activate*.
2. Si w deja gen yon vèsyon ansyen: **Deactivate** + **Delete** ansyen an anvan.
3. WooCommerce → Settings → Payments → aktive **HatexCard Plugin** (si poko aktif).
4. Bouton checkout la dwe di **Peye ak Hatexcard**.
5. Verifye monnen boutik la se **HTG** oswa **USD** (ak to konvèsyon).

## Kle API

- Telechaje ZIP la **sou menm sit HatexCard** kote kont ou a (preferans: https://hatexcard.com).
- Apre chak **Rotate kle**, ou dwe **re-telechaje** ZIP la epi re-enstale l — sinòn WordPress ap kenbe ansyen kle a.
- Kle API a kripsyon (AES) nan WordPress options — **pa ekspoze** nan HTML/JS navigatè.

## Checkout

Chwazi **Peye ak Hatexcard** → antre nimewo MonCash → Place order → konfime PIN sou telefòn (USSD), san redireksyon.
`;

      const checkoutBlockJs = `/**
 * HatexCard Plugin — Blocks Checkout (v26.6.0)
 * Pa gen kle API / URL sekrè nan fichye sa a.
 */
(function () {
    'use strict';

    var wc = window.wc;
    if (!wc || !wc.wcBlocksRegistry || typeof wc.wcBlocksRegistry.registerPaymentMethod !== 'function') {
        return;
    }
    var wpElement = window.wp && window.wp.element;
    var wpEntities = window.wp && window.wp.htmlEntities;
    if (!wpElement || typeof wpElement.createElement !== 'function') {
        return;
    }

    var createElement = wpElement.createElement;
    var useState = wpElement.useState;
    var useEffect = wpElement.useEffect;
    var decodeEntities = (wpEntities && typeof wpEntities.decodeEntities === 'function')
        ? wpEntities.decodeEntities
        : function (value) { return value || ''; };

    var getSetting = wc.wcSettings && typeof wc.wcSettings.getSetting === 'function'
        ? wc.wcSettings.getSetting
        : null;
    var data = getSetting ? getSetting('hatexcard_moncash_data', {}) : (window.hatexcardMonCashBlockData || {});
    if (!data || typeof data !== 'object') data = {};

    var title = decodeEntities(data.title || 'Peye ak Hatexcard');
    var features = (data.supports && data.supports.length) ? data.supports : ['products'];

    function PhoneIcon(props) {
        var size = (props && props.size) || 20;
        return createElement(
            'svg',
            {
                width: size,
                height: size,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: '2',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                'aria-hidden': 'true'
            },
            createElement('rect', { x: '5', y: '2', width: '14', height: '20', rx: '2', ry: '2' }),
            createElement('line', { x1: '12', y1: '18', x2: '12.01', y2: '18' })
        );
    }

    function HatexCardLabel(props) {
        var components = (props && props.components) ? props.components : {};
        if (components.PaymentMethodLabel) {
            return createElement(components.PaymentMethodLabel, { text: title });
        }
        return createElement('span', { className: 'wc-block-components-payment-method-label' }, title);
    }

    function HatexCardContent(props) {
        var stageState = useState('idle');
        var stage = stageState[0];
        var setStage = stageState[1];
        var phoneState = useState('');
        var phone = phoneState[0];
        var setPhone = phoneState[1];
        var eventRegistration = props && props.eventRegistration;
        var emitResponse = props && props.emitResponse;

        useEffect(function () {
            if (!eventRegistration || typeof eventRegistration.onPaymentSetup !== 'function' || !emitResponse) {
                return undefined;
            }
            var unsubscribe = eventRegistration.onPaymentSetup(function () {
                var cleaned = String(phone || '').replace(/\\D+/g, '');
                if (cleaned.length < 8) {
                    setStage('phone');
                    return {
                        type: emitResponse.responseTypes.ERROR,
                        message: 'Antre yon nimewo MonCash valab pou peye ak Hatexcard.'
                    };
                }
                return {
                    type: emitResponse.responseTypes.SUCCESS,
                    meta: {
                        paymentMethodData: {
                            hatexcard_moncash_phone: cleaned
                        }
                    }
                };
            });
            return function () {
                if (typeof unsubscribe === 'function') unsubscribe();
            };
        }, [phone, eventRegistration, emitResponse]);

        if (stage === 'idle') {
            return createElement(
                'div',
                { className: 'hatexcard-plugin-checkout', style: { marginTop: '8px', maxWidth: '420px' } },
                createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: function () { setStage('phone'); },
                        style: {
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            background: '#4f46e5',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '15px',
                            border: 'none',
                            borderRadius: '16px',
                            padding: '16px 20px',
                            boxShadow: '0 10px 24px rgba(79,70,229,0.28)',
                            cursor: 'pointer'
                        }
                    },
                    createElement(PhoneIcon, { size: 20 }),
                    createElement('span', null, 'Peye ak Hatexcard')
                ),
                createElement(
                    'p',
                    {
                        style: {
                            textAlign: 'center',
                            fontSize: '12px',
                            color: '#94a3b8',
                            margin: '10px 0 0',
                            lineHeight: 1.4
                        }
                    },
                    'Peman fèt ak HatexCard: nou voye yon USSD sou telefòn ou pou konfime PIN ou.'
                )
            );
        }

        return createElement(
            'div',
            {
                className: 'hatexcard-plugin-checkout',
                style: {
                    marginTop: '8px',
                    maxWidth: '420px',
                    background: '#eef2ff',
                    border: '1px solid #c7d2fe',
                    borderRadius: '16px',
                    padding: '16px'
                }
            },
            createElement(
                'p',
                { style: { margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' } },
                'Antre nimewo MonCash ou'
            ),
            createElement(
                'p',
                { style: { margin: '0 0 12px', fontSize: '12px', color: '#64748b', lineHeight: 1.5 } },
                'HatexCard ap voye yon ',
                createElement('strong', null, 'USSD'),
                ' sou telefòn ou pou konfime peman an ak PIN ou — san ou pa bezwen peye sou yon lòt sit.'
            ),
            createElement('input', {
                id: 'hatexcard_moncash_phone_blocks',
                type: 'tel',
                inputMode: 'numeric',
                autoComplete: 'tel',
                placeholder: '509 12 34 5678',
                value: phone,
                onChange: function (e) { setPhone(e.target.value); },
                style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#fff',
                    border: '1.5px solid #a5b4fc',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#0f172a',
                    outline: 'none'
                }
            }),
            createElement(
                'div',
                { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
                createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: function () { /* phone already captured for Place order */ },
                        style: {
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: '#4f46e5',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '13px',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            cursor: 'pointer'
                        }
                    },
                    createElement(PhoneIcon, { size: 16 }),
                    createElement('span', null, 'Kontinye — Place order')
                ),
                createElement(
                    'button',
                    {
                        type: 'button',
                        onClick: function () { setStage('idle'); setPhone(''); },
                        style: {
                            padding: '12px 16px',
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            color: '#475569',
                            fontWeight: 600,
                            fontSize: '13px',
                            borderRadius: '12px',
                            cursor: 'pointer'
                        }
                    },
                    'Anile'
                )
            )
        );
    }

    wc.wcBlocksRegistry.registerPaymentMethod({
        name: 'hatexcard_moncash',
        paymentMethodId: 'hatexcard_moncash',
        label: createElement(HatexCardLabel),
        ariaLabel: title,
        content: createElement(HatexCardContent),
        edit: createElement(HatexCardContent),
        canMakePayment: function () { return true; },
        supports: {
            features: features,
            showSavedCards: false,
            showSaveOption: false
        }
    });
})();
`;

      pluginDir?.file('hatexcard-gateway.php', phpCode);
      pluginDir?.folder('includes')?.file('class-hatexcard-blocks.php', blocksPhp);
      pluginDir?.file('hatexcard-moncash-payment-method.js', checkoutBlockJs);
      pluginDir?.file('README.md', readme);
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'hatexcard-woocommerce.zip');
    } catch (error) {
      console.error(error);
      alert('Erè nan jenere Plugin nan.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kycOk = profile?.kyc_status === 'approved';

  return (
    <MerchantShell user={user} hideTopChrome>
      <main className="flex-grow w-full max-w-3xl mx-auto px-4 pt-6 pb-28 lg:pt-8">
        <header className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-slate-600 hover:text-indigo-600 shadow-sm"
            aria-label="Retounen"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-base font-bold text-slate-900">Plugin</h1>
          <div className="w-10" />
        </header>

        {!kycOk && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 font-medium leading-relaxed">
              KYC kont ou poko apwouve. Ou dwe fin pase verifikasyon an anvan ou ka
              telechaje plugin WooCommerce la.{' '}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => router.push('/kyc/v2')}
              >
                Ale nan KYC
              </button>
            </div>
          </div>
        )}

        {/* KAT WOOCOMMERCE */}
        <section className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-5">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
              <ShoppingBag className="text-blue-600 w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">HatexCard Plugin</h2>
              <p className="text-slate-500 text-xs font-medium">WordPress / WooCommerce — v26.6</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Fè sit ou a aksepte <span className="font-semibold text-slate-900">Peye ak Hatexcard</span>{' '}
            (HTG — konpatib ak boutik an HTG oswa USD). Kliyan konfime peman an sou telefòn li epi ou
            resevwa montan an sou kont ou nan HatexCard. Konfigirasyon an gentan fèt nan ZIP la.
          </p>

          <ul className="text-xs text-slate-600 space-y-2 mb-8">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Bouton checkout: <span className="font-semibold">Peye ak Hatexcard</span> — pa “Peye ak
              MonCash”.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Apre Place order: paj tann PIN (tankou checkout pwodwi) — san redireksyon.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Kle API entegre nan ZIP — telechaje sou <span className="font-semibold">hatexcard.com</span>{' '}
              (pa localhost) pou kle a mache.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Apre Rotate kle: re-telechaje ZIP + delete/re-enstale plugin sou WordPress.
            </li>
          </ul>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-6">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Vèsyon: 26.6.0
            </div>
            <button
              type="button"
              onClick={generateWooCommercePlugin}
              disabled={downloading || !kycOk}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-indigo-700 disabled:bg-indigo-300 flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              {downloading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Ap jenere...
                </>
              ) : (
                <>
                  <Download size={16} /> Telechaje ZIP
                </>
              )}
            </button>
          </div>
        </section>

        {/* KLE API MACHANN */}
        <section className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 border border-indigo-100 p-2.5 rounded-xl">
                <Plug className="text-indigo-600 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Kle API Machann</h2>
                <p className="text-[11px] text-slate-500">Kle a entegre otomatikman nan ZIP la.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRotateApiKey}
              disabled={rotatingApiKey || !profileHasApiKey(profile)}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {rotatingApiKey ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCw className="w-4 h-4" />
              )}
              Rotate kle
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              readOnly
              value={displayedApiKey}
              className="flex-1 w-full bg-white border border-gray-300 text-indigo-700 text-sm rounded-xl p-3.5 font-mono outline-none shadow-sm font-semibold"
            />
            <button
              type="button"
              onClick={copyApiKey}
              className="w-full sm:w-auto bg-slate-900 hover:bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {copiedKey ? (
                <>
                  <CheckCircle2 size={16} /> Kopye
                </>
              ) : (
                <>
                  <Copy size={16} /> Kopye Kle a
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-amber-700 mt-3 font-medium">
            Kle a estoke hash nan baz done. Ou wè kle konplè a sèlman yon fwa apre
            provision/rotate nan sesyon sa a.
          </p>
        </section>

        <section className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 flex items-start gap-3">
          <ShieldCheck size={20} className="text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs text-indigo-900 font-medium leading-relaxed">
            Pou resevwa lajan machann nan, asire w ou konekte yon kont MonCash (ou byen kont
            bank) sou{' '}
            <button
              type="button"
              className="font-bold underline"
              onClick={() => router.push('/dashboard')}
            >
              paj prensipal la
            </button>
            . Payout yo fèt otomatikman lè kliyan an peye.
          </div>
        </section>
      </main>
    </MerchantShell>
  );
}





