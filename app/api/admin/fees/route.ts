import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { resetGatewaySettingsCache } from '@/lib/moncash/settings';
import { monCashAlertUrl, monCashReturnUrl } from '@/lib/moncash/callbacks';
import { settlePendingMonCashPayments } from '@/lib/moncash/settle';

const HIDDEN_KEYS = new Set(['kyc_fee_individual_htg', 'kyc_fee_business_htg']);

/** Admin: frè / limit pasrèl (hatex_gateway_settings) + URL MonCash. */
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  const { data: settings, error } = await db
    .from('hatex_gateway_settings')
    .select('key, label, value, unit, description, updated_at')
    .order('key');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: paid } = await db
    .from('hatex_payments')
    .select('id, merchant_id, purpose, platform_fee, client_total, description, paid_at, created_at')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(80);

  let platformFees = 0;
  let planFees = 0;
  for (const row of paid || []) {
    if (row.purpose === 'plan_fee') {
      planFees += Number(row.client_total || row.platform_fee || 0);
    } else {
      platformFees += Number(row.platform_fee || 0);
    }
  }

  const recent = (paid || []).slice(0, 20).map((p) => ({
    id: p.id,
    purpose: p.purpose,
    amount:
      p.purpose === 'plan_fee'
        ? Number(p.client_total || 0)
        : Number(p.platform_fee || 0),
    description: p.description,
    created_at: p.paid_at || p.created_at,
    merchant_id: p.merchant_id,
  }));

  return NextResponse.json({
    success: true,
    settings: (settings || []).filter((s) => !HIDDEN_KEYS.has(String(s.key))),
    callbacks: {
      alert: monCashAlertUrl(),
      return: monCashReturnUrl(),
    },
    revenue: {
      platform_fees: platformFees,
      plan_fees: planFees,
      recent,
    },
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-fees:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '');
  const db = createSupabaseAdminClient();
  const email = admin.user.email || '';
  const userId = admin.user.id;

  if (action === 'settle_pending') {
    const settled = await settlePendingMonCashPayments(db);
    await logAdminAction(db, {
      adminEmail: email,
      action: 'MONCASH_SETTLE_PENDING',
      targetType: 'hatex_payments',
      details: settled,
      ip,
    });
    return NextResponse.json({ success: true, ...settled });
  }

  if (action === 'update') {
    const key = String(body.key || '');
    const value = Number(body.value);
    if (!key || HIDDEN_KEYS.has(key) || !Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'kle ak valè (>= 0) obligatwa.' }, { status: 400 });
    }

    const { data: existing } = await db
      .from('hatex_gateway_settings')
      .select('key')
      .eq('key', key)
      .maybeSingle();

    const now = new Date().toISOString();
    let error;
    if (existing) {
      const upd = await db
        .from('hatex_gateway_settings')
        .update({ value, updated_at: now, updated_by: userId })
        .eq('key', key);
      error = upd.error;
    } else {
      const ins = await db.from('hatex_gateway_settings').insert({
        key,
        label: key,
        value,
        unit: 'htg',
        updated_at: now,
        updated_by: userId,
      });
      error = ins.error;
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    resetGatewaySettingsCache();
    await logAdminAction(db, {
      adminEmail: email,
      action: 'GATEWAY_SETTING_UPDATE',
      targetType: 'hatex_gateway_settings',
      targetId: key,
      details: { value },
      ip,
    });
    return NextResponse.json({ success: true, key, value });
  }

  return NextResponse.json({ error: 'Aksyon pa rekonèt.' }, { status: 400 });
}
