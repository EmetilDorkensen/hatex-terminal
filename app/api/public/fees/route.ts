import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/security/supabase-server';
import { FEE_KEYS, resolvePlatformFee, type FeeKey } from '@/lib/fees/platform';
import { resolveAllPlatformLimits } from '@/lib/limits/platform';

/**
 * Frè + limit piblik pou paj maketing (san otantifikasyon).
 * Pa gen override pa kont — sèlman valè global.
 */
export async function GET() {
  try {
    const db = createSupabaseAdminClient();
    const fees: Record<string, number> = {};
    for (const key of FEE_KEYS) {
      fees[key] = await resolvePlatformFee(db, key as FeeKey, null);
    }
    const limits = await resolveAllPlatformLimits(db);
    const { data: tiers } = await db.from('agent_tiers').select('tier, capacity_htg, label');
    return NextResponse.json({
      success: true,
      fees,
      limits,
      agent_tiers: tiers || [],
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
