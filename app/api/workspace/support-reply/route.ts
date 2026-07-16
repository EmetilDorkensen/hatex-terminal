import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/security/supabase-server';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { assertFinanceOperatorWithGate } from '@/lib/admin/auth';

/**
 * Staff/admin repons sipò — sèlman via API (service_role).
 * Pa itilize staff_users.id kòm sender_id.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await rateLimit(`support-reply:${ip}`, 60, 300);
  if (!rl.allowed) {
    return NextResponse.json({ success: false, message: 'Twòp demann.' }, { status: 429 });
  }

  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user?.email || !user.id) {
      return NextResponse.json({ success: false, message: 'Ou dwe konekte.' }, { status: 401 });
    }

    // Admin gate OSWA nenpòt staff aktif ak workspace gate
    const gate = await assertFinanceOperatorWithGate(user.email);
    if (!gate.ok) {
      return NextResponse.json(
        { success: false, message: 'Aksè refize. Antre gate workspace/admin anvan.' },
        { status: 403 }
      );
    }

    // Staff: sèlman support / super_admin (admin email deja ok via gate.role)
    if (gate.role === 'staff') {
      const dbCheck = createSupabaseAdminClient();
      const { data: staff } = await dbCheck
        .from('staff_users')
        .select('role')
        .eq('email', user.email.trim().toLowerCase())
        .eq('status', 'active')
        .maybeSingle();
      if (!staff || !['support', 'super_admin'].includes(String(staff.role))) {
        return NextResponse.json({ success: false, message: 'Wòl ou pa gen dwa reponn sipò.' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const ticketId = String(body.ticket_id || '');
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : '';
    if (!ticketId || !message) {
      return NextResponse.json({ success: false, message: 'Mesaj oswa ticket manke.' }, { status: 400 });
    }

    const db = createSupabaseAdminClient();

    // Asire gen pwofil pou sender_id (FK) — staff ka gen auth san pwofil konplè
    const { data: senderProf } = await db.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!senderProf) {
      await db.from('profiles').upsert(
        {
          id: user.id,
          email: user.email.trim().toLowerCase(),
          full_name: user.email.split('@')[0],
          account_status: 'active',
        },
        { onConflict: 'id' }
      );
    }

    const { data: ticket } = await db
      .from('support_tickets')
      .select('id, status')
      .eq('id', ticketId)
      .maybeSingle();
    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket pa jwenn.' }, { status: 404 });
    }
    if (ticket.status === 'closed') {
      return NextResponse.json({ success: false, message: 'Ticket sa a fèmen deja.' }, { status: 400 });
    }

    const { data: row, error } = await db
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: user.id,
        message,
        is_staff_reply: true,
      })
      .select('id, ticket_id, sender_id, message, is_staff_reply, created_at')
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    await db.from('support_tickets').update({ status: 'answered' }).eq('id', ticketId);

    return NextResponse.json({ success: true, message: row });
  } catch {
    return NextResponse.json({ success: false, message: 'Erè sèvè.' }, { status: 500 });
  }
}
