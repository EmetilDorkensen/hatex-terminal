import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { mapKycAppForStaff } from '@/lib/kyc-v2/staff-view';

export const dynamic = 'force-dynamic';

/**
 * Lis demann KYC an atant — tout enfo + nimewo ID dechifre.
 * Admin (gate) + anplwaye sipò/super_admin (workspace gate).
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`staff-kyc-pending:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ ok: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const gate = await assertFinanceOperatorWithGate(user.email);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, message: 'Aksè refize.' }, { status: 403 });
  }

  if (gate.role === 'staff') {
    const db = createSupabaseAdminClient();
    const { data: staff } = await db
      .from('staff_users')
      .select('role')
      .eq('email', user.email.trim().toLowerCase())
      .eq('status', 'active')
      .maybeSingle();
    if (!staff || !['support', 'super_admin', 'compliance'].includes(String(staff.role))) {
      return NextResponse.json(
        { ok: false, message: 'Wòl ou pa gen dwa wè dosye KYC.' },
        { status: 403 }
      );
    }
  }

  const db = createSupabaseAdminClient();
  const url = new URL(request.url);
  const userId = (url.searchParams.get('userId') || '').trim();

  if (userId) {
    const { data: app } = await db
      .from('hatex_kyc_applications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!app) {
      return NextResponse.json({ ok: true, item: null });
    }
    return NextResponse.json({
      ok: true,
      item: mapKycAppForStaff(app as unknown as Record<string, unknown>),
    });
  }

  const { data: apps } = await db
    .from('hatex_kyc_applications')
    .select('*')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(100);

  const items = (apps || []).map((app) =>
    mapKycAppForStaff(app as unknown as Record<string, unknown>)
  );
  return NextResponse.json({ ok: true, items });
}
