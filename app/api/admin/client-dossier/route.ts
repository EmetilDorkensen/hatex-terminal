import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

const PROFILE_DOSSIER_SELECT = `
  id, email, full_name, business_name,
  created_at, account_status, account_type, enterprise_status,
  kyc_status, kyc_doc_type, kyc_front, kyc_back, kyc_selfie,
  kyc_submitted_at, kyc_rejection_reason, kyc_face_match_score, kyc_fee_paid,
  wallet_balance, card_balance, is_card_activated, is_merchant,
  agent_status, agent_tier, card_number
`;

function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%_,]/g, ' ').trim().slice(0, 120);
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-client-dossier:${ip}`, 60, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const admin = await requireAdminUser();
  if (!admin || !(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId')?.trim() || '';
  const rawQ = url.searchParams.get('q')?.trim() || '';
  const q = sanitizeSearchTerm(rawQ);

  const db = createSupabaseAdminClient();

  if (userId) {
    const { data: profile, error } = await db
      .from('profiles')
      .select(PROFILE_DOSSIER_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      return NextResponse.json({ error: 'Kliyan pa jwenn.' }, { status: 404 });
    }

    const [{ data: enterpriseApps }, { data: agentApps }, { data: recentTx }] = await Promise.all([
      db
        .from('enterprise_applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('agent_applications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('transactions')
        .select('id, amount, type, description, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    await logAdminAction(db, {
      adminEmail: admin.user.email!,
      action: 'CLIENT_DOSSIER_VIEWED',
      targetType: 'profile',
      targetId: userId,
      details: { email: profile.email, full_name: profile.full_name },
      ip,
    });

    const maskedCard = profile.card_number
      ? `****${String(profile.card_number).slice(-4)}`
      : null;

    return NextResponse.json({
      dossier: {
        profile: { ...profile, card_number: maskedCard },
        enterprise_applications: enterpriseApps || [],
        agent_applications: agentApps || [],
        recent_transactions: recentTx || [],
      },
    });
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Antre omwen 2 karaktè pou chèche.' }, { status: 400 });
  }

  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);

  let query = db
    .from('profiles')
    .select('id, full_name, email, kyc_status, account_type, enterprise_status, account_status, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  if (uuidLike) {
    query = query.eq('id', q);
  } else {
    query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`);
  }

  const { data: matches, error: searchErr } = await query;

  if (searchErr) {
    return NextResponse.json({ error: 'Erè rechèch.' }, { status: 500 });
  }

  return NextResponse.json({ matches: matches || [] });
}
