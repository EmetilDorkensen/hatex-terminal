import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'reservation-media';

/** Ekstrè path storage nan URL piblik oswa path ki deja relativ. */
export function reservationMediaPathFromUrl(urlOrPath: string): string | null {
  const raw = String(urlOrPath || '').trim();
  if (!raw) return null;

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = raw.indexOf(marker);
  if (idx >= 0) {
    try {
      return decodeURIComponent(raw.slice(idx + marker.length).split('?')[0] || '');
    } catch {
      return raw.slice(idx + marker.length).split('?')[0] || null;
    }
  }

  // Path relatif: userId/file.ext
  if (!raw.includes('://') && raw.includes('/')) {
    return raw.replace(/^\//, '');
  }
  return null;
}

export async function deleteReservationMediaFiles(
  admin: SupabaseClient,
  photoUrls: string[] | null | undefined
): Promise<void> {
  const paths = Array.from(
    new Set(
      (photoUrls || [])
        .map((u) => reservationMediaPathFromUrl(u))
        .filter((p): p is string => Boolean(p))
    )
  );
  if (!paths.length) return;

  const { error } = await admin.storage.from(BUCKET).remove(paths);
  if (error) {
    console.error('[reservation-media] remove failed:', error.message, paths);
  }
}
