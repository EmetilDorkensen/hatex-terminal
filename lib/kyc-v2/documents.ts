import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_IMAGE_MIME,
  DOCUMENT_SLOT_COLUMNS,
  MAX_DOCUMENT_BYTES,
  type DocumentSlot,
} from './config';

/**
 * Dokiman KYC v2 rete nan yon bucket PRIVE (`kyc-documents-v2`).
 *
 * Chemen: `{userId}/{slot}_{timestamp}.{ext}` — konsa politik RLS ki mande
 * `name LIKE auth.uid() || '/%'` toujou kenbe, epi yon moun pa ka janm li
 * dokiman yon lòt moun.
 *
 * Nou pa janm sere URL piblik: revizyon fèt ak URL siyen ki ekspire.
 */

export const KYC_V2_BUCKET = 'kyc-documents-v2';

const SIGNED_URL_TTL_SEC = 300;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; status: number; code: string; message: string };

/** iPhone souvan voye type vid oswa image/jpg. */
function resolveUploadMime(file: File): string {
  const declared = (file.type || '').toLowerCase().trim();
  if (declared === 'image/jpg') return 'image/jpeg';
  if (declared && declared !== 'application/octet-stream') return declared;
  return 'image/jpeg';
}

function validateFile(file: File, slot: DocumentSlot): UploadResult | null {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, status: 400, code: 'missing_file', message: 'Pa gen fichye.' };
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    const mb = Math.round(MAX_DOCUMENT_BYTES / (1024 * 1024));
    return {
      ok: false,
      status: 413,
      code: 'file_too_large',
      message: `Fichye a twò gwo. Maksimòm ${mb} Mo.`,
    };
  }

  const mime = resolveUploadMime(file);

  // Foto figi dwe se yon imaj — yon PDF pa ka verifye
  const allowed: readonly string[] =
    slot === 'selfie' ? ALLOWED_IMAGE_MIME : ALLOWED_DOCUMENT_MIME;

  if (mime === 'image/heic' || mime === 'image/heif') {
    return {
      ok: false,
      status: 415,
      code: 'unsupported_type',
      message:
        'Telefòn ou voye foto HEIC. Pran foto a dirèk ak kamera a nan paj sa a (pa galri a).',
    };
  }

  if (!allowed.includes(mime)) {
    return {
      ok: false,
      status: 415,
      code: 'unsupported_type',
      message:
        slot === 'selfie'
          ? 'Foto figi a dwe se yon imaj (JPG, PNG oswa WEBP).'
          : 'Fòma aksepte: JPG, PNG, WEBP oswa PDF.',
    };
  }

  return null;
}

/** Voye yon dokiman monte epi retounen chemen li nan storage. */
export async function uploadKycDocument(
  admin: SupabaseClient,
  userId: string,
  slot: DocumentSlot,
  file: File
): Promise<UploadResult> {
  const invalid = validateFile(file, slot);
  if (invalid) return invalid;

  const mime = resolveUploadMime(file);
  const ext = EXTENSIONS[mime] || 'jpg';
  const path = `${userId}/${slot}_${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from(KYC_V2_BUCKET).upload(path, buffer, {
    contentType: mime || 'application/octet-stream',
    upsert: false,
  });

  if (error) {
    return { ok: false, status: 500, code: 'upload_failed', message: error.message };
  }

  return { ok: true, path };
}

/** Efase yon fichye. Pa kraze si li deja disparèt. */
export async function deleteKycDocument(
  admin: SupabaseClient,
  path: string | null | undefined
): Promise<void> {
  if (!path) return;
  try {
    await admin.storage.from(KYC_V2_BUCKET).remove([path]);
  } catch {
    /* fichye a ka deja pa la */
  }
}

/**
 * Ranplase yon dokiman sou yon dosye: voye nouvo a monte, mete kolòn nan ajou,
 * epi efase ansyen fichye a pou l pa rete nan storage pou toujou.
 */
export async function replaceApplicationDocument(
  admin: SupabaseClient,
  params: {
    applicationId: string;
    userId: string;
    slot: DocumentSlot;
    file: File;
    previousPath: string | null;
  }
): Promise<UploadResult> {
  const uploaded = await uploadKycDocument(admin, params.userId, params.slot, params.file);
  if (!uploaded.ok) return uploaded;

  const column = DOCUMENT_SLOT_COLUMNS[params.slot];

  const { error } = await admin
    .from('hatex_kyc_applications')
    .update({ [column]: uploaded.path, updated_at: new Date().toISOString() })
    .eq('id', params.applicationId)
    .eq('status', 'draft');

  if (error) {
    // Pa kite yon fichye òfelen dèyè
    await deleteKycDocument(admin, uploaded.path);
    return { ok: false, status: 500, code: 'storage_error', message: error.message };
  }

  await deleteKycDocument(admin, params.previousPath);

  return uploaded;
}

/** URL siyen tanporè pou revizyon admin. */
export async function signedDocumentUrl(
  admin: SupabaseClient,
  path: string,
  ttlSec: number = SIGNED_URL_TTL_SEC
): Promise<string | null> {
  const { data } = await admin.storage.from(KYC_V2_BUCKET).createSignedUrl(path, ttlSec);
  return data?.signedUrl || null;
}
