import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { requireMoneySession } from '@/lib/security/require-money-session';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueSlug(base: string, existing: string[]): string {
  const root = base || 'pwodwi';
  const taken = new Set(existing);
  if (!taken.has(root)) return root;
  let i = 2;
  while (taken.has(`${root}-${i}`)) i += 1;
  return `${root}-${i}`;
}

/**
 * Kreye pwodwi — KYC obligatwa sou sèvè. owner_id = sesyon.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`product-create:${ip}`, 20, 300);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, message: `Twòp demann. Eseye nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const auth = await requireMoneySession();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const price = Number(body.price);
  const description =
    typeof body.description === 'string' ? body.description.trim().slice(0, 2000) : '';
  const payoutAccountId = typeof body.payout_account_id === 'string' ? body.payout_account_id : '';
  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';

  if (!name || name.length > 120) {
    return NextResponse.json(
      { success: false, message: 'Non pwodwi obligatwa (max 120).' },
      { status: 400 }
    );
  }
  if (!(price >= 10) || !Number.isFinite(price)) {
    return NextResponse.json(
      { success: false, message: 'Pri a dwe omwen 10 HTG.' },
      { status: 400 }
    );
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
    .select('id, kyc_status')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || profile.kyc_status !== 'approved') {
    return NextResponse.json(
      { success: false, message: 'KYC apwouve obligatwa pou kreye pwodwi.' },
      { status: 403 }
    );
  }

  const { data: account } = await admin
    .from('hatex_bank_accounts')
    .select('id')
    .eq('id', payoutAccountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!account) {
    return NextResponse.json(
      { success: false, message: 'Kont peman pa jwenn oswa pa pou ou.' },
      { status: 400 }
    );
  }

  const { data: existing } = await admin
    .from('hatex_products')
    .select('slug')
    .eq('owner_id', userId);
  const slug = uniqueSlug(
    slugify(name),
    (existing || []).map((x: { slug: string }) => x.slug)
  );

  const { data: product, error } = await admin
    .from('hatex_products')
    .insert({
      owner_id: userId,
      slug,
      name,
      description: description || null,
      price_htg: Math.round(price * 100) / 100,
      payout_account_id: payoutAccountId,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    })
    .select()
    .single();

  if (error || !product) {
    return NextResponse.json(
      { success: false, message: error?.message || 'Kreyasyon pwodwi echwe.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, product });
}
