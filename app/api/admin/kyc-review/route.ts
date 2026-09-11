import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { KYC_STATUS } from '@/lib/kyc/status';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { logAdminAction } from '@/lib/admin/audit-log';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`kyc-review:${ip}`, 30, 900);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  try {
    const { user } = await getAuthenticatedUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Aksè refize. Ou dwe konekte.' }, { status: 403 });
    }

    // Menm règle ak applications / finance: admin+admin-gate, oswa admin/staff + workspace-gate
    const gate = await assertFinanceOperatorWithGate(user.email);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error:
            'Aksè refize. Antre modpas admin gate oswa workspace gate anvan ou apwouve KYC.',
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const action = body.action === 'approved' || body.action === 'rejected' ? body.action : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : '';

    if (!userId || !action) {
      return NextResponse.json({ error: 'Paramèt manke.' }, { status: 400 });
    }

    if (action === 'rejected' && !reason) {
      return NextResponse.json({ error: 'Rezon rejè obligatwa.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, full_name, email, kyc_status, kyc_fee_paid, features_unlock_paid, intended_plan, plan_status')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: profileErr?.message || 'Itilizatè pa jwenn.' },
        { status: 404 }
      );
    }

    if (action === 'approved') {
      const alreadyApproved = profile.kyc_status === KYC_STATUS.APPROVED;

      if (!alreadyApproved) {
        const { error: approveErr } = await admin
          .from('profiles')
          .update({
            kyc_status: KYC_STATUS.APPROVED,
            kyc_rejection_reason: null,
            is_activated: true,
            features_unlock_paid: true,
          })
          .eq('id', userId);

        if (approveErr) {
          return NextResponse.json(
            { error: `Pa t kapab apwouve KYC: ${approveErr.message}` },
            { status: 500 }
          );
        }

        await admin
          .from('hatex_kyc_applications')
          .update({
            status: 'approved',
            updated_at: new Date().toISOString(),
            rejection_reason: null,
          })
          .eq('user_id', userId)
          .in('status', ['submitted', 'in_review', 'draft']);
      }

      if (profile.intended_plan === 'capacity' || profile.intended_plan === 'premium') {
        const { settlePendingMonCashPayments } = await import('@/lib/moncash/settle');
        await settlePendingMonCashPayments(admin, userId);
        const { data: after } = await admin
          .from('profiles')
          .select('plan, plan_status, plan_period_end')
          .eq('id', userId)
          .maybeSingle();
        const periodOk =
          after?.plan_period_end && new Date(after.plan_period_end).getTime() > Date.now();
        const paidActive =
          (after?.plan === 'capacity' || after?.plan === 'premium') &&
          after.plan_status === 'active' &&
          periodOk;
        if (!paidActive) {
          await admin
            .from('profiles')
            .update({ plan_status: 'pending_payment' })
            .eq('id', userId);
        }
      }

      if (gate.role === 'admin' && !alreadyApproved) {
        await logAdminAction(admin, {
          adminEmail: user.email,
          action: 'KYC_APPROVED',
          targetType: 'profile',
          targetId: userId,
          details: {},
          ip,
        });
      }

      const successMsg = alreadyApproved
        ? 'KYC deja te apwouve.'
        : 'KYC apwouve. Si kliyan an te peye abonnman an, kapasite jou a ap ogmante otomatikman.';

      return NextResponse.json({
        success: true,
        action: 'approved',
        message: successMsg,
        features_locked: false,
        fresh_approval: !alreadyApproved,
      });
    }

    const { error: rejectErr } = await admin
      .from('profiles')
      .update({
        kyc_status: KYC_STATUS.REJECTED,
        kyc_rejection_reason: reason,
      })
      .eq('id', userId);

    if (rejectErr) {
      return NextResponse.json(
        { error: `Pa t kapab rejte KYC: ${rejectErr.message}` },
        { status: 500 }
      );
    }

    await admin
      .from('hatex_kyc_applications')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .in('status', ['submitted', 'in_review', 'draft']);

    if (gate.role === 'admin') {
      await logAdminAction(admin, {
        adminEmail: user.email,
        action: 'KYC_REJECTED',
        targetType: 'profile',
        targetId: userId,
        details: { reason },
        ip,
      });
    }

    return NextResponse.json({ success: true, action: 'rejected' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erè pandan revizyon KYC.';
    console.error('[kyc-review]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
