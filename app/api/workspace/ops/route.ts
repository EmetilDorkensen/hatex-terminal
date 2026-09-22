import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';

/**
 * Aksyon espas travay (sispann / debloke kont) — sèlman staff + gate.
 * Pa UPDATE profiles dirèkteman nan navigatè.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`workspace-ops:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp demann. Eseye nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const gate = await assertFinanceOperatorWithGate(user.email);
  if (!gate.ok) {
    return NextResponse.json(
      { success: false, message: 'Aksè refize. Antre gate workspace anvan.' },
      { status: 403 }
    );
  }

  if (gate.role === 'staff') {
    const dbCheck = createSupabaseAdminClient();
    const { data: staff } = await dbCheck
      .from('staff_users')
      .select('role')
      .eq('email', user.email.trim().toLowerCase())
      .eq('status', 'active')
      .maybeSingle();
    if (!staff || !['support', 'super_admin', 'cashier'].includes(String(staff.role))) {
      return NextResponse.json(
        { success: false, message: 'Wòl ou pa gen dwa chanje estati kont.' },
        { status: 403 }
      );
    }
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const targetUserId = typeof body.user_id === 'string' ? body.user_id : '';

  if (!targetUserId) {
    return NextResponse.json({ success: false, message: 'user_id manke.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();

  if (action === 'set_account_status') {
    const status = body.status === 'suspended' ? 'suspended' : body.status === 'active' ? 'active' : null;
    if (!status) {
      return NextResponse.json({ success: false, message: 'Estati pa valab.' }, { status: 400 });
    }

    const update =
      status === 'active'
        ? { account_status: 'active', failed_otp_attempts: 0 }
        : { account_status: 'suspended', failed_otp_attempts: 0 };

    const { error } = await db.from('profiles').update(update).eq('id', targetUserId);
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    try {
      const { data: staffRow } = await db
        .from('staff_users')
        .select('id, full_name, role')
        .eq('email', user.email.trim().toLowerCase())
        .eq('status', 'active')
        .maybeSingle();
      if (staffRow) {
        await db.from('staff_activity_log').insert({
          staff_id: staffRow.id,
          staff_name: staffRow.full_name,
          staff_role: staffRow.role,
          action: status === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_UNSUSPENDED',
          target_type: 'profile',
          target_id: targetUserId,
          details: { target_email: body.target_email || null, via: 'workspace_ops' },
        });
      }
    } catch {
      /* log opsyonèl */
    }

    return NextResponse.json({ success: true, account_status: status });
  }

  return NextResponse.json({ success: false, message: 'Aksyon enkoni.' }, { status: 400 });
}
