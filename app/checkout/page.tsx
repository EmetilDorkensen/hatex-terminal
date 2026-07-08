"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CreditCard, Calendar, Lock, AlertCircle, Loader2, Store, CheckSquare, Square, History } from 'lucide-react';

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
  const [saveCard, setSaveCard] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [savedCards, setSavedCards] = useState<any[]>([]);

  // Load saved cards from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('hatex_saved_cards');
    if (stored) {
      try {
        setSavedCards(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing saved cards:', e);
      }
    }
  }, []);

  // Token validation
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Token manke. Itilize yon QR kòd ki valid.');
        setLoading(false);
        return;
      }
  
      try {
        const res = await fetch(`/api/checkout/session?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setError(data.message || 'Token pa valid. Tanpri jenere yon nouvo QR kòd.');
          setLoading(false);
          return;
        }

        setMerchant(data.merchant);
      } catch (err) {
        console.error('Erè inatandi:', err);
        setError('Erè pandan verifikasyon. Tanpri eseye ankò.');
      } finally {
        setLoading(false);
      }
    }
  
    validateToken();
  }, [token]);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '');
    const parts = [];
    for (let i = 0; i < v.length && i < 16; i += 4) {
      parts.push(v.substr(i, 4));
    }
    return parts.join(' ');
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + (v.length > 2 ? '/' + v.substring(2, 4) : '');
    }
    return v;
  };

  // Load a saved card (only for display – never auto-fill full number or CVV)
  const loadSavedCard = (last4: string) => {
    alert(`Kat ki fini pa ${last4} chwazi. Tanpri antre CVV la pou sekirite.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

    try {
      const res = await fetch('/api/checkout/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: parseFloat(amount),
          card_number: cleanCard,
          card_expiry: cardExpiry,
          card_cvv: cardCvv,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Erè kominikasyon ak sèvè peman.');
        setProcessing(false);
        return;
      }

      if (data.success) {
        // If user wants to save card, store only last 4 digits and expiry (no CVV!)
        if (saveCard) {
          const cardInfo = {
            id: Date.now().toString(),
            last4: cleanCard.slice(-4),
            expiry: cardExpiry,
            brand: 'Visa/MC', // You could detect card type
          };
          const updated = [...savedCards, cardInfo].slice(-3); // Keep only last 3
          localStorage.setItem('hatex_saved_cards', JSON.stringify(updated));
          setSavedCards(updated);
        }

        // REDIREKSYON AN – SA A ENPÒTAN!
        router.push(
          `/checkout/success?id=${encodeURIComponent(data.transaction_id)}&amount=${encodeURIComponent(amount)}${
            data.reference ? `&ref=${encodeURIComponent(data.reference)}` : ''
          }`
        );
      } else {
        setError(data.message || 'Peman an echwe.');
        setProcessing(false);
      }
    } catch (err: any) {
      setError('Erè koneksyon. Tcheke entènèt ou epi eseye ankò.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
          <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Verifikasyon...</p>
        </div>
      </div>
    );
  }

  if (error && !merchant) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-8 max-w-md text-center w-full">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Erè</h1>
          <p className="text-slate-600 text-sm leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-6 px-6 py-3 w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold text-sm text-white transition-all shadow-sm"
          >
            Tounen nan Akey
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans text-slate-900">
      <div className="w-full max-w-md">
        
        {/* En-tête / Machann */}
        <div className="text-center mb-8">
          {merchant?.avatar_url && (
            <div className="flex justify-center mb-4">
              <img 
                src={merchant.avatar_url} 
                alt={merchant.business_name || merchant.full_name}
                className="w-20 h-20 rounded-2xl object-cover border border-gray-200 shadow-sm bg-white"
              />
            </div>
          )}
          
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Peye ak <span className="text-indigo-600">Hatexcard</span>
          </h1>
          <p className="text-slate-500 mt-2 flex items-center justify-center gap-1.5 text-sm font-medium">
            <Store size={16} className="text-indigo-500" />
            {merchant?.business_name || merchant?.full_name || 'Machann'}
          </p>
        </div>

        {/* Saved cards section */}
        {savedCards.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <History size={16} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kat itilize avan</span>
            </div>
            <div className="space-y-3">
              {savedCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => loadSavedCard(card.last4)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className="text-indigo-600" />
                    <span className="text-sm font-semibold text-slate-700">•••• {card.last4}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500">{card.expiry}</span>
                </button>
              ))}
              <p className="text-[10px] text-slate-400 mt-3 text-center font-medium">
                Pou sekirite, ou dwe antre CVV la chak fwa.
              </p>
            </div>
          </div>
        )}

        {/* Fòm Peman an */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl">
          
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider">
              Montan (HTG)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-slate-900 text-lg font-bold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm placeholder:text-gray-400"
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center gap-2">
              <CreditCard size={16} className="text-indigo-600" /> Nimewo kat
            </label>
            <input
              type="text"
              inputMode="numeric"
              name="cc-number"
              autoComplete="cc-number"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="0000 0000 0000 0000"
              maxLength={19}
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-slate-900 font-mono text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm placeholder:text-gray-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} className="text-indigo-600" /> Eksp.
              </label>
              <input
                type="text"
                inputMode="numeric"
                name="cc-exp"
                autoComplete="cc-exp"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                placeholder="MM/AA"
                maxLength={5}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-slate-900 text-center font-mono text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm placeholder:text-gray-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center gap-2">
                <Lock size={16} className="text-indigo-600" /> CVV
              </label>
              <input
                type="password"
                inputMode="numeric"
                name="cc-csc"
                autoComplete="cc-csc"
                value={cardCvv}
                onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="***"
                maxLength={4}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 text-slate-900 text-center font-mono text-base focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all shadow-sm placeholder:text-gray-400"
                required
              />
            </div>
          </div>

          {/* Opsyon sonje kat la (sèlman dènye 4 chif) */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setSaveCard(!saveCard)}
              className="flex items-center gap-3 text-slate-600 hover:text-slate-900 transition-colors w-full text-left"
            >
              {saveCard ? (
                <CheckSquare className="w-5 h-5 text-indigo-600" />
              ) : (
                <Square className="w-5 h-5 text-gray-400" />
              )}
              <span className="text-sm font-semibold">Sonje kat sa pou pwochen fwa</span>
            </button>
            <p className="text-[10px] text-slate-500 mt-2 ml-8 font-medium">
              Sèlman dènye 4 chif. CVV pap janm estoke.
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-800 leading-relaxed">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={processing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl text-sm transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
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

          <p className="text-xs text-slate-400 font-medium text-center mt-6">
            Peman an ap fèt an sekirite epi ankripte.
          </p>
        </form>
        
        {/* FOOTER MINI */}
        <div className="mt-8 flex justify-center items-center gap-2">
           <img src="https://i.imgur.com/xDk58Xk.png" alt="Logo" className="w-4 h-4 rounded-sm grayscale opacity-50" />
           <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">
             Hatexcard Secure Network
           </p>
        </div>

      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
          <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Chajman...</p>
        </div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}