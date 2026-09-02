import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { compareIdSelfie, detectFaces } from '@/lib/kyc/faceplusplus';
import { signedDocumentUrl, uploadKycDocument, deleteKycDocument } from './documents';
import type { KycApplication } from './application';

/**
 * Verifikasyon liveness.
 *
 * Kliyan an kaptire plizyè imaj SEGONN APRE SEGONN depi flux kamera a (pa yon
 * chwazi-fichye). Sèvè a verifye:
 *
 *   1. Imaj yo DIFERAN youn ak lòt — menm fichye voye plizyè fwa rejte.
 *   2. Face++ konpare ak pyès idantite a; nòt ba ale nan revizyon imen,
 *      pa rejte otomatik (CIN Ayiti souvan bay nòt ba pou menm moun lan).
 *
 * Papòt yo swiv menm filozofi ak KYC v1: nou pa bloke moun san rezon — ka
 * limit yo ale nan revizyon imen olye yo rejte.
 */

/** Konbyen imaj nou mande depi kamera a. */
export const REQUIRED_FRAMES = 3;

/** Anba sa a, nou pa kwè se yon moun vivan devan kamera a. */
const MIN_FRAME_DIVERSITY = 2;

export type LivenessResult =
  | {
      ok: true;
      selfiePath: string;
      confidence: number;
      needsManualReview: boolean;
      frameCount: number;
    }
  | { ok: false; status: number; code: string; message: string };

function sha(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Konte konbyen imaj ki vrèman diferan. Imaj byte-pou-byte idantik konte
 * yon sèl fwa — se konsa nou kenbe menm foto voye plizyè fwa deyò.
 */
async function countDistinctFrames(frames: File[]): Promise<number> {
  const hashes = new Set<string>();
  for (const frame of frames) {
    hashes.add(sha(Buffer.from(await frame.arrayBuffer())));
  }
  return hashes.size;
}

/**
 * Verifye yon seri imaj kamera kont pyès idantite a.
 * Si tout bagay pase, pi bon imaj la vin selfie ofisyèl dosye a.
 */
export async function verifyLiveness(
  admin: SupabaseClient,
  app: KycApplication,
  frames: File[]
): Promise<LivenessResult> {
  if (!app.id_front_path) {
    return {
      ok: false,
      status: 409,
      code: 'id_required_first',
      message: 'Voye foto pyès idantite ou anvan ou verifye figi ou.',
    };
  }

  if (frames.length < REQUIRED_FRAMES) {
    return {
      ok: false,
      status: 400,
      code: 'not_enough_frames',
      message: `Nou bezwen ${REQUIRED_FRAMES} imaj depi kamera a. Eseye ankò.`,
    };
  }

  const distinct = await countDistinctFrames(frames);
  if (distinct < MIN_FRAME_DIVERSITY) {
    return {
      ok: false,
      status: 400,
      code: 'static_image',
      message:
        'Imaj yo tout idantik. Fòk se kamera a k ap kaptire an dirèk — yon foto ' +
        'enprime oswa yon imaj ki deja sere pa aksepte.',
    };
  }

  // Pa bloke sou deteksyon figi: foto telefòn (HEIC, gwo fichye, limyè fèb)
  // souvan echwe detect men yo bon pou konparezon. Nou pran pi gwo imaj la
  // epi kite Face++ compare + admin revizyon fè desizyon an.
  let usable: File = frames[0];
  let biggest = 0;
  let sawMultipleFaces = 0;

  for (const frame of frames) {
    if (frame.size > biggest) {
      biggest = frame.size;
      usable = frame;
    }
    const detected = await detectFaces(frame);
    if (detected.faceCount > 1) sawMultipleFaces += 1;
    if (detected.faceCount === 1) usable = frame;
  }

  if (sawMultipleFaces === frames.length) {
    return {
      ok: false,
      status: 400,
      code: 'multiple_faces',
      message: 'Gen plis pase yon moun nan foto yo. Fòk se ou sèl.',
    };
  }

  // Konpare ak pyès idantite a
  const idUrl = await signedDocumentUrl(admin, app.id_front_path, 120);
  if (!idUrl) {
    return {
      ok: false,
      status: 500,
      code: 'id_unavailable',
      message: 'Pa t kapab li foto pyès idantite ou. Voye l ankò.',
    };
  }

  const idResponse = await fetch(idUrl);
  if (!idResponse.ok) {
    return {
      ok: false,
      status: 500,
      code: 'id_unavailable',
      message: 'Pa t kapab li foto pyès idantite ou. Voye l ankò.',
    };
  }

  const idFile = new File([await idResponse.arrayBuffer()], 'id_front.jpg', {
    type: idResponse.headers.get('content-type') || 'image/jpeg',
  });

  const compared = await compareIdSelfie(idFile, usable);
  const confidence = Number(compared.confidence || 0);
  // Foto CIN Ayiti souvan bay nòt ba menm pou menm moun lan.
  // Nou pa bloke kliyan an — nòt la ale bay admin pou revizyon.
  const needsManualReview = compared.needsReview === true || !compared.success || confidence < 50;

  const uploaded = await uploadKycDocument(admin, app.user_id, 'selfie', usable);
  if (!uploaded.ok) return uploaded;

  const now = new Date().toISOString();

  const { error } = await admin
    .from('hatex_kyc_applications')
    .update({
      selfie_path: uploaded.path,
      face_match_score: confidence,
      liveness_passed: true,
      liveness_frame_count: frames.length,
      liveness_checked_at: now,
      needs_manual_review: needsManualReview,
      updated_at: now,
    })
    .eq('id', app.id)
    .eq('status', 'draft');

  if (error) {
    await deleteKycDocument(admin, uploaded.path);
    return { ok: false, status: 500, code: 'storage_error', message: error.message };
  }

  await deleteKycDocument(admin, app.selfie_path);

  return {
    ok: true,
    selfiePath: uploaded.path,
    confidence,
    needsManualReview,
    frameCount: frames.length,
  };
}
