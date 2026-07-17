import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { getBusinessProfitSummary } from '@/lib/admin/business-profit';

/** Kolòn / kle ki pa dwe ale nan navigatè menm pou admin. */
const PROFILE_SECRET_KEYS = new Set([
  'pin_code',
  'pin_code_hash',
  'transaction_pin',
  'transaction_pin_hash',
  'cvv',
  'card_number',
  'api_key',
  'webhook_secret',
  'card_number_hash',
  'cvv_hash',
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
    has_card: !!(clean.card_last4 || clean.is_card_activated),
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
      depositsRes,
      withdrawalsRes,
      promoRes,
      agentsRes,
      enterprisesRes,
      staffRes,
      anonsRes,
      profitSummary,
      feeTxRes,
      entFeeRes,
      cardFeeRes,
      kycFeeRes,
    ] = await Promise.all([
      db.from('profiles').select('*').order('created_at', { ascending: false }),
      db.from('deposits').select('*').order('created_at', { ascending: false }),
      db.from('withdrawals').select('*').order('created_at', { ascending: false }),
      db.from('promo_codes').select('*').order('created_at', { ascending: false }),
      db.from('agent_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      db.from('enterprise_applications').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
      db.from('staff_users').select('*').order('created_at', { ascending: false }),
      db.from('global_settings').select('*').eq('id', 1).maybeSingle(),
      getBusinessProfitSummary(db),
      db
        .from('transactions')
        .select('id, user_id, amount, description, created_at, type, status')
        .eq('type', 'FEE')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(40),
      db
        .from('transactions')
        .select('id, user_id, amount, description, created_at')
        .eq('type', 'ENTERPRISE_FEE')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(25),
      db
        .from('transactions')
        .select('id, user_id, amount, description, created_at')
        .eq('type', 'CARD_ACTIVATION')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(25),
      db
        .from('transactions')
        .select('id, user_id, amount, description, created_at')
        .eq('type', 'KYC_FEE')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    const users = (usersRes.data || []).map((u) => mapProfileForAdmin(u as Record<string, unknown>));
    const byId = new Map(users.map((u) => [String(u.id), u]));

    const pendingKyc = users.filter(
      (u) => u.kyc_status === 'pending' && (u.kyc_selfie || u.kyc_front || u.kyc_id_front)
    );
    const suspendedAccounts = users.filter((u) => u.account_status === 'suspended');

    const pendingAgents = (agentsRes.data || []).map((agent) => ({
      ...agent,
      profiles: byId.get(agent.user_id) || {},
    }));

    const pendingEnterprises = (enterprisesRes.data || []).map((app) => ({
      ...app,
      profiles: byId.get(app.user_id) || {},
    }));

    const staffMembers = (staffRes.data || []).map((s) => ({
      ...stripSecrets(s as Record<string, unknown>, STAFF_SECRET_KEYS),
      has_workspace_password: !!(s as any).workspace_password_hash,
    }));

    const totalClientBal = users.reduce((acc, u) => acc + Number(u.wallet_balance || 0), 0);
    const totalCardBal = users.reduce((acc, u) => acc + Number(u.card_balance || 0), 0);

    const enrich = (rows: any[], nameKey: string) =>
      (rows || []).map((f) => ({
        ...f,
        [nameKey]: byId.get(f.user_id)?.full_name || 'Enkoni',
        email: byId.get(f.user_id)?.email || '',
        agentName: byId.get(f.user_id)?.full_name || 'Ajan Enkoni',
        agentEmail: byId.get(f.user_id)?.email || '',
        clientName: byId.get(f.user_id)?.full_name || 'Kliyan Enkoni',
        clientEmail: byId.get(f.user_id)?.email || '',
      }));

    return NextResponse.json({
      success: true,
      users,
      deposits: depositsRes.data || [],
      withdrawals: withdrawalsRes.data || [],
      suspendedAccounts,
      pendingKyc,
      promoCodes: promoRes.data || [],
      pendingAgents,
      pendingEnterprises,
      staffMembers,
      announcement: {
        text: anonsRes.data?.announcement_text || '',
        active: anonsRes.data?.announcement_active ?? true,
      },
      totals: {
        clientBal: totalClientBal,
        cardBal: totalCardBal,
      },
      profit: {
        gross_htg: profitSummary.gross_htg,
        refunded_htg: profitSummary.refunded_htg,
        net_htg: profitSummary.net_htg,
        withdrawn_htg: profitSummary.withdrawn_htg,
        available_htg: profitSummary.available_htg,
        breakdown_net: profitSummary.breakdown_net,
      },
      feeHistory: {
        agent: enrich(feeTxRes.data || [], 'agentName').slice(0, 25),
        enterprise: enrich(entFeeRes.data || [], 'clientName').slice(0, 25),
        card: enrich(cardFeeRes.data || [], 'clientName').slice(0, 25),
        kyc: enrich(kycFeeRes.data || [], 'clientName').slice(0, 25),
      },
    });
  } catch (err: unknown) {
    console.error('admin dashboard-data:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Pa t kapab chaje done admin.' }, { status: 500 });
  }
}
