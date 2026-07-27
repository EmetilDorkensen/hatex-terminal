import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { canViewKycDocuments, getAuthenticatedUser } from '@/lib/kyc/access';
import { isKycStoragePath } from '@/lib/kyc/faceplusplus';

const KYC_BUCKET = 'kyc-documents';
const SIGNED_URL_TTL_SEC = 300;

type DocField = 'front' | 'back' | 'selfie';

const DOC_COLUMN: Record<DocField, 'kyc_front' | 'kyc_back' | 'kyc_selfie'> = {
  front: 'kyc_front',
  back: 'kyc_back',
  selfie: 'kyc_selfie',
};

export async function GET(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('userId');
  const doc = url.searchParams.get('doc') as DocField | null;
  const wantRedirect = url.searchParams.get('redirect') === '1';

  if (!targetUserId || !doc || !DOC_COLUMN[doc]) {
    return NextResponse.json({ error: 'Paramèt manke.' }, { status: 400 });
  }

  const isOwner = user.id === targetUserId;
  const isReviewer = await canViewKycDocuments(user.email);

  if (!isOwner && !isReviewer) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('kyc_front, kyc_back, kyc_selfie')
    .eq('id', targetUserId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Itilizatè pa jwenn.' }, { status: 404 });
  }

  const stored = profile[DOC_COLUMN[doc]] as string | null;
  if (!stored) {
    return NextResponse.json({ error: 'Dokiman pa egziste.' }, { status: 404 });
  }

  const respond = (target: string, meta: Record<string, unknown> = {}) => {
    if (wantRedirect) {
      try {
        const parsed = new URL(target);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return NextResponse.json({ error: 'Lyèn pa valab.' }, { status: 400 });
        }
        return NextResponse.redirect(parsed.toString(), 302);
      } catch {
        return NextResponse.json({ error: 'Lyèn pa valab.' }, { status: 400 });
      }
    }
    return NextResponse.json({ url: target, ...meta });
  };

  if (!isKycStoragePath(stored)) {
    return respond(stored, { legacy: true });
  }

  const { data, error } = await admin.storage
    .from(KYC_BUCKET)
    .createSignedUrl(stored, SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Pa t kapab jenere lyen sekirite.' }, { status: 500 });
  }

  return respond(data.signedUrl, { expires_in: SIGNED_URL_TTL_SEC });
}
