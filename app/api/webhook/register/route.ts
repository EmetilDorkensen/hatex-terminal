import { NextResponse } from 'next/server';

// ============================================================================
// WOUT DEZAKTIVE — ranplase pa /api/developer/webhooks
// ============================================================================
// Ansyen wout sa a te itilize yon tab `webhooks` ki pa t konekte ak
// /api/public/payments. Nouvo sistèm milti-pwen an jere pa
// /api/developer/webhooks (estil Stripe/PayPal).
// ============================================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive. Itilize /api/developer/webhooks pou jere webhook yo.' },
    { status: 410 }
  );
}
