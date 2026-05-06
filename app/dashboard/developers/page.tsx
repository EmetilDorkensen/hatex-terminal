'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff, Terminal, CheckCircle2 } from 'lucide-react';

// Si w ap mete l nan yon paj ki deja gen enfòmasyon 'profile' la, ou jis pase l kòm prop
export default function DeveloperAPISection({ profile }: { profile: any }) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (profile?.api_key) {
      navigator.clipboard.writeText(profile.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const apiSnippet = `// Egzanp Entegrasyon API HatexCard (Node.js / Frontend)
const response = await fetch('https://hatexcard.com/api/public/payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${profile?.api_key || 'KLE_SEKRÈ_OU_A_LA'}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 2500, // Montan an HTG
    currency: 'HTG',
    order_id: 'CMD-98765',
    card_info: {
       number: '0000 0000 0000 0000',
       exp: '12/28',
       cvv: '123'
    }
  })
});

const data = await response.json();
console.log(data);`;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Terminal className="text-green-600" size={28} />
          Devlopè & API
        </h2>
        <p className="text-gray-500 mt-2">
          Entegre sistèm peman HatexCard la sou nenpòt sit oswa aplikasyon mobil w ap bati ak API piblik nou an.
        </p>
      </div>

      {/* SEKSYON KLE API A */}
      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Kle Prive (Secret API Key)</h3>
        <p className="text-sm text-gray-500 mb-4">
          Kle sa a se paspò w. Pa janm pataje l nan piblik oswa nan kòd ki aksesib pou tout moun.
        </p>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type={showKey ? "text" : "password"}
              readOnly
              value={profile?.api_key || "hx_live_........................... "}
              className="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-md focus:ring-green-500 focus:border-green-500 block p-3 pr-10 font-mono"
            />
            <button 
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-3 rounded-md transition-all font-medium text-sm"
          >
            {copied ? <CheckCircle2 size={18} className="text-green-400" /> : <Copy size={18} />}
            {copied ? 'Kopye!' : 'Kopye Kle a'}
          </button>
        </div>
      </div>

      {/* SEKSYON KÒD EGZANP LAN */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Kòman pou w kòmanse (Quick Start)</h3>
        <p className="text-sm text-gray-500 mb-4">
          Men yon egzanp kòd Javascript (`fetch`) pou w wè kòman pou w voye yon tranzaksyon sou sèvè nou an:
        </p>
        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
            <code>{apiSnippet}</code>
          </pre>
        </div>
      </div>

    </div>
  );
}