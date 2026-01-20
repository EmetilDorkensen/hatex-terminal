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

    console.log(`Eseye konekte sou MonCash nan mòd: ${mode}`);

    // ETAP 1: Eseye jwenn Token an
    const authRes = await fetch(`${baseUrl}/v1/CreateToken`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(clientID + ':' + secretKey).toString('base64')
      }
    });

    const authStatus = authRes.status;
    const authData = await authRes.json();
    
    // Si MonCash refize (401)
    if (authStatus === 401) {
      return NextResponse.json({ 
        error: "MonCash refize kle yo (401).",
        detay: "Verifye si IP sèvè a pa bloke nan Dashboard MonCash la oswa si 'REST API' a byen aktive.",
        debug: {
            status: authStatus,
            message: authData.message || "Unauthorized",
            mode_itilize: mode
        }
      }, { status: 401 });
    }

    if (!authData.access_token) {
        return NextResponse.json({ error: "Pa ka jwenn access_token", detay: authData }, { status: 500 });
    }

    // ETAP 2: Si Token an bon, eseye kreye peman an
    const paymentRes = await fetch(`${baseUrl}/v1/CreatePayment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        orderId: `ORD-${Date.now()}`,
        custom: userId 
      })
    });

    const paymentData = await paymentRes.json();

    if (paymentRes.status !== 200) {
        return NextResponse.json({ error: "Erè nan kreyasyon peman", detay: paymentData }, { status: paymentRes.status });
    }

    const redirectUrl = mode === 'live'
      ? `https://moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentData.payment_token.token}`
      : `https://sandbox.moncashbutton.digicelgroup.com/Moncash-middleware/Payment/Redirect?token=${paymentData.payment_token.token}`;

    return NextResponse.json({ url: redirectUrl });

  } catch (err: any) {
    return NextResponse.json({ error: "Erè Sèvè", mesaj: err.message }, { status: 500 });
  }
}