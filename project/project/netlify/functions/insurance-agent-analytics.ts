import type { Handler } from '@netlify/functions';
import { requireSellerOrAdmin } from './_lib/auth';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, parseJson } from './_lib/http';

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

const startOfDayIso = (daysAgo: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const handler: Handler = async (event) => {
  try {
    const auth = await requireSellerOrAdmin(event as any);
    const supabaseAdmin = createSupabaseAdmin();
    const body = event.body ? parseJson<any>(event.body) : {};
    const targetProfileId = await resolveTargetAgentProfileId(supabaseAdmin, body, auth.profileId);

    if (event.httpMethod !== 'GET') {
      return json(405, { ok: false, error: 'Method not allowed' });
    }

    const [campaignsRes, leadsRes] = await Promise.all([
      supabaseAdmin
        .from('insurance_lead_campaigns')
        .select('id,listing_id,vertical,status,cost_per_lead_cents,affiliate_payout_cents,daily_cap,created_at')
        .eq('agent_user_id', targetProfileId)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('insurance_leads')
        .select('id,campaign_id,listing_id,vertical,status,review_status,fraud_score,lead_price_cents,affiliate_payout_cents,created_at,delivered_at,affiliate_user_id,payload_json')
        .eq('agent_user_id', targetProfileId)
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    if (campaignsRes.error) return json(500, { ok: false, error: campaignsRes.error.message });
    if (leadsRes.error) return json(500, { ok: false, error: leadsRes.error.message });

    const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];
    const leads = Array.isArray(leadsRes.data) ? leadsRes.data : [];
    const listingIds = Array.from(new Set(campaigns.map((row: any) => String(row?.listing_id || '').trim()).filter(Boolean)));
    const campaignIds = Array.from(new Set(campaigns.map((row: any) => String(row?.id || '').trim()).filter(Boolean)));

    const [clicksRes, walletRes] = await Promise.all([
      listingIds.length > 0 || campaignIds.length > 0
        ? supabaseAdmin
            .from('insurance_affiliate_clicks')
            .select('id,listing_id,campaign_id,created_at')
            .or([
              listingIds.length > 0 ? `listing_id.in.(${listingIds.join(',')})` : '',
              campaignIds.length > 0 ? `campaign_id.in.(${campaignIds.join(',')})` : '',
            ].filter(Boolean).join(','))
            .order('created_at', { ascending: false })
            .limit(2000)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from('insurance_agent_wallets')
        .select('id,balance_cents')
        .eq('agent_user_id', targetProfileId)
        .maybeSingle(),
    ]);

    if ((clicksRes as any).error) return json(500, { ok: false, error: (clicksRes as any).error.message });
    if (walletRes.error) return json(500, { ok: false, error: walletRes.error.message });

    const wallet = walletRes.data || null;
    const walletId = String((wallet as any)?.id || '').trim();

    const walletTxRes = walletId
      ? await supabaseAdmin
          .from('insurance_wallet_transactions')
          .select('id,type,amount_cents,created_at')
          .eq('wallet_id', walletId)
          .order('created_at', { ascending: false })
          .limit(1000)
      : { data: [], error: null };
    if ((walletTxRes as any).error) return json(500, { ok: false, error: (walletTxRes as any).error.message });

    const clicks = Array.isArray((clicksRes as any).data) ? (clicksRes as any).data : [];
    const walletTransactions = Array.isArray((walletTxRes as any).data) ? (walletTxRes as any).data : [];

    const last30Start = new Date();
    last30Start.setDate(last30Start.getDate() - 30);
    const last14Start = new Date();
    last14Start.setDate(last14Start.getDate() - 13);
    last14Start.setHours(0, 0, 0, 0);

    const recentClicks = clicks.filter((row: any) => new Date(row.created_at) >= last30Start);
    const recentLeads = leads.filter((row: any) => new Date(row.created_at) >= last30Start);
    const deliveredLeads = recentLeads.filter((row: any) => String(row?.status || '').toLowerCase() === 'delivered');
    const reviewLeads = recentLeads.filter((row: any) => {
      const status = String(row?.status || '').toLowerCase();
      const reviewStatus = String(row?.review_status || '').toLowerCase();
      return status !== 'delivered' && status !== 'invalid' && (status === 'submitted' || reviewStatus === 'flagged');
    });
    const rejectedLeads = recentLeads.filter((row: any) => String(row?.status || '').toLowerCase() === 'invalid');
    const affiliateLeads = recentLeads.filter((row: any) => {
      const sourceType = String((row as any)?.payload_json?.source_type || '').trim().toLowerCase();
      return sourceType === 'affiliate' || String(row?.affiliate_user_id || '').trim().length > 0;
    });
    const directLeads = recentLeads.filter((row: any) => !affiliateLeads.includes(row));
    const avgFraudScore = recentLeads.length > 0
      ? Math.round(recentLeads.reduce((sum: number, row: any) => sum + Number(row?.fraud_score || 0), 0) / recentLeads.length)
      : 0;
    const recentCharges = walletTransactions.filter((row: any) => String(row?.type || '') === 'lead_charge' && new Date(row.created_at) >= last30Start);
    const recentFunding = walletTransactions.filter((row: any) => String(row?.type || '') === 'funding' && new Date(row.created_at) >= last30Start);
    const deliveredRevenueCents = deliveredLeads.reduce((sum: number, row: any) => sum + Number(row?.lead_price_cents || 0), 0);
    const affiliateExposureCents = deliveredLeads.reduce((sum: number, row: any) => sum + Number(row?.affiliate_payout_cents || 0), 0);

    const daySeries = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(last14Start);
      date.setDate(last14Start.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      const dayLeads = leads.filter((row: any) => String(row?.created_at || '').slice(0, 10) === key);
      const dayClicks = clicks.filter((row: any) => String(row?.created_at || '').slice(0, 10) === key);
      return {
        day: key,
        clicks: dayClicks.length,
        submitted: dayLeads.length,
        delivered: dayLeads.filter((row: any) => String(row?.status || '').toLowerCase() === 'delivered').length,
      };
    });

    const verticalMap = new Map<string, { vertical: string; leads: number; delivered: number; flagged: number; clicks: number; revenue_cents: number }>();
    for (const campaign of campaigns) {
      const key = String((campaign as any)?.vertical || 'life').trim() || 'life';
      if (!verticalMap.has(key)) {
        verticalMap.set(key, { vertical: key, leads: 0, delivered: 0, flagged: 0, clicks: 0, revenue_cents: 0 });
      }
    }
    for (const lead of recentLeads) {
      const key = String((lead as any)?.vertical || 'life').trim() || 'life';
      if (!verticalMap.has(key)) {
        verticalMap.set(key, { vertical: key, leads: 0, delivered: 0, flagged: 0, clicks: 0, revenue_cents: 0 });
      }
      const entry = verticalMap.get(key)!;
      entry.leads += 1;
      if (String((lead as any)?.status || '').toLowerCase() === 'delivered') {
        entry.delivered += 1;
        entry.revenue_cents += Number((lead as any)?.lead_price_cents || 0);
      }
      if (String((lead as any)?.review_status || '').toLowerCase() === 'flagged') {
        entry.flagged += 1;
      }
    }
    for (const click of recentClicks) {
      const campaign = campaigns.find((row: any) => String(row?.id || '') === String((click as any)?.campaign_id || ''));
      const key = String((campaign as any)?.vertical || 'life').trim() || 'life';
      if (!verticalMap.has(key)) {
        verticalMap.set(key, { vertical: key, leads: 0, delivered: 0, flagged: 0, clicks: 0, revenue_cents: 0 });
      }
      verticalMap.get(key)!.clicks += 1;
    }

    return json(200, {
      ok: true,
      analytics: {
        overview: {
          clicks_30d: recentClicks.length,
          leads_30d: recentLeads.length,
          delivered_30d: deliveredLeads.length,
          review_30d: reviewLeads.length,
          rejected_30d: rejectedLeads.length,
          affiliate_leads_30d: affiliateLeads.length,
          direct_leads_30d: directLeads.length,
          avg_fraud_score_30d: avgFraudScore,
          delivery_rate_30d: recentLeads.length > 0 ? Number((deliveredLeads.length / recentLeads.length).toFixed(3)) : 0,
          click_to_lead_rate_30d: recentClicks.length > 0 ? Number((recentLeads.length / recentClicks.length).toFixed(3)) : 0,
          wallet_balance_cents: Number((wallet as any)?.balance_cents || 0),
          wallet_spend_30d_cents: recentCharges.reduce((sum: number, row: any) => sum + Number(row?.amount_cents || 0), 0),
          wallet_funding_30d_cents: recentFunding.reduce((sum: number, row: any) => sum + Number(row?.amount_cents || 0), 0),
          delivered_revenue_30d_cents: deliveredRevenueCents,
          affiliate_exposure_30d_cents: affiliateExposureCents,
        },
        by_day: daySeries,
        by_vertical: Array.from(verticalMap.values()).sort((a, b) => b.leads - a.leads),
        campaigns: campaigns.map((campaign: any) => {
          const campaignLeads = leads.filter((lead: any) => String(lead?.campaign_id || '') === String(campaign?.id || ''));
          const recentCampaignLeads = campaignLeads.filter((lead: any) => new Date(lead.created_at) >= last30Start);
          const recentCampaignClicks = clicks.filter((click: any) => String(click?.campaign_id || '') === String(campaign?.id || '') && new Date(click.created_at) >= last30Start);
          return {
            id: String(campaign?.id || ''),
            vertical: String(campaign?.vertical || 'life'),
            status: String(campaign?.status || 'unknown'),
            daily_cap: campaign?.daily_cap ?? null,
            cost_per_lead_cents: Number(campaign?.cost_per_lead_cents || 0),
            affiliate_payout_cents: Number(campaign?.affiliate_payout_cents || 0),
            clicks_30d: recentCampaignClicks.length,
            leads_30d: recentCampaignLeads.length,
            delivered_30d: recentCampaignLeads.filter((lead: any) => String(lead?.status || '').toLowerCase() === 'delivered').length,
          };
        }),
      },
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
