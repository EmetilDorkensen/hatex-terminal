import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    // Rale modpas ou te sere an sekirite nan Vercel la
    const correctPassword = process.env.ADMIN_GATE_PASSWORD;

    if (!correctPassword) {
      return NextResponse.json(
        { error: "Modpas Vercel la pa konfigire" }, 
        { status: 500 }
      );
    }

    if (password === correctPassword) {
      // 1. Nou kreye repons lan anvan
      const response = NextResponse.json({ success: true, message: "Koneksyon Siksè" });
      
      // 2. Nou mete Cookie a (Paspò a) dirèkteman sou repons lan (Estanda Next.js 15)
      response.cookies.set({
        name: 'admin_session',
        value: 'true',
        httpOnly: true, // Kòd sou navigatè a paka vòlè l
        path: '/',
        secure: process.env.NODE_ENV === 'production', // Sèvi ak HTTPS an pwodiksyon
        maxAge: 60 * 60 * 24, // Valab pou 1 jou
      });

      return response;
    } else {
      return NextResponse.json({ error: "Modpas la pa bon" }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Erè nan sèvè a" }, { status: 500 });
  }
}

// Fonksyon GET a
export async function GET() {
  try {
    // Nan Next.js 15, nou dwe itilize "await" devan cookies()
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