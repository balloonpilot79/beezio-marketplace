import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import crypto from 'crypto';
import { createSupabaseAdmin } from './_lib/supabase';

function getRawBody(event: any): string {
  if (!event.body) return '';
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, 'base64').toString('utf8');
  }
  return event.body;
}

function verifySignature(raw: string, signature: string, secret: string): boolean {
  if (!raw || !signature || !secret) return false;
  const normalized = String(signature || '')
    .trim()
    .replace(/^sha256=/i, '')
    .replace(/^"|"$/g, '');

  const digest = crypto.createHmac('sha256', secret).update(raw, 'utf8').digest();
  const computedHex = digest.toString('hex');
  const computedBase64 = digest.toString('base64');

  const candidates = [computedHex, computedHex.toLowerCase(), computedBase64];
  return candidates.some((candidate) => {
    if (candidate.length !== normalized.length) return candidate === normalized;
    try {
      return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(normalized));
    } catch {
      return candidate === normalized;
    }
  });
}

export const handler: Handler = async (event) => {
  try {
    const rawBody = getRawBody(event);
    const signature = String(event.headers['x-pf-signature'] || event.headers['x-printful-signature'] || '').trim();
    const secret = String(process.env.PRINTFUL_WEBHOOK_SECRET || '').trim();
    if (secret && signature && !verifySignature(rawBody, signature, secret)) {
      return json(401, { error: 'Invalid signature' });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};

    const orderId =
      String(
        payload?.data?.order?.id ||
          payload?.data?.order_id ||
          payload?.order_id ||
          payload?.data?.id ||
          payload?.id ||
          ''
      ).trim();

    const type = String(payload?.type || payload?.event || '').trim().toLowerCase();
    const status = String(payload?.data?.order?.status || payload?.status || '').trim().toLowerCase();

    const supabaseAdmin = createSupabaseAdmin();

    let beezioOrderId: string | null = null;
    if (orderId) {
      const { data: vendorRow } = await supabaseAdmin
        .from('vendor_orders')
        .select('order_id')
        .eq('vendor_id', 'printful')
        .eq('vendor_order_id', orderId)
        .maybeSingle();
      beezioOrderId = String((vendorRow as any)?.order_id || '').trim() || null;

      await supabaseAdmin
        .from('vendor_orders')
        .update({ status: status || 'processing', vendor_response: payload, updated_at: new Date().toISOString() })
        .eq('vendor_id', 'printful')
        .eq('vendor_order_id', orderId);
    }

    let fulfillmentStatus: string | null = null;
    if (type.includes('package_shipped')) fulfillmentStatus = 'shipped';
    if (type.includes('order_failed') || type.includes('order_canceled')) fulfillmentStatus = 'cancelled';
    if (status.includes('delivered')) fulfillmentStatus = 'delivered';

    if (beezioOrderId && fulfillmentStatus) {
      await supabaseAdmin
        .from('orders')
        .update({ fulfillment_status: fulfillmentStatus, updated_at: new Date().toISOString() })
        .eq('id', beezioOrderId);
    }

    return json(200, { ok: true });
  } catch (e: any) {
    return json(500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
