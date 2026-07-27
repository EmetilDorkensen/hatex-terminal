const FACE_COMPARE_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';
const FACE_DETECT_URL = 'https://api-us.faceplusplus.com/facepp/v3/detect';
const OCR_ID_URL = 'https://api-us.faceplusplus.com/cardpp/v1/ocridcard';

/**
 * CIN / paspò Ayiti: foto ID souvan ansyen, lamine, oswa piti → Face++ bay nòt ba
 * menm pou menm moun lan. Pa bloke kliyan fasil — voye ka limit yo bay admin.
 *
 * Face++ 1e-3 threshold ≈ 62. Nou aksepte otomatikman pi ba, epi review imen pou zòn gri.
 */
const MIN_FACE_CONFIDENCE = 50;
const REVIEW_FACE_CONFIDENCE = 30;
/** Sèlman anba sa a nou rejte otomatikman (lè API a te bay yon nòt reyèl). */
const HARD_REJECT_CONFIDENCE = 20;

function getFaceCredentials() {
  const apiKey = process.env.FACEPLUSPLUS_API_KEY;
  const apiSecret = process.env.FACEPLUSPLUS_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('FACEPLUSPLUS_API_KEY / FACEPLUSPLUS_API_SECRET pa konfigire.');
  }
  return { apiKey, apiSecret };
}

/** Clone pou ka Face++ / FormData li menm Blob plizyè fwa san stream vide. */
async function cloneImageFile(file: File, suffix = 'clone'): Promise<File> {
  const buf = await file.arrayBuffer();
  const name = file.name || `kyc-${suffix}.jpg`;
  return new File([buf], name, { type: file.type || 'image/jpeg' });
}

export type FaceCompareResult = {
  success: boolean;
  confidence?: number;
  error?: string;
  needsReview?: boolean;
  method?: 'face_token' | 'image' | 'api_fallback';
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
    return {
      success: false,
      error: result.error_message,
      method: 'face_token',
      confidence: 0,
      needsReview: true,
    };
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
    return {
      success: false,
      error: result.error_message,
      method: 'image',
      confidence: 0,
      needsReview: true,
    };
  }

  const confidence = Number(result.confidence || 0);
  return { success: confidence >= MIN_FACE_CONFIDENCE, confidence, method: 'image' };
}

function evaluateConfidence(best: FaceCompareResult): FaceCompareResult {
  const confidence = Number(best.confidence || 0);
  const apiFailed = Boolean(best.error) && confidence <= 0;

  // Erè Face++ / timeout / quota → pa bloke kliyan; admin verifye
  if (apiFailed) {
    return {
      ...best,
      success: true,
      confidence: 0,
      needsReview: true,
      method: best.method || 'api_fallback',
      error: undefined,
    };
  }

  if (confidence >= MIN_FACE_CONFIDENCE) {
    return { ...best, success: true, confidence, needsReview: false };
  }

  // Zòn gri (foto ID ansyen / limyè fèb) → aksepte soumisyon, flag revizyon
  if (confidence >= REVIEW_FACE_CONFIDENCE) {
    return { ...best, success: true, confidence, needsReview: true };
  }

  // Konpare pa jwenn nòt (0) men pa gen erè API — souvan figi ID twò piti sou CIN.
  // Voye bay admin olye bloke kliyan ki gen foto klè.
  if (confidence <= 0) {
    return {
      ...best,
      success: true,
      confidence: 0,
      needsReview: true,
      method: best.method || 'api_fallback',
      error: undefined,
    };
  }

  // Nòt trè ba men > 0: toujou bay revizyon imen si li pa anba hard reject
  if (confidence >= HARD_REJECT_CONFIDENCE) {
    return { ...best, success: true, confidence, needsReview: true };
  }

  return {
    ...best,
    success: false,
    confidence,
    needsReview: false,
    error: `Figi ou pa koresponn ak foto ID a (konfyans ${confidence.toFixed(1)}%). Asire se menm moun lan, selfie dwat nan limyè natirèl, san linèt solèy / mask.`,
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

  // Clone chak fwa pou evite Blob/stream vide apre plizyè FormData append
  const idForImage = await cloneImageFile(idFile, 'id-img');
  const selfieForImage = await cloneImageFile(selfieFile, 'selfie-img');
  const idForDetect = await cloneImageFile(idFile, 'id-det');
  const selfieForDetect = await cloneImageFile(selfieFile, 'selfie-det');

  let best: FaceCompareResult = { success: false, confidence: 0 };

  try {
    const imageCompare = await compareByImages(idForImage, selfieForImage);
    best = imageCompare;
  } catch (e) {
    best = {
      success: false,
      confidence: 0,
      needsReview: true,
      method: 'api_fallback',
      error: e instanceof Error ? e.message : 'Compare echwe',
    };
  }

  try {
    const [idDetect, selfieDetect] = await Promise.all([
      detectPrimaryFace(idForDetect),
      detectPrimaryFace(selfieForDetect),
    ]);

    if (idDetect.faceToken && selfieDetect.faceToken) {
      const tokenCompare = await compareByFaceTokens(idDetect.faceToken, selfieDetect.faceToken);
      if ((tokenCompare.confidence || 0) > (best.confidence || 0)) {
        best = tokenCompare;
      }
    }
  } catch {
    // Detect/token opsyonèl — pa kraze si image compare deja gen nòt
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
    try {
      const backClone = await cloneImageFile(opts.idBack, 'back');
      const frontClone = await cloneImageFile(opts.idFront, 'front-side');
      const backDetect = await detectPrimaryFace(backClone);
      // Dèyè CIN Ayiti pa gen figi — si gen figi + match trè wo ak fas, se kopi fas
      if (backDetect.faceCount >= 1) {
        const sideCompare = await compareByImages(frontClone, backClone);
        if ((sideCompare.confidence || 0) >= 92) {
          return {
            ok: false,
            error:
              'Foto DÈYÈ a sanble se menm FAS ak DEVAN an. Voye foto lòt bò kat la (pa menm foto fas lan).',
          };
        }
      }
    } catch {
      // Pa bloke soumisyon si deteksyon kote echwe — admin ka verifye
    }
  }

  return { ok: true };
}

export function isKycStoragePath(value: string | null | undefined): boolean {
  if (!value) return false;
  return !value.startsWith('http://') && !value.startsWith('https://');
}
