'use client';

/**
 * Konvèti nenpòt imaj kamera (HEIC iPhone, PNG, JPEG gwo, foto vire) an JPEG
 * piti pou Face++ ka li l. Face++ refize fichye > 2 Mo — foto telefòn yo
 * souvan 4–12 Mo, epi EXIF rotation fè figi a parèt kouche.
 */
export async function toKycJpeg(
  file: Blob,
  maxWidth = 960,
  quality = 0.85
): Promise<File> {
  const bitmap = await loadBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height, 1);
    const scale = Math.min(1, maxWidth / longest);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('jpeg'))),
        'image/jpeg',
        quality
      );
    });

    return new File([blob], 'frame.jpg', { type: 'image/jpeg' });
  } finally {
    bitmap.close();
  }
}

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Safari / kèk Android: ImageBitmap ka echwe sou HEIC — eseye <img>
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
