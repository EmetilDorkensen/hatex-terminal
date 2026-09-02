import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { getOpenApplication } from '@/lib/kyc-v2/application';
import { createKycFeePayment, simulateSandboxKycFee } from '@/lib/kyc-v2/fee-payment';

/**
 * POST /api/kyc/v2/pay
 *
 * Kreye peman frè KYC a epi retounen lyen MonCash la. Dosye a soumèt
 * otomatikman lè peman an konfime — pa isit.
 */

export const dynamic = 'force-dynamic';

function siteBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Konekte anvan.' } },
      { status: 401 }
    );
  }

  const limit = await rateLimit(`kycv2:pay:${user.id}:${getClientIp(request)}`, 12, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp eseye. Tann yon ti moman.' } },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } }
    );
  }

  const admin = createSupabaseAdminClient();
  const app = await getOpenApplication(admin, user.id);

  if (!app) {
    return NextResponse.json(
      { error: { code: 'no_application', message: 'Kòmanse dosye KYC ou anvan.' } },
      { status: 409 }
    );
  }

  const wantsSimulate = new URL(request.url).searchParams.get('simulate') === '1';

  if (wantsSimulate) {
    const simulated = await simulateSandboxKycFee(admin, app);
    if (!simulated.ok) {
      return NextResponse.json(
        { error: { code: simulated.code, message: simulated.message } },
        { status: simulated.status }
      );
    }
    return NextResponse.json({
      simulated: true,
      payment_id: simulated.paymentId,
      amount: simulated.amount,
    });
  }

  const result = await createKycFeePayment(admin, app, {
    returnUrl: `${siteBaseUrl(request)}/kyc/v2/result`,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: { code: result.code, message: result.message },
        details: result.details,
      },
      { status: result.status }
    );
  }

  return NextResponse.json({
    checkout_url: result.checkoutUrl,
    amount: result.amount,
    reference: result.reference,
    payment_id: result.paymentId,
  });
}
