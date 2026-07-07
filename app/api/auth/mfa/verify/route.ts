import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: 'Sesyon ekspire.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const factorId = typeof body.factorId === 'string' ? body.factorId : '';
  const code = typeof body.code === 'string' ? body.code.replace(/\D/g, '').trim() : '';

  if (!factorId || code.length !== 6) {
    return NextResponse.json({ success: false, message: 'Kòd MFA envalid.' }, { status: 400 });
  }

  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeErr || !challenge) {
    return NextResponse.json(
      { success: false, message: challengeErr?.message || 'Pa t kapab verifye MFA.' },
      { status: 400 }
    );
  }

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (verifyErr) {
    return NextResponse.json(
      { success: false, message: verifyErr.message || 'Kòd MFA a pa bon.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
