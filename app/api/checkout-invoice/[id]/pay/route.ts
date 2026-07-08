import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { findProfileByCard } from '@/lib/security/card-lookup';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { hashCardNumber } from '@/lib/security/hash';

const MAX_CARD_ATTEMPTS = 6;
const CARD_LOCK_WINDOW_SEC = 15 * 60;

/** Peman fakti terminal — verifye kat sou sèvè, kredi machann atomik. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: invoiceId } = await params;
  const ip = getClientIp(request);
  const rl = await rateLimit(`checkout-invoice:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp tantativ. Eseye pita.' }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const cleanCard = String(body.card_number || '').replace(/\D/g, '');
    const cvv = String(body.card_cvv || body.cvv || '');
    const rawExp = String(body.card_expiry || body.expiry || '').replace(/\D/g, '');
    const slashedExp = rawExp.length === 4 ? `${rawExp.slice(0, 2)}/${rawExp.slice(2)}` : String(body.card_expiry || body.expiry || '');

    if (cleanCard.length < 16 || cvv.length < 3) {
      return NextResponse.json({ success: false, message: 'Enfòmasyon kat la pa konplè.' }, { status: 400 });
    }

    const cardHash = hashCardNumber(cleanCard);
    const cardRl = await rateLimit(`card-verify:${cardHash}`, MAX_CARD_ATTEMPTS, CARD_LOCK_WINDOW_SEC);
    if (!cardRl.allowed) {
      const mins = Math.ceil((cardRl.retryAfterSec || CARD_LOCK_WINDOW_SEC) / 60);
      return NextResponse.json(
        { success: false, message: `Twòp tantativ sou kat sa a. Eseye ankò nan ${mins} minit.` },
        { status: 429 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: invoice } = await supabase
      .from('invoices')
      .select('id, status, owner_id')
      .eq('id', invoiceId)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Fakti pa jwenn.' }, { status: 404 });
    }
    if (invoice.status === 'paid') {
      return NextResponse.json({ success: false, message: 'Fakti sa a te deja peye.' }, { status: 410 });
    }

    const { profile, error: cardErr } = await findProfileByCard(supabase, cleanCard, cvv, rawExp, slashedExp);
    if (!profile) {
      return NextResponse.json({ success: false, message: cardErr || 'Kat sa a pa rekonèt.' }, { status: 401 });
    }
    if (profile.id === invoice.owner_id) {
      return NextResponse.json({ success: false, message: 'Ou pa ka peye pwòp fakti ou.' }, { status: 403 });
    }

    const { data: result, error } = await supabase.rpc('process_invoice_card_payment', {
      p_invoice_id: invoiceId,
      p_client_id: profile.id,
    });

    if (error) {
      return NextResponse.json({ success: false, message: 'Peman an pa t reyisi.' }, { status: 400 });
    }

    const res = result as { success?: boolean; message?: string } | null;
    if (!res?.success) {
      return NextResponse.json({ success: false, message: res?.message || 'Peman an echwe.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: res.message || 'Peman an reyisi!' });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
