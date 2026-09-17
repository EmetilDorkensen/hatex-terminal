'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2 } from 'lucide-react';
import { googleOAuthRedirectTo } from '@/lib/auth/google-oauth';

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

type Props = {
  disabled?: boolean;
  blocked?: boolean;
  blockedMessage?: string;
  onError?: (message: string) => void;
  className?: string;
};

export default function GoogleContinueButton({
  disabled,
  blocked,
  blockedMessage,
  onError,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;
    if (blocked) {
      onError?.(
        blockedMessage ||
          'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la.'
      );
      return;
    }

    setLoading(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: googleOAuthRedirectTo('/auth/complete'),
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        onError?.(error.message || 'Pa t kapab louvri Google.');
        setLoading(false);
      }
    } catch {
      onError?.('Koneksyon echwe. Eseye ankò.');
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={() => void handleClick()}
      className={
        className ||
        'w-full bg-white hover:bg-slate-50 border border-gray-200 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs text-slate-800 shadow-sm active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center items-center gap-3'
      }
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          Ap louvri Google...
        </>
      ) : (
        <>
          <GoogleGlyph className="w-5 h-5 shrink-0" />
          Kontinye ak Google
        </>
      )}
    </button>
  );
}
