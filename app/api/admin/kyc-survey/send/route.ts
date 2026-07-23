import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { sendKycSurveyToUser } from '@/lib/kyc/send-survey';

/** Admin: voye email kesyonman KYC bay yon kliyan (klik bouton). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-kyc-survey-send:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const adminUser = await requireAdminUser();
  if (!adminUser || !(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
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
      message: 'Email deja voye nan dènye 24 èdtan. Klike ankò ak force si ou vle renvoy.',
      email: result.email,
    });
  }

  return NextResponse.json({
    success: true,
    message: `Kesyonman voye bay ${result.email}`,
    email: result.email,
  });
}
