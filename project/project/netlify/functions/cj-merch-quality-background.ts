import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';

const MAX_PRODUCTS_PER_RUN = 25;
const MIN_DESCRIPTION_LENGTH = 120;
const MAX_RAW_TITLE_LENGTH = 105;

const text = (value: unknown) => String(value ?? '').trim();

function mediaCount(value: unknown): number {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

function looksLikeGenericApparel(title: string, category: string): boolean {
  const haystack = `${title} ${category}`.toLowerCase();
  const apparelCategory = /women'?s clothing|men'?s clothing|tops? & sets?|camis|lingerie|underwear|fashion & accessories/.test(haystack);
  if (!apparelCategory) return false;
  return /sexy|lingerie|underwear|corset|tube top|crop top|shaper\s?bra|streetwear chest|bodycon|spring fashion|female underwear/.test(haystack)
    || title.length > 85;
}

function qualityIssues(product: any): string[] {
  const title = text(product?.title);
  const category = text(product?.category);
  const description = text(product?.description);
  const images = mediaCount(product?.images);
  const videos = mediaCount(product?.videos);
  const issues: string[] = [];

  if (!title) issues.push('missing customer-facing title');
  if (title.length > MAX_RAW_TITLE_LENGTH) issues.push(`supplier-style title is too long (${title.length} chars)`);
  if (description.length < MIN_DESCRIPTION_LENGTH) issues.push(`description is too thin (${description.length} chars)`);
  if (images < 2 && videos < 1) issues.push(`weak media set (${images} image(s), ${videos} video(s))`);
  if (looksLikeGenericApparel(title, category)) issues.push('generic apparel requires manual merchandising review');

  return issues;
}

export const handler: Handler = async (event) => {
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  if (!serviceRoleKey || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const supabase = createSupabaseAdmin();
  const { data: products, error } = await supabase
    .from('products')
    .select('id,title,category,description,images,videos,cj_live_audit_status,verification_details')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('cj_live_audit_status', 'passed')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .order('created_at', { ascending: false })
    .limit(MAX_PRODUCTS_PER_RUN);

  if (error || !products?.length) return { statusCode: 202, body: '' };

  const checkedAt = new Date().toISOString();
  for (const product of products as any[]) {
    const issues = qualityIssues(product);
    if (!issues.length) continue;

    const verificationDetails = product?.verification_details && typeof product.verification_details === 'object'
      ? product.verification_details
      : {};

    await supabase.from('products').update({
      is_active: false,
      is_promotable: false,
      status: 'draft',
      import_status: 'needs_merchandising',
      verification_details: {
        ...verificationDetails,
        merch_quality: {
          status: 'held',
          checked_at: checkedAt,
          issues,
          rule: 'SupplyLine products must be useful/giftable, well-presented, and affiliate-ready before promotion',
        },
      },
      updated_at: checkedAt,
    }).eq('id', product.id);
  }

  return { statusCode: 202, body: '' };
};

export default handler;
