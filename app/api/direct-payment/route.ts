import { NextResponse } from 'next/server';

// ============================================================================
// 🚫 WOUT DEZAKTIVE — FONKSYONALITE AN DOUBLE / MODÈL SEKIRITE PI FÈB
// ============================================================================
// Wout sa a te fè menm travay ak /api/public/payments men san menm kalite
// verifikasyon (pa gen rate-limiting, epi li antre an konfli ak sistèm
// eskwo/OTP a paske li mete tranzaksyon an "completed" imedyatman olye
// "pending" k ap tann konfimasyon livrezon). Pa gen okenn kote nan app la
// ki rele wout sa a.
//
// Pou peman machann reyèl, itilize /api/public/payments.
// ============================================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}
