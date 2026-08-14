import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { createUnpaidCJOrderForBeezioOrder } from './_lib/cj-fulfillment';
import { assertPost, json, parseJson } from './_lib/http';

type FulfillBody = { orderId?: string };

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event as any);
    const body = parseJson<FulfillBody>(event.body);
    const orderId = String(body?.orderId || '').trim();
    if (!orderId) return json(400, { error: 'Order ID required' });

    const result = await createUnpaidCJOrderForBeezioOrder({ orderId });
    return json(200, result);
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 500;
    return json(statusCode, {
      error: error instanceof Error ? error.message : 'CJ fulfillment failed',
    });
  }
};

export default handler;
