"use client";



import React, { useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import Script from 'next/script';

import { createBrowserClient } from '@supabase/ssr';

import { Mail, Lock, KeyRound, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import GoogleContinueButton from '@/components/auth/GoogleContinueButton';



export default function Login() {

  const [loginMethod, setLoginMethod] = useState<'password' | 'pin' | 'recovery'>('password');

  const [email, setEmail] = useState('');

  const [password, setPassword] = useState('');

  const [pin, setPin] = useState('');

  const [recoveryCode, setRecoveryCode] = useState('');

  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');

  // Etap MFA (TOTP) — sèlman kont ki gen yon aparèy otantifikatè anrejistre
  // (egzanp: admin) ap wè etap sa a apre modpas/PIN yo bon.
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // CAPTCHA (Cloudflare Turnstile) — parèt apre plizyè tantativ echwe.
  // Token nan ref pou pa pèdi li si React state poko update; reset widget
  // apre chak echèk pou itilizatè a ka verifye ankò (evite « Succès » san token).
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [loginClosed, setLoginClosed] = useState(false);
  const [loginClosedMessage, setLoginClosedMessage] = useState('');
  const captchaRef = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<string | number | null>(null);
  const captchaTokenRef = useRef('');
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const clearCaptchaToken = () => {
    captchaTokenRef.current = '';
    setCaptchaToken('');
  };

  const resetCaptchaWidget = () => {
    clearCaptchaToken();
    try {
      const turnstile = (window as any).turnstile;
      if (turnstile && captchaWidgetId.current != null) {
        turnstile.reset(captchaWidgetId.current);
      }
    } catch {
      /* ignore */
    }
  };

  const storeCaptchaToken = (token: string) => {
    captchaTokenRef.current = token;
    setCaptchaToken(token);
  };

  // Si sistèm nan dekonekte nou paske yon LÒT aparèy konekte sou menm kont
  // lan (gade middleware.ts), montre yon mesaj klè olye yon paj vid.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_replaced') {
      setErrorMsg("Ou te dekonekte paske kont ou konekte sou yon lòt aparèy. Yon kont Hatexcard ka sèlman konekte sou YON SÈL aparèy alafwa.");
    }
    const err = params.get('error');
    if (err === 'login_closed') {
      const message = params.get('message');
      setLoginClosed(true);
      if (message) setLoginClosedMessage(message);
      setErrorMsg(message || 'Paj koneksyon an fèmen tanporèman.');
    } else if (err === 'google_no_email') {
      setErrorMsg('Google pa bay yon imèl. Eseye yon lòt kont Google.');
    } else if (err === 'auth_callback' || err === 'google_session' || err === 'google_complete') {
      setErrorMsg('Koneksyon Google echwe. Eseye ankò.');
    } else if (err === 'missing_code') {
      setErrorMsg('Koneksyon an pa t konplete. Eseye ankò.');
    }
  }, []);

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
        /* ignore — kite fòm nan louvri si check echwe */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!requireCaptcha || !turnstileSiteKey || !captchaRef.current) return;
    if (captchaWidgetId.current != null) return;

    let cancelled = false;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const renderWidget = () => {
      if (cancelled || !captchaRef.current || captchaWidgetId.current != null) return;
      const turnstile = (window as any).turnstile;
      if (!turnstile) return;
      captchaWidgetId.current = turnstile.render(captchaRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'light',
        size: 'normal',
        appearance: 'always',
        callback: (token: string) => storeCaptchaToken(token),
        'expired-callback': () => clearCaptchaToken(),
        'error-callback': () => {
          clearCaptchaToken();
          try {
            if (captchaWidgetId.current != null) turnstile.reset(captchaWidgetId.current);
          } catch {
            /* ignore */
          }
        },
        'timeout-callback': () => {
          clearCaptchaToken();
          try {
            if (captchaWidgetId.current != null) turnstile.reset(captchaWidgetId.current);
          } catch {
            /* ignore */
          }
        },
      });
    };

    if ((window as any).turnstile) {
      renderWidget();
    } else {
      pollId = setInterval(() => {
        if ((window as any).turnstile) {
          renderWidget();
          if (pollId) clearInterval(pollId);
        }
      }, 200);
    }

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
    };
  }, [requireCaptcha, turnstileSiteKey]);



  // Sèvi ak createBrowserClient pou li ka mache ak Middleware la

  const supabase = createBrowserClient(

    process.env.NEXT_PUBLIC_SUPABASE_URL!,

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  );



  const goAfterLogin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('id', user.id)
          .maybeSingle();
        if (!profile?.plan) {
          window.location.href = '/plan';
          return;
        }
      }
    } catch {
      /* ale sou dashboard kòm fallback */
    }
    window.location.href = '/dashboard';
  };

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
        credentials: 'include',
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
    const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalErr) {
      console.error('MFA AAL:', aalErr.message);
      return false;
    }
    if (!aal || aal.nextLevel !== 'aal2' || aal.currentLevel === aal.nextLevel) {
      return false;
    }

    const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
    if (factorsErr) {
      console.error('MFA factors:', factorsErr.message);
      return false;
    }

    const verified = (factorsData?.totp || []).filter((f) => f.status === 'verified');
    const totpFactor = verified.sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )[0];

    if (!totpFactor) return false;

    const { error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      setErrorMsg('Sesyon ekspire. Rekonekte ak modpas ou.');
      return false;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setErrorMsg('Sesyon pa konplè. Rekonekte ak modpas ou, epi eseye ankò.');
      return false;
    }

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeErr || !challenge?.id) {
      setErrorMsg(challengeErr?.message || 'Pa t kapab kòmanse etap MFA. Eseye rekonekte.');
      return false;
    }

    setMfaFactorId(totpFactor.id);
    setMfaChallengeId(challenge.id);
    setMfaRequired(true);
    return true;
  };

  const resetMfaStep = async () => {
    setMfaRequired(false);
    setMfaFactorId('');
    setMfaChallengeId('');
    setMfaCode('');
    setErrorMsg('');
    await supabase.auth.signOut();
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = mfaCode.replace(/\D/g, '').trim();
    if (code.length !== 6) {
      setErrorMsg("Kòd MFA a dwe gen 6 chif.");
      return;
    }
    if (!mfaFactorId) {
      setErrorMsg("Faktè MFA pa jwenn. Dekonekte epi rekonekte.");
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factorId: mfaFactorId,
          challengeId: mfaChallengeId || undefined,
          code,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const serverTime = data.serverTime
          ? new Date(data.serverTime).toLocaleString('ht-HT')
          : new Date().toLocaleString('ht-HT');
        setErrorMsg(
          data.message?.toLowerCase().includes('sub')
            ? 'Sesyon MFA ekspire. Klike "Rekonekte" anba a epi antre modpas ou ankò.'
            : data.message?.includes('Invalid') || data.message?.includes('invalid')
              ? `Kòd MFA a pa bon oswa li ekspire. Verifye lè telefòn ou a (lè sèvè: ${serverTime}).`
              : data.message || 'Kòd MFA a pa bon. Eseye ankò.'
        );
        setMfaCode('');
        setLoading(false);
        return;
      }

      await supabase.auth.refreshSession();

      const { data: aalAfter } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalAfter?.currentLevel !== 'aal2') {
        await supabase.auth.refreshSession();
      }

      // Tag deja mete apre modpas; refresh li apre MFA pou konfime cookie a
      await trackDeviceAndIP(email);
      await goAfterLogin();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erè nan verifikasyon MFA.");
      setLoading(false);
    }
  };



  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault();

    setLoading(true);

    setErrorMsg('');



    try {

      const guardRes = await fetch('/api/auth/login-guard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (guardRes.status === 503) {
        const guardData = await guardRes.json().catch(() => ({}));
        setLoginClosed(true);
        setLoginClosedMessage(guardData.message || '');
        setErrorMsg(guardData.message || "Paj koneksyon an fèmen tanporèman.");
        setLoading(false);
        return;
      }
      if (guardRes.status === 429) {
        const guardData = await guardRes.json();
        setErrorMsg(guardData.message || "Twòp tantativ koneksyon. Eseye pita.");
        setLoading(false);
        return;
      }

      if (loginMethod === 'password') {

        // ==========================================
        // 1. KONEKSYON AK MODPAS — sèlman atravè API sèvè
        // (CAPTCHA + lockout anvan Auth — pa gen signInWithPassword nan navigatè)
        // ==========================================

        const emailLower = email.trim().toLowerCase();
        const activeCaptchaToken = captchaTokenRef.current || captchaToken;

        if (requireCaptcha && !activeCaptchaToken) {
          setErrorMsg('Tanpri konplete verifikasyon CAPTCHA anba a (bwat Cloudflare), epi eseye ankò.');
          setLoading(false);
          return;
        }

        const pwdRes = await fetch('/api/auth/password-login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: emailLower,
            password,
            captchaToken: activeCaptchaToken || null,
          }),
        });
        const pwdData = await pwdRes.json().catch(() => ({}));

        if (pwdRes.status === 503 || pwdData.login_closed) {
          setLoginClosed(true);
          setLoginClosedMessage(pwdData.message || '');
          setErrorMsg(pwdData.message || 'Paj koneksyon an fèmen tanporèman.');
          setLoading(false);
          return;
        }

        if (!pwdRes.ok || !pwdData.success) {
          if (pwdData.require_captcha) setRequireCaptcha(true);
          setErrorMsg(pwdData.message || 'Imèl oswa modpas la pa kòrèk');
          resetCaptchaWidget();
          setLoading(false);
          return;
        }

        if (pwdData.access_token && pwdData.refresh_token) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token: pwdData.access_token,
            refresh_token: pwdData.refresh_token,
          });
          if (sessErr) {
            setErrorMsg('Pa t kapab kreye sesyon. Eseye ankò.');
            setLoading(false);
            return;
          }
        } else {
          await supabase.auth.getSession();
        }

        await trackDeviceAndIP(email);

        if (pwdData.mfa_required || (await requiresMfaStepUp())) {
          setLoading(false);
          return;
        }

        await goAfterLogin();

      } else if (loginMethod === 'recovery') {

        // ==========================================
        // 3. KONEKSYON AK KÒD AKSÈ INIK (REKIPERASYON)
        // Pou kliyan ki bliye/efase kòd MFA li, modpas oswa PIN li.
        // Kòd la boule apre itilizasyon; MFA reyinisyalize → /mfa-setup.
        // ==========================================

        if (recoveryCode.trim().length < 10) {
          setErrorMsg("Antre kòd aksè inik ou (fòma: HTX-XXXX-XXXX-XXXX-XXXX).");
          setLoading(false);
          return;
        }

        const recRes = await fetch('/api/auth/recovery-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), code: recoveryCode.trim() }),
        });
        const recData = await recRes.json().catch(() => ({}));

        if (!recRes.ok || !recData.success) {
          setErrorMsg(recData.message || "Email oswa kòd aksè pa bon.");
          setLoading(false);
          return;
        }

        const { error: recOtpErr } = await supabase.auth.verifyOtp({
          token_hash: recData.token_hash,
          type: 'magiclink',
        });

        if (recOtpErr) {
          console.error('Recovery session error:', recOtpErr.message);
          setErrorMsg("Pa kapab kreye sesyon. Eseye ankò oswa kontakte sipò.");
          setLoading(false);
          return;
        }

        await trackDeviceAndIP(email);

        // MFA efase — proxy ap voye l sou /mfa-setup pou konfigire yon nouvo
        alert("Kòd aksè verifye! Kòd MFA ou reyinisyalize — w ap konfigire yon nouvo kounye a. Sonje jenere yon NOUVO kòd aksè nan Paramèt apre sa.");
        window.location.href = '/mfa-setup';

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

        // generateLink(magiclink) retounen hashed_token — verifyOtp bezwen token_hash, pa token+email
        const { error: otpErr } = await supabase.auth.verifyOtp({
          token_hash: rpcData.token_hash,
          type: 'magiclink',
        });

        if (otpErr) {
          console.error('PIN session error:', otpErr.message);
          setErrorMsg("Pa kapab kreye sesyon. Eseye ak modpas oswa re-aktive PIN nan Paramèt.");
          setLoading(false);
          return;
        }

        // Session-tag anvan MFA (menm rezon ak koneksyon modpas)
        await trackDeviceAndIP(email);

        if (await requiresMfaStepUp()) {
          setLoading(false);
          return;
        }

        await goAfterLogin();

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

        {loginClosed && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-900 text-xs font-bold uppercase tracking-wider mb-1">Koneksyon fèmen</p>
              <p className="text-amber-800 text-[11px] font-medium leading-relaxed">
                {loginClosedMessage || 'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la.'}
              </p>
            </div>
          </div>
        )}

       

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
            <button
              type="button"
              onClick={resetMfaStep}
              className="w-full text-slate-500 hover:text-indigo-600 py-2 text-[10px] font-bold uppercase tracking-wider"
            >
              Rekonekte
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

          <button

            type="button"

            onClick={() => { setLoginMethod('recovery'); setErrorMsg(''); }}

            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${loginMethod === 'recovery' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' : 'text-slate-500 hover:text-slate-700'}`}

          >

            Kòd Aksè

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

          ) : loginMethod === 'recovery' ? (

            <div className="space-y-1.5 text-left animate-in fade-in slide-in-from-bottom-2 duration-300">

              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Kòd Aksè Inik</label>

              <div className="relative">

                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">

                  <KeyRound className="h-5 w-5 text-slate-400" />

                </div>

                <input

                  type="text"

                  placeholder="HTX-XXXX-XXXX-XXXX-XXXX"

                  value={recoveryCode}

                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}

                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-bold font-mono tracking-wider text-slate-900 placeholder:text-slate-300"

                  required

                />

              </div>

              <p className="text-[10px] text-slate-500 mt-2 ml-1 leading-relaxed bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">

                Sèvi ak kòd aksè inik ou te sere a si ou <strong>bliye kòd MFA, modpas oswa PIN ou</strong>.
                Apre koneksyon, MFA ou ap reyinisyalize epi w ap konfigire yon nouvo.

              </p>

              <Link
                href="/rekiperasyon"
                className="block text-center mt-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-bold uppercase tracking-wider hover:bg-amber-100 transition-colors"
              >
                Ou pa t gentan kopye kòd aksè a? Itilize yon lòt mwayen →
              </Link>

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
            <div className="pt-2 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
                Konplete verifikasyon an anba a anvan ou konekte
              </p>
              <div className="flex justify-center">
                <div ref={captchaRef} />
              </div>
              {(captchaTokenRef.current || captchaToken) ? (
                <p className="text-[10px] font-semibold text-emerald-600 text-center uppercase tracking-wider">
                  Verifikasyon OK — ou ka konekte
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-amber-700 text-center uppercase tracking-wider">
                  Tann oswa klike sou bwat Cloudflare la
                </p>
              )}
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

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-100" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-slate-400">
            <span className="bg-white px-3">oswa</span>
          </div>
        </div>

        <GoogleContinueButton
          disabled={loading || mfaRequired}
          onError={(message) => setErrorMsg(message)}
        />
          </>
        )}

        {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />}



        <div className="mt-8 text-center space-y-4 pt-6 border-t border-gray-100">

          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">

            Ou pa gen kont? <Link href="/signup" className="text-indigo-600 hover:text-indigo-800 transition-colors ml-1">Kreye yon kont</Link>

          </p>

          <button
            type="button"
            disabled={loading || !email.trim()}
            onClick={async () => {
              const clean = email.trim().toLowerCase();
              if (!clean) {
                setErrorMsg('Antre imèl ou pou renouvle konfimasyon an.');
                return;
              }
              setLoading(true);
              setErrorMsg('');
              try {
                const res = await fetch('/api/auth/send-confirm', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: clean }),
                });
                const json = await res.json().catch(() => ({}));
                setErrorMsg('');
                alert(json.message || 'Si kont la poko konfime, n ap voye yon nouvo lyen.');
              } catch {
                setErrorMsg('Pa t kapab voye imèl konfimasyon.');
              } finally {
                setLoading(false);
              }
            }}
            className="inline-flex items-center justify-center w-full mt-2 px-4 py-3 rounded-xl border border-amber-100 bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider hover:bg-amber-100 transition-colors disabled:opacity-60"
          >
            Pa resevwa imèl konfimasyon? Renouvle l
          </button>

          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center w-full mt-2 px-4 py-3 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider hover:bg-indigo-100 transition-colors"
          >
            Mwen bliye modpas mwen — chanje l isit
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

