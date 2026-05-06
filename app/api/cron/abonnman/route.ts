import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function GET(req: Request) {
  try {
    // 🚨 SEKIRITE: Asire w se sèlman Vercel (robo a) ki ka deklanche paj sa a
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Ou pa gen otorizasyon pou deklanche robo sa a.', { status: 401 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! 
    );

    // 1. Chèche tout abònman ki dwe peye jodi a (Oswa ki te anreta deja)
    const jodiA = new Date().toISOString();
    const { data: subscriptions, error: subErr } = await supabaseAdmin
      .from('subscriptions') // Tab kote w sere abònman aktif yo
      .select('*, profiles:client_id(email, full_name), merchant:merchant_id(email, full_name)')
      .in('status', ['active', 'past_due'])
      .lte('next_billing_date', jodiA);

    if (subErr || !subscriptions) {
      console.log("Pa gen abònman pou trete jodi a.");
      return NextResponse.json({ message: "Zewo abònman pou trete." });
    }

    // 2. Pase sou yo youn pa youn pou trete yo
    for (const sub of subscriptions) {
      
      // LA A: Ou tcheke balans kliyan an (Avèk RPC Supabase ou a)
      const { data: chargeResult } = await supabaseAdmin.rpc('process_subscription_payment', {
        p_sub_id: sub.id,
        p_amount: sub.amount
      });

      if (chargeResult?.success) {
        // ✅ SI L JWENN KÒB LA: Li mete dat la pou lòt mwa epi l asire l aktif
        const lotMwa = new Date();
        lotMwa.setMonth(lotMwa.getMonth() + 1);
        
        await supabaseAdmin.from('subscriptions').update({ 
          next_billing_date: lotMwa.toISOString(),
          status: 'active' 
        }).eq('id', sub.id);

        console.log(`Peman pase pou abònman ${sub.id}`);

      } else {
        // ❌ SI L PA JWENN KÒB: Lojik 24 Èdtan an antre an jwèt
        
        if (sub.status === 'active') {
          // PREMYE FWA LI ECHWE: Nou ba l 24 èdtan epi nou voye avètisman
          await supabaseAdmin.from('subscriptions').update({ status: 'past_due' }).eq('id', sub.id);

          await resend.emails.send({
            from: 'HatexCard <notifications@hatexcard.com>',
            to: sub.profiles.email,
            subject: '⚠️ Peman Abònman Echwe - Rechaje kat ou!',
            html: `Bonjou ${sub.profiles.full_name},<br><br>Nou pa t jwenn ase kòb sou kat Hatex ou a pou abònman <b>${sub.plan_name}</b> nan boutik ${sub.shop_name}.<br><br><b>Tanpri rechaje kat ou a nan mwens pase 24 èdtan.</b> Si sa pa fèt, n ap oblije anile abònman an demen.`,
          });
          
          console.log(`Avètisman 24h voye bay kliyan ${sub.client_id}`);

        } else if (sub.status === 'past_due') {
          // DEZYÈM FWA LI ECHWE (24h fin pase): Nou anile l nèt
          await supabaseAdmin.from('subscriptions').update({ status: 'cancelled' }).eq('id', sub.id);

          // Voye mesaj bay machann nan pou l koupe sèvis la
          await resend.emails.send({
            from: 'HatexCard <notifications@hatexcard.com>',
            to: sub.merchant.email,
            subject: `❌ Abònman Anile: ${sub.plan_name}`,
            html: `Bonjou ${sub.merchant.full_name},<br><br>Apre 24 èdtan ap tann, kliyan <b>${sub.profiles.full_name}</b> pa t mete kòb sou kat li pou abònman ${sub.plan_name} lan.<br><br>Sistèm nan anile l otomatikman. Tanpri koupe aksè sèvis la pou kliyan sa a.`,
          });

          // Voye mesaj final bay kliyan an
          await resend.emails.send({
            from: 'HatexCard <notifications@hatexcard.com>',
            to: sub.profiles.email,
            subject: `❌ Abònman w lan Anile nèt`,
            html: `Bonjou,<br><br>Piske 24 èdtan yo pase epi kat ou te toujou vid, nou oblije anile abònman <b>${sub.plan_name}</b> ou a. Si w bezwen sèvis la ankò, w ap oblije refè yon nouvo abònman sou sit machann nan.`,
          });

          console.log(`Abònman ${sub.id} ANILE nèt paske pa t gen kòb.`);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'CRON Job la pase ak siksè!' });

  } catch (error: any) {
    console.error("Erè nan CRON Job la:", error);
    return NextResponse.json({ error: 'Erè sistèm.' }, { status: 500 });
  }
}