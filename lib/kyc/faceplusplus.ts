const FACE_COMPARE_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';
const FACE_DETECT_URL = 'https://api-us.faceplusplus.com/facepp/v3/detect';
const OCR_ID_URL = 'https://api-us.faceplusplus.com/cardpp/v1/ocridcard';

const MIN_FACE_CONFIDENCE = 58;
const REVIEW_FACE_CONFIDENCE = 48;

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
  needsReview?: boolean;
  method?: 'face_token' | 'image';
};

export type FaceDetectResult = {
  faceCount: number;
  faceToken?: string;
  error?: string;
};

async function detectPrimaryFace(imageFile: File): Promise<FaceDetectResult> {
  try {
    const { apiKey, apiSecret } = getFaceCredentials();
    const body = new FormData();
    body.append('api_key', apiKey);
    body.append('api_secret', apiSecret);
    body.append('image_file', imageFile);
    body.append('return_landmark', '0');

    const res = await fetch(FACE_DETECT_URL, { method: 'POST', body });
    const result = await res.json().catch(() => ({}));

    if (result.error_message) {
      return { faceCount: 0, error: result.error_message };
    }

    const faces = Array.isArray(result.faces) ? result.faces : [];
    if (!faces.length) return { faceCount: 0 };

    const best = faces.reduce(
      (a: { face_rectangle?: { width?: number } }, b: { face_rectangle?: { width?: number } }) => {
        const aw = a?.face_rectangle?.width || 0;
        const bw = b?.face_rectangle?.width || 0;
        return bw > aw ? b : a;
      }
    );

    return {
      faceCount: faces.length,
      faceToken: best?.face_token || faces[0]?.face_token,
    };
  } catch (e) {
    return {
      faceCount: 0,
      error: e instanceof Error ? e.message : 'Detect echwe.',
    };
  }
}

export async function detectFaces(imageFile: File): Promise<FaceDetectResult> {
  return detectPrimaryFace(imageFile);
}

async function compareByFaceTokens(token1: string, token2: string): Promise<FaceCompareResult> {
  const { apiKey, apiSecret } = getFaceCredentials();
  const body = new FormData();
  body.append('api_key', apiKey);
  body.append('api_secret', apiSecret);
  body.append('face_token1', token1);
  body.append('face_token2', token2);

  const res = await fetch(FACE_COMPARE_URL, { method: 'POST', body });
  const result = await res.json().catch(() => ({}));

  if (result.error_message) {
    return { success: false, error: result.error_message, method: 'face_token', confidence: 0 };
  }

  const confidence = Number(result.confidence || 0);
  return { success: confidence >= MIN_FACE_CONFIDENCE, confidence, method: 'face_token' };
}

async function compareByImages(idFile: File, selfieFile: File): Promise<FaceCompareResult> {
  const { apiKey, apiSecret } = getFaceCredentials();
  const body = new FormData();
  body.append('api_key', apiKey);
  body.append('api_secret', apiSecret);
  body.append('image_file1', idFile);
  body.append('image_file2', selfieFile);

  const res = await fetch(FACE_COMPARE_URL, { method: 'POST', body });
  const result = await res.json().catch(() => ({}));

  if (result.error_message) {
    return { success: false, error: result.error_message, method: 'image', confidence: 0 };
  }

  const confidence = Number(result.confidence || 0);
  return { success: confidence >= MIN_FACE_CONFIDENCE, confidence, method: 'image' };
}

function evaluateConfidence(best: FaceCompareResult): FaceCompareResult {
  const confidence = best.confidence || 0;

  if (confidence >= MIN_FACE_CONFIDENCE) {
    return { ...best, success: true, confidence, needsReview: false };
  }
  if (confidence >= REVIEW_FACE_CONFIDENCE) {
    return { ...best, success: true, confidence, needsReview: true };
  }

  return {
    ...best,
    success: false,
    confidence,
    error:
      confidence > 0
        ? `Figi ou pa koresponn ase ak foto ID a (konfyans ${confidence.toFixed(1)}%). Eseye yon selfie pi klè, dwat, nan limyè natirèl.`
        : 'Nou pa t kapab verifye figi a otomatikman. Verifye foto ID ak selfie yo klè, epi eseye ankò.',
  };
}

/**
 * Konpare figi ID ↔ selfie.
 * Konpare imaj konplè an premye (pi fyab sou selfie mobil), epi face_token si disponib.
 * Pa bloke sou deteksyon figi — anpil selfie bon echwe detect men pase compare.
 */
export async function compareIdSelfie(idFile: File, selfieFile: File): Promise<FaceCompareResult> {
  try {
    getFaceCredentials();
  } catch (e) {
    return {
      success: false,
      error:
        e instanceof Error
          ? e.message
          : 'FACEPLUSPLUS_API_KEY / FACEPLUSPLUS_API_SECRET pa konfigire sou Vercel.',
    };
  }

  let best: FaceCompareResult = { success: false, confidence: 0 };

  const imageCompare = await compareByImages(idFile, selfieFile);
  best = imageCompare;

  const [idDetect, selfieDetect] = await Promise.all([
    detectPrimaryFace(idFile),
    detectPrimaryFace(selfieFile),
  ]);

  if (idDetect.faceToken && selfieDetect.faceToken) {
    const tokenCompare = await compareByFaceTokens(idDetect.faceToken, selfieDetect.faceToken);
    if ((tokenCompare.confidence || 0) > (best.confidence || 0)) {
      best = tokenCompare;
    }
  }

  return evaluateConfidence(best);
}

export type OcrIdResult = {
  idNumber: string | null;
  rawName?: string;
  rawText?: string;
};

function pickIdFromText(text: string): string | null {
  const cleaned = text.toUpperCase().replace(/[\s\-]/g, ' ');
  const patterns = [/\b([A-Z]{2,3}\d{6,10})\b/, /\b(\d{10,12})\b/, /\b([A-Z0-9]{8,14})\b/];
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
      fields.name?.value || fields.full_name?.value || fields.Name?.value || undefined;

    return {
      idNumber: idNumber ? String(idNumber).trim().toUpperCase().replace(/[\s\-]/g, '') : null,
      rawName,
      rawText: allStrings.slice(0, 500),
    };
  } catch {
    return { idNumber: null };
  }
}

/** Verifye fas vs dèyè CIN — pa bloke sou deteksyon selfie (fèt nan compareIdSelfie). */
export async function validateKycDocumentSides(opts: {
  idFront: File;
  idBack?: File | null;
  selfie: File;
  requireBack: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  void opts.selfie;

  if (opts.requireBack) {
    if (!(opts.idBack instanceof File)) {
      return { ok: false, error: 'Foto DÈYÈ CIN obligatwa.' };
    }
    const backDetect = await detectPrimaryFace(opts.idBack);
    if (backDetect.faceCount >= 1) {
      const sideCompare = await compareByImages(opts.idFront, opts.idBack);
      if ((sideCompare.confidence || 0) >= 90) {
        return {
          ok: false,
          error:
            'Foto DÈYÈ a sanble se menm FAS ak DEVAN an. Voye foto lòt bò kat la (pa menm foto fas lan).',
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
