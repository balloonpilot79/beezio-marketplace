import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { handler as fulfillCjOrderHandler } from './cj-fulfill-order';

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

export const config = {
  // Process deferred CJ orders (e.g. waiting for Stripe funds to clear) every 15 minutes.
  schedule: '*/15 * * * *',
};

export const handler: Handler = async () => {
  const { data: pending, error } = await supabase
    .from('cj_orders')
    .select('beezio_order_id,cj_status,cj_order_id')
    .eq('cj_status', 'waiting_funds')
    .is('cj_order_id', null)
    .limit(20);

  if (error) {
    console.error('cj-process-pending: failed to query pending cj_orders:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to query pending CJ orders' }),
    };
  }

  const orderIds = (pending || []).map((row: any) => row.beezio_order_id).filter(Boolean);
  let processed = 0;
  let succeeded = 0;
  let deferred = 0;
  let failed = 0;

  for (const orderId of orderIds) {
    processed += 1;
    try {
      const res: any = await fulfillCjOrderHandler({
        httpMethod: 'POST',
        body: JSON.stringify({ orderId }),
        headers: {},
      } as any);

      const code = Number(res?.statusCode || 0);
      if (code === 200) succeeded += 1;
      else if (code === 202) deferred += 1;
      else failed += 1;
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

