const FACE_COMPARE_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';
const FACE_DETECT_URL = 'https://api-us.faceplusplus.com/facepp/v3/detect';
const OCR_ID_URL = 'https://api-us.faceplusplus.com/cardpp/v1/ocridcard';

/** Konfyans minimòm pou match selfie vs ID (0–100). */
const MIN_FACE_CONFIDENCE = 78;

function getFaceCredentials() {
  const apiKey = process.env.FACEPLUSPLUS_API_KEY;
  const apiSecret = process.env.FACEPLUSPLUS_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('FACEPLUSPLUS_API_KEY / FACEPLUSPLUS_API_SECRET pa konfigire.');
  }
  return { apiKey, apiSecret };
}

export type FaceCompareResult = {
  success: boolean;
  confidence?: number;
  error?: string;
};

export type FaceDetectResult = {
  faceCount: number;
  error?: string;
};

/** Konte figi nan yon imaj (pou verifye fas ID gen 1 figi, dèyè pa gen menm figi, selfie gen 1). */
export async function detectFaces(imageFile: File): Promise<FaceDetectResult> {
  try {
    const { apiKey, apiSecret } = getFaceCredentials();
    const body = new FormData();
    body.append('api_key', apiKey);
    body.append('api_secret', apiSecret);
    body.append('image_file', imageFile);

    const res = await fetch(FACE_DETECT_URL, { method: 'POST', body });
    const result = await res.json().catch(() => ({}));

    if (result.error_message) {
      return { faceCount: 0, error: result.error_message };
    }

    const faces = Array.isArray(result.faces) ? result.faces : [];
    return { faceCount: faces.length };
  } catch (e) {
    return {
      faceCount: 0,
      error: e instanceof Error ? e.message : 'Detect echwe.',
    };
  }
}

export async function compareIdSelfie(idFile: File, selfieFile: File): Promise<FaceCompareResult> {
  let apiKey: string;
  let apiSecret: string;
  try {
    ({ apiKey, apiSecret } = getFaceCredentials());
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : 'FACEPLUSPLUS_API_KEY / FACEPLUSPLUS_API_SECRET pa konfigire sou Vercel.',
    };
  }

  const body = new FormData();
  body.append('api_key', apiKey);
  body.append('api_secret', apiSecret);
  body.append('image_file1', idFile);
  body.append('image_file2', selfieFile);

  const res = await fetch(FACE_COMPARE_URL, { method: 'POST', body });
  const result = await res.json().catch(() => ({}));

  if (result.error_message) {
    return { success: false, error: result.error_message };
  }

  const confidence = Number(result.confidence || 0);
  if (confidence >= MIN_FACE_CONFIDENCE) {
    return { success: true, confidence };
  }

  return {
    success: false,
    confidence,
    error: `Figi ou pa koresponn ak foto ID a (konfyans ${confidence.toFixed(1)}%). Pran yon selfie pi klè nan limyè, san linèt/chapo.`,
  };
}

export type OcrIdResult = {
  idNumber: string | null;
  rawName?: string;
  rawText?: string;
};

function pickIdFromText(text: string): string | null {
  const cleaned = text.toUpperCase().replace(/[\s\-]/g, ' ');
  // CIN Ayiti tipik: 2–3 lèt + 6–10 chif, oswa 10–12 chif
  const patterns = [
    /\b([A-Z]{2,3}\d{6,10})\b/,
    /\b(\d{10,12})\b/,
    /\b([A-Z0-9]{8,14})\b/,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function deepCollectStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === 'string' && obj.trim().length >= 3) {
    out.push(obj.trim());
  } else if (Array.isArray(obj)) {
    obj.forEach((v) => deepCollectStrings(v, out));
  } else if (obj && typeof obj === 'object') {
    Object.values(obj as Record<string, unknown>).forEach((v) => deepCollectStrings(v, out));
  }
  return out;
}

