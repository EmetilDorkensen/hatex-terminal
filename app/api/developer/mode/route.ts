import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { checkMerchantEligibility } from '@/lib/security/merchant-provisioning';

/**
 * Toggle mòd API a (test | live) — tankou Stripe.
 *
 *   POST /api/developer/mode
 *   Body: { mode: 'test' | 'live' }
 *
 * Mòd la kontwole ki MonCash env yo itilize:
 *   • test  → sandbox.moncashbutton.digicelgroup.com (pa touche vre lajan)
 *   • live  → moncashbutton.digicelgroup.com (vre lajan)
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await rateLimit(`dev-mode-toggle:${ip}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
  }

  try {
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    let body: { mode?: unknown };
    try {
      body = (await req.json()) as { mode?: unknown };
    } catch {
      return NextResponse.json({ error: 'Kò demann lan dwe se JSON valab.' }, { status: 400 });
    }

    const mode = String(body?.mode || '');
    if (mode !== 'test' && mode !== 'live') {
      return NextResponse.json({ error: 'Mòd la dwe se "test" oswa "live".' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, kyc_status, is_merchant')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Pwofil pa jwenn.' }, { status: 404 });
    }

    const eligibility = checkMerchantEligibility(profile);
    if (!eligibility.eligible) {
      return NextResponse.json({ error: 'Kont ou poko elijib pou API devlopè a.' }, { status: 403 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ api_key_mode: mode })
      .eq('id', user.id);

    if (updateErr) {
      return NextResponse.json({ error: 'Pa kapab chanje mòd la.' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      mode,
      message:
        mode === 'test'
          ? 'Mòd TEST aktive — peman ap fèt nan MonCash sandbox (pa touche vre lajan).'
          : 'Mòd LIVE aktive — peman ap fèt ak vre lajan sou MonCash.',
    });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}

/** Retounen mòd aktyèl la. */
export async function GET() {
  try {
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('api_key_mode')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ ok: true, mode: profile?.api_key_mode || 'live' });
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
