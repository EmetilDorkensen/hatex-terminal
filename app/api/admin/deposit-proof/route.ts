import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, ADMIN_EMAIL } from '@/lib/admin/auth';
import { isActiveStaff } from '@/lib/kyc/access';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { logAdminAction } from '@/lib/admin/audit-log';
import {
  DEPOSIT_PROOF_BUCKET,
  LEGACY_PROOF_BUCKET,
  resolveDepositProofLocation,
} from '@/lib/security/deposit-proof';

const SIGNED_URL_TTL_SEC = 300;

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-deposit-proof:${ip}`, 40, 300);
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
  const location = resolveDepositProofLocation(ref);

  if (!location) {
    return NextResponse.json({ error: 'Referans prèv pa valab.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const bucketsToTry = location.bucket === DEPOSIT_PROOF_BUCKET
    ? [DEPOSIT_PROOF_BUCKET, LEGACY_PROOF_BUCKET]
    : [location.bucket, DEPOSIT_PROOF_BUCKET, LEGACY_PROOF_BUCKET];

  const tried = new Set<string>();
  for (const bucket of bucketsToTry) {
    if (tried.has(bucket)) continue;
    tried.add(bucket);

    const { data, error } = await db.storage.from(bucket).createSignedUrl(location.path, SIGNED_URL_TTL_SEC);
    if (!error && data?.signedUrl) {
      await logAdminAction(db, {
        adminEmail: user.email,
        action: 'DEPOSIT_PROOF_VIEWED',
        targetType: 'deposit_proof',
        targetId: location.path,
        details: { bucket },
        ip,
      });

      return NextResponse.json({ url: data.signedUrl, expires_in: SIGNED_URL_TTL_SEC, bucket });
    }
  }

  return NextResponse.json({ error: 'Prèv depo pa jwenn oswa li deja efase.' }, { status: 404 });
}
