import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { FEE_KEYS, resolvePlatformFee, type FeeKey } from '@/lib/fees/platform';

/** Frè rezoud pou kont ki konekte a (global + override). */
export async function GET() {
  try {
    const auth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await auth.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }
    const db = createSupabaseAdminClient();
    const fees: Record<string, number> = {};
    for (const key of FEE_KEYS) {
      fees[key] = await resolvePlatformFee(db, key as FeeKey, user.id);
    }
    return NextResponse.json({ success: true, fees });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
