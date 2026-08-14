import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import {
  getCJFreightQuote,
  getCJInventory,
  getCJProductDetail,
  getCJVariantByVid,
} from './_lib/cj-api';
import { parseCJUsd } from '../../shared/cjContract';
import { computeFixedTierPricing } from '../../shared/customerPrice';

const MAX_PRODUCTS_PER_RUN = 5;
const STALE_AUDIT_HOURS = 6;
const MAX_CUSTOMER_PRICE = 499.99;
const MAX_PRICE_INCREASE_RATIO = 0.35;
const MAX_PRICE_INCREASE_ABSOLUTE_FLOOR = 10;

const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const isLiveCJVariant = (row: any): boolean => {
  const raw = row?.variantStatus;
  if (raw === undefined || raw === null || text(raw) === '') return true;
  const status = Number(raw);
  return !Number.isFinite(status) || status !== 0;
};

const countryCode = (value: unknown): string => {
  const normalized = text(value).toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : '';
};

async function quoteVariantFreight(params: {
  vid: string;
  preferredOrigin?: string | null;
  preferredMethod?: string | null;
}) {
  const origins = Array.from(new Set([
    countryCode(params.preferredOrigin),
    'US',
    'CN',
  ].filter(Boolean)));
  let lastError: unknown = null;

  for (const originCountryCode of origins) {
    try {
      const quote = await getCJFreightQuote({
        originCountryCode,
        destinationCountryCode: 'US',
        destinationZip: '10001',
        items: [{ vid: params.vid, quantity: 1 }],
      });
      const preferred = text(params.preferredMethod).toLowerCase();
      const option = quote.options.find((row) =>
        preferred && row.logisticName.toLowerCase() === preferred
      ) || quote.options[0];
      if (!option) continue;
      return { originCountryCode, option };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `No live U.S. freight route for VID ${params.vid}: ${lastError instanceof Error ? lastError.message : 'quote failed'}`
  );
}

function pricingIsUnreasonable(oldPrice: number, newPrice: number, shipping: number): string | null {
  if (!(newPrice > 0) || newPrice > MAX_CUSTOMER_PRICE) {
    return `recalculated customer price ${money(newPrice).toFixed(2)} is outside SupplyLine catalog range`;
  }

  const shippingRatioLimit = newPrice < 50 ? 0.55 : 0.45;
  if (shipping > newPrice * shippingRatioLimit) {
    return `live freight ${money(shipping).toFixed(2)} is too large relative to price ${money(newPrice).toFixed(2)}`;
  }

  if (oldPrice > 0 && newPrice > oldPrice) {
    const allowedIncrease = Math.max(MAX_PRICE_INCREASE_ABSOLUTE_FLOOR, oldPrice * MAX_PRICE_INCREASE_RATIO);
    if (newPrice - oldPrice > allowedIncrease) {
      return `customer price shock ${money(oldPrice).toFixed(2)} -> ${money(newPrice).toFixed(2)} exceeds automatic repricing guard`;
    }
  }

  return null;
}

export const handler: Handler = async (event) => {
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  if (!serviceRoleKey || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const supabase = createSupabaseAdmin();
  const staleBefore = new Date(Date.now() - STALE_AUDIT_HOURS * 60 * 60 * 1000).toISOString();
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id,title,cj_product_id,cj_pid,cj_product_sku,verification_status,is_active,is_promotable,status,created_at,cj_live_audit_status,cj_live_audited_at')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .or(`cj_live_audit_status.neq.passed,cj_live_audited_at.is.null,cj_live_audited_at.lt.${staleBefore}`)
    .order('cj_live_audited_at', { ascending: true, nullsFirst: true })
    .limit(MAX_PRODUCTS_PER_RUN);

  if (productError || !products?.length) return { statusCode: 202, body: '' };

  for (const product of products as any[]) {
    const checkedAt = new Date().toISOString();
    const issues: string[] = [];
    const repriced: any[] = [];
    const pid = text(product?.cj_pid || product?.cj_product_id);

    try {
      if (!pid) throw new Error('missing CJ PID/product id');
      const live = await getCJProductDetail({
        pid,
        productSku: text(product?.cj_product_sku) || null,
      });
      const allLiveRows = Array.isArray(live?.variants) ? live.variants : [];
      const liveVariants = allLiveRows.filter(isLiveCJVariant);
      const liveByVid = new Map(liveVariants.map((row: any) => [text(row?.vid), row]));

      const [{ data: savedVariants, error: variantError }, { data: mappings, error: mappingError }] = await Promise.all([
        supabase
          .from('product_variants')
          .select('id,cj_product_id,cj_variant_id,cj_vid,cj_variant_sku,supplier_cost_amount,seller_markup_amount,seller_payout_amount,affiliate_payout_amount,shipping_reserve_amount,calculated_customer_price,price,is_orderable,order_reference_type,import_status,is_active,inventory')
          .eq('product_id', product.id)
          .or('source_platform.eq.cj,source.eq.cj,provider.eq.CJ'),
        supabase
          .from('cj_variant_mappings')
          .select('id,product_variant_id,beezio_product_id,cj_product_id,cj_vid,cj_variant_sku,supplier_cost_amount,origin_country_code,freight_method,freight_cost_amount,freight_destination_country,freight_quoted_at,price_verified_at,is_active')
          .eq('beezio_product_id', product.id),
      ]);

      if (variantError) throw new Error(`saved variant lookup failed: ${variantError.message}`);
      if (mappingError) throw new Error(`private mapping lookup failed: ${mappingError.message}`);

      const allSaved = (savedVariants || []) as any[];
      const saved = allSaved.filter((variant) => variant?.is_active !== false);
      const allMappings = (mappings || []) as any[];
      const privateMappings = allMappings.filter((mapping) => mapping?.is_active !== false);
      const mappingByVariantId = new Map(privateMappings.map((row) => [text(row?.product_variant_id), row]));
      const seenVids = new Set<string>();

      if (!liveVariants.length) issues.push('CJ returned no currently live variants');
      if (saved.length !== liveVariants.length) issues.push(`live variant count mismatch: saved active ${saved.length}, CJ active ${liveVariants.length}`);
      if (privateMappings.length !== saved.length) issues.push(`active private mapping count mismatch: ${privateMappings.length} vs saved active ${saved.length}`);

      // Product detail is used to prove the complete current variant set. Exact
      // queryByVid is used below as the authority for each VID's SKU and price.
      for (const variant of saved) {
        const vid = text(variant?.cj_vid);
        const savedSku = text(variant?.cj_variant_sku);
        if (!vid) {
          issues.push(`saved active variant ${variant?.id} has no CJ VID`);
          continue;
        }
        if (seenVids.has(vid)) issues.push(`duplicate saved active CJ VID ${vid}`);
        seenVids.add(vid);

        if (variant?.is_orderable !== true || text(variant?.order_reference_type).toLowerCase() !== 'cj_vid') {
          issues.push(`VID ${vid} is not orderable by exact CJ VID`);
        }

        const detailVariant: any = liveByVid.get(vid);
        if (!detailVariant) {
          issues.push(`CJ no longer returned VID ${vid} as an active variant`);
          continue;
        }

        const detailSku = text(detailVariant?.variantSku);
        if (!savedSku || detailSku !== savedSku) {
          issues.push(`VID ${vid} product-detail SKU mismatch: saved ${savedSku || '(blank)'}, CJ ${detailSku || '(blank)'}`);
        }

        const mapping: any = mappingByVariantId.get(text(variant?.id));
        if (!mapping) {
          issues.push(`VID ${vid} has no active private fulfillment mapping`);
          continue;
        }
        if (text(mapping?.beezio_product_id) !== text(product.id)) issues.push(`VID ${vid} mapping points to wrong Beezio product`);
        if (text(mapping?.cj_product_id) !== pid) issues.push(`VID ${vid} mapping points to wrong CJ product`);
        if (text(mapping?.cj_vid) !== vid) issues.push(`VID ${vid} private mapping VID mismatch`);
        if (text(mapping?.cj_variant_sku) !== savedSku) issues.push(`VID ${vid} private mapping SKU mismatch`);
      }

      if (issues.length) {
        throw new Error(`CJ identity contract failed: ${issues.join('; ')}`);
      }

      let totalInventory = 0;
      let anyInStock = false;
      const updatedVariantRows: any[] = [];

      for (const variant of saved) {
        const vid = text(variant.cj_vid);
        const mapping: any = mappingByVariantId.get(text(variant.id));

        // queryByVid is the price/SKU authority because CJ product/query can lag
        // behind the exact variant endpoint. This is also the endpoint used by
        // the sandbox/order safety checks.
        const exactVariant: any = await getCJVariantByVid(vid);
        if (text(exactVariant?.vid) !== vid) {
          throw new Error(`VID ${vid} exact-query identity mismatch`);
        }
        const exactSku = text(exactVariant?.variantSku);
        const savedSku = text(variant?.cj_variant_sku);
        if (!exactSku || exactSku !== savedSku) {
          throw new Error(`VID ${vid} exact-query SKU mismatch: saved ${savedSku || '(blank)'}, CJ ${exactSku || '(blank)'}`);
        }
        const liveCost = money(parseCJUsd(exactVariant?.variantSellPrice));
        if (!(liveCost > 0)) throw new Error(`VID ${vid} exact query returned invalid live supplier cost`);

        const freight = await quoteVariantFreight({
          vid,
          preferredOrigin: mapping?.origin_country_code,
          preferredMethod: mapping?.freight_method,
        });
        const shipping = money(freight.option.totalPostageFee);
        const sellerMarkup = money(variant?.seller_markup_amount);
        const affiliatePayout = money(variant?.affiliate_payout_amount);
        const sellerPayout = money(liveCost + sellerMarkup);
        const pricing = computeFixedTierPricing({
          supplierCost: liveCost,
          sellerMarkup,
          affiliatePayout,
          shippingIncluded: shipping,
        });
        const oldPrice = money(variant?.calculated_customer_price || variant?.price);
        const guardReason = pricingIsUnreasonable(oldPrice, pricing.finalAdvertisedPrice, shipping);
        if (guardReason) throw new Error(`VID ${vid}: ${guardReason}`);

        let inventory = Number(variant?.inventory || 0);
        try {
          const liveInventory = await getCJInventory(pid, vid);
          if (liveInventory !== null && Number.isFinite(liveInventory)) inventory = Math.max(0, Math.floor(liveInventory));
        } catch {
          // Stock webhooks and checkout provide additional protection. Do not fail
          // an otherwise valid pricing audit solely on a temporary stock lookup error.
        }
        totalInventory += inventory;
        if (inventory > 0) anyInStock = true;

        const mutableChanged =
          Math.abs(money(variant?.supplier_cost_amount) - liveCost) > 0.01 ||
          Math.abs(money(mapping?.supplier_cost_amount) - liveCost) > 0.01 ||
          Math.abs(money(variant?.shipping_reserve_amount) - shipping) > 0.01 ||
          Math.abs(money(mapping?.freight_cost_amount) - shipping) > 0.01 ||
          Math.abs(oldPrice - money(pricing.finalAdvertisedPrice)) > 0.01 ||
          text(mapping?.freight_method) !== text(freight.option.logisticName) ||
          countryCode(mapping?.origin_country_code) !== freight.originCountryCode;

        const variantUpdate = {
          supplier_cost_amount: liveCost,
          seller_payout_amount: sellerPayout,
          shipping_reserve_amount: shipping,
          calculated_customer_price: money(pricing.finalAdvertisedPrice),
          price: money(pricing.finalAdvertisedPrice),
          cost_cents: Math.round(liveCost * 100),
          retail_price_cents: Math.round(money(pricing.finalAdvertisedPrice) * 100),
          inventory,
          in_stock: inventory > 0,
          cj_freight_method: freight.option.logisticName,
          cj_freight_origin_country: freight.originCountryCode,
          cj_freight_destination_country: 'US',
          cj_freight_quoted_at: checkedAt,
          cj_price_verified_at: checkedAt,
          import_status: 'ready',
          updated_at: checkedAt,
        };

        const { error: variantUpdateError } = await supabase
          .from('product_variants')
          .update(variantUpdate)
          .eq('id', variant.id);
        if (variantUpdateError) throw new Error(`VID ${vid} variant reprice failed: ${variantUpdateError.message}`);

        const { error: mappingUpdateError } = await supabase
          .from('cj_variant_mappings')
          .update({
            supplier_cost_amount: liveCost,
            origin_country_code: freight.originCountryCode,
            freight_method: freight.option.logisticName,
            freight_cost_amount: shipping,
            freight_destination_country: 'US',
            freight_quoted_at: checkedAt,
            price_verified_at: checkedAt,
            raw_supplier_payload: exactVariant || {},
            is_active: true,
            updated_at: checkedAt,
          })
          .eq('id', mapping.id);
        if (mappingUpdateError) throw new Error(`VID ${vid} private mapping reprice failed: ${mappingUpdateError.message}`);

        updatedVariantRows.push({
          id: variant.id,
          vid,
          exact_variant_sku: exactSku,
          pricing_source: 'product/variant/queryByVid',
          old_supplier_cost: money(variant?.supplier_cost_amount),
          new_supplier_cost: liveCost,
          seller_markup: sellerMarkup,
          seller_payout: sellerPayout,
          affiliate_payout: affiliatePayout,
          old_shipping: money(variant?.shipping_reserve_amount),
          new_shipping: shipping,
          old_customer_price: oldPrice,
          new_customer_price: money(pricing.finalAdvertisedPrice),
          inventory,
          changed: mutableChanged,
        });

        if (mutableChanged) repriced.push(updatedVariantRows[updatedVariantRows.length - 1]);
      }

      const maxCustomerPrice = Math.max(...updatedVariantRows.map((row) => Number(row.new_customer_price || 0)));
      const maxSellerPayout = Math.max(...updatedVariantRows.map((row) => Number(row.seller_payout || 0)));
      const maxAffiliatePayout = Math.max(...updatedVariantRows.map((row) => Number(row.affiliate_payout || 0)));

      const details = {
        checked_at: checkedAt,
        cj_product_id: pid,
        price_authority: 'product/variant/queryByVid',
        saved_active_variant_count: saved.length,
        saved_inactive_variant_count: allSaved.length - saved.length,
        cj_active_variant_count: liveVariants.length,
        cj_inactive_variant_count: allLiveRows.length - liveVariants.length,
        active_private_mapping_count: privateMappings.length,
        inactive_private_mapping_count: allMappings.length - privateMappings.length,
        repriced_variant_count: repriced.length,
        repriced_variants: repriced,
        issues: [],
      };

      // Variant/mapping writes intentionally invalidate the audit through DB triggers.
      // This final product write certifies the complete refreshed snapshot again.
      const { error: productUpdateError } = await supabase.from('products').update({
        price: money(maxCustomerPrice),
        calculated_customer_price: money(maxCustomerPrice),
        seller_ask: money(maxSellerPayout),
        seller_amount: money(maxSellerPayout),
        seller_ask_price: money(maxSellerPayout),
        affiliate_payout_amount: money(maxAffiliatePayout),
        stock_quantity: totalInventory,
        total_inventory: totalInventory,
        in_stock: anyInStock,
        import_status: 'ready',
        cj_live_audit_status: 'passed',
        cj_live_audited_at: checkedAt,
        cj_live_audit_details: details,
        updated_at: checkedAt,
      }).eq('id', product.id);
      if (productUpdateError) throw new Error(`parent product reprice failed: ${productUpdateError.message}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failureDetails = {
        checked_at: checkedAt,
        cj_product_id: pid || null,
        issues,
        repriced_variants_before_failure: repriced,
        error: message,
      };

      await supabase.from('products').update({
        is_active: false,
        is_promotable: false,
        status: 'draft',
        import_status: 'needs_review',
        verification_status: 'failed',
        verified_at: null,
        cj_live_audit_status: 'failed',
        cj_live_audited_at: checkedAt,
        cj_live_audit_details: failureDetails,
        updated_at: checkedAt,
      }).eq('id', product.id);
    }
  }

  return { statusCode: 202, body: '' };
};

export default handler;
