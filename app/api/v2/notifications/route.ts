import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { maskPhone } from '@/lib/payouts/phones';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('hatex_notifications')
    .select('id, kind, title, body, href, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ error: { code: 'db_error', message: error.message } }, { status: 500 });
  }

  const { data: attempts } = await admin
    .from('hatex_payout_attempts')
    .select('id, receiver_phone, amount, status, error_message, moncash_transaction_id, created_at')
    .eq('merchant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(40);

  const unreadCount = (data || []).filter((n) => !n.read_at).length;
  return NextResponse.json({
    notifications: data || [],
    unread_count: unreadCount,
    transfers: (attempts || []).map((a) => ({
      id: a.id,
      phone: maskPhone(String(a.receiver_phone || '')),
      amount: Number(a.amount || 0),
      status: a.status,
      error: a.error_message,
      tx: a.moncash_transaction_id,
      created_at: a.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.action !== 'mark_read') {
    return NextResponse.json({ error: { code: 'bad_request' } }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const ids = Array.isArray(body.ids) ? body.ids.slice(0, 50) : null;
  const now = new Date().toISOString();

  const query = admin
    .from('hatex_notifications')
    .update({ read_at: now })
    .eq('user_id', user.id)
    .is('read_at', null);

  const { error } = ids ? await query.in('id', ids) : await query;

  if (error) {
    return NextResponse.json({ error: { code: 'db_error', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
