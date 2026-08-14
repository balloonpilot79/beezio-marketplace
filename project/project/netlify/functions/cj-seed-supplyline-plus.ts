import type { Handler } from '@netlify/functions';
import {
  getCJFreightQuote,
  getCJInventoryOrigins,
  getCJProductDetail,
  getCJProductVideos,
} from './_lib/cj-api';
import {
  SUPPLYLINE_SEED_TARGET_COUNT,
  getRemainingSupplyLineSeedCandidates,
  getSupplyLinePlayableVideoUrls,
  getSupplyLineSeedPricing,
  isSupplyLineSeedProductComplete,
  type SupplyLineSeedCandidate,
} from './_lib/cj-supplyline-seed';
import { syncCJWebhookSubscriptions } from './_lib/cj-webhook-subscriptions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json } from './_lib/http';

const text = (value: unknown): string => String(value ?? '').trim();

const extractUrls = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(extractUrls);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    if (raw.startsWith('[')) {
      try {
        return extractUrls(JSON.parse(raw));
      } catch {
        // Fall through to normal string handling.
      }
    }
    return raw.includes(',') ? raw.split(',').map((item) => item.trim()).filter(Boolean) : [raw];
  }
  if (typeof value === 'object') {
    const candidate = (value as any)?.url ?? (value as any)?.image ?? (value as any)?.src ??
      (value as any)?.videoUrl ?? (value as any)?.video_url;
    return candidate ? [text(candidate)] : [];
  }
  return [];
};

const unique = (values: unknown[]): string[] =>
  Array.from(new Set(values.map(text).filter(Boolean)));

async function prepareCandidate(candidate: SupplyLineSeedCandidate) {
  const detail = await getCJProductDetail({ pid: candidate.cjProductId });
  // Product detail can return video IDs rather than URLs. Only the separate
  // video endpoint (or a true HTTPS URL in detail) proves the media can be
  // downloaded and cached for storefront playback.
  const videosFromDetail = getSupplyLinePlayableVideoUrls([
    ...extractUrls(detail?.productVideoList),
    ...extractUrls(detail?.videoList),
    ...extractUrls(detail?.videos),
    ...extractUrls(detail?.productVideo),
    ...extractUrls(detail?.productVideoUrl),
    ...extractUrls(detail?.videoUrl),
  ]);
  let videos = videosFromDetail;
  try {
    const assets = await getCJProductVideos(candidate.cjProductId);
    videos = getSupplyLinePlayableVideoUrls([...assets.map((asset) => asset.videoUrl), ...videosFromDetail]);
  } catch (error) {
    console.warn('SupplyLine seed video lookup fallback:', error instanceof Error ? error.message : error);
  }
  if (!videos.length) throw new Error('No CJ product video was available.');

  const preparedVariants: any[] = [];
  const freightQuotes: any[] = [];
  const sourceVariants = Array.isArray(detail?.variants) ? detail.variants.slice(0, 12) : [];
  for (const variant of sourceVariants) {
    if (preparedVariants.length >= 2) break;
    const vid = text(variant?.vid);
    const supplierCost = Number(variant?.variantSellPrice);
    if (!vid || !Number.isFinite(supplierCost) || supplierCost <= 0) continue;

    const origins = (await getCJInventoryOrigins(candidate.cjProductId, vid))
      .filter((origin) => origin.available > 0)
      .sort((left, right) => {
        const priority = (country: string) => country === 'US' ? 0 : country === 'CN' ? 1 : 2;
        return priority(left.countryCode) - priority(right.countryCode) || right.available - left.available;
      });
    if (!origins.length) continue;

    let selectedOrigin: typeof origins[number] | null = null;
    let selectedFreight: Awaited<ReturnType<typeof getCJFreightQuote>>['options'][number] | null = null;
    for (const origin of origins.slice(0, 3)) {
      try {
        const freight = await getCJFreightQuote({
          originCountryCode: origin.countryCode,
          destinationCountryCode: 'US',
          destinationZip: '10001',
          items: [{ vid, quantity: 1 }],
        });
        if (freight.options[0]) {
          selectedOrigin = origin;
          selectedFreight = freight.options[0];
          break;
        }
      } catch {
        // Try the next live origin reported for this exact VID.
      }
    }
    if (!selectedOrigin || !selectedFreight) continue;

    preparedVariants.push({
      ...variant,
      vid,
      variantStock: origins.reduce((sum, origin) => sum + origin.available, 0),
      variantSellPrice: supplierCost,
    });
    freightQuotes.push({
      vid,
      originCountryCode: selectedOrigin.countryCode,
      destinationCountryCode: 'US',
      destinationZip: '10001',
      logisticName: selectedFreight.logisticName,
      logisticAging: selectedFreight.logisticAging,
      logisticPrice: selectedFreight.logisticPrice,
      taxesFee: selectedFreight.taxesFee,
      clearanceOperationFee: selectedFreight.clearanceOperationFee,
      tariff: selectedFreight.tariff,
      totalPostageFee: selectedFreight.totalPostageFee,
      quotedAt: new Date().toISOString(),
    });
  }

  if (preparedVariants.length < 2) {
    throw new Error('Fewer than two exact variants had both live stock and live U.S. freight.');
  }

  const supplierCosts = preparedVariants.map((variant) => Number(variant.variantSellPrice));
  const maxSupplierCost = Math.max(...supplierCosts);
  const pricing = getSupplyLineSeedPricing(maxSupplierCost);
  const inventory = preparedVariants.reduce((sum, variant) => sum + Number(variant.variantStock || 0), 0);
  const images = unique([
    ...extractUrls(detail?.productImageList),
    ...preparedVariants.flatMap((variant) => extractUrls(variant?.variantImage)),
    detail?.productImage,
  ]).slice(0, 8);

  return {
    cjProduct: {
      pid: candidate.cjProductId,
      productNameEn: text(detail?.productNameEn),
      productSku: text(detail?.productSku),
      productImage: images[0] || text(detail?.productImage),
      categoryName: candidate.category,
      sellPrice: maxSupplierCost,
    },
    detailedProduct: {
      description: text(detail?.description),
      productImageList: images,
      productVideoList: videos.slice(0, 1),
      productWeight: detail?.productWeight,
      packingWeight: detail?.packingWeight,
      originCountry: freightQuotes[0].originCountryCode,
    },
    selectedVariant: preparedVariants[0],
    variants: preparedVariants,
    inventory,
    pricing: {
      markup: pricing.markup,
      markupType: 'flat',
      affiliateCommission: pricing.affiliateCommission,
      affiliateCommissionType: 'flat',
    },
    variantFreightQuotes: freightQuotes,
    videos: videos.slice(0, 1),
    beezioCategory: candidate.category,
    categoryId: null,
    computed: { finalPrice: 1, sellerAsk: 1 },
  };
}

