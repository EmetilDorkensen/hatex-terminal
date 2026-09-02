import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { canViewKycDocuments, getAuthenticatedUser } from '@/lib/kyc/access';
import { isKycStoragePath } from '@/lib/kyc/faceplusplus';
import { KYC_V2_BUCKET } from '@/lib/kyc-v2/documents';

const KYC_V1_BUCKET = 'kyc-documents';
const SIGNED_URL_TTL_SEC = 300;

type DocField =
  | 'front'
  | 'back'
  | 'selfie'
  | 'business'
  | 'nif'
  | 'tax'
  | 'establishment'
  | 'address'
  | 'articles';

const V1_COLUMN: Record<'front' | 'back' | 'selfie', 'kyc_front' | 'kyc_back' | 'kyc_selfie'> = {
  front: 'kyc_front',
  back: 'kyc_back',
  selfie: 'kyc_selfie',
};

const V2_COLUMN: Record<DocField, string> = {
  front: 'id_front_path',
  back: 'id_back_path',
  selfie: 'selfie_path',
  business: 'business_registration_path',
  nif: 'business_nif_doc_path',
  tax: 'tax_clearance_path',
  establishment: 'establishment_photo_path',
  address: 'proof_of_address_path',
  articles: 'articles_path',
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

  if (!targetUserId || !doc || !V2_COLUMN[doc]) {
    return NextResponse.json({ error: 'Paramèt manke.' }, { status: 400 });
  }

  const isOwner = user.id === targetUserId;
  const isReviewer = await canViewKycDocuments(user.email);

  if (!isOwner && !isReviewer) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();

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

  // KYC v2 an premye
  const { data: app } = await admin
    .from('hatex_kyc_applications')
    .select(
      'id_front_path, id_back_path, selfie_path, business_registration_path, tax_clearance_path, establishment_photo_path, proof_of_address_path, articles_path, business_nif_doc_path, status'
    )
    .eq('user_id', targetUserId)
    .in('status', ['submitted', 'in_review', 'approved', 'rejected', 'draft'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const v2Path = app ? ((app as Record<string, unknown>)[V2_COLUMN[doc]] as string | null) : null;
  if (v2Path) {
    const { data, error } = await admin.storage
      .from(KYC_V2_BUCKET)
      .createSignedUrl(v2Path, SIGNED_URL_TTL_SEC);
    if (!error && data?.signedUrl) {
      return respond(data.signedUrl, { expires_in: SIGNED_URL_TTL_SEC, bucket: KYC_V2_BUCKET });
    }
  }

  // Fallback KYC v1 (profiles)
  if (doc !== 'front' && doc !== 'back' && doc !== 'selfie') {
    return NextResponse.json({ error: 'Dokiman pa egziste.' }, { status: 404 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('kyc_front, kyc_back, kyc_selfie')
    .eq('id', targetUserId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Itilizatè pa jwenn.' }, { status: 404 });
  }

  const stored = profile[V1_COLUMN[doc]] as string | null;
  if (!stored) {
    return NextResponse.json({ error: 'Dokiman pa egziste.' }, { status: 404 });
  }

  if (!isKycStoragePath(stored)) {
    return respond(stored, { legacy: true });
  }

  const { data, error } = await admin.storage
    .from(KYC_V1_BUCKET)
    .createSignedUrl(stored, SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Pa t kapab jenere lyen sekirite.' }, { status: 500 });
  }

  return respond(data.signedUrl, { expires_in: SIGNED_URL_TTL_SEC, bucket: KYC_V1_BUCKET });
}
