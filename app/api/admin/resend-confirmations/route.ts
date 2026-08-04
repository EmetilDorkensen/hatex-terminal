import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { sendSignupConfirmEmail } from '@/lib/auth/send-confirm-email';

/**
 * Admin: renouvle imèl konfimasyon pou TOUT itilizatè ki poko konfime.
 * Body opsyonèl: { dry_run?: boolean, limit?: number }
 */
export async function POST(request: Request) {
  const adminUser = await requireAdminUser();
  if (!adminUser) {
    return NextResponse.json({ success: false, message: 'Pa otorize.' }, { status: 403 });
  }
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ success: false, message: 'Gate admin obligatwa.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dry_run === true;
  const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 2000);

  const admin = createSupabaseAdminClient();
  const pending: { id: string; email: string }[] = [];

  let page = 1;
  const perPage = 200;
  while (pending.length < limit) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }
    const users = data?.users || [];
    if (!users.length) break;

    for (const u of users) {
      if (!u.email || u.email_confirmed_at) continue;
      pending.push({ id: u.id, email: u.email.toLowerCase() });
      if (pending.length >= limit) break;
    }

    if (users.length < perPage) break;
    page += 1;
  }

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      pending_count: pending.length,
      emails: pending.map((p) => p.email),
    });
  }

  const results: { email: string; ok: boolean; message?: string }[] = [];
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    const result = await sendSignupConfirmEmail(admin, row.email);
    if (result.ok) {
      sent += 1;
      results.push({ email: row.email, ok: true });
    } else {
      failed += 1;
      results.push({ email: row.email, ok: false, message: result.message });
    }
    // Pa satije Resend — ti pause
    await new Promise((r) => setTimeout(r, 350));
  }

  return NextResponse.json({
    success: true,
    pending_count: pending.length,
    sent,
    failed,
    results,
  });
}
