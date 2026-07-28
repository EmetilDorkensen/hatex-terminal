import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { provisionCardForUser } from '@/lib/kyc/card-provision';
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
      .select('id, full_name, email, kyc_status, kyc_fee_paid, is_card_activated, features_unlock_paid')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: profileErr?.message || 'Itilizatè pa jwenn.' },
        { status: 404 }
      );
    }

    if (action === 'approved') {
      if (profile.kyc_status === KYC_STATUS.APPROVED) {
        return NextResponse.json({ error: 'KYC deja apwouve.' }, { status: 409 });
      }

      // Apwouve KYC anvan — pa kite echèk kat anpeche apwobasyon.
      const alreadyUnlocked = profile.features_unlock_paid === true;
      const { error: approveErr } = await admin
        .from('profiles')
        .update({
          kyc_status: KYC_STATUS.APPROVED,
          kyc_rejection_reason: null,
          is_activated: true,
          // Pa efase debloke si kliyan te deja peye 2yèm frè a
          ...(alreadyUnlocked
            ? {}
            : { is_card_activated: false, features_unlock_paid: false }),
        })
        .eq('id', userId);

      if (approveErr) {
        return NextResponse.json(
          { error: `Pa t kapab apwouve KYC: ${approveErr.message}` },
          { status: 500 }
        );
      }

      let cardOk = true;
      let cardWarning: string | undefined;
      try {
        await provisionCardForUser(admin, userId, {
          activate: alreadyUnlocked,
        });
      } catch (cardErr: unknown) {
        cardOk = false;
        const msg =
          cardErr instanceof Error
            ? cardErr.message
            : typeof cardErr === 'object' &&
                cardErr &&
                'message' in cardErr &&
                typeof (cardErr as { message: unknown }).message === 'string'
              ? (cardErr as { message: string }).message
              : 'Erè kreye kat';
        cardWarning = msg;
        console.error('[kyc-review] provisionCard failed', userId, msg);
      }

      if (gate.role === 'admin') {
        await logAdminAction(admin, {
          adminEmail: user.email,
          action: 'KYC_APPROVED',
          targetType: 'profile',
          targetId: userId,
          details: {
            locked_until_unlock_fee: !alreadyUnlocked,
            card_provisioned: cardOk,
            card_warning: cardWarning || null,
          },
          ip,
        });
      }

      return NextResponse.json({
        success: true,
        action: 'approved',
        message: cardOk
          ? alreadyUnlocked
            ? 'KYC apwouve. Kat deja debloke.'
            : 'KYC apwouve. Kat kreye men bloke — kliyan dwe peye 525 HTG pou debloke kat, terminal ak fakti.'
          : `KYC apwouve, men kat pa t kreye: ${cardWarning}. Verifye CARD_HASH_SECRET sou sèvè a.`,
        features_locked: !alreadyUnlocked,
        card_ok: cardOk,
        card_warning: cardWarning,
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
