import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { amount, userId } = await request.json(); // Nou resevwa ID itilizatè a isit la

    // 1. Pran Token nan men MonCash
    const auth = Buffer.from(`${process.env.MONCASH_CLIENT_ID}:${process.env.MONCASH_SECRET_KEY}`).toString('base64');
    const tokenRes = await fetch('https://sandbox.moncashbutton.com/Api/oauth/token?grant_type=client_credentials', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}` }
    });
    const tokenData = await tokenRes.json();

    // 2. Kreye Peman an ak "reference" (sa enpòtan anpil!)
    const paymentRes = await fetch('https://sandbox.moncashbutton.com/Api/v1/CreatePayment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        orderId: Date.now().toString(),
        reference: userId // ISIT LA: Nou voye ID itilizatè a bay MonCash
      })
    });

    const paymentData = await paymentRes.json();
    const redirectUrl = `https://sandbox.moncashbutton.com/MonCash/Pay?token=${paymentData.payment_token.token}`;
    
    return NextResponse.json({ url: redirectUrl });

  } catch (error) {
    return NextResponse.json({ error: 'Erè koneksyon' }, { status: 500 });
  }
}