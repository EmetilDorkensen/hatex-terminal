import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';

type TelegramChannel = 'admin' | 'finance';

function getTelegramConfig(channel: TelegramChannel) {
  if (channel === 'finance') {
    return {
      token: process.env.TELEGRAM_FINANCE_BOT_TOKEN,
      chatId: process.env.TELEGRAM_FINANCE_CHAT_ID,
    };
  }
  return {
    token: process.env.TELEGRAM_ADMIN_BOT_TOKEN,
    chatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Aksè refize.' }, { status: 401 });
    }

    const body = await request.json();
    const { message, channel = 'admin', photoUrl, parseMode = 'HTML' } = body;

    if (!message && !photoUrl) {
      return NextResponse.json({ success: false, message: 'Mesaj vid.' }, { status: 400 });
    }

    const { token, chatId } = getTelegramConfig(channel as TelegramChannel);
    if (!token || !chatId) {
      return NextResponse.json({ success: false, message: 'Telegram pa konfigire sou sèvè a.' }, { status: 500 });
    }

    const endpoint = photoUrl
      ? `https://api.telegram.org/bot${token}/sendPhoto`
      : `https://api.telegram.org/bot${token}/sendMessage`;

    const payload = photoUrl
      ? { chat_id: chatId, photo: photoUrl, caption: message, parse_mode: parseMode }
      : { chat_id: chatId, text: message, parse_mode: parseMode };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, message: 'Telegram pa reponn.' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
