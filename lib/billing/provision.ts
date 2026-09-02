import type { SupabaseClient } from '@supabase/supabase-js';
import { rotateGatewayApiKey } from '@/lib/gateway/api-keys';

/** Kreye / aktive kont machann pasrèl (san KYC pou plan gratis). */
export async function ensureMerchantGatewayAccount(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data: profile } = await admin
    .from('profiles')
    .select('account_type, full_name, business_name, phone')
    .eq('id', userId)
    .maybeSingle();

  const { data: bank } = await admin
    .from('hatex_bank_accounts')
    .select('phone, kind')
    .eq('user_id', userId)
    .eq('kind', 'moncash')
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payoutPhone = bank?.phone || null;
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from('hatex_merchant_accounts')
    .select('user_id, payout_phone, status, activated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    await admin.from('hatex_merchant_accounts').insert({
      user_id: userId,
      account_type: profile?.account_type === 'business' ? 'business' : 'individual',
      status: 'active',
      payout_provider: 'moncash',
      payout_phone: payoutPhone,
      display_name: profile?.business_name || profile?.full_name || null,
      auto_payout_enabled: true,
      activated_at: now,
    });
  } else {
    const patch: Record<string, unknown> = {
      status: existing.status === 'suspended' ? 'suspended' : 'active',
      updated_at: now,
    };
    if (!existing.payout_phone && payoutPhone) patch.payout_phone = payoutPhone;
    if (!existing.activated_at) patch.activated_at = now;
    await admin.from('hatex_merchant_accounts').update(patch).eq('user_id', userId);
  }

  const { data: keys } = await admin
    .from('hatex_api_keys')
    .select('mode')
    .eq('merchant_id', userId)
    .eq('is_active', true);

  const have = new Set((keys || []).map((k) => k.mode));
  if (!have.has('test')) {
    await rotateGatewayApiKey(admin, userId, 'test', 'Kle tès');
  }
  if (!have.has('live')) {
    await rotateGatewayApiKey(admin, userId, 'live', 'Kle live');
  }
}
