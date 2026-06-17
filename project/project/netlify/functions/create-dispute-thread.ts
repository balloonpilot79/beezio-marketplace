import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, requireAdmin, resolveProfileId } from './_lib/auth';
import { json, assertPost, parseJson } from './_lib/http';

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

  await supabaseAdmin
    .from('orders')
    .update({
      dispute_status: 'OPEN',
      updated_at: nowIso,
    } as any)
    .eq('id', orderId);

  await supabaseAdmin
    .from('payout_ledger')
    .update({ status: 'ON_HOLD_DISPUTE', updated_at: nowIso } as any)
    .eq('order_id', orderId)
    .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);

  await supabaseAdmin
    .from('payout_snapshots')
    .update({ status: 'ON_HOLD_DISPUTE', updated_at: nowIso } as any)
    .eq('order_id', orderId)
    .in('status', ['PENDING_HOLD', 'READY_TO_PAY']);

  try {
    await supabaseAdmin
      .from('order_money_ledger')
      .update({ status: 'on_hold_dispute', updated_at: nowIso } as any)
      .eq('order_id', orderId)
      .in('status', ['held', 'ready']);
  } catch {
    // Best-effort compatibility for older environments.
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
    const filerProfileId = (await resolveProfileId(user as any)) || String(user.id);

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
      resolvedSellerId = normalize((data as any)?.id || (data as any)?.user_id || rawSeller);
    } else {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id,user_id')
        .or(`id.eq.${rawSeller},user_id.eq.${rawSeller}`)
        .maybeSingle();
      resolvedSellerId = normalize((data as any)?.id || (data as any)?.user_id || rawSeller);
    }

    if (!uuidRegex.test(resolvedSellerId)) return json(400, { error: 'Invalid sellerId' });
    if (resolvedSellerId === filerProfileId || resolvedSellerId === String(user.id)) {
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
      if (orderSellerId && orderSellerId !== resolvedSellerId) {
        resolvedSellerId = orderSellerId;
      }

      const buyerId = normalize((order as any)?.buyer_id);
      if (!isAdmin && buyerId && filerProfileId !== buyerId && String(user.id) !== buyerId) {
        return json(403, { error: 'Only the buyer or platform can open an order dispute.' });
      }
    }

    const disputeType = allowedTypes.has(disputeTypeInput) ? disputeTypeInput : 'other';
    const { data: dispute, error: disputeError } = await supabaseAdmin
      .from('disputes')
      .insert({
        order_id: orderId || null,
        dispute_type: disputeType,
        filed_by: filerProfileId,
        filed_against: resolvedSellerId,
        description,
        status: isAdmin ? 'investigating' : 'open',
      } as any)
      .select('id, order_id, dispute_type, description, status, filed_by, filed_against, created_at, updated_at')
      .single();

    if (disputeError || !dispute) {
      return json(400, { error: 'Failed to create dispute', details: disputeError?.message || null });
    }

    const { error: messageError } = await supabaseAdmin
      .from('dispute_messages')
      .insert({
        dispute_id: (dispute as any).id,
        sender_id: filerProfileId,
        message: messageBody || description,
        is_admin_message: isAdmin,
      } as any);

    if (messageError) {
      return json(400, { error: 'Dispute created but message failed', details: messageError.message });
    }

    if (orderId) {
      await freezeOrderPayoutsForDispute(supabaseAdmin, orderId);
    }

    return json(200, { dispute });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export default handler;
