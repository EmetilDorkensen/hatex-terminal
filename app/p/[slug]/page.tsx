import type { Metadata } from 'next';
import { AlertTriangle } from 'lucide-react';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { quoteProductMonCash } from '@/lib/products/pay';
import { PublicCheckout } from '@/components/products/PublicCheckout';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Achte sou HatexCard`, description: 'Paj peman HatexCard.' };
}

export default async function PublicProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const ref = String(slug || '').trim();
  const sp = await searchParams;
  const status = sp.status === 'success' ? 'success' : sp.status === 'cancel' ? 'cancel' : null;

  const admin = createSupabaseAdminClient();

  // Ref piblik la ka se: slug, share_token opak (32 hex), osinon yon id UUID legacy.
  type ProductRow = {
    id: string;
    name: string;
    slug: string;
    share_token: string | null;
    description: string | null;
    image_url: string | null;
    price_htg: number;
    active: boolean;
    owner_id: string;
  };
  const BASE_COLS = ['id', 'name', 'slug', 'description', 'image_url', 'price_htg', 'active', 'owner_id'];
  let product: ProductRow | null = null;

  if (ref) {
    let hasShareCol = true;
    const search = async (column: 'slug' | 'id' | 'share_token', value: string) => {
      const cols = hasShareCol ? [...BASE_COLS, 'share_token'].join(', ') : BASE_COLS.join(', ');
      const { data, error } = await admin
        .from('hatex_products')
        .select(cols)
        .eq(column, value)
        .maybeSingle();
      if (error && (error as { code?: string })?.code === 'PGRST204') {
        hasShareCol = false;
        const legacy = await admin
          .from('hatex_products')
          .select(BASE_COLS.join(', '))
          .eq(column, value)
          .maybeSingle();
        return legacy.data ? (legacy.data as unknown as ProductRow) : null;
      }
      return data ? (data as unknown as ProductRow) : null;
    };

    product = await search('slug', ref);
    if (!product && /^[0-9a-f]{32}$/i.test(ref) && hasShareCol) {
      product = await search('share_token', ref);
    }
    if (!product && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
      product = await search('id', ref);
    }
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col items-center justify-center px-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-sm w-full text-center shadow-sm">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={40} />
          <h1 className="text-lg font-black">Lyen sa a pa valab</h1>
          <p className="text-sm text-slate-500 mt-2">
            Pwodwi sa a pa egziste. Mande machann lan yon nouvo lyen.
          </p>
        </div>
      </div>
    );
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('business_name, full_name, avatar_url')
    .eq('id', product.owner_id)
    .maybeSingle();

  const merchantName = profile?.business_name || profile?.full_name || 'Machann';

  if (!product.active) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col items-center justify-center px-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-sm w-full text-center shadow-sm">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={40} />
          <h1 className="text-lg font-black">Pwodwi endisponib</h1>
          <p className="text-sm text-slate-500 mt-2">
            «{product.name}» pa disponib kounye a. Kontakte {merchantName} pou plis enfòmasyon.
          </p>
        </div>
      </div>
    );
  }

  const q = await quoteProductMonCash(admin, product.id);
  const quote = q.ok
    ? {
        priceHtg: q.quote.priceHtg,
        platformFee: q.quote.platformFee,
        payoutFee: q.quote.payoutFee,
        clientTotal: q.quote.clientTotal,
        receiveBlocked: q.quote.receiveBlocked,
        receiveMessage: q.quote.receiveMessage,
      }
    : null;

  return (
    <PublicCheckout
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        ref: product.share_token || product.slug,
        description: product.description,
        image_url: product.image_url,
        price_htg: Number(product.price_htg),
      }}
      merchant={{ name: merchantName, avatar_url: profile?.avatar_url || null }}
      quote={quote}
      status={status}
    />
  );
}
