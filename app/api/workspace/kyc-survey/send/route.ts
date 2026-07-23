import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { sendKycSurveyToUser } from '@/lib/kyc/send-survey';

async function requireSupportStaff() {
  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.email) return { ok: false as const, status: 401, message: 'Ou dwe konekte.' };

  const gate = await assertFinanceOperatorWithGate(user.email);
  if (!gate.ok) {
    return { ok: false as const, status: 403, message: 'Aksè refize. Antre gate workspace/admin.' };
  }

  if (gate.role === 'staff') {
    const db = createSupabaseAdminClient();
    const { data: staff } = await db
      .from('staff_users')
      .select('role')
      .eq('email', user.email.trim().toLowerCase())
      .eq('status', 'active')
      .maybeSingle();
    if (!staff || !['support', 'super_admin'].includes(String(staff.role))) {
      return { ok: false as const, status: 403, message: 'Wòl ou pa gen dwa voye kesyonman KYC.' };
    }
  }

  return { ok: true as const, user };
}

/** Staff sipò: voye email kesyonman KYC bay yon kliyan. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ws-kyc-survey-send:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const auth = await requireSupportStaff();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.user_id === 'string' ? body.user_id : '';
  const force = body.force === true;

  if (!userId) {
    return NextResponse.json({ error: 'user_id manke.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const result = await sendKycSurveyToUser(db, userId, { force });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.already_recent && !force) {
    return NextResponse.json({
      success: true,
      already_recent: true,
      message: 'Email deja voye nan dènye 24 èdtan. Klike « Renvoy » pou voye ankò.',
      email: result.email,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Kesyonman voye bay ${result.email}`,
    email: result.email,
  });
}
