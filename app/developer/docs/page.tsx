'use client';

import React from 'react';
import { ShieldCheck, CreditCard, Webhook, CheckCircle2, Key, Gauge } from 'lucide-react';

export default function HatexcardDocs() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">

        <div className="border-b border-gray-800 pb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Dokimantasyon Devlopè</h1>
          <p className="text-gray-400 text-lg">
            Sèl API ofisyèl la se <code className="text-emerald-400">POST /api/public/payments</code>.
            Itilize l soti sou sèvè ou a (pa nan navigatè kliyan an) pou entegre HatexCard sou nenpòt sit, app, oswa platfòm devlopè.
          </p>
        </div>

        {/* Kondisyon Aksè */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Key className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-semibold text-white">Kondisyon Aksè API</h2>
          </div>
          <p className="text-gray-400">
            Kle API ou a (<code className="bg-gray-800 px-1 py-0.5 rounded text-yellow-400">hx_live_...</code>) jenere otomatikman lè <strong className="text-white">toude</strong> kondisyon sa yo satisfè:
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2">
            <li>Verifikasyon ID kont kliyan ou apwouve nan tab <code className="text-gray-300">profiles</code> (<code className="text-gray-300">kyc_status = approved</code>)</li>
            <li>Ou peye frè aktivasyon Kat Vityèl la (520 HTG, nan paj Kat la)</li>
          </ul>
          <p className="text-gray-400">
            Apre sa, ale sou <code className="text-indigo-400">/developer</code> pou kopye kle API ou a, konfigire webhook yo, epi wè egzanp kòd yo.
          </p>
        </section>

        {/* Limit Resepsyon */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Gauge className="w-8 h-8 text-orange-500" />
            <h2 className="text-2xl font-semibold text-white">Limit Resepsyon API</h2>
          </div>
          <p className="text-gray-400">
            Limit sa yo aplike sou kòb ou resevwa <strong className="text-white">via API a</strong> (pa sou transfè/retrè nòmal yo). De nivo verifikasyon:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="p-3 font-semibold">Tip Kont</th>
                  <th className="p-3 font-semibold">Max pa Tranzaksyon</th>
                  <th className="p-3 font-semibold">Max pa Jou (total API)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-800">
                  <td className="p-3 text-gray-300">Endividyèl</td>
                  <td className="p-3 text-white font-mono">50,000 HTG</td>
                  <td className="p-3 text-white font-mono">50,000 HTG</td>
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="p-3 text-gray-300">Antrepriz</td>
                  <td className="p-3 text-white font-mono">2,000,000 HTG</td>
                  <td className="p-3 text-white font-mono">2,000,000 HTG</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-sm">
            Kòb la antre dirèkteman sou <code className="text-gray-400">wallet_balance</code> kont ou a. Plafon balans jeneral la (105k endividyèl / 2M antrepriz) toujou aplike anplis limit resepsyon API a.
          </p>
        </section>

        {/* Otantifikasyon */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            <h2 className="text-2xl font-semibold text-white">1. Otantifikasyon</h2>
          </div>
          <p className="text-gray-400">
            Chak rekèt dwe gen yon header <code className="bg-gray-800 px-1 py-0.5 rounded text-pink-400">Authorization: Bearer hx_live_...</code>.
            Pa janm mete kle a nan kòd JavaScript kliyan (navigatè) — sèlman sou sèvè ou a.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 font-mono text-sm space-y-1">
            <div><span className="text-pink-500">Authorization</span>: Bearer hx_live_KLE_OU_A</div>
            <div><span className="text-pink-500">Content-Type</span>: application/json</div>
            <div><span className="text-gray-500">Idempotency-Key</span>: CMD-99812-v1 <span className="text-gray-600">(opsyonèl, rekòmande)</span></div>
          </div>
        </section>

        {/* Peman */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-8 h-8 text-green-500" />
            <h2 className="text-2xl font-semibold text-white">2. Fè yon Peman (Charge)</h2>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-white mb-2 font-mono text-sm bg-black p-2 rounded">
              <span className="text-green-400">POST</span> https://hatexcard.com/api/public/payments
            </p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`const response = await fetch('https://hatexcard.com/api/public/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer hx_live_KLE_OU_A',
    'Idempotency-Key': 'CMD-99812-v1' // evite doub-chaj si rezo a echwe
  },
  body: JSON.stringify({
    amount: 1500,
    currency: 'HTG',
    order_id: 'CMD-99812',
    card_info: {
      number: '0000111122223333',
      exp: '1225',
      cvv: '123'
    }
  })
});

const data = await response.json();
// data.success === true  ->  data.transaction_id se referans peman an
// Lajan antre sou wallet_balance ou a imedyatman.`}</pre>
          </div>
        </section>

        {/* Webhooks v2 */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Webhook className="w-8 h-8 text-purple-500" />
            <h2 className="text-2xl font-semibold text-white">3. Webhooks (Siyati v2 + Replay Protection)</h2>
          </div>
          <p className="text-gray-400">
            Konfigire yon oswa plizyè pwen webhook nan tablodbò <code className="text-indigo-400">/developer</code>.
            Lè yon peman reyisi, nou voye yon evènman <code className="text-purple-400">payment.success</code> sou chak URL aktif ki abòne a.
          </p>
          <p className="text-gray-400 text-sm">
            Headers nou voye: <code className="text-gray-300">x-hatex-signature</code>, <code className="text-gray-300">x-hatex-timestamp</code>, <code className="text-gray-300">x-hatex-event</code>.
            Siyati a se <code className="text-gray-300">HMAC-SHA256(secret, timestamp + &quot;.&quot; + JSON.stringify(body))</code>.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`// Egzanp Node.js / Express — verifye siyati v2
const crypto = require('crypto');

const MAX_AGE_SEC = 300; // rejte rekèt ki gen plis pase 5 minit

app.post('/webhook-hatexcard', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hatex-signature'];
  const timestamp = req.headers['x-hatex-timestamp'];
  const secret = process.env.HATEX_WEBHOOK_SECRET; // whsec_... (kopye nan /developer)

  const now = Math.floor(Date.now() / 1000);
  if (!timestamp || Math.abs(now - Number(timestamp)) > MAX_AGE_SEC) {
    return res.status(403).send('Timestamp twò ansyen — posib replay.');
  }

  const rawBody = req.body.toString('utf8');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody)
    .digest('hex');

  if (expected !== signature) {
    return res.status(403).send('Siyati pa koresponn.');
  }

  const event = JSON.parse(rawBody);
  if (event.event === 'payment.success') {
    // event.data.transaction_id, event.data.amount, event.data.order_id
    console.log('Peman reyisi!', event.data);
  }

  res.status(200).send('OK');
});`}</pre>
          </div>
          <p className="text-gray-500 text-sm">
            Si delivrans lan echwe, nou re-eseye otomatikman (jiska 6 fwa, ak backoff). Ou ka wè istorik delivrans yo nan tablodbò <code className="text-gray-400">/developer</code>.
          </p>
        </section>

        <div className="flex items-start space-x-3 bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200">
            API a se sèvè-a-sèvè sèlman (pa gen CORS ouvè). Itilize PHP, Node.js, Python, oswa nenpòt langaj ki ka fè yon rekèt HTTPS soti sou sèvè ou a. Pa itilize wout litij/livrezon/eskwo — yo se zouti entèn dashboard HatexCard, pa API devlopè a.
          </p>
        </div>

      </div>
    </div>
  );
}
