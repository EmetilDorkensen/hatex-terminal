import { NextResponse } from 'next/server';
import { verifySync } from 'otplib';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

function isCodeValidForSecret(code: string, secret: string) {
  if (!secret) return false;
  const result = verifySync({
    secret,
    token: code,
    epochTolerance: 60,
  });
  return result.valid;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte pou verifye MFA.' }, { status: 401 });
  }

  // Bloke brute-force sou kòd 6 chif la: pa IP epi pa itilizatè.
  const ip = getClientIp(request);
  const rl = await rateLimit(`mfa-confirm:${user.id}:${ip}`, 10, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ. Tanpri tann kèk minit.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const factorId = typeof body.factorId === 'string' ? body.factorId : '';
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '').trim() : '';
  const secret = typeof body.secret === 'string' ? body.secret.replace(/\s/g, '').toUpperCase() : '';

  if (!factorId) {
    return NextResponse.json({ success: false, message: 'Faktè MFA manke.' }, { status: 400 });
  }

  if (code.length !== 6) {
    return NextResponse.json({ success: false, message: 'Kòd la dwe gen 6 chif.' }, { status: 400 });
  }

  if (secret && !isCodeValidForSecret(code, secret)) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Kòd sa a pa matche ak QR ou eskane a. Efase tout ansyen antre HatexCard/Supabase nan app otantifikatè w la, eskane QR la ankò, epi verifye lè otomatik telefòn ou a.',
        serverTime: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (verifyErr) {
    const serverTime = new Date().toISOString();
    const message = secret && isCodeValidForSecret(code, secret)
      ? `Kòd la kòrèk sou aparèy ou a men sèvè a rejte l. Verifye dat/lè telefòn ou a (lè sèvè: ${serverTime}).`
      : verifyErr.message || 'Kòd la pa bon.';

    return NextResponse.json({ success: false, message, serverTime }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'MFA aktive avèk siksè!' });
}
