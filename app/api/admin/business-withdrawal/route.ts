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

  const [{ data: withdrawals }, { data: ledger }] = await Promise.all([
    db
      .from('business_profit_withdrawals')
      .select('id, amount, note, admin_email, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    db
      .from('business_profit_ledger')
      .select('id, direction, amount, entry_type, category, balance_after, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(80),
  ]);

  return NextResponse.json({
    ...summary,
    withdrawals: withdrawals || [],
    ledger: ledger || [],
    breakdown: summary.breakdown,
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
        error: `Montan depase balans kont pwofi a. Disponib: ${summary.available_htg.toLocaleString()} HTG`,
        ...summary,
      },
      { status: 400 }
    );
  }

  const { data: rpcResult, error: rpcError } = await db.rpc('hatex_business_profit_withdraw', {
    p_amount: Number(amount.toFixed(2)),
    p_admin_email: admin.user.email!,
    p_note: note || null,
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 });
  }

  const res = rpcResult as {
    success?: boolean;
    message?: string;
    withdrawal_id?: string;
    amount?: number;
    balance_after?: number;
  } | null;

  if (!res?.success) {
    return NextResponse.json(
      { error: res?.message || 'Pa t kapab anrejistre retrè a.' },
      { status: 400 }
    );
  }

  const { data: inserted } = await db
    .from('business_profit_withdrawals')
    .select('id, amount, note, created_at')
    .eq('id', res.withdrawal_id!)
    .maybeSingle();

  const newSummary = await getBusinessProfitSummary(db);
  const totalWithdrawn = await getTotalBusinessWithdrawn(db);

  await logAdminAction(db, {
    adminEmail: admin.user.email!,
    action: 'BUSINESS_PROFIT_WITHDRAWN',
    targetType: 'business_profit_withdrawal',
    targetId: res.withdrawal_id!,
    details: { amount: res.amount, note, ledger_balance_after: res.balance_after },
    ip,
  });

  await sendFinanceTelegram(
    `<b>RETRÈ PWOFI BIZNIS</b>\n` +
      `Montan: ${Number(res.amount || amount).toLocaleString()} HTG\n` +
      `Balans kont apre: ${Number(res.balance_after || newSummary.available_htg).toLocaleString()} HTG\n` +
      `Total retire depi kòmansman: ${totalWithdrawn.toLocaleString()} HTG` +
      (note ? `\nNòt: ${note}` : '')
  );

  return NextResponse.json({
    success: true,
    message: 'Retrè pwofi biznis anrejistre (kont ledger debite).',
    withdrawal: inserted || { id: res.withdrawal_id, amount: res.amount, note },
    ...newSummary,
  });
}
