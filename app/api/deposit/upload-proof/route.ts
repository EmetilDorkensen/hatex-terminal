import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { DEPOSIT_PROOF_BUCKET } from '@/lib/security/deposit-proof';
import crypto from 'crypto';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const MAX_BYTES = 5 * 1024 * 1024;

function resolveMime(file: File): string | null {
  const declared = (file.type || '').toLowerCase();
  if (ALLOWED_MIME.has(declared)) return declared;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_MIME[ext] || null;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`deposit-proof-upload:${ip}`, 12, 600);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp telechajman. Eseye pita.' }, { status: 429 });
  }

  const supabaseSession = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseSession.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Fòma demann pa valab.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Fichye manke.' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Fichye a pa ka depase 5 Mo.' }, { status: 400 });
  }

  const mime = resolveMime(file);
  if (!mime) {
    return NextResponse.json({ error: 'Sèlman imaj (JPG, PNG, WEBP) aksepte.' }, { status: 400 });
  }

  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createSupabaseAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage.from(DEPOSIT_PROOF_BUCKET).upload(storagePath, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (uploadErr) {
    const hint =
      uploadErr.message?.includes('Bucket not found') || uploadErr.message?.includes('bucket')
        ? ' Bucket deposit-proofs pa kreye — kouri migration 20260745 nan Supabase SQL Editor.'
        : '';
    return NextResponse.json(
      { error: `Pa t kapab sove prèv la.${hint}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    storagePath,
    bucket: DEPOSIT_PROOF_BUCKET,
  });
}
