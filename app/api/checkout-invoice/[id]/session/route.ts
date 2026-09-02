import { NextResponse } from 'next/server';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/security/supabase-server';
import { resolveInvoiceIdByRef, toPublicInvoiceView, fetchInvoiceById } from '@/lib/invoices/ref';

/**
 * Detay fakti terminal (lyen piblik) — san done sansib.
 *
 * Paramèt `id` ka se yon share_token opak oswa yon uuid legacy.
 * Nou pa janm retounen id DB / owner_id: pwopriyetè a idantifye sou sèvè
 * (cookie sesyon) epi kliyan an resevwa sèlman `is_owner`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ valid: false, message: 'Fakti pa valab.' }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const invoiceId = await resolveInvoiceIdByRef(supabase, id);
    if (!invoiceId) {
      return NextResponse.json({ valid: false, message: 'Fakti sa a pa egziste.' }, { status: 404 });
    }

    const rawInv = await fetchInvoiceById(supabase, invoiceId, [
      'id',
      'amount',
      'currency',
      'client_email',
      'description',
      'status',
      'owner_id',
      'payout_account_id',
      'created_at',
    ]);
    const invoice = rawInv as
      | (Record<string, unknown> & {
          id: string;
          share_token?: string | null;
          amount: number;
          currency: string | null;
          client_email: string | null;
          description: string | null;
          status: string;
          owner_id: string;
          payout_account_id: string | null;
          created_at?: string | null;
        })
      | null;

    if (!invoice) {
      return NextResponse.json({ valid: false, message: 'Fakti sa a pa egziste.' }, { status: 404 });
    }
    if (invoice.status === 'paid') {
      return NextResponse.json({ valid: false, message: 'Fakti sa a te deja peye.' }, { status: 410 });
    }
    if (invoice.status !== 'pending') {
      return NextResponse.json({ valid: false, message: 'Fakti sa a pa disponib.' }, { status: 410 });
    }

    // Idantifye pwopriyetè a sou sèvè (cookie sesyon) — pa janm voye owner_id.
    let isOwner = false;
    try {
      const srv = await createSupabaseServerClient();
      const {
        data: { user },
      } = await srv.auth.getUser();
      if (user && user.id === invoice.owner_id) isOwner = true;
    } catch {
      isOwner = false;
    }

    const { data: merchant } = await supabase
      .from('profiles')
      .select('business_name, full_name, avatar_url, kyc_status')
      .eq('id', invoice.owner_id)
      .single();

    const { quoteInvoiceMonCash } = await import('@/lib/invoices/moncash-pay');
    const quoted = await quoteInvoiceMonCash(supabase, invoiceId);

    return NextResponse.json({
      valid: true,
      is_owner: isOwner,
      invoice: toPublicInvoiceView(invoice),
      merchant: {
        business_name: merchant?.business_name || merchant?.full_name || 'Machann',
        full_name: merchant?.full_name,
        avatar_url: merchant?.avatar_url,
        kyc_status: merchant?.kyc_status,
      },
      quote: quoted.ok ? quoted.quote : null,
    });
  } catch {
    return NextResponse.json({ valid: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}

