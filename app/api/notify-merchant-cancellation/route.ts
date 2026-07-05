import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { rateLimit, getClientIp } from '@/lib/security/rate-limit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`notify-cancel:${ip}`, 10, 60);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Twòp demann. Eseye ankò.' }, { status: 429 });
    }

    // 🔐 OTANTIFIKASYON OBLIGATWA: `client_id` PA JANM soti nan kò rekèt la
    // (sa te pèmèt nenpòt moun anmède yon machann ak fo imèl anilasyon).
    const supabaseSession = await createSupabaseServerClient();
    const { data: { user }, error: authErr } = await supabaseSession.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Ou dwe konekte sou kont ou.' }, { status: 401 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabaseAdmin = createSupabaseAdminClient();

    const body = await req.json();
    const { merchant_id, plan_name } = body;
    const client_id = user.id;

    if (!merchant_id || !plan_name) {
      return NextResponse.json({ error: 'Manke enfòmasyon.' }, { status: 400 });
    }

    // Verifye itilizatè konekte a te REYÈLMAN gen yon abònman ak machann sa
    // a (anpeche moun voye fo imèl anilasyon bay machann ki pa gen rapò ak li).
    const { data: subCheck } = await supabaseAdmin
      .from('subscriptions_history')
      .select('id')
      .eq('client_id', client_id)
      .eq('merchant_id', merchant_id)
      .maybeSingle();

    if (!subCheck) {
      return NextResponse.json({ error: 'Nou pa jwenn okenn abònman ki koresponn ant ou ak machann sa a.' }, { status: 403 });
    }

    // 1. Chèche Imèl Machann nan
    const { data: merchant, error: merchantErr } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', merchant_id)
      .single();

    if (merchantErr || !merchant) {
      return NextResponse.json({ error: 'Machann pa rekonèt.' }, { status: 404 });
    }

    // 2. Chèche non Kliyan an (pou machann nan konn kiyès pou l koupe a)
    const { data: client } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', client_id)
      .single();

    const clientName = client?.full_name || 'Yon kliyan';
    const clientEmail = client?.email || 'Imèl pa disponib';
    const cancelDate = new Date().toLocaleDateString('ht-HT', { year: 'numeric', month: 'long', day: 'numeric' });

    // 3. Bati bèl imèl avètisman an
    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #eaeaea; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="background-color: #fee2e2; color: #dc2626; padding: 10px 20px; border-radius: 20px; font-weight: bold; font-size: 14px;">
            ⚠️ Abònman Anile
          </span>
        </div>
        
        <h1 style="font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 20px;">Aksyon Mande: Koupe Sèvis</h1>
        
        <p style="color: #555; line-height: 1.5; margin-bottom: 20px;">
          Bonjou <strong>${merchant.full_name || 'Machann'}</strong>,<br><br>
          Kliyan sa a fèk anile abònman li te genyen lakay ou a sou HatexCard. Sistèm nan p ap koupe kòb sou kat li ankò pou plan sa a. Tanpri pran dispozisyon pou w <strong>koupe aksè l nan sèvis la</strong>.
        </p>

        <div style="background-color: #f9fafb; border-left: 4px solid #dc2626; padding: 15px; margin-bottom: 25px; border-radius: 0 4px 4px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Plan anile a:</strong> ${plan_name}</p>
          <p style="margin: 0 0 10px 0;"><strong>Kliyan an:</strong> ${clientName} (${clientEmail})</p>
          <p style="margin: 0;"><strong>Dat anilasyon:</strong> ${cancelDate}</p>
        </div>

        <p style="color: #777; font-size: 13px; text-align: center;">
          Mèsi paske w fè HatexCard konfyans.<br>
          <a href="https://hatexcard.com" style="color: #2563eb; text-decoration: none;">Tablodbò HatexCard</a>
        </p>
      </div>
    `;

    // 4. Voye imèl la ak Resend
    await resend.emails.send({
      from: 'HatexCard Alerts <notifications@hatexcard.com>',
      to: merchant.email,
      subject: `⚠️ Abònman Anile: ${plan_name} pa ${clientName}`,
      html: emailHtml
    });

    return NextResponse.json({ success: true, message: 'Notifikasyon voye bay machann nan.' });

  } catch (error: any) {
    console.error("Erè API Notifikasyon Anilasyon:", error);
    return NextResponse.json({ error: 'Sèvè a rankontre yon erè.' }, { status: 500 });
  }
}