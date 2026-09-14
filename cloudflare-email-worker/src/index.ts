/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Email Worker — voye imèl inbound nan HatexCard.
 */

import PostalMime from 'postal-mime';

export interface Env {
  INBOUND_EMAIL_WEBHOOK_SECRET: string;
  INGEST_URL: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function toArrayBuffer(content: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (content instanceof ArrayBuffer) return content;
  return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const ingestUrl = (env.INGEST_URL || '').trim();
    const secret = (env.INBOUND_EMAIL_WEBHOOK_SECRET || '').trim();
    if (!ingestUrl || !secret) {
      console.error('[hatex-inbound] INGEST_URL oswa SECRET manke');
      message.setReject('Worker pa konfigire');
      return;
    }

    const raw = await new Response(message.raw).arrayBuffer();
    const parsed = await PostalMime.parse(raw);

    const fromEmail = parsed.from?.address || message.from || '';
    const fromName = parsed.from?.name || null;
    const toEmail = parsed.to?.[0]?.address || message.to || 'support@hatexcard.com';

    const text =
      (parsed.text || '').trim() ||
      (parsed.html ? stripHtml(parsed.html) : '') ||
      '(Mesaj vid)';

    const attachments: {
      filename: string;
      content_type: string;
      content_base64: string;
    }[] = [];

    for (const att of parsed.attachments || []) {
      if (!att.content) continue;
      const buf = toArrayBuffer(att.content as ArrayBuffer | Uint8Array);
      const mime = (att.mimeType || 'application/octet-stream').toLowerCase();
      const ok =
        mime.startsWith('image/') ||
        mime === 'application/pdf' ||
        /\.(jpe?g|png|webp|heic|pdf)$/i.test(att.filename || '');
      if (!ok) continue;
      if (buf.byteLength > 5 * 1024 * 1024) continue;
      attachments.push({
        filename: (att.filename || 'file').slice(0, 180),
        content_type: mime,
        content_base64: arrayBufferToBase64(buf),
      });
      if (attachments.length >= 5) break;
    }

    const res = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-inbound-secret': secret,
      },
      body: JSON.stringify({
        from_email: fromEmail,
        from_name: fromName,
        to_email: toEmail,
        subject: parsed.subject || message.headers.get('subject') || '(San sijè)',
        text,
        message_id: parsed.messageId || message.headers.get('message-id') || null,
        attachments,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[hatex-inbound] ingest fail', res.status, errText);
    }
  },
};
