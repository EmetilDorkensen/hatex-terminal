import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, factors: [] }, { status: 401 });
  }

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    return NextResponse.json({ success: false, message: error.message, factors: [] }, { status: 400 });
  }

  const factors = ((data?.totp || []) as Array<{ id: string; friendly_name?: string; status: string; created_at: string }>)
    .filter((f) => f.status === 'verified');

  return NextResponse.json({ success: true, factors });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const factorId = typeof body.factorId === 'string' ? body.factorId : '';
  if (!factorId) {
    return NextResponse.json({ success: false, message: 'Faktè manke.' }, { status: 400 });
  }

  // 🔒 Step-up: pou retire yon faktè MFA VERIFYE, sesyon an dwe deja pase etap
  // 2 faktè a (aal2) nan sesyon aktyèl la. Sa anpeche yon sesyon vòlè ki gen
  // sèlman modpas (aal1) dezaktive MFA epi febli kont lan.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factorsList } = await supabase.auth.mfa.listFactors();
  const targetFactor = (factorsList?.all || []).find((f) => f.id === factorId);
  const isVerifiedFactor = targetFactor?.status === 'verified';

  if (isVerifiedFactor && aal?.currentLevel !== 'aal2') {
    return NextResponse.json(
      { success: false, message: 'Ou dwe konfime kòd MFA a (etap 2) anvan ou ka retire aparèy la.' },
      { status: 403 }
    );
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
