import { NextResponse } from 'next/server';

/** Route legacy — pa itilize. Itilize /api/cron/abonnman ak Bearer CRON_SECRET. */
export async function GET() {
  return NextResponse.json(
    { error: 'Route sa a pa aktif ankò. Itilize /api/cron/abonnman.' },
    { status: 410 }
  );
}
