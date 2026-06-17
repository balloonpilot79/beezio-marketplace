import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, requireAdmin, resolveProfileId } from './_lib/auth';
import { writeAuditLog } from './_lib/audit';
import { json, assertPost, parseJson } from './_lib/http';
import { getPayPalAccessToken, getPayPalBaseUrl } from './_lib/paypal';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  orderId?: string;
  providerCaptureId?: string;
  providerOrderId?: string;
  paymentIntentId?: string;
  referenceId?: string;
  reason?: string;
  amount?: number;
};

const normalize = (value: unknown) => String(value || '').trim();
const isUuid = (value: string) => UUID_REGEX.test(value);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const logAccountRefundHistory = async (
  supabaseAdmin: any,
  params: {
    order: any;
    actorProfileId: string | null;
    refundId: string | null;
    amount?: number;
    reason: string;
  }
) => {
  const rows = [
    {
      subject_profile_id: normalize(params.order?.buyer_id),
      subject_role: 'buyer',
      counterparty_profile_id: normalize(params.order?.seller_id) || null,
      counterparty_role: normalize(params.order?.seller_id) ? 'seller' : null,
    },
    {
      subject_profile_id: normalize(params.order?.seller_id),
      subject_role: 'seller',
      counterparty_profile_id: normalize(params.order?.buyer_id) || null,
      counterparty_role: normalize(params.order?.buyer_id) ? 'buyer' : null,
    },
  ].filter((row) => row.subject_profile_id);

  if (!rows.length) return;

  await supabaseAdmin.from('account_refund_history').insert(
    rows.map((row) => ({
      order_id: String(params.order.id),
      order_number: normalize(params.order?.order_number) || null,
      subject_profile_id: row.subject_profile_id,
      subject_role: row.subject_role,
      counterparty_profile_id: row.counterparty_profile_id,
      counterparty_role: row.counterparty_role,
      actor_profile_id: params.actorProfileId || null,
      refund_id: params.refundId,
      refund_amount: Number.isFinite(params.amount) && Number(params.amount) > 0 ? roundMoney(Number(params.amount)) : null,
      currency: normalize(params.order?.currency) || 'USD',
      refund_reason: params.reason,
      provider_order_id: normalize(params.order?.provider_order_id) || null,
      provider_capture_id: normalize(params.order?.provider_capture_id) || null,
      payment_status_before: normalize(params.order?.payment_status) || null,
      order_status_before: normalize(params.order?.status) || null,
      metadata: {
        source: 'admin_refund',
        total_charged: Number(params.order?.total_charged || 0) || null,
      },
    }))
  );
};

const cancelOrderPayoutsForRefund = async (supabaseAdmin: any, orderId: string, providerCaptureId: string) => {
  const nowIso = new Date().toISOString();

  await supabaseAdmin
    .from('orders')
    .update({
      status: 'refunded',
      payment_status: 'refunded',
      dispute_status: 'LOST',
      updated_at: nowIso,
    } as any)
    .eq('id', orderId);

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
      p_reason: 'refund',
      p_provider_capture_id: providerCaptureId,
    });
  } catch {
    await supabaseAdmin
      .from('order_money_ledger')
      .update({ status: 'cancelled', updated_at: nowIso } as any)
      .eq('order_id', orderId)
      .in('status', ['held', 'ready', 'tracked', 'on_hold_dispute']);
  }
};