/** Ekstrè nimewo ID — Face++ OCR + regex pou CIN Ayiti. */
export async function extractIdNumberFromImage(idFile: File): Promise<OcrIdResult> {
  try {
    const { apiKey, apiSecret } = getFaceCredentials();
    const body = new FormData();
    body.append('api_key', apiKey);
    body.append('api_secret', apiSecret);
    body.append('image', idFile);

    const res = await fetch(OCR_ID_URL, { method: 'POST', body });
    const result = await res.json().catch(() => ({}));

    if (result.error_message) {
      return { idNumber: null, rawText: String(result.error_message) };
    }

    const cards = result.cards || result.results || [];
    const first = Array.isArray(cards) ? cards[0] : result;
    const fields = first?.fields || first || {};

    const candidates = [
      fields.id_card_number?.value,
      fields.card_number?.value,
      fields.number?.value,
      fields.passport_number?.value,
      fields.license_number?.value,
      fields.IDNumber?.value,
      fields.id_number?.value,
      result.id_card_number,
      result.card_number,
    ];

    let idNumber =
      candidates.find((v) => typeof v === 'string' && String(v).trim().length >= 4) || null;

    const allStrings = deepCollectStrings(result).join(' ');
    if (!idNumber) {
      idNumber = pickIdFromText(allStrings);
    }

    const rawName =
      fields.name?.value ||
      fields.full_name?.value ||
      fields.Name?.value ||
      undefined;

    return {
      idNumber: idNumber ? String(idNumber).trim().toUpperCase().replace(/[\s\-]/g, '') : null,
      rawName,
      rawText: allStrings.slice(0, 500),
    };
  } catch {
    return { idNumber: null };
  }
}

/**
 * Verifye fas vs dèyè:
 * - Devan ID dwe gen omwen 1 figi
 * - Dèyè pa dwe menm foto kòm devan (konpare ba = OK; konpare wo = menm fas)
 * - Selfie dwe gen egzakteman 1 figi
 */
export async function validateKycDocumentSides(opts: {
  idFront: File;
  idBack?: File | null;
  selfie: File;
  requireBack: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const frontDetect = await detectFaces(opts.idFront);
  if (frontDetect.error?.includes('FACEPLUSPLUS') || frontDetect.error?.includes('konfigire')) {
    return { ok: false, error: frontDetect.error };
  }
  if (frontDetect.faceCount < 1) {
    return {
      ok: false,
      error: 'Foto DEVAN an pa montre yon figi klè. Pran foto fas kat ID a (kote foto moun lan ye).',
    };
  }

  const selfieDetect = await detectFaces(opts.selfie);
  if (selfieDetect.faceCount !== 1) {
    return {
      ok: false,
      error:
        selfieDetect.faceCount === 0
          ? 'Selfie a pa montre figi w klè. Pran yon lòt foto figi w.'
          : 'Selfie a dwe montre SÈLMAN figi ou (yon moun).',
    };
  }

  if (opts.requireBack) {
    if (!(opts.idBack instanceof File)) {
      return { ok: false, error: 'Foto DÈYÈ CIN obligatwa.' };
    }
    const backDetect = await detectFaces(opts.idBack);
    // Dèyè CIN souvan pa gen figi — OK. Si li gen figi + match wo ak front = menm fas voye 2 fwa
    if (backDetect.faceCount >= 1) {
      const sideCompare = await compareIdSelfie(opts.idFront, opts.idBack);
      if (sideCompare.success && (sideCompare.confidence || 0) >= 85) {
        return {
          ok: false,
          error: 'Foto DÈYÈ a sanble se menm fas ak DEVAN an. Voye foto dèyè kat la (pa foto fas lan ankò).',
        };
      }
    }
  }

  return { ok: true };
}

export function isKycStoragePath(value: string | null | undefined): boolean {
  if (!value) return false;
  return !value.startsWith('http://') && !value.startsWith('https://');
}
