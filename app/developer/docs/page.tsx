'use client';

import React from 'react';
import { Terminal, ShieldCheck, CreditCard, Webhook, CheckCircle2 } from 'lucide-react';

export default function HatexcardDocs() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="border-b border-gray-800 pb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Dokimantasyon Devlopè</h1>
          <p className="text-gray-400 text-lg">
            Byenvini sou API Hatexcard la. Gid sa a ap ede w entegre sistèm peman nou an sou sit entènèt ou a nan kèk minit.
          </p>
        </div>

        {/* Etap 1: Otantifikasyon */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            <h2 className="text-2xl font-semibold text-white">1. Otantifikasyon</h2>
          </div>
          <p className="text-gray-400">
            Pou kominike avèk API nou an, ou dwe voye Kle API ou a (API Key) nan tèt (Header) chak rekèt ou fè. Ou ka jwenn kle sa a nan tablodbò w la.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 font-mono text-sm">
            <span className="text-pink-500">Authorization</span>: Bearer hx_live_KLE_OU_A_ISIT
          </div>
        </section>

        {/* Etap 2: Fè yon Peman */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-8 h-8 text-green-500" />
            <h2 className="text-2xl font-semibold text-white">2. Kreye yon Peman (Charge)</h2>
          </div>
          <p className="text-gray-400">
            Pou chaje yon kliyan, fè yon rekèt <code className="bg-gray-800 px-1 py-0.5 rounded text-yellow-400">POST</code> sou adrès sa a.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-white mb-2 font-mono text-sm bg-black p-2 rounded">
              <span className="text-green-400">POST</span> https://hatexcard.com/api/public/payments
            </p>
            <pre className="text-sm text-gray-300 overflow-x-auto">
{`// Egzanp JavaScript (Fetch)
const response = await fetch('https://hatexcard.com/api/public/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer hx_live_KLE_OU_A'
  },
  body: JSON.stringify({
    amount: 150.00,
    currency: "HTG",
    order_id: "CMD-99812",
    card_info: {
      number: "0000111122223333",
      exp: "1225", // MWA ak ANE (MMYY)
      cvv: "123"
    }
  })
});

const data = await response.json();
console.log(data);`}
            </pre>
          </div>
        </section>

        {/* Etap 3: Resevwa Webhooks */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Webhook className="w-8 h-8 text-purple-500" />
            <h2 className="text-2xl font-semibold text-white">3. Koute Webhooks yo (Sekirite)</h2>
          </div>
          <p className="text-gray-400">
            Lè yon peman reyisi, Hatexcard ap voye yon siyal (Webhook) sou adrès ou te konfigire nan tablodbò w la. Ou dwe verifye siyati <code className="bg-gray-800 px-1 py-0.5 rounded text-pink-400">x-hatex-signature</code> la pou w asire w se vreman nou ki voye l.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm text-gray-300 overflow-x-auto">
{`// Egzanp Node.js / Express pou verifye siyati a
const crypto = require('crypto');

app.post('/webhook-hatexcard', (req, res) => {
  const signature = req.headers['x-hatex-signature'];
  const webhookSecret = 'whsec_KLE_SEKRE_WEBHOOK_OU_A';

  // Rekreye kripte a pou konpare
  const myHash = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (myHash === signature) {
    console.log("Peman an Valide! Debloke pwodwi a.");
    // Ekzekite lojik biznis ou isit la (bay aksè, voye imèl, elatriye)
    res.status(200).send('Resevwa');
  } else {
    console.log("Siyati pa koresponn. Aksè refize.");
    res.status(403).send('Erè Siyati');
  }
});`}
            </pre>
          </div>
        </section>

        {/* Footer info */}
        <div className="flex items-start space-x-3 bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200">
            Si w swiv 3 etap sa yo, sit ou a ap kapab chaje kat Hatexcard otomatikman, an sekirite, 24/7. Si w bezwen plis èd, kontakte sipò teknik nou an.
          </p>
        </div>

      </div>
    </div>
  );
}