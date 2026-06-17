import type { Handler } from '@netlify/functions';
import { json } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { buildInsuranceMarketplaceRows } from './_lib/insuranceMarketplace';

export const handler: Handler = async (event) => {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const listings = await buildInsuranceMarketplaceRows(supabaseAdmin, false);
    return json(200, {
      ok: true,
      listings,
      stats: {
        total_listings: listings.length,
        active_verticals: Array.from(new Set(listings.flatMap((listing) => listing.verticals || []))).length,
      },
    });
  } catch (error: any) {
    return json(Number(error?.statusCode) || 500, { ok: false, error: error?.message || 'Unexpected error' });
  }
};

export default handler;
