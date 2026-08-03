import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { canAccessTerminal } from '@/lib/security/merchant-provisioning';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`reservation-upload:${ip}`, 40, 600);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp upload. Eseye pita.' }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, kyc_status, is_card_activated, features_unlock_paid')
    .eq('id', user.id)
    .maybeSingle();

  if (!canAccessTerminal(profile)) {
    return NextResponse.json(
      { success: false, message: 'Ou bezwen KYC + opsyon debloke pou ajoute foto.' },
      { status: 403 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'Fichye manke.' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ success: false, message: 'Fòma foto: jpeg, png oswa webp.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, message: 'Foto twò gwo (max 5MB).' }, { status: 400 });
  }

  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage.from('reservation-media').upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ success: false, message: error.message || 'Upload echwe.' }, { status: 400 });
  }

  const { data: pub } = admin.storage.from('reservation-media').getPublicUrl(path);
  return NextResponse.json({ success: true, url: pub.publicUrl, path });
}
