import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { requireAdmin, requireSellerOrAdmin } from './_lib/auth';

export const handler: Handler = async (event) => {
  try {
    const auth = event.httpMethod === 'GET' ? await requireSellerOrAdmin(event as any) : null;
    const supabaseAdmin = createSupabaseAdmin();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('insurance_lead_disputes')
        .select(`
          *,
          insurance_leads:lead_id (
            id,
            first_name,
            last_name,
            email,
            phone,
            status,
            review_status,
            fraud_score
          )
        `)
        .eq('agent_user_id', String(auth?.profileId || ''))
        .order('created_at', { ascending: false });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, disputes: data || [] });
    }

    assertPost(event.httpMethod);
    const body = parseJson<any>(event.body);
    const action = String(body?.action || 'open').trim().toLowerCase();

    if (action === 'resolve') {
      await requireAdmin(event as any);
      const disputeId = String(body?.dispute_id || '').trim();
      const resolution = String(body?.resolution || '').trim().toLowerCase();
      if (!disputeId || (resolution !== 'approved' && resolution !== 'denied')) {
        return json(400, { ok: false, error: 'dispute_id and a valid resolution are required.' });
      }
      const { data, error } = await supabaseAdmin.rpc('resolve_insurance_dispute', {
        p_dispute_id: disputeId,
        p_resolution: resolution,
        p_notes: String(body?.notes || '').trim() || null,
      });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, result: data });
    }

    const leadId = String(body?.lead_id || '').trim();
    const sellerAuth = await requireSellerOrAdmin(event as any);
    const agentUserId = String(body?.agent_user_id || sellerAuth.profileId || '').trim();
    const reasonCode = String(body?.reason_code || '').trim();
    if (!leadId || !agentUserId || !reasonCode) {
      return json(400, { ok: false, error: 'lead_id, agent_user_id, and reason_code are required.' });
    }

    const { data, error } = await supabaseAdmin
      .from('insurance_lead_disputes')
      .insert({
        lead_id: leadId,
        agent_user_id: agentUserId,
        reason_code: reasonCode,
        reason_text: String(body?.reason_text || '').trim() || null,
        status: 'open',
      })
      .select('*')
      .single();
    if (error) return json(500, { ok: false, error: error.message });

    await supabaseAdmin
      .from('insurance_leads')
      .update({ status: 'disputed' })
      .eq('id', leadId);

    await Promise.all([
      supabaseAdmin
        .from('payout_ledger')
        .update({ status: 'ON_HOLD_DISPUTE', updated_at: new Date().toISOString() } as any)
        .eq('insurance_lead_id', leadId)
        .neq('status', 'PAID')
        .neq('status', 'CANCELED'),
      supabaseAdmin
        .from('insurance_affiliate_earnings')
        .update({ status: 'on_hold_dispute', updated_at: new Date().toISOString() } as any)
        .eq('lead_id', leadId)
        .neq('status', 'paid')
        .neq('status', 'canceled'),
      supabaseAdmin
        .from('insurance_influencer_earnings')
        .update({ status: 'on_hold_dispute', updated_at: new Date().toISOString() } as any)
        .eq('lead_id', leadId)
        .neq('status', 'paid')
        .neq('status', 'canceled'),
    ]);

    return json(200, { ok: true, dispute: data });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
