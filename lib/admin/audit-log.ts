import type { SupabaseClient } from '@supabase/supabase-js';

export async function logAdminAction(
  db: SupabaseClient,
  params: {
    adminEmail: string;
    action: string;
    targetType?: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ip?: string;
  }
) {
  try {
    await db.from('admin_audit_log').insert({
      admin_email: params.adminEmail,
      action: params.action,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      details: params.details || null,
      ip: params.ip || null,
    });
  } catch {
    // Pa bloke aksyon prensipal la si jounal odit la echwe.
  }
}
