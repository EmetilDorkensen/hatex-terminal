import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, ADMIN_EMAIL } from '@/lib/admin/auth';
import { isActiveStaff } from '@/lib/kyc/access';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { logAdminAction } from '@/lib/admin/audit-log';
import {
  bucketsToTryForAppDoc,
  resolveApplicationDocLocation,
} from '@/lib/security/application-docs';

const SIGNED_URL_TTL_SEC = 300;

/**
 * Louvri dokiman ajan / antrepriz (bucket prive) — pa confondre ak prèv depo.
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-app-doc:${ip}`, 60, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const session = await createSupabaseServerClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const isAdmin = user.email === ADMIN_EMAIL && (await hasValidAdminGate());
  const isStaff = await isActiveStaff(user.email);
  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const ref = url.searchParams.get('ref')?.trim() || '';
  if (!ref) {
    return NextResponse.json({ error: 'Referans dokiman manke.' }, { status: 400 });
  }

  // Si se URL piblik ki toujou aksesib, retounen l dirèkteman
  if ((ref.startsWith('http://') || ref.startsWith('https://')) && !ref.includes('/storage/v1/object/')) {
    return NextResponse.json({ url: ref, expires_in: 0, bucket: 'external' });
  }

  const location = resolveApplicationDocLocation(ref);
  if (!location) {
    return NextResponse.json({ error: 'Referans dokiman pa valab.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  // Asire bucket yo egziste
  await db.storage.createBucket('agent_documents', { public: false }).catch(() => null);
  await db.storage.createBucket('enterprise_documents', { public: false }).catch(() => null);

  const tried = new Set<string>();
  for (const bucket of bucketsToTryForAppDoc(location.bucket)) {
    if (tried.has(bucket)) continue;
    tried.add(bucket);

    const { data, error } = await db.storage.from(bucket).createSignedUrl(location.path, SIGNED_URL_TTL_SEC);
    if (!error && data?.signedUrl) {
      await logAdminAction(db, {
        adminEmail: user.email,
        action: 'APPLICATION_DOC_VIEWED',
        targetType: 'application_document',
        targetId: location.path,
        details: { bucket },
        ip,
      });
      return NextResponse.json({ url: data.signedUrl, expires_in: SIGNED_URL_TTL_SEC, bucket });
    }
  }

  return NextResponse.json(
    { error: 'Dokiman ajan/antrepriz pa jwenn oswa li deja efase.' },
    { status: 404 }
  );
}
