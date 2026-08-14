import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { cjRequest, getCJOrderDetail } from './_lib/cj-api';
import { parseCJUsd } from '../../shared/cjContract';

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const retryAt = (attempt: number) => new Date(Date.now() + Math.min(60, 5 * Math.max(1, attempt)) * 60_000).toISOString();

function candidateValue(...values: unknown[]): string {
  for (const value of values) {
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return '';
}

function isPaidBeezioOrder(order: any): boolean {
  const paymentStatus = text(order?.payment_status).toLowerCase();
  const status = text(order?.status).toLowerCase();
  return paymentStatus === 'paid' || status === 'completed';
}

function isBlockedBeezioOrder(order: any): boolean {
  const values = [order?.payment_status, order?.status, order?.fulfillment_status]
    .map((value) => text(value).toLowerCase());
  return values.some((value) => [
    'cancelled', 'canceled', 'refunded', 'refund', 'voided', 'failed', 'disputed', 'chargeback',
  ].includes(value));
}

function isUnpaidCJStatus(value: unknown): boolean {
  const status = text(value).toUpperCase();
  return !status || ['CREATED', 'IN_CART', 'UNPAID'].includes(status);
}

export const handler: Handler = async (event) => {
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  if (!serviceRoleKey || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const supabase = createSupabaseAdmin();
  const { data: settings, error: settingsError } = await supabase
    .from('cj_fulfillment_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (settingsError) return { statusCode: 202, body: '' };

  if (settings?.sandbox_required !== false && settings?.sandbox_verified !== true) return { statusCode: 202, body: '' };
  if (settings?.auto_pay_enabled !== true) return { statusCode: 202, body: '' };

  const minimumReserve = Math.max(0, Number(settings?.min_balance_reserve || 0));
  const maxOrderCost = Math.max(0, Number(settings?.max_auto_pay_order || 0));
  const maxIncreasePct = Math.max(0, Number(settings?.max_cost_increase_pct || 0));

  const balanceRaw: any = await cjRequest('shopping/pay/getBalance', {}, 'GET');
  let availableBalance = money(balanceRaw?.data?.amount ?? balanceRaw?.amount ?? 0);
  if (!(availableBalance >= 0)) return { statusCode: 202, body: '' };

  const now = new Date().toISOString();
  const { data: queued, error: queueError } = await supabase
    .from('cj_orders')
    .select('*')
    .eq('cj_status', 'unpaid')
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(10);
  if (queueError || !queued?.length) return { statusCode: 202, body: '' };

  for (const cjOrder of queued as any[]) {
    const attempt = Math.max(0, Number(cjOrder?.auto_pay_attempt_count || 0)) + 1;
    const decision: Record<string, any> = {
      checked_at: new Date().toISOString(),
      available_balance_before: availableBalance,
      min_balance_reserve: minimumReserve,
      max_auto_pay_order: maxOrderCost,
      max_cost_increase_pct: maxIncreasePct,
    };

    try {
      const { data: beezioOrder, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', cjOrder.beezio_order_id)
        .maybeSingle();
      if (orderError || !beezioOrder) throw new Error(orderError?.message || 'Beezio order not found for CJ auto-pay.');
      if (isBlockedBeezioOrder(beezioOrder)) throw new Error('Beezio order is cancelled/refunded/voided/disputed; CJ auto-pay blocked.');
      if (!isPaidBeezioOrder(beezioOrder)) throw new Error('Beezio payment is not captured; CJ auto-pay blocked.');

      const baselineCost = money(cjOrder?.cj_cost || 0);
      if (!(baselineCost > 0)) throw new Error('Stored CJ order cost is missing; auto-pay blocked.');
      if (maxOrderCost > 0 && baselineCost > maxOrderCost) {
        throw new Error(`CJ order cost $${baselineCost.toFixed(2)} exceeds auto-pay limit $${maxOrderCost.toFixed(2)}.`);
      }

      const orderId = text(cjOrder?.cj_order_id);
      if (!orderId) throw new Error('CJ order id is missing; auto-pay blocked.');
      const detail = await getCJOrderDetail(orderId);
      if (Number(detail?.isSandbox ?? 0) === 1) throw new Error('Real auto-pay worker refused a sandbox order.');
      if (!isUnpaidCJStatus(detail?.orderStatus || detail?.status || cjOrder?.cj_status)) {
        const currentStatus = text(detail?.orderStatus || detail?.status || cjOrder?.cj_status).toLowerCase();
        if (['pending', 'processing', 'unshipped', 'shipped', 'delivered', 'paid'].includes(currentStatus)) {
          await supabase.from('cj_orders').update({
            cj_status: currentStatus === 'paid' ? 'paid' : currentStatus,
            auto_pay_error: null,
            auto_pay_decision: { ...decision, skipped: 'already_paid_or_processing', cj_status: currentStatus },
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', cjOrder.id);
          continue;
        }
        throw new Error(`CJ order is not payable from status ${currentStatus || 'unknown'}.`);
      }

      const liveCost = money(
        parseCJUsd(detail?.actualPayment) ||
        parseCJUsd(detail?.orderAmount) ||
        parseCJUsd(detail?.payAmount) ||
        baselineCost
      );
      decision.baseline_cost = baselineCost;
      decision.live_cost = liveCost;
      const allowedCost = money(baselineCost * (1 + maxIncreasePct / 100));
      decision.allowed_cost = allowedCost;
      if (liveCost > allowedCost + 0.01) {
        throw new Error(`CJ live cost increased to $${liveCost.toFixed(2)} above allowed $${allowedCost.toFixed(2)}.`);
      }
      if (maxOrderCost > 0 && liveCost > maxOrderCost) {
        throw new Error(`CJ live cost $${liveCost.toFixed(2)} exceeds auto-pay limit $${maxOrderCost.toFixed(2)}.`);
      }
      if (availableBalance - liveCost < minimumReserve) {
        throw new Error(`CJ balance reserve protection blocked payment: $${availableBalance.toFixed(2)} available, $${minimumReserve.toFixed(2)} reserve required.`);
      }

      const responseData = cjOrder?.response_data && typeof cjOrder.response_data === 'object' ? cjOrder.response_data : {};
      const shipmentOrderId = candidateValue(
        cjOrder?.shipment_order_id,
        responseData?.shipmentOrderId,
        responseData?.shipmentOrderNumber,
        detail?.shipmentOrderId,
        detail?.shipmentOrderNumber
      );
      const payId = candidateValue(cjOrder?.cj_pay_id, responseData?.payId, detail?.payId);

      let payResponse: any;
      if (shipmentOrderId) {
        payResponse = await cjRequest('shopping/pay/payBalanceV2', {
          shipmentOrderId,
          ...(payId ? { payId } : {}),
        }, 'POST');
      } else {
        payResponse = await cjRequest('shopping/pay/payBalance', { orderId }, 'POST');
      }
      if (payResponse?.result === false) throw new Error(payResponse?.message || 'CJ balance payment failed.');

      const paidAt = new Date().toISOString();
      decision.payment_method = shipmentOrderId ? 'payBalanceV2' : 'payBalance';
      decision.shipment_order_id = shipmentOrderId || null;
      decision.pay_id = payId || null;
      decision.available_balance_after_estimate = money(availableBalance - liveCost);
      decision.result = 'paid';

      await supabase.from('cj_orders').update({
        cj_status: 'paid',
        shipment_order_id: shipmentOrderId || cjOrder?.shipment_order_id || null,
        cj_pay_id: payId || cjOrder?.cj_pay_id || null,
        actual_payment: liveCost,
        auto_pay_attempt_count: attempt,
        auto_pay_error: null,
        auto_paid_at: paidAt,
        auto_pay_decision: decision,
        next_attempt_at: null,
        last_synced_at: paidAt,
        updated_at: paidAt,
      }).eq('id', cjOrder.id);

      await supabase.from('orders').update({
        fulfillment_status: 'processing',
        updated_at: paidAt,
      }).eq('id', cjOrder.beezio_order_id);

      availableBalance = money(availableBalance - liveCost);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attemptedAt = new Date().toISOString();
      await supabase.from('cj_orders').update({
        auto_pay_attempt_count: attempt,
        auto_pay_error: message,
        auto_pay_decision: { ...decision, result: 'blocked_or_failed', error: message },
        next_attempt_at: retryAt(attempt),
        updated_at: attemptedAt,
      }).eq('id', cjOrder.id);
    }
  }

  return { statusCode: 202, body: '' };
};

export default handler;
