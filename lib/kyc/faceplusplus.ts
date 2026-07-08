const FACE_COMPARE_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';
const FACE_DETECT_URL = 'https://api-us.faceplusplus.com/facepp/v3/detect';
const OCR_ID_URL = 'https://api-us.faceplusplus.com/cardpp/v1/ocridcard';

/** Konfyans minimòm pou match selfie vs ID (0–100). Face++ rekòmande ~70 pou menm moun. */
const MIN_FACE_CONFIDENCE = 65;
/** Si konfyans >= sa a men < MIN, pase ak revizyon admin. */
const REVIEW_FACE_CONFIDENCE = 58;

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

    const best = faces.reduce((a: { face_rectangle?: { width?: number } }, b: { face_rectangle?: { width?: number } }) => {
      const aw = a?.face_rectangle?.width || 0;
      const bw = b?.face_rectangle?.width || 0;
      return bw > aw ? b : a;
    });

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

/** Konte figi nan yon imaj. */
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
    return { success: false, error: result.error_message, method: 'face_token' };
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
    return { success: false, error: result.error_message, method: 'image' };
  }

  const confidence = Number(result.confidence || 0);
  return { success: confidence >= MIN_FACE_CONFIDENCE, confidence, method: 'image' };
}

/**
 * Konpare figi ID ↔ selfie — eseye face_token (pi bon pou ti foto sou CIN),
 * epi fallback sou konpare imaj konplè.
 */
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

  void apiKey;
  void apiSecret;

  const [idDetect, selfieDetect] = await Promise.all([
    detectPrimaryFace(idFile),
    detectPrimaryFace(selfieFile),
  ]);

  if (selfieDetect.faceCount < 1) {
    return {
      success: false,
      error:
        'Selfie a pa montre figi w klè. Pran yon selfie dwat, nan limyè, figi w sèlman (pa linèt/chapo).',
    };
  }

  let best: FaceCompareResult = { success: false, confidence: 0 };

  if (idDetect.faceToken && selfieDetect.faceToken) {
    const tokenCompare = await compareByFaceTokens(idDetect.faceToken, selfieDetect.faceToken);
    best = tokenCompare;
  }

  if (!best.success) {
    const imageCompare = await compareByImages(idFile, selfieFile);
    if ((imageCompare.confidence || 0) > (best.confidence || 0)) {
      best = imageCompare;
    }
  }

  const confidence = best.confidence || 0;

  if (confidence >= MIN_FACE_CONFIDENCE) {
    return { success: true, confidence, method: best.method, needsReview: false };
  }

  if (confidence >= REVIEW_FACE_CONFIDENCE) {
    return {
      success: true,
      confidence,
      method: best.method,
      needsReview: true,
    };
  }

  return {
    success: false,
    confidence,
    method: best.method,
    error:
      confidence > 0
        ? `Figi ou pa koresponn ase ak foto ID a (konfyans ${confidence.toFixed(1)}%). Pran yon selfie pi klè, san flèch, ak foto ID ki pa reflechi.`
        : 'Nou pa t kapab detekte figi sou ID oswa selfie a. Verifye foto yo klè epi eseye ankò.',
  };
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

export async function validateKycDocumentSides(opts: {
  idFront: File;
  idBack?: File | null;
  selfie: File;
  requireBack: boolean;
  enteredFullName?: string;
}): Promise<{ ok: boolean; error?: string; ocrName?: string }> {
  const selfieDetect = await detectPrimaryFace(opts.selfie);
  if (selfieDetect.error?.includes('FACEPLUSPLUS') || selfieDetect.error?.includes('konfigire')) {
    return { ok: false, error: selfieDetect.error };
  }
  if (selfieDetect.faceCount < 1) {
    return {
      ok: false,
      error: 'Selfie a pa montre figi w klè. Pran yon selfie dwat, nan limyè, san flèch.',
    };
  }

  if (opts.requireBack) {
    if (!(opts.idBack instanceof File)) {
      return { ok: false, error: 'Foto DÈYÈ CIN obligatwa.' };
    }
    const backDetect = await detectPrimaryFace(opts.idBack);
    if (backDetect.faceCount >= 1) {
      const sideCompare = await compareByImages(opts.idFront, opts.idBack);
      if (sideCompare.success && (sideCompare.confidence || 0) >= 88) {
        return {
          ok: false,
          error:
            'Foto DÈYÈ a sanble se menm FAS ak DEVAN an. Voye foto lòt bò kat la (pa menm foto fas lan).',
        };
      }
    }
  }

  const ocr = await extractIdNumberFromImage(opts.idFront);
  // Non OCR se enfòmasyon siplemantè — pa bloke si OCR pa li non Ayisyen byen
  void opts.enteredFullName;
  void ocr.rawName;

  return { ok: true, ocrName: ocr.rawName };
}

export function isKycStoragePath(value: string | null | undefined): boolean {
  if (!value) return false;
  return !value.startsWith('http://') && !value.startsWith('https://');
}
