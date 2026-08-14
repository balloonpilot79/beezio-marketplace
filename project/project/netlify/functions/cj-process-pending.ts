import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createUnpaidCJOrderForBeezioOrder } from './_lib/cj-fulfillment';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    'cj-process-pending: Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Set these in Netlify environment variables.'
  );
}

const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key'
);

export const config = { schedule: '*/5 * * * *' };

export const handler: Handler = async () => {
  const { data: pending, error } = await supabase
    .from('cj_orders')
    .select('beezio_order_id,cj_status,cj_order_id,next_attempt_at')
    .in('cj_status', ['awaiting_beezio_payment', 'create_failed'])
    .is('cj_order_id', null)
    .limit(50);

  if (error) {
    console.error('cj-process-pending: failed to query pending cj_orders:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to query pending CJ orders' }),
    };
  }

  const now = Date.now();
  const orderIds = (pending || [])
    .filter((row: any) => {
      const retryAt = Date.parse(String(row?.next_attempt_at || ''));
      return !Number.isFinite(retryAt) || retryAt <= now;
    })
    .map((row: any) => row.beezio_order_id)
    .filter(Boolean);
  let processed = 0;
  let succeeded = 0;
  let deferred = 0;
  let failed = 0;

  for (const orderId of orderIds) {
    processed += 1;
    try {
      const result = await createUnpaidCJOrderForBeezioOrder({ orderId, supabaseAdmin: supabase });
      if (result.skipped) deferred += 1;
      else succeeded += 1;
    } catch (e) {
      failed += 1;
      console.error('cj-process-pending: fulfillment invocation failed:', e instanceof Error ? e.message : e);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Processed pending CJ orders',
      total: orderIds.length,
      processed,
      succeeded,
      deferred,
      failed,
    }),
  };
};
