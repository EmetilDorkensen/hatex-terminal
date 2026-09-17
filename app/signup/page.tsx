"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, Gift, AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { checkStrongPassword } from '@/lib/security/password-strength';
import GoogleContinueButton from '@/components/auth/GoogleContinueButton';

function errorText(err: unknown, fallback: string): string {
  if (typeof err === 'string') {
    const t = err.trim();
    if (t && t !== '{}' && t !== '[object Object]') return t;
  }
  if (err && typeof err === 'object') {
    const anyErr = err as {
      message?: unknown;
      msg?: unknown;
      error?: unknown;
      error_description?: unknown;
    };
    for (const candidate of [
      anyErr.message,
      anyErr.msg,
      anyErr.error_description,
      anyErr.error,
    ]) {
      if (typeof candidate === 'string') {
        const t = candidate.trim();
        if (t && t !== '{}' && t !== '[object Object]') return t;
      }
    }
  }
  return fallback;
}

function SignupForm() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [loginClosed, setLoginClosed] = useState(false);
  const [loginClosedMessage, setLoginClosedMessage] = useState('');

  useEffect(() => {
    const promoFromUrl = searchParams.get('promo');
    if (promoFromUrl) {
      localStorage.setItem('hatex_promo', promoFromUrl);
      setPromoCode(promoFromUrl.toUpperCase());
    } else {
      const savedPromo = localStorage.getItem('hatex_promo');
      if (savedPromo) setPromoCode(savedPromo.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/login-guard');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data.login_enabled === false) {
          setLoginClosed(true);
          setLoginClosedMessage(
            data.message ||
              'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la. Eseye ankò pita.'
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: '', text: '' });

    if (loginClosed) {
      setMsg({
        type: 'error',
        text: loginClosedMessage || 'Enskripsyon fèmen tanporèman.',
      });
      setLoading(false);
      return;
    }

    if (!acceptTerms) {
      setMsg({
        type: 'error',
        text: 'Ou dwe aksepte Akò Sèvis ak Kondisyon Itilizasyon HatexCard anvan ou kreye kont.',
      });
      setLoading(false);
      return;
    }

    const strength = checkStrongPassword(password);
    if (!strength.valid) {
      setMsg({ type: 'error', text: strength.message || 'Modpas la twò fèb.' });
      setLoading(false);
      return;
    }

    try {
      // Enskripsyon sou sèvè (admin) — pa itilize SMTP Supabase ki ap kraze.
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          promo_code: promoCode.trim().toUpperCase(),
          accept_terms: true,
        }),
      });
      const json = await res.json().catch(() => ({} as Record<string, unknown>));
      const text = errorText(json.message ?? json.msg ?? json.error, '');

      if (!res.ok || json.success === false) {
        if (res.status === 503 || json.login_closed) {
          setLoginClosed(true);
          if (text) setLoginClosedMessage(text);
        }
        setMsg({
          type: 'error',
          text: text || 'Pa t kapab kreye kont lan. Eseye ankò.',
        });
        return;
      }

      localStorage.removeItem('hatex_promo');
      setMsg({
        type: 'success',
        text:
          text ||
          'Kont la kreye! Nou voye yon imèl konfimasyon — tcheke inbox / spam ou.',
      });
    } catch {
      setMsg({
        type: 'error',
        text: 'Koneksyon echwe. Verifye entènèt ou epi eseye ankò.',
      });
    } finally {
      setLoading(false);
    }
  };

  const resendConfirm = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean) {
      setMsg({ type: 'error', text: 'Antre imèl ou anvan.' });
      return;
    }
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      const res = await fetch('/api/auth/send-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      });
      const json = await res.json().catch(() => ({} as Record<string, unknown>));
      const apiMsg = errorText(json.message ?? json.msg ?? json.error, '');
      setMsg({
        type: res.ok ? 'success' : 'error',
        text: apiMsg || (res.ok ? 'Imèl konfimasyon renouvle.' : 'Pa t kapab voye.'),
      });
    } catch {
      setMsg({ type: 'error', text: 'Koneksyon echwe.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-gray-200 shadow-xl shadow-slate-200/50">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <img src="https://i.imgur.com/xDk58Xk.png" alt="HatexCard Logo" className="w-14 h-14 object-contain" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-1">Hatexcard</h1>
        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-indigo-500" /> Kreye Yon Kont Nouvo
        </p>
      </div>

      {loginClosed && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-900 text-xs font-bold uppercase tracking-wider mb-1">Enskripsyon fèmen</p>
            <p className="text-amber-800 text-[11px] font-medium leading-relaxed">
              {loginClosedMessage || 'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la.'}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-5">
        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Adrès Imèl</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              placeholder="kliyan@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Modpas Sekirize</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="password"
              placeholder="Min 10 karaktè + majiskil + chif + senbòl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"
              minLength={10}
              autoComplete="new-password"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1.5 ml-1">
              Omwen 10 karaktè, yon majiskil, yon miniskil, yon chif, ak yon senbòl.
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider ml-1">Kòd Pwomo (Opsyonèl)</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Gift className="h-5 w-5 text-indigo-400" />
            </div>
            <input
              type="text"
              placeholder="EX: Hatex2026"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              className="w-full pl-11 pr-4 py-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm font-bold text-indigo-700 placeholder:text-indigo-300 uppercase tracking-widest"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 text-left cursor-pointer select-none mt-2">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            required
          />
          <span className="text-[11px] text-slate-600 font-medium leading-relaxed">
            Mwen li epi mwen aksepte{' '}
            <Link href="/terms" target="_blank" className="text-indigo-600 font-bold hover:underline">
              Akò Sèvis ak Kondisyon Itilizasyon
            </Link>{' '}
            ak{' '}
            <Link href="/politik" target="_blank" className="text-indigo-600 font-bold hover:underline">
              Politik Konfidansyalite
            </Link>{' '}
            HatexCard. Mwen konprann HatexCard se yon pasèl (pa yon bank / wallet).
          </span>
        </label>

        {msg.text && (
          <div className={`p-4 rounded-xl mt-4 flex items-start gap-3 border ${msg.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {msg.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
            <p className="text-[11px] font-bold uppercase tracking-wider leading-relaxed">{msg.text}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || loginClosed}
          className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl font-bold uppercase tracking-wider shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all text-xs mt-6 text-white disabled:opacity-70 flex justify-center items-center gap-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Ap Kreye Kont Lan...</> : 'Kreye Kont Mwen'}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-100" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-slate-400">
          <span className="bg-white px-3">oswa</span>
        </div>
      </div>

      <GoogleContinueButton
        disabled={loading || !acceptTerms}
        blocked={loginClosed}
        blockedMessage={loginClosedMessage || 'Enskripsyon fèmen tanporèman.'}
        onError={(message) => setMsg({ type: 'error', text: message })}
      />
      {!acceptTerms && !loginClosed && (
        <p className="text-[10px] text-slate-400 text-center mt-2 font-medium">
          Make bwat kondisyon yo anvan ou kontinye ak Google.
        </p>
      )}

      <div className="mt-8 text-center space-y-4 pt-6 border-t border-gray-100">
        <button
          type="button"
          disabled={loading}
          onClick={() => void resendConfirm()}
          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold uppercase tracking-wider disabled:opacity-60"
        >
          Pa resevwa imèl la? Renouvle konfimasyon
        </button>
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
          Ou gen kont deja? <Link href="/login" className="text-indigo-600 hover:text-indigo-800 transition-colors ml-1">Konekte La</Link>
        </p>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <Suspense
        fallback={
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
            <p className="text-sm font-semibold text-slate-600 tracking-wide uppercase">Chajman...</p>
          </div>
        }
      >
        <SignupForm />
      </Suspense>

      <div className="mt-10 flex items-center gap-3 opacity-40">
        <div className="h-px w-8 bg-slate-400"></div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Secured by Hatex Group</span>
        <div className="h-px w-8 bg-slate-400"></div>
      </div>
    </div>
  );
}
