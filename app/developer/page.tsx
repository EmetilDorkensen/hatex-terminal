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
import { maskApiKey, maskPublishableKey } from '@/lib/security/api-key';

const AVAILABLE_EVENTS = ['payment.success'];

type Section = 'overview' | 'keys' | 'webhooks' | 'logs';

export default function DeveloperDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; missingKyc: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [activeTab, setActiveTab] = useState<'js' | 'php' | 'curl'>('js');
  const [section, setSection] = useState<Section>('overview');
  const [mode, setMode] = useState<'test' | 'live'>('live');
  const [togglingMode, setTogglingMode] = useState(false);

  // Webhook endpoints state
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creatingEndpoint, setCreatingEndpoint] = useState(false);
  const [busyEndpoint, setBusyEndpoint] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ url: string; secret: string } | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);

  // Litij / rapò kliyan sou peman machann (spec §5)
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputeLoading, setDisputeLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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

  const loadMode = async () => {
    try {
      const res = await fetch('/api/developer/mode');
      if (res.ok) {
        const data = await res.json();
        if (data.mode === 'test' || data.mode === 'live') setMode(data.mode);
      }
    } catch {
      /* default live */
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
          .select('id, kyc_status, is_card_activated')
          .eq('id', user.id)
          .maybeSingle();
        if (data) {
          elig = checkMerchantEligibility(data as any);
          profileData = data;
        }
      }

      if (elig && elig.eligible && profileData) {
        let apiKeyPrefix = profileData.api_key_prefix || null;
        let apiKeyMasked = maskApiKey(apiKeyPrefix);
        let pkPrefix = profileData.api_key_pk_prefix || null;
        let pk = profileData.api_key_pk || null;
        let isMerchant = profileData.is_merchant === true;
        let webhookSecret = profileData.webhook_secret;

        try {
          const provRes = await fetch('/api/developer/provision', { method: 'POST' });
          if (provRes.ok) {
            const prov = await provRes.json();
            apiKeyPrefix = prov.api_key_prefix ?? apiKeyPrefix;
            apiKeyMasked = prov.api_key_masked ?? apiKeyMasked;
            pkPrefix = prov.api_key_pk_prefix ?? pkPrefix;
            pk = prov.api_key_pk ?? pk;
            isMerchant = prov.is_merchant ?? isMerchant;
            webhookSecret = prov.webhook_secret ?? webhookSecret;
            if (prov.api_key) {
              setRevealedApiKey(prov.api_key);
              setShowApiKey(true);
            }
          }
        } catch {
          /* fallback deja nan eligibility */
        }

        setMerchant({
          ...profileData,
          api_key_prefix: apiKeyPrefix,
          api_key_masked: apiKeyMasked,
          api_key_pk: pk,
          api_key_pk_prefix: pkPrefix,
          api_key_pk_masked: pk ? pk : maskPublishableKey(pkPrefix),
          is_merchant: isMerchant,
          webhook_secret: webhookSecret,
        });
        await loadWebhooks();
        await loadMode();
        void loadDisputes();
      } else {
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

  const handleToggleMode = async (next: 'test' | 'live') => {
    if (next === mode) return;
    if (next === 'live') {
      const ok = window.confirm(
        'Ou pral aktive mòd LIVE — peman ap fèt ak VRE LAJAN sou MonCash. Ou sèten?'
      );
      if (!ok) return;
    }
    setTogglingMode(true);
    try {
      const res = await fetch('/api/developer/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè.');
      setMode(next);
      if (data.message) alert(data.message);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTogglingMode(false);
    }
  };

  const handleCreateEndpoint = async () => {
    if (!newUrl.trim()) return;
    setCreatingEndpoint(true);
    try {
      const res = await fetch('/api/developer/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim(), description: newDesc.trim(), events: AVAILABLE_EVENTS }),
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

  const handleRotateApiKey = async () => {
    if (!window.confirm('Ou pral jenere yon NOUVO kle API. Ansyen kle a pa mache ankò. Kontinye?')) return;
    setRotatingKey(true);
    try {
      const res = await fetch('/api/developer/api-key/rotate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erè');
      setRevealedApiKey(data.api_key);
      setShowApiKey(true);
      setMerchant((prev: any) => ({
        ...prev,
        api_key_prefix: data.api_key_prefix,
        api_key_masked: data.api_key_masked,
        api_key_pk: data.api_key_pk || prev?.api_key_pk,
        api_key_pk_prefix: data.api_key_pk_prefix || prev?.api_key_pk_prefix,
      }));
      alert(data.message || 'Yo jenere yon nouvo kle API.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRotatingKey(false);
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

  // Kle FIKTIF pou egzanp — pa janm itilize yo pou vre lajan.
  // Mòd TEST sèvi yon kle tès APA (hx_sk_test_...); mòd LIVE sèvi kle live la (hx_live_...).
  const TEST_SNIPPET_KEY = 'hx_sk_test_KLE_TÈS_OU';
  const LIVE_SNIPPET_KEY = 'hx_live_KLE_OU_LA';
  const snippetKey = mode === 'test' ? TEST_SNIPPET_KEY : LIVE_SNIPPET_KEY;

  const codeSnippets = {
    js: `// ⚠️ Sèlman sou SÈVÈ ou a — pa nan navigatè kliyan an
// Kreye sesyon checkout — kliyan peye MonCash
const response = await fetch('https://hatexcard.com/api/moncash/payments', {
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
    customer_phone: '509xxxxxxxx', // nimewo MonCash kliyan an (telefòn-premye / USSD)
    flow: 'auto' // 'auto' | 'redirect' | 'ussd'
  })
});
const data = await response.json();
// data.payment_id    → swiv peman an
// data.checkout_mode → 'hosted' (paj MonCash) oswa 'ussd' (USSD sou telefòn kliyan an)
// data.checkout_url  → si 'hosted', louvri li nan yon lòt onglet epi swiv estati a`,
    php: `<?php
// ⚠️ Sèlman sou sèvè PHP ou a
$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => 'https://hatexcard.com/api/moncash/payments',
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
    curl: `# ⚠️ Sèlman depi sèvè ou a (pa navigatè)
curl --request POST \\
  --url https://hatexcard.com/api/moncash/payments \\
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
            {/* TOGGLE TEST / LIVE — estil Stripe */}
            <div className="flex items-center bg-slate-100 border border-gray-200 rounded-full p-1">
              <button
                onClick={() => handleToggleMode('test')}
                disabled={togglingMode}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'test' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Test
              </button>
              <button
                onClick={() => handleToggleMode('live')}
                disabled={togglingMode}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'live' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Live
              </button>
            </div>
            {togglingMode && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
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
                      Kopye <strong>kle sekrè</strong> ou nan tab <strong>API keys</strong>. Li lye ak kont ou — tout peman yo ale sou MonCash ou.
                    </li>
                    <li>
                      Sou <strong>sèvè ou a</strong>, kreye yon peman ak{' '}
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">POST /api/moncash/payments</code>{' '}
                      ak Bearer token (oswa plugin HatexCard).
                    </li>
                    <li>
                      Kliyan an peye sou <strong>checkout MonCash</strong>. Ou swiv estati a ak{' '}
                      <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">payment_id</code> oswa nan webhook.
                    </li>
                    <li>
                      Konfigire <strong>webhook</strong> pou <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-xs">payment.success</code> nan tab Webhooks.
                    </li>
                  </ol>

                  <div className="mt-5 flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                    <Zap className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-indigo-900 font-medium leading-relaxed">
                      Mòd <strong>{activeModeLabel}</strong> aktif. {mode === 'test'
                        ? 'Peman yo ale nan sandbox MonCash — yo pa touche vre lajan. Chanje an Live lè ou pare.'
                        : 'Peman yo fèt ak vre lajan sou MonCash. Pa kenbe kle a nan frontend.'}
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
                        {mode === 'test' ? 'Kle tès (fiktif) — apa de kle live' : 'Kle live (fiktif)'}
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
                        ? 'Kle tès sa a voye peman an nan sandbox MonCash — PA GEN VRE LAJAN. Lè ou chanje an Live, egzanp lan ap sèvi ak kle live a.'
                        : 'Kle live sa a voye VRE LAJAN sou MonCash. Pa janm mete l nan frontend — sèlman sou sèvè ou a.'}
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
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Publishable key</span>
                    <code className="font-mono text-sm text-indigo-600 break-all">{merchant?.api_key_pk || merchant?.api_key_pk_masked || maskPublishableKey(merchant?.api_key_pk_prefix)}</code>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Secret key</span>
                    <code className="font-mono text-sm text-indigo-600 break-all">{merchant?.api_key_masked || maskApiKey(merchant?.api_key_prefix)}</code>
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
                  {endpoints.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Ou poko gen okenn pwen webhook. Ajoute yon URL pou resevwa notifikasyon <code className="font-mono text-xs">payment.success</code>.</p>
                  ) : (
                    <div className="space-y-2">
                      {endpoints.map((ep) => (
                        <div key={ep.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl px-4 py-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${ep.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            <code className="font-mono text-sm text-slate-800 truncate">{ep.url}</code>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{(ep.events || []).join(', ')}</span>
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
                    <KeyRound className="text-indigo-600 w-5 h-5" /> Standard keys
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Mòd: <strong>{activeModeLabel}</strong></p>
                </div>
                <div className="p-6 space-y-5">

                  {/* PUBLISHABLE KEY */}
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
                        title="Kopye publishable key"
                      >
                        {copiedKey === 'pk' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      Ka parèt nan frontend/navigatè. Itilize li pou checkout kliyan an — li pa janm gen aksè pou modifikasyon.
                    </p>

                  </div>


                  {/* SECRET KEY */}
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Secret key</label>
                      <button
                        onClick={handleRotateApiKey}
                        disabled={rotatingKey}
                        className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
                      >
                        {rotatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                        Rotate kle
                      </button>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 p-3.5 rounded-xl">
                      <code className="flex-1 font-mono text-sm text-indigo-600 break-all font-semibold">
                        {showApiKey && revealedApiKey ? revealedApiKey : (merchant?.api_key_masked || maskApiKey(merchant?.api_key_prefix))}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          if (!revealedApiKey) {
                            alert('Kle konplè a pa estoke sou sèvè a (hash sèlman). Klike "Rotate kle" pou jwenn yon nouvo kle.');
                            return;
                          }
                          setShowApiKey(!showApiKey);
                        }}
                        className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0 shadow-sm"
                        title={showApiKey ? 'Kache kle a' : 'Montre kle a'}
                      >
                        {showApiKey ? <EyeOff className="w-5 h-5 text-slate-500" /> : <Eye className="w-5 h-5 text-slate-400" />}
                      </button>
                      <button
                        onClick={() => {
                          if (!revealedApiKey) {
                            alert('Rotate kle a pou kopye yon nouvo kle.');
                            return;
                          }
                          handleCopy(revealedApiKey, 'api');
                        }}
                        className="p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0 shadow-sm"
                        title="Kopye kle a"
                      >
                        {copiedKey === 'api' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400 hover:text-indigo-600" />}
                      </button>
                    </div>
                    <div className="mt-3 flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider mb-1">ATANSYON</p>
                        <p className="text-sm font-medium leading-relaxed">
                          Kle sekrè a bay aksè total sou API a. Pa janm mete l nan GitHub, frontend, oswa
                          screenshot. Egzanp yo sèvi ak kle FIKTIF: <code className="bg-amber-100 px-1 rounded">hx_live_KLE_OU_LA</code> pou
                          LIVE, <code className="bg-amber-100 px-1 rounded">hx_sk_test_KLE_TÈS_OU</code> pou TEST. Kole kle reyèl la
                          sèlman sou sèvè ou a.
                        </p>
                      </div>
                    </div>
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
                  <p className="text-xs text-slate-500 mt-1">Resevwa notifikasyon evènman sou sèvè ou a — chak pwen gen yon secret <code className="font-mono">whsec_...</code>.</p>
                </div>
                <div className="p-6">
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
                    Ajoute Pwen
                  </button>

                  <div className="mt-6">
                    {endpoints.length === 0 ? (
                      <p className="text-sm text-slate-400 italic text-center py-6">Ou poko gen okenn pwen webhook.</p>
                    ) : (
                      <div className="space-y-3">
                        {endpoints.map((ep) => (
                          <div key={ep.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-gray-200 rounded-xl p-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block w-2 h-2 rounded-full ${ep.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <code className="font-mono text-sm text-slate-800 truncate">{ep.url}</code>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{(ep.events || []).join(', ')} {ep.description ? `· ${ep.description}` : ''}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => handleTestEndpoint(ep.id)} disabled={busyEndpoint === ep.id} className="p-2 bg-white hover:bg-slate-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50" title="Voye tès">
                                {busyEndpoint === ep.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : <Send className="w-4 h-4 text-indigo-600" />}
                              </button>
                              <button onClick={() => handleRotateSecret(ep.id, ep.url)} disabled={busyEndpoint === ep.id} className="p-2 bg-white hover:bg-slate-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50" title="Wotasyon secret">
                                <RotateCw className="w-4 h-4 text-amber-600" />
                              </button>
                              <button onClick={() => handleDeleteEndpoint(ep.id)} disabled={busyEndpoint === ep.id} className="p-2 bg-white hover:bg-red-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50" title="Efase">
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

