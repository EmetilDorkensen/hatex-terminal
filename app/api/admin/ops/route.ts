import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

/**
 * Aksyon admin (sispann, promo, anons, ekip) — service_role.
 * Pa gen UPDATE/INSERT dirèk nan navigatè.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-ops:${ip}`, 60, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Twòp demann. Eseye nan ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const db = createSupabaseAdminClient();
  const email = admin.user.email!;

  try {
    if (action === 'suspend_account') {
      const userId = String(body.user_id || '');
      if (!userId) return NextResponse.json({ error: 'user_id manke.' }, { status: 400 });
      const { error } = await db.from('profiles').update({ account_status: 'suspended' }).eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(db, {
        adminEmail: email,
        action: 'ACCOUNT_SUSPENDED',
        targetType: 'profile',
        targetId: userId,
        details: { target_email: body.target_email },
        ip,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'unsuspend_account') {
      const userId = String(body.user_id || '');
      if (!userId) return NextResponse.json({ error: 'user_id manke.' }, { status: 400 });
      const { error } = await db
        .from('profiles')
        .update({ account_status: 'active', is_activated: true, failed_otp_attempts: 0 })
        .eq('id', userId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(db, {
        adminEmail: email,
        action: 'ACCOUNT_UNSUSPENDED',
        targetType: 'profile',
        targetId: userId,
        details: { target_email: body.target_email },
        ip,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'update_announcement') {
      const text = typeof body.text === 'string' ? body.text : '';
      const active = body.active !== false;
      const { error } = await db
        .from('global_settings')
        .update({ announcement_text: text, announcement_active: active })
        .eq('id', 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(db, {
        adminEmail: email,
        action: 'ANNOUNCEMENT_UPDATED',
        targetType: 'global_settings',
        targetId: '1',
        details: { active, length: text.length },
        ip,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'create_promo') {
      const code = String(body.code || '')
        .trim()
        .toUpperCase();
      const reward = Number(body.reward_amount);
      if (!code || !(reward > 0)) {
        return NextResponse.json({ error: 'Kòd ak reward obligatwa.' }, { status: 400 });
      }
      const { error } = await db.from('promo_codes').insert([{ code, reward_amount: reward }]);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(db, {
        adminEmail: email,
        action: 'PROMO_CREATED',
        targetType: 'promo_codes',
        targetId: code,
        details: { reward_amount: reward },
        ip,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_row') {
      const table = String(body.table || '');
      const id = String(body.id || '');
      const allowed = new Set(['deposits', 'withdrawals', 'promo_codes']);
      if (!allowed.has(table) || !id) {
        return NextResponse.json({ error: 'Tablo oswa id pa valab.' }, { status: 400 });
      }
      const { error } = await db.from(table).delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(db, {
        adminEmail: email,
        action: 'ROW_DELETED',
        targetType: table,
        targetId: id,
        ip,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'invite_staff') {
      const inviteEmail = String(body.email || '')
        .trim()
        .toLowerCase();
      const role = String(body.role || 'support');
      if (!inviteEmail || !inviteEmail.includes('@')) {
        return NextResponse.json({ error: 'Imèl pa valab.' }, { status: 400 });
      }
      const { data: existing } = await db
        .from('staff_users')
        .select('id')
        .eq('email', inviteEmail)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'Imèl sa a gentan sourejistre nan ekip la.' }, { status: 400 });
      }
      const { data: profile } = await db
        .from('profiles')
        .select('full_name')
        .eq('email', inviteEmail)
        .maybeSingle();
      const { error } = await db.from('staff_users').insert({
        email: inviteEmail,
        full_name: profile?.full_name || 'Anplwaye',
        role,
        status: 'pending',
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(db, {
        adminEmail: email,
        action: 'STAFF_INVITED',
        targetType: 'staff_users',
        targetId: inviteEmail,
        details: { role },
        ip,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'revoke_staff') {
      const id = String(body.id || '');
      if (!id) return NextResponse.json({ error: 'id manke.' }, { status: 400 });
      const { error } = await db.from('staff_users').delete().eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await logAdminAction(db, {
        adminEmail: email,
        action: 'STAFF_REVOKED',
        targetType: 'staff_users',
        targetId: id,
        details: { target_email: body.target_email },
        ip,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Aksyon enkoni.' }, { status: 400 });
  } catch (err: unknown) {
    console.error('admin ops:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
