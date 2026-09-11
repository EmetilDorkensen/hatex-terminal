'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Webhook,
  CheckCircle2,
  Key,
  Gauge,
  Server,
  AlertTriangle,
  Smartphone,
  Banknote,
  ArrowLeft,
  UserCheck,
  Code2,
} from 'lucide-react';
import { API_RECEIVE_FEE_PER_1000 } from '@/lib/security/spending-limits';

const V2_PAY_URL = 'https://hatexcard.com/api/v2/payments';
const PUBLIC_PAY_URL = 'https://hatexcard.com/api/public/payments';
const MONCASH_PAY_URL = 'https://hatexcard.com/api/moncash/payments';

export default function HatexcardDocs() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="border-b border-gray-800 pb-8">
          <Link
            href="/developer"
            className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 mb-6"
          >
            <ArrowLeft size={16} /> Retounen nan /developer
          </Link>
          <h1 className="text-4xl font-bold text-white mb-4">Dokimantasyon API</h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            HatexCard se yon <strong className="text-white">pasèl peman</strong> pou sit ak boutik
            ou. Kliyan yo peye ak <strong className="text-white">MonCash</strong>, HatexCard pran
            frè platfòm, epi kob la ale sou <strong className="text-white">kont MonCash / bank
            ou</strong> ki lye ak kle sekrè ou a.
          </p>
          <p className="text-gray-500 text-sm mt-3 leading-relaxed">
            Pa gen kat vityèl HatexCard ankò. Pou resevwa peman sou sit ou, ou bezwen sèlman:{' '}
            <strong className="text-gray-300">KYC apwouve</strong> +{' '}
            <strong className="text-gray-300">kle API</strong> + entegrasyon sèvè-a-sèvè.
          </p>
        </div>

        {/* KYC — nouvo sistèm */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <UserCheck className="w-8 h-8 text-indigo-400" />
            <h2 className="text-2xl font-semibold text-white">KYC = debloke API a</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Yon sèl kondisyon ouvè aksè API a: <strong className="text-white">verifikasyon ID
            (KYC) apwouve</strong>. Lè KYC ou apwouve, ou ka jwenn kle sekrè sou{' '}
            <code className="text-indigo-400">/developer</code>, kreye fakti, pwodui, epi resevwa
            peman MonCash sou sit ou.
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2 text-sm">
            <li>
              Ale sou <code className="text-indigo-400">/kyc/v2</code> pou soumèt dokiman ID +
              liveness.
            </li>
            <li>
              Frè KYC sèlman — <strong className="text-white">pa gen frè aktivasyon kat 525 HTG</strong>{' '}
              ankò.
            </li>
            <li>
              Apre apwobasyon, kle API yo kreye otomatikman (oswa sou{' '}
              <code className="text-indigo-400">/developer</code>).
            </li>
            <li>
              Konekte <strong className="text-white">kont bank / MonCash</strong> sou dashboard pou
              HatexCard ka voye kob ou.
            </li>
            <li>
              <strong className="text-white">MFA (TOTP)</strong> se obligatwa pou tout kont.
            </li>
          </ul>
        </section>

        {/* Kòmanse rapid */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Server className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-semibold text-white">Kòmanse rapid (5 etap)</h2>
          </div>
          <ol className="list-decimal list-inside text-gray-400 space-y-2 ml-2">
            <li>
              Konplete <strong className="text-white">KYC</strong> jiskaske li apwouve.
            </li>
            <li>
              Sou dashboard: <strong className="text-white">konekte kont bank / MonCash</strong> ou.
            </li>
            <li>
              Ale sou <code className="text-indigo-400">/developer</code> — kopye{' '}
              <strong className="text-white">kle sekrè</strong> ou (
              <code className="text-yellow-400">hx_sk_live_...</code> oswa{' '}
              <code className="text-yellow-400">hx_sk_test_...</code>). Kle sa a lye ak kont ou:
              tout kob API a resevwa ale kote ou.
            </li>
            <li>
              Sou <strong className="text-white">sèvè ou a</strong> (PHP, Node, Python…), kreye yon
              peman ak API a. <strong className="text-white">Pa mete kle a nan frontend</strong>{' '}
              (HTML/JS navigatè).
            </li>
            <li>
              Kliyan an peye sou <strong className="text-white">MonCash</strong>. Ou swiv estati a
              ak <code className="text-gray-300">payment_id</code> oswa webhook{' '}
              <code className="text-gray-300">payment.success</code>.
            </li>
          </ol>
        </section>

        {/* Opsyon peman */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Banknote className="w-8 h-8 text-cyan-400" />
            <h2 className="text-2xl font-semibold text-white">Metòd peman</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Menm metòd yo disponib sou fakti, API, ak plugin WooCommerce. Se{' '}
            <strong className="text-white">kliyan kap peye</strong> ki konplete peman an sou
            MonCash.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-900">
                <tr className="text-left text-gray-400">
                  <th className="p-3 font-semibold">Metòd</th>
                  <th className="p-3 font-semibold">Lajan</th>
                  <th className="p-3 font-semibold">Stati</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-t border-gray-800">
                  <td className="p-3 flex items-center gap-2">
                    <Smartphone size={14} className="text-emerald-400" /> MonCash
                  </td>
                  <td className="p-3">HTG (USD → konvèti)</td>
                  <td className="p-3 text-emerald-400">Aktif</td>
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="p-3">Natcash</td>
                  <td className="p-3">HTG</td>
                  <td className="p-3 text-amber-400">Ap vini</td>
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="p-3">Stripe (Visa / Mastercard entènasyonal)</td>
                  <td className="p-3">USD / HTG</td>
                  <td className="p-3 text-amber-400">Talè</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="flex items-start gap-3 bg-slate-900/60 border border-gray-800 p-4 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-400 leading-relaxed">
              <strong className="text-white">Kat vityèl HatexCard pa disponib ankò.</strong> Si ou
              voye <code className="text-gray-300">payment_method: &quot;card&quot;</code> oswa
              ansyen <code className="text-gray-300">card_info</code>, API a retounen{' '}
              <code className="text-amber-300">410 Gone</code>. Itilize{' '}
              <code className="text-emerald-400">payment_method: &quot;moncash&quot;</code>.
            </p>
          </div>
        </section>

        {/* Sekirite */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            <h2 className="text-2xl font-semibold text-white">Sekirite (oblijatwa)</h2>
          </div>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2">
            <li>
              <strong className="text-white">Pa janm</strong> mete kle API nan frontend, GitHub,
              oswa app mobil kliyan
            </li>
            <li>API a pa gen CORS — demann navigatè yo bloke (sèvè-a-sèvè sèlman)</li>
            <li>
              Toujou voye <code className="text-gray-300">Idempotency-Key</code> inik pou chak
              kòmand
            </li>
            <li>
              Verifye webhook ak secret <code className="text-purple-400">whsec_...</code>
            </li>
          </ul>
        </section>

        {/* Headers */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Key className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-semibold text-white">Headers obligatwa</h2>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 font-mono text-sm space-y-1">
            <div>
              <span className="text-pink-500">Authorization</span>: Bearer hx_sk_live_KLE_OU_A
            </div>
            <div>
              <span className="text-pink-500">Content-Type</span>: application/json
            </div>
            <div>
              <span className="text-gray-400">Idempotency-Key</span>: CMD-99812-v1{' '}
              <span className="text-gray-600">(rekòmande)</span>
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-3 leading-relaxed">
            API v2 sèvi ak <code className="text-indigo-400">hx_sk_live_...</code> (live) oswa{' '}
            <code className="text-indigo-400">hx_sk_test_...</code> (test / sandbox — pa vre lajan).
            Ansyen kle <code className="text-indigo-400">hx_live_...</code> mache toujou pou kèk
            endpoin MonCash, men prefere <code className="text-indigo-400">hx_sk_*</code>.
          </p>
        </section>

        {/* API v2 — rekòmande */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Code2 className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-semibold text-white">
              1. Kreye peman (rekòmande) — API v2
            </h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Ideal pou sit ou, WooCommerce, fakti, oswa nenpòt backend. Retounen yon URL checkout
            MonCash (oswa mòd USSD si telefòn kliyan an disponib).
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-white mb-2 font-mono text-sm bg-black p-2 rounded">
              <span className="text-green-400">POST</span> {V2_PAY_URL}
            </p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`const res = await fetch('${V2_PAY_URL}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer hx_sk_live_KLE_OU_A',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'CMD-99812-v1'
  },
  body: JSON.stringify({
    amount: 1500,
    currency: 'HTG', // oswa 'USD' — to admin aplike
    order_id: 'CMD-99812',
    description: 'Kòmand #99812',
    return_url: 'https://sit-ou.com/done',
    customer_phone: '509xxxxxxxx', // opsyonèl — USSD / telefòn-premye
    flow: 'auto' // 'auto' | 'redirect' | 'ussd'
  })
});
const data = await res.json();
// data.checkout_mode → 'hosted' (paj MonCash) oswa 'ussd'
// data.checkout_url  → louvri li pou kliyan an (si hosted)
// data.payment_id    → ID pou swiv estati a`}</pre>
          </div>
        </section>

        {/* API piblik MonCash */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Smartphone className="w-8 h-8 text-green-500" />
            <h2 className="text-2xl font-semibold text-white">2. API piblik — MonCash dirèk</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Kreye yon peman MonCash sèvè-a-sèvè. Sèlman{' '}
            <code className="text-emerald-400">payment_method: &quot;moncash&quot;</code> aksepte.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-white mb-2 font-mono text-sm bg-black p-2 rounded">
              <span className="text-green-400">POST</span> {PUBLIC_PAY_URL}
            </p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`{
  "amount": 1500,
  "currency": "HTG",
  "order_id": "CMD-99812",
  "payment_method": "moncash"
}`}</pre>
          </div>
        </section>

        {/* Legacy moncash shortcut */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Smartphone className="w-8 h-8 text-teal-400" />
            <h2 className="text-2xl font-semibold text-white">3. Raccourci MonCash</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Menm ide: kreye peman MonCash epi jwenn <code className="text-gray-300">checkout_url</code>.
            Souvan itilize nan egzanp sou <code className="text-indigo-400">/developer</code>.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-white mb-2 font-mono text-sm bg-black p-2 rounded">
              <span className="text-green-400">POST</span> {MONCASH_PAY_URL}
            </p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`{
  "amount": 1500,
  "order_id": "CMD-99812",
  "description": "Kòmand #99812",
  "return_url": "https://sit-ou.com/done",
  "customer_phone": "509xxxxxxxx",
  "flow": "auto"
}`}</pre>
          </div>
        </section>

        {/* Egzanp Node / PHP */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Egzanp entegrasyon sou sit ou</h2>
          <p className="text-gray-400 text-sm">
            Mete sa a nan backend ou (pa nan navigatè). Apre ou gen{' '}
            <code className="text-gray-300">checkout_url</code>, redireksyone kliyan an sou li.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Node.js</p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`// ⚠️ Sèlman sou SÈVÈ ou a
const res = await fetch('${V2_PAY_URL}', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + process.env.HATEX_SECRET_KEY,
    'Content-Type': 'application/json',
    'Idempotency-Key': 'order-' + orderId
  },
  body: JSON.stringify({
    amount: 1500,
    order_id: orderId,
    return_url: 'https://sit-ou.com/done'
  })
});
const data = await res.json();
// Redirect kliyan → data.checkout_url`}</pre>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 pt-2">PHP</p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`<?php
$ch = curl_init('${V2_PAY_URL}');
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    'Authorization: Bearer ' . getenv('HATEX_SECRET_KEY'),
    'Content-Type: application/json',
    'Idempotency-Key: order-' . $orderId,
  ],
  CURLOPT_POSTFIELDS => json_encode([
    'amount' => 1500,
    'order_id' => $orderId,
    'return_url' => 'https://sit-ou.com/done',
  ]),
]);
$data = json_decode(curl_exec($ch), true);
header('Location: ' . $data['checkout_url']);`}</pre>
          </div>
        </section>

        {/* Limit & frè */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Gauge className="w-8 h-8 text-orange-500" />
            <h2 className="text-2xl font-semibold text-white">Limit & frè</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Sou chak peman, HatexCard retire frè platfòm (
            <strong className="text-white">{API_RECEIVE_FEE_PER_1000} HTG / 1 000</strong> sou
            kèk flow API), epi voye <strong className="text-white">net</strong> sou MonCash /
            bank ou. Limit endividyèl vs antrepriz aplike — gade panèl{' '}
            <code className="text-indigo-400">/developer</code>.
          </p>
        </section>

        {/* Webhooks */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Webhook className="w-8 h-8 text-purple-500" />
            <h2 className="text-2xl font-semibold text-white">Webhooks (estil Stripe)</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Konfigire URL nan <code className="text-indigo-400">/developer</code>. Chak pwen gen:
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2 text-sm">
            <li>
              Yon <strong className="text-white">mòd</strong> (<code className="text-indigo-400">test</code> oswa{' '}
              <code className="text-emerald-400">live</code>) — peman test pa touche webhook live
            </li>
            <li>
              Yon secret <code className="text-purple-400">whsec_...</code> (montre yon sèl fwa)
            </li>
            <li>
              Evènman: <code className="text-gray-300">payment.success</code> (apre MonCash konfime)
            </li>
            <li>Re-eseye otomatik si sèvè ou a echwe (backoff, jiska 6 tantativ)</li>
          </ul>
          <p className="text-gray-400 text-sm">
            Headers: <code className="text-gray-300">x-hatex-signature</code>,{' '}
            <code className="text-gray-300">x-hatex-timestamp</code>,{' '}
            <code className="text-gray-300">x-hatex-event</code>.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`// Node — verifye siyati (tankou Stripe)
const crypto = require('crypto');
const MAX_AGE_SEC = 300;

app.post('/webhook-hatexcard', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hatex-signature'];
  const timestamp = req.headers['x-hatex-timestamp'];
  const secret = process.env.WEBHOOK_SECRET; // whsec_...

  const now = Math.floor(Date.now() / 1000);
  if (!timestamp || Math.abs(now - Number(timestamp)) > MAX_AGE_SEC) {
    return res.status(403).send('Timestamp pa valab');
  }

  const rawBody = req.body.toString('utf8');
  const expected = crypto.createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody).digest('hex');

  if (expected !== signature) return res.status(403).send('Siyati pa bon');

  const event = JSON.parse(rawBody);
  // event.id — kenbe pou idempotency (menm id sou re-eseye)
  if (event.event === 'payment.success') {
    // event.data.payment_id, order_id, amount, mode ('test'|'live')
  }
  res.status(200).send('OK');
});`}</pre>
          </div>
        </section>

        <div className="flex items-start space-x-3 bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200 leading-relaxed">
            Rezime: <strong className="text-white">2 kle separe</strong> (
            <code className="text-white">hx_sk_test_</code> + <code className="text-white">hx_sk_live_</code>
            ) → <code className="text-white">POST /api/v2/payments</code> → MonCash → webhook{' '}
            <code className="text-white">payment.success</code> sou menm mòd la (test↔test, live↔live),
            tankou Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
