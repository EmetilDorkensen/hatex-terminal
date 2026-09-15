import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { notifyStaffOfContactMessage } from '@/lib/contact/notify-staff';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKET = 'recovery-documents';
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function extOf(mime: string): string {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

async function uploadDoc(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  requestId: string,
  file: File | null,
  label: string
): Promise<string | null> {
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) return null;
  const mime = (file.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime) || file.size > MAX_BYTES) return null;

  const buf = Buffer.from(await file.arrayBuffer());
  const path = `${requestId}/${label}_${Date.now()}.${extOf(mime)}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });
  if (error) {
    console.error(`[account-recovery] upload ${label}:`, error.message);
    return null;
  }
  return path;
}

/**
 * Rekiperasyon kont — kliyan ki pèdi MFA + kòd aksè.
 * Soumèt: email + pyès idantite (devan / dèyè) + foto live (selfie).
 * Tout dokiman ale nan bucket prive `recovery-documents`;
 * asistans lan verifye yo nan onglet "Rekiperasyon" anvan yo reset MFA.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`account-recovery:${ip}`, 4, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp demann. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: 'Fòm pa valab.' }, { status: 400 });
  }

  const email = String(form.get('email') || '').trim().toLowerCase();
  const note = String(form.get('note') || '').trim().slice(0, 1000);
  const idFront = form.get('id_front') as File | null;
  const idBack = form.get('id_back') as File | null;
  const selfie = form.get('selfie') as File | null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, message: 'Antre imèl kont lan.' }, { status: 400 });
  }
  if (!idFront || !idFront.size) {
    return NextResponse.json(
      { success: false, message: 'Foto pyès idantite w (devan) obligatwa.' },
      { status: 400 }
    );
  }
  if (!selfie || !selfie.size) {
    return NextResponse.json(
      { success: false, message: 'Foto live ou (selfie) obligatwa pou verifikasyon.' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // Chèche kont lan — men PA di piblik la si li egziste ou non
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email')
    .ilike('email', email)
    .limit(5);
  const profile =
    profiles?.find((p) => String(p.email || '').trim().toLowerCase() === email) || profiles?.[0] || null;

  const requestId = crypto.randomUUID();

  const [frontPath, backPath, selfiePath] = await Promise.all([
    uploadDoc(admin, requestId, idFront, 'id_front'),
    uploadDoc(admin, requestId, idBack, 'id_back'),
    uploadDoc(admin, requestId, selfie, 'selfie'),
  ]);

  if (!frontPath || !selfiePath) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Dokiman yo pa t kapab telechaje. Itilize foto JPG/PNG/WEBP oswa PDF (max 8MB) epi eseye ankò.',
      },
      { status: 400 }
    );
  }

  const { error: insertErr } = await admin.from('account_recovery_requests').insert({
    id: requestId,
    user_id: profile?.id || null,
    email,
    status: 'pending',
    id_front_path: frontPath,
    id_back_path: backPath,
    selfie_path: selfiePath,
    client_note: note || null,
  });

  if (insertErr) {
    console.error('[account-recovery] insert:', insertErr.message);
    await admin.storage
      .from(BUCKET)
      .remove([frontPath, backPath, selfiePath].filter(Boolean) as string[])
      .catch(() => {});
    return NextResponse.json(
      { success: false, message: 'Pa t kapab sove demann lan. Eseye ankò.' },
      { status: 500 }
    );
  }

  // Alèt admin + anplwaye sipò
  void notifyStaffOfContactMessage({
    channelLabel: 'Rekiperasyon Kont',
    fromName: email.split('@')[0] || 'Kliyan',
    fromEmail: email,
    subject: 'Nouvo demann rekiperasyon kont (MFA pèdi)',
    body: `Yon kliyan soumèt dokiman KYC pou rekipere kont li.\n\nEmail: ${email}\n${note ? `Nòt: ${note}\n` : ''}\nVerifye dokiman yo nan Admin → Rekiperasyon (oswa Workspace → Rekiperasyon), konpare pyès yo ak foto yo, epi klike "Reset MFA" si tout bagay bon.`,
    source: 'web_form',
    attachmentCount: [frontPath, backPath, selfiePath].filter(Boolean).length,
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    message:
      'Nou resevwa demann ou. Ekip asistans lan ap verifye dokiman ou yo — si tout bagay bon, w ap resevwa yon imèl ak yon lyen pou w antre nan kont ou epi re-konfigire MFA ou. Lyen an ap valab 1 èdtan.',
  });
}
