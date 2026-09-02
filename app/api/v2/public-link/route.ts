import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { decryptPublicId, encryptPublicId } from '@/lib/security/public-token';

export const dynamic = 'force-dynamic';

/** Dekripte yon token piblik (subscribe, pataje, elatriye). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: { code: 'missing_token' } }, { status: 400 });
  }

  const id = decryptPublicId(token);
  if (!id) {
    return NextResponse.json({ error: { code: 'invalid_token' } }, { status: 400 });
  }

  return NextResponse.json({ id, token });
}

/** Kripte yon ID pou lyen piblik — sèlman itilizatè konekte. */
export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = String(body?.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: { code: 'missing_id' } }, { status: 400 });
  }

  try {
    const token = encryptPublicId(id);
    return NextResponse.json({ id, token });
  } catch {
    return NextResponse.json({ error: { code: 'encrypt_failed' } }, { status: 400 });
  }
}
