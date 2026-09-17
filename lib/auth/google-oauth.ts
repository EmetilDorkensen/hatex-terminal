import { publicSiteUrl } from '@/lib/urls/public';

/** URL redireksyon apre Google OAuth (Supabase Auth). */
export function googleOAuthRedirectTo(nextPath = '/auth/complete'): string {
  const base = publicSiteUrl().replace(/\/$/, '');
  const next = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
}
