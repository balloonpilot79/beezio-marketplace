import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_lib/auth';
import { assertPost, json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { syncCJWebhookSubscriptions } from './_lib/cj-webhook-subscriptions';

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    await requireAdmin(event);
    const body = parseJson<{ cj_product_id?: string }>(event.body);
    const cjProductId = String(body?.cj_product_id || '').trim();
    if (!cjProductId) return json(400, { error: 'cj_product_id is required' });

    const result = await syncCJWebhookSubscriptions({
      supabaseAdmin: createSupabaseAdmin(),
      onlyProductIds: [cjProductId],
    });
    if (result.mappings_checked === 0) {
      return json(404, { error: 'No private CJ mapping exists for this product.' });
    }
    if (!result.ok) {
      return json(502, {
        error: 'CJ did not confirm this product subscription.',
        failed_product_ids: result.failed_product_ids,
      });
    }
    return json(200, result);
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, {
      error: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
};

export default handler;
