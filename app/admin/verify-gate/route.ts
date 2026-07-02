import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    // Rale modpas ou te sere an sekirite nan Vercel la
    const correctPassword = process.env.ADMIN_GATE_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json({ error: "Modpas Vercel la pa konfigire" }, { status: 500 });
    }

    if (password === correctPassword) {
      const response = NextResponse.json({ success: true, message: "Koneksyon Siksè" });
      
      // Nou kreye yon Cookie sekrè pou middleware la ka kite w pase alèz
      response.cookies.set({
        name: 'admin_session',
        value: 'true',
        httpOnly: true,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // Valab pou 24 èdtan
      });

      return response;
    } else {
      return NextResponse.json({ error: "Modpas la pa bon" }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Erè nan sèvè a" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const hasSession = cookieStore.get('admin_session')?.value === 'true';
    
    if (hasSession) {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: "Pa gen sesyon aktif" }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ error: "Erè nan lekti sesyon an" }, { status: 500 });
  }
}