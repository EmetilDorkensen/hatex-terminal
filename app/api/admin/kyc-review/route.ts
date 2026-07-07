import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser } from '@/lib/admin/auth';
import { provisionCardForUser } from '@/lib/kyc/card-provision';
import { ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';
import { KYC_STATUS } from '@/lib/kyc/status';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { canViewKycDocuments, getAuthenticatedUser } from '@/lib/kyc/access';
import { logAdminAction } from '@/lib/admin/audit-log';

async function isWorkspaceReviewer(email: string): Promise<boolean> {
  return canViewKycDocuments(email);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`kyc-review:${ip}`, 30, 900);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const { user } = await getAuthenticatedUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const isAdmin = user.email === 'adminhatexcard@gmail.com' && (await hasValidAdminGate());
  const isStaff = await isWorkspaceReviewer(user.email);

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
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
  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, kyc_status, kyc_fee_paid, is_card_activated, api_key_hash, api_key_prefix, is_merchant, webhook_secret')
    .eq('id', userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Itilizatè pa jwenn.' }, { status: 404 });
  }

  if (action === 'approved') {
    if (profile.kyc_status === KYC_STATUS.APPROVED) {
      return NextResponse.json({ error: 'KYC deja apwouve.' }, { status: 409 });
    }

    await provisionCardForUser(admin, userId);

    const { error: approveErr } = await admin
      .from('profiles')
      .update({
        kyc_status: KYC_STATUS.APPROVED,
        kyc_rejection_reason: null,
        is_card_activated: true,
        is_activated: true,
      })
      .eq('id', userId);

    if (approveErr) {
      return NextResponse.json({ error: 'Pa t kapab apwouve KYC.' }, { status: 500 });
    }

    const { data: freshProfile } = await admin
      .from('profiles')
      .select('id, kyc_status, is_card_activated, api_key_hash, api_key_prefix, is_merchant, webhook_secret')
      .eq('id', userId)
      .single();

    if (freshProfile) {
      await ensureMerchantApiCredentials(admin, freshProfile);
    }

    if (isAdmin) {
      await logAdminAction(admin, { adminEmail: user.email, action: 'KYC_APPROVED', targetType: 'profile', targetId: userId, ip });
    }

    return NextResponse.json({
      success: true,
      action: 'approved',
      message: 'KYC apwouve. Kat vityèl ak terminal kreye otomatikman.',
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
    return NextResponse.json({ error: 'Pa t kapab rejte KYC.' }, { status: 500 });
  }

  if (isAdmin) {
    await logAdminAction(admin, { adminEmail: user.email, action: 'KYC_REJECTED', targetType: 'profile', targetId: userId, details: { reason }, ip });
  }

  return NextResponse.json({ success: true, action: 'rejected' });
}
