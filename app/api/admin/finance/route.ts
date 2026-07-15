import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';

type Action = 'approve_deposit' | 'reject' | 'complete_withdrawal';

/**
 * Operasyon finansye admin/staff — verifye wòl + gate (admin gate oswa workspace gate),
 * egzekite RPC ak service_role pou wallet_balance toujou kredite/ranbouse.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-finance:${ip}`, 40, 300);
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
            'Aksè refize. Antre modpas admin gate (dashboard) oswa workspace gate anvan operasyon finansye.',
        },
        { status: 403 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '') as Action;

    if (action === 'approve_deposit') {
      const depositId = String(body.deposit_id || '');
      const finalAmount = body.final_amount != null ? Number(body.final_amount) : null;
      const fee = body.fee != null ? Number(body.fee) : null;
      if (!depositId) {
        return NextResponse.json({ success: false, message: 'ID depo manke.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('admin_approve_deposit', {
        p_deposit_id: depositId,
        p_final_amount: finalAmount,
        p_fee: fee,
      });
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }
      const res = data as { success?: boolean; message?: string } | null;
      if (!res?.success) {
        return NextResponse.json({ success: false, message: res?.message || 'Echèk.' }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    if (action === 'reject') {
      const table = String(body.table || '');
      const itemId = String(body.item_id || '');
      const reason = String(body.reason || 'Rejte pa admin');
      if (!['deposits', 'withdrawals'].includes(table) || !itemId) {
        return NextResponse.json({ success: false, message: 'Paramèt pa valab.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('admin_reject_finance_item', {
        p_table: table,
        p_item_id: itemId,
        p_reason: reason,
      });
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }
      const res = data as { success?: boolean; message?: string } | null;
      if (!res?.success) {
        return NextResponse.json({ success: false, message: res?.message || 'Echèk.' }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    if (action === 'complete_withdrawal') {
      const withdrawalId = String(body.withdrawal_id || '');
      if (!withdrawalId) {
        return NextResponse.json({ success: false, message: 'ID retrè manke.' }, { status: 400 });
      }
      const { data, error } = await supabase.rpc('admin_complete_withdrawal', {
        p_withdrawal_id: withdrawalId,
      });
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 400 });
      }
      const res = data as { success?: boolean; message?: string } | null;
      if (!res?.success) {
        return NextResponse.json({ success: false, message: res?.message || 'Echèk.' }, { status: 400 });
      }
      return NextResponse.json(res);
    }

    return NextResponse.json({ success: false, message: 'Aksyon enkoni.' }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
