import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { requireAdmin } from './_lib/auth';
import { json, assertPost, parseJson } from './_lib/http';
import { refundPayPalCapture } from './_lib/paypal';

type DisputeStatus = 'open' | 'investigating' | 'awaiting_response' | 'resolved' | 'closed';
type ResolutionType = '' | 'refund_full' | 'refund_partial' | 'replacement' | 'no_action' | 'seller_favor' | 'buyer_favor';

type Body = {
  disputeId?: string;
  status?: DisputeStatus;
  resolutionType?: ResolutionType;
  resolution?: string;
  refundAmount?: number | null;
};

const normalize = (value: unknown) => String(value || '').trim();
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const restorePayoutsAfterDispute = async (supabaseAdmin: any, orderId: string) => {
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso).getTime();

  const { data: ledgers } = await supabaseAdmin
    .from('payout_ledger')
    .select('id, hold_release_at, status')
    .eq('order_id', orderId)
    .eq('status', 'ON_HOLD_DISPUTE');

  for (const ledger of (ledgers as any[]) || []) {
    const holdReleaseAt = new Date(String((ledger as any)?.hold_release_at || ''));
    const nextStatus =
      Number.isFinite(holdReleaseAt.getTime()) && holdReleaseAt.getTime() <= now ? 'READY_TO_PAY' : 'PENDING_HOLD';

    await supabaseAdmin
      .from('payout_ledger')
      .update({ status: nextStatus, updated_at: nowIso } as any)
      .eq('id', String((ledger as any)?.id || ''));

    await supabaseAdmin
      .from('payout_snapshots')
      .update({ status: nextStatus, updated_at: nowIso } as any)
      .eq('ledger_id', String((ledger as any)?.id || ''))
      .eq('status', 'ON_HOLD_DISPUTE');
  }

  try {
    const { data: moneyRows } = await supabaseAdmin
      .from('order_money_ledger')
      .select('id, hold_until, status')
      .eq('order_id', orderId)
      .eq('status', 'on_hold_dispute');

    for (const row of (moneyRows as any[]) || []) {
      const holdUntil = new Date(String((row as any)?.hold_until || ''));
      const nextStatus =
        Number.isFinite(holdUntil.getTime()) && holdUntil.getTime() <= now ? 'ready' : 'held';

      await supabaseAdmin
        .from('order_money_ledger')
        .update({ status: nextStatus, updated_at: nowIso } as any)
        .eq('id', String((row as any)?.id || ''));
    }
  } catch {
    // Older environments may not have the itemized ledger.
  }
};

