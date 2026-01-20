import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { amount, userId } = await req.json();
    const clientID = process.env.MONCASH_CLIENT_ID;
    const secretKey = process.env.MONCASH_SECRET_KEY;
    const mode = process.env.NEXT_PUBLIC_MONCASH_MODE || 'sandbox';

    const baseUrl = mode === 'live' 
      ? 'https://moncashbutton.digicelgroup.com/Moncash-middleware' 
      : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware';

    // 1. Jwenn Token
    const authRes = await fetch(`${baseUrl}/v1/CreateToken`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(clientID + ':' + secretKey).toString('base64')
      }
    });
    const authData = await authRes.json();
    
    if (!authData.access_token) {
      return NextResponse.json({ error: "MonCash refize koneksyon (401)." }, { status: 401 });
    }

    // 2. Kreye Peman
    const paymentRes = await fetch(`${baseUrl}/v1/CreatePayment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        orderId: Date.now().toString(),
        custom: userId 
      })
    });
    const paymentData = await paymentRes.json();

    const redirectUrl = mode === 'live'
      ? `https://moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentData.payment_token.token}`
      : `https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentData.payment_token.token}`;

    return NextResponse.json({ url: redirectUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}