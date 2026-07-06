"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Terminal, Copy, CheckCircle2, ShieldAlert, Code2, Webhook, Loader2, Save, BookOpen, AlertCircle, Plus, Send, RotateCw, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';
import { maskApiKey } from '@/lib/security/api-key';

const AVAILABLE_EVENTS = ['payment.success'];

export default function DeveloperDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; missingKyc: boolean; missingCardActivation: boolean } | null>(null);
  const [copiedKey, setCopiedKey] = useState('');
  const [activeTab, setActiveTab] = useState<'js' | 'php' | 'curl'>('js');

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

  useEffect(() => {
    async function loadDevData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      let elig: { eligible: boolean; missingKyc: boolean; missingCardActivation: boolean } | null = null;
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
          .single();

        if (data) {
          profileData = data;
          elig = checkMerchantEligibility(data);
        }
      }

      if (!elig || !profileData) {
        setLoading(false);
        return;
      }

      setEligibility(elig);

      if (elig.eligible) {
        let apiKeyPrefix = profileData.api_key_prefix || null;
        let apiKeyMasked = profileData.api_key_masked || maskApiKey(apiKeyPrefix);
        let isMerchant = profileData.is_merchant;
        let webhookSecret = profileData.webhook_secret;
        let plainKeyOnce: string | null = null;

        try {
          const provRes = await fetch('/api/developer/provision', { method: 'POST' });
          if (provRes.ok) {
            const prov = await provRes.json();
            apiKeyPrefix = prov.api_key_prefix ?? apiKeyPrefix;
            apiKeyMasked = prov.api_key_masked ?? maskApiKey(apiKeyPrefix);
            isMerchant = prov.is_merchant ?? isMerchant;
            webhookSecret = prov.webhook_secret ?? webhookSecret;
            if (prov.api_key) {
              plainKeyOnce = prov.api_key;
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
          is_merchant: isMerchant,
          webhook_secret: webhookSecret,
        });
        if (plainKeyOnce) setRevealedApiKey(plainKeyOnce);
        await loadWebhooks();
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

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Chajman...</p>
      </div>
    </div>
  );

  // Kont ki verifye elijib epi ki pa pase: montre kisa ki manke.
  if (eligibility !== null && !eligibility.eligible) {
    return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans p-4">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-7 h-7 text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Aksè API poko disponib</h1>
        <p className="text-sm text-slate-500 mb-6">Pou jwenn kle API w la otomatikman, ou dwe konplete toude etap sa yo:</p>
        <div className="space-y-3 text-left mb-6">
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${eligibility?.missingKyc ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            {eligibility?.missingKyc ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
            <span className="text-sm font-semibold text-slate-700">Verifikasyon ID (KYC kont ou) apwouve</span>
          </div>
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${eligibility?.missingCardActivation ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            {eligibility?.missingCardActivation ? <AlertCircle className="w-5 h-5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
            <span className="text-sm font-semibold text-slate-700">Frè aktivasyon Kat Vityèl peye (nan frè KYC 1150 HTG)</span>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {eligibility?.missingKyc && (
            <button onClick={() => router.push('/kyc')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all">Konplete Verifikasyon ID (KYC)</button>
          )}
          {eligibility?.missingCardActivation && (
            <button onClick={() => router.push('/kat')} className="w-full bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all">Aktive Kat Vityèl</button>
          )}
        </div>
      </div>
    </div>
    );
  }

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
      }));
      alert(data.message || 'Nouvo kle API jenere.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRotatingKey(false);
    }
  };

  const snippetKey = 'hx_live_KLE_OU_LA'; // Ranplase ak kle ou a (kopye nan /developer)

  const codeSnippets = {
    js: `// ⚠️ Sèlman sou SÈVÈ ou a — pa nan navigatè kliyan an
const response = await fetch('https://hatexcard.com/api/public/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${snippetKey}',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'CMD-123-v1' // inik pou chak kòmand
  },
  body: JSON.stringify({
    amount: 1500,
    currency: 'HTG',
    order_id: 'CMD-123',
    card_info: {
      number: '0000111122223333', // 16 chif, kat KLIYAN (pa menm kont ak machann)
      exp: '12/28',
      cvv: '123'
    }
  })
});
const data = await response.json();

if (data.success) {
  console.log('Reyisi:', data.transaction_id, 'debite:', data.debited_from);
} else {
  console.error('Erè:', data.error);
  // Si fon ensifizan: data.balances.card_htg, data.balances.wallet_htg
}`,
    php: `<?php
// ⚠️ Sèlman sou sèvè PHP ou a
$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => 'https://hatexcard.com/api/public/payments',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS => json_encode([
    'amount' => 1500,
    'currency' => 'HTG',
    'order_id' => 'CMD-123',
    'card_info' => [
      'number' => '0000111122223333',
      'exp' => '12/28',
      'cvv' => '123'
    ]
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
  --url https://hatexcard.com/api/public/payments \\
  --header 'Authorization: Bearer ${snippetKey}' \\
  --header 'Content-Type: application/json' \\
  --header 'Idempotency-Key: CMD-123-v1' \\
  --data '{
    "amount": 1500,
    "currency": "HTG",
    "order_id": "CMD-123",
    "card_info": {
      "number": "0000111122223333",
      "exp": "12/28",
      "cvv": "123"
    }
  }'`
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* EN-TÈT AK BOUTON DOKIMANTASYON AN */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <Terminal className="text-indigo-600 w-8 h-8" />
              API Piblik & Kle Sekrè
            </h1>
            <p className="text-slate-500 mt-2 text-sm md:text-base font-medium">
              Entegre HatexCard sou sèvè ou a (PHP, Node, Python). Pa mete kle API nan frontend.
            </p>
          </div>
          
          <button 
            onClick={() => router.push('/developer/docs')}
            className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full md:w-auto"
          >
            <BookOpen className="w-5 h-5" />
            <span className="uppercase tracking-wider text-[11px]">Gade Dokimantasyon an</span>
          </button>
        </div>

        {/* Gid entegrasyon rapid */}
        <div className="bg-indigo-50 border border-indigo-200 p-6 rounded-2xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-800 mb-3">Gid entegrasyon</h2>
          <ol className="text-sm text-indigo-900 space-y-2 list-decimal list-inside font-medium">
            <li>Kopye kle API ou anba a (oswa rotate pou yon nouvo kle).</li>
            <li>Sou <strong>sèvè ou a</strong>, voye <code className="bg-white px-1 rounded">POST https://hatexcard.com/api/public/payments</code> ak Bearer token.</li>
            <li>Itilize <code className="bg-white px-1 rounded">Idempotency-Key</code> inik pou chak kòmand.</li>
            <li>Pou teste: machann (kle API) ak kliyan (kat) dwe <strong>2 kont diferan</strong>.</li>
            <li>Gade <button type="button" onClick={() => router.push('/developer/docs')} className="underline text-indigo-700 font-bold">dokimantasyon konplè</button> pou repons erè, webhook, ak limit yo.</li>
          </ol>
        </div>

        {/* Bwat KLE SEKRE A */}
        <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Kle Prive (Secret Key)</label>
            <button
              onClick={handleRotateApiKey}
              disabled={rotatingKey}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {rotatingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
              Rotate kle
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 p-4 rounded-xl">
            <code className="flex-1 font-mono text-sm md:text-base text-indigo-600 break-all font-semibold">
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
          <div className="mt-4 flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1">ATANSYON</p>
              <p className="text-sm font-medium leading-relaxed">
                Kle API a pa dwe parèt nan GitHub, frontend, oswa screenshot piblik. Sèvi ak placeholder <code className="bg-amber-100 px-1 rounded">hx_live_KLE_OU_LA</code> nan egzanp kòd — kole kle reyèl la sèlman sou sèvè ou a.
              </p>
            </div>
          </div>
        </div>

        {/* Bwat WEBHOOK ENDPOINTS (milti-pwen, estil Stripe) */}
        <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Webhook className="text-indigo-600 w-6 h-6" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Pwen Webhook</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6 font-medium">Nou voye yon evènman siyen (HMAC SHA-256) sou chak URL lè yon peman reyisi. Chak pwen gen pwòp secret pa li.</p>

          {/* Fòm ajoute yon pwen */}
          <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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
              className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[11px] tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {creatingEndpoint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajoute Pwen
            </button>
            <p className="text-xs text-slate-500 mt-2 font-medium">URL la dwe an HTTPS. Evènman: {AVAILABLE_EVENTS.join(', ')}.</p>
          </div>

          {/* Lis pwen yo */}
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

        {/* Bwat DELIVRANS RESAN */}
        <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <ExternalLink className="text-indigo-600 w-6 h-6" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Delivrans Resan</h2>
          </div>
          {deliveries.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">Poko gen okenn delivrans webhook.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-gray-200">
                    <th className="py-2 pr-4 font-bold">Evènman</th>
                    <th className="py-2 pr-4 font-bold">Estati</th>
                    <th className="py-2 pr-4 font-bold">Kòd</th>
                    <th className="py-2 pr-4 font-bold">Tantativ</th>
                    <th className="py-2 font-bold">Dat</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100">
                      <td className="py-2.5 pr-4 font-mono text-slate-700">{d.event_type}</td>
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

        {/* Bwat EGZANP KÒD LA */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Code2 className="text-indigo-600 w-5 h-5" /> Egzanp Kòd (ranplase hx_live_KLE_OU_LA)
            </h2>
            <div className="flex gap-2">
              {(['js', 'php', 'curl'] as const).map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-white text-slate-500 hover:text-indigo-600 border border-gray-200 shadow-sm'}`}
                >
                  {tab === 'js' ? 'Node/JS' : tab}
                </button>
              ))}
            </div>
          </div>
          
          <div className="relative group bg-slate-900">
            <pre className="p-6 overflow-x-auto text-sm font-mono text-emerald-400 m-0 custom-scrollbar leading-relaxed">
              <code>{codeSnippets[activeTab]}</code>
            </pre>
            <button 
              onClick={() => handleCopy(codeSnippets[activeTab], 'code')}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
              title="Kopye Kòd la"
            >
              {copiedKey === 'code' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}