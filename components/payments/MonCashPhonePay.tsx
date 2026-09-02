"use client";

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Smartphone,
} from 'lucide-react';

/**
 * Checkout MonCash "telefòn-premye" (USSD).
 *
 * Pa voye kliyan an sou paj MonCash la tou dirèk: nou mande nimewo MonCash li,
 * nou montre etap "konfime PIN sou telefòn ou", epi nou swiv estati peman an.
 *
 * - Si API USSD dirèk la (Digicel) konfigire → MonCash voye USSD sou SIM lan.
 * - Sinon (fallback) → paj MonCash la louvri nan yon LÒT onglet epi paj sa a
 *   kontinye swiv peman an jis li konfime.
 */

type StartResponse =
  | {
      ok: true;
      checkout_mode?: 'hosted' | 'ussd' | 'redirect' | 'auto';
      checkout_url: string | null;
      payment_id: string;
    }
  | { ok: false; message: string };

export function MonCashPhonePay({
  amount,
  disabled = false,
  blocked = false,
  startPayment,
  onPaid,
}: {
  amount: number;
  disabled?: boolean;
  blocked?: boolean;
  startPayment: (phone: string) => Promise<StartResponse>;
  onPaid?: (paymentId: string) => void;
}) {
  const [stage, setStage] = useState<'idle' | 'phone' | 'starting' | 'pending' | 'done' | 'error'>('idle');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'hosted' | 'ussd'>('hosted');
  const [paymentId, setPaymentId] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCheck = useRef(false);

  const amountLabel = `${Math.round(amount).toLocaleString('fr-FR')} HTG`;

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pendingCheck.current = false;
  };

  useEffect(() => stopPolling, []);

  const checkStatus = async () => {
    if (!paymentId || pendingCheck.current) return;
    pendingCheck.current = true;
    try {
      const res = await fetch(`/api/checkout/status?payment_id=${encodeURIComponent(paymentId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      if (data.status === 'paid') {
        stopPolling();
        setStage('done');
        onPaid?.(paymentId);
      } else if (data.status === 'expired' || data.status === 'cancelled' || data.status === 'failed') {
        stopPolling();
        setStage('error');
        setMessage(
          data.status === 'expired'
            ? 'Tan peman an ekspire. Eseye ankò.'
            : 'Peman an te anile oswa li echwe. Eseye ankò.'
        );
      }
    } catch {
      /* rete an silans — pral eseye ankò */
    } finally {
      pendingCheck.current = false;
    }
  };

  const beginPolling = (id: string) => {
    setPaymentId(id);
    stopPolling();
    pollTimer.current = setInterval(() => void checkStatus(), 3500);
  };

  const start = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (!/^509\d{8}$/.test(cleaned)) {
      setPhoneError('Antre yon nimewo MonCash valab (509 + 8 chif).');
      return;
    }
    setPhoneError('');
    setMessage('');
    setStage('starting');

    // Ouvri yon onglet an premye — si pop-up bloke, kliyan an ap gen yon bouton apre.
    let popup: Window | null = null;
    try {
      popup = window.open('', '_blank');
    } catch {
      popup = null;
    }

    try {
      const result = await startPayment(cleaned);
      if (!result.ok) {
        if (popup) popup.close();
        setStage('error');
        setMessage(result.message || 'Pa t kapab kòmanse peman an.');
        return;
      }

      const resMode = result.checkout_mode === 'ussd' ? 'ussd' : 'hosted';
      setMode(resMode);
      setCheckoutUrl(result.checkout_url || '');

      if (resMode === 'hosted' && result.checkout_url) {
        if (popup) {
          popup.location.href = result.checkout_url;
        } else {
          window.open(result.checkout_url, '_blank', 'noopener');
        }
      } else if (popup) {
        popup.close();
      }

      setStage('pending');
      beginPolling(result.payment_id);
    } catch {
      if (popup) popup.close();
      setStage('error');
      setMessage('Erè koneksyon. Tcheke entènèt ou epi eseye ankò.');
    }
  };

  const reset = () => {
    stopPolling();
    setPaymentId('');
    setMode('hosted');
    setCheckoutUrl('');
    setMessage('');
    setPhoneError('');
    setStage('idle');
  };

  const reopenMonCash = () => {
    if (mode === 'hosted' && checkoutUrl) {
      window.open(checkoutUrl, '_blank', 'noopener');
    }
  };

  const idleDisabled = disabled || blocked;

  return (
    <div>
      {stage === 'idle' && (
        <button
          type="button"
          onClick={() => {
            setMessage('');
            setStage('phone');
          }}
          disabled={idleDisabled}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Smartphone size={20} />
          Peye {amountLabel} sou MonCash
        </button>
      )}

      {stage === 'phone' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-sm font-bold text-slate-900 mb-1">Antre nimewo MonCash ou</p>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            HatexCard ap voye yon <strong>USSD</strong> sou telefòn ou pou konfime peman an ak
            PIN ou — san ou pa bezwen peye sou yon lòt sit.
          </p>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="509 12 34 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void start();
            }}
            className="w-full bg-white border border-indigo-200 text-slate-900 text-base rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-indigo-400 font-semibold tracking-wide"
            maxLength={20}
            autoFocus
          />
          {phoneError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-3">
              {phoneError}
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => void start()}
              disabled={!phone.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <Smartphone size={16} />
              Voye USSD la
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-4 py-3 bg-white border border-gray-200 text-slate-600 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all"
            >
              Anile
            </button>
          </div>
        </div>
      )}

      {stage === 'starting' && (
        <button
          type="button"
          disabled
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 opacity-80 cursor-wait"
        >
          <Loader2 className="animate-spin" size={20} />
          Ap voye USSD sou telefòn ou…
        </button>
      )}

      {stage === 'pending' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 mb-4">
            <Loader2 className="animate-spin" size={26} />
          </div>
          <h3 className="text-base font-black text-slate-900 mb-1">
            {mode === 'ussd'
              ? 'Konfime peman an sou telefòn ou'
              : 'Konplete peman an sou MonCash'}
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            {mode === 'ussd' ? (
              <>
                MonCash voye yon demann USSD sou nimewo{' '}
                <strong className="text-slate-900">{phone}</strong>. Louvri mesaj la sou telefòn
                ou, antre PIN ou pou peye <strong>{amountLabel}</strong>. Paj sa a ap mete ajou
                otomatikman…
              </>
            ) : (
              <>
                Nou ap louvri paj MonCash la nan yon lòt onglet. Apre w fin konfime ak PIN ou sou
                telefòn ou, paj sa a ap mete ajou otomatikman…
              </>
            )}
          </p>
          <div className="flex gap-2 justify-center mt-4">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2.5 bg-white border border-gray-200 text-slate-600 font-semibold text-xs rounded-lg hover:bg-gray-50 transition-all"
            >
              Kanpe
            </button>
            <button
              type="button"
              onClick={() => void checkStatus()}
              className="px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-all"
            >
              Verifye kounye a
            </button>
          </div>
        </div>
      )}

      {stage === 'pending' && mode === 'hosted' && (
        <button
          type="button"
          onClick={reopenMonCash}
          className="w-full mt-2 bg-white border border-indigo-200 text-indigo-700 font-bold py-3 rounded-xl text-xs hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
        >
          <ExternalLink size={15} />
          Ouvri paj MonCash nan yon lòt onglet
        </button>
      )}

      {stage === 'done' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={44} />
          <h3 className="text-lg font-black text-emerald-800">Peman reyisi!</h3>
          <p className="text-xs text-emerald-700 mt-2 leading-relaxed">
            Mèsi. {amountLabel} peye — machann lan resevwa yon notifikasyon epi li pral kontakte
            ou talè. Ou ka fèmen paj sa a.
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-3" size={40} />
          <h3 className="text-base font-black text-red-700">Peman pa t fini</h3>
          <p className="text-xs text-red-600 mt-2 leading-relaxed">{message}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 px-5 py-2.5 bg-red-600 text-white font-bold text-xs rounded-lg hover:bg-red-700 transition-all"
          >
            Retounen epi eseye ankò
          </button>
        </div>
      )}
    </div>
  );
}
