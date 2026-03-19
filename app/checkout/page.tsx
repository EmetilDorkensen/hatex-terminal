"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CreditCard, Calendar, Lock, AlertCircle, Loader2 } from 'lucide-react';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [processing, setProcessing] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Verifye token an lè paj la chaje
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Token manke. Itilize yon QR kòd ki valid.');
        setLoading(false);
        return;
      }

      try {
        // 1. Tcheke si token an egziste epi pa ekspire
        const { data: tokenData, error: tokenError } = await supabase
          .from('payment_tokens')
          .select('merchant_id, expires_at')
          .eq('id', token)
          .single();

        if (tokenError || !tokenData) {
          setError('Token pa valid. Tanpri jenere yon nouvo QR kòd.');
          setLoading(false);
          return;
        }

        if (new Date(tokenData.expires_at) < new Date()) {
          setError('Token ekspire. Tanpri jenere yon nouvo QR kòd.');
          setLoading(false);
          return;
        }

        // 2. Chache enfòmasyon machann nan (ak api_key)
        const { data: merchantData, error: merchantError } = await supabase
          .from('profiles')
          .select('id, api_key, business_name, full_name')
          .eq('id', tokenData.merchant_id)
          .single();

        if (merchantError || !merchantData) {
          setError('Machann pa jwenn. Kontakte sipò.');
          setLoading(false);
          return;
        }

        setMerchant(merchantData);
      } catch (err) {
        setError('Erè pandan verifikasyon. Tanpri eseye ankò.');
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token, supabase]);

  // Fòma nimewo kat
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '');
    const parts = [];
    for (let i = 0; i < v.length && i < 16; i += 4) {
      parts.push(v.substr(i, 4));
    }
    return parts.join(' ');
  };

  // Fòma dat ekspirasyon
  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + (v.length > 2 ? '/' + v.substring(2, 4) : '');
    }
    return v;
  };

  // Soumèt peman an
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasyon kote kliyan an
    if (!amount || parseFloat(amount) <= 0) {
      setError('Antre yon montan ki valab.');
      return;
    }
    const cleanCard = cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(cleanCard)) {
      setError('Nimewo kat la pa valab (13-19 chif).');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      setError('Dat ekspirasyon dwe fòma MM/AA.');
      return;
    }
    if (!/^\d{3,4}$/.test(cardCvv)) {
      setError('Kòd CVV dwe 3 oubyen 4 chif.');
      return;
    }

    setProcessing(true);
    setError('');

    // Payload la dwe gen merchant_id = api_key (se sa Edge Function an ap chache)
    const payload = {
      merchant_id: merchant.api_key,
      amount: parseFloat(amount),
      currency: 'HTG',
      card_number: cleanCard,
      card_expiry: cardExpiry,
      card_cvv: cardCvv,
      metadata: {
        platform: 'qr',
        token: token,
        merchant_name: merchant.business_name || merchant.full_name,
      },
    };

    try {
      const res = await fetch('https://psdnklsqttyqhqhkhmgq.supabase.co/functions/v1/validate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();
      console.log('Repons Edge Function:', res.status, responseText);

      if (!res.ok) {
        let errorMsg = 'Erè kominikasyon ak sèvè peman.';
        try {
          const errorData = JSON.parse(responseText);
          errorMsg = errorData.message || errorMsg;
        } catch {
          // Si se pa JSON, itilize mesaj default
        }
        setError(errorMsg);
        setProcessing(false);
        return;
      }

      const data = JSON.parse(responseText);
      if (data.success) {
        // Redirije sou paj siksè a ak bon paramèt
        router.push(`/checkout/success?id=${data.transaction_id}&amount=${amount}`);
      } else {
        setError(data.message || 'Peman an echwe.');
        setProcessing(false);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError('Erè koneksyon. Tcheke entènèt ou epi eseye ankò.');
      setProcessing(false);
    }
  };

  // Eta loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-4" />
          <p className="text-lg">Verifikasyon...</p>
        </div>
      </div>
    );
  }

  // Si gen erè (token pa bon, elatriye)
  if (error && !merchant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-red-600/10 border border-red-600/30 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Erè</h1>
          <p className="text-gray-300">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 rounded-xl font-bold text-white transition"
          >
            Ale nan akey
          </button>
        </div>
      </div>
    );
  }

  // Afichaj fòmilè a
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            Peye <span className="text-red-600">HATEX</span>
          </h1>
          <p className="text-gray-400 mt-2">
            Machann: <span className="text-white font-bold">{merchant?.business_name || merchant?.full_name || 'Machann'}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-6 shadow-2xl">
          {/* Montan */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">
              Montan (HTG)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-lg font-bold focus:border-red-600 focus:outline-none transition"
              required
            />
          </div>

          {/* Nimewo kat */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
              <CreditCard size={16} className="text-red-600" /> Nimewo kat
            </label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-lg focus:border-red-600 focus:outline-none transition"
              required
            />
          </div>

          {/* Dat ekspirasyon ak CVV */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} className="text-red-600" /> Eksp.
              </label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                placeholder="MM/AA"
                maxLength={5}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono focus:border-red-600 focus:outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Lock size={16} className="text-red-600" /> CVV
              </label>
              <input
                type="password"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="***"
                maxLength={4}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono focus:border-red-600 focus:outline-none transition"
                required
              />
            </div>
          </div>

          {/* Mesaj erè (si genyen) */}
          {error && (
            <div className="bg-red-600/20 border border-red-600/30 rounded-xl p-3 mb-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Bouton peye */}
          <button
            type="submit"
            disabled={processing}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Ap trete...
              </>
            ) : (
              'Peye kounye a'
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Peman an pral verifye epi dedwi nan balans ou.
          </p>
        </form>
      </div>
    </div>
  );
}

// Wrapper ak Suspense pou useSearchParams
export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-4" />
          <p className="text-lg">Chajman...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}