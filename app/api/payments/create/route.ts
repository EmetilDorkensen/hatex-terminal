import { NextResponse } from 'next/server';

// ============================================================================
// 🚫 WOUT DEZAKTIVE — KÒD KI KRAZE NÈT JWENN PANDAN ODIT
// ============================================================================
// Wout sa a te chèche nan yon tab `merchants` ki PA EGZISTE nan baz done a
// (koze te dwe `profiles`), sa ki fè l kraze chak fwa yon moun eseye itilize
// l. Pa gen okenn kote nan app la ki rele wout sa a.
//
// Pou kreye yon lyen peman, itilize /api/public/payments.
// ============================================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}
