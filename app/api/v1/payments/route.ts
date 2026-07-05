import { NextResponse } from 'next/server';

// ============================================================================
// 🚫 WOUT DEZAKTIVE — FONKSYONALITE AN DOUBLE JWENN PANDAN ODIT
// ============================================================================
// Wout sa a te kreye peman nan yon tab `payments` separe ki fè menm travay
// ak /api/public/payments (ki itilize `plugin_transactions` epi ki gen vrè
// limit balans + verifikasyon konplè). Pa gen okenn kote nan app la ki rele
// wout sa a — se te yon dezyèm chemen k ap flannen san kontwòl bò kote l.
//
// Pou kreye yon lyen peman, itilize /api/public/payments.
// ============================================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}
