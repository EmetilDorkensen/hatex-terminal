import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { canAccessTerminal } from '@/lib/security/merchant-provisioning';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { whatsappDigits } from '@/lib/reservations/types';
import {
  encryptMerchantShareToken,
  isLegacyShareToken,
  decryptMerchantShareToken,
} from '@/lib/reservations/share-token';

async function ensureEncryptedShareToken(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  merchant: Record<string, unknown> | null
) {
  if (!merchant) return null;
  const current = String(merchant.share_token || '');
  const decrypted = decryptMerchantShareToken(current);
  if (decrypted === userId) return merchant;

  const share_token = encryptMerchantShareToken(userId);
  const { data } = await admin
    .from('reservation_merchants')
    .update({ share_token, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  return data || { ...merchant, share_token };
}

/** Upsert merchant reservation profile + return share link token */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('reservation_merchants')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const merchant = await ensureEncryptedShareToken(admin, user.id, data);
  return NextResponse.json({ success: true, merchant });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`reservation-merchant:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ.' }, { status: 429 });
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
    .select('id, kyc_status, is_card_activated, features_unlock_paid, email, full_name, business_name, phone, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (!canAccessTerminal(profile)) {
    return NextResponse.json(
      { success: false, message: 'Ou bezwen KYC apwouve + opsyon debloke (Terminal).' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const business_name = String(body.business_name || profile?.business_name || profile?.full_name || '').trim();
  const whatsapp = String(body.whatsapp || '').trim();
  const phone = String(body.phone || profile?.phone || whatsapp || '').trim();
  const address = String(body.address || '').trim();
  const zone = String(body.zone || '').trim();
  const email = String(body.email || profile?.email || '').trim();
  const logo_url = body.logo_url ? String(body.logo_url) : profile?.avatar_url || null;

  if (!business_name) {
    return NextResponse.json({ success: false, message: 'Non biznis obligatwa.' }, { status: 400 });
  }
  if (!whatsapp || whatsappDigits(whatsapp).length < 8) {
    return NextResponse.json({ success: false, message: 'Nimewo WhatsApp obligatwa.' }, { status: 400 });
  }

  const { data: existing } = await admin
    .from('reservation_merchants')
    .select('share_token')
    .eq('user_id', user.id)
    .maybeSingle();

  // Toujou AES-kriple — pa janm mete UUID machann nan URL an klè / base64
  const existingOk =
    existing?.share_token &&
    !isLegacyShareToken(existing.share_token) &&
    decryptMerchantShareToken(existing.share_token) === user.id;
  const share_token = existingOk
    ? String(existing!.share_token)
    : encryptMerchantShareToken(user.id);

  const { data, error } = await admin
    .from('reservation_merchants')
    .upsert(
      {
        user_id: user.id,
        business_name,
        whatsapp,
        phone,
        address: address || null,
        zone: zone || null,
        email: email || null,
        logo_url,
        share_token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, merchant: data });
}
