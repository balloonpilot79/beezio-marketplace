import type { Handler } from '@netlify/functions';
import { json, parseJson } from './_lib/http';
import { requireAuthenticatedProfile } from './_lib/auth';
import { createSupabaseAdmin } from './_lib/supabase';

const startOfMonthIso = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};

export const handler: Handler = async (event) => {
  try {
    const auth = await requireAuthenticatedProfile(event as any);
    const supabaseAdmin = createSupabaseAdmin();
    const body = event.body ? parseJson<any>(event.body) : {};
    const affiliateProfileId = String(body?.affiliate_profile_id || auth.profileId || '').trim();
    if (!affiliateProfileId) return json(400, { ok: false, error: 'Missing affiliate profile id.' });

    const monthStart = startOfMonthIso();

    const [
      earningsResult,
      leadsResult,
      clicksResult,
      monthEarningsResult,
      monthClicksResult,
    ] = await Promise.all([
      supabaseAdmin
        .from('insurance_affiliate_earnings')
        .select('id,lead_id,amount_cents,status,hold_release_at,paid_at,created_at,updated_at')
        .eq('affiliate_user_id', affiliateProfileId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('insurance_leads')
        .select('id,listing_id,vertical,status,review_status,created_at,affiliate_payout,affiliate_payout_cents,status_reason')
        .eq('affiliate_user_id', affiliateProfileId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('insurance_affiliate_clicks')
        .select('id,listing_id,tracking_code,created_at')
        .eq('affiliate_user_id', affiliateProfileId)
        .order('created_at', { ascending: false })
        .limit(250),
      supabaseAdmin
        .from('insurance_affiliate_earnings')
        .select('id,amount_cents,status,hold_release_at,paid_at,created_at')
        .eq('affiliate_user_id', affiliateProfileId)
        .gte('created_at', monthStart),
      supabaseAdmin
        .from('insurance_affiliate_clicks')
        .select('id,created_at')
        .eq('affiliate_user_id', affiliateProfileId)
        .gte('created_at', monthStart),
    ]);

    if (earningsResult.error) return json(500, { ok: false, error: earningsResult.error.message });
    if (leadsResult.error) return json(500, { ok: false, error: leadsResult.error.message });
    if (clicksResult.error) return json(500, { ok: false, error: clicksResult.error.message });
    if (monthEarningsResult.error) return json(500, { ok: false, error: monthEarningsResult.error.message });
    if (monthClicksResult.error) return json(500, { ok: false, error: monthClicksResult.error.message });

    const earnings = (earningsResult.data as any[]) || [];
    const leads = (leadsResult.data as any[]) || [];
    const clicks = (clicksResult.data as any[]) || [];
    const monthEarnings = (monthEarningsResult.data as any[]) || [];
    const monthClicks = (monthClicksResult.data as any[]) || [];

    const listingIds = Array.from(new Set([...leads, ...clicks].map((row: any) => String(row?.listing_id || '').trim()).filter(Boolean)));
    const leadIds = leads.map((row: any) => String(row?.id || '').trim()).filter(Boolean);

    const [listingsRes, disputesRes] = await Promise.all([
      listingIds.length > 0
        ? supabaseAdmin.from('insurance_agent_listings').select('id,agency_name,slug').in('id', listingIds)
        : Promise.resolve({ data: [], error: null }),
      leadIds.length > 0
        ? supabaseAdmin
            .from('insurance_lead_disputes')
            .select('id,lead_id,status,reason_code')
            .in('lead_id', leadIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (listingsRes.error) return json(500, { ok: false, error: listingsRes.error.message });
    if (disputesRes.error) return json(500, { ok: false, error: disputesRes.error.message });

    const listingMap = new Map<string, any>();
    for (const row of (listingsRes.data as any[]) || []) {
      listingMap.set(String(row?.id || '').trim(), row);
    }

    const disputeMap = new Map<string, any[]>();
    for (const row of (disputesRes.data as any[]) || []) {
      const leadId = String(row?.lead_id || '').trim();
      if (!leadId) continue;
      if (!disputeMap.has(leadId)) disputeMap.set(leadId, []);
      disputeMap.get(leadId)!.push(row);
    }

    const totalEarnedCents = earnings
      .filter((row: any) => !['canceled'].includes(String(row?.status || '').toLowerCase()))
      .reduce((sum, row: any) => sum + Number(row?.amount_cents || 0), 0);
    const pendingCents = earnings
      .filter((row: any) => !['credited', 'paid', 'released', 'canceled'].includes(String(row?.status || '').toLowerCase()))
      .reduce((sum, row: any) => sum + Number(row?.amount_cents || 0), 0);
    const monthEarnedCents = monthEarnings
      .filter((row: any) => !['canceled'].includes(String(row?.status || '').toLowerCase()))
      .reduce((sum, row: any) => sum + Number(row?.amount_cents || 0), 0);
    const deliveredLeads = leads.filter((row: any) => String(row?.status || '').toLowerCase() === 'delivered').length;
    const reviewLeads = leads.filter((row: any) => {
      const status = String(row?.status || '').toLowerCase();
      const reviewStatus = String(row?.review_status || '').toLowerCase();
      return status !== 'delivered' && status !== 'invalid' && (reviewStatus === 'flagged' || status === 'submitted');
    }).length;
    const rejectedLeads = leads.filter((row: any) => String(row?.status || '').toLowerCase() === 'invalid').length;

    return json(200, {
      ok: true,
      stats: {
        total_clicks: clicks.length,
        month_clicks: monthClicks.length,
        total_leads: leads.length,
        delivered_leads: deliveredLeads,
        leads_in_review: reviewLeads,
        rejected_leads: rejectedLeads,
        conversion_rate: clicks.length > 0 ? Number(((deliveredLeads / clicks.length) * 100).toFixed(1)) : 0,
        total_earned: Number((totalEarnedCents / 100).toFixed(2)),
        pending_earned: Number((pendingCents / 100).toFixed(2)),
        month_earned: Number((monthEarnedCents / 100).toFixed(2)),
      },
      recent_leads: leads.slice(0, 12).map((lead: any) => ({
        ...lead,
        listing: listingMap.get(String(lead?.listing_id || '').trim()) || null,
        disputes: disputeMap.get(String(lead?.id || '').trim()) || [],
      })),
      recent_earnings: earnings.slice(0, 12).map((earning: any) => {
        const linkedLead = leads.find((lead: any) => String(lead?.id || '') === String(earning?.lead_id || ''));
        return {
          ...earning,
          listing: linkedLead ? listingMap.get(String(linkedLead?.listing_id || '').trim()) || null : null,
          lead: linkedLead || null,
        };
      }),
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
