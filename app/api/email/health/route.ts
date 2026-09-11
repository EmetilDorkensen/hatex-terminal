import { NextResponse } from 'next/server';
import { getBrevoApiKey, isEmailConfigured, parseSender } from '@/lib/notify/email';
import { requireAdminUser, hasValidAdminGate } from '@/lib/admin/auth';

/**
 * Dyagnostik Brevo — admin + gate sèlman (pa piblik).
 */
export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'brevo',
        configured: false,
        message: 'BREVO_API_KEY pa konfigire sou sèvè a (Vercel).',
      },
      { status: 503 }
    );
  }

  const key = getBrevoApiKey()!;
  const sender = parseSender();

  try {
    const res = await fetch('https://api.brevo.com/v3/account', {
      headers: { accept: 'application/json', 'api-key': key },
      cache: 'no-store',
    });
    const raw = await res.text();
    let email: string | null = null;
    try {
      const parsed = JSON.parse(raw) as { email?: string };
      email = parsed.email || null;
    } catch {
      /* ignore parse */
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: 'brevo',
          configured: true,
          sender,
          message: `Brevo API refize kle a (HTTP ${res.status}). Verifye BREVO_API_KEY.`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      provider: 'brevo',
      configured: true,
      sender,
      account_email: email,
      message: 'Brevo OK — imèl ka voye si ekspeditè a verifye nan Brevo.',
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'brevo',
        configured: true,
        message: e instanceof Error ? e.message : 'Erè koneksyon Brevo.',
      },
      { status: 502 }
    );
  }
}
