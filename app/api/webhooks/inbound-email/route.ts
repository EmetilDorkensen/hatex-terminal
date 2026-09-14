import { NextResponse } from 'next/server';
import { timingSafeEqualString } from '@/lib/security/timing';
import { ingestInboundEmail, type InboundAttachment } from '@/lib/contact/inbound';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Webhook pou imèl inbound (Cloudflare Email Worker).
 *
 * Header: x-inbound-secret: <INBOUND_EMAIL_WEBHOOK_SECRET>
 * Body JSON:
 * {
 *   from_email, from_name?, to_email, subject, text,
 *   message_id?, attachments?: [{ filename, content_type, content_base64 }]
 * }
 */
export async function POST(request: Request) {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, message: 'INBOUND_EMAIL_WEBHOOK_SECRET pa konfigire.' },
      { status: 503 }
    );
  }

  const provided = request.headers.get('x-inbound-secret') || '';
  if (!timingSafeEqualString(provided, secret)) {
    return NextResponse.json({ ok: false, message: 'Sekrè pa valab.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON pa valab.' }, { status: 400 });
  }

  const attachmentsRaw = Array.isArray(body.attachments) ? body.attachments : [];
  const attachments: InboundAttachment[] = [];
  for (const a of attachmentsRaw) {
    if (!a || typeof a !== 'object') continue;
    const row = a as Record<string, unknown>;
    const contentBase64 = String(row.content_base64 || row.contentBase64 || '');
    if (!contentBase64) continue;
    attachments.push({
      filename: String(row.filename || 'file').slice(0, 180),
      contentType: String(row.content_type || row.contentType || 'application/octet-stream'),
      contentBase64,
    });
  }

  const result = await ingestInboundEmail({
    fromEmail: String(body.from_email || body.fromEmail || ''),
    fromName: body.from_name != null ? String(body.from_name) : body.fromName != null ? String(body.fromName) : null,
    toEmail: String(body.to_email || body.toEmail || 'support@hatexcard.com'),
    subject: String(body.subject || '(San sijè)'),
    textBody: String(body.text || body.text_body || body.textBody || body.html || ''),
    messageId: body.message_id != null ? String(body.message_id) : body.messageId != null ? String(body.messageId) : null,
    attachments,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
