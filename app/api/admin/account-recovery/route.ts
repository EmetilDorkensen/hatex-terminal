import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';
import { sendMail, shellHtml, SITE_URL } from '@/lib/notify/email';
import {
  generateRecoveryToken,
  hashRecoveryToken,
  recoveryTokenExpiry,
} from '@/lib/security/recovery-code';

export const dynamic = 'force-dynamic';

const RECOVERY_BUCKET = 'recovery-documents';
const KYC_V1_BUCKET = 'kyc-documents';
const KYC_V2_BUCKET = 'kyc-documents-v2';
const SIGN_TTL = 60 * 15; // 15 minit

/** Menm règ ak bwat mesaj kontak: admin + anplwaye sipò/super_admin. */
async function requireRecoveryOperator(email: string | undefined, userId: string | undefined) {
  if (!email || !userId) {
    return { ok: false as const, status: 401, message: 'Ou dwe konekte.' };
  }
  const gate = await assertFinanceOperatorWithGate(email);
  if (!gate.ok) {
    return {
      ok: false as const,
      status: 403,
      message: 'Aksè refize. Antre gate admin/workspace anvan.',
    };
  }
  if (gate.role === 'staff') {
    const db = createSupabaseAdminClient();
    const { data: staff } = await db
      .from('staff_users')
      .select('role')
      .eq('email', email.trim().toLowerCase())
      .eq('status', 'active')
      .maybeSingle();
    if (!staff || !['support', 'super_admin'].includes(String(staff.role))) {
      return {
        ok: false as const,
        status: 403,
        message: 'Wòl ou pa gen dwa jere rekiperasyon kont.',
      };
    }
  }
  return { ok: true as const, email, userId, role: gate.role };
}

async function signPath(
  db: ReturnType<typeof createSupabaseAdminClient>,
  bucket: string,
  path: string | null | undefined
): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(bucket).createSignedUrl(path, SIGN_TTL);
  return data?.signedUrl || null;
}

