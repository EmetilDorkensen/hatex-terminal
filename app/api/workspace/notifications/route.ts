import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { broadcastNotification } from '@/lib/notify/broadcast';

/**
 * Anplwaye (sipò / sipè admin) oswa admin ekri yon notifikasyon in-app
 * ki parèt nan klòch « Notifikasyon » chak kliyan.
 */
async function requireNotificationSender() {
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
      return { ok: false as const, status: 403, message: 'Wòl ou pa gen dwa voye notifikasyon.' };
    }
  }

  return { ok: true as const, user };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`ws-notif-broadcast:${ip}`, 12, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann. Eseye pita.' }, { status: 429 });
  }

  const auth = await requireNotificationSender();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const db = createSupabaseAdminClient();

  const result = await broadcastNotification(db, {
    title: typeof body.title === 'string' ? body.title : '',
    body: typeof body.body === 'string' ? body.body : '',
    kind: typeof body.kind === 'string' ? body.kind : 'announcement',
    href: typeof body.href === 'string' ? body.href : undefined,
    targetEmail: typeof body.target_email === 'string' ? body.target_email : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, count: result.count });
}
