import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { requireAdmin } from './_lib/auth';
import { json, assertPost, parseJson } from './_lib/http';

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

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event as any);

    const body = parseJson<Body>(event.body);
    const disputeId = normalize(body?.disputeId);
    const status = normalize(body?.status).toLowerCase() as DisputeStatus;
    const resolutionType = normalize(body?.resolutionType).toLowerCase() as ResolutionType;
    const resolution = normalize(body?.resolution);
    const refundAmount = Number(body?.refundAmount);

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

    const payload: Record<string, any> = {
      status,
      resolution_type: resolutionType || null,
      resolution: resolution || null,
      refund_amount: Number.isFinite(refundAmount) && refundAmount >= 0 ? roundMoney(refundAmount) : null,
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
      const sellerWon = resolutionType === 'seller_favor' || resolutionType === 'no_action' || resolutionType === 'replacement';
      const buyerWon = resolutionType === 'buyer_favor' || resolutionType === 'refund_full' || resolutionType === 'refund_partial';

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
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', orderId);
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

    return json(200, { ok: true, dispute: updated });
  } catch (e) {
    return json(500, { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) });
  }
};

export default handler;
