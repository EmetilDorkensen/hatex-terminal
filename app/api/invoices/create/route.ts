import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { checkSpendingLimit } from '@/lib/security/spending-limits';
import { CANONICAL_SITE_URL, invoicePublicUrl } from '@/lib/urls/public';

/**
 * Kreye fakti — KYC + limit jounalye verifye sou sèvè.
 * owner_id = sesyon (pa janm soti nan body).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`invoice-create:${ip}`, 30, 300);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp demann. Eseye nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const currency = body.currency === 'USD' ? 'USD' : 'HTG';
  const clientEmail =
    typeof body.client_email === 'string' ? body.client_email.trim().toLowerCase() : '';
  const description =
    typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
  const payoutAccountId = typeof body.payout_account_id === 'string' ? body.payout_account_id : '';

  if (!(amount > 0) || !Number.isFinite(amount)) {
    return NextResponse.json({ success: false, message: 'Montan pa valab.' }, { status: 400 });
  }
  if (!clientEmail.includes('@')) {
    return NextResponse.json({ success: false, message: 'Imèl kliyan pa valab.' }, { status: 400 });
  }
  if (!payoutAccountId) {
    return NextResponse.json(
      { success: false, message: 'Chwazi yon kont pou resevwa lajan an.' },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const userId = auth.user.id;

  const { data: profile } = await admin
    .from('profiles')
    .select('id, kyc_status, account_type, plan')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || profile.kyc_status !== 'approved') {
    return NextResponse.json(
      { success: false, message: 'Ou dwe konplete KYC ou (apwouve) anvan ou voye fakti.' },
      { status: 403 }
    );
  }

  const { data: account } = await admin
    .from('hatex_bank_accounts')
    .select('id, user_id')
    .eq('id', payoutAccountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!account) {
    return NextResponse.json(
      { success: false, message: 'Kont peman pa jwenn oswa pa pou ou.' },
      { status: 400 }
    );
  }

  const limitAmount = currency === 'USD' ? amount * 132 : amount;
  const limitCheck = await checkSpendingLimit(
    admin,
    userId,
    profile.account_type,
    limitAmount,
    'invoice'
  );
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { success: false, message: limitCheck.message || 'Ou depase limit jounalye fakti a.' },
      { status: 403 }
    );
  }

  const { data: inv, error: invErr } = await admin
    .from('invoices')
    .insert({
      owner_id: userId,
      amount,
      currency,
      payout_account_id: payoutAccountId,
      client_email: clientEmail,
      description: description || null,
      status: 'pending',
    })
    .select()
    .single();

  if (invErr || !inv) {
    return NextResponse.json(
      { success: false, message: invErr?.message || 'Kreyasyon fakti echwe.' },
      { status: 400 }
    );
  }

  const payLink = invoicePublicUrl(CANONICAL_SITE_URL, {
    id: inv.id,
    share_token: inv.share_token || null,
  });

  return NextResponse.json({ success: true, invoice: inv, pay_link: payLink });
}

/** Anile fakti — sèlman pwopriyetè + estati pending. */
export async function PATCH(request: Request) {
  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const invoiceId = typeof body.invoice_id === 'string' ? body.invoice_id : '';
  const action = String(body.action || '');

  if (!invoiceId || action !== 'cancel') {
    return NextResponse.json({ success: false, message: 'Demann pa valab.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: inv } = await admin
    .from('invoices')
    .select('id, owner_id, status')
    .eq('id', invoiceId)
    .eq('owner_id', auth.user.id)
    .maybeSingle();

  if (!inv) {
    return NextResponse.json({ success: false, message: 'Fakti pa jwenn.' }, { status: 404 });
  }
  if (inv.status !== 'pending') {
    return NextResponse.json(
      { success: false, message: 'Ou ka anile sèlman fakti ki poko peye.' },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from('invoices')
    .update({ status: 'cancelled' })
    .eq('id', invoiceId)
    .eq('owner_id', auth.user.id);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
