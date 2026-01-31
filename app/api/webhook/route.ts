import { createBrowserClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const { transaction_id, status, amount, terminal_id } = body;

  // URL sit kote ou vle resevwa konfimasyon an
  const YOUR_SITE_CALLBACK = "https://sit-ou-a.com/api/payment-confirm";

  try {
    const response = await fetch(YOUR_SITE_CALLBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: transaction_id,
        status: status,
        amount: amount,
        terminal: terminal_id,
        verified: true
      }),
    });

    return NextResponse.json({ sent: true, status: response.status });
  } catch (error) {
    return NextResponse.json({ error: "Paka kontakte sit ou a" }, { status: 500 });
  }
}