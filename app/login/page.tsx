"use client";



import React, { useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import Script from 'next/script';

import { createBrowserClient } from '@supabase/ssr';

import { Mail, Lock, KeyRound, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';



export default function Login() {

  const [loginMethod, setLoginMethod] = useState<'password' | 'pin'>('password');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [pin, setPin] = useState('');

  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  // Etap MFA (TOTP) — sèlman kont ki gen yon aparèy otantifikatè anrejistre
  // (egzanp: admin) ap wè etap sa a apre modpas/PIN yo bon.
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // CAPTCHA (Cloudflare Turnstile) — parèt sèlman apre plizyè tantativ echwe
  // sou menm kont lan, epi sèlman si sit la konfigire ak yon site key.
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  // Si sistèm nan dekonekte nou paske yon LÒT aparèy konekte sou menm kont
  // lan (gade middleware.ts), montre yon mesaj klè olye yon paj vid.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_replaced') {
      setErrorMsg("Ou te dekonekte paske kont ou konekte sou yon lòt aparèy. Yon kont Hatexcard ka sèlman konekte sou YON SÈL aparèy alafwa.");
    }
  }, []);

  useEffect(() => {
    if (!requireCaptcha || !turnstileSiteKey || !captchaRef.current || captchaWidgetId.current) return;

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      if (turnstile && captchaRef.current && !captchaWidgetId.current) {
        captchaWidgetId.current = turnstile.render(captchaRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setCaptchaToken(token),
        });
      }
    };

    if ((window as any).turnstile) {
      renderWidget();
      return;
    }
    const interval = setInterval(() => {
      if ((window as any).turnstile) {
        renderWidget();
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [requireCaptcha, turnstileSiteKey]);



  // Sèvi ak createBrowserClient pou li ka mache ak Middleware la

  const supabase = createBrowserClient(

    process.env.NEXT_PUBLIC_SUPABASE_URL!,

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  );



  // ==========================================

  // TRACKING IP AK APARÈY

  // ==========================================

  const trackDeviceAndIP = async (userEmail: string) => {

    try {

      // Sèvè a idantifye IP la (pi fyab pase yon rekèt kliyan bò kote li),
      // konpare l ak dènye youn ki konnen an, epi voye yon alèt Telegram si
      // se yon nouvo aparèy/IP pou kont sa a.

      await fetch('/api/auth/track-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: navigator.userAgent }),
      });

    } catch (e) {

      console.error("Tracking error (ignored):", e);

      // Nou inyore erè a pou l pa anpeche kliyan an konekte si entènèt li twò dousman

    }

  };



  // ==========================================
  // MFA (TOTP) STEP-UP — apre modpas/PIN reyisi, Supabase di nou si sesyon
  // an bezwen yon dezyèm faktè (aal2) anvan li konplè. Sa a aplike sèlman
  // pou kont ki DEJA anrejistre yon aparèy otantifikatè (egzanp: admin).
  // Retounen `true` si nou kanpe pwosesis la pou mande kòd MFA la.
  // ==========================================
  const requiresMfaStepUp = async (): Promise<boolean> => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aal || aal.nextLevel !== 'aal2' || aal.currentLevel === aal.nextLevel) {
      return false;
    }

    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const totpFactor = factorsData?.totp?.find((f) => f.status === 'verified');
    if (!totpFactor) return false;

    setMfaFactorId(totpFactor.id);
    setMfaRequired(true);
    return true;
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      setErrorMsg("Kòd MFA a dwe gen 6 chif.");
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: mfaCode.trim(),
      });

      if (verifyErr) {
        setErrorMsg(verifyErr.message || "Kòd MFA a pa bon oswa li ekspire. Verifye lè aparèy ou a kòrèk.");
        setMfaCode('');
        setLoading(false);
        return;
      }

      await trackDeviceAndIP(email);
      window.location.href = '/dashboard';
    } catch (err: any) {
      setErrorMsg(err.message || "Erè nan verifikasyon MFA.");
      setLoading(false);
    }
  };



  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault();

    setLoading(true);

    setErrorMsg('');



    try {

      const guardRes = await fetch('/api/auth/login-guard', { method: 'POST' });
      if (guardRes.status === 429) {
        const guardData = await guardRes.json();
        setErrorMsg(guardData.message || "Twòp tantativ koneksyon. Eseye pita.");
        setLoading(false);
        return;
      }

      if (loginMethod === 'password') {

        // ==========================================

        // 1. KONEKSYON AK MODPAS

        // ==========================================

        const emailLower = email.trim().toLowerCase();

        // Lockout pa KONT (an plis de rate-limit pa IP anwo a) — bloke si
        // kont sa a gen twòp echèk resamman, epi mande CAPTCHA si aktive.
        const lockRes = await fetch('/api/auth/account-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailLower, action: 'check' }),
        });
        const lockData = await lockRes.json().catch(() => ({}));

        if (!lockRes.ok || !lockData.allowed) {
          setErrorMsg(lockData.message || "Kont ou bloke tanporèman.");
          setLoading(false);
          return;
        }

        if (lockData.require_captcha) {
          setRequireCaptcha(true);
          if (!captchaToken) {
            setErrorMsg("Tanpri konplete verifikasyon CAPTCHA anba a.");
            setLoading(false);
            return;
          }
        }

        const { data, error } = await supabase.auth.signInWithPassword({

          email: email.trim(),

          password,

        });



        if (error) {

          const failRes = await fetch('/api/auth/account-lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailLower, action: 'fail', captchaToken }),
          });
          const failData = await failRes.json().catch(() => ({}));

          setErrorMsg(failData.message || "Email oswa Modpas pa bon. Verifye yo byen.");
          if (failData.require_captcha) setRequireCaptcha(true);
          setCaptchaToken('');

          setLoading(false);

          return;

        }



        if (data?.user) {

          // VERIFYE SI KONT LAN TE SISPANDI ANVAN L ANTRE SOU DASHBOARD LA

          const { data: profile } = await supabase

            .from('profiles')

            .select('account_status')

            .eq('id', data.user.id)

            .single();



          if (profile?.account_status === 'suspended') {

            await supabase.auth.signOut(); // Fout li deyò menm kote a!

            setErrorMsg("Aksè Refize! Kont ou sispandi. Tanpri kontakte sipò a.");

            setLoading(false);

            return;

          }



          // Modpas te bon — reset konte echèk yo pou kont sa a
          fetch('/api/auth/account-lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailLower, action: 'success' }),
          }).catch(() => {});

          // Si kont sa a gen MFA aktive, kanpe isit la epi mande kòd la
          if (await requiresMfaStepUp()) {
            setLoading(false);
            return;
          }

          // 🚨 PRAN IP AK APARÈY LA ANVAN L ALE 🚨

          await trackDeviceAndIP(email);



          // Sèvi ak replace epi fose yon refresh pou Middleware la wè nouvo Cookie a

          window.location.href = '/dashboard';

        }



      } else {

        // ==========================================

        // 2. KONEKSYON AK PIN (4 CHIF)

        // ==========================================

        if (pin.length !== 4) {

          setErrorMsg("PIN lan dwe gen egzakteman 4 chif.");

          setLoading(false);

          return;

        }



        // Rele API sekirize pou verifye PIN (hash + lockout + rate limit)
        const pinRes = await fetch('/api/auth/pin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), pin }),
        });
        const rpcData = await pinRes.json();

        if (!pinRes.ok || !rpcData.success) {
          setErrorMsg(rpcData.message || "Gen yon pwoblèm nan verifye PIN ou an. Eseye ankò.");
          setLoading(false);
          return;
        }

        const { error: otpErr } = await supabase.auth.verifyOtp({
          email: rpcData.email,
          token: rpcData.token_hash,
          type: 'email',
        });

        if (otpErr) {
          setErrorMsg("Pa kapab kreye sesyon. Eseye ak modpas.");
          setLoading(false);
          return;
        }

        if (await requiresMfaStepUp()) {
          setLoading(false);
          return;
        }

        await trackDeviceAndIP(email);
        window.location.href = '/dashboard';

      }

    } catch (err) {

      setErrorMsg("Gen yon pwoblèm rezo, eseye ankò.");

      setLoading(false);

    }

  };



  return (

    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">

      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-3xl border border-gray-200 shadow-xl shadow-slate-200/50">

       

        {/* LOGO AK TIT */}

        <div className="text-center mb-8">

          <div className="flex justify-center mb-4">

            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100">

              <img src="https://i.imgur.com/xDk58Xk.png" alt="HatexCard Logo" className="w-14 h-14 object-contain" />

            </div>

          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-1">HatexCard</h1>

          <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold flex items-center justify-center gap-1.5">

            <ShieldCheck size={14} className="text-emerald-500" /> Koneksyon Sekirize

          </p>

        </div>



        {mfaRequired ? (
          <form onSubmit={handleMfaVerify} className="space-y-5">
            <div className="text-center mb-2">
              <ShieldCheck className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">Verifikasyon 2 Etap (MFA)</p>
              <p className="text-xs text-slate-500 mt-1">Antre kòd 6 chif ki nan app otantifikatè w la.</p>
            </div>

            <div className="relative max-w-[220px] mx-auto">
              <input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                maxLength={6}
                autoFocus
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-center text-xl tracking-[0.4em] text-slate-900"
                required
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mt-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-rose-700 text-[11px] font-bold uppercase tracking-wider leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl font-bold uppercase tracking-wider shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all text-xs mt-6 text-white disabled:opacity-70 flex justify-center items-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Ap Verifye...</> : "Konfime Kòd la"}
            </button>
          </form>
        ) : (
          <>
        {/* BOUTON POU CHWAZI KIJAN W AP KONEKTE A */}

        <div className="flex bg-slate-100 p-1.5 rounded-xl mb-8">

          <button

            type="button"

            onClick={() => { setLoginMethod('password'); setErrorMsg(''); }}

            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${loginMethod === 'password' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' : 'text-slate-500 hover:text-slate-700'}`}

          >

            Modpas

          </button>

          <button

            type="button"

            onClick={() => { setLoginMethod('pin'); setErrorMsg(''); }}

            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${loginMethod === 'pin' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' : 'text-slate-500 hover:text-slate-700'}`}

          >

            PIN 4 Chif

          </button>

        </div>



        <form onSubmit={handleLogin} className="space-y-5">

          <div className="space-y-1.5 text-left">

            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Adrès Imèl</label>

            <div className="relative">

              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">

                <Mail className="h-5 w-5 text-slate-400" />

              </div>

              <input

                type="email"

                placeholder="moun@email.com"

                value={email}

                onChange={(e) => setEmail(e.target.value)}

                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-900 placeholder:text-slate-400"

                required

              />

            </div>

          </div>



          {loginMethod === 'password' ? (

            <div className="space-y-1.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">

              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Modpas</label>

              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">

                  <Lock className="h-5 w-5 text-slate-400" />

                </div>

                <input

                  type="password"

                  placeholder="••••••••"

                  value={password}

                  onChange={(e) => setPassword(e.target.value)}

                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium tracking-widest text-slate-900 placeholder:text-slate-400"

                  required

                />

              </div>

            </div>

          ) : (

            <div className="space-y-1.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">

              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1 text-center block">Kòd PIN (4 Chif)</label>

              <div className="relative max-w-[200px] mx-auto">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">

                  <KeyRound className="h-5 w-5 text-slate-400" />

                </div>

                <input

                  type="password"

                  placeholder="••••"

                  maxLength={4}

                  value={pin}

                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}

                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold text-center text-xl tracking-[0.5em] text-slate-900 placeholder:text-slate-300"

                  required

                />

              </div>

            </div>

          )}



          {requireCaptcha && turnstileSiteKey && (
            <div className="flex justify-center pt-2">
              <div ref={captchaRef}></div>
            </div>
          )}



          {errorMsg && (

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mt-4 flex items-start gap-3">

               <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />

               <p className="text-rose-700 text-[11px] font-bold uppercase tracking-wider leading-relaxed">{errorMsg}</p>

            </div>

          )}



          <button

            type="submit"

            disabled={loading}

            className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-xl font-bold uppercase tracking-wider shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all text-xs mt-6 text-white disabled:opacity-70 flex justify-center items-center gap-2"

          >

            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Ap Verifye...</> : "Antre Nan Kont Mwen"}

          </button>

        </form>
          </>
        )}

        {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />}



        <div className="mt-8 text-center space-y-4 pt-6 border-t border-gray-100">

          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">

            Ou pa gen kont? <Link href="/signup" className="text-indigo-600 hover:text-indigo-800 transition-colors ml-1">Kreye yon kont</Link>

          </p>

          <Link href="/forgot-password" className="inline-block">

            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hover:text-indigo-500 transition-colors">

               Mwen bliye modpas mwen

            </p>

          </Link>

        </div>

      </div>

     

      <div className="mt-10 flex items-center gap-3 opacity-40">

         <div className="h-px w-8 bg-slate-400"></div>

         <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Secured by Hatex Group</span>

         <div className="h-px w-8 bg-slate-400"></div>

      </div>

    </div>

  );

} 

