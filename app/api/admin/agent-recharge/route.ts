import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { assertFinanceCashierWithGate } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';

/**
 * GET: lis demann rechaj ajan + balans Kès
 * POST actions:
 *  - credit_by_code: { agent_code, amount }
 *  - review: { request_id, action: approved|rejected, reason? }
 */
export async function GET() {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }
    const gate = await assertFinanceCashierWithGate(user.email);
    if (!gate.ok) {
      return NextResponse.json({ success: false, message: 'Aksè refize. Antre gate anvan.' }, { status: 403 });
    }

    const db = createSupabaseAdminClient();
    const [{ data: pending }, { data: treasury }] = await Promise.all([
      db
        .from('agent_recharge_requests')
        .select('*, profiles:agent_user_id(full_name, email, agent_balance, agent_capacity, agent_code)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50),
      db.from('platform_treasury').select('balance, updated_at').eq('id', 'kes_global').maybeSingle(),
    ]);

    return NextResponse.json({
      success: true,
      pending: pending || [],
      kes_global_balance: Number(treasury?.balance || 0),
      kes_updated_at: treasury?.updated_at || null,
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-agent-recharge:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
  }

  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }
    const gate = await assertFinanceCashierWithGate(user.email);
    if (!gate.ok) {
      return NextResponse.json(
        { success: false, message: 'Aksè refize. Antre modpas admin/workspace gate anvan.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const db = createSupabaseAdminClient();

    if (action === 'credit_by_code') {
      const agentCode = String(body.agent_code || '').replace(/\D/g, '').slice(0, 8);
      const amount = Number(body.amount);
      if (agentCode.length !== 8 || !(amount > 0)) {
        return NextResponse.json({ success: false, message: 'Kòd ajan (8 chif) ak montan obligatwa.' }, { status: 400 });
      }

      const { data, error } = await db.rpc('admin_credit_agent_float', {
        p_agent_code: agentCode,
        p_amount: amount,
        p_operator_email: user.email,
      });
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }
      const res = data as { success?: boolean; message?: string } | null;
      if (!res?.success) {
        return NextResponse.json({ success: false, message: res?.message || 'Echèk.' }, { status: 400 });
      }

      await logAdminAction(db, {
        adminEmail: user.email,
        action: 'AGENT_RECHARGE_HATEX',
        targetType: 'agent_float',
        targetId: agentCode,
        details: { amount, result: res },
        ip,
      });

      return NextResponse.json(res);
    }

    if (action === 'review') {
      const requestId = String(body.request_id || '');
      const reviewAction = String(body.review_action || body.status || '');
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';
      if (!requestId || !['approved', 'rejected'].includes(reviewAction)) {
        return NextResponse.json({ success: false, message: 'Paramèt review pa valab.' }, { status: 400 });
      }
      if (reviewAction === 'rejected' && !reason) {
        return NextResponse.json({ success: false, message: 'Rezon rejè obligatwa.' }, { status: 400 });
      }

      const { data, error } = await db.rpc('admin_review_agent_recharge', {
        p_request_id: requestId,
        p_action: reviewAction,
        p_reason: reviewAction === 'rejected' ? reason : null,
        p_operator_email: user.email,
      });
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }
      const res = data as { success?: boolean; message?: string } | null;
      if (!res?.success) {
        return NextResponse.json({ success: false, message: res?.message || 'Echèk.' }, { status: 400 });
      }

      await logAdminAction(db, {
        adminEmail: user.email,
        action: `AGENT_RECHARGE_${reviewAction.toUpperCase()}`,
        targetType: 'agent_recharge_request',
        targetId: requestId,
        details: { reason: reason || undefined },
        ip,
      });

      return NextResponse.json(res);
    }

    return NextResponse.json({ success: false, message: 'Aksyon enkoni.' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
