export const DEPOSIT_PROOF_BUCKET = 'deposit-proofs';
export const LEGACY_PROOF_BUCKET = 'proofs';

export type DepositProofLocation = {
  bucket: string;
  path: string;
};

/** Ref ki soti nan DB: chemen storage oswa URL piblik ansyen. */
export function resolveDepositProofLocation(ref: string): DepositProofLocation | null {
  const trimmed = String(ref || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const marker = '/storage/v1/object/public/';
      const idx = url.pathname.indexOf(marker);
      if (idx === -1) return null;
      const rest = url.pathname.slice(idx + marker.length);
      const slash = rest.indexOf('/');
      if (slash <= 0) return null;
      const bucket = rest.slice(0, slash);
      const path = decodeURIComponent(rest.slice(slash + 1));
      if (!bucket || !path || path.includes('..')) return null;
      return { bucket, path };
    } catch {
      return null;
    }
  }

  if (trimmed.includes('..') || trimmed.startsWith('/')) return null;
  return { bucket: DEPOSIT_PROOF_BUCKET, path: trimmed };
}

export function isPublicProofUrl(ref: string): boolean {
  return ref.startsWith('http://') || ref.startsWith('https://');
}
