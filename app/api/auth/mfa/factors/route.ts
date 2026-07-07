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

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
