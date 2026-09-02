import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import {
  resolveInvoiceIdByRef,
  toPublicInvoiceView,
  fetchInvoiceById,
} from '@/lib/invoices/ref';

export const dynamic = 'force-dynamic';

/**
 * Resi fakti (paj /checkout-invoice/success?id=...).
 *
 * Fetched nan navigatè kliyan an — nou retounen sèlman enfòmasyon ki
 * sanble sou yon resi (montan, deskripsyon, estati, non machann).
 * Id DB / owner_id pa janm ekspoze; `id` a ka yon share_token oswa uuid legacy.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, message: 'Referans fakti manke.' }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const invoiceId = await resolveInvoiceIdByRef(admin, id);
    if (!invoiceId) {
      return NextResponse.json({ ok: false, message: 'Fakti pa jwenn.' }, { status: 404 });
    }

    const rawInv = await fetchInvoiceById(admin, invoiceId, [
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
      return NextResponse.json({ ok: false, message: 'Fakti pa jwenn.' }, { status: 404 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('business_name, full_name')
      .eq('id', invoice.owner_id)
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      invoice: toPublicInvoiceView(invoice),
      merchant: {
        name: profile?.business_name || profile?.full_name || 'Machann',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
