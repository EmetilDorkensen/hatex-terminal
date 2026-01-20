import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const clientID = process.env.MONCASH_CLIENT_ID || "";
    const secretKey = process.env.MONCASH_SECRET_KEY || "";

    return NextResponse.json({ 
        msg: "Verifikasyon Kle",
        ID_kòmanse_ak: clientID.substring(0, 5) + "...",
        Secret_kòmanse_ak: secretKey.substring(0, 5) + "...",
        ID_longè: clientID.length,
        Secret_longè: secretKey.length
    });
}