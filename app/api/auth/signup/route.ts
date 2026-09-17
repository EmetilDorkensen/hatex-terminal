import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { checkStrongPassword } from '@/lib/security/password-strength';
import { sendSignupConfirmEmail } from '@/lib/auth/send-confirm-email';
import { assertLoginAllowed } from '@/lib/auth/login-access';

function errMsg(err: unknown): string {
  if (!err || typeof err !== 'object') return '';
  const e = err as { message?: unknown; msg?: unknown; error_description?: unknown; code?: unknown };
  for (const c of [e.message, e.msg, e.error_description]) {
    if (typeof c === 'string' && c.trim() && c.trim() !== '{}') return c.trim();
  }
  if (typeof e.code === 'string' && e.code.trim()) return e.code.trim();
  return '';
}

/**
 * Enskripsyon atravè service role — pa pase SMTP Supabase
 * (SMTP Auth souvan kraze ak "Error sending confirmation email").
 * Konfimasyon ale atravè Brevo.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`signup:${ip}`, 6, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  // Non pa mande ankò nan signup — nou sèvi ak pati anvan @ imèl la kòm non default.
  const fullName =
    (typeof body.full_name === 'string' && body.full_name.trim()) ||
    email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ||
    'Kliyan';
  const password = typeof body.password === 'string' ? body.password : '';
  const acceptTerms = body.accept_terms === true;
  const promoCode =
    typeof body.promo_code === 'string' ? body.promo_code.trim().toUpperCase() : '';

  const access = await assertLoginAllowed(email);
  if (!access.ok) {
    return NextResponse.json(
      { success: false, login_closed: true, message: access.message },
      { status: 503 }
    );
  }

  if (!acceptTerms) {
    return NextResponse.json(
      {
        success: false,
        message: 'Ou dwe aksepte Akò Sèvis ak Kondisyon Itilizasyon HatexCard anvan ou kreye kont.',
      },
      { status: 400 }
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { success: false, message: 'Imèl pa valab.' },
      { status: 400 }
    );
  }

  const strength = checkStrongPassword(password);
  if (!strength.valid) {
    return NextResponse.json(
      { success: false, message: strength.message || 'Modpas la twò fèb.' },
      { status: 400 }
    );
  }

  const db = createSupabaseAdminClient();
  let discountAmount = 0;

  if (promoCode) {
    const { data: promoData, error: promoError } = await db
      .from('promo_codes')
      .select('code, usage_count, max_uses, reward_amount')
      .eq('code', promoCode)
      .maybeSingle();

    if (promoError || !promoData) {
      return NextResponse.json(
        { success: false, message: 'Kòd Pwomo sa a pa valab oswa li pa egziste nan sistèm nan!' },
        { status: 400 }
      );
    }
    if (promoData.max_uses !== null && promoData.usage_count >= promoData.max_uses) {
      return NextResponse.json(
        {
          success: false,
          message: `Kòd Pwomo ${promoCode} an atenn limit li. Li pa valab ankò!`,
        },
        { status: 400 }
      );
    }
    discountAmount = Number(promoData.reward_amount || 0);
  }

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    const raw = errMsg(createError);
    const lower = raw.toLowerCase();
    if (
      lower.includes('already') ||
      lower.includes('registered') ||
      lower.includes('exists') ||
      createError?.status === 422
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Imèl sa a gen yon kont sou li deja! Tanpri fè Konekte (Login).',
        },
        { status: 409 }
      );
    }
    console.error('signup createUser:', createError);
    return NextResponse.json(
      {
        success: false,
        message: raw && raw !== 'Error sending confirmation email'
          ? raw
          : 'Pa t kapab kreye kont lan. Eseye ankò.',
      },
      { status: 400 }
    );
  }

  const userId = created.user.id;

  const { error: profileError } = await db.from('profiles').upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      kyc_status: 'not_submitted',
      used_promo: promoCode || null,
    },
    { onConflict: 'id' }
  );
  if (profileError) {
    console.error('signup profile upsert:', profileError.message);
  }

  if (discountAmount > 0) {
    const { error: discountError } = await db.from('user_discounts').insert({
      user_id: userId,
      promo_code: promoCode,
      discount_amount: discountAmount,
    });
    if (discountError) {
      console.error('signup discount:', discountError.message);
    }
  }

  const mail = await sendSignupConfirmEmail(db, email);
  if (!mail.ok) {
    console.error('signup confirm email:', mail.message);
    return NextResponse.json({
      success: true,
      message:
        'Kont la kreye, men imèl konfimasyon an pa t ale. Itilize « Renouvle konfimasyon » sou paj la.',
      email_sent: false,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Kont la kreye! Nou voye yon imèl konfimasyon — tcheke inbox / spam ou.',
    email_sent: true,
  });
}
