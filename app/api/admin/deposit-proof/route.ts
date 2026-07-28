import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { logAdminAction } from '@/lib/admin/audit-log';
import {
  DEPOSIT_PROOF_BUCKET,
  LEGACY_PROOF_BUCKET,
  resolveDepositProofLocation,
} from '@/lib/security/deposit-proof';
import { isSafeHttpUrl } from '@/lib/security/safe-url';

const SIGNED_URL_TTL_SEC = 300;

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-deposit-proof:${ip}`, 40, 300);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  try {
    const session = await createSupabaseServerClient();
    const {
      data: { user },
    } = await session.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Aksè refize. Ou dwe konekte.' }, { status: 403 });
    }

    const gate = await assertFinanceOperatorWithGate(user.email);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error:
            'Aksè refize. Antre modpas admin gate oswa workspace gate anvan ou gade prèv depo.',
        },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const ref = url.searchParams.get('ref')?.trim() || '';
    const wantRedirect = url.searchParams.get('redirect') === '1';

    if (!ref) {
      return NextResponse.json({ error: 'Referans prèv manke.' }, { status: 400 });
    }

    // URL piblik ansyen — valide epi retounen / redirect
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
      if (!isSafeHttpUrl(ref)) {
        return NextResponse.json({ error: 'Lyèn prèv pa valab.' }, { status: 400 });
      }
      const location = resolveDepositProofLocation(ref);
      if (location) {
        // Prefer signed URL from private bucket if we can parse storage path
        const db = createSupabaseAdminClient();
        const { data } = await db.storage
          .from(location.bucket)
          .createSignedUrl(location.path, SIGNED_URL_TTL_SEC);
        if (data?.signedUrl) {
          if (wantRedirect) {
            return NextResponse.redirect(data.signedUrl, 302);
          }
          return NextResponse.json({
            url: data.signedUrl,
            expires_in: SIGNED_URL_TTL_SEC,
            bucket: location.bucket,
          });
        }
      }
      if (wantRedirect) {
        return NextResponse.redirect(ref, 302);
      }
      return NextResponse.json({ url: ref, expires_in: 0, bucket: 'public' });
    }

    const location = resolveDepositProofLocation(ref);
    if (!location) {
      return NextResponse.json({ error: 'Referans prèv pa valab.' }, { status: 400 });
    }

    const db = createSupabaseAdminClient();
    const bucketsToTry =
      location.bucket === DEPOSIT_PROOF_BUCKET
        ? [DEPOSIT_PROOF_BUCKET, LEGACY_PROOF_BUCKET]
        : [location.bucket, DEPOSIT_PROOF_BUCKET, LEGACY_PROOF_BUCKET];

    const tried = new Set<string>();
    for (const bucket of bucketsToTry) {
      if (tried.has(bucket)) continue;
      tried.add(bucket);

      const { data, error } = await db.storage
        .from(bucket)
        .createSignedUrl(location.path, SIGNED_URL_TTL_SEC);
      if (!error && data?.signedUrl) {
        if (gate.role === 'admin') {
          await logAdminAction(db, {
            adminEmail: user.email,
            action: 'DEPOSIT_PROOF_VIEWED',
            targetType: 'deposit_proof',
            targetId: location.path,
            details: { bucket },
            ip,
          });
        }

        if (wantRedirect) {
          return NextResponse.redirect(data.signedUrl, 302);
        }
        return NextResponse.json({
          url: data.signedUrl,
          expires_in: SIGNED_URL_TTL_SEC,
          bucket,
        });
      }
    }

    return NextResponse.json(
      { error: 'Prèv depo pa jwenn oswa li deja efase.' },
      { status: 404 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erè sèvè.';
    console.error('[deposit-proof]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
