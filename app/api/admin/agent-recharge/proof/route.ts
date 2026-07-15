import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { assertFinanceCashierWithGate } from '@/lib/admin/auth';

const BUCKET = 'agent-recharge-proofs';

/** Siyen URL prive pou admin/kesye wè prèv rechaj ajan. */
export async function GET(request: Request) {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Ou dwe konekte.' }, { status: 401 });
    }
    const gate = await assertFinanceCashierWithGate(user.email);
    if (!gate.ok) {
      return NextResponse.json({ error: 'Aksè refize.' }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'ID manke.' }, { status: 400 });
    }

    const db = createSupabaseAdminClient();
    const { data: row } = await db
      .from('agent_recharge_requests')
      .select('proof_path')
      .eq('id', id)
      .maybeSingle();

    if (!row?.proof_path) {
      return NextResponse.json({ error: 'Prèv pa jwenn.' }, { status: 404 });
    }

    const { data: signed, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(row.proof_path, 120);

    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Pa ka louvri prèv la.' }, { status: 500 });
    }

    return NextResponse.redirect(signed.signedUrl);
  } catch {
    return NextResponse.json({ error: 'Erè sèvè.' }, { status: 500 });
  }
}
