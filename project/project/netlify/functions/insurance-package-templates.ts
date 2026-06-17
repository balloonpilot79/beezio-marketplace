import type { Handler } from '@netlify/functions';
import { assertPost, json, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { requireAdmin, requireSellerOrAdmin } from './_lib/auth';
import { buildInsurancePricingPreview, loadInsuranceAdminSettings } from './_lib/insuranceMarketplace';
import { dollarsToCents, normalizeInsuranceVertical } from '../../shared/insuranceLeads';

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      await requireSellerOrAdmin(event as any);
    } else {
      await requireAdmin(event as any);
    }
    const supabaseAdmin = createSupabaseAdmin();
    const adminSettings = await loadInsuranceAdminSettings(supabaseAdmin);

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('insurance_lead_package_templates')
        .select('*')
        .order('qualified_lead_count', { ascending: true });
      if (error) return json(500, { ok: false, error: error.message });
      return json(200, { ok: true, templates: data || [] });
    }

    assertPost(event.httpMethod);
    const body = parseJson<any>(event.body);
    const leadCount = Math.max(1, Math.floor(Number(body?.qualified_lead_count || 0)));
    const packagePriceCents = Math.max(0, Math.round(Number(body?.package_price_cents || dollarsToCents(body?.package_price || 0) || 0)));
    if (!leadCount || !packagePriceCents) return json(400, { ok: false, error: 'Lead count and package price are required.' });

    const impliedCostPerLeadCents = Math.max(1, Math.round(packagePriceCents / leadCount));
    const pricing = buildInsurancePricingPreview({
      leadPriceCents: impliedCostPerLeadCents,
      hasAffiliate: true,
      hasInfluencer: false,
      minLeadPriceCents: adminSettings.minLeadPriceCents,
      minBeezioFeeCents: adminSettings.minBeezioFeeCents,
      minAffiliatePayoutCents: adminSettings.minAffiliatePayoutCents,
    });
    if (!pricing.ok) return json(400, { ok: false, error: pricing.reason || 'Invalid package price.' });

    const payload = {
      name: String(body?.name || `${leadCount} qualified leads`).trim(),
      vertical: normalizeInsuranceVertical(body?.vertical || 'life'),
      qualified_lead_count: leadCount,
      package_price_cents: packagePriceCents,
      implied_cost_per_lead_cents: impliedCostPerLeadCents,
      suggested_affiliate_payout_cents: pricing.affiliatePayoutCents,
      suggested_beezio_fee_cents: pricing.beezioFeeCents,
      min_allowed_agent_price_cents: adminSettings.minLeadPriceCents,
      is_active: body?.is_active !== false,
    };

    const templateId = String(body?.id || '').trim();
    const query = templateId
      ? supabaseAdmin.from('insurance_lead_package_templates').update(payload).eq('id', templateId).select('*').single()
      : supabaseAdmin.from('insurance_lead_package_templates').insert(payload).select('*').single();
    const { data, error } = await query;
    if (error) return json(500, { ok: false, error: error.message });
    return json(200, { ok: true, template: data, pricing_preview: pricing });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
