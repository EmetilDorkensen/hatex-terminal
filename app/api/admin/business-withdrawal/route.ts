import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import {
  getBusinessProfitSummary,
  getTotalBusinessWithdrawn,
} from '@/lib/admin/business-profit';
import {
  hasValidAdminGate,
  requireAdminUser,
  verifyAdminPassword,
} from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit-log';

async function sendFinanceTelegram(message: string) {
  const token = process.env.TELEGRAM_FINANCE_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_FINANCE_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch {
    /* pa bloke retrè a si Telegram echwe */
  }
}

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire.' }, { status: 401 });
  }

  const db = createSupabaseAdminClient();
  const summary = await getBusinessProfitSummary(db);

  const { data: withdrawals } = await db
    .from('business_profit_withdrawals')
    .select('id, amount, note, admin_email, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    ...summary,
    withdrawals: withdrawals || [],
  });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`admin-biz-withdraw:${ip}`, 5, 900);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Twòp tantativ. Eseye ankò nan ${rl.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
  }
  if (!(await hasValidAdminGate())) {
    return NextResponse.json({ error: 'Sesyon admin ekspire. Antre modpas la ankò.' }, { status: 401 });
  }

  if (!process.env.ADMIN_GATE_PASSWORD) {
    return NextResponse.json({ error: 'ADMIN_GATE_PASSWORD pa konfigire.' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!password || !verifyAdminPassword(password)) {
    return NextResponse.json({ error: 'Modpas admin pa bon.' }, { status: 401 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Montan pa valab.' }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  const summary = await getBusinessProfitSummary(db);

  if (amount > summary.available_htg) {
    return NextResponse.json(
      {
        error: `Montan depase pwofi disponib la. Disponib: ${summary.available_htg.toLocaleString()} HTG`,
        ...summary,
      },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await db
    .from('business_profit_withdrawals')
    .insert({
      amount: Number(amount.toFixed(2)),
      note: note || null,
      admin_email: admin.user.email!,
    })
    .select('id, amount, note, created_at')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: 'Pa t kapab anrejistre retrè a.' }, { status: 500 });
  }

  const newSummary = await getBusinessProfitSummary(db);
  const totalWithdrawn = await getTotalBusinessWithdrawn(db);

  await logAdminAction(db, {
    adminEmail: admin.user.email!,
    action: 'BUSINESS_PROFIT_WITHDRAWN',
    targetType: 'business_profit_withdrawal',
    targetId: inserted.id,
    details: { amount: inserted.amount, note },
    ip,
  });

  await sendFinanceTelegram(
    `<b>RETRÈ PWOFI BIZNIS</b>\n` +
      `Montan: ${Number(inserted.amount).toLocaleString()} HTG\n` +
      `Disponib apre: ${newSummary.available_htg.toLocaleString()} HTG\n` +
      `Total retire depi kòmansman: ${totalWithdrawn.toLocaleString()} HTG` +
      (note ? `\nNòt: ${note}` : '')
  );

  return NextResponse.json({
    success: true,
    message: 'Retrè pwofi biznis anrejistre.',
    withdrawal: inserted,
    ...newSummary,
  });
}