const cancelPayoutsAfterRefund = async (supabaseAdmin: any, orderId: string) => {
  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from('payout_ledger')
    .update({ status: 'CANCELED', updated_at: nowIso } as any)
    .eq('order_id', orderId)
    .in('status', ['PENDING_HOLD', 'READY_TO_PAY', 'ON_HOLD_DISPUTE']);

  await supabaseAdmin
    .from('payout_snapshots')
    .update({ status: 'CANCELED', updated_at: nowIso } as any)
    .eq('order_id', orderId)
    .in('status', ['PENDING_HOLD', 'READY_TO_PAY', 'ON_HOLD_DISPUTE']);

  try {
    await supabaseAdmin.rpc('record_order_money_ledger_reversal', {
      p_order_id: orderId,
      p_reason: 'dispute_refund',
      p_provider_capture_id: null,
    });
  } catch {
    await supabaseAdmin
      .from('order_money_ledger')
      .update({ status: 'cancelled', updated_at: nowIso } as any)
      .eq('order_id', orderId)
      .in('status', ['held', 'ready', 'on_hold_dispute', 'tracked']);
  }
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event as any);

    const body = parseJson<Body>(event.body);
    const disputeId = normalize(body?.disputeId);
    const status = normalize(body?.status).toLowerCase() as DisputeStatus;
    const resolutionType = normalize(body?.resolutionType).toLowerCase() as ResolutionType;
    const resolution = normalize(body?.resolution);
    const refundAmountInput = Number(body?.refundAmount);

    if (!disputeId) return json(400, { error: 'Missing disputeId' });
    if (!['open', 'investigating', 'awaiting_response', 'resolved', 'closed'].includes(status)) {
      return json(400, { error: 'Invalid status' });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: dispute } = await supabaseAdmin
      .from('disputes')
      .select('id, order_id')
      .eq('id', disputeId)
      .maybeSingle();

    if (!(dispute as any)?.id) return json(404, { error: 'Dispute not found' });
    const orderId = normalize((dispute as any)?.order_id);

    let order: any = null;
    if (orderId) {
      const { data: orderRow, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, payment_provider, provider_capture_id, total_charged, total_amount, currency, payment_status, status')
        .eq('id', orderId)
        .maybeSingle();
      if (orderError) return json(500, { error: 'Failed to load disputed order', details: orderError.message });
      order = orderRow;
    }

    const sellerWon = resolutionType === 'seller_favor' || resolutionType === 'no_action' || resolutionType === 'replacement';
    const buyerWon = resolutionType === 'buyer_favor' || resolutionType === 'refund_full' || resolutionType === 'refund_partial';

    // A buyer-favor resolution must actually refund the PayPal capture before the dispute
    // is marked resolved. This prevents Beezio from recording a refund that never happened.
    let providerRefund: any = null;
    let effectiveRefundAmount: number | null = null;

    if ((status === 'resolved' || status === 'closed') && buyerWon) {
      const provider = String(order?.payment_provider || '').trim().toUpperCase();
      const captureId = normalize(order?.provider_capture_id);
      if (provider !== 'PAYPAL' || !captureId) {
        return json(400, {
          error: 'This buyer-favor resolution cannot be completed because the order has no PayPal capture ID.',
          code: 'PAYPAL_CAPTURE_REQUIRED',
        });
      }

      const capturedTotal = Number(order?.total_charged ?? order?.total_amount);
      if (!(capturedTotal > 0)) {
        return json(400, { error: 'Unable to determine the captured PayPal amount for this order.', code: 'REFUND_AMOUNT_UNKNOWN' });
      }

      if (resolutionType === 'refund_partial') {
        if (!Number.isFinite(refundAmountInput) || refundAmountInput <= 0) {
          return json(400, { error: 'A positive refundAmount is required for a partial refund.' });
        }
        effectiveRefundAmount = roundMoney(refundAmountInput);
        if (effectiveRefundAmount > roundMoney(capturedTotal)) {
          return json(400, { error: 'Refund amount cannot exceed the captured order amount.' });
        }
      } else {
        // For a full refund, omit the amount so PayPal refunds the remaining capture balance.
        effectiveRefundAmount = roundMoney(capturedTotal);
      }

      try {
        providerRefund = await refundPayPalCapture({
          captureId,
          amount: resolutionType === 'refund_partial' ? effectiveRefundAmount : null,
          currency: String(order?.currency || 'USD'),
          note: `Beezio dispute ${disputeId}`,
        });
      } catch (refundError) {
        return json(502, {
          error: 'PayPal refund failed. The dispute was not marked resolved.',
          code: 'PAYPAL_REFUND_FAILED',
          details: refundError instanceof Error ? refundError.message : String(refundError),
        });
      }
    }

    const payload: Record<string, any> = {
      status,
      resolution_type: resolutionType || null,
      resolution: resolution || null,
      refund_amount: effectiveRefundAmount ?? (Number.isFinite(refundAmountInput) && refundAmountInput >= 0 ? roundMoney(refundAmountInput) : null),
      updated_at: new Date().toISOString(),
    };
    if (status === 'resolved' || status === 'closed') {
      payload.resolved_at = new Date().toISOString();
      payload.resolved_by = admin.profileId;
    }

    const { data: updated, error } = await supabaseAdmin
      .from('disputes')
      .update(payload as any)
      .eq('id', disputeId)
      .select('id, order_id, dispute_type, description, status, filed_by, filed_against, refund_amount, resolution, resolution_type, created_at, updated_at')
      .single();

    if (error || !updated) return json(400, { error: 'Failed to update dispute', details: error?.message || null });

    if (orderId && (status === 'resolved' || status === 'closed')) {
      if (sellerWon) {
        await supabaseAdmin
          .from('orders')
          .update({
            dispute_status: 'WON',
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', orderId);

        await restorePayoutsAfterDispute(supabaseAdmin, orderId);
      } else if (buyerWon) {
        await supabaseAdmin
          .from('orders')
          .update({
            dispute_status: 'LOST',
            status: 'refunded',
            payment_status: 'refunded',
            payment_finalized_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', orderId);

        await cancelPayoutsAfterRefund(supabaseAdmin, orderId);
      } else {
        await supabaseAdmin
          .from('orders')
          .update({
            dispute_status: status === 'closed' ? 'NONE' : 'OPEN',
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', orderId);
      }
    }

    return json(200, {
      ok: true,
      dispute: updated,
      provider_refund: providerRefund
        ? {
            id: providerRefund?.id || null,
            status: providerRefund?.status || null,
            amount: providerRefund?.amount || null,
          }
        : null,
    });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export default handler;
