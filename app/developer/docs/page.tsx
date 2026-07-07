'use client';

import React from 'react';
import { ShieldCheck, CreditCard, Webhook, CheckCircle2, Key, Gauge, Server, AlertTriangle } from 'lucide-react';

const API_URL = 'https://hatexcard.com/api/public/payments';

export default function HatexcardDocs() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">

        <div className="border-b border-gray-800 pb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Dokimantasyon Devlopè</h1>
          <p className="text-gray-400 text-lg">
            Sèl API ofisyèl la se <code className="text-emerald-400">POST /api/public/payments</code>.
            Itilize l <strong className="text-white">sèlman sou sèvè ou a</strong> (PHP, Node, Python, elatriye) — pa nan JavaScript navigatè kliyan an.
          </p>
        </div>

        {/* Quick start */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Server className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-semibold text-white">Kòmanse rapid (4 etap)</h2>
          </div>
          <ol className="list-decimal list-inside text-gray-400 space-y-2 ml-2">
            <li>Konekte sou HatexCard, peye frè KYC (1150 HTG, kat enkli), epi verifye idantite w.</li>
            <li>Ale sou <code className="text-indigo-400">/developer</code> — kopye kle API ou a (<code className="text-yellow-400">hx_live_...</code>).</li>
            <li>Sou <strong className="text-white">sèvè ou a</strong>, voye yon <code className="text-gray-300">POST</code> ak kle a, montan an, ak enfòmasyon kat kliyan an.</li>
            <li>(Opsyonèl) Konfigire webhook pou resevwa konfimasyon otomatik lè peman reyisi.</li>
          </ol>
        </section>

        {/* Kondisyon Aksè */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Key className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-semibold text-white">Kondisyon pou jwenn kle API</h2>
          </div>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2">
            <li>Verifikasyon ID (KYC) apwouve sou kont HatexCard ou a</li>
            <li>Verifikasyon ID (KYC) apwouve — frè 1150 HTG (kat vityèl + terminal enkli)</li>
          </ul>
          <p className="text-gray-400 text-sm">
            Apre sa, kle API a parèt otomatikman sou <code className="text-indigo-400">/developer</code>.
            Li montre <strong className="text-white">yon sèl fwa</strong> lè li jenere — kopye l imedyatman epi sere l sou sèvè ou a.
          </p>
        </section>

        {/* Sekirite */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            <h2 className="text-2xl font-semibold text-white">Sekirite (oblijatwa)</h2>
          </div>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2">
            <li><strong className="text-white">Pa janm</strong> mete kle API nan kòd frontend, GitHub, oswa aplikasyon mobil kliyan an</li>
            <li>API a <strong className="text-white">pa gen CORS</strong> — li bloke demann ki soti nan navigatè</li>
            <li>Itilize toujou <code className="text-gray-300">Idempotency-Key</code> inik pou chak kòmand (evite doub peman si rezo a echwe)</li>
            <li>Pou teste: itilize <strong className="text-white">2 kont diferan</strong> — machann (kle API) ≠ kliyan (kat ki peye)</li>
          </ul>
          <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-900/50 p-4 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              Lajan kliyan an ka soti sou balans <strong>kat</strong> (paj /kat) oswa balans <strong>wallet</strong> (Dashboard).
              Si kliyan an gen lajan sou Dashboard men pa sou kat, li dwe fè rechaj kat anvan (/kat/recharge).
            </p>
          </div>
        </section>

        {/* Otantifikasyon */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Headers obligatwa</h2>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 font-mono text-sm space-y-1">
            <div><span className="text-pink-500">Authorization</span>: Bearer hx_live_KLE_OU_A</div>
            <div><span className="text-pink-500">Content-Type</span>: application/json</div>
            <div><span className="text-gray-400">Idempotency-Key</span>: CMD-99812-v1 <span className="text-gray-600">(rekòmande, inik pa kòmand)</span></div>
          </div>
        </section>

        {/* Limit */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Gauge className="w-8 h-8 text-orange-500" />
            <h2 className="text-2xl font-semibold text-white">Limit resepsyon API</h2>
          </div>
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
            Lajan antre sou balans machann ou a apre peman reyisi. Plafon balans jeneral (105k endividyèl / 2M antrepriz) toujou aplike.
          </p>
        </section>

        {/* Peman */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-8 h-8 text-green-500" />
            <h2 className="text-2xl font-semibold text-white">Fè yon peman</h2>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-white mb-2 font-mono text-sm bg-black p-2 rounded">
              <span className="text-green-400">POST</span> {API_URL}
            </p>
            <p className="text-gray-400 text-sm mb-3">Kò JSON la:</p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap mb-4">{`{
  "amount": 1500,
  "currency": "HTG",
  "order_id": "CMD-99812",
  "card_info": {
    "number": "0000111122223333",
    "exp": "12/28",
    "cvv": "123"
  }
}`}</pre>
            <p className="text-gray-500 text-xs mb-4">
              <code className="text-gray-400">exp</code> = MM/YY oswa MMYY (eg. 12/28 oswa 1228). <code className="text-gray-400">number</code> = 16 chif san espas.
            </p>
            <p className="text-gray-400 text-sm mb-2">Egzanp Node.js (sèvè ou a):</p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`const response = await fetch('${API_URL}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer hx_live_KLE_OU_A',
    'Idempotency-Key': 'CMD-99812-v1'
  },
  body: JSON.stringify({
    amount: 1500,
    currency: 'HTG',
    order_id: 'CMD-99812',
    card_info: { number: '0000111122223333', exp: '12/28', cvv: '123' }
  })
});

const data = await response.json();
if (data.success) {
  // data.transaction_id, data.amount_charged, data.debited_from ("card" oswa "wallet")
} else {
  // data.error — si fon ensifizan, data.balances montre balans kat ak wallet
}`}</pre>
          </div>
        </section>

        {/* Repons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Repons API</h2>
          <p className="text-gray-400 text-sm mb-2">Siksè (HTTP 200):</p>
          <pre className="text-sm text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-x-auto">{`{
  "success": true,
  "message": "Peman an fèt ak siksè!",
  "transaction_id": "HTX-ABC12345",
  "customer": "Non Kliyan",
  "amount_charged": 1500,
  "debited_from": "card"
}`}</pre>
          <p className="text-gray-400 text-sm mt-4 mb-2">Erè fon ensifizan (HTTP 400):</p>
          <pre className="text-sm text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-x-auto">{`{
  "error": "Fon ensifizan pou 1500.00 HTG. Balans kat: ...",
  "balances": {
    "card_htg": 500,
    "wallet_htg": 0,
    "required_htg": 1500
  }
}`}</pre>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border border-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="p-3 font-semibold">HTTP</th>
                  <th className="p-3 font-semibold">Signifikasyon</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr className="border-t border-gray-800"><td className="p-3 font-mono">401</td><td className="p-3">Kle API manke oswa pa bon</td></tr>
                <tr className="border-t border-gray-800"><td className="p-3 font-mono">403</td><td className="p-3">Kont machann pa aktif, oswa demann soti nan navigatè</td></tr>
                <tr className="border-t border-gray-800"><td className="p-3 font-mono">400</td><td className="p-3">Fòma move, fon ensifizan, oswa limit depase</td></tr>
                <tr className="border-t border-gray-800"><td className="p-3 font-mono">409</td><td className="p-3">Kòmand deja peye (doublon)</td></tr>
                <tr className="border-t border-gray-800"><td className="p-3 font-mono">429</td><td className="p-3">Twòp demann — tann epi reeseye</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Webhooks */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Webhook className="w-8 h-8 text-purple-500" />
            <h2 className="text-2xl font-semibold text-white">Webhooks</h2>
          </div>
          <p className="text-gray-400">
            Konfigire URL webhook yo nan tablodbò <code className="text-indigo-400">/developer</code>.
            Chak pwen gen <strong className="text-white">pwòp secret</strong> li (<code className="text-purple-400">whsec_...</code>) — kopye l lè ou kreye pwen an.
          </p>
          <p className="text-gray-400 text-sm">
            Headers: <code className="text-gray-300">x-hatex-signature</code>, <code className="text-gray-300">x-hatex-timestamp</code>, <code className="text-gray-300">x-hatex-event</code>.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`// Node.js — verifye siyati (secret = whsec_... nan /developer)
const crypto = require('crypto');
const MAX_AGE_SEC = 300;

app.post('/webhook-hatexcard', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hatex-signature'];
  const timestamp = req.headers['x-hatex-timestamp'];
  const secret = process.env.WEBHOOK_SECRET; // whsec_... pou pwen sa a

  const now = Math.floor(Date.now() / 1000);
  if (!timestamp || Math.abs(now - Number(timestamp)) > MAX_AGE_SEC) {
    return res.status(403).send('Timestamp pa valab');
  }

  const rawBody = req.body.toString('utf8');
  const expected = crypto.createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody).digest('hex');

  if (expected !== signature) return res.status(403).send('Siyati pa bon');

  const event = JSON.parse(rawBody);
  if (event.event === 'payment.success') {
    // event.data.transaction_id, event.data.amount, event.data.order_id
  }
  res.status(200).send('OK');
});`}</pre>
          </div>
        </section>

        <div className="flex items-start space-x-3 bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200">
            Wout litij sou dashboard la se zouti entèn — pa API devlopè a.
            Pou sipò entegrasyon: kontakte ekip HatexCard atravè paj Sipò a.
          </p>
        </div>

      </div>
    </div>
  );
}
