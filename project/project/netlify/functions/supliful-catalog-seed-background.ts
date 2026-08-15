import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';

const CATALOG_URL = 'https://supliful.com/catalog';
const BRAND_SLUG = 'loving-nutrition';
const BRAND_NAME = 'Loving Nutrition';
const BRAND_LOGO = '/loving-nutrition-logo.png';
const MAX_PAGES = 8;
const MAX_NEW_PER_RUN = 40;

const decodeHtml = (value: string) => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#x2F;/gi, '/')
  .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
  .trim();

const stripTags = (value: string) => decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

function metaContent(html: string, key: string, attr: 'name' | 'property' = 'property') {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}

function firstHeading(html: string) {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return match?.[1] ? stripTags(match[1]) : '';
}

function extractImages(html: string) {
  const matches = html.match(/https:\/\/cdn\.sanity\.io\/images\/g0smbdlu\/production\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g) || [];
  return Array.from(new Set(matches.map((url) => decodeHtml(url).replace(/\\u0026/g, '&')))).slice(0, 12);
}

function extractSlugs(html: string) {
  const slugs = new Set<string>();
  for (const match of html.matchAll(/href=["']\/catalog\/([^"'?#/]+)[^"']*["']/gi)) {
    const slug = String(match[1] || '').trim().toLowerCase();
    if (slug && !['category', 'search'].includes(slug)) slugs.add(slug);
  }
  return Array.from(slugs);
}

function categoryFor(title: string, description: string) {
  const hay = `${title} ${description}`.toLowerCase();
  if (/coffee|matcha|tea\b/.test(hay)) return 'Coffee & Tea';
  if (/serum|moistur|cream|cleanser|soap|shampoo|conditioner|skin|face|facial|body wash|scrub|tallow/.test(hay)) return 'Skincare & Personal Care';
  if (/whey|protein blend|protein powder|collagen protein/.test(hay)) return 'Proteins';
  if (/creatine|pre[- ]?workout|post[- ]?workout|bcaa|electrolyte|hydration powder|amino/.test(hay)) return 'Sports Nutrition';
  if (/mushroom|reishi|lion.?s mane|cordyceps|chaga/.test(hay)) return 'Mushroom Supplements';
  if (/sleep|melatonin|relax|calm/.test(hay)) return 'Sleep & Relaxation';
  if (/joint|bone|cartilage|glucosamine/.test(hay)) return 'Joint & Bone Support';
  if (/gut|digest|probiotic|enzyme|glp-1|liver/.test(hay)) return 'Digestive Support';
  if (/brain|cognitive|focus|memory|bacopa|gotu kola|nootropic/.test(hay)) return 'Brain & Cognitive';
  if (/libido|fertility|reproductive|stamina/.test(hay)) return 'Reproductive Wellness';
  if (/gumm/.test(hay)) return 'Wellness Gummies';
  if (/vitamin|mineral|iron|magnesium|zinc|b12|multivitamin/.test(hay)) return 'Vitamins & Minerals';
  return 'Supplements & Wellness';
}

function affiliateTarget(category: string) {
  if (category === 'Proteins' || category === 'Sports Nutrition') return 10;
  if (category === 'Coffee & Tea') return 5;
  return 7;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Beezio-LovingNutrition-CatalogSync/1.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`Supliful ${response.status} for ${url}`);
  return response.text();
}

async function detailFor(slug: string) {
  const sourceUrl = `${CATALOG_URL}/${slug}`;
  const html = await fetchHtml(sourceUrl);
  const rawTitle = firstHeading(html) || metaContent(html, 'og:title') || slug.replace(/-/g, ' ');
  const title = rawTitle.replace(/\s+[—|-]\s+.*Supliful.*$/i, '').trim();
  const description = metaContent(html, 'description', 'name') || metaContent(html, 'og:description') || '';
  const images = extractImages(html);
  const category = categoryFor(title, description);
  return { slug, sourceUrl, title, description, images, category };
}

async function mapLimit<T, R>(values: T[], limit: number, work: (value: T) => Promise<R>): Promise<R[]> {
  const result: R[] = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await work(values[index]);
    }
  });
  await Promise.all(runners);
  return result;
}

