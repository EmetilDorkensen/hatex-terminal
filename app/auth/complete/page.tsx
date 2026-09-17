'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2 } from 'lucide-react';

/**
 * Apre Google OAuth: mete session-tag (yon sèl aparèy), epi voye sou plan/dashboard.
 */
export default function AuthCompletePage() {
  const [msg, setMsg] = useState('Ap finalize koneksyon an...');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = '/login?error=google_session';
          return;
        }

        await fetch('/api/auth/track-login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device: navigator.userAgent }),
        });

        if (cancelled) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.plan && user.email?.toLowerCase() !== 'adminhatexcard@gmail.com') {
          window.location.href = '/plan';
          return;
        }

        window.location.href = '/dashboard';
      } catch {
        if (!cancelled) {
          setMsg('Erè. Ap retounen sou paj koneksyon...');
          window.location.href = '/login?error=google_complete';
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{msg}</p>
    </div>
  );
}
