import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { getClientIp } from '@/lib/security/rate-limit';

// Sèvi ak sesyon otantifye a (pa yon email nan kò rekèt la) pou evite yon
// itilizatè fè sistèm nan kwè se yon LÒT moun ki konekte.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const device = typeof body.device === 'string' ? body.device.slice(0, 300) : 'Enkoni';
  const ip = getClientIp(request);

  const db = createSupabaseAdminClient();
  const { data: profile } = await db
    .from('profiles')
    .select('last_ip, last_device, full_name')
    .eq('id', user.id)
    .maybeSingle();

  const isNewDevice = Boolean(profile?.last_ip) && (profile?.last_ip !== ip || profile?.last_device !== device);

  await db.from('profiles').update({ last_ip: ip, last_device: device }).eq('id', user.id);

  if (isNewDevice) {
    await sendNewDeviceAlert({ email: user.email || '', fullName: profile?.full_name, ip, device });
  }

  return NextResponse.json({ success: true });
}

async function sendNewDeviceAlert(info: { email: string; fullName?: string; ip: string; device: string }) {
  const token = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const msg =
    `🔔 <b>KONEKSYON SOU YON NOUVO APARÈY/IP</b>\n` +
    `👤 Kliyan: ${info.fullName || info.email}\n` +
    `📧 ${info.email}\n` +
    `🌐 IP: ${info.ip}\n` +
    `📱 Aparèy: ${info.device.slice(0, 120)}`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
    });
  } catch {
    /* pa bloke koneksyon an si Telegram pa reponn */
  }
}
