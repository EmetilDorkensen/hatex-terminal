import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { verifyMfaTotpCode } from '@/lib/auth/mfa-totp';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: 'Sesyon ekspire. Rekonekte.' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rl = await rateLimit(`mfa-verify:${user.id}:${ip}`, 10, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ. Tanpri tann kèk minit.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const factorId = typeof body.factorId === 'string' ? body.factorId : '';
  const code = typeof body.code === 'string' ? body.code : '';
  const challengeId = typeof body.challengeId === 'string' ? body.challengeId : null;

  if (!factorId) {
    return NextResponse.json({ success: false, message: 'Faktè MFA manke.' }, { status: 400 });
  }

  const result = await verifyMfaTotpCode(supabase, factorId, code, challengeId);

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message || 'Kòd MFA a pa bon.',
        serverTime: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  await supabase.auth.refreshSession();

  return NextResponse.json({ success: true, serverTime: new Date().toISOString() });
}
