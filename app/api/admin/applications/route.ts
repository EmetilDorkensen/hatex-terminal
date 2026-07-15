import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';

type Kind = 'agent' | 'enterprise';
type Action = 'approved' | 'rejected';

/**
 * Apwouve / rejte aplikasyon ajan oswa antrepriz via RPC atomik
 * (pa modifye wallet_balance depi navigatè).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-applications:${ip}`, 40, 300);
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

    const gate = await assertFinanceOperatorWithGate(user.email);
    if (!gate.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Aksè refize. Antre modpas admin gate oswa workspace gate anvan.',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const kind = String(body.kind || '') as Kind;
    const action = String(body.action || '') as Action;
    const applicationId = String(body.application_id || '');
    const userId = String(body.user_id || '');
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';

    if (!['agent', 'enterprise'].includes(kind)) {
      return NextResponse.json({ success: false, message: 'Kalite aplikasyon pa valab.' }, { status: 400 });
    }
    if (!['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Aksyon pa valab.' }, { status: 400 });
    }
    if (!applicationId || !userId) {
      return NextResponse.json({ success: false, message: 'Paramèt manke.' }, { status: 400 });
    }
    if (action === 'rejected' && !reason) {
      return NextResponse.json({ success: false, message: 'Rezon rejè obligatwa.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const rpcName =
      kind === 'agent'
        ? 'admin_review_agent_application'
        : 'admin_review_enterprise_application';

    const { data, error } = await supabase.rpc(rpcName, {
      p_application_id: applicationId,
      p_user_id: userId,
      p_action: action,
      p_reason: action === 'rejected' ? reason : null,
    });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    const res = data as { success?: boolean; message?: string; refund?: number } | null;
    if (!res?.success) {
      return NextResponse.json(
        { success: false, message: res?.message || 'Echèk.' },
        { status: 400 }
      );
    }

    await logAdminAction(supabase, {
      adminEmail: user.email,
      action: kind === 'agent' ? `AGENT_${action.toUpperCase()}` : `ENTERPRISE_${action.toUpperCase()}`,
      targetType: kind === 'agent' ? 'agent_application' : 'enterprise_application',
      targetId: applicationId,
      details: {
        user_id: userId,
        reason: action === 'rejected' ? reason : undefined,
        refund: res.refund ?? 0,
        via: 'api/admin/applications',
      },
      ip,
    });

    return NextResponse.json(res);
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
