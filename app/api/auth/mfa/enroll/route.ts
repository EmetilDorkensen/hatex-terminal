import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte pou aktive MFA.' }, { status: 401 });
  }

  const { data: existing } = await supabase.auth.mfa.listFactors();
  const staleFactors = (existing?.all || []).filter((f) => f.status === 'unverified');
  for (const stale of staleFactors) {
    await supabase.auth.mfa.unenroll({ factorId: stale.id });
  }

  const friendlyName = `HatexCard-${Date.now()}`;
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
  });

  if (error || !data) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Pa t kapab kòmanse enskripsyon MFA.' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
    serverTime: new Date().toISOString(),
  });
}