export const handler: Handler = async () => {
  const supabaseAdmin = createSupabaseAdmin();
  try {
    const { data: mappings, error: mappingError } = await supabaseAdmin
      .from('cj_product_mappings')
      .select('beezio_product_id,cj_product_id,price_breakdown');
    if (mappingError) throw new Error(mappingError.message);
    const mappedBeezioProductIds = unique((mappings || []).map((row: any) => row?.beezio_product_id));
    const { data: mappedProducts, error: productsError } = mappedBeezioProductIds.length
      ? await supabaseAdmin
          .from('products')
          .select('id,source_platform,videos,retail_price_cents,base_cost_cents,shipping_estimate_cents,calculated_customer_price,markup_value,affiliate_floor_cents')
          .in('id', mappedBeezioProductIds)
      : { data: [], error: null };
    if (productsError) throw new Error(productsError.message);
    const productById = new Map((mappedProducts || []).map((row: any) => [text(row?.id), row]));
    const completeProductIds = unique((mappings || []).flatMap((row: any) => {
      const subscribed = row?.price_breakdown?.cj_webhook_subscription?.status === 'subscribed';
      return subscribed && isSupplyLineSeedProductComplete(productById.get(text(row?.beezio_product_id)))
        ? [row?.cj_product_id]
        : [];
    }));
    const existingSeedCount = completeProductIds.filter((productId) =>
      getRemainingSupplyLineSeedCandidates([]).some((candidate) => candidate.cjProductId === productId)
    ).length;
    if (existingSeedCount >= SUPPLYLINE_SEED_TARGET_COUNT) {
      return json(200, { ok: true, skipped: 'SupplyLine Plus launch seed is complete.' });
    }

    const failures: Array<{ cj_product_id: string; error: string }> = [];
    for (const candidate of getRemainingSupplyLineSeedCandidates(completeProductIds)) {
      try {
        const payload = await prepareCandidate(candidate);
        const supabaseUrl = text(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, '');
        const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
        if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server credentials are missing.');
        const response = await fetch(`${supabaseUrl}/functions/v1/import-cj-product`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'X-Beezio-Internal-Import': 'supplyline-plus',
          },
          body: JSON.stringify(payload),
        });
        const raw = await response.text();
        let body: any = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch {
          body = null;
        }
        if (!response.ok || !body?.product?.id) {
          throw new Error(body?.details || body?.error || raw || `Import failed (${response.status})`);
        }
        if (!isSupplyLineSeedProductComplete(body.product)) {
          throw new Error('Imported product failed normalized pricing or cached-video verification.');
        }

        const subscription = await syncCJWebhookSubscriptions({
          supabaseAdmin,
          onlyProductIds: [candidate.cjProductId],
        });
        if (!subscription.ok) {
          throw new Error('Product imported, but CJ did not confirm its webhook subscription.');
        }
        return json(200, {
          ok: true,
          imported_product_id: body.product.id,
          variants_imported: payload.variants.length,
          video_cached: Array.isArray(body.product.videos) && body.product.videos.length > 0,
          webhook_subscribed: true,
        });
      } catch (error) {
        failures.push({
          cj_product_id: candidate.cjProductId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return json(502, { error: 'No launch candidate passed every live CJ check.', failures });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : 'Unexpected error' });
  }
};

export default handler;
