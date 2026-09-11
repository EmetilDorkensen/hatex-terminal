import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Voye yon notifikasyon in-app bay tout kliyan (oswa yon sèl kliyan).
 * Ekri dirèkteman nan tab `hatex_notifications` atravè service_role,
 * konsa chak kliyan wè mesaj la nan klòch « Notifikasyon » li.
 */
export async function broadcastNotification(
  db: SupabaseClient,
  opts: {
    title: string;
    body?: string;
    kind?: string;
    href?: string;
    targetEmail?: string;
  }
): Promise<{ ok: true; count: number } | { ok: false; status: number; message: string }> {
  const title = (opts.title || '').trim();
  if (!title) {
    return { ok: false, status: 400, message: 'Tit obligatwa.' };
  }

  const kind = String(opts.kind || 'announcement').slice(0, 40);
  const href =
    typeof opts.href === 'string' && opts.href.trim() ? opts.href.trim().slice(0, 300) : null;
  const targetEmail = (opts.targetEmail || '').trim().toLowerCase();

  let userIds: string[] = [];
  if (targetEmail) {
    const { data: target } = await db
      .from('profiles')
      .select('id')
      .eq('email', targetEmail)
      .maybeSingle();
    if (!target) return { ok: false, status: 404, message: 'Imèl kliyan pa jwenn.' };
    userIds = [String(target.id)];
  } else {
    const { data: rows } = await db.from('profiles').select('id');
    userIds = (rows || []).map((r) => String(r.id));
  }

  if (userIds.length === 0) {
    return { ok: false, status: 400, message: 'Pa gen kliyan pou resevwa notifikasyon an.' };
  }

  const now = new Date().toISOString();
  const insertRows = userIds.map((userId) => ({
    user_id: userId,
    kind,
    title,
    body: (opts.body || '').trim() || null,
    href,
    created_at: now,
  }));

  // Batch 200 pou pa frape limit payload / DB.
  for (let i = 0; i < insertRows.length; i += 200) {
    const chunk = insertRows.slice(i, i + 200);
    const { error } = await db.from('hatex_notifications').insert(chunk);
    if (error) return { ok: false, status: 400, message: error.message };
  }

  return { ok: true, count: insertRows.length };
}
