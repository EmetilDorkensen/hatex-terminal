import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import {
  evaluateReadiness,
  getLatestApplication,
  getOpenApplication,
  saveDraft,
} from '@/lib/kyc-v2/application';
import {
  ACTIVITY_CATEGORIES,
  HAITI_DEPARTMENTS,
  ID_DOCUMENT_LABELS,
  PARTY2_ROLES,
  requiredDocuments,
} from '@/lib/kyc-v2/config';
import { getGatewaySettings, resolveKycFeeHtg } from '@/lib/moncash/settings';

/**
 *   GET  /api/kyc/v2/application  — dosye aktyèl + sa ki manke + frè a
 *   POST /api/kyc/v2/application  — sove bouyon an
 */

export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json(
    { error: { code: 'unauthenticated', message: 'Konekte anvan.' } },
    { status: 401 }
  );
}

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const admin = createSupabaseAdminClient();
  const settings = await getGatewaySettings(admin);

  const application = (await getOpenApplication(admin, user.id))
    || (await getLatestApplication(admin, user.id));

  const options = {
    departments: HAITI_DEPARTMENTS,
    activity_categories: ACTIVITY_CATEGORIES,
    id_document_types: Object.entries(ID_DOCUMENT_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
    party2_roles: PARTY2_ROLES,
    fees: {
      individual: resolveKycFeeHtg(settings, 'individual'),
      business: resolveKycFeeHtg(settings, 'business'),
    },
  };

  if (!application) {
    return NextResponse.json({ application: null, readiness: null, options });
  }

  const readiness = await evaluateReadiness(admin, application);

  return NextResponse.json({
    application,
    readiness: {
      ...readiness,
      required_documents: requiredDocuments(
        application.account_type,
        application.id_document_type
      ),
    },
    options,
  });
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) return unauthorized();

  const limit = await rateLimit(`kycv2:save:${user.id}:${getClientIp(request)}`, 60, 300);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp chanjman. Tanpri tann yon ti moman.' } },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Done yo pa valab.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Imèl kont la se referans lan — moun pa ka mete yon lòt moun imèl
  const result = await saveDraft(admin, user.id, {
    ...body,
    email: body.email ?? user.email,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: { code: result.code, message: result.message }, errors: result.errors },
      { status: result.status }
    );
  }

  const readiness = await evaluateReadiness(admin, result.application);

  return NextResponse.json({
    application: result.application,
    readiness: {
      ...readiness,
      required_documents: requiredDocuments(
        result.application.account_type,
        result.application.id_document_type
      ),
    },
  });
}
