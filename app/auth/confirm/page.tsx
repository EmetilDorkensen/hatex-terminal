'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('Ap konfime imèl ou…');

  useEffect(() => {
    const run = async () => {
      const tokenHash = searchParams.get('token_hash');
      const type = (searchParams.get('type') || 'magiclink') as
        | 'magiclink'
        | 'email'
        | 'signup';
      const code = searchParams.get('code');

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (error) throw error;
        } else {
          // Implicit hash tokens (si Supabase redirect ak #access_token)
          const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
          const accessToken = hash.get('access_token');
          const refreshToken = hash.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          } else {
            throw new Error('Lyen konfimasyon pa konplè.');
          }
        }

        setStatus('ok');
        setMessage('Imèl konfime! N ap mennen ou nan kont ou…');
        setTimeout(() => router.replace('/dashboard'), 1200);
      } catch (err: unknown) {
        setStatus('error');
        setMessage(
          err instanceof Error
            ? err.message
            : 'Lyen an ekspire oswa pa valab. Mande yon nouvo nan paj enskripsyon / koneksyon.'
        );
      }
    };
    void run();
  }, [router, searchParams]);

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-gray-200 shadow-xl text-center">
      {status === 'loading' && (
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
      )}
      {status === 'ok' && (
        <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-4" />
      )}
      {status === 'error' && (
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-4" />
      )}
      <p className="text-sm font-semibold text-slate-800">{message}</p>
      {status === 'error' && (
        <div className="mt-6 space-y-2">
          <Link href="/login" className="block text-indigo-600 font-bold text-xs uppercase">
            Ale nan Konekte
          </Link>
          <Link href="/signup" className="block text-slate-500 font-bold text-xs uppercase">
            Enskri ankò
          </Link>
        </div>
      )}
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        }
      >
        <ConfirmInner />
      </Suspense>
    </div>
  );
}
