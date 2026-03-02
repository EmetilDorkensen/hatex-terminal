import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, events } = await request.json();

  // Validate URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // Validate events (dwe yon array)
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: 'Events must be a non-empty array' }, { status: 400 });
  }

  // Jenere yon sekrè inik
  const secret = crypto.randomBytes(32).toString('hex');

  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      user_id: user.id,
      url,
      events,
      secret,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ webhook: data });
}