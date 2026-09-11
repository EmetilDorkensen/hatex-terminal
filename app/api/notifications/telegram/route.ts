import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';

type TelegramChannel = 'admin' | 'finance';

const MAX_MESSAGE_LEN = 1800;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: 'Aksè refize.' }, { status: 401 });
    }

    // Anpeche spam: 6 mesaj / 15 min pou chak itilizatè + IP
    const ip = getClientIp(request);
    const rl = await rateLimit(`telegram-notify:${user.id}:${ip}`, 6, 900);
    if (!rl.allowed) {
      return NextResponse.json({ success: false, message: 'Twòp notifikasyon. Eseye pita.' }, { status: 429 });
    }

    const body = await request.json();
    const { message, channel = 'admin', photoUrl, parseMode = 'HTML' } = body;

    if (!message && !photoUrl) {
      return NextResponse.json({ success: false, message: 'Mesaj vid.' }, { status: 400 });
    }

    const safeChannel: TelegramChannel = channel === 'finance' ? 'finance' : 'admin';
    const rawMessage = typeof message === 'string' ? message.slice(0, MAX_MESSAGE_LEN) : '';
    // Mare mesaj la ak imèl itilizatè a — pa kite anonim spam.
    const safeMessage = `<b>Soti:</b> ${escapeHtml(user.email || user.id)}\n${rawMessage}`;
    const safeParseMode =
      parseMode === 'MarkdownV2' || parseMode === 'Markdown' ? parseMode : 'HTML';

    const { token, chatId } = getTelegramConfig(safeChannel);
    if (!token || !chatId) {
      return NextResponse.json({ success: false, message: 'Telegram pa konfigire sou sèvè a.' }, { status: 500 });
    }

    const endpoint = photoUrl
      ? `https://api.telegram.org/bot${token}/sendPhoto`
      : `https://api.telegram.org/bot${token}/sendMessage`;

    const payload = photoUrl
      ? { chat_id: chatId, photo: photoUrl, caption: safeMessage, parse_mode: safeParseMode }
      : { chat_id: chatId, text: safeMessage, parse_mode: safeParseMode };

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
