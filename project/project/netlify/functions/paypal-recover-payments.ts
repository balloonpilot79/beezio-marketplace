import type { Config } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { recoverCompletedPayPalPayment } from './_lib/paypal-payment-recovery';

// Independent of the buyer's browser. Never captures funds or issues payouts.
export default async () => {
  const supabaseAdmin = createSupabaseAdmin();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: events, error } = await supabaseAdmin.from('paypal_webhook_events')
    .select('raw_json').eq('event_type', 'PAYMENT.CAPTURE.COMPLETED')
    .gte('received_at', since).order('received_at', { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  const providerIds = [...new Set((events || []).map(row => String(row.raw_json?.resource?.supplementary_data?.related_ids?.order_id || '')).filter(Boolean))];
  if (!providerIds.length) return new Response('No payments to reconcile');
  const { data: orders, error: orderError } = await supabaseAdmin.from('orders')
    .select('id,provider_order_id,payment_status').in('provider_order_id', providerIds);
  if (orderError) throw new Error(orderError.message);
  const orderIds = (orders || []).map(order => order.id);
  const { data: ledger, error: ledgerError } = orderIds.length
    ? await supabaseAdmin.from('order_money_ledger').select('order_id').in('order_id', orderIds)
    : { data: [], error: null };
  if (ledgerError) throw new Error(ledgerError.message);
  const { data: snapshots, error: snapshotError } = orderIds.length
    ? await supabaseAdmin.from('payout_snapshots').select('order_id').in('order_id', orderIds)
    : { data: [], error: null };
  if (snapshotError) throw new Error(snapshotError.message);
  const mirrored = new Set((snapshots || []).map(row => row.order_id));
  const accounted = new Set((ledger || []).map(row => row.order_id));
  const byProvider = new Map((orders || []).map(order => [order.provider_order_id, order]));
  let attempted = 0;
  const started = Date.now();
  // Rotate the bounded candidate window each run so permanently broken events
  // cannot consume every attempt ahead of older valid payments.
  const candidates = events || [];
  const offset = (Math.floor(Date.now() / 600000) * 10) % candidates.length;
  const rotated = [...candidates.slice(offset), ...candidates.slice(0, offset)];
  for (const event of rotated) {
    const resource = event.raw_json?.resource;
    const providerId = String(resource?.supplementary_data?.related_ids?.order_id || '');
    const order = byProvider.get(providerId);
    if (order && order.payment_status === 'paid' && accounted.has(order.id) && mirrored.has(order.id)) continue;
    if (attempted >= 10 || Date.now() - started > 20000) break;
    attempted += 1;
    try {
      await recoverCompletedPayPalPayment({ supabaseAdmin, resource });
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'Payment recovery failed';
      console.error('[paypal-recover-payments] manual review required', { provider_order_id: providerId, error: message });
      const { error: logError } = await supabaseAdmin.from('integration_logs').insert({
        integration_id: null, action: 'payment_recovery_required', status: 'error',
        metadata: { order_id: order?.id || null, provider_order_id: providerId, error: message },
      });
      if (logError) console.error('[paypal-recover-payments] could not save recovery alert', logError.message);
    }
  }
  return new Response(JSON.stringify({ attempted }), { headers: { 'Content-Type': 'application/json' } });
};
export const config: Config = { schedule: '*/10 * * * *' };
