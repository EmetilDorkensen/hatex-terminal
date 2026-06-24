"use client";

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
// Nou ajoute BookOpen isit la pou ikon bouton dokimantasyon an
import { Terminal, Copy, CheckCircle2, ShieldAlert, Code2, Webhook, Loader2, Save, BookOpen } from 'lucide-react';

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

  if (loading) return <div className="min-h-screen bg-[#06070d] flex items-center justify-center"><Loader2 className="animate-spin text-red-600" /></div>;

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
    <div className="min-h-screen bg-[#05060A] text-white p-6 md:p-12 font-sans selection:bg-red-600/30">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* EN-TÈT AK BOUTON DOKIMANTASYON AN */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter flex items-center gap-4">
              <Terminal className="text-red-600 w-10 h-10" />
              API Piblik & Kle Sekrè
            </h1>
            <p className="text-zinc-400 mt-2 text-lg">Entegre Hatexcard sou lòt aplikasyon ak sit ki pa sèvi ak WordPress.</p>
          </div>
          
          <button 
            onClick={() => router.push('/developer/docs')}
            className="flex items-center justify-center gap-2 bg-[#1a1d2d] hover:bg-[#23273b] border border-white/10 text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-black/50 w-full md:w-auto"
          >
            <BookOpen className="w-5 h-5 text-blue-400" />
            <span className="uppercase tracking-widest text-[11px] font-black">Gade Dokimantasyon an</span>
          </button>
        </div>

        {/* Bwat KLE SEKRE A */}
        <div className="bg-[#0C0D14] border border-white/5 p-8 rounded-3xl shadow-xl">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 block">Kle Prive (Secret Key)</label>
          <div className="flex items-center justify-between bg-black border border-white/10 p-5 rounded-2xl">
            <code className="font-mono text-sm md:text-base text-red-400 break-all">{merchant?.api_key}</code>
            <button 
              onClick={() => handleCopy(merchant?.api_key, 'api')} 
              className="ml-4 p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-all shrink-0"
            >
              {copiedKey === 'api' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-zinc-400" />}
            </button>
          </div>
          <div className="mt-4 flex items-start gap-2 text-[10px] text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <p><strong>ATANSYON:</strong> Kle sa a pèmèt trete tranzaksyon reyèl. Kenbe l an sekirite epi pa janm pataje l nan kòd piblik (tankou GitHub).</p>
          </div>
        </div>

        {/* Bwat WEBHOOK LA */}
        <div className="bg-[#0C0D14] border border-white/5 p-8 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <Webhook className="text-blue-500 w-6 h-6" />
            <h2 className="text-xl font-black uppercase tracking-widest">Konfigirasyon Webhook</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 block">Webhook URL (Kote nou voye alèt la)</label>
              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder="https://hatexcard.com/api/hatex-webhook"
                  className="flex-1 bg-black border border-white/10 p-4 rounded-xl outline-none focus:border-blue-500 text-sm font-mono"
                />
                <button 
                  onClick={handleSaveWebhook}
                  disabled={savingUrl}
                  className="bg-blue-600 hover:bg-blue-500 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  {savingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3 block">Webhook Secret (Pou verifye siyati a)</label>
              <div className="flex items-center justify-between bg-black border border-white/10 p-4 rounded-xl">
                <code className="font-mono text-sm text-zinc-300 truncate pr-4">
                  {merchant?.webhook_secret ? 'whsec_••••••••••••••••' : 'Poko pwodwi'}
                </code>
                <button 
                  onClick={() => handleCopy(merchant?.webhook_secret, 'webhook')} 
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  {copiedKey === 'webhook' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bwat EGZANP KÒD LA */}
        <div className="bg-[#0C0D14] border border-white/5 rounded-3xl shadow-xl overflow-hidden">
          <div className="bg-[#11131c] border-b border-white/5 flex items-center justify-between p-4">
            <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Code2 className="text-zinc-500 w-5 h-5" /> Egzanp Kòd Peman & Sekirite
            </h2>
            <div className="flex gap-2">
              {(['js', 'php', 'curl'] as const).map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {tab === 'js' ? 'Node/JS' : tab}
                </button>
              ))}
            </div>
          </div>
          
          <div className="relative group">
            <pre className="p-6 overflow-x-auto text-sm font-mono text-green-400 bg-black m-0 custom-scrollbar">
              <code>{codeSnippets[activeTab]}</code>
            </pre>
            <button 
              onClick={() => handleCopy(codeSnippets[activeTab], 'code')}
              className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all opacity-0 group-hover:opacity-100 backdrop-blur-md"
            >
              {copiedKey === 'code' ? <CheckCircle2 className="w-5 h-5 text-white" /> : <Copy className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}