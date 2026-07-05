import { NextResponse } from 'next/server';

// ============================================================================
// 🚫 WOUT DEZAKTIVE — TWOU SEKIRITE REYÈL JWENN PANDAN ODIT
// ============================================================================
// Wout sa a te gen 2 gwo pwoblèm sekirite:
//   1. "Otantifikasyon" an te sèlman verifye si tèks la KÒMANSE ak "htx_live_"
//      — pa gen okenn verifikasyon nan baz done a pou konfime kle a apatyen
//      a yon vrè machann. Nenpòt moun ki konn fòma a te ka itilize l.
//   2. Li te retire kòb (`wallet_balance`) nan kont yon KLIYAN san li pa
//      janm kredite okenn machann an retou — kòb la te disparèt nèt san
//      kontwòl, san posiblite pou trase l tounen bay pèsonn.
//
// Pa gen okenn kliyan k ap itilize wout sa a jodi a (pa gen dokimantasyon
// piblik pou li, pa gen okenn paj nan platform lan ki rele l). Nou dezaktive
// l nèt pou fèmen twou sekirite a san afekte okenn fonksyonalite k ap
// itilize kounye a. Pou peman machann reyèl, itilize /api/public/payments
// (ki gen vrè verifikasyon API key + kredite machann + limit balans).
// ============================================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}

export async function OPTIONS() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}
