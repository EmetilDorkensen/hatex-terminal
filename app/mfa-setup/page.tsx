"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, ShieldCheck } from 'lucide-react';
import MfaSettings from '@/app/components/MfaSettings';

/**
 * Paj obligatwa aprè kreyasyon kont / premye koneksyon.
 * Bloke jiskaske omwens 1 faktè TOTP verifye ekziste.
 */
export default function MfaSetupPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data } = await supabase.auth.mfa.listFactors();
      const active = (data?.totp || []).filter((f) => f.status === 'verified');
      if (!cancelled) {
        if (active.length > 0) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('plan')
            .eq('id', user.id)
            .maybeSingle();
          router.replace(profile?.plan ? '/dashboard' : '/plan');
        } else {
          setChecking(false);
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
              Etap obligatwa
            </p>
            <h1 className="text-lg font-bold text-slate-900">Aktive MFA anvan ou kontinye</h1>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Pou pwoteje kont ou ak lajan machann ou, HatexCard mande{' '}
          <strong>otantifikasyon 2 etap (TOTP)</strong> pou tout moun. Enstale yon aplikasyon
          otantifikatè (Google Authenticator, Authy, 1Password …), eskane QR la, epi antre kòd 6
          chif la pou fini.
        </p>

        <MfaSettings
          supabase={supabase}
          title="Otantifikatè TOTP"
          subtitle="Obligatwa — pa gen aksè san MFA"
          emptyMessage="Ou pa gen okenn aparèy otantifikasyon ankò. Klike Aktive MFA anba a."
        />

        <p className="text-[11px] text-slate-500 mt-6 leading-relaxed">
          Aprè verifikasyon an, ou pral redirije nan dashboard ou otomatikman. Kenbe kòd rekiperasyon
          w yo nan yon kote sekirize.
        </p>
      </div>
    </div>
  );
}
