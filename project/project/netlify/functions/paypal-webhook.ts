import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';
import { verifyPayPalWebhookSignature } from './_lib/paypal';
import { recoverCompletedPayPalPayment } from './_lib/paypal-payment-recovery';
import { notifyDisputeParties } from './_lib/dispute-alerts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown) => UUID_REGEX.test(String(value || '').trim());

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : event.body || '';
  const supabaseAdmin = createSupabaseAdmin();

  try {
    const verified = await verifyPayPalWebhookSignature({ headers: event.headers as any, rawBody });
    if (!verified) return json(401, { error: 'Invalid webhook signature' });

    const payload = JSON.parse(rawBody);
    const eventId = String(payload?.id || '').trim();
    const eventType = String(payload?.event_type || '').trim();
    const resourceType = String(payload?.resource_type || '').trim();
    if (!eventId) return json(400, { error: 'Missing event id' });

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
      // Receipt is not proof of successful processing. A failed completion must
      // remain replayable when PayPal redelivers the same signed event.
      if (insertError.code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
        if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') return json(200, { ok: true, skipped: true });
      } else {
        return json(500, { error: insertError.message });
      }
    }

    const resource = payload?.resource || {};

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      await recoverCompletedPayPalPayment({ supabaseAdmin, resource });
    }

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
            .in('status', ['PENDING_HOLD', 'READY_TO_PAY', 'ON_HOLD_DISPUTE']);

          await supabaseAdmin
            .from('payout_snapshots')
            .update({ status: 'CANCELED', updated_at: new Date().toISOString() } as any)
            .eq('order_id', beezioOrderId)
            .in('status', ['PENDING_HOLD', 'READY_TO_PAY', 'ON_HOLD_DISPUTE']);

          try {
            const { error: reversalError } = await supabaseAdmin.rpc('record_order_money_ledger_reversal', {
              p_order_id: beezioOrderId,
              p_reason: 'refund',
              p_provider_capture_id: captureId,
            });
            if (reversalError) throw reversalError;
          } catch {
            await supabaseAdmin
              .from('order_money_ledger')
              .update({ status: 'cancelled', updated_at: new Date().toISOString() } as any)
              .eq('order_id', beezioOrderId)
              .in('status', ['held', 'ready', 'tracked', 'on_hold_dispute']);
          }

          // Provider-initiated refunds must also close and notify any open Beezio case.
          const { data: relatedDisputes } = await supabaseAdmin.from('disputes')
            .select('id').eq('order_id', beezioOrderId)
            .in('status', ['open', 'investigating', 'awaiting_response']);
          for (const item of relatedDisputes || []) {
            const { error: disputeUpdateError } = await supabaseAdmin.from('disputes').update({
              status: 'resolved', resolution_type: 'refund_full',
              resolution: 'Refund confirmed by PayPal webhook',
              resolved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any).eq('id', item.id);
            if (disputeUpdateError) throw disputeUpdateError;
            await notifyDisputeParties(supabaseAdmin, {
              disputeId: String(item.id), event: 'resolved', resolutionType: 'refund_full',
            });
          }
        }
      }
    }

    const isPayPalDisputeEvent = eventType.startsWith('CUSTOMER.DISPUTE.') ||
      eventType.startsWith('RISK.DISPUTE.');
    const providerDisputeClosed = eventType === 'CUSTOMER.DISPUTE.RESOLVED' ||
      ['RESOLVED', 'CLOSED'].includes(String(resource?.status || '').toUpperCase());
    // Resolved PayPal events must not reopen a dispute or re-freeze its earnings.
    if (isPayPalDisputeEvent && !providerDisputeClosed) {
      const disputed = Array.isArray(resource?.disputed_transactions) ? resource.disputed_transactions : [];
      const possibleTxnIds = disputed
        .flatMap((tx: any) => [tx?.seller_transaction_id, tx?.capture_id, tx?.transaction_id])
        .map((value: any) => String(value || '').trim())
        .filter(Boolean);

      const directOrderId = String(
        resource?.supplementary_data?.related_ids?.order_id || resource?.order_id || ''
      ).trim();
      const uniqueTxnIds = Array.from(new Set(possibleTxnIds));
      if (directOrderId) uniqueTxnIds.push(directOrderId);

      for (const txnId of Array.from(new Set(uniqueTxnIds))) {
        let orderRow: any = null;

        const providerLookup = await supabaseAdmin
          .from('orders')
          .select('id, buyer_id, seller_id')
          .or(`provider_capture_id.eq.${txnId},provider_order_id.eq.${txnId}`)
          .maybeSingle();
        orderRow = providerLookup.data || null;

        // Only query the UUID primary key when the incoming value is actually a UUID.
        if (!orderRow && isUuid(txnId)) {
          const { data } = await supabaseAdmin
            .from('orders')
            .select('id, buyer_id, seller_id')
            .eq('id', txnId)
            .maybeSingle();
          orderRow = data || null;
        }

        const beezioOrderId = orderRow?.id ? String(orderRow.id) : null;
        if (!beezioOrderId) continue;

        await supabaseAdmin
          .from('orders')
          .update({ dispute_status: 'OPEN', updated_at: new Date().toISOString() } as any)
          .eq('id', beezioOrderId);

        const { data: existingDispute } = await supabaseAdmin
          .from('disputes')
          .select('id')
          .eq('order_id', beezioOrderId)
          .in('status', ['open', 'investigating', 'awaiting_response'])
          .limit(1)
          .maybeSingle();

        let activeDisputeId = String((existingDispute as any)?.id || '');
        if (!activeDisputeId && orderRow?.buyer_id) {
          const { data: newCase, error: createCaseError } = await supabaseAdmin.from('disputes').insert({
            order_id: beezioOrderId,
            dispute_type: 'other',
            filed_by: orderRow.buyer_id,
            filed_against: orderRow.seller_id || null,
            description: `PayPal dispute ${eventId} (${eventType}). Review the PayPal event in webhook history and respond through the Beezio Issue Center.`,
            status: 'open',
          } as any).select('id').single();
          if (createCaseError) throw createCaseError;
          activeDisputeId = String(newCase?.id || '');
        }

        await supabaseAdmin
          .from('payout_ledger')
          .update({ status: 'ON_HOLD_DISPUTE', updated_at: new Date().toISOString() } as any)
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

        if (activeDisputeId) await notifyDisputeParties(supabaseAdmin, {
          disputeId: activeDisputeId, event: 'opened',
        });
      }
    }

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export default handler;
