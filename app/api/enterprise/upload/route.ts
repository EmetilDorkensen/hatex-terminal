import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';

const ALLOWED_TYPES = new Set([
  'patente',
  'cif',
  'business_registration',
  'bank_statement',
  'lease_doc',
  'legal_rep_id',
]);

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Ou dwe konekte pou telechaje dokiman.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const docType = String(formData.get('type') || '').trim();

    if (!(file instanceof File) || !docType) {
      return NextResponse.json({ error: 'Fichye oswa tip dokiman manke.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(docType)) {
      return NextResponse.json({ error: 'Tip dokiman pa valid.' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Fichye a twò gwo. Maksimòm 10 Mo.' }, { status: 400 });
    }

    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json({ error: 'Kalite fichye pa aksepte. Itilize JPG, PNG, WEBP oswa PDF.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext) ? ext : 'pdf';
    const fileName = `${user.id}/${docType}_${Date.now()}.${safeExt}`;

    const admin = createSupabaseAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from('enterprise_documents')
      .upload(fileName, buffer, {
        contentType: mime,
        upsert: false,
      });

    if (uploadError) {
      const msg = uploadError.message || '';
      if (msg.toLowerCase().includes('bucket')) {
        return NextResponse.json({
          error: "Bucket 'enterprise_documents' pa egziste nan Supabase. Admin dwe kouri migrasyon SQL 20260708_enterprise_documents_bucket.sql nan SQL Editor.",
        }, { status: 500 });
      }
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from('enterprise_documents').getPublicUrl(fileName);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erè upload dokiman.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
