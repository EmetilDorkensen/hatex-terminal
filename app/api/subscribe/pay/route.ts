import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { hashCardNumber } from '@/lib/security/hash';

// Peman abònman ak kat — TOUT verifikasyon ak mouvman balans fèt sou sèvè a.
// Navigatè a pa janm resevwa balans/PII kliyan an ankò, ni li pa modifye okenn
// balans dirèkteman (gade migrasyon 20260732_subscription_card_payment.sql).
const MAX_CARD_ATTEMPTS = 6;
const CARD_LOCK_WINDOW_SEC = 15 * 60;

function maskName(fullName: string | null | undefined): string {
  const parts = (fullName || '').trim().split(/\s+/);
  const first = parts[0] ? parts[0].substring(0, 3).toUpperCase() : 'KLI';
  const last = parts.length > 1 ? parts[parts.length - 1].substring(0, 3).toUpperCase() : 'YAN';
  return `${first}... ${last}...`;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`subscribe-pay:${ip}`, 15, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Twòp tantativ. Eseye pita.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const productId = String(body.productId || '');
    const cleanCard = String(body.cardNumber || '').replace(/\D/g, '');
    const cvv = String(body.cvv || '');
    const rawExp = String(body.expiry || '').replace(/\D/g, '');
    const slashedExp = rawExp.length === 4 ? `${rawExp.slice(0, 2)}/${rawExp.slice(2)}` : String(body.expiry || '');

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Sèvis la pa idantifye.' }, { status: 400 });
    }
    if (cleanCard.length !== 16 || cvv.length < 3) {
      return NextResponse.json({ success: false, error: 'Enfòmasyon kat la pa konplè.' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Lock-out pa kat (kont brute-force nimewo kat)
    const cardHash = hashCardNumber(cleanCard);
    const cardRl = await rateLimit(`card-verify:${cardHash}`, MAX_CARD_ATTEMPTS, CARD_LOCK_WINDOW_SEC);
    if (!cardRl.allowed) {
      const mins = Math.ceil((cardRl.retryAfterSec || CARD_LOCK_WINDOW_SEC) / 60);
      return NextResponse.json({ success: false, error: `Twòp tantativ sou kat sa a. Eseye ankò nan ${mins} minit.` }, { status: 429 });
    }

    // 1. Chaje pwodwi + machann (sèvè a — pri a soti nan baz done, pa kliyan)
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, title, price, merchant_id, profiles:merchant_id(id, business_name)')
      .eq('id', productId)
      .single();

    if (pErr || !product) {
      return NextResponse.json({ success: false, error: 'Sèvis sa a pa disponib.' }, { status: 404 });
    }

    const merchantId = (product as { merchant_id?: string }).merchant_id
      || (product as { profiles?: { id?: string } }).profiles?.id;
    const shopName = (product as { profiles?: { business_name?: string } }).profiles?.business_name || 'H-Pay Store';
    const amount = Number(product.price);

    if (!merchantId || !amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Konfigirasyon sèvis la pa valab.' }, { status: 400 });
    }

    // 2. Verifye kat la sou sèvè a (balans/PII PA janm kite sèvè a)
    const { profile, error: cardErr } = await findProfileByCard(supabase, cleanCard, cvv, rawExp, slashedExp);
    if (!profile) {
      return NextResponse.json({ success: false, error: cardErr || 'Kat sa a pa rekonèt.' }, { status: 401 });
    }

    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', profile.id)
      .single();

    if (!clientProfile) {
      return NextResponse.json({ success: false, error: 'Kat sa a pa rekonèt.' }, { status: 401 });
    }

    // 3. Peman atomik (re-verifikasyon balans/estati/plafon anndan RPC a)
    const { data: result, error: rpcErr } = await supabase.rpc('process_subscription_card_payment', {
      p_client_id: clientProfile.id,
      p_merchant_id: merchantId,
      p_amount: amount,
      p_plan_name: product.title,
      p_masked_name: maskName(clientProfile.full_name),
      p_client_email: clientProfile.email || '',
      p_shop_name: shopName,
    });

    if (rpcErr) {
      return NextResponse.json({ success: false, error: 'Peman an pa t reyisi. Eseye ankò.' }, { status: 400 });
    }

    const res = result as { success?: boolean; message?: string; reference?: string } | null;
    if (!res?.success) {
      return NextResponse.json({ success: false, error: res?.message || 'Peman an pa t reyisi.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, reference: res.reference });
  } catch {
    return NextResponse.json({ success: false, error: 'Erè sèvè.' }, { status: 500 });
  }
}
