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

  const handleRotateApiKey = useCallback(async () => {
    if (!window.confirm('Ou pral jenere yon NOUVO kle API. Ansyen kle a pa mache ankò. Kontinye?'))
      return null;
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

  /** Kle an klè pou plugin — sèlman nan sesyon, oswa apre rotate/provision. */
  const ensurePlainApiKey = useCallback(async (): Promise<string | null> => {
    if (revealedApiKey) return revealedApiKey;
    if (profile?.api_key) {
      setRevealedApiKey(profile.api_key);
      return profile.api_key;
    }
    if (!profileHasApiKey(profile)) {
      return generateApiKey();
    }
    const ok = window.confirm(
      'Kle API konplè a pa disponib (estoke hash sou sèvè). Pou telechaje plugin la, ou dwe jenere yon nouvo kle — ansyen kle a ap sispann mache. Kontinye?'
    );
    if (!ok) return null;
    return handleRotateApiKey();
  }, [revealedApiKey, profile, generateApiKey, handleRotateApiKey]);

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
  // JENERE WOOCOMMERCE PLUGIN (v25.0 — MonCash + paj /success)
  // ==========================================================================
  const generateWooCommercePlugin = async () => {
    if (!profile?.id) return;
    if (profile?.kyc_status !== 'approved')
      return alert('Ou dwe pase KYC pou w itilize Plugin sa a.');
    const apiKey = await ensurePlainApiKey();
    if (!apiKey) return;

    setDownloading(true);

    try {
      const zip = new JSZip();
      const pluginDir = zip.folder('hatexcard-woocommerce');

      const phpCode = `<?php
/**
 * Plugin Name: HatexCard MonCash Gateway
 * Plugin URI: https://hatexcard.com
 * Description: Peman MonCash (HTG) pou WooCommerce. Kliyan peye sou MonCash dirèkteman; machann nan resevwa montan an sou kont li nan HatexCard.
 * Version: 25.0.0
 * Author: Hatex Group
 */

if (!defined('ABSPATH')) exit;

add_action('plugins_loaded', 'hatexcard_init_moncash_gateway');

function hatexcard_init_moncash_gateway() {
    if (!class_exists('WC_Payment_Gateway')) return;

    class WC_Gateway_HatexCard_MonCash extends WC_Payment_Gateway {

        public function __construct() {
            $this->id = 'hatexcard_moncash';
            $this->has_fields = false;
            $this->method_title = 'HatexCard MonCash';
            $this->method_description = 'Kliyan peye ak MonCash (HTG). Peman an fet sou MonCash epi machann nan resevwa kob la sou kont li nan HatexCard.';

            $this->init_form_fields();
            $this->init_settings();

            $this->title = $this->get_option('title');
            $this->description = $this->get_option('description');
            $this->merchant_api_key = '${apiKey}';
            $this->api_base_url = 'https://hatexcard.com/api/moncash/payments';

            add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            add_action('woocommerce_thankyou_' . $this->id, array($this, 'custom_thankyou_page'));
        }

        public function init_form_fields() {
            $this->form_fields = array(
                'enabled' => array('title' => 'Aktive', 'type' => 'checkbox', 'default' => 'yes'),
                'title' => array('title' => 'Tit', 'type' => 'text', 'default' => 'Peye ak MonCash'),
                'description' => array('title' => 'Deskripsyon', 'type' => 'textarea', 'default' => 'Kliyan an konfime peman an ak yon USSD sou telefòn li (HTG).'),
            );
        }

        public function payment_fields() {
            if ($this->description) {
                echo wpautop(wp_kses_post($this->description));
            }
            echo '<p style="margin-bottom:0"><small>Apre valide kòmand ou, HatexCard voye yon USSD sou telefòn ou pou konfime peman an ak PIN ou (HTG).</small></p>';
        }

        // Paj resi a — tcheke estati peman an sou HatexCard epi konplete kòmand la
        public function custom_thankyou_page($order_id) {
            $order = wc_get_order($order_id);
            if (!$order) return;
            $payment_id = $order->get_meta('_hatexcard_payment_id');
            if (!$payment_id) return;

            $response = wp_remote_get($this->api_base_url . '?id=' . rawurlencode($payment_id), array(
                'headers' => array('Authorization' => 'Bearer ' . $this->merchant_api_key),
                'timeout' => 15
            ));
            $body = is_wp_error($response) ? null : json_decode(wp_remote_retrieve_body($response), true);
            $status = isset($body['payment']['status']) ? $body['payment']['status'] : '';
            $paid = ($status === 'paid');

            if ($paid && !$order->is_paid()) {
                $order->payment_complete($payment_id);
                $order->add_order_note('Peman MonCash konfime. Referans: ' . $payment_id);
            }

            $amount = $order->get_meta('_hatexcard_amount_htg');
            $mode = $order->get_meta('_hatexcard_checkout_mode', true);
            $checkout_url = $order->get_meta('_hatexcard_checkout_url', true);
            $payer_phone = $order->get_meta('_hatexcard_payer_phone', true);

            if ($paid) {
                echo '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:16px 0;">';
                echo '<h3 style="margin-top:0">Peman MonCash reyisi</h3>';
                echo '<p style="margin-bottom:6px">Referans: <strong>' . esc_html($payment_id) . '</strong></p>';
                if ($amount) {
                    echo '<p style="margin-bottom:6px">Montan total: <strong>' . esc_html(number_format((float) $amount)) . ' HTG</strong></p>';
                }
                echo '<p style="margin-bottom:0">Machann nan pral resevwa montan an sou kont li nan HatexCard.</p>';
                echo '</div>';
                return;
            }

            echo '<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:16px;margin:16px 0;">';
            echo '<h3 style="margin-top:0">Konfime peman an sou telefòn ou</h3>';
            echo '<p style="margin-bottom:6px">Referans: <strong>' . esc_html($payment_id) . '</strong></p>';
            if ($amount) {
                echo '<p style="margin-bottom:6px">Montan total: <strong>' . esc_html(number_format((float) $amount)) . ' HTG</strong></p>';
            }
            if ($mode === 'ussd') {
                echo '<p style="margin-bottom:0">HatexCard voye yon USSD sou nimewo ' . esc_html($payer_phone ? $payer_phone : 'telefòn ou') . '. Louvri mesaj la, antre PIN ou. Paj sa a ap mete ajou otomatikman.</p>';
            } else {
                echo '<p style="margin-bottom:10px">Klike sou bouton an pou konplete peman an sou MonCash nan yon lòt onglet — apre konfimasyon ak PIN ou, paj sa a ap mete ajou otomatikman.</p>';
                echo '<button type="button" id="hx-moncash-open" data-url="' . esc_attr($checkout_url) . '" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;border:0;cursor:pointer;font-weight:bold;">Ouvri MonCash</button>';
                echo '<script>(function(){var b=document.getElementById("hx-moncash-open");if(b){b.addEventListener("click",function(e){e.preventDefault();window.open(b.getAttribute("data-url"),"_blank");});}})();</script>';
            }
            echo '</div>';

            if (!$order->is_paid()) {
                echo '<script>setTimeout(function(){ if (!document.hidden) window.location.reload(); }, 8000);</script>';
            }
        }
        public function process_payment($order_id) {
            global $woocommerce;
            $order = wc_get_order($order_id);

            $order_id_safe = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $order->get_order_number());
            $order_id_safe = $order_id_safe !== '' ? $order_id_safe : (string) $order->get_id();

            // Ladrès: boutik la dwe mete lajan li an HTG (Goud).
            $amount_htg = round((float) $order->get_total());

            // PA GEN return_url ankò: lè peman an fini sou hosted MonCash la,
            // HatexCard montre paj konfimasyon li (/success) ki verifye baz done a.
            $payload = array(
                'amount' => $amount_htg,
                'order_id' => 'WC-' . $order_id_safe,
                'description' => 'Kòmand WooCommerce #' . $order_id_safe . ' — ' . get_bloginfo('name'),
                'customer_phone' => $order->get_billing_phone(),
                'flow' => 'auto',
            );

            $response = wp_remote_post($this->api_base_url, array(
                'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $this->merchant_api_key),
                'body'    => json_encode($payload),
                'timeout' => 30
            ));

            if (is_wp_error($response)) {
                wc_add_notice('Sèvè HatexCard pa reponn. Eseye ankò.', 'error');
                return;
            }

            $body = json_decode(wp_remote_retrieve_body($response), true);

            if (isset($body['ok']) && $body['ok'] === true && !empty($body['payment_id'])) {
                $order->update_meta_data('_hatexcard_payment_id', $body['payment_id']);
                $order->update_meta_data('_hatexcard_amount_htg', isset($body['client_total']) ? $body['client_total'] : $amount_htg);
                $mode = isset($body['checkout_mode']) ? $body['checkout_mode'] : 'hosted';
                $order->update_meta_data('_hatexcard_checkout_mode', $mode);
                if (!empty($body['checkout_url'])) {
                    $order->update_meta_data('_hatexcard_checkout_url', $body['checkout_url']);
                }
                $order->update_meta_data('_hatexcard_payer_phone', $order->get_billing_phone());
                $order->save();
                $order->add_order_note('Peman MonCash kòmanse. Ap tann konfimasyon MonCash. Referans: ' . $body['payment_id']);
                $woocommerce->cart->empty_cart();
                // Nou retounen kliyan an sou paj resi a; MonCash la louvri nan yon lòt
                // onglet epi HatexCard ap montre paj konfimasyon /success li apre peman an.
                return array('result' => 'success', 'redirect' => $this->get_return_url($order));
            }

            $msg = isset($body['message']) ? $body['message'] : 'Peman refize.';
            wc_add_notice('HatexCard: ' . esc_html($msg), 'error');
            return;
        }
    }
}

add_filter('woocommerce_payment_gateways', function($methods) {
    $methods[] = 'WC_Gateway_HatexCard_MonCash';
    return $methods;
});
?>`;

      const readme = `# HatexCard MonCash — Plugin WooCommerce

Pake sa a jenere pou: **${profile.business_name || 'HATEX Merchant'}**

## Enstalasyon

1. Nan WordPress (Admin) → **Pwog ki enstale yo** → *Ajoute nouvo* → *Telechaje pwog* → chwazi zip la → *Enstale* → *Aktive*.
2. Ale nan **WooCommerce → Retrete (Settings) → Peman** epi aktive **HatexCard MonCash**.
3. Pa gen okenn lòt konfigirasyon — kle API machann lan deja entegre nan plugin la.

## Kòman li fonksyone

- Kliyan an valide kòmand li → klike **"Passe komanda"** → li redireksyon sou **MonCash** pou konplete peman an (HTG).
- Apre peman an, MonCash konfime epi **machann nan resevwa montan an sou kont li** nan HatexCard (payout otomatik).
- Paj resi a montre estati peman an epi kòmand la vin **konplete** otomatikman lè MonCash konfime.
- Apre yon peman hosted, onglet MonCash la tounen sou paj konfimasyon HatexCard (hatexcard.com/success) — se baz done a ki konfime peman an, pa paj la.

## Enpòtan

- **Monnen boutik la dwe HTG (Goud)** — montan yo voye dirèkteman an HTG.
- Machann nan dwe gen **yon nimewo MonCash pou payout** nan HatexCard (Konekte kont bank) pou resevwa lajan li.
- Kle API a se yon sekrè — li rete sèlman bò sèvè a (WordPress), li pa janm ekspoze nan navigatè kliyan an.
`;

      pluginDir?.file('hatexcard-gateway.php', phpCode);
      pluginDir?.file('README.md', readme);
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'hatexcard-woocommerce.zip');
    } catch (error) {
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
              <h2 className="text-lg font-bold text-slate-900">WooCommerce</h2>
              <p className="text-slate-500 text-xs font-medium">WordPress Plugin — MonCash</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            Fè sit ou a aksepte <span className="font-semibold text-slate-900">MonCash</span>{' '}
            (HTG). Kliyan konfime peman an ak yon <span className="font-semibold">USSD</span>{' '}
            sou telefòn li epi ou resevwa montan an sou kont ou nan HatexCard. Konfigirasyon an
            gentan fèt nan ZIP la.
          </p>

          <ul className="text-xs text-slate-600 space-y-2 mb-8">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Checkout telefòn-premye: kliyan an antre nimewo MonCash li epi li konfime ak yon
              USSD sou telefòn li — li pa bezwen kite sit ou a.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Peman imedya sou MonCash — kliyan pa bezwen kont HatexCard.
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Payout otomatik sou kont MonCash ou (machann lan).
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />
              Resi ak estati kòmand otomatikman sou paj resi a.
            </li>
          </ul>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-6">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Vèsyon: 25.0.0
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





