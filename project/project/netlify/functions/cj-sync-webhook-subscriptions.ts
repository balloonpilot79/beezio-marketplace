import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { syncCJWebhookSubscriptions } from './_lib/cj-webhook-subscriptions';

export const config = { schedule: '@hourly' };

export const handler: Handler = async () => {
  try {
    const result = await syncCJWebhookSubscriptions({
      supabaseAdmin: createSupabaseAdmin(),
    });
    return json(result.ok ? 200 : 502, result);
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
};

export default handler;
