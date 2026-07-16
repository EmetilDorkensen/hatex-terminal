export const AGENT_DOCS_BUCKET = 'agent_documents';
export const ENTERPRISE_DOCS_BUCKET = 'enterprise_documents';

export type AppDocLocation = {
  bucket: string;
  path: string;
};

/** Ref DB: chemen storage (`userId/file.jpg`) oswa URL piblik ansyen. */
export function resolveApplicationDocLocation(ref: string): AppDocLocation | null {
  const trimmed = String(ref || '').trim();
  if (!trimmed || trimmed.includes('..')) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const publicMarker = '/storage/v1/object/public/';
      const signMarker = '/storage/v1/object/sign/';
      let rest = '';
      const pubIdx = url.pathname.indexOf(publicMarker);
      const signIdx = url.pathname.indexOf(signMarker);
      if (pubIdx !== -1) {
        rest = url.pathname.slice(pubIdx + publicMarker.length);
      } else if (signIdx !== -1) {
        rest = url.pathname.slice(signIdx + signMarker.length);
      } else {
        return null;
      }
      const slash = rest.indexOf('/');
      if (slash <= 0) return null;
      const bucket = rest.slice(0, slash);
      const path = decodeURIComponent(rest.slice(slash + 1).split('?')[0]);
      if (!bucket || !path) return null;
      return { bucket, path };
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith('/')) return null;

  // Chemen prive nouvo fòma: {userId}/agent-...
  // Ansyen: agent-{uuid}-id-...
  const lower = trimmed.toLowerCase();
  if (lower.includes('enterprise') || lower.includes('business') || lower.includes('legal_rep')) {
    return { bucket: ENTERPRISE_DOCS_BUCKET, path: trimmed };
  }
  return { bucket: AGENT_DOCS_BUCKET, path: trimmed };
}

export function bucketsToTryForAppDoc(primary: string): string[] {
  if (primary === ENTERPRISE_DOCS_BUCKET) {
    return [ENTERPRISE_DOCS_BUCKET, AGENT_DOCS_BUCKET];
  }
  return [AGENT_DOCS_BUCKET, ENTERPRISE_DOCS_BUCKET];
}
