import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { evaluateReadiness, getOpenApplication } from '@/lib/kyc-v2/application';
import { verifyLiveness, REQUIRED_FRAMES } from '@/lib/kyc-v2/liveness';
import { requiredDocuments } from '@/lib/kyc-v2/config';

/**
 * POST /api/kyc/v2/liveness  (multipart)
 *   frames: plizyè imaj kaptire an dirèk depi kamera a
 *
 * Verifye moun nan vivan devan kamera a epi figi l matche pyès idantite a.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Konekte anvan.' } },
      { status: 401 }
    );
  }

  // Face++ koute chè pa apèl — limit sa a sere espre
  const limit = await rateLimit(`kycv2:live:${user.id}`, 25, 900);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message: 'Ou eseye twòp fwa. Tann kèk minit epi eseye ankò.',
        },
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 300) } }
    );
  }

  const ipLimit = await rateLimit(`kycv2:live:ip:${getClientIp(request)}`, 40, 900);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp demann. Tanpri tann.' } },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec ?? 300) } }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_form', message: 'Done yo pa valab.' } },
      { status: 400 }
    );
  }

  const frames = form.getAll('frames').filter((f): f is File => f instanceof File);

  if (frames.length < REQUIRED_FRAMES) {
    return NextResponse.json(
      {
        error: {
          code: 'not_enough_frames',
          message: `Nou bezwen ${REQUIRED_FRAMES} imaj depi kamera a.`,
        },
      },
      { status: 400 }
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

  if (app.status !== 'draft') {
    return NextResponse.json(
      {
        error: {
          code: 'already_submitted',
          message: 'Dosye ou deja soumèt.',
        },
      },
      { status: 409 }
    );
  }

  const result = await verifyLiveness(admin, app, frames);

  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message } },
      { status: result.status }
    );
  }

  const refreshed = await getOpenApplication(admin, user.id);
  const readiness = refreshed ? await evaluateReadiness(admin, refreshed) : null;

  return NextResponse.json({
    verified: true,
    // Nòt la se yon detay entèn — nou pa di kliyan an ki papòt nou sèvi
    needs_manual_review: result.needsManualReview,
    readiness: readiness
      ? {
          ...readiness,
          required_documents: requiredDocuments(
            refreshed!.account_type,
            refreshed!.id_document_type
          ),
        }
      : null,
  });
}
