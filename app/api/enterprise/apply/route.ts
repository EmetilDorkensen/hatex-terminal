import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  isPinLocked,
  verifyAnyPin,
  buildPinFailureUpdate,
  buildPinSuccessUpdate,
} from '@/lib/security/pin-lockout';

/**
 * Soumèt aplikasyon antrepriz + chaje frè sou sèvè (pa RPC soti nan navigatè).
 * PIN verifye sou sèvè — pa janm konfye flag kliyan.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`enterprise-apply:${ip}`, 10, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp demann. Eseye nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || '');
  const businessName = typeof body.business_name === 'string' ? body.business_name.trim() : '';
  const businessRegNumber =
    typeof body.business_reg_number === 'string' ? body.business_reg_number.trim() : '';
  const businessActivity =
    typeof body.business_activity === 'string' ? body.business_activity.trim() : '';
  const confidentialityAccepted = body.confidentiality_accepted === true;

  const docs = {
    patente_url: typeof body.patente_url === 'string' ? body.patente_url : null,
    cif_url: typeof body.cif_url === 'string' ? body.cif_url : null,
    business_registration_url:
      typeof body.business_registration_url === 'string' ? body.business_registration_url : null,
    bank_statement_url: typeof body.bank_statement_url === 'string' ? body.bank_statement_url : null,
    lease_doc_url: typeof body.lease_doc_url === 'string' ? body.lease_doc_url : null,
    legal_rep_id_url: typeof body.legal_rep_id_url === 'string' ? body.legal_rep_id_url : null,
  };

  if (pin.length !== 4) {
    return NextResponse.json(
      { success: false, message: 'PIN nan dwe gen 4 chif.' },
      { status: 400 }
    );
  }
  if (!businessName || !businessRegNumber || !businessActivity) {
    return NextResponse.json(
      { success: false, message: 'Ranpli enfòmasyon biznis yo.' },
      { status: 400 }
    );
  }
  if (
    !docs.patente_url ||
    !docs.cif_url ||
    !docs.business_registration_url ||
    !docs.bank_statement_url ||
    !docs.lease_doc_url ||
    !docs.legal_rep_id_url
  ) {
    return NextResponse.json(
      { success: false, message: 'Tout dokiman obligatwa yo manke.' },
      { status: 400 }
    );
  }
  if (!confidentialityAccepted) {
    return NextResponse.json(
      { success: false, message: 'Aksepte angajman konfidansyalite a.' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const userId = auth.user.id;

  const { data: profile } = await admin
    .from('profiles')
    .select(
      'id, kyc_status, full_name, email, pin_code, pin_code_hash, transaction_pin, transaction_pin_hash, failed_pin_attempts, pin_locked_until, account_status, pin_enabled'
    )
    .eq('id', userId)
    .maybeSingle();

  if (!profile || profile.kyc_status !== 'approved') {
    return NextResponse.json(
      { success: false, message: 'KYC apwouve obligatwa.' },
      { status: 403 }
    );
  }

  const lock = isPinLocked(profile);
  if (lock.locked) {
    return NextResponse.json({ success: false, message: lock.message }, { status: 403 });
  }

  const { ok: pinOk } = await verifyAnyPin(profile, pin);
  if (!pinOk) {
    const failure = await buildPinFailureUpdate(profile.failed_pin_attempts || 0);
    await admin.from('profiles').update(failure.update).eq('id', userId);
    return NextResponse.json({ success: false, message: failure.message }, { status: 401 });
  }
  if (
    !profile.pin_code_hash ||
    !profile.transaction_pin_hash ||
    profile.pin_code ||
    profile.transaction_pin ||
    !profile.pin_enabled
  ) {
    await admin.from('profiles').update(await buildPinSuccessUpdate(pin)).eq('id', userId);
  } else {
    await admin
      .from('profiles')
      .update({ failed_pin_attempts: 0, pin_locked_until: null })
      .eq('id', userId);
  }

  const { error: appError } = await admin.from('enterprise_applications').insert([
    {
      user_id: userId,
      status: 'pending',
      business_name: businessName,
      business_reg_number: businessRegNumber,
      business_activity: businessActivity,
      ...docs,
      confidentiality_accepted: true,
      confidentiality_accepted_at: new Date().toISOString(),
      metadata: {},
    },
  ]);

  if (appError) {
    return NextResponse.json(
      { success: false, message: `Erè anrejistreman: ${appError.message}` },
      { status: 400 }
    );
  }

  const { data: feeResult, error: feeErr } = await admin.rpc('process_enterprise_fee', {
    p_user_id: userId,
  });

  if (feeErr || !feeResult?.success) {
    await admin
      .from('enterprise_applications')
      .delete()
      .eq('user_id', userId)
      .eq('status', 'pending');
    return NextResponse.json(
      {
        success: false,
        message: feeErr?.message || feeResult?.message || 'Peman frè a pa reyisi.',
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    fee_charged: feeResult.fee ?? feeResult.amount ?? null,
    result: feeResult,
  });
}
