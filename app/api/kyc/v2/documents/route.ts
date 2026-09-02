import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { evaluateReadiness, getOpenApplication } from '@/lib/kyc-v2/application';
import { replaceApplicationDocument } from '@/lib/kyc-v2/documents';
import {
  BUSINESS_LEGAL_SLOTS,
  DOCUMENT_SLOT_COLUMNS,
  requiredDocuments,
  requiresIdBack,
  type DocumentSlot,
} from '@/lib/kyc-v2/config';

/**
 * POST /api/kyc/v2/documents  (multipart)
 *   slot: id_front | id_back | business_registration
 *   file: fichye a
 *
 * Selfie a PA pase isit — li pase pa /api/kyc/v2/liveness pou l ka verifye.
 */

export const dynamic = 'force-dynamic';

const UPLOADABLE_SLOTS: DocumentSlot[] = [
  'id_front',
  'id_back',
  'business_registration',
  'business_nif_doc',
  'tax_clearance',
  'establishment_photo',
  'proof_of_address',
  'articles',
];

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthenticated', message: 'Konekte anvan.' } },
      { status: 401 }
    );
  }

  const limit = await rateLimit(`kycv2:doc:${user.id}:${getClientIp(request)}`, 30, 600);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: 'rate_limited', message: 'Twòp voye monte. Tann yon ti moman.' } },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec ?? 60) } }
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

  const slot = String(form.get('slot') || '') as DocumentSlot;
  if (!UPLOADABLE_SLOTS.includes(slot)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_slot',
          message: `Dokiman aksepte: ${UPLOADABLE_SLOTS.join(', ')}.`,
        },
      },
      { status: 400 }
    );
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: { code: 'missing_file', message: 'Chwazi yon fichye.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const app = await getOpenApplication(admin, user.id);

  if (!app) {
    return NextResponse.json(
      {
        error: {
          code: 'no_application',
          message: 'Kòmanse dosye a epi chwazi tip kont ou anvan ou voye dokiman.',
        },
      },
      { status: 409 }
    );
  }

  if (app.status !== 'draft') {
    return NextResponse.json(
      {
        error: {
          code: 'already_submitted',
          message: 'Dosye ou deja soumèt — ou pa ka chanje dokiman yo ankò.',
        },
      },
      { status: 409 }
    );
  }

  // Anpeche dokiman ki pa gen sans pou dosye sa a
  if (slot === 'id_back') {
    if (!app.id_document_type) {
      return NextResponse.json(
        {
          error: {
            code: 'id_type_required',
            message: 'Chwazi ki pyès idantite ou genyen anvan.',
          },
        },
        { status: 409 }
      );
    }
    if (!requiresIdBack(app.id_document_type)) {
      return NextResponse.json(
        {
          error: {
            code: 'back_not_required',
            message: 'Pyès idantite sa a pa mande foto dèyè.',
          },
        },
        { status: 409 }
      );
    }
  }

  if (
    BUSINESS_LEGAL_SLOTS.includes(slot) &&
    app.account_type !== 'business'
  ) {
    return NextResponse.json(
      {
        error: {
          code: 'not_business',
          message: 'Dokiman biznis mande sèlman pou kont biznis.',
        },
      },
      { status: 409 }
    );
  }

  const column = DOCUMENT_SLOT_COLUMNS[slot] as keyof typeof app;
  const previousPath = (app[column] as string | null) || null;

  const uploaded = await replaceApplicationDocument(admin, {
    applicationId: app.id,
    userId: user.id,
    slot,
    file,
    previousPath,
  });

  if (!uploaded.ok) {
    return NextResponse.json(
      { error: { code: uploaded.code, message: uploaded.message } },
      { status: uploaded.status }
    );
  }

  const refreshed = await getOpenApplication(admin, user.id);
  const readiness = refreshed ? await evaluateReadiness(admin, refreshed) : null;

  return NextResponse.json({
    slot,
    uploaded: true,
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
