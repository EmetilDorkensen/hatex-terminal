import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import {
  buildLoginFailureUpdate,
  CAPTCHA_AFTER_ATTEMPTS,
  isLoginLocked,
  loginSuccessUpdate,
} from '@/lib/security/login-lockout';
import { isTurnstileEnabled, verifyTurnstileToken } from '@/lib/security/turnstile';

// Sistèm lockout pa KONT (pa email), an plis de rate-limit pa IP ki deja
// egziste sou `login-guard`. Paj login la rele wout sa a avan (action=check)
// AK apre (action=fail / action=success) chak tantativ modpas.
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`account-lock:${ip}`, 30, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { allowed: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const action = body.action as 'check' | 'fail' | 'success';
  const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : null;

  if (!email || !['check', 'fail', 'success'].includes(action)) {
    return NextResponse.json({ allowed: false, message: 'Demann pa valab.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select('id, failed_login_attempts, login_locked_until, account_status')
    .eq('email', email)
    .maybeSingle();

  // Pa gen kont ak email sa a — nou pa revele sa (evite enumerasyon kont),
  // sèlman kite Supabase Auth bay erè "Imèl oswa Modpas pa bon" pi devan.
  if (!profile) {
    return NextResponse.json({ allowed: true, require_captcha: false });
  }

  const lockCheck = isLoginLocked(profile);
  if (lockCheck.locked) {
    return NextResponse.json({ allowed: false, message: lockCheck.message }, { status: 429 });
  }

  const attempts = profile.failed_login_attempts || 0;
  const requireCaptcha = isTurnstileEnabled() && attempts >= CAPTCHA_AFTER_ATTEMPTS;

  if (action === 'check') {
    return NextResponse.json({ allowed: true, require_captcha: requireCaptcha });
  }

  if (requireCaptcha) {
    const captchaOk = await verifyTurnstileToken(captchaToken, ip);
    if (!captchaOk) {
      return NextResponse.json(
        { allowed: false, message: 'Verifikasyon CAPTCHA a echwe. Eseye ankò.', require_captcha: true },
        { status: 400 }
      );
    }
  }

  if (action === 'success') {
    await db.from('profiles').update(loginSuccessUpdate).eq('id', profile.id);
    return NextResponse.json({ allowed: true });
  }

  // action === 'fail'
  const failure = buildLoginFailureUpdate(attempts);
  await db.from('profiles').update(failure.update).eq('id', profile.id);

  if (failure.locked) {
    await sendLockoutAlert(email, ip);
  }

  return NextResponse.json({
    allowed: !failure.locked,
    message: failure.message,
    require_captcha: isTurnstileEnabled() && failure.attempts >= CAPTCHA_AFTER_ATTEMPTS,
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
    `⚠️ Sa ka yon tantativ brute-force.`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
    });
  } catch {
    /* pa bloke repons lan si Telegram pa reponn */
  }
}
