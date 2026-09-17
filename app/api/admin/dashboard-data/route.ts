import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { getBusinessProfitSummary } from '@/lib/admin/business-profit';
import { mapKycAppForStaff } from '@/lib/kyc-v2/staff-view';

/** Kolòn / kle ki pa dwe ale nan navigatè menm pou admin. */
const PROFILE_SECRET_KEYS = new Set([
  'pin_code',
  'pin_code_hash',
  'transaction_pin',
  'transaction_pin_hash',
  'api_key',
  'webhook_secret',
  'kyc_id_number_hash',
  'current_session_token',
]);

const STAFF_SECRET_KEYS = new Set(['workspace_password_hash']);

function stripSecrets<T extends Record<string, unknown>>(row: T, keys: Set<string>): T {
  const out = { ...row };
  for (const k of keys) {
    if (k in out) delete out[k];
  }
  return out;
}

function mapProfileForAdmin(p: Record<string, unknown>): Record<string, unknown> {
  const clean = stripSecrets(p, PROFILE_SECRET_KEYS) as Record<string, unknown>;
  // Alias pou UI admin ki itilize kyc_front / kyc_back
  return {
    ...clean,
    kyc_front: clean.kyc_id_front ?? clean.kyc_front ?? null,
    kyc_back: clean.kyc_id_back ?? clean.kyc_back ?? null,
  };
}

/**
 * Tout done panèl Sipè Admin — service_role + gate.
 * Navigatè a pa fè SELECT dirèk sou tab yo.
 */
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  try {
    const db = createSupabaseAdminClient();

    const [
      usersRes,
      agentsRes,
      staffRes,
      anonsRes,
      profitSummary,
      paymentsRes,
    ] = await Promise.all([
      db.from('profiles').select('*').order('created_at', { ascending: false }),
      db.from('hatex_kyc_applications').select('*').eq('status', 'submitted').order('created_at', { ascending: false }),
      db.from('staff_users').select('*').order('created_at', { ascending: false }),
      db.from('global_settings').select('*').eq('id', 1).maybeSingle(),
      getBusinessProfitSummary(db),
      db
        .from('hatex_payments')
        .select('id, merchant_id, purpose, status, platform_fee, client_total, paid_at, created_at, description')
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(80),
    ]);

    const users = (usersRes.data || []).map((u) => mapProfileForAdmin(u as Record<string, unknown>));
    const byId = new Map(users.map((u) => [String(u.id), u]));

    const v2Apps = (agentsRes.data || []) as unknown as Record<string, unknown>[];
    const pendingKyc =
      v2Apps.length > 0
        ? v2Apps.map((app) => {
            const profile = byId.get(String(app.user_id)) as
              | { full_name?: string; email?: string }
              | undefined;
            return mapKycAppForStaff(app, profile);
          })
        : users.filter(
            (u) =>
              u.kyc_status === 'pending' &&
              (u.kyc_selfie || u.kyc_front || u.kyc_id_front)
          );
    const suspendedAccounts = users.filter((u) => u.account_status === 'suspended');

    const staffMembers = (staffRes.data || []).map((s) => ({
      ...stripSecrets(s as Record<string, unknown>, STAFF_SECRET_KEYS),
      has_workspace_password: !!(s as any).workspace_password_hash,
    }));

    const paid = paymentsRes.data || [];
    let platformFees = 0;
    let planFees = 0;
    for (const row of paid) {
      const amount = Number(row.platform_fee || row.client_total || 0);
      if (row.purpose === 'plan_fee') planFees += amount;
      else platformFees += Number(row.platform_fee || 0);
    }

    const recent = paid.slice(0, 25).map((p) => ({
      id: p.id,
      purpose: p.purpose,
      amount: Number(p.platform_fee || p.client_total || 0),
      client_total: Number(p.client_total || 0),
      description: p.description,
      created_at: p.paid_at || p.created_at,
      merchantName: byId.get(String(p.merchant_id))?.full_name || 'Machann',
      email: byId.get(String(p.merchant_id))?.email || '',
    }));

    const paidPlans = users.filter(
      (u) =>
        (u.plan === 'capacity' || u.plan === 'premium') &&
        u.plan_status === 'active'
    ).length;

    return NextResponse.json({
      success: true,
      users,
      suspendedAccounts,
      pendingKyc,
      staffMembers,
      announcement: {
        text: anonsRes.data?.announcement_text || '',
        active: anonsRes.data?.announcement_active ?? true,
      },
      loginAccess: {
        enabled: anonsRes.data?.login_enabled !== false,
        message:
          (typeof anonsRes.data?.login_closed_message === 'string' &&
            anonsRes.data.login_closed_message.trim()) ||
          'Paj koneksyon an fèmen tanporèman. Nou ap travay sou sit la. Eseye ankò pita.',
        bypassEmails: Array.isArray(anonsRes.data?.login_bypass_emails)
          ? anonsRes.data.login_bypass_emails
              .filter((e: unknown): e is string => typeof e === 'string')
              .map((e: string) => e.trim().toLowerCase())
              .filter(Boolean)
          : [],
      },
      profit: {
        gross_htg: profitSummary.gross_htg,
        refunded_htg: profitSummary.refunded_htg,
        net_htg: profitSummary.net_htg,
        withdrawn_htg: profitSummary.withdrawn_htg,
        available_htg: profitSummary.available_htg,
      },
      gateway: {
        platform_fees: platformFees,
        plan_fees: planFees,
        paid_count: paid.length,
        paid_plans: paidPlans,
        recent,
      },
    });
  } catch (err: unknown) {
    console.error('admin dashboard-data:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Pa t kapab chaje done admin.' }, { status: 500 });
  }
}