export const handler: Handler = async () => {
  const supabase = createSupabaseAdmin();
  const { data: storefront, error: storefrontError } = await supabase
    .from('storefronts')
    .select('id,owner_id,slug')
    .eq('slug', BRAND_SLUG)
    .eq('is_active', true)
    .maybeSingle();
  if (storefrontError || !storefront?.id || !storefront?.owner_id) {
    throw new Error(`Loving Nutrition storefront unavailable: ${storefrontError?.message || 'not found'}`);
  }

  const [{ data: existingRows, error: existingError }, { data: placements }] = await Promise.all([
    supabase.from('products').select('id,source_url,source_platform').eq('source_platform', 'supliful').limit(1000),
    supabase.from('storefront_products').select('product_id,position').eq('storefront_id', storefront.id).limit(1000),
  ]);
  if (existingError) throw new Error(`Supliful existing lookup failed: ${existingError.message}`);

  const existingUrls = new Set((existingRows || []).map((row: any) => String(row?.source_url || '').trim()).filter(Boolean));
  const existingPlacements = new Set((placements || []).map((row: any) => String(row?.product_id || '').trim()).filter(Boolean));
  let nextPosition = Math.max(0, ...(placements || []).map((row: any) => Number(row?.position || 0))) + 1;

  const discovered = new Set<string>();
  const pageErrors: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    try {
      const html = await fetchHtml(`${CATALOG_URL}?page=${page}`);
      extractSlugs(html).forEach((slug) => discovered.add(slug));
    } catch (error) {
      pageErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const missingSlugs = Array.from(discovered)
    .filter((slug) => !existingUrls.has(`${CATALOG_URL}/${slug}`))
    .slice(0, MAX_NEW_PER_RUN);

  const detailErrors: string[] = [];
  const details = await mapLimit(missingSlugs, 4, async (slug) => {
    try { return await detailFor(slug); }
    catch (error) {
      detailErrors.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });

  let imported = 0;
  for (const detail of details.filter(Boolean) as Awaited<ReturnType<typeof detailFor>>[]) {
    const affiliate = affiliateTarget(detail.category);
    const productId = crypto.randomUUID();
    const supplierInfo = {
      supplier: 'Supliful',
      brand: BRAND_NAME,
      catalog_slug: detail.slug,
      supplier_product_id: null,
      supplier_sku: null,
      brand_logo_url: BRAND_LOGO,
      custom_label_required: true,
      label_status: 'pending_supliful_approval',
      branding_status: 'pending_supliful_label_approval',
      base_cost_status: 'pending_account_cost',
      shipping_status: 'pending_account_quote',
      pricing_status: 'draft_not_for_sale',
      activation_rule: 'require_real_supplier_cost_exact_supplier_id_sku_and_approved_label',
      affiliate_target: affiliate,
      source: 'public_supliful_catalog_preview',
    };

    const { error: insertError } = await supabase.from('products').insert({
      id: productId,
      title: detail.title,
      description: detail.description || `${detail.title} from Supliful, being prepared under the Loving Nutrition brand.`,
      price: 0,
      currency: 'USD',
      images: detail.images,
      category: detail.category,
      product_type: detail.category,
      seller_id: storefront.owner_id,
      status: 'store_only',
      is_active: true,
      is_promotable: false,
      affiliate_enabled: false,
      source_platform: 'supliful',
      source: 'supliful',
      dropship_provider: 'supliful',
      inventory_source: 'supliful',
      external_id: `supliful-public:${detail.slug}`,
      source_url: detail.sourceUrl,
      supplier_cost_amount: 0,
      seller_markup_amount: 0,
      affiliate_payout_amount: affiliate,
      shipping_reserve_amount: 0,
      calculated_customer_price: 0,
      track_inventory: true,
      in_stock: false,
      stock_quantity: 0,
      total_inventory: 0,
      requires_shipping: true,
      is_digital: false,
      import_status: 'awaiting_supliful_cost_and_label',
      supplier_info: supplierInfo,
      api_integration: 'supliful-catalog-preview-v1',
      auto_sync: true,
    });
    if (insertError) {
      detailErrors.push(`${detail.slug}: DB ${insertError.message}`);
      continue;
    }

    if (!existingPlacements.has(productId)) {
      const { error: placementError } = await supabase.from('storefront_products').insert({
        storefront_id: storefront.id,
        product_id: productId,
        position: nextPosition++,
      });
      if (placementError) detailErrors.push(`${detail.slug}: placement ${placementError.message}`);
    }
    existingUrls.add(detail.sourceUrl);
    imported += 1;
  }

  const { count: currentCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('source_platform', 'supliful')
    .neq('status', 'archived');

  console.log(JSON.stringify({
    ok: true,
    discovered: discovered.size,
    missingBeforeRun: missingSlugs.length,
    imported,
    currentCount: currentCount || 0,
    pageErrors: pageErrors.slice(0, 5),
    detailErrors: detailErrors.slice(0, 10),
  }));

  return { statusCode: 202, body: '' };
};

export default handler;