import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const clientID = process.env.MONCASH_CLIENT_ID || "";
    const secretKey = process.env.MONCASH_SECRET_KEY || "";

    return NextResponse.json({ 
        msg: "Tès Kle yo",
        longè_ID: clientID.length,
        longè_Secret: secretKey.length,
        kòmanse_ak_espas: clientID.startsWith(" ") || secretKey.startsWith(" "),
        fini_ak_espas: clientID.endsWith(" ") || secretKey.endsWith(" ")
    });
}