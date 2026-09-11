'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Webhook,
  CheckCircle2,
  Key,
  Server,
  AlertTriangle,
  Smartphone,
  Banknote,
  ArrowLeft,
  UserCheck,
  Code2,
} from 'lucide-react';

const V2_PAY_URL = 'https://hatexcard.com/api/v2/payments';

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
            ou. Kliyan yo peye ak <strong className="text-white">MonCash</strong>, epi kob la ale
            sou <strong className="text-white">kont MonCash / bank ou</strong>.
          </p>
          <p className="text-gray-500 text-sm mt-3 leading-relaxed">
            Pou resevwa peman: <strong className="text-gray-300">KYC apwouve</strong> +{' '}
            <strong className="text-gray-300">kle API</strong> + demann sèvè-a-sèvè (pa nan
            navigatè kliyan an).
          </p>
        </div>

        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <UserCheck className="w-8 h-8 text-indigo-400" />
            <h2 className="text-2xl font-semibold text-white">KYC = debloke API a</h2>
          </div>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2 text-sm">
            <li>
              Konplete verifikasyon ID sou <code className="text-indigo-400">/kyc/v2</code>.
            </li>
            <li>
              Apre apwobasyon, ale sou <code className="text-indigo-400">/developer</code> pou
              jwenn kle yo.
            </li>
            <li>
              Konekte <strong className="text-white">kont bank / MonCash</strong> sou dashboard.
            </li>
            <li>
              <strong className="text-white">MFA</strong> obligatwa pou tout kont.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Server className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-semibold text-white">Kòmanse rapid</h2>
          </div>
          <ol className="list-decimal list-inside text-gray-400 space-y-2 ml-2">
            <li>KYC apwouve + kont MonCash konekte.</li>
            <li>
              Sou <code className="text-indigo-400">/developer</code>, kopye kle{' '}
              <code className="text-yellow-400">hx_sk_test_...</code> (tès) oswa{' '}
              <code className="text-yellow-400">hx_sk_live_...</code> (vre lajan).
            </li>
            <li>
              Sere kle a nan varyab anviwònman sou <strong className="text-white">sèvè ou</strong>{' '}
              (egzanp <code className="text-gray-300">HATEX_SECRET_KEY</code>). Pa janm nan HTML/JS
              navigatè.
            </li>
            <li>
              Kreye peman ak <code className="text-gray-300">POST /api/v2/payments</code>, apre
              voye kliyan an sou <code className="text-gray-300">checkout_url</code> — se yon{' '}
              <strong className="text-white">paj peman HatexCard</strong> (menm eksperyans ak
              pwodwi/fakti): kliyan an antre nimewo MonCash li epi konfime ak PIN li sou telefòn
              li. <strong className="text-white">Pa gen redireksyon sou paj eksteryè.</strong>
            </li>
          </ol>
        </section>

        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Banknote className="w-8 h-8 text-cyan-400" />
            <h2 className="text-2xl font-semibold text-white">Metòd peman</h2>
          </div>
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
                  <td className="p-3">HTG</td>
                  <td className="p-3 text-emerald-400">Aktif</td>
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="p-3">Natcash</td>
                  <td className="p-3">HTG</td>
                  <td className="p-3 text-amber-400">Ap vini</td>
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="p-3">Stripe (Visa / Mastercard)</td>
                  <td className="p-3">USD / HTG</td>
                  <td className="p-3 text-amber-400">Talè</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
            <h2 className="text-2xl font-semibold text-white">Sekirite</h2>
          </div>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2">
            <li>
              <strong className="text-white">Pa janm</strong> mete kle sekrè nan frontend, GitHub,
              screenshot, oswa app mobil kliyan
            </li>
            <li>Rele API a sèlman depi sèvè ou (backend)</li>
            <li>
              Itilize <code className="text-gray-300">Idempotency-Key</code> inik pou chak kòmand
            </li>
            <li>Verifye siyati webhook anvan ou trete evènman an</li>
          </ul>
          <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-900/50 p-4 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200 leading-relaxed">
              Kle yo montre <strong className="text-white">yon sèl fwa</strong> lè yo kreye oswa
              rotate. Si w pèdi l, rotate mòd sa a sèlman — lòt mòd la pa chanje.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Key className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-semibold text-white">Headers</h2>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 font-mono text-sm space-y-1">
            <div>
              <span className="text-pink-500">Authorization</span>: Bearer hx_sk_live_...
            </div>
            <div>
              <span className="text-pink-500">Content-Type</span>: application/json
            </div>
            <div>
              <span className="text-gray-400">Idempotency-Key</span>: order-123-v1
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-3">
            <code className="text-indigo-400">hx_sk_test_...</code> = sandbox ·{' '}
            <code className="text-indigo-400">hx_sk_live_...</code> = vre lajan. Pa melanje yo.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Code2 className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-semibold text-white">Kreye peman</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            <span className="text-green-400 font-mono">POST</span>{' '}
            <code className="text-gray-300">{V2_PAY_URL}</code>
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`// Sou SÈVÈ ou a sèlman
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
    description: 'Kòmand #' + orderId,
    return_url: 'https://sit-ou.com/done'
  })
});
const data = await res.json();
// data.checkout_url → paj peman HatexCard (voye kliyan an la)
// data.payment_id   → pou swiv estati a (GET /api/v2/payments/{id})`}</pre>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Lè peman an konfime, HatexCard voye <strong className="text-white">2 notifikasyon
            otomatik</strong>: yon webhook <code className="text-gray-300">payment.success</code>{' '}
            sou sit ou (si w konfigire youn) ak yon <strong className="text-white">imèl</strong> sou
            adrès kont ou. Si w mete <code className="text-gray-300">
            metadata.customer_email</code> nan demann lan, kliyan an resevwa yon resi pa imèl tou.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Egzanp PHP</h2>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
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

        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Webhook className="w-8 h-8 text-purple-500" />
            <h2 className="text-2xl font-semibold text-white">Webhooks</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Ajoute yon URL HTTPS sou <code className="text-indigo-400">/developer</code>. Chak
            pwen gen yon mòd (test oswa live) ak yon secret. Lè peman an konfime, HatexCard voye{' '}
            <code className="text-gray-300">payment.success</code> sou sit ou — anplis imèl
            otomatik la. Si sit ou pa reponn, nou eseye ankò jiska 6 fwa.
          </p>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2 text-sm">
            <li>Peman test → sèlman webhook test</li>
            <li>Peman live → sèlman webhook live</li>
            <li>Verifye siyati HMAC anvan ou trete evènman an</li>
            <li>Reponn <code className="text-gray-300">200 OK</code> rapidman</li>
          </ul>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`const crypto = require('crypto');

app.post('/webhook-hatexcard', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-hatex-signature'];
  const timestamp = req.headers['x-hatex-timestamp'];
  const secret = process.env.WEBHOOK_SECRET;

  const rawBody = req.body.toString('utf8');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody)
    .digest('hex');

  if (expected !== signature) return res.status(403).send('Siyati pa bon');

  const event = JSON.parse(rawBody);
  if (event.event === 'payment.success') {
    // Trete kòmand lan (verifye event.id pou pa trete 2 fwa)
  }
  res.status(200).send('OK');
});`}</pre>
          </div>
        </section>

        <div className="flex items-start space-x-3 bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200 leading-relaxed">
            Rezime: KYC → 2 kle separe (test / live) →{' '}
            <code className="text-white">POST /api/v2/payments</code> sou sèvè → MonCash → webhook
            sou menm mòd la.
          </p>
        </div>
      </div>
    </div>
  );
}
