import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import {
  compareIdSelfie,
  extractIdNumberFromImage,
  validateKycDocumentSides,
} from '@/lib/kyc/faceplusplus';
import { hashKycIdNumber } from '@/lib/kyc/id-hash';
import { KYC_STATUS } from '@/lib/kyc/status';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

const KYC_BUCKET = 'kyc-documents';

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`kyc-submit:${ip}`, 8, 3600);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, kyc_status, full_name, kyc_fee_paid')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
  }

  if (profile.kyc_status === KYC_STATUS.APPROVED) {
    return NextResponse.json({ error: 'KYC ou deja apwouve.' }, { status: 400 });
  }

  if (!profile.kyc_fee_paid) {
    return NextResponse.json(
      { error: 'Ou dwe peye frè KYC la (1150 HTG) anvan ou soumèt dokiman yo.', needs_payment: true },
      { status: 402 }
    );
  }

  if (profile.kyc_status === KYC_STATUS.PENDING) {
    return NextResponse.json({ error: 'Dokiman w yo deja nan revizyon.' }, { status: 409 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Fòma demann pa valab.' }, { status: 400 });
  }

  const docType = String(formData.get('docType') || '').trim();
  const firstName = String(formData.get('firstName') || '').trim().toUpperCase();
  const lastName = String(formData.get('lastName') || '').trim().toUpperCase();
  const manualIdNumber = String(formData.get('idNumber') || '').trim().toUpperCase().replace(/[\s\-]/g, '');
  const idFront = formData.get('idFront');
  const idBack = formData.get('idBack');
  const selfie = formData.get('selfie');

  if (!docType || !firstName || !lastName) {
    return NextResponse.json({ error: 'Non, siyati, ak tip dokiman obligatwa.' }, { status: 400 });
  }
  if (!manualIdNumber || manualIdNumber.length < 5) {
    return NextResponse.json(
      { error: 'Nimewo dokiman obligatwa (omwen 5 karaktè jan li ekri sou ID a).' },
      { status: 400 }
    );
  }
  if (!(idFront instanceof File) || !(selfie instanceof File)) {
    return NextResponse.json({ error: 'Foto devan ID ak selfie obligatwa.' }, { status: 400 });
  }

  const isCin = docType === 'CIN / KAT ELEKTORAL';
  if (isCin && !(idBack instanceof File)) {
    return NextResponse.json({ error: 'Foto dèyè CIN obligatwa.' }, { status: 400 });
  }

  // A) Verifye dokiman + non OCR
  const sides = await validateKycDocumentSides({
    idFront,
    idBack: idBack instanceof File ? idBack : null,
    selfie,
    requireBack: isCin,
    enteredFullName: `${firstName} ${lastName}`,
  });
  if (!sides.ok) {
    const isConfig = sides.error?.includes('FACEPLUSPLUS') || sides.error?.includes('konfigire');
    return NextResponse.json(
      { error: sides.error || 'Dokiman yo pa valide.' },
      { status: isConfig ? 503 : 400 }
    );
  }

  // B) Konpare figi ID ↔ selfie (face_token + fallback imaj)
  const faceResult = await compareIdSelfie(idFront, selfie);
  if (!faceResult.success) {
    const isConfig = faceResult.error?.includes('FACEPLUSPLUS') || faceResult.error?.includes('konfigire');
    return NextResponse.json(
      {
        error: isConfig
          ? 'Verifikasyon figi pa disponib sou sèvè a. Admin dwe mete FACEPLUSPLUS_API_KEY ak FACEPLUSPLUS_API_SECRET nan Vercel.'
          : faceResult.error || 'Konpare figi echwe.',
        face_confidence: faceResult.confidence ?? null,
      },
      { status: isConfig ? 503 : 400 }
    );
  }

  // B) OCR opsyonèl — nimewo manyèl se sous ofisyèl (OCR Face++ pa toujou li CIN Ayiti byen)
  let ocrResult = await extractIdNumberFromImage(idFront);
  if (!ocrResult.idNumber && idBack instanceof File) {
    const backOcr = await extractIdNumberFromImage(idBack);
    if (backOcr.idNumber) ocrResult = backOcr;
  }

  // Hash toujou sou nimewo itilizatè a antre (obligatwa) pou doublon nan DB
  const resolvedIdNumber = manualIdNumber;

  let idHash: string;
  try {
    idHash = hashKycIdNumber(resolvedIdNumber);
  } catch {
    return NextResponse.json(
      { error: 'Konfigirasyon sekirite KYC manke sou sèvè a (KYC_HASH_SECRET).' },
      { status: 503 }
    );
  }

  // D) Dokiman deja nan baz done?
  const { data: duplicate } = await admin
    .from('profiles')
    .select('id, email, kyc_status')
    .eq('kyc_id_number_hash', idHash)
    .neq('id', user.id)
    .in('kyc_status', [KYC_STATUS.PENDING, KYC_STATUS.APPROVED])
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json(
      {
        error:
          'Nimewo dokiman sa a deja anrejistre sou yon lòt kont. Si se ou, kontakte sipò HatexCard.',
      },
      { status: 409 }
    );
  }

  const timestamp = Date.now();
  const frontPath = `${user.id}/front_${timestamp}.jpg`;
  const selfiePath = `${user.id}/selfie_${timestamp}.jpg`;
  let backPath: string | null = null;

  const uploadFile = async (path: string, file: File) => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await admin.storage.from(KYC_BUCKET).upload(path, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw error;
  };

  try {
    await uploadFile(frontPath, idFront);
    await uploadFile(selfiePath, selfie);
    if (idBack instanceof File) {
      backPath = `${user.id}/back_${timestamp}.jpg`;
      await uploadFile(backPath, idBack);
    }
  } catch (uploadErr: unknown) {
    const msg = uploadErr instanceof Error ? uploadErr.message : '';
    const bucketHint =
      msg.includes('Bucket not found') || msg.includes('bucket')
        ? ' Bucket kyc-documents pa kreye — kouri migration 20260725 nan Supabase SQL Editor.'
        : '';
    return NextResponse.json(
      { error: `Pa t kapab sove dokiman yo.${bucketHint} Eseye ankò.` },
      { status: 500 }
    );
  }

  const { error: updateError } = await admin
    .from('profiles')
    .update({
      kyc_status: KYC_STATUS.PENDING,
      full_name: `${firstName} ${lastName}`.trim(),
      kyc_doc_type: docType,
      kyc_front: frontPath,
      kyc_back: backPath,
      kyc_selfie: selfiePath,
      kyc_id_number_hash: idHash,
      kyc_face_match_score: faceResult.confidence ?? null,
      kyc_submitted_at: new Date().toISOString(),
      kyc_rejection_reason: null,
    })
    .eq('id', user.id);

  if (updateError) {
    const colHint =
      updateError.message?.includes('kyc_doc_type') || updateError.message?.includes('column')
        ? ' Kouri migration 20260725_kyc_hardening.sql nan Supabase.'
        : '';
    return NextResponse.json(
      { error: `Pa t kapab mete ajou pwofil la.${colHint}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: faceResult.needsReview
      ? 'Dokiman yo soumèt. Figi w ap verifye pa ekip nou an (revizyon rapid).'
      : 'Dokiman yo soumèt. Ekip nou an ap revize yo.',
    face_confidence: faceResult.confidence,
    id_detected: Boolean(ocrResult.idNumber),
    needs_review: Boolean(faceResult.needsReview),
  });
}
