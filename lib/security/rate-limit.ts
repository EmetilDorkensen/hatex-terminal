import { createClient } from '@supabase/supabase-js';

type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec?: number };

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function checkUpstash(key: string, limit: number, windowSec: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const redisKey = `rl:${key}`;
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', redisKey],
      ['TTL', redisKey],
    ]),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const count = Number(data[0]?.result ?? 1);
  let ttl = Number(data[1]?.result ?? -1);

  if (ttl === -1) {
    await fetch(`${url}/expire/${encodeURIComponent(redisKey)}/${windowSec}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    ttl = windowSec;
  }

  if (count > limit) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(ttl, 1) };
  }
  return { allowed: true, remaining: Math.max(limit - count, 0) };
}

async function checkSupabase(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();
  const now = Date.now();
  const resetAt = new Date(now + windowSec * 1000).toISOString();

  const { data: rpcData, error: rpcErr } = await supabase.rpc('hatex_rate_limit_hit', {
    p_key: key,
    p_limit: limit,
    p_window_sec: windowSec,
  });

  if (!rpcErr && rpcData) {
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (row && typeof (row as { allowed?: boolean }).allowed === 'boolean') {
      const r = row as { allowed: boolean; remaining?: number; retry_after_sec?: number };
      return {
        allowed: r.allowed,
        remaining: Number(r.remaining ?? 0),
        retryAfterSec: r.retry_after_sec != null ? Number(r.retry_after_sec) : undefined,
      };
    }
  }

  const { data: existing } = await supabase
    .from('rate_limits')
    .select('count, reset_at')
    .eq('id', key)
    .maybeSingle();

  if (!existing || new Date(existing.reset_at).getTime() <= now) {
    await supabase.from('rate_limits').upsert({ id: key, count: 1, reset_at: resetAt });
    return { allowed: true, remaining: limit - 1 };
  }

  const nextCount = Number(existing.count) + 1;
  if (nextCount > limit) {
    const retryAfterSec = Math.ceil((new Date(existing.reset_at).getTime() - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec: Math.max(retryAfterSec, 1) };
  }

  await supabase.from('rate_limits').update({ count: nextCount }).eq('id', key);
  return { allowed: true, remaining: limit - nextCount };
}

function checkMemory(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - entry.count };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  try {
    const upstash = await checkUpstash(key, limit, windowSec);
    if (upstash) return upstash;
  } catch {
    /* fallback */
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      return await checkSupabase(key, limit, windowSec);
    } catch {
      /* fallback */
    }
  }

  return checkMemory(key, limit, windowSec);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
