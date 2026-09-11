'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CreditCard,
  Webhook,
  CheckCircle2,
  Key,
  Gauge,
  Server,
  AlertTriangle,
  Smartphone,
  Banknote,
  ArrowLeft,
} from 'lucide-react';
import { API_RECEIVE_FEE_PER_1000 } from '@/lib/security/spending-limits';

const CHECKOUT_URL = 'https://hatexcard.com/api/v2/payments';
const PUBLIC_PAY_URL = 'https://hatexcard.com/api/public/payments';

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
          <h1 className="text-4xl font-bold text-white mb-4">Dokimantasyon Devlopè</h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            HatexCard se yon <strong className="text-white">pasèl peman</strong>: kliyan ou peye
            (MonCash, Natcash, Visa/kat, Stripe talè), HatexCard pran frè platfòm, epi rès la ale
            sou <strong className="text-white">kont MonCash / bank ou</strong> ki lye ak kle sekrè
            ou a.
          </p>
        </div>

        {/* Quick start */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Server className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-semibold text-white">Kòmanse rapid (5 etap)</h2>
          </div>
          <ol className="list-decimal list-inside text-gray-400 space-y-2 ml-2">
            <li>
              Konplete <strong className="text-white">KYC</strong> (frè KYC sèlman — pa gen frè
              aktivasyon 525 HTG ankò).
            </li>
            <li>
              Sou dashboard: <strong className="text-white">KONEKTE KONT BANK OU</strong> (MonCash
              KYC a pre-rempli otomatikman).
            </li>
            <li>
              Ale sou <code className="text-indigo-400">/developer</code> — kopye{' '}
              <strong className="text-white">kle sekrè</strong> ou (<code className="text-yellow-400">hx_live_...</code>).
              Kle sa a lye ak kont ou: tout kob API a resevwa ale kote ou.
            </li>
            <li>
              Sou <strong className="text-white">sèvè ou a</strong>, kreye yon sesyon peman (API v2)
              oswa itilize plugin / checkout HatexCard. <strong className="text-white">Pa mete
              kle a nan frontend.</strong>
            </li>
            <li>
              Kliyan an chwazi kijan li vle peye: MonCash, Natcash, Visa/kat (Stripe ap vini). Ou
              ka ofri HTG oswa USD — sistèm nan konvèti ak to admin.
            </li>
          </ol>
        </section>

        {/* Opsyon peman */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Banknote className="w-8 h-8 text-cyan-400" />
            <h2 className="text-2xl font-semibold text-white">Opsyon peman (checkout + API + plugin)</h2>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Menm opsyon yo disponib sou <strong className="text-white">fakti</strong>,{' '}
            <strong className="text-white">API / plugin</strong>, ak paj checkout HatexCard. Se{' '}
            <strong className="text-white">kliyan kap peye</strong> ki chwazi.
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
                  <td className="p-3 flex items-center gap-2">
                    <CreditCard size={14} /> Visa / Mastercard (kat HatexCard)
                  </td>
                  <td className="p-3">HTG</td>
                  <td className="p-3 text-emerald-400">Aktif (API public)</td>
                </tr>
                <tr className="border-t border-gray-800">
                  <td className="p-3">Stripe (kat entènasyonal)</td>
                  <td className="p-3">USD / HTG</td>
                  <td className="p-3 text-amber-400">Talè</td>
                </tr>
              </tbody>
            </table>
          </div>
          <pre className="text-sm text-gray-300 bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-x-auto whitespace-pre-wrap">{`{
  "amount": 1500,
  "currency": "HTG",
  "order_id": "CMD-99812",
  "payment_methods": ["moncash", "natcash", "card", "stripe"],
  "return_url": "https://sit-ou.com/order/99812/done"
}`}</pre>
          <p className="text-gray-500 text-xs">
            <code className="text-gray-400">payment_methods</code> opsyonèl — si ou pa voye l, checkout
            la montre tout metòd aktif. Stripe ap aktive otomatikman lè kle Stripe yo mete.
          </p>
        </section>

        {/* Kondisyon */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Key className="w-8 h-8 text-amber-500" />
            <h2 className="text-2xl font-semibold text-white">Kondisyon pou jwenn kle sekrè</h2>
          </div>
          <ul className="list-disc list-inside text-gray-400 space-y-2 ml-2">
            <li>Verifikasyon ID (KYC) apwouve</li>
            <li>Kont bank / MonCash konekte (pou HatexCard ka voye kob ou)</li>
            <li>MFA (TOTP) aktive — obligatwa pou tout kont</li>
          </ul>
          <p className="text-gray-400 text-sm">
            Kle a parèt sou <code className="text-indigo-400">/developer</code>. Li montre{' '}
            <strong className="text-white">yon sèl fwa</strong> — kopye l epi sere l sou sèvè ou
            (env var). Chak kle lye ak yon sèl machann: peman ki rive ak kle sa a ale nan kont
            machann sa a.
          </p>
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
            <li>API a pa gen CORS — demann navigatè yo bloke</li>
            <li>
              Toujou voye <code className="text-gray-300">Idempotency-Key</code> inik pou chak
              kòmand
            </li>
            <li>Verifye webhook ak secret <code className="text-purple-400">whsec_...</code></li>
          </ul>
          <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-900/50 p-4 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              HatexCard pa kenbe wallet pou machann yo. Kob la ale sou MonCash / bank ou. Pa
              konte sou balans « wallet » ansyen — konekte kont bank ou sou dashboard la.
            </p>
          </div>
        </section>

        {/* Headers */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Headers obligatwa</h2>
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
          <p className="text-gray-500 text-sm mt-3">
            API v2 sèvi ak kle pasrèl <code className="text-indigo-400">hx_sk_live_...</code> (live) oswa{' '}
            <code className="text-indigo-400">hx_sk_test_...</code> (test / sandbox — pa vre lajan). Ansyen kle{' '}
            <code className="text-indigo-400">hx_live_...</code> sèvi sèlman pou endpoin legacy{' '}
            <code className="text-indigo-400">/api/moncash/payments</code>.
          </p>
        </section>

        {/* API v2 checkout */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <Smartphone className="w-8 h-8 text-emerald-500" />
            <h2 className="text-2xl font-semibold text-white">Kreye sesyon peman (rekòmande)</h2>
          </div>
          <p className="text-gray-400 text-sm">
            Retounen yon URL checkout HatexCard kote kliyan an chwazi metòd peman. Ideal pou
            plugin, WooCommerce, fakti, elatriye.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <p className="text-white mb-2 font-mono text-sm bg-black p-2 rounded">
              <span className="text-green-400">POST</span> {CHECKOUT_URL}
            </p>
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`const res = await fetch('${CHECKOUT_URL}', {
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
    payment_methods: ['moncash', 'stripe'],
    return_url: 'https://sit-ou.com/done',
    customer_phone: '509xxxxxxxx', // nimewo MonCash kliyan an (telefòn-premye / USSD)
    flow: 'auto' // 'auto' | 'redirect' | 'ussd'
  })
});
const data = await res.json();
// data.checkout_mode → 'hosted' (paj MonCash) oswa 'ussd' (USSD sou telefòn kliyan an)
// data.checkout_url  → si 'hosted', louvri li nan yon lòt onglet epi swiv estati peman an
// data.payment_id    → ID pou swiv (lye ak kont ou via kle a)`}</pre>
          </div>
        </section>

        {/* API piblik MonCash */}
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-8 h-8 text-green-500" />
            <h2 className="text-2xl font-semibold text-white">API piblik — peman MonCash</h2>
          </div>
          <p className="text-gray-400 text-sm">
            Kreye yon peman MonCash dirèkteman (sèvè-a-sèvè), san paj checkout HatexCard.
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
            <h2 className="text-2xl font-semibold text-white">Webhooks</h2>
          </div>
          <p className="text-gray-400">
            Konfigire URL nan <code className="text-indigo-400">/developer</code>. Chak pwen gen
            secret <code className="text-purple-400">whsec_...</code>. Evènman:{' '}
            <code className="text-gray-300">payment.success</code>.
          </p>
          <p className="text-gray-400 text-sm">
            Headers: <code className="text-gray-300">x-hatex-signature</code>,{' '}
            <code className="text-gray-300">x-hatex-timestamp</code>,{' '}
            <code className="text-gray-300">x-hatex-event</code>.
          </p>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <pre className="text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap">{`// Node — verifye siyati
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
  if (event.event === 'payment.success') {
    // event.data.payment_id, amount, order_id, merchant_id
  }
  res.status(200).send('OK');
});`}</pre>
          </div>
        </section>

        <div className="flex items-start space-x-3 bg-blue-900/20 border border-blue-900/50 p-4 rounded-lg">
          <CheckCircle2 className="w-6 h-6 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-200">
            Pou sipò entegrasyon: paj Sipò sou HatexCard. Stripe ap ajoute san chanje kle
            sekrè ou — jis mete <code className="text-white">stripe</code> nan{' '}
            <code className="text-white">payment_methods</code> lè li disponib.
          </p>
        </div>
      </div>
    </div>
  );
}