/**
 * GET — lis demann rekiperasyon oswa detay yon email.
 *   ?email=...  → demann + pwofil konplè + dokiman soumèt + KYC sou dosye (signed URLs)
 *   san email   → dènye 50 demann
 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`recovery-admin-get:${ip}`, 60, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const auth = await requireRecoveryOperator(user?.email, user?.id);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();

  if (!email) {
    const { data: rows } = await db
      .from('account_recovery_requests')
      .select('id, email, status, created_at, reviewed_by, reviewed_at, reset_token_expires_at, reset_token_used_at')
      .order('created_at', { ascending: false })
      .limit(50);
    return NextResponse.json({ ok: true, items: rows || [] });
  }

  // ── Demann pou email sa a
  const { data: requests } = await db
    .from('account_recovery_requests')
    .select('*')
    .ilike('email', email)
    .order('created_at', { ascending: false })
    .limit(10);

  // ── Pwofil konplè (tout enfo idantite)
  const { data: profiles } = await db
    .from('profiles')
    .select(
      'id, email, full_name, phone, avatar_url, account_type, account_status, plan, kyc_status, kyc_doc_type, kyc_front, kyc_back, kyc_selfie, kyc_submitted_at, kyc_face_match_score, business_name, created_at'
    )
    .ilike('email', email)
    .limit(5);
  const profile =
    profiles?.find((p) => String(p.email || '').trim().toLowerCase() === email) ||
    profiles?.[0] ||
    null;

  // ── KYC v2 (si li egziste)
  let kycV2: Record<string, unknown> | null = null;
  if (profile?.id) {
    const { data: v2 } = await db
      .from('hatex_kyc_applications')
      .select(
        'id, status, first_name, last_name, date_of_birth, phone_primary, address_street, address_city, address_department, id_front_path, id_back_path, selfie_path, created_at'
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    kycV2 = v2 || null;
  }

  // ── Signed URLs: dokiman soumèt + KYC sou dosye (pou konparezon)
  const items = [];
  for (const r of requests || []) {
    items.push({
      ...r,
      reset_token_hash: undefined, // pa janm ekspoze hash la
      doc_urls: {
        id_front: await signPath(db, RECOVERY_BUCKET, r.id_front_path),
        id_back: await signPath(db, RECOVERY_BUCKET, r.id_back_path),
        selfie: await signPath(db, RECOVERY_BUCKET, r.selfie_path),
      },
    });
  }

  const v2Front = kycV2 ? await signPath(db, KYC_V2_BUCKET, kycV2.id_front_path as string) : null;
  const v2Back = kycV2 ? await signPath(db, KYC_V2_BUCKET, kycV2.id_back_path as string) : null;
  const v2Selfie = kycV2 ? await signPath(db, KYC_V2_BUCKET, kycV2.selfie_path as string) : null;

  const kycOnFile = {
    id_front:
      v2Front || (profile ? await signPath(db, KYC_V1_BUCKET, profile.kyc_front) : null),
    id_back: v2Back || (profile ? await signPath(db, KYC_V1_BUCKET, profile.kyc_back) : null),
    selfie:
      v2Selfie || (profile ? await signPath(db, KYC_V1_BUCKET, profile.kyc_selfie) : null),
  };

  return NextResponse.json({
    ok: true,
    profile: profile
      ? { ...profile, kyc_front: undefined, kyc_back: undefined, kyc_selfie: undefined }
      : null,
    kyc_v2: kycV2
      ? { ...kycV2, id_front_path: undefined, id_back_path: undefined, selfie_path: undefined }
      : null,
    kyc_on_file: kycOnFile,
    requests: items,
  });
}

/**
 * POST — aksyon asistans:
 *   { request_id, action: 'send_reset' } → jenere lyen 1 èdtan + voye email bay kliyan an
 *   { request_id, action: 'reject', reason? } → refize demann lan
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`recovery-admin-post:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, message: 'Twòp demann.' }, { status: 429 });
  }

  const supabaseAuth = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const auth = await requireRecoveryOperator(user?.email, user?.id);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const requestId = typeof body.request_id === 'string' ? body.request_id.trim() : '';
  const action = body.action === 'send_reset' ? 'send_reset' : body.action === 'reject' ? 'reject' : '';

  if (!requestId || !action) {
    return NextResponse.json({ ok: false, message: 'Demann pa valab.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const { data: req } = await db
    .from('account_recovery_requests')
    .select('id, user_id, email, status')
    .eq('id', requestId)
    .maybeSingle();

  if (!req) {
    return NextResponse.json({ ok: false, message: 'Demann pa jwenn.' }, { status: 404 });
  }

  const now = new Date();

  if (action === 'reject') {
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
    await db
      .from('account_recovery_requests')
      .update({
        status: 'rejected',
        reviewed_by: auth.email,
        reviewed_at: now.toISOString(),
        reject_reason: reason || null,
        reset_token_hash: null,
        reset_token_expires_at: null,
        updated_at: now.toISOString(),
      })
      .eq('id', req.id);

    return NextResponse.json({ ok: true, message: 'Demann lan refize.' });
  }

  // ── action === 'send_reset'
  if (req.status === 'completed') {
    return NextResponse.json(
      { ok: false, message: 'Demann sa a deja konplete (lyen an te itilize).' },
      { status: 400 }
    );
  }
  if (!req.user_id) {
    return NextResponse.json(
      { ok: false, message: 'Pa gen kont HatexCard ki matche ak email sa a. Verifye email la.' },
      { status: 400 }
    );
  }

  const token = generateRecoveryToken();
  const expires = recoveryTokenExpiry(now);

  const { error: updErr } = await db
    .from('account_recovery_requests')
    .update({
      status: 'approved',
      reviewed_by: auth.email,
      reviewed_at: now.toISOString(),
      reset_token_hash: hashRecoveryToken(token),
      reset_token_expires_at: expires.toISOString(),
      reset_token_used_at: null,
      updated_at: now.toISOString(),
    })
    .eq('id', req.id);

  if (updErr) {
    console.error('[recovery-admin] update:', updErr.message);
    return NextResponse.json({ ok: false, message: 'Pa t kapab sove. Eseye ankò.' }, { status: 500 });
  }

  const link = `${SITE_URL}/rekiperasyon/verifye?token=${token}`;
  const sent = await sendMail({
    to: req.email,
    subject: 'HatexCard — Lyen pou rekipere kont ou (valab 1 èdtan)',
    html: shellHtml(
      'Rekiperasyon kont',
      `
      <h2 style="margin:0 0 12px;font-size:18px;">Idantite w verifye ✔</h2>
      <p style="margin:0 0 12px;color:#4b5563;font-size:14px;line-height:1.6;">
        Ekip asistans HatexCard verifye dokiman ou yo. Klike sou bouton an anba a pou w antre
        nan kont ou epi konfigire yon <strong>nouvo kòd MFA</strong>.
      </p>
      <p style="margin:20px 0;text-align:center;">
        <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#ffffff;font-weight:bold;font-size:14px;padding:14px 28px;border-radius:12px;text-decoration:none;">
          Rekipere kont mwen
        </a>
      </p>
      <p style="margin:0 0 8px;color:#64748b;font-size:13px;line-height:1.6;">
        ⏱ Lyen sa a valab pou <strong>1 èdtan</strong> epi li ka itilize <strong>yon sèl fwa</strong>.
        Si li ekspire, kontakte asistans lan pou yo voye yon nouvo.
      </p>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">
        Si se pa ou ki te mande rekiperasyon sa a, inyore imèl sa a epi kontakte
        <a href="mailto:support@hatexcard.com" style="color:#1d4ed8;">support@hatexcard.com</a> touswit.
      </p>
      `
    ),
    logLabel: 'recovery:reset-link',
  });

  if (!sent.ok) {
    return NextResponse.json(
      { ok: false, message: `Lyen kreye men imèl la pa t ale: ${sent.message || 'erè Brevo'}. Eseye ankò.` },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: `Imèl voye bay ${req.email}. Lyen an valab 1 èdtan — si li pa itilize l, klike "Reset MFA" ankò pou voye yon nouvo.`,
    expires_at: expires.toISOString(),
  });
}
