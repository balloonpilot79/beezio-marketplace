import type { Handler } from '@netlify/functions';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCJOpenId } from './_lib/cj-api';
import { createSupabaseAdmin } from './_lib/supabase';

const response = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const text = (value: unknown): string => String(value ?? '').trim();

export function computeCJWebhookSignature(rawBody: string | Buffer, openId: string): string {
  return createHmac('sha256', openId).update(rawBody).digest('base64');
}

export function verifyCJWebhookSignature(rawBody: string | Buffer, signature: string, openId: string): boolean {
  const supplied = Buffer.from(text(signature));
  const expected = Buffer.from(computeCJWebhookSignature(rawBody, openId));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });
  const supabaseAdmin = createSupabaseAdmin();
  let openId = text(process.env.CJ_OPEN_ID);
  if (!openId) {
    const { data: cachedToken } = await supabaseAdmin
      .from('cj_tokens')
      .select('open_id')
      .eq('id', 1)
      .maybeSingle();
    openId = text(cachedToken?.open_id);
  }
  if (!openId) {
    try {
      openId = text(await getCJOpenId());
    } catch (error) {
      console.error('CJ webhook openId lookup failed:', error instanceof Error ? error.message : error);
    }
  }
  if (!openId) return response(503, { error: 'CJ webhook verification is not configured' });

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8');
  const signature = text(event.headers?.sign || event.headers?.Sign || event.headers?.SIGN);
  if (!signature || !verifyCJWebhookSignature(rawBody, signature, openId)) {
    return response(401, { error: 'Invalid CJ webhook signature' });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return response(400, { error: 'Invalid JSON' });
  }

  const messageId = text(payload?.messageId);
  const eventType = text(payload?.type).toUpperCase();
  const messageType = text(payload?.messageType).toUpperCase();
  if (!messageId || !eventType) return response(400, { error: 'Invalid CJ webhook envelope' });

  const { error: eventInsertError } = await supabaseAdmin.from('cj_webhook_events').insert({
    message_id: messageId,
    event_type: eventType,
    message_type: messageType || null,
    payload,
  });
  if (eventInsertError?.code === '23505') {
    return response(200, { code: 200, result: 'success', message: 'duplicate' });
  }
  if (eventInsertError) return response(500, { error: eventInsertError.message });

  // CJ requires a response within three seconds. Persistence is the webhook's
  // acknowledgement boundary; the scheduled processor applies order, tracking,
  // and stock updates without risking CJ retry storms.
  return response(200, { code: 200, result: 'success', message: 'accepted' });
};

export default handler;
