const FACE_COMPARE_URL = 'https://api-us.faceplusplus.com/facepp/v3/compare';
const OCR_ID_URL = 'https://api-us.faceplusplus.com/cardpp/v1/ocridcard';
const MIN_FACE_CONFIDENCE = 75;

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

export async function compareIdSelfie(idFile: File, selfieFile: File): Promise<FaceCompareResult> {
  const { apiKey, apiSecret } = getFaceCredentials();
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
    error: `Figi ou pa koresponn ak foto ID a (konfyans ${confidence.toFixed(1)}%). Pran yon selfie pi klè.`,
  };
}

export type OcrIdResult = {
  idNumber: string | null;
  rawName?: string;
};

/** Ekstrè nimewo ID soti nan foto devan dokiman an (Face++ OCR). */
export async function extractIdNumberFromImage(idFile: File): Promise<OcrIdResult> {
  const { apiKey, apiSecret } = getFaceCredentials();
  const body = new FormData();
  body.append('api_key', apiKey);
  body.append('api_secret', apiSecret);
  body.append('image', idFile);

  const res = await fetch(OCR_ID_URL, { method: 'POST', body });
  const result = await res.json().catch(() => ({}));

  if (result.error_message) {
    return { idNumber: null };
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
    result.id_card_number,
    result.card_number,
  ];

  const idNumber = candidates.find((v) => typeof v === 'string' && v.trim().length >= 4) || null;
  const rawName = fields.name?.value || fields.full_name?.value || undefined;

  return { idNumber: idNumber ? String(idNumber).trim() : null, rawName };
}

export function isKycStoragePath(value: string | null | undefined): boolean {
  if (!value) return false;
  return !value.startsWith('http://') && !value.startsWith('https://');
}
