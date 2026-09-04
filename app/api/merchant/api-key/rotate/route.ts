import { createClient } from '@supabase/supabase-js';
import { getClientIp, rateLimit } from '@/lib/security/rate-limit';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import { checkMerchantEligibility, ensureMerchantApiCredentials } from '@/lib/security/merchant-provisioning';
import {
  isUntrustedBrowserRequest,
  merchantApiJson,
  parseBearerApiKey,
  rateLimitInvalidApiKey,
  rateLimitMerchantApiKey,
} from '@/lib/security/merchant-api';

export const dynamic = 'force-dynamic';

/**
 * Rotasyon kle API machann (sèvè-a-sèvè).
 *
 *   POST /api/merchant/api-key/rotate
 *   Authorization: Bearer <kle API machann aktyèl la>
 *
 * Itilize pa bouton "Rotate API Key" andedan plugin WooCommerce
 * (HatexCard MonCash v26.1+), ak pa telechajman ZIP la sou dashboard la.
 *
 * - Verifye kle a (hash) → sispann si kont lan pa machann oswa suspendu.
 * - Jenere yon NOUVO kle epi mete hash/prefix nouvo a nan baz done.
 * - Ansyen kle a pa valab ankò imedyatman.
 * - Kle an klè retounen SÈLMAN yon sèl fwa (respons sa a).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipRl = await rateLimit(`merchant-rotate:ip:${ip}`, 30, 300);
  if (!ipRl.allowed) {
    return merchantApiJson({ ok: false, message: 'Twòp demann. Eseye ankò pita.' }, 429);
  }

  if (isUntrustedBrowserRequest(request)) {
    return merchantApiJson(
      { ok: false, message: 'Aksè refize. Rotasyon kle API fèt sèlman sèvè-a-sèvè.' },
      403
    );
  }

  const apiKey = parseBearerApiKey(request);
  if (!apiKey) {
    return merchantApiJson(
      { ok: false, message: 'Aksè refize. Kle API (Bearer Token) manke oswa li pa fòmate byen.' },
      401
    );
  }

  const keyRl = await rateLimitMerchantApiKey(apiKey, 6, 300);
  if (!keyRl.allowed) {
    return merchantApiJson({ ok: false, message: 'Twòp tantativ rotasyon. Eseye ankò pita.' }, 429);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const merchant = await authenticateMerchantApiKey(supabase, apiKey);
  if (!merchant || !merchant.is_merchant) {
    await rateLimitInvalidApiKey(ip);
    return merchantApiJson({ ok: false, message: 'Kle API sa a pa valab oswa kont lan pa otorize.' }, 403);
  }

  if (merchant.account_status === 'suspended') {
    return merchantApiJson(
      { ok: false, message: 'Kont machann lan suspendu. Kontakte sipò HatexCard.' },
      403
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, kyc_status, is_card_activated, is_merchant, plan, api_key, api_key_hash, api_key_prefix, api_key_pk, api_key_pk_hash, api_key_pk_prefix, webhook_secret, account_status'
    )
    .eq('id', merchant.id)
    .maybeSingle();

  if (!profile) {
    return merchantApiJson({ ok: false, message: 'Pwofil machann nan pa jwenn.' }, 404);
  }

  const eligibility = checkMerchantEligibility(profile);
  if (!eligibility.eligible) {
    return merchantApiJson(
      {
        ok: false,
        message: 'Kont machann sa a poko elijib pou API a.',
        missingKyc: eligibility.missingKyc,
      },
      403
    );
  }

  const result = await ensureMerchantApiCredentials(supabase, profile, {
    rotateApiKey: true,
  });

  if (!result.api_key || !result.rotated) {
    return merchantApiJson(
      { ok: false, message: 'Pa kapab jenere nouvo kle a. Eseye ankò pita.' },
      500
    );
  }

  return merchantApiJson({
    ok: true,
    message: 'Nouvo kle API jenere. Ansyen kle a pa valab ankò.',
    api_key: result.api_key,
    api_key_prefix: result.api_key_prefix,
    api_key_pk: result.api_key_pk,
    api_key_pk_prefix: result.api_key_pk_prefix,
    revealed_once: true,
  });
}
