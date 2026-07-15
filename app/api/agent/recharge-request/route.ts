import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import crypto from 'crypto';

const BUCKET = 'agent-recharge-proofs';
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Ajan soumèt demann rechaj gratis (prèv peman + nimewo kont).
 * Pa modifye balans — admin/kesye approve via RPC.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`agent-recharge-req:${ip}`, 8, 600);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann. Eseye pita.' }, { status: 429 });
  }

  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }

    const form = await request.formData();
    const amount = Number(form.get('amount'));
    const paymentAccount = String(form.get('payment_account') || '').trim().slice(0, 80);
    const file = form.get('proof');

    if (!(amount > 0) || amount > 500000) {
      return NextResponse.json({ success: false, message: 'Montan pa valab.' }, { status: 400 });
    }
    if (!paymentAccount) {
      return NextResponse.json({ success: false, message: 'Nimewo kont / referans peman obligatwa.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: 'Prèv peman (foto/PDF) obligatwa.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: 'Fichye twò gwo (max 5MB).' }, { status: 400 });
    }
    const mime = (file.type || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json({ success: false, message: 'Fòma pa aksepte (jpg/png/webp/pdf).' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from('profiles')
      .select('id, agent_status, agent_code, agent_balance, agent_capacity')
      .eq('id', user.id)
      .single();

    if (!profile || profile.agent_status !== 'approved' || !profile.agent_code) {
      return NextResponse.json({ success: false, message: 'Ou dwe yon ajan aktif.' }, { status: 403 });
    }

    const room =
      Number(profile.agent_capacity || 0) - Number(profile.agent_balance || 0);
    if (room <= 0) {
      return NextResponse.json({ success: false, message: 'Kapasite ajan ou plen. Ogmante kapasite anvan.' }, { status: 400 });
    }
    if (amount > room) {
      return NextResponse.json({
        success: false,
        message: `Ou ka mande maksimòm ${room.toLocaleString()} HTG (kapasite ki rete).`,
      }, { status: 400 });
    }

    const { count } = await admin
      .from('agent_recharge_requests')
      .select('id', { count: 'exact', head: true })
      .eq('agent_user_id', user.id)
      .eq('status', 'pending');
    if ((count || 0) >= 3) {
      return NextResponse.json({
        success: false,
        message: 'Ou gen twòp demann k ap tann. Tann yo trete anvan.',
      }, { status: 429 });
    }

    // Asire bucket prive
    await admin.storage.createBucket(BUCKET, { public: false }).catch(() => null);

    const ext = mime.includes('pdf') ? 'pdf' : mime.split('/')[1] || 'jpg';
    const path = `${user.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) {
      return NextResponse.json({ success: false, message: 'Telechajman prèv echwe: ' + upErr.message }, { status: 500 });
    }

    const { data: row, error: insErr } = await admin
      .from('agent_recharge_requests')
      .insert({
        agent_user_id: user.id,
        agent_code: String(profile.agent_code),
        amount,
        payment_account: paymentAccount,
        proof_path: path,
        status: 'pending',
      })
      .select('id, amount, status, created_at')
      .single();

    if (insErr) {
      return NextResponse.json({ success: false, message: insErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      request: row,
      message: 'Demann voye. Admin / kesye ap verifye prèv la (san frè).',
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from('agent_recharge_requests')
      .select('id, amount, payment_account, status, rejection_reason, created_at, reviewed_at')
      .eq('agent_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    return NextResponse.json({ success: true, requests: data || [] });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
