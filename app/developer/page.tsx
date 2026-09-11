"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
  Terminal,
  Copy,
  CheckCircle2,
  ShieldAlert,
  Code2,
  Webhook,
  Loader2,
  BookOpen,
  AlertCircle,
  Plus,
  Send,
  RotateCw,
  Trash2,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  History,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';
import { maskPublishableKey } from '@/lib/security/api-key';
import { maskGatewayApiKey } from '@/lib/gateway/api-keys';

const AVAILABLE_EVENTS = ['payment.success'];

type Section = 'overview' | 'keys' | 'webhooks' | 'logs';
type GatewayKeyRow = {
  id?: string;
  mode: 'test' | 'live';
  key_prefix: string;
  key_masked: string;
};

export default function DeveloperDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; missingKyc: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [activeTab, setActiveTab] = useState<'js' | 'php' | 'curl'>('js');
  const [section, setSection] = useState<Section>('overview');
  /** Filtre UI sèlman — pa chanje anyen nan DB. Kle test/live separe. */
  const [mode, setMode] = useState<'test' | 'live'>('test');

  const [gatewayKeys, setGatewayKeys] = useState<GatewayKeyRow[]>([]);
  const [revealedKeys, setRevealedKeys] = useState<Partial<Record<'test' | 'live', string>>>({});
  const [showKey, setShowKey] = useState<Partial<Record<'test' | 'live', boolean>>>({});
  const [rotatingMode, setRotatingMode] = useState<'test' | 'live' | null>(null);

  // Webhook endpoints state
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creatingEndpoint, setCreatingEndpoint] = useState(false);
  const [busyEndpoint, setBusyEndpoint] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ url: string; secret: string } | null>(null);

  // Litij / rapò kliyan sou peman machann (spec §5)
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputeLoading, setDisputeLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadGatewayKeys = async () => {
    try {
      const res = await fetch('/api/developer/api-keys');
      if (res.ok) {
        const data = await res.json();
        setGatewayKeys(data.keys || []);
      }
    } catch {
      /* pa bloke */
    }
  };

  const loadWebhooks = async () => {
    try {
      const [epRes, dlRes] = await Promise.all([
        fetch('/api/developer/webhooks'),
        fetch('/api/developer/webhooks/deliveries'),
      ]);
      if (epRes.ok) {
        const epData = await epRes.json();
        setEndpoints(epData.endpoints || []);
      }
      if (dlRes.ok) {
        const dlData = await dlRes.json();
        setDeliveries(dlData.deliveries || []);
      }
    } catch {
      /* pa bloke paj la si webhook yo pa chaje */
    }
  };

  const loadDisputes = async () => {
    setDisputeLoading(true);
    try {
      const res = await fetch('/api/v2/merchant-disputes');
      if (res.ok) {
        const data = await res.json();
        setDisputes(data.disputes || []);
      }
    } catch {
      /* pa bloke paj la si litij yo pa chaje */
    } finally {
      setDisputeLoading(false);
    }
  };

  useEffect(() => {
    async function loadDevData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      let elig: { eligible: boolean; missingKyc: boolean } | null = null;
      let profileData: any = null;

      try {
        const res = await fetch('/api/developer/eligibility');
        if (res.ok) {
          const payload = await res.json();
          elig = payload.eligibility;
          profileData = payload.profile;
        }
      } catch {
        /* eseye fallback kliyan anba */
      }

      if (!elig || !profileData) {
        const { data } = await supabase
          .from('profiles')
          .select('id, kyc_status')
          .eq('id', user.id)
          .maybeSingle();
        if (data) {
          elig = checkMerchantEligibility(data as any);
          profileData = data;
        }
      }

      if (elig && elig.eligible && profileData) {
        setEligibility(elig);
        let pkPrefix = profileData.api_key_pk_prefix || null;
        let pk = profileData.api_key_pk || null;
        let isMerchant = profileData.is_merchant === true;

        try {
          const provRes = await fetch('/api/developer/provision', { method: 'POST' });
          if (provRes.ok) {
            const prov = await provRes.json();
            pkPrefix = prov.api_key_pk_prefix ?? pkPrefix;
            pk = prov.api_key_pk ?? pk;
            isMerchant = prov.is_merchant ?? isMerchant;
            if (prov.gateway_keys?.length) {
              setGatewayKeys(prov.gateway_keys);
            }
            const revealed: Partial<Record<'test' | 'live', string>> = {};
            if (prov.gateway_revealed?.test?.api_key) {
              revealed.test = prov.gateway_revealed.test.api_key;
            }
            if (prov.gateway_revealed?.live?.api_key) {
              revealed.live = prov.gateway_revealed.live.api_key;
            }
            if (Object.keys(revealed).length) {
              setRevealedKeys(revealed);
              setShowKey({ test: !!revealed.test, live: !!revealed.live });
            }
          }
        } catch {
          /* fallback */
        }

        setMerchant({
          ...profileData,
          api_key_pk: pk,
          api_key_pk_prefix: pkPrefix,
          api_key_pk_masked: pk ? pk : maskPublishableKey(pkPrefix),
          is_merchant: isMerchant,
        });
        await loadGatewayKeys();
        await loadWebhooks();
        void loadDisputes();
      } else {
        setEligibility(elig);
        setMerchant(profileData);
      }

      setLoading(false);
    }
    loadDevData();
  }, [supabase, router]);

  const handleCopy = (text: string, type: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleSelectMode = (next: 'test' | 'live') => {
    if (next === 'live') {
      const ok = window.confirm(
        'Ou pral gade mòd LIVE (vre lajan). Kle TEST ou a pa chanje — se de kle diferan.'
      );
      if (!ok) return;
    }
    setMode(next);
  };

  const handleCreateEndpoint = async () => {
    if (!newUrl.trim()) return;
    setCreatingEndpoint(true);
    try {
      const res = await fetch('/api/developer/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newUrl.trim(),
          description: newDesc.trim(),
          events: AVAILABLE_EVENTS,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè pandan kreyasyon an.');
      if (data.secret) setRevealedSecret({ url: data.endpoint?.url || newUrl.trim(), secret: data.secret });
      setNewUrl('');
      setNewDesc('');
      await loadWebhooks();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingEndpoint(false);
    }
  };

  const handleTestEndpoint = async (id: string) => {
    setBusyEndpoint(id);
    try {
      const res = await fetch(`/api/developer/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) alert(`Tès reyisi! Sèvè w la reponn ak kòd ${data.response_status}.`);
      else alert(`Tès echwe: ${data.error || 'sèvè w la pa reponn byen (kòd ' + (data.response_status || 'N/A') + ').'}`);
      await loadWebhooks();
    } catch {
      alert('Erè pandan tès la.');
    } finally {
      setBusyEndpoint(null);
    }
  };

  const handleRotateSecret = async (id: string, url: string) => {
    if (!confirm('Wotasyon secret la ap kase ansyen an. Ou sèten?')) return;
    setBusyEndpoint(id);
    try {
      const res = await fetch(`/api/developer/webhooks/${id}/rotate-secret`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè wotasyon.');
      if (data.secret) setRevealedSecret({ url, secret: data.secret });
      await loadWebhooks();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyEndpoint(null);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!confirm('Efase pwen webhook sa a nèt?')) return;
    setBusyEndpoint(id);
    try {
      const res = await fetch(`/api/developer/webhooks/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erè efasman.'); }
      await loadWebhooks();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBusyEndpoint(null);
    }
  };

  const handleRotateApiKey = async (keyMode: 'test' | 'live') => {
    const label = keyMode === 'test' ? 'TEST (hx_sk_test_)' : 'LIVE (hx_sk_live_)';
    if (
      !window.confirm(
        `Ou pral jenere yon NOUVO kle ${label}. Ansyen kle ${keyMode} la pa mache ankò. Lòt kle a (${keyMode === 'test' ? 'live' : 'test'}) pa chanje. Kontinye?`
      )
    ) {
      return;
    }
    setRotatingMode(keyMode);
    try {
      const res = await fetch('/api/developer/api-key/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: keyMode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè');
      setRevealedKeys((prev) => ({ ...prev, [keyMode]: data.api_key }));
      setShowKey((prev) => ({ ...prev, [keyMode]: true }));
      setGatewayKeys((prev) => {
        const rest = prev.filter((k) => k.mode !== keyMode);
        return [
          ...rest,
          {
            mode: keyMode,
            key_prefix: data.api_key_prefix,
            key_masked: data.api_key_masked,
          },
        ].sort((a, b) => a.mode.localeCompare(b.mode));
      });
      alert(data.message || `Nouvo kle ${keyMode} jenere.`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRotatingMode(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Chajman...</p>
      </div>
    </div>
  );

  if (eligibility !== null && !eligibility.eligible) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Aksè API poko disponib</h1>
          <p className="text-sm text-slate-500 mb-6">Pou jwenn kle sekrè w la, ou dwe konplete:</p>
          <div className="space-y-3 text-left mb-6">
            <div className={`flex items-center gap-3 p-3 rounded-xl border ${eligibility?.missingKyc ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
              {eligibility?.missingKyc ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
              <span className="text-sm font-semibold text-slate-700">Verifikasyon ID (KYC) apwouve</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {eligibility?.missingKyc && (
              <button onClick={() => router.push('/kyc/v2')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all">Konplete Verifikasyon ID (KYC)</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const keyForMode = (m: 'test' | 'live') => gatewayKeys.find((k) => k.mode === m);
  const testKey = keyForMode('test');
  const liveKey = keyForMode('live');
  const snippetKey =
    revealedKeys[mode] ||
    (mode === 'test' ? 'hx_sk_test_KLE_TÈS_OU' : 'hx_sk_live_KLE_LIVE_OU');
  const filteredEndpoints = endpoints.filter((ep) => (ep.mode || 'live') === mode);

  const codeSnippets = {
    js: `// ⚠️ Sèlman sou SÈVÈ ou a — pa nan navigatè kliyan an
// Mòd ${mode.toUpperCase()} — kle ${mode === 'test' ? 'hx_sk_test_' : 'hx_sk_live_'} (pa melanje)
const response = await fetch('https://hatexcard.com/api/v2/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${snippetKey}',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'CMD-123-v1'
  },
  body: JSON.stringify({
    amount: 1500,
    order_id: 'CMD-123',
    description: 'Kòmand #123',
    return_url: 'https://sit-ou.com/done',
    customer_phone: '509xxxxxxxx',
    flow: 'auto'
  })
});
const data = await response.json();
// data.checkout_url / data.payment_id`,
    php: `<?php
// Mòd ${mode.toUpperCase()} — pa melanje ak kle ${mode === 'test' ? 'live' : 'test'}
$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => 'https://hatexcard.com/api/v2/payments',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => json_encode([
    'amount' => 1500,
    'order_id' => 'CMD-123',
    'return_url' => 'https://sit-ou.com/done',
    'customer_phone' => '509xxxxxxxx',
    'flow' => 'auto'
  ]),
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer ${snippetKey}',
    'Content-Type: application/json',
    'Idempotency-Key: CMD-123-v1'
  ],
]);
$response = curl_exec($curl);
curl_close($curl);
echo $response;
?>`,
    curl: `# Mòd ${mode.toUpperCase()}
curl --request POST \\
  --url https://hatexcard.com/api/v2/payments \\
  --header 'Authorization: Bearer ${snippetKey}' \\
  --header 'Content-Type: application/json' \\
  --header 'Idempotency-Key: CMD-123-v1' \\
  --data '{
    "amount": 1500,
    "order_id": "CMD-123",
    "return_url": "https://sit-ou.com/done",
    "customer_phone": "509xxxxxxxx",
    "flow": "auto"
  }'`
  };

  const navItems: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'keys', label: 'API keys', icon: <KeyRound className="w-4 h-4" /> },
    { id: 'webhooks', label: 'Webhooks', icon: <Webhook className="w-4 h-4" /> },
    { id: 'logs', label: 'Logs', icon: <History className="w-4 h-4" /> },
  ];

  const activeModeLabel = mode === 'test' ? 'Test mode' : 'Live mode';

  return (
    <div className="min-h-screen bg-[#f6f8fa] text-slate-900 font-sans">
      {/* HEADER — estil Stripe */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Développeurs</h1>
              <p className="text-xs text-slate-500 font-medium">API HatexCard — MonCash</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* TOGGLE TEST / LIVE — filtre UI sèlman (2 kle separe nan DB) */}
            <div className="flex items-center bg-slate-100 border border-gray-200 rounded-full p-1">
              <button
                onClick={() => handleSelectMode('test')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'test' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Test
              </button>
              <button
                onClick={() => handleSelectMode('live')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'live' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Live
              </button>
            </div>
            <button
              onClick={() => router.push('/developer/docs')}
              className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-semibold text-xs uppercase tracking-wider transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Docs
            </button>
          </div>
        </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row gap-6">
        {/* SIDEBAR — estil Stripe */}
        <aside className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                  section === item.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
            <button
              onClick={() => router.push('/developer/docs')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Documentation
            </button>
          </nav>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 min-w-0 space-y-6">


          {/* ============ OVERVIEW ============ */}
          {section === 'overview' && (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Code2 className="text-indigo-600 w-5 h-5" /> Kòmanse fasilman
                  </h2>
                </div>
                <div className="p-6">
                  <ol className="text-sm text-slate-600 space-y-3 list-decimal list-inside font-medium">
                    <li>
                      Ou gen <strong>2 kle separe</strong>: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">hx_sk_test_</code> ak{' '}
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-emerald-700 font-mono text-xs">hx_sk_live_</code> — yo pa melanje.
                    </li>
                    <li>
                      Sou <strong>sèvè ou a</strong>, kreye yon peman ak{' '}
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">POST /api/v2/payments</code>{' '}
                      ak Bearer token (kle test oswa live).
                    </li>
                    <li>
                      Kliyan an peye sou <strong>checkout MonCash</strong>. Ou swiv estati a ak{' '}
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">payment_id</code> oswa nan webhook.
                    </li>
                    <li>
                      Konfigire <strong>webhook</strong> pou menm mòd la (test→test, live→live) — tankou Stripe.
                    </li>
                  </ol>

                  <div className="mt-5 flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <Zap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-900 font-medium leading-relaxed">
                      Ou ap gade <strong>{activeModeLabel}</strong>. Sa a se yon filtre UI sèlman — li pa chanje lòt kle a nan baz done a.
                      {mode === 'test'
                        ? ' Peman ak kle tès ale nan sandbox MonCash.'
                        : ' Peman ak kle live se vre lajan.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ===== TESTE API A — kle tès fiktif APA de kle live a ===== */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Send className="text-indigo-600 w-5 h-5" /> Teste API a
                  </h2>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${mode === 'test' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {activeModeLabel}
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3 mb-4 bg-slate-50 border border-gray-200 p-3.5 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        {mode === 'test' ? 'Kle TEST (hx_sk_test_) — sandbox' : 'Kle LIVE (hx_sk_live_) — vre lajan'}
                      </p>
                      <code className="font-mono text-sm text-indigo-600 break-all font-semibold select-all">
                        {snippetKey}
                      </code>
                    </div>
                    <button
                      onClick={() => handleCopy(snippetKey, 'snippet')}
                      className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0 shadow-sm"
                      title="Kopye kle a"
                    >
                      {copiedKey === 'snippet' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400" />}
                    </button>
                  </div>

                  <div className="flex gap-1 mb-3">
                    {(['js', 'php', 'curl'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 border border-gray-200'}`}
                      >
                        {t === 'js' ? 'JavaScript' : t === 'php' ? 'PHP' : 'cURL'}
                      </button>
                    ))}
                  </div>

                  <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap">{codeSnippets[activeTab]}</pre>

                  <div className={`mt-4 flex items-start gap-3 rounded-xl p-4 border ${mode === 'test' ? 'bg-indigo-50 border-indigo-100' : 'bg-amber-50 border-amber-200'}`}>
                    {mode === 'test' ? (
                      <Zap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium leading-relaxed text-slate-700">
                      {mode === 'test'
                        ? 'Kle TEST voye peman nan sandbox MonCash. Kle LIVE ou a pa chanje — se 2 kle diferan nan DB.'
                        : 'Kle LIVE voye VRE LAJAN. Pa janm mete l nan frontend. Kle TEST rete disponib apa.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <KeyRound className="text-indigo-600 w-5 h-5" /> API keys
                  </h2>
                  <button onClick={() => setSection('keys')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Gade tout →</button>
                </div>
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Secret key (test)</span>
                    <code className="font-mono text-sm text-indigo-600 break-all">
                      {revealedKeys.test && showKey.test ? revealedKeys.test : (testKey?.key_masked || maskGatewayApiKey(testKey?.key_prefix))}
                    </code>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Secret key (live)</span>
                    <code className="font-mono text-sm text-emerald-700 break-all">
                      {revealedKeys.live && showKey.live ? revealedKeys.live : (liveKey?.key_masked || maskGatewayApiKey(liveKey?.key_prefix))}
                    </code>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Publishable key</span>
                    <code className="font-mono text-sm text-slate-600 break-all">{merchant?.api_key_pk || merchant?.api_key_pk_masked || maskPublishableKey(merchant?.api_key_pk_prefix)}</code>
                  </div>
                </div>
              </div>

              {/* ===== LITIJ / RAPÒ KLIYAN (spec §5) ===== */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <AlertTriangle className="text-amber-600 w-5 h-5" /> Litij & Rapò kliyan
                  </h2>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      disputes.some((d) => d.status === 'open')
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {disputes.length} total
                  </span>
                </div>
                <div className="p-6">
                  {disputeLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Ap chaje litij yo...
                    </div>
                  ) : disputes.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">
                      Pa gen okenn rapò kliyan sou peman ou. Moun k ap achte kay ou ka ouvè yon litij si yo pa jwenn sèvis yo.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {disputes.slice(0, 5).map((d) => (
                        <div key={d.id} className="border border-gray-200 rounded-xl px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-xs text-slate-500">
                              Lòd #{d.order_id}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                d.status === 'open'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {d.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-800 font-medium mt-1.5 line-clamp-2">{d.reason}</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {new Date(d.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Webhook className="text-indigo-600 w-5 h-5" /> Webhooks
                  </h2>
                  <button onClick={() => setSection('webhooks')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Jere →</button>
                </div>
                <div className="p-6">
                  {filteredEndpoints.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Pa gen webhook {mode}. Ajoute yon URL nan tab Webhooks (mòd {mode}).</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredEndpoints.map((ep) => (
                        <div key={ep.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-4 py-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${ep.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <code className="font-mono text-sm text-slate-800 truncate">{ep.url}</code>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ep.mode === 'test' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {ep.mode || 'live'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}


          {/* ============ API KEYS ============ */}
          {section === 'keys' && (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <KeyRound className="text-indigo-600 w-5 h-5" /> Secret keys (test + live)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    De kle diferan nan DB — tankou Stripe. <code className="font-mono">hx_sk_test_</code> pa janm fè peman live.
                  </p>
                </div>
                <div className="p-6 space-y-5">
                  {(['test', 'live'] as const).map((keyMode) => {
                    const row = keyMode === 'test' ? testKey : liveKey;
                    const revealed = revealedKeys[keyMode];
                    const showing = showKey[keyMode];
                    const isRotating = rotatingMode === keyMode;
                    return (
                      <div
                        key={keyMode}
                        className={`border rounded-xl p-4 ${keyMode === 'test' ? 'border-indigo-200 bg-indigo-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                          <label className={`text-xs font-bold uppercase tracking-wider ${keyMode === 'test' ? 'text-indigo-700' : 'text-emerald-700'}`}>
                            Secret key — {keyMode}
                          </label>
                          <button
                            onClick={() => handleRotateApiKey(keyMode)}
                            disabled={!!rotatingMode}
                            className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 bg-white hover:bg-slate-50 border border-gray-200 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                          >
                            {isRotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                            Rotate {keyMode}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-white border border-gray-200 p-3.5 rounded-xl">
                          <code className="flex-1 font-mono text-sm text-slate-800 break-all font-semibold">
                            {showing && revealed ? revealed : (row?.key_masked || maskGatewayApiKey(row?.key_prefix))}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              if (!revealed) {
                                alert(`Kle ${keyMode} konplè a pa estoke (hash sèlman). Klike "Rotate ${keyMode}" pou jwenn yon nouvo kle.`);
                                return;
                              }
                              setShowKey((prev) => ({ ...prev, [keyMode]: !prev[keyMode] }));
                            }}
                            className="p-2.5 bg-slate-50 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0"
                          >
                            {showing ? <EyeOff className="w-5 h-5 text-slate-500" /> : <Eye className="w-5 h-5 text-slate-400" />}
                          </button>
                          <button
                            onClick={() => {
                              if (!revealed) {
                                alert(`Rotate kle ${keyMode} pou kopye yon nouvo kle.`);
                                return;
                              }
                              handleCopy(revealed, keyMode);
                            }}
                            className="p-2.5 bg-slate-50 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0"
                          >
                            {copiedKey === keyMode ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400" />}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          {keyMode === 'test'
                            ? 'Sandbox MonCash — pa touche vre lajan. Prefiks: hx_sk_test_'
                            : 'Vre lajan MonCash. Prefiks: hx_sk_live_'}
                        </p>
                      </div>
                    );
                  })}

                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Publishable key</label>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Ekspoze — san danje</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 p-3.5 rounded-xl">
                      <code className="flex-1 font-mono text-sm text-indigo-600 break-all font-semibold">
                        {merchant?.api_key_pk || merchant?.api_key_pk_masked || maskPublishableKey(merchant?.api_key_pk_prefix)}
                      </code>
                      <button
                        onClick={() => handleCopy(merchant?.api_key_pk || '', 'pk')}
                        className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0 shadow-sm"
                      >
                        {copiedKey === 'pk' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <p className="text-sm font-medium leading-relaxed">
                      Pa janm mete kle sekrè nan frontend. Si ou te pèdi kle a, rotate sèlman mòd sa a —
                      lòt mòd la rete entak.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============ WEBHOOKS ============ */}
          {section === 'webhooks' && (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Webhook className="text-indigo-600 w-5 h-5" /> Webhooks
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Tankou Stripe: chak pwen gen mòd <strong>{mode}</strong> + secret <code className="font-mono">whsec_...</code>.
                    Peman test pa touche endpoint live (epi vice versa).
                  </p>
                </div>
                <div className="p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${mode === 'test' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      Nouvo endpoint ap kreye an mòd {mode}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://sit-ou.com/api/hatex-webhook"
                      className="lg:col-span-2 bg-white border border-gray-200 p-3.5 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-mono text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                      type="text"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Deskripsyon (opsyonèl)"
                      className="bg-white border border-gray-200 p-3.5 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    onClick={handleCreateEndpoint}
                    disabled={creatingEndpoint || !newUrl.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {creatingEndpoint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Ajoute Pwen ({mode})
                  </button>

                  <div className="mt-6">
                    {filteredEndpoints.length === 0 ? (
                      <p className="text-sm text-slate-400 italic text-center py-6">Pa gen pwen webhook pou mòd {mode}.</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredEndpoints.map((ep) => (
                          <div key={ep.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-200 rounded-xl p-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-block w-2 h-2 rounded-full ${ep.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${ep.mode === 'test' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                  {ep.mode || 'live'}
                                </span>
                              </div>
                              <code className="font-mono text-sm text-slate-800 break-all">{ep.url}</code>
                              <p className="text-xs text-slate-400 mt-1">{(ep.events || []).join(', ')}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleTestEndpoint(ep.id)}
                                disabled={busyEndpoint === ep.id}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-slate-50 disabled:opacity-50"
                                title="Voye tès ping"
                              >
                                {busyEndpoint === ep.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-indigo-600" />}
                              </button>
                              <button
                                onClick={() => handleRotateSecret(ep.id, ep.url)}
                                disabled={busyEndpoint === ep.id}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-slate-50 disabled:opacity-50"
                                title="Rotate secret"
                              >
                                <RotateCw className="w-4 h-4 text-slate-600" />
                              </button>
                              <button
                                onClick={() => handleDeleteEndpoint(ep.id)}
                                disabled={busyEndpoint === ep.id}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-red-50 disabled:opacity-50"
                                title="Efase"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============ LOGS ============ */}
          {section === 'logs' && (
            <>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <History className="text-indigo-600 w-5 h-5" /> Logs — Delivrans Webhook
                  </h2>
                </div>
                {deliveries.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-8">Ou poko gen okenn delivrans webhook.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-gray-200">
                          <th className="py-2.5 pr-4 font-bold pl-6">Evènman</th>
                          <th className="py-2.5 pr-4 font-bold">Estati</th>
                          <th className="py-2.5 pr-4 font-bold">Kòd</th>
                          <th className="py-2.5 pr-4 font-bold">Tantativ</th>
                          <th className="py-2.5 font-bold">Dat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((d) => (
                          <tr key={d.id} className="border-b border-gray-100">
                            <td className="py-2.5 pr-4 font-mono text-slate-700 pl-6">{d.event_type}</td>
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${d.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {d.success ? 'Reyisi' : 'Echwe'}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-slate-600">{d.response_status ?? '—'}</td>
                            <td className="py-2.5 pr-4 text-slate-600">{d.attempt_count}</td>
                            <td className="py-2.5 text-slate-500">{new Date(d.created_at).toLocaleString('fr-HT')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

        </main>
      </div>

      {/* MODAL SECRET (montre yon sèl fwa) */}
      {revealedSecret && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setRevealedSecret(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Secret Webhook</h3>
            <p className="text-sm text-slate-500 mb-4">Kopye secret sa a kounye a — nou p ap montre l ankò. Sèvi avè l pou verifye siyati HMAC SHA-256 la.</p>
            <p className="text-xs text-slate-400 mb-1 font-mono truncate">{revealedSecret.url}</p>
            <div className="flex items-center justify-between bg-slate-50 border border-gray-200 p-3.5 rounded-xl mb-5">
              <code className="font-mono text-sm text-indigo-600 break-all select-all font-semibold pr-3">{revealedSecret.secret}</code>
              <button onClick={() => handleCopy(revealedSecret.secret, 'reveal')} className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shrink-0" title="Kopye">
                {copiedKey === 'reveal' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
            <button onClick={() => setRevealedSecret(null)} className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all">Mwen kopye l</button>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}

