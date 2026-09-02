import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/kyc/access';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

type Kind = 'moncash' | 'natcash' | 'bank' | 'bank_us';

function normalizeHaitiPhone(raw: unknown): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 8) return `509${digits}`;
  if (digits.length === 11 && digits.startsWith('509')) return digits;
  return null;
}

async function ensureKycMoncashSeed(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data: existing } = await admin
    .from('hatex_bank_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'moncash')
    .maybeSingle();
  if (existing) return;

  const { data: kyc } = await admin
    .from('hatex_kyc_applications')
    .select('payout_provider, payout_phone')
    .eq('user_id', userId)
    .in('status', ['approved', 'in_review', 'submitted'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!kyc?.payout_phone) return;

  await admin.from('hatex_bank_accounts').insert({
    user_id: userId,
    kind: 'moncash',
    label: 'Nimewo KYC',
    phone: String(kyc.payout_phone),
    is_default: true,
    is_verified: true,
  });
}

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  await ensureKycMoncashSeed(admin, user.id);

  const { data, error } = await admin
    .from('hatex_bank_accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: { code: 'db_error', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ accounts: data || [] });
}

export async function POST(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const limit = await rateLimit(`bank-acc:${user.id}:${getClientIp(request)}`, 20, 600);
  if (!limit.allowed) {
    return NextResponse.json({ error: { code: 'rate_limited' } }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: { code: 'bad_request' } }, { status: 400 });
  }

  const kind = String(body.kind || '') as Kind;
  if (kind === 'natcash') {
    return NextResponse.json(
      {
        error: {
          code: 'natcash_unavailable',
          message: 'NatCash pa disponib pou kounya a. Itilize MonCash.',
        },
      },
      { status: 400 }
    );
  }
  if (kind === 'bank_us') {
    // Bank USA fèmen pou kounya a — pa gen koneksyon Stripe Connect ki konfime.
    return NextResponse.json(
      {
        error: {
          code: 'bank_us_unavailable',
          message: 'Bank USA pa disponib pou kounya a. Itilize MonCash oswa Bank Ayiti.',
        },
      },
      { status: 400 }
    );
  }
  if (!['moncash', 'bank'].includes(kind)) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_kind',
          message: 'Chwazi MonCash oswa Bank Ayiti.',
        },
      },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  const row: Record<string, unknown> = {
    user_id: user.id,
    kind,
    label: String(body.label || '').slice(0, 80),
    is_default: body.is_default === true,
  };

  if (kind === 'moncash') {
    const phone = normalizeHaitiPhone(body.phone);
    if (!phone) {
      return NextResponse.json(
        { error: { code: 'invalid_phone', message: 'Nimewo pa valab (egzanp: 3720 1241).' } },
        { status: 400 }
      );
    }
    row.phone = phone;
  } else {
    const accountName = String(body.account_name || '').trim();
    const accountNumber = String(body.account_number || '').trim();
    const bankName = String(body.bank_name || '').trim();
    if (!accountName || !accountNumber || !bankName) {
      return NextResponse.json(
        {
          error: {
            code: 'missing_fields',
            message: 'Bay non bank la, non kont la ak nimewo kont la.',
          },
        },
        { status: 400 }
      );
    }
    row.account_name = accountName.slice(0, 120);
    row.bank_name = bankName.slice(0, 80);
    row.swift_code = String(body.swift_code || '').trim().slice(0, 20) || null;
    row.branch = String(body.branch || '').trim().slice(0, 80) || null;
    if (String(kind) === 'bank_us') {
      // Stripe Connect bezwen routing (9 chif) + account separe.
      // Ansyen fòma "RRRRRRRRR + account" nan yon sèl jaden toujou sipòte.
      // Not: bank_us bloke pi wo a (bank_us_unavailable), branch sa a se kòd ansyen.
      const rawRouting = String(body.routing_number || '').replace(/\D/g, '');
      const rawAccount = String(accountNumber).replace(/\D/g, '');
      let routingNumber = rawRouting;
      let accountDigits = rawAccount;
      if (!routingNumber && accountDigits.length >= 9) {
        routingNumber = accountDigits.slice(0, 9);
        accountDigits = accountDigits.slice(9);
      }
      if (routingNumber.length !== 9) {
        return NextResponse.json(
          {
            error: {
              code: 'invalid_routing',
              message: 'Routing number USA dwe gen egzakteman 9 chif.',
            },
          },
          { status: 400 }
        );
      }
      if (accountDigits.length < 4) {
        return NextResponse.json(
          {
            error: {
              code: 'invalid_account',
              message: 'Nimewo kont bank la pa valab (mwens pase 4 chif).',
            },
          },
          { status: 400 }
        );
      }
      row.routing_number = routingNumber;
      row.account_number = accountDigits;
      if (!row.label) row.label = `${bankName} (USA)`;
    } else {
      row.account_number = accountNumber.slice(0, 40);
    }
  }

  if (row.is_default) {
    await admin
      .from('hatex_bank_accounts')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('kind', kind);
  }

  const { data, error } = await admin
    .from('hatex_bank_accounts')
    .insert(row)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: { code: 'db_error', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ account: data });
}

export async function DELETE(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: { code: 'unauthenticated' } }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: { code: 'missing_id' } }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('hatex_bank_accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: { code: 'db_error', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
