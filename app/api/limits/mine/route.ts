import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { resolveAllPlatformLimits } from '@/lib/limits/platform';

/** Limit rezoud pou kont ki konekte a. */
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
    const limits = await resolveAllPlatformLimits(db);
    const { data: tiers } = await db.from('agent_tiers').select('tier, capacity_htg, label');
    return NextResponse.json({ success: true, limits, agent_tiers: tiers || [] });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