const refundPayPalCapture = async (params: {
  captureId: string;
  currency: string;
  amount?: number;
  note?: string;
}) => {
  const accessToken = await getPayPalAccessToken();
  const baseUrl = await getPayPalBaseUrl();

  const body: Record<string, unknown> = {};
  if (Number.isFinite(params.amount) && Number(params.amount) > 0) {
    body.amount = {
      currency_code: String(params.currency || 'USD').toUpperCase(),
      value: roundMoney(Number(params.amount)).toFixed(2),
    };
  }
  if (params.note) body.note_to_payer = String(params.note).slice(0, 255);

  const res = await fetch(`${baseUrl}/v2/payments/captures/${encodeURIComponent(params.captureId)}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((data as any)?.details?.[0]?.description || (data as any)?.message || 'PayPal refund failed'));
  }

  return {
    refundId: normalize((data as any)?.id) || null,
    status: normalize((data as any)?.status) || null,
  };
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const authHeader = extractAuthHeader(event as any);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });

    const body = parseJson<Body>(event.body);
    const candidateIds = [
      normalize(body?.orderId),
      normalize(body?.providerCaptureId),
      normalize(body?.providerOrderId),
      normalize(body?.referenceId),
      normalize(body?.paymentIntentId),
    ].filter(Boolean);
    if (!candidateIds.length) return json(400, { error: 'referenceId required' });

    const refundAmount = Number(body?.amount);
    const supabaseAdmin = createSupabaseAdmin();

    let isAdmin = false;
    try {
      await requireAdmin(event as any);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    const profileId = (await resolveProfileId(user as any)) || String(user.id);
    const selectOrder = async (column: 'id' | 'provider_capture_id' | 'provider_order_id', value: string) =>
      await supabaseAdmin
        .from('orders')
        .select('id, order_number, user_id, buyer_id, seller_id, provider_order_id, provider_capture_id, payment_status, status, currency, total_charged')
        .eq(column, value)
        .maybeSingle();

    let orderLookup: any = { data: null, error: null };
    for (const candidateId of candidateIds) {
      if (!orderLookup.data && isUuid(candidateId)) orderLookup = await selectOrder('id', candidateId);
      if (!orderLookup.data) orderLookup = await selectOrder('provider_capture_id', candidateId);
      if (!orderLookup.data) orderLookup = await selectOrder('provider_order_id', candidateId);
      if (orderLookup.data) break;
    }

    const order = orderLookup.data as any;
    if (!order?.id) return json(404, { error: 'Order not found' });

    const ownerIds = [normalize(order?.user_id), normalize(order?.buyer_id)].filter(Boolean);
    if (!isAdmin && !ownerIds.includes(profileId) && !ownerIds.includes(String(user.id))) {
      return json(403, { error: 'Forbidden' });
    }

    const providerCaptureId = normalize(order?.provider_capture_id);
    if (!providerCaptureId) return json(400, { error: 'Order is missing a PayPal capture reference' });

    const refund = await refundPayPalCapture({
      captureId: providerCaptureId,
      currency: normalize(order?.currency) || 'USD',
      amount: Number.isFinite(refundAmount) && refundAmount > 0 ? refundAmount : undefined,
      note: normalize(body?.reason) || 'refund',
    });

    await cancelOrderPayoutsForRefund(supabaseAdmin, String(order.id), providerCaptureId);

    try {
      await logAccountRefundHistory(supabaseAdmin, {
        order,
        actorProfileId: profileId,
        refundId: refund.refundId,
        amount: refundAmount,
        reason: normalize(body?.reason) || 'Refund issued',
      });
    } catch {
      // Best-effort.
    }

    try {
      await supabaseAdmin
        .from('disputes')
        .update({
          status: 'resolved',
          resolution_type: 'refund_full',
          resolution: normalize(body?.reason) || 'Refund issued',
          refund_amount: Number.isFinite(refundAmount) && refundAmount > 0 ? roundMoney(refundAmount) : null,
          resolved_at: new Date().toISOString(),
          resolved_by: profileId,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('order_id', String(order.id))
        .in('status', ['open', 'investigating', 'awaiting_response']);
    } catch {
      // Best-effort.
    }

    await writeAuditLog({
      supabaseAdmin,
      actor_user_id: profileId || String(user.id),
      action: 'refund_issued',
      entity_type: 'order',
      entity_id: String(order.id),
      details: {
        refund_id: refund.refundId,
        refund_amount: Number.isFinite(refundAmount) && refundAmount > 0 ? roundMoney(refundAmount) : null,
        currency: normalize(order?.currency) || 'USD',
        buyer_id: normalize(order?.buyer_id) || null,
        seller_id: normalize(order?.seller_id) || null,
        provider_order_id: normalize(order?.provider_order_id) || null,
        provider_capture_id: providerCaptureId,
      },
    });

    return json(200, { ok: true, action: 'refund', refundId: refund.refundId, provider: 'paypal' });
  } catch (e: any) {
    return json(500, { error: e instanceof Error ? e.message : String(e) });
  }
};

export default handler;
