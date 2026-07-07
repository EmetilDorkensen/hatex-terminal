import { NextResponse } from 'next/server';
import { verifySync } from 'otplib';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';

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

  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr || !challenge) {
    return NextResponse.json(
      { success: false, message: challengeErr?.message || 'Pa t kapab kòmanse verifikasyon MFA. Eseye rekòmanse enskripsyon an.' },
      { status: 400 }
    );
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
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
