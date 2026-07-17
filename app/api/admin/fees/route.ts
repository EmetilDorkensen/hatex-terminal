import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

/** Admin sèlman: lis / modifye frè global + override pa kont. */
export async function GET(request: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  const userId = new URL(request.url).searchParams.get('user_id');

  const [{ data: settings }, { data: overrides }, { data: limits }, { data: agentTiers }] = await Promise.all([
    db.from('platform_fee_settings').select('*').order('fee_key'),
    userId
      ? db.from('account_fee_overrides').select('*').eq('user_id', userId)
      : db.from('account_fee_overrides').select('*, profiles:user_id(full_name, email)').order('updated_at', { ascending: false }).limit(100),
    db.from('platform_limit_settings').select('*').order('limit_key'),
    db.from('agent_tiers').select('*').order('tier'),
  ]);

  return NextResponse.json({
    success: true,
    settings: settings || [],
    overrides: overrides || [],
    limits: limits || [],
    agent_tiers: agentTiers || [],
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
  const email = admin.user.email!;

  if (action === 'update_global') {
    const feeKey = String(body.fee_key || '');
    const value = Number(body.value);
    if (!feeKey || !(value >= 0) || !Number.isFinite(value)) {
      return NextResponse.json({ error: 'fee_key ak value ( >= 0 ) obligatwa.' }, { status: 400 });
    }

    // Upsert: si liy lan pa egziste, kreye l
    const { data: existing } = await db
      .from('platform_fee_settings')
      .select('fee_key')
      .eq('fee_key', feeKey)
      .maybeSingle();

    let data;
    let error;
    if (existing) {
      const upd = await db
        .from('platform_fee_settings')
        .update({ value, updated_at: new Date().toISOString(), updated_by: email })
        .eq('fee_key', feeKey)
        .select()
        .single();
      data = upd.data;
      error = upd.error;
    } else {
      const ins = await db
        .from('platform_fee_settings')
        .insert({
          fee_key: feeKey,
          label: feeKey,
          value,
          unit: 'flat',
          updated_by: email,
        })
        .select()
        .single();
      data = ins.data;
      error = ins.error;
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAdminAction(db, {
      adminEmail: email,
      action: 'FEE_GLOBAL_UPDATE',
      targetType: 'platform_fee_settings',
      targetId: feeKey,
      details: { value },
      ip,
    });
    return NextResponse.json({ success: true, setting: data });
  }

  if (action === 'update_limit') {
    const limitKey = String(body.limit_key || '');
    const value = Number(body.value);
    if (!limitKey || !(value >= 0) || !Number.isFinite(value)) {
      return NextResponse.json({ error: 'limit_key ak value (>= 0) obligatwa.' }, { status: 400 });
    }
    const { data, error } = await db
      .from('platform_limit_settings')
      .update({ value, updated_at: new Date().toISOString(), updated_by: email })
      .eq('limit_key', limitKey)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAdminAction(db, {
      adminEmail: email,
      action: 'LIMIT_GLOBAL_UPDATE',
      targetType: 'platform_limit_settings',
      targetId: limitKey,
      details: { value },
      ip,
    });
    return NextResponse.json({ success: true, limit: data });
  }

  if (action === 'update_agent_tier') {
    const tier = String(body.tier || '').toLowerCase();
    const capacity = Number(body.capacity_htg);
    if (!tier || !(capacity > 0) || !Number.isFinite(capacity)) {
      return NextResponse.json({ error: 'tier ak capacity_htg (> 0) obligatwa.' }, { status: 400 });
    }
    const { data, error } = await db
      .from('agent_tiers')
      .upsert({ tier, capacity_htg: capacity, label: tier.toUpperCase(), updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Sync matching platform_limit_settings keys
    const limitKey = tier === 'premium' ? 'agent_premium_capacity' : tier === 'pro' ? 'agent_pro_capacity' : null;
    if (limitKey) {
      await db
        .from('platform_limit_settings')
        .update({ value: capacity, updated_at: new Date().toISOString(), updated_by: email })
        .eq('limit_key', limitKey);
    }

    await logAdminAction(db, {
      adminEmail: email,
      action: 'AGENT_TIER_UPDATE',
      targetType: 'agent_tiers',
      targetId: tier,
      details: { capacity_htg: capacity },
      ip,
    });
    return NextResponse.json({ success: true, tier: data });
  }

  if (action === 'set_override') {
    const userId = String(body.user_id || '');
    const feeKey = String(body.fee_key || '');
    const value = Number(body.value);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null;
    if (!userId || !feeKey || !(value >= 0) || !Number.isFinite(value)) {
      return NextResponse.json({ error: 'user_id, fee_key, value obligatwa.' }, { status: 400 });
    }

    const { data: profile } = await db.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: 'Kont (user_id) pa jwenn nan profiles.' }, { status: 404 });
    }

    // Asire fee_key egziste nan platform_fee_settings (FK)
    const { data: feeRow } = await db
      .from('platform_fee_settings')
      .select('fee_key')
      .eq('fee_key', feeKey)
      .maybeSingle();
    if (!feeRow) {
      return NextResponse.json(
        { error: `Frè « ${feeKey} » pa egziste. Kouri migrasyon 20260752.` },
        { status: 400 }
      );
    }

    const { data, error } = await db
      .from('account_fee_overrides')
      .upsert(
        {
          user_id: userId,
          fee_key: feeKey,
          value,
          note,
          updated_at: new Date().toISOString(),
          updated_by: email,
        },
        { onConflict: 'user_id,fee_key' }
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAdminAction(db, {
      adminEmail: email,
      action: 'FEE_OVERRIDE_SET',
      targetType: 'account_fee_overrides',
      targetId: userId,
      details: { fee_key: feeKey, value, note },
      ip,
    });
    return NextResponse.json({ success: true, override: data });
  }

  if (action === 'clear_override') {
    const userId = String(body.user_id || '');
    const feeKey = String(body.fee_key || '');
    if (!userId || !feeKey) {
      return NextResponse.json({ error: 'user_id ak fee_key obligatwa.' }, { status: 400 });
    }
    const { error } = await db
      .from('account_fee_overrides')
      .delete()
      .eq('user_id', userId)
      .eq('fee_key', feeKey);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAdminAction(db, {
      adminEmail: email,
      action: 'FEE_OVERRIDE_CLEAR',
      targetType: 'account_fee_overrides',
      targetId: userId,
      details: { fee_key: feeKey },
      ip,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Aksyon enkoni.' }, { status: 400 });
}
