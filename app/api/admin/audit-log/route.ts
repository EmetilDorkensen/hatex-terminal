import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin || !(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const db = createSupabaseAdminClient();
  const { data } = await db
    .from('admin_audit_log')
    .select('id, admin_email, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  return NextResponse.json({ entries: data || [] });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-audit-log:${ip}`, 60, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const admin = await requireAdminUser();
  if (!admin || !(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action.slice(0, 100) : '';
  if (!action) {
    return NextResponse.json({ error: 'Aksyon manke.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  await logAdminAction(db, {
    adminEmail: admin.user.email!,
    action,
    targetType: typeof body.targetType === 'string' ? body.targetType.slice(0, 50) : undefined,
    targetId: typeof body.targetId === 'string' ? body.targetId.slice(0, 100) : undefined,
    details: typeof body.details === 'object' && body.details !== null ? body.details : undefined,
    ip,
  });

  return NextResponse.json({ success: true });
}
