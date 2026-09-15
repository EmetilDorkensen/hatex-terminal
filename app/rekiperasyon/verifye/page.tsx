"use client";

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Kliyan an rive isit la atravè lyen email rekiperasyon an (valab 1 èdtan).
 * Nou verifye token an, efase MFA pèdi a, kreye sesyon, epi voye l sou /mfa-setup.
 */
function RedeemInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [state, setState] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState('');
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return;
    ranOnce.current = true;

    const run = async () => {
      if (!token || token.length < 32) {
        setState('error');
        setMessage('Lyen an pa konplè. Klike sou lyen ki nan imèl ou a dirèkteman.');
        return;
      }

      try {
        const res = await fetch('/api/auth/account-recovery/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.success) {
          setState('error');
          setMessage(data.message || 'Lyen an pa valab oswa li ekspire.');
          return;
        }

        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: 'magiclink',
        });

        if (otpErr) {
          console.error('Recovery verifyOtp:', otpErr.message);
          setState('error');
          setMessage('Pa t kapab kreye sesyon. Kontakte asistans lan pou yon nouvo lyen.');
          return;
        }

        // Session-tag pou proxy la
        await fetch('/api/auth/track-login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device: navigator.userAgent }),
        }).catch(() => {});

        setState('success');
        setMessage('Verifikasyon reyisi! N ap mennen w konfigire yon nouvo kòd MFA...');
        setTimeout(() => {
          window.location.href = '/mfa-setup';
        }, 1800);
      } catch {
        setState('error');
        setMessage('Erè rezo. Eseye ouvri lyen an ankò.');
      }
    };

    void run();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white p-10 rounded-3xl border border-gray-200 shadow-xl text-center">
        {state === 'working' && (
          <>
            <Loader2 className="w-12 h-12 text-[#1d4ed8] mx-auto mb-5 animate-spin" />
            <h1 className="text-lg font-bold text-slate-900 mb-2">Ap verifye lyen an...</h1>
            <p className="text-sm text-slate-500">Tanpri tann yon ti moman.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-5" />
            <h1 className="text-lg font-bold text-slate-900 mb-2">Idantite w konfime!</h1>
            <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="w-14 h-14 text-rose-500 mx-auto mb-5" />
            <h1 className="text-lg font-bold text-slate-900 mb-3">Lyen an pa mache</h1>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">{message}</p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-6">
              Si lyen an ekspire (1 èdtan pase), kontakte asistans lan — se yo ki ka
              verifye w ankò epi voye yon nouvo lyen.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/rekiperasyon"
                className="bg-[#1d4ed8] text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-blue-800 transition-all"
              >
                Fè yon nouvo demann
              </Link>
              <Link
                href="/kontakte"
                className="text-slate-500 hover:text-[#1d4ed8] text-xs font-bold uppercase tracking-wider py-2"
              >
                Kontakte asistans
              </Link>
            </div>
          </>
        )}

        <p className="text-[10px] text-slate-400 mt-8 flex items-center justify-center gap-1.5">
          <ShieldCheck size={12} /> HatexCard — Rekiperasyon sekirize
        </p>
      </div>
    </div>
  );
}

export default function RecoveryRedeemPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-[#1d4ed8] animate-spin" />
        </div>
      }
    >
      <RedeemInner />
    </Suspense>
  );
}
