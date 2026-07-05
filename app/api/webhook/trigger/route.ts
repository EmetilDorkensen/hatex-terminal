import { NextResponse } from 'next/server';

// ============================================================================
// 🚫 WOUT DEZAKTIVE — TWOU SEKIRITE REYÈL JWENN PANDAN ODIT
// ============================================================================
// Wout sa a te ekri dirèkteman nan tab `transactions` AK service-role key
// san okenn otantifikasyon — nenpòt moun sou entènèt te ka kreye fo
// tranzaksyon "completed" nan sistèm nan. Anplis, schema li itilize a
// (mid, subtotal, shipping_fee, customer_name, elatriye) pa menm koresponn
// ak estrikti reyèl tab `transactions` lan jodi a.
//
// Pa gen okenn kote nan app la ki rele wout sa a. Nou dezaktive l nèt pou
// fèmen twou sekirite a. Pou peman machann reyèl, itilize /api/public/payments.
// ============================================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}
