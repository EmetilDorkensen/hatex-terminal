import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { hasValidAdminGate, requireAdminUser, verifyAdminPassword } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import {
  AGENT_DOCS_BUCKET,
  ENTERPRISE_DOCS_BUCKET,
  resolveApplicationDocLocation,
} from '@/lib/security/application-docs';

const DOC_URL_KEYS = [
  'id_doc_url',
  'address_doc_url',
  'location_photo_url',
  'patente_url',
  'cif_url',
  'selfie_with_id_url',
  'criminal_record_url',
  'bank_statement_url',
  'lease_doc_url',
  'business_registration_url',
  'legal_rep_id_url',
] as const;

async function deleteStoragePaths(
  db: ReturnType<typeof createSupabaseAdminClient>,
  pathsByBucket: Map<string, Set<string>>
) {
  let deleted = 0;
  for (const [bucket, paths] of pathsByBucket) {
    // Pa janm manyen KYC
    if (bucket === 'kyc_documents') continue;
    const list = [...paths].filter(Boolean);
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50);
      const { error } = await db.storage.from(bucket).remove(chunk);
      if (!error) deleted += chunk.length;
    }
  }
  return deleted;
}

async function collectAndPurgeBusinessDocs(
  db: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  const pathsByBucket = new Map<string, Set<string>>();
  const add = (ref: string | null | undefined) => {
    if (!ref) return;
    const loc = resolveApplicationDocLocation(ref);
    if (!loc || loc.bucket === 'kyc_documents') return;
    if (!pathsByBucket.has(loc.bucket)) pathsByBucket.set(loc.bucket, new Set());
    pathsByBucket.get(loc.bucket)!.add(loc.path);
  };

  const [{ data: agentApps }, { data: entApps }] = await Promise.all([
    db.from('agent_applications').select('*').eq('user_id', userId),
    db.from('enterprise_applications').select('*').eq('user_id', userId),
  ]);

  for (const row of [...(agentApps || []), ...(entApps || [])]) {
    for (const key of DOC_URL_KEYS) {
      add((row as Record<string, string | null>)[key]);
    }
  }

  // Lis folder {userId}/ nan de bucket yo
  for (const bucket of [AGENT_DOCS_BUCKET, ENTERPRISE_DOCS_BUCKET]) {
    const { data: files } = await db.storage.from(bucket).list(userId, { limit: 200 });
    for (const f of files || []) {
      if (f.name) {
        if (!pathsByBucket.has(bucket)) pathsByBucket.set(bucket, new Set());
        pathsByBucket.get(bucket)!.add(`${userId}/${f.name}`);
      }
    }
  }

  const deleted = await deleteStoragePaths(db, pathsByBucket);
  return { deleted, buckets: [...pathsByBucket.keys()] };
}

/**
 * Reyinisyalize kont kliyan: balans 0, retire ajan/antrepriz,
 * efase dokiman biznis/ajan, kenbe KYC.
 * Admin + gate + modpas konfimasyon.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-reset-account:${ip}`, 10, 600);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann.' }, { status: 429 });
  }

  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = String(body.user_id || '');
  const password = typeof body.password === 'string' ? body.password : '';

  if (!userId) {
    return NextResponse.json({ error: 'user_id obligatwa.' }, { status: 400 });
  }
  if (!password || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: 'Modpas admin pa bon.' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, full_name, kyc_status')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Kont pa jwenn.' }, { status: 404 });
  }

  // Efase fichye via Storage API anvan (pa SQL sou storage.objects)
  let storagePurge = { deleted: 0, buckets: [] as string[] };
  try {
    storagePurge = await collectAndPurgeBusinessDocs(db, userId);
  } catch (e) {
    console.error('storage purge failed (kontinye reset DB):', e);
  }

  const { data, error } = await db.rpc('admin_reset_client_account', { p_user_id: userId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const res = data as { success?: boolean; message?: string } | null;
  if (!res?.success) {
    return NextResponse.json({ error: res?.message || 'Echèk reset.' }, { status: 400 });
  }

  await logAdminAction(db, {
    adminEmail: admin.user.email!,
    action: 'CLIENT_ACCOUNT_RESET',
    targetType: 'profile',
    targetId: userId,
    details: {
      email: profile.email,
      full_name: profile.full_name,
      kept_kyc: profile.kyc_status,
      docs_deleted: storagePurge.deleted,
      buckets: storagePurge.buckets,
    },
    ip,
  });

  return NextResponse.json({
    success: true,
    message:
      'Kont reyinisyalize: balans 0, ajan/antrepriz retire, dokiman biznis/ajan efase, KYC kenbe.',
    result: res,
    docs_deleted: storagePurge.deleted,
  });
}
