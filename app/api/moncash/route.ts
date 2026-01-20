import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { amount, userId } = await req.json();

    const clientID = process.env.MONCASH_CLIENT_ID;
    const secretKey = process.env.MONCASH_SECRET_KEY;
    const mode = process.env.NEXT_PUBLIC_MONCASH_MODE || 'sandbox';

    if (!clientID || !secretKey) {
      return NextResponse.json({ error: "Kle API yo manke sou Vercel" }, { status: 500 });
    }

    const url = mode === 'live' 
      ? 'https://moncashbutton.digicelgroup.com/Moncash-middleware' 
      : 'https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware';

    // 1. Jwenn Token nan men MonCash
    const authRes = await fetch(`${url}/v1/CreateToken`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(clientID + ':' + secretKey).toString('base64')
      }
    });

    const authData = await authRes.json();
    const token = authData.access_token;

    if (!token) {
      return NextResponse.json({ error: "MonCash refize koneksyon an. Verifye kle yo." }, { status: 401 });
    }

    // 2. Kreye Peman an
    const orderId = Date.now().toString();
    const paymentRes = await fetch(`${url}/v1/CreatePayment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        orderId: orderId,
        custom: userId // n ap voye ID itilizatè a isit la
      })
    });

    const paymentData = await paymentRes.json();
    
    // Lyen redireksyon an
    const redirectUrl = mode === 'live'
      ? `https://moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentData.payment_token.token}`
      : `https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentData.payment_token.token}`;

    return NextResponse.json({ url: redirectUrl });

  } catch (error: any) {
    console.error("Erè API MonCash:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}