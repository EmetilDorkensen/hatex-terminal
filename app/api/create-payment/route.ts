import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateMerchantApiKey } from '@/lib/security/api-key';
import {
  isUntrustedBrowserRequest,
  merchantApiJson,
  parseBearerApiKey,
  rateLimitMerchantApiKey,
  rateLimitMerchantIp,
} from '@/lib/security/merchant-api';
import { isSafeWebhookUrl } from '@/lib/security/webhook-delivery';
import { safeExternalUrl } from '@/lib/security/safe-url';

export async function POST(req: Request) {
  try {
    if (isUntrustedBrowserRequest(req)) {
      return merchantApiJson({ error: 'API sa a se sèlman pou sèvè machann.' }, 403);
    }

    const ipRl = await rateLimitMerchantIp(req, 'create-payment', 40, 60);
    if (!ipRl.allowed) {
      return merchantApiJson({ error: 'Twòp demann. Eseye ankò.' }, 429);
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await req.json();
    const { merchant_api_key, amount_htg, order_id, redirect_url, webhook_url } = body;

    const apiKey =
      parseBearerApiKey(req) || (typeof merchant_api_key === 'string' ? merchant_api_key.trim() : null);

    if (!apiKey || !amount_htg || !order_id || !redirect_url) {
      return merchantApiJson({ error: 'Manke enfòmasyon nan demann lan' }, 400);
    }

    const safeRedirect = safeExternalUrl(String(redirect_url));
    if (!safeRedirect) {
      return merchantApiJson({ error: 'redirect_url pa valab (https obligatwa).' }, 400);
    }

    let safeWebhook: string | null = null;
    if (webhook_url) {
      const check = isSafeWebhookUrl(String(webhook_url).trim());
      if (!check.safe) {
        return merchantApiJson({ error: check.reason || 'webhook_url pa otorize.' }, 400);
      }
      safeWebhook = String(webhook_url).trim();
    }

    const keyRl = await rateLimitMerchantApiKey(apiKey, 60, 60);
    if (!keyRl.allowed) {
      return merchantApiJson({ error: 'Twòp demann pou kle API sa a.' }, 429);
    }

    const merchant = await authenticateMerchantApiKey(supabaseAdmin, apiKey);

    if (!merchant) {
      return merchantApiJson({ error: 'Machann sa a pa rekonèt sou HatexCard' }, 404);
    }

    if (merchant.account_status === 'suspended') {
      return merchantApiJson({ error: 'Kont machann sa a bloke. Peman enposib.' }, 403);
    }

    const { data: paymentRequest, error: insertErr } = await supabaseAdmin
      .from('payment_requests')
      .insert([{
        merchant_id: merchant.id,
        amount: Number(amount_htg),
        order_id: order_id,
        redirect_url: safeRedirect,
        webhook_url: safeWebhook,
      }])
      .select()
      .single();

    if (insertErr) throw insertErr;

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const checkoutUrl = `${baseUrl}/pay/${paymentRequest.id}`;

    return merchantApiJson({
      success: true,
      payment_id: paymentRequest.id,
      checkout_url: checkoutUrl,
    });
  } catch (error: unknown) {
    console.error('API Payment Error:', error);
    return merchantApiJson({ error: 'Erè nan sèvè HatexCard la' }, 500);
  }
}