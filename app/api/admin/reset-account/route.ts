import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser, verifyAdminPassword } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

/**
 * Reyinisyalize kont kliyan: balans 0, retire ajan/antrepriz, kenbe KYC.
 * Admin + gate + modpas konfimasyon.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-reset-account:${ip}`, 10, 600);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = String(body.user_id || '');
  const password = typeof body.password === 'string' ? body.password : '';

  if (!userId) {
    return NextResponse.json({ error: 'user_id obligatwa.' }, { status: 400 });
  }
  if (!password || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: 'Modpas admin pa bon.' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, full_name, kyc_status')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Kont pa jwenn.' }, { status: 404 });
  }

  const { data, error } = await db.rpc('admin_reset_client_account', { p_user_id: userId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const res = data as { success?: boolean; message?: string } | null;
  if (!res?.success) {
    return NextResponse.json({ error: res?.message || 'Echèk reset.' }, { status: 400 });
  }

  await logAdminAction(db, {
    adminEmail: admin.user.email!,
    action: 'CLIENT_ACCOUNT_RESET',
    targetType: 'profile',
    targetId: userId,
    details: {
      email: profile.email,
      full_name: profile.full_name,
      kept_kyc: profile.kyc_status,
    },
    ip,
  });

  return NextResponse.json({
    success: true,
    message: 'Kont reyinisyalize (balans 0, ajan/antrepriz retire, KYC kenbe).',
    result: res,
  });
}
