import type { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { json } from './_lib/http';
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
  const computed = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return computed === signature || computed === signature.toLowerCase();
}

export const handler: Handler = async (event) => {
  try {
    const rawBody = getRawBody(event);
    const signature =
      String(event.headers['x-pfy-signature'] || event.headers['x-printify-signature'] || '').trim();
    const secret = String(process.env.PRINTIFY_WEBHOOK_SECRET || '').trim();
    if (secret && signature && !verifySignature(rawBody, signature, secret)) {
      return json(401, { error: 'Invalid signature' });
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const orderId =
      String(payload?.data?.id || payload?.data?.order_id || payload?.order_id || payload?.id || '').trim();
    const status = String(payload?.data?.status || payload?.status || '').trim().toLowerCase();
    const topic = String(payload?.type || payload?.event || payload?.topic || '').trim().toLowerCase();

    const supabaseAdmin = createSupabaseAdmin();

    let beezioOrderId: string | null = null;
    if (orderId) {
      const { data: vendorRow } = await supabaseAdmin
        .from('vendor_orders')
        .select('order_id')
        .eq('vendor_id', 'printify')
        .eq('vendor_order_id', orderId)
        .maybeSingle();
      beezioOrderId = String((vendorRow as any)?.order_id || '').trim() || null;

      await supabaseAdmin
        .from('vendor_orders')
        .update({ status: status || 'processing', vendor_response: payload, updated_at: new Date().toISOString() })
        .eq('vendor_id', 'printify')
        .eq('vendor_order_id', orderId);
    }

    let fulfillmentStatus: string | null = null;
    if (status.includes('delivered') || topic.includes('delivered')) fulfillmentStatus = 'delivered';
    if (status.includes('shipped') || topic.includes('sent_to_production')) fulfillmentStatus = 'shipped';
    if (status.includes('canceled') || status.includes('cancelled')) fulfillmentStatus = 'cancelled';

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
