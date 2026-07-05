import { NextResponse } from 'next/server';

// ============================================================================
// WOUT DEZAKTIVE — ranplase pa /api/developer/webhooks/process-retries
// ============================================================================
// Ansyen wout sa a te itilize yon tab `webhook_failures` ki pa t konekte ak
// sistèm peman an. Re-eseye otomatik kounye a fèt via cron sou
// /api/developer/webhooks/process-retries (tab `developer_webhook_deliveries`).
// ============================================================================

export async function GET() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive. Re-eseye webhook yo jere otomatikman pa nouvo sistèm nan.' },
    { status: 410 }
  );
}
