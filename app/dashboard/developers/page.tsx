'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Terminal, CheckCircle2, ExternalLink } from 'lucide-react';
import { maskApiKey } from '@/lib/security/api-key-display';

/**
 * Seksyon API sou dashboard — pa montre kle an klè.
 * Jenerasyon / rotate fèt sèlman sou /developer via API sèvè.
 */
export default function DeveloperAPISection({
  profile,
}: {
  profile: { api_key_prefix?: string | null; has_api_key?: boolean } | null;
}) {
  const [copied, setCopied] = useState(false);
  const masked = maskApiKey(profile?.api_key_prefix);

  const handleCopy = () => {
    navigator.clipboard.writeText(masked);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const apiSnippet = `// Egzanp Entegrasyon API HatexCard (Node.js)
// Itilize SECRET KEY ou (hx_live_...) — janm nan frontend piblik.
const response = await fetch('https://hatexcard.com/api/public/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer KLE_SEKRÈ_OU_A_LA',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 2500,
    currency: 'HTG',
    order_id: 'CMD-98765',
    payment_method: 'moncash'
  })
});

const data = await response.json();
console.log(data);`;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Terminal className="text-indigo-600" />
          API Developer
        </h2>
        <p className="text-gray-500 mt-2 text-sm">
          Kle sekrè yo pa montre an klè isit la. Jere yo nan{' '}
          <Link href="/developer" className="text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1">
            Terminal Devlopè <ExternalLink size={12} />
          </Link>
          .
        </p>
      </div>

      <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Kle (maske)</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm text-slate-700 break-all">{masked}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="p-2 rounded-lg border border-slate-200 hover:bg-white text-slate-600"
            title="Kopi mask"
          >
            {copied ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs overflow-x-auto">
        <code>{apiSnippet}</code>
      </pre>
    </div>
  );
}
