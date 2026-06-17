import type { Handler } from '@netlify/functions';
import { json, parseJson } from './_lib/http';
import { requireSellerOrAdmin } from './_lib/auth';
import { createSupabaseAdmin } from './_lib/supabase';
import {
  buildInsuranceLeadAgentEmail,
  buildInsuranceLeadCustomerEmail,
  buildInsuranceLowFundsEmail,
  sendTransactionalEmail,
} from './_lib/email';

const resolveTargetAgentProfileId = async (supabaseAdmin: any, body: any, fallbackProfileId: string) => {
  const raw = String(body?.agent_profile_id || body?.target_profile_id || '').trim();
  if (!raw) return fallbackProfileId;
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .or(`id.eq.${raw},user_id.eq.${raw}`)
    .maybeSingle();
  return String((data as any)?.id || raw).trim() || fallbackProfileId;
};

export const handler: Handler = async (event) => {
  try {
    const admin = await requireSellerOrAdmin(event as any);
    const supabaseAdmin = createSupabaseAdmin();
    const body = event.body ? parseJson<any>(event.body) : {};
    const targetProfileId = await resolveTargetAgentProfileId(supabaseAdmin, body, admin.profileId);

    if (event.httpMethod === 'GET') {
      const { data: leads, error } = await supabaseAdmin
        .from('insurance_leads')
        .select('*')
        .eq('agent_user_id', targetProfileId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return json(500, { ok: false, error: error.message });

      const { data: wallet } = await supabaseAdmin
        .from('insurance_agent_wallets')
        .select('balance_cents')
        .eq('agent_user_id', targetProfileId)
        .maybeSingle();

      const walletBalanceCents = Math.max(0, Number((wallet as any)?.balance_cents || 0));
      const rows = (Array.isArray(leads) ? leads : []).filter((row: any) => {
        const reason = String(row?.status_reason || '').trim().toLowerCase();
        if (reason !== 'awaiting_credit_funding' && reason !== 'awaiting_campaign_activation') return true;
        const leadPriceCents = Math.max(1, Number(row?.lead_price_cents || 0));
        return walletBalanceCents >= leadPriceCents;
      });
      const affiliateIds = Array.from(
        new Set(rows.map((row: any) => String(row?.affiliate_user_id || '').trim()).filter(Boolean))
      );
      const leadIds = rows.map((row: any) => String(row?.id || '').trim()).filter(Boolean);

      const [affiliateProfilesRes, disputesRes, earningsRes] = await Promise.all([
        affiliateIds.length > 0
          ? supabaseAdmin.from('profiles').select('id,full_name,email').in('id', affiliateIds)
          : Promise.resolve({ data: [], error: null }),
        leadIds.length > 0
          ? supabaseAdmin
              .from('insurance_lead_disputes')
              .select('id,lead_id,status,reason_code,reason_text,resolution,resolution_notes,created_at,updated_at')
              .in('lead_id', leadIds)
          : Promise.resolve({ data: [], error: null }),
        leadIds.length > 0
          ? supabaseAdmin
              .from('insurance_affiliate_earnings')
              .select('id,lead_id,affiliate_user_id,amount_cents,status,created_at,updated_at')
              .in('lead_id', leadIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (affiliateProfilesRes.error) return json(500, { ok: false, error: affiliateProfilesRes.error.message });
      if (disputesRes.error) return json(500, { ok: false, error: disputesRes.error.message });
      if (earningsRes.error) return json(500, { ok: false, error: earningsRes.error.message });

      const affiliateProfileMap = new Map<string, any>();
      for (const row of (affiliateProfilesRes.data as any[]) || []) {
        affiliateProfileMap.set(String(row?.id || '').trim(), row);
      }

      const disputeMap = new Map<string, any[]>();
      for (const row of (disputesRes.data as any[]) || []) {
        const leadId = String(row?.lead_id || '').trim();
        if (!leadId) continue;
        if (!disputeMap.has(leadId)) disputeMap.set(leadId, []);
        disputeMap.get(leadId)!.push(row);
      }

      const earningMap = new Map<string, any[]>();
      for (const row of (earningsRes.data as any[]) || []) {
        const leadId = String(row?.lead_id || '').trim();
        if (!leadId) continue;
        if (!earningMap.has(leadId)) earningMap.set(leadId, []);
        earningMap.get(leadId)!.push(row);
      }

      return json(200, {
        ok: true,
        leads: rows.map((lead: any) => ({
          ...lead,
          affiliate_profile: affiliateProfileMap.get(String(lead?.affiliate_user_id || '').trim()) || null,
          disputes: disputeMap.get(String(lead?.id || '').trim()) || [],
          earnings: earningMap.get(String(lead?.id || '').trim()) || [],
        })),
      });
    }

    if (event.httpMethod !== 'POST') {
      return json(405, { ok: false, error: 'Method not allowed' });
    }

    const action = String(body?.action || '').trim().toLowerCase();
    const leadId = String(body?.lead_id || '').trim();
    const notes = String(body?.notes || '').trim();
    if (!leadId) return json(400, { ok: false, error: 'lead_id is required.' });

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('insurance_leads')
      .select('*')
      .eq('id', leadId)
      .eq('agent_user_id', targetProfileId)
      .maybeSingle();
    if (leadError) return json(500, { ok: false, error: leadError.message });
    if (!lead) return json(404, { ok: false, error: 'Lead not found.' });

    const { data: agentProfile } = await supabaseAdmin
      .from('profiles')
      .select('id,full_name,email')
      .or(`id.eq.${targetProfileId},user_id.eq.${targetProfileId}`)
      .limit(1)
      .maybeSingle();

    const { data: listing } = await supabaseAdmin
      .from('insurance_agent_listings')
      .select('id,agency_name,title')
      .eq('id', String((lead as any)?.listing_id || ''))
      .maybeSingle();

    const { data: campaign } = await supabaseAdmin
      .from('insurance_lead_campaigns')
      .select('id,cost_per_lead_cents,agent_user_id')
      .eq('id', String((lead as any)?.campaign_id || ''))
      .maybeSingle();

    const customerEmail = String((lead as any)?.email || '').trim();
    const customerName = `${String((lead as any)?.first_name || '').trim()} ${String((lead as any)?.last_name || '').trim()}`.trim();
    const agentName = String((agentProfile as any)?.full_name || (listing as any)?.agency_name || 'Beezio agent').trim();
    const agentEmail = String((agentProfile as any)?.email || '').trim();
    const listingName = String((listing as any)?.agency_name || (listing as any)?.title || 'Beezio insurance').trim();

    const sendBestEffort = async (to: string, payload: { subject: string; html: string }) => {
      try {
        const result = await sendTransactionalEmail({ to, subject: payload.subject, html: payload.html });
        if (!result.sent) {
          console.warn('[insurance-leads] email skipped:', result.reason);
        }
      } catch (emailErr) {
        console.warn('[insurance-leads] email failed (non-fatal):', emailErr);
      }
    };

    if (action === 'approve') {
      const { error: updateError } = await supabaseAdmin
        .from('insurance_leads')
        .update({
          review_status: 'manually_approved',
          status: 'submitted',
          status_reason: notes || null,
        })
        .eq('id', leadId);
      if (updateError) return json(500, { ok: false, error: updateError.message });

      const { data: processed, error: processError } = await supabaseAdmin
        .rpc('process_insurance_approved_lead', { p_lead_id: leadId });
      if (processError) return json(500, { ok: false, error: processError.message });
      const processedOk = (processed as any)?.ok === true;

      if (agentEmail) {
        await sendBestEffort(
          agentEmail,
          buildInsuranceLeadAgentEmail({
            agentName,
            leadName: customerName || 'Lead approved',
            leadEmail: customerEmail,
            leadPhone: String((lead as any)?.phone || '').trim(),
            vertical: String((lead as any)?.vertical || '').trim(),
            listingName,
            state: String((lead as any)?.payload_json?.state || '').trim(),
            statusLabel: processedOk ? 'approved and delivered' : 'approved but not delivered',
            notes: processedOk ? notes || null : String((processed as any)?.reason || notes || '').trim() || null,
          })
        );
      }

      if (customerEmail) {
        await sendBestEffort(
          customerEmail,
          buildInsuranceLeadCustomerEmail({
            customerName,
            agentName,
            vertical: String((lead as any)?.vertical || '').trim(),
            statusLabel: processedOk ? 'approved' : 'reviewed',
            listingName,
            notes: processedOk
              ? 'A licensed agent can now follow up with you.'
              : String((processed as any)?.reason || '').trim() || null,
          })
        );
      }

      if (!processedOk && String((processed as any)?.reason || '') === 'insufficient_funds' && agentEmail) {
        const { data: wallet } = await supabaseAdmin
          .from('insurance_agent_wallets')
          .select('balance_cents')
          .eq('agent_user_id', String((campaign as any)?.agent_user_id || targetProfileId))
          .limit(1)
          .maybeSingle();

        await sendBestEffort(
          agentEmail,
          buildInsuranceLowFundsEmail({
            agentName,
            listingName,
            balanceCents: Number((wallet as any)?.balance_cents || 0),
            leadCostCents: Number((campaign as any)?.cost_per_lead_cents || 0),
          })
        );
      }

      return json(200, {
        ok: true,
        action: 'approve',
        lead_id: leadId,
        processed,
      });
    }

    if (action === 'reject') {
      const { error: updateError } = await supabaseAdmin
        .from('insurance_leads')
        .update({
          review_status: 'rejected',
          status: 'invalid',
          status_reason: notes || 'manually_rejected',
        })
        .eq('id', leadId);
      if (updateError) return json(500, { ok: false, error: updateError.message });

      if (agentEmail) {
        await sendBestEffort(
          agentEmail,
          buildInsuranceLeadAgentEmail({
            agentName,
            leadName: customerName || 'Lead rejected',
            leadEmail: customerEmail,
            leadPhone: String((lead as any)?.phone || '').trim(),
            vertical: String((lead as any)?.vertical || '').trim(),
            listingName,
            state: String((lead as any)?.payload_json?.state || '').trim(),
            statusLabel: 'rejected',
            notes: notes || 'manually_rejected',
          })
        );
      }

      if (customerEmail) {
        await sendBestEffort(
          customerEmail,
          buildInsuranceLeadCustomerEmail({
            customerName,
            agentName,
            vertical: String((lead as any)?.vertical || '').trim(),
            statusLabel: 'reviewed',
            listingName,
            notes: notes || 'Your request could not be accepted in its current form.',
          })
        );
      }

      return json(200, {
        ok: true,
        action: 'reject',
        lead_id: leadId,
      });
    }

    return json(400, { ok: false, error: 'Unsupported action.' });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
