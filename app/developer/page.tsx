"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Terminal, Copy, CheckCircle2, ShieldAlert, Code2, Webhook, Loader2, Save, BookOpen, AlertCircle } from 'lucide-react';

export default function DeveloperDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingUrl, setSavingUrl] = useState(false);
  const [merchant, setMerchant] = useState<any>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const [activeTab, setActiveTab] = useState<'js' | 'php' | 'curl'>('js');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function loadDevData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      const { data } = await supabase
        .from('profiles')
        .select('is_merchant, api_key, webhook_secret, webhook_url')
        .eq('id', user.id)
        .single();

      if (!data?.is_merchant) {
        alert("Ou dwe konplete KYC Biznis la pou w jwenn aksè ak API a.");
        return router.push('/kyc');
      }

      setMerchant(data);
      setWebhookUrlInput(data.webhook_url || '');
      setLoading(false);
    }
    loadDevData();
  }, [supabase, router]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const handleSaveWebhook = async () => {
    if (!merchant) return;
    setSavingUrl(true);
    const { error } = await supabase
      .from('profiles')
      .update({ webhook_url: webhookUrlInput })
      .eq('api_key', merchant.api_key);
    
    setSavingUrl(false);
    if (!error) alert("Webhook URL sove avèk siksè!");
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Chajman...</p>
      </div>
    </div>
  );

  const codeSnippets = {
    js: `const response = await fetch('https://hatexcard.com/api/public/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${merchant?.api_key || 'hx_live_...'}',
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
  // Tranzaksyon an fèt otomatikman!
  console.log("Peman Reyisi! Ref:", data.transaction_id);
  alert("Peman pase avèk siksè. Kòb la debite.");
} else {
  alert("Erè: " + data.error);
}`,
    php: `<?php
$curl = curl_init();
curl_setopt_array($curl, array(
  CURLOPT_URL => 'https://hatexcard.com/api/public/payments',
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_ENCODING => '',
  CURLOPT_MAXREDIRS => 10,
  CURLOPT_TIMEOUT => 0,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
  CURLOPT_CUSTOMREQUEST => 'POST',
  CURLOPT_POSTFIELDS =>'{
    "amount": 1500,
    "currency": "HTG",
    "order_id": "CMD-123",
    "card_info": {
        "number": "0000 0000 0000 0000",
        "exp": "12/28",
        "cvv": "123"
    }
}',
  CURLOPT_HTTPHEADER => array(
    'Authorization: Bearer ${merchant?.api_key || 'hx_live_...'}',
    'Content-Type: application/json'
  ),
));
$response = curl_exec($curl);
curl_close($curl);
echo $response;
?>`,
    curl: `curl --request POST \\
  --url https://hatexcard.com/api/public/payments \\
  --header 'Authorization: Bearer ${merchant?.api_key || 'hx_live_...'}' \\
  --header 'Content-Type: application/json' \\
  --data '{
    "amount": 1500,
    "currency": "HTG",
    "order_id": "CMD-123",
    "card_info": {
      "number": "0000 0000 0000 0000",
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
            <p className="text-slate-500 mt-2 text-sm md:text-base font-medium">Entegre Hatexcard sou lòt aplikasyon ak sit ki pa sèvi ak WordPress.</p>
          </div>
          
          <button 
            onClick={() => router.push('/developer/docs')}
            className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-6 py-3 rounded-xl font-bold transition-all shadow-sm w-full md:w-auto"
          >
            <BookOpen className="w-5 h-5" />
            <span className="uppercase tracking-wider text-[11px]">Gade Dokimantasyon an</span>
          </button>
        </div>

        {/* Bwat KLE SEKRE A */}
        <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-sm">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">Kle Prive (Secret Key)</label>
          <div className="flex items-center justify-between bg-slate-50 border border-gray-200 p-4 rounded-xl">
            <code className="font-mono text-sm md:text-base text-indigo-600 break-all select-all font-semibold">
              {merchant?.api_key}
            </code>
            <button 
              onClick={() => handleCopy(merchant?.api_key, 'api')} 
              className="ml-4 p-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0 shadow-sm"
              title="Kopye Kle a"
            >
              {copiedKey === 'api' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-slate-400 hover:text-indigo-600" />}
            </button>
          </div>
          <div className="mt-4 flex items-start gap-3 bg-amber-50 p-4 rounded-xl border border-amber-200 text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1">ATANSYON</p>
              <p className="text-sm font-medium leading-relaxed">
                Kle sa a pèmèt trete tranzaksyon reyèl. Kenbe l an sekirite epi pa janm pataje l nan kòd piblik (tankou GitHub oswa nan kòd Frontend lan).
              </p>
            </div>
          </div>
        </div>

        {/* Bwat WEBHOOK LA */}
        <div className="bg-white border border-gray-200 p-6 sm:p-8 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Webhook className="text-indigo-600 w-6 h-6" />
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Konfigirasyon Webhook</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">Webhook URL (Kote nou voye alèt la)</label>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder="https://sit-ou.com/api/hatex-webhook"
                  className="flex-1 bg-slate-50 border border-gray-200 p-3.5 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-mono text-slate-900 placeholder:text-slate-400 transition-shadow"
                />
                <button 
                  onClick={handleSaveWebhook}
                  disabled={savingUrl}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all disabled:opacity-50 flex items-center justify-center shadow-sm"
                  title="Sove URL la"
                >
                  {savingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">Egzanp: https://sit-ou.com/api/hatex-webhook</p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">Webhook Secret (Pou verifye siyati a)</label>
              <div className="flex items-center justify-between bg-slate-50 border border-gray-200 p-3.5 rounded-xl">
                <code className="font-mono text-sm text-slate-600 font-semibold truncate pr-4">
                  {merchant?.webhook_secret ? 'whsec_••••••••••••••••' : 'Poko pwodwi'}
                </code>
                <button 
                  onClick={() => handleCopy(merchant?.webhook_secret, 'webhook')} 
                  className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors shrink-0 shadow-sm"
                  title="Kopye Secret la"
                >
                  {copiedKey === 'webhook' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400 hover:text-indigo-600" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 font-medium">Sèvi ak kòd sa a pou verifye HMAC SHA-256 la.</p>
            </div>
          </div>
        </div>

        {/* Bwat EGZANP KÒD LA */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Code2 className="text-indigo-600 w-5 h-5" /> Egzanp Kòd Peman & Sekirite
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