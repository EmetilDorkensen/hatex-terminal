import { NextResponse } from 'next/server';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { settleMonCashPayment } from '@/lib/moncash/settle';

export const dynamic = 'force-dynamic';

/**
 * Verifye peman yon fakti dirèkteman sou MonCash (bouton "Verifye peman").
 *
 * Sa regle ka kote lajan an soti sou kont kliyan an men fakti a rete "an atant"
 * (Alert URL pa rive, oswa yon konfimasyon anvan te echwe an mitan wout la).
 * Nou pa janm fè konfyans moun k ap mande a: n ap rele MonCash tèt li pou
 * konfime peman an anvan n make fakti a peye.
 *
 * Se sèlman pwopriyetè fakti a (sesyon) ki ka rele wout sa a.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`invoice-resync:${ip}`, 12, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, message: 'Twòp demann. Eseye ankò.' },
      { status: 429 }
    );
  }

  try {
    const srv = await createSupabaseServerClient();
    const {
      data: { user },
    } = await srv.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, message: 'Ou dwe konekte.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, message: 'ID fakti manke.' },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();
    const { data: inv } = await admin
      .from('invoices')
      .select('id, status, payment_id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!inv) {
      return NextResponse.json(
        { ok: false, message: 'Fakti sa a pa jwenn pou kont ou.' },
        { status: 404 }
      );
    }

    if (inv.status === 'paid') {
      return NextResponse.json({
        ok: true,
        invoice_status: 'paid',
        checked: 0,
        settled: 0,
        results: [],
      });
    }

    // Tout tantativ fakti sa a (pending, ekspire, osinon deja paid) — yon
    // re-apèl "paid" re-lance settleInvoiceAfterMonCash san double-peman.
    const { data: attempts } = await admin
      .from('hatex_payments')
      .select(
        'id, status, purpose, gateway_order_id, moncash_transaction_id, merchant_id, metadata'
      )
      .eq('merchant_id', user.id)
      .eq('purpose', 'invoice')
      .in('status', ['pending', 'paid', 'expired', 'failed'])
      .filter('metadata->>invoice_id', 'eq', id)
      .order('created_at', { ascending: false })
      .limit(20);

    const candidates =
      attempts && attempts.length
        ? attempts
        : inv.payment_id
          ? [{ id: inv.payment_id, gateway_order_id: null, moncash_transaction_id: null }]
          : [];

    const results: Array<{
      payment_id: string;
      status: string;
      message?: string;
    }> = [];
    let settled = 0;

    for (const row of candidates as Array<{
      id: string;
      status?: string;
      gateway_order_id: string | null;
      moncash_transaction_id: string | null;
    }>) {
      if (settled > 0) break; // Fakti a fin regle — sispann.
      try {
        const gatewayOrderId = row.gateway_order_id || undefined;
        const transactionId = row.moncash_transaction_id || undefined;
        if (!gatewayOrderId && !transactionId) continue;
        const result = await settleMonCashPayment(
          admin,
          (gatewayOrderId
            ? { gatewayOrderId, transactionId }
            : { transactionId: transactionId as string }) as Parameters<
            typeof settleMonCashPayment
          >[1]
        );
        if (result.ok) settled += 1;
        results.push({
          payment_id: row.id,
          status: result.ok
            ? result.alreadySettled
              ? 'paid'
              : 'settled'
            : 'pending',
          ...(result.ok ? {} : { message: String(result.message).slice(0, 200) }),
        });
      } catch (err) {
        results.push({
          payment_id: row.id,
          status: 'error',
          message: err instanceof Error ? err.message.slice(0, 200) : 'Erè sèvè.',
        });
      }
    }

    // Reli estati fakti a apre tantativ yo.
    const { data: fresh } = await admin
      .from('invoices')
      .select('status')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();

    const invoiceStatus =
      fresh?.status === 'paid'
        ? 'paid'
        : results.some((r) => r.status === 'settled' || r.status === 'paid')
          ? 'paid'
          : 'pending';

    if (invoiceStatus !== 'paid' && inv.status === 'pending') {
      console.warn(
        `[invoice/resync] ${id} rete pending apre verifyasyon (${results.length} tantativ).`
      );
    }

    return NextResponse.json({
      ok: true,
      invoice_status: invoiceStatus,
      checked: results.length,
      settled,
      results,
    });
  } catch (err) {
    console.error('[invoice/resync] erè:', err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Erè sèvè.' },
      { status: 500 }
    );
  }
}
