"use client";

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { CreditCard, Calendar, Lock, AlertCircle } from 'lucide-react';

// Kompozan ki itilize useSearchParams
function CheckoutContent() {
  const searchParams = useSearchParams();
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

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Token manke.');
        setLoading(false);
        return;
      }

      // Verifye token an epi jwenn merchant_id
      const { data: tokenData, error: tokenError } = await supabase
        .from('payment_tokens')
        .select('merchant_id, expires_at')
        .eq('id', token)
        .single();

      if (tokenError || !tokenData) {
        setError('Token pa valid.');
        setLoading(false);
        return;
      }

      // Verifye si token an ekspire
      if (new Date(tokenData.expires_at) < new Date()) {
        setError('Token ekspire. Tanpri jenere yon nouvo QR kòd.');
        setLoading(false);
        return;
      }

      // Chaje enfòmasyon machann nan
      const { data: merchantData, error: merchantError } = await supabase
        .from('profiles')
        .select('business_name, full_name')
        .eq('id', tokenData.merchant_id)
        .single();

      if (merchantError || !merchantData) {
        setError('Machann pa jwenn.');
        setLoading(false);
        return;
      }

      setMerchant(merchantData);
      setLoading(false);
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

  // Validasyon anvan voye
  const validateForm = () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Antre yon montan ki valab.");
      return false;
    }
    const cleanCard = cardNumber.replace(/\s/g, "");
    if (!/^\d{13,19}$/.test(cleanCard)) {
      setError("Nimewo kat la pa valab (13-19 chif).");
      return false;
    }
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      setError("Dat ekspirasyon dwe fòma MM/AA.");
      return false;
    }
    if (!/^\d{3,4}$/.test(cardCvv)) {
      setError("Kòd CVV dwe 3 oubyen 4 chif.");
      return false;
    }
    return true;
  };

  // Soumèt peman an
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setProcessing(true);
    setError("");

    const payload = {
      merchant_id: merchant?.id, // ou dwe jwenn id machann nan nan merchantData
      amount: parseFloat(amount),
      currency: "HTG",
      card_number: cardNumber.replace(/\s/g, ""),
      card_expiry: cardExpiry,
      card_cvv: cardCvv,
    };

    try {
      const res = await fetch("https://psdnklsqttyqhqhkhmgq.supabase.co/functions/v1/validate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Redireksyon sou paj success
        window.location.href = `/success?id=${data.transaction_id}&amount=${amount}`;
      } else {
        setError(data.message || "Peman an echwe. Tanpri eseye ankò.");
      }
    } catch (err) {
      setError("Erè koneksyon. Tcheke entènèt ou epi eseye ankò.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-white text-xl">Chajman...</div>
      </div>
    );
  }

  if (error && !merchant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="bg-red-600/10 border border-red-600/30 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Erè</h1>
          <p className="text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            Peye <span className="text-red-600">HATEX</span>
          </h1>
          <p className="text-gray-400 mt-2">
            Machann: <span className="text-white font-bold">{merchant?.business_name || merchant?.full_name}</span>
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

          {/* Mesaj erè */}
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
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-lg transition transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {processing ? "Ap trete..." : "Peye kounye a"}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            Peman an pral verifye epi dedwi nan balans ou.
          </p>
        </form>
      </div>
    </div>
  );
}

// Paj prensipal la vlope ak Suspense
export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center text-white">Chajman...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}