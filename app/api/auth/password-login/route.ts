import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { assertLoginAllowed } from '@/lib/auth/login-access';
import {
  buildLoginFailureUpdate,
  CAPTCHA_AFTER_ATTEMPTS,
  isLoginLocked,
  loginSuccessUpdate,
} from '@/lib/security/login-lockout';
import { isTurnstileEnabled, verifyTurnstileToken } from '@/lib/security/turnstile';

export const dynamic = 'force-dynamic';

const GENERIC_FAIL = 'Imèl oswa modpas la pa kòrèk';

/**
 * Koneksyon modpas SOU SÈVÈ — CAPTCHA + lockout + login-close ANVAN Auth.
 * Paj /login pa rele signInWithPassword nan navigatè a.
 *
 * Pou bloke apèl dirèk ak anon key sou Supabase Auth tou:
 * Supabase → Authentication → Attack Protection → aktive CAPTCHA (Turnstile)
 * ak menm Site Key / Secret. Nou pase `options.captchaToken` deja.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`password-login:${ip}`, 20, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : null;

  if (!email || !email.includes('@') || !password) {
    return NextResponse.json({ success: false, message: GENERIC_FAIL }, { status: 400 });
  }

  const access = await assertLoginAllowed(email);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, login_closed: true, message: access.message },
      { status: 503 }
    );
  }

  const db = createSupabaseAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select('id, failed_login_attempts, login_locked_until, account_status')
    .eq('email', email)
    .maybeSingle();

  if (profile) {
    const lockCheck = isLoginLocked(profile);
    if (lockCheck.locked) {
      return NextResponse.json(
        { success: false, message: lockCheck.message, locked: true },
        { status: 429 }
      );
    }
  }

  const attempts = profile?.failed_login_attempts || 0;
  const requireCaptcha = isTurnstileEnabled() && attempts >= CAPTCHA_AFTER_ATTEMPTS;

  if (requireCaptcha) {
    if (!captchaToken) {
      return NextResponse.json(
        {
          success: false,
          require_captcha: true,
          message: 'Tanpri konplete verifikasyon CAPTCHA anba a, epi eseye ankò.',
        },
        { status: 400 }
      );
    }
    const captchaOk = await verifyTurnstileToken(captchaToken, ip);
    if (!captchaOk) {
      return NextResponse.json(
        {
          success: false,
          require_captcha: true,
          message: 'Verifikasyon CAPTCHA a echwe. Eseye ankò.',
        },
        { status: 400 }
      );
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    ...(captchaToken ? { options: { captchaToken } } : {}),
  });

  if (error || !data?.user) {
    let failMessage = GENERIC_FAIL;
    let requireCaptchaAfter = false;

    if (profile) {
      const failure = buildLoginFailureUpdate(attempts);
      await db.from('profiles').update(failure.update).eq('id', profile.id);
      if (failure.locked) {
        failMessage = failure.message;
        await sendLockoutAlert(email, ip);
      }
      requireCaptchaAfter =
        isTurnstileEnabled() && failure.attempts >= CAPTCHA_AFTER_ATTEMPTS;
    }

    return NextResponse.json(
      {
        success: false,
        message: failMessage,
        require_captcha: requireCaptchaAfter,
      },
      { status: 401 }
    );
  }

  const { data: statusRow } = await db
    .from('profiles')
    .select('account_status')
    .eq('id', data.user.id)
    .maybeSingle();

  if (statusRow?.account_status === 'suspended') {
    await supabase.auth.signOut();
    return NextResponse.json(
      {
        success: false,
        suspended: true,
        message: 'Aksè Refize! Kont ou sispandi. Tanpri kontakte sipò a.',
      },
      { status: 403 }
    );
  }

  if (profile) {
    await db.from('profiles').update(loginSuccessUpdate).eq('id', profile.id);
  }

  let mfaRequired = false;
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      mfaRequired = (factorsData?.totp || []).some((f) => f.status === 'verified');
    }
  } catch {
    mfaRequired = false;
  }

  return NextResponse.json({
    success: true,
    mfa_required: mfaRequired,
    user_id: data.user.id,
    email: data.user.email,
    // Kliyan an rele setSession — pi fyab pase konte sèlman sou Set-Cookie nan Route Handler
    access_token: data.session?.access_token || null,
    refresh_token: data.session?.refresh_token || null,
  });
}

async function sendLockoutAlert(email: string, ip: string) {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const msg =
    `🚨 <b>KONT BLOKE — TWÒP TANTATIV KONEKSYON</b>\n` +
    `📧 ${email}\n` +
    `🌐 IP: ${ip}\n` +
    `⚠️ password-login (sèvè)`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
    });
  } catch {
    /* ignore */
  }
}
