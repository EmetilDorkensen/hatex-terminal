import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

/** Retrè — MFA + PIN deja verifye bò kote kliyan; montan verifye nan RPC/DB. */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`wallet-withdraw:${ip}`, 10, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ.' }, { status: 429 });
  }

  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);
    const method = String(body.method || '').trim();
    const phone = body.phone ? String(body.phone) : null;
    const agentCode = body.agent_code ? String(body.agent_code) : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Montan pa valab.' }, { status: 400 });
    }
    if (!method) {
      return NextResponse.json({ success: false, message: 'Metòd retrè obligatwa.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: rpcResult, error: rpcError } = await admin.rpc('process_wallet_withdrawal', {
      p_user_id: auth.user.id,
      p_amount: amount,
      p_method: method,
      p_phone: phone,
      p_agent_code: method === 'Ajan' ? agentCode : null,
      p_user_email: auth.user.email || null,
    });

    if (rpcError) {
      return NextResponse.json(
        { success: false, message: rpcError.message || 'Retrè echwe.' },
        { status: 400 }
      );
    }
    if (!rpcResult?.success) {
      return NextResponse.json(
        { success: false, message: rpcResult?.message || 'Retrè echwe.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...rpcResult });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
