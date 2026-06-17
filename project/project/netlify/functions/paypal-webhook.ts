import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';
import { verifyPayPalWebhookSignature } from './_lib/paypal';
import { getSiteUrl } from './_lib/site';
import { finalizePayPalOrderPayment } from './_lib/paypal-order-finalization';

export const handler: Handler = async (event) => {
  // PayPal webhooks send POSTs.
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
  const supabaseAdmin = createSupabaseAdmin();

  try {
    const verified = await verifyPayPalWebhookSignature({ headers: event.headers as any, rawBody });
    if (!verified) {
      // Security: reject unverifiable webhooks.
      return json(401, { error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody);
    const eventId = String(payload?.id || '').trim();
    const eventType = String(payload?.event_type || '').trim();
    const resourceType = String(payload?.resource_type || '').trim();

    if (!eventId) return json(400, { error: 'Missing event id' });

    // Idempotency: insert event row; if duplicate, ignore.
    const { error: insertError } = await supabaseAdmin
      .from('paypal_webhook_events')
      .insert({
        event_id: eventId,
        event_type: eventType || null,
        resource_type: resourceType || null,
        raw_json: payload,
      } as any);

    if (insertError) {
      const msg = String(insertError.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        return json(200, { ok: true, skipped: true });
      }
      return json(500, { error: insertError.message });
    }

    // Minimal reconciliation handlers (best-effort)
    const resource = payload?.resource || {};

    // Capture completed
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const captureId = String(resource?.id || '').trim();
      const orderId = String(resource?.supplementary_data?.related_ids?.order_id || '').trim();
      const rawPayPalFee = Number(resource?.seller_receivable_breakdown?.paypal_fee?.value);
      const paypalFeeAmount = Number.isFinite(rawPayPalFee) && rawPayPalFee >= 0
        ? Math.round((rawPayPalFee + Number.EPSILON) * 100) / 100
        : null;

      if (orderId) {
        const { data: existingOrder } = await supabaseAdmin
          .from('orders')
          .select('id, paid_at')
          .eq('provider_order_id', orderId)
          .maybeSingle();
        const existingPaidAt = String((existingOrder as any)?.paid_at || '').trim();
        const paidAt = existingPaidAt || new Date().toISOString();

        const { data: updatedOrders } = await supabaseAdmin
          .from('orders')
          .update({
            payment_provider: 'PAYPAL',
            provider_order_id: orderId,
            provider_capture_id: captureId || null,
            payment_status: 'paid',
            status: 'completed',
            ...(existingPaidAt ? {} : { paid_at: paidAt }),
          } as any)
          .eq('provider_order_id', orderId)
          .select('id');

        const beezioOrderId = String((updatedOrders as any)?.[0]?.id || '').trim();
        if (beezioOrderId) {
          try {
            await finalizePayPalOrderPayment({
              supabaseAdmin,
              orderId: beezioOrderId,
              providerOrderId: orderId,
              providerCaptureId: captureId || null,
              paypalFeeAmount,
              paidAt,
            });
          } catch {
            const siteUrl = getSiteUrl();
            if (siteUrl) {
              try {
                await fetch(`${siteUrl.replace(/\/$/, '')}/.netlify/functions/paypal-capture-order`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderID: orderId }),
                });
              } catch {
                // Best-effort recovery only. Webhook reconciliation should not fail on this call.
              }
            }
          }
        }
      }
    }

    // Refunds: best-effort freeze/cancel payouts
    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const refundLinks = Array.isArray(resource?.links) ? resource.links : [];
      const captureId = String(
        resource?.supplementary_data?.related_ids?.capture_id ||
        refundLinks.find((link: any) => String(link?.rel || '').toLowerCase() === 'up')?.href?.split('/')?.pop?.() ||
        resource?.id ||
        ''
      ).trim();
      if (captureId) {
        const { data: orderRow } = await supabaseAdmin
          .from('orders')
          .select('id')
          .eq('provider_capture_id', captureId)
          .maybeSingle();
        const beezioOrderId = (orderRow as any)?.id ? String((orderRow as any).id) : null;
        if (beezioOrderId) {
          await supabaseAdmin
            .from('orders')
            .update({ status: 'refunded', payment_status: 'refunded' } as any)
            .eq('id', beezioOrderId);

          await supabaseAdmin
            .from('payout_ledger')
            .update({ status: 'CANCELED' } as any)
            .eq('order_id', beezioOrderId)
            .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);

          await supabaseAdmin
            .from('payout_snapshots')
            .update({ status: 'CANCELED', updated_at: new Date().toISOString() } as any)
            .eq('order_id', beezioOrderId)
            .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);

          try {
            await supabaseAdmin.rpc('record_order_money_ledger_reversal', {
              p_order_id: beezioOrderId,
              p_reason: 'refund',
              p_provider_capture_id: captureId,
            });
          } catch {
            await supabaseAdmin
              .from('order_money_ledger')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() } as any)
              .eq('order_id', beezioOrderId)
              .in('status', ['held', 'ready', 'tracked']);
          }
        }
      }
    }

    // Disputes: freeze payouts
    if (eventType.startsWith('CUSTOMER.DISPUTE.') || eventType.startsWith('RISK.DISPUTE.')) {
      const disputed = Array.isArray(resource?.disputed_transactions) ? resource.disputed_transactions : [];
      const possibleTxnIds = disputed
        .map((tx: any) => String(tx?.seller_transaction_id || '').trim())
        .filter(Boolean);

      // Some dispute payloads use capture/transaction ids; others use order ids.
      for (const txnId of possibleTxnIds) {
        const { data: orderRow } = await supabaseAdmin
          .from('orders')
          .select('id')
          .or(`provider_capture_id.eq.${txnId},provider_order_id.eq.${txnId}`)
          .maybeSingle();

        const beezioOrderId = (orderRow as any)?.id ? String((orderRow as any).id) : null;
        if (!beezioOrderId) continue;

        await supabaseAdmin
          .from('orders')
          .update({ dispute_status: 'OPEN' } as any)
          .eq('id', beezioOrderId);

        await supabaseAdmin
          .from('payout_ledger')
          .update({ status: 'ON_HOLD_DISPUTE' } as any)
          .eq('order_id', beezioOrderId)
          .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);

        await supabaseAdmin
          .from('payout_snapshots')
          .update({ status: 'ON_HOLD_DISPUTE', updated_at: new Date().toISOString() } as any)
          .eq('order_id', beezioOrderId)
          .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);

        await supabaseAdmin
          .from('order_money_ledger')
          .update({ status: 'on_hold_dispute', updated_at: new Date().toISOString() } as any)
          .eq('order_id', beezioOrderId)
          .in('status', ['held', 'ready']);
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
