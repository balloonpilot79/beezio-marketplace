import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, requireAdmin, resolveAuthUserIdFromProfileId } from './_lib/auth';
import { json, assertPost, parseJson } from './_lib/http';
import { notifyDisputeParties } from './_lib/dispute-alerts';

const allowedTypes = new Set([
  'product_not_received',
  'product_damaged',
  'wrong_item',
  'not_as_described',
  'refund_request',
  'quality_issue',
  'seller_unresponsive',
  'other',
]);

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISPUTE_WINDOW_DAYS = 14;

type Body = {
  sellerId?: string;
  disputeType?: string;
  description?: string;
  message?: string;
  orderId?: string | null;
};

const normalize = (value: unknown) => String(value || '').trim();

const freezeOrderPayoutsForDispute = async (supabaseAdmin: any, orderId: string) => {
  const nowIso = new Date().toISOString();

  const { error: orderHoldError } = await supabaseAdmin
    .from('orders')
    .update({
      dispute_status: 'OPEN',
      updated_at: nowIso,
    } as any)
    .eq('id', orderId);
  if (orderHoldError) throw new Error('Could not protect the disputed order: ' + orderHoldError.message);

  const { error: payoutHoldError } = await supabaseAdmin
    .from('payout_ledger')
    .update({ status: 'ON_HOLD_DISPUTE', updated_at: nowIso } as any)
    .eq('order_id', orderId)
    .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);
  if (payoutHoldError) throw new Error('Could not hold payout: ' + payoutHoldError.message);

  const { error: snapshotHoldError } = await supabaseAdmin
    .from('payout_snapshots')
    .update({ status: 'ON_HOLD_DISPUTE', updated_at: nowIso } as any)
    .eq('order_id', orderId)
    .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);
  if (snapshotHoldError) throw new Error('Could not hold payee snapshots: ' + snapshotHoldError.message);

  try {
    const { error: moneyHoldError } = await supabaseAdmin
      .from('order_money_ledger')
      .update({ status: 'on_hold_dispute', updated_at: nowIso } as any)
      .eq('order_id', orderId)
      .in('status', ['held', 'ready']);
    if (moneyHoldError) throw moneyHoldError;
  } catch (error) {
    // The order is already flagged OPEN, so payouts remain blocked even on ledger errors.
    throw new Error('The disputed order was protected but its itemized hold needs review: ' + String(error));
  }
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const authHeader = extractAuthHeader(event as any);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authErr } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authErr });

    const body = parseJson<Body>(event.body);
    const rawSeller = normalize(body?.sellerId);
    const description = normalize(body?.description);
    const messageBody = normalize(body?.message);
    const orderId = normalize(body?.orderId);
    const disputeTypeInput = normalize(body?.disputeType).toLowerCase();

    if (!rawSeller) return json(400, { error: 'Missing sellerId' });
    if (!description) return json(400, { error: 'Missing description' });
    if (orderId && !uuidRegex.test(orderId)) return json(400, { error: 'Invalid orderId' });

    const supabaseAdmin = createSupabaseAdmin();
    const filerUserId = String(user.id);

    let isAdmin = false;
    try {
      await requireAdmin(event as any);
      isAdmin = true;
    } catch {
      isAdmin = false;
    }

    let resolvedSellerId = rawSeller;
    if (rawSeller.includes('@')) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id,user_id')
        .eq('email', rawSeller)
        .maybeSingle();
      resolvedSellerId = normalize((data as any)?.user_id || (data as any)?.id || rawSeller);
    } else {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id,user_id')
        .or(`id.eq.${rawSeller},user_id.eq.${rawSeller}`)
        .maybeSingle();
      resolvedSellerId = normalize((data as any)?.user_id || (data as any)?.id || rawSeller);
    }

    resolvedSellerId = normalize((await resolveAuthUserIdFromProfileId(resolvedSellerId)) || resolvedSellerId);
    if (!uuidRegex.test(resolvedSellerId)) return json(400, { error: 'Invalid sellerId' });
    if (resolvedSellerId === filerUserId) {
      return json(400, { error: 'Cannot file against yourself' });
    }

    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, seller_id, buyer_id, created_at')
        .eq('id', orderId)
        .maybeSingle();

      if (!order?.id) return json(404, { error: 'Order not found' });

      const createdAt = new Date(String((order as any)?.created_at || ''));
      if (Number.isNaN(createdAt.getTime())) return json(400, { error: 'Order has invalid timestamp' });

      const disputeCutoff = Date.now() - DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      if (createdAt.getTime() < disputeCutoff) {
        return json(400, { error: `Dispute window expired (${DISPUTE_WINDOW_DAYS} days)` });
      }

      const orderSellerId = normalize((order as any)?.seller_id);
      if (orderSellerId) {
        resolvedSellerId = normalize((await resolveAuthUserIdFromProfileId(orderSellerId)) || orderSellerId);
      }

      const buyerId = normalize((order as any)?.buyer_id);
      const buyerUserId = normalize((await resolveAuthUserIdFromProfileId(buyerId)) || buyerId);
      if (!isAdmin && buyerUserId && filerUserId !== buyerUserId) {
        return json(403, { error: 'Only the buyer or platform can open an order dispute.' });
      }
    }

    if (orderId) {
      const { data: active } = await supabaseAdmin.from('disputes').select('id')
        .eq('order_id', orderId).in('status', ['open', 'investigating', 'awaiting_response'])
        .limit(1).maybeSingle();
      if (active?.id) return json(409, { error: 'This order already has an open dispute.', disputeId: active.id });
    }

    const disputeType = allowedTypes.has(disputeTypeInput) ? disputeTypeInput : 'other';
    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from('disputes')
      .insert({
        order_id: orderId || null,
        dispute_type: disputeType,
        filed_by: filerUserId,
        filed_against: resolvedSellerId,
        description,
        status: isAdmin ? 'investigating' : 'open',
      } as any)
      .select('id, order_id, dispute_type, description, status, filed_by, filed_against, created_at, updated_at')
      .single();

    if (disputeError || !dispute) {
      return json(400, { error: 'Failed to create dispute', details: disputeError?.message || null });
    }

    // Set the order-level payout guard before recording or notifying the complaint.
    if (orderId) {
      try {
        await freezeOrderPayoutsForDispute(supabaseAdmin, orderId);
      } catch (error) {
        return json(503, { error: 'Case opened, but payout protection requires admin review.', details: String(error) });
      }
    }

    const { error: messageError } = await supabaseAdmin
      .from('dispute_messages')
      .insert({
        dispute_id: (dispute as any).id,
        sender_id: filerUserId,
        message: messageBody || description,
        is_admin_message: isAdmin,
      } as any);

    if (messageError) {
      return json(400, { error: 'Dispute created but message failed', details: messageError.message });
    }

    const alerts = await notifyDisputeParties(supabaseAdmin, {
      disputeId: String(dispute.id), event: 'opened', actorId: filerUserId,
    });

    return json(200, { dispute, alerts });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export default handler;
