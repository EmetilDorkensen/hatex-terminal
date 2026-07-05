import { NextResponse } from 'next/server';

// ============================================================================
// 🚫 WOUT DEZAKTIVE — KÒD MÒ/DANJERE JWENN PANDAN ODIT
// ============================================================================
// Wout sa a te yon stub ki pwente sou yon domèn egzanp ("sit-ou-a.com") ki pa
// egziste, epi li te "verifye" (`verified: true`) done peman san okenn
// validasyon reyèl — sa ta ka pèmèt konfime yon fo peman bay nenpòt sistèm
// ki ta fè konfyans nan repons lan. Pa gen okenn kote nan app la ki rele l.
//
// Pou peman machann reyèl, itilize /api/public/payments.
// ============================================================================

export async function POST() {
  return NextResponse.json(
    { error: 'Wout sa a dezaktive definitivman pou rezon sekirite. Itilize /api/public/payments.' },
    { status: 410 }
  );
}
