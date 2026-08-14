import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { requireAdmin } from './_lib/auth';
import { getCJProductDetail } from './_lib/cj-api';
import { parseCJUsd } from '../../shared/cjContract';

const MAX_BATCH = 25;
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const text = (value: unknown) => String(value ?? '').trim();
const isHttps = (value: unknown) => /^https:\/\//i.test(text(value));
const isSupplierHosted = (value: unknown) => {
  const url = text(value).toLowerCase();
  return url.includes('cjdropshipping.com') || url.includes('aliyuncs.com');
};

const response = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

type AuditReport = {
  product_id: string;
  cj_product_id: string | null;
  title: string;
  passed: boolean;
  database_passed: boolean;
  live_cj_passed: boolean | null;
  saved_variant_count: number;
  live_variant_count: number | null;
  issues: string[];
  verification_status: string | null;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    await requireAdmin(event as any);
    const supabase = createSupabaseAdmin();
    const body = JSON.parse(event.body || '{}');
    const requestedIds = Array.from(
      new Set((Array.isArray(body?.product_ids) ? body.product_ids : []).map(text).filter(Boolean))
    ).slice(0, MAX_BATCH);
    const liveCheck = body?.live_check !== false;

    let productQuery = supabase
      .from('products')
      .select('id,title,cj_product_id,cj_pid,cj_product_sku,cj_product_code,cj_spu,source,source_platform,dropship_provider,status,is_active,is_promotable,import_status,verification_status,images,videos,created_at')
      .or('source_platform.eq.cj,source.eq.cj,dropship_provider.eq.cj')
      .order('created_at', { ascending: false })
      .limit(MAX_BATCH);

    if (requestedIds.length) productQuery = productQuery.in('id', requestedIds);
    const { data: products, error: productError } = await productQuery;
    if (productError) throw new Error(`CJ product audit lookup failed: ${productError.message}`);

    const reports: AuditReport[] = [];
    for (const product of (products || []) as any[]) {
      const productId = text(product.id);
      const cjProductId = text(product.cj_product_id || product.cj_pid) || null;
      const issues: string[] = [];

      const [{ data: variants, error: variantError }, { data: mappings, error: mappingError }, { data: productMappings, error: productMappingError }, { data: placements, error: placementError }] = await Promise.all([
        supabase
          .from('product_variants')
          .select('id,cj_product_id,cj_variant_id,cj_vid,cj_variant_sku,sku,is_orderable,order_reference_type,supplier_cost_amount,shipping_reserve_amount,calculated_customer_price,cj_freight_method,cj_freight_destination_country,cj_freight_quoted_at,cj_price_verified_at,image_url,import_status,is_active')
          .eq('product_id', productId)
          .or('source_platform.eq.cj,source.eq.cj,provider.eq.CJ'),
        supabase
          .from('cj_variant_mappings')
          .select('product_variant_id,cj_product_id,cj_vid,cj_variant_sku,supplier_cost_amount,freight_method,freight_cost_amount,freight_destination_country,freight_quoted_at,price_verified_at,is_active')
          .eq('beezio_product_id', productId),
        supabase
          .from('cj_product_mappings')
          .select('cj_product_id,cj_product_sku,cj_variant_id,price_breakdown,last_synced')
          .eq('beezio_product_id', productId),
        supabase
          .from('storefront_products')
          .select('storefront_id,storefronts!inner(slug,is_active)')
          .eq('product_id', productId)
          .eq('storefronts.slug', 'supplyline-plus'),
      ]);

      if (variantError) issues.push(`variant lookup: ${variantError.message}`);
      if (mappingError) issues.push(`private mapping lookup: ${mappingError.message}`);
      if (productMappingError) issues.push(`product mapping lookup: ${productMappingError.message}`);
      if (placementError) issues.push(`storefront placement lookup: ${placementError.message}`);

      const savedVariants = (variants || []) as any[];
      const privateMappings = (mappings || []) as any[];
      const parentMappings = (productMappings || []) as any[];
      const supplylinePlacements = (placements || []) as any[];
      const mappingByVariantId = new Map(privateMappings.map((row) => [text(row.product_variant_id), row]));
      const seenVids = new Set<string>();

      if (!cjProductId) issues.push('missing CJ product id/PID');
      if (!text(product.cj_pid)) issues.push('missing CJ PID');
      if (!text(product.cj_product_sku || product.cj_product_code || product.cj_spu)) issues.push('missing CJ product SKU/code/SPU');
      if (!savedVariants.length) issues.push('no CJ variants saved');
      if (privateMappings.length !== savedVariants.length) issues.push(`private mapping count ${privateMappings.length} != saved variant count ${savedVariants.length}`);
      if (!parentMappings.some((row) => row?.price_breakdown?.verification?.verified === true)) issues.push('CJ product mapping is not API-verified');
      if (!supplylinePlacements.some((row) => row?.storefronts?.slug === 'supplyline-plus' && row?.storefronts?.is_active === true)) issues.push('not placed in active SupplyLine Plus storefront');

      const productImages = Array.isArray(product.images) ? product.images : [];
      const productVideos = Array.isArray(product.videos) ? product.videos : [];
      if (!productImages.length) issues.push('no cached product images');
      if (productImages.some((url: unknown) => !isHttps(url) || isSupplierHosted(url))) issues.push('product image is invalid or still supplier-hosted');
      if (productVideos.some((url: unknown) => !isHttps(url) || isSupplierHosted(url))) issues.push('product video is invalid or still supplier-hosted');

      for (const variant of savedVariants) {
        const vid = text(variant.cj_vid);
        const variantSku = text(variant.cj_variant_sku);
        const mapping = mappingByVariantId.get(text(variant.id));
        if (!vid) issues.push(`variant ${variant.id}: missing exact CJ VID`);
        else if (seenVids.has(vid)) issues.push(`duplicate CJ VID ${vid}`);
        else seenVids.add(vid);
        if (!text(variant.cj_variant_id)) issues.push(`variant ${vid || variant.id}: missing CJ variant id`);
        if (!variantSku) issues.push(`variant ${vid || variant.id}: missing CJ variant SKU`);
        if (variant.is_orderable !== true || text(variant.order_reference_type).toLowerCase() !== 'cj_vid') issues.push(`variant ${vid || variant.id}: not orderable by exact VID`);
        if (!(Number(variant.supplier_cost_amount) > 0)) issues.push(`variant ${vid || variant.id}: invalid supplier cost`);
        if (!(Number(variant.calculated_customer_price) > 0)) issues.push(`variant ${vid || variant.id}: invalid customer price`);
        if (Number(variant.shipping_reserve_amount) < 0 || !text(variant.cj_freight_method)) issues.push(`variant ${vid || variant.id}: missing freight quote`);
        if (text(variant.cj_freight_destination_country).toUpperCase() !== 'US') issues.push(`variant ${vid || variant.id}: freight destination is not US`);
        if (!variant.cj_freight_quoted_at || !variant.cj_price_verified_at) issues.push(`variant ${vid || variant.id}: missing freight/price verification timestamps`);
        if (!isHttps(variant.image_url) || isSupplierHosted(variant.image_url)) issues.push(`variant ${vid || variant.id}: image is invalid or supplier-hosted`);
        if (text(variant.import_status).toLowerCase() === 'needs_review') issues.push(`variant ${vid || variant.id}: marked needs_review`);
        if (!mapping) {
          issues.push(`variant ${vid || variant.id}: no private fulfillment mapping`);
          continue;
        }
        if (text(mapping.cj_vid) !== vid) issues.push(`variant ${vid || variant.id}: private VID mismatch`);
        if (variantSku && text(mapping.cj_variant_sku) !== variantSku) issues.push(`variant ${vid || variant.id}: private SKU mismatch`);
        if (cjProductId && text(mapping.cj_product_id) !== cjProductId) issues.push(`variant ${vid || variant.id}: private product id mismatch`);
        if (Math.abs(money(mapping.supplier_cost_amount) - money(variant.supplier_cost_amount)) > 0.01) issues.push(`variant ${vid || variant.id}: supplier cost mapping mismatch`);
        if (Math.abs(money(mapping.freight_cost_amount) - money(variant.shipping_reserve_amount)) > 0.01) issues.push(`variant ${vid || variant.id}: freight mapping mismatch`);
      }

      const databasePassed = issues.length === 0;
      let liveCjPassed: boolean | null = liveCheck ? false : null;
      let liveVariantCount: number | null = null;

      if (liveCheck && cjProductId) {
        try {
          const detail = await getCJProductDetail({
            pid: text(product.cj_pid || product.cj_product_id) || null,
            productSku: text(product.cj_product_sku) || null,
          });
          const liveVariants = Array.isArray(detail?.variants) ? detail.variants : [];
          liveVariantCount = liveVariants.length;
          const liveByVid = new Map(liveVariants.map((row: any) => [text(row?.vid), row]));

          if (liveVariants.length !== savedVariants.length) {
            issues.push(`live CJ variant count ${liveVariants.length} != saved count ${savedVariants.length}`);
          }

          for (const variant of savedVariants) {
            const vid = text(variant.cj_vid);
            const live = liveByVid.get(vid) as any;
            if (!live) {
              issues.push(`live CJ no longer contains VID ${vid || variant.id}`);
              continue;
            }
            const liveSku = text(live?.variantSku);
            const savedSku = text(variant.cj_variant_sku);
            if (savedSku && liveSku !== savedSku) issues.push(`VID ${vid}: live SKU ${liveSku || '(blank)'} != saved SKU ${savedSku}`);
            const liveCost = parseCJUsd(live?.variantSellPrice);
            if (liveCost > 0 && Math.abs(money(liveCost) - money(variant.supplier_cost_amount)) > 0.01) {
              issues.push(`VID ${vid}: live supplier cost ${money(liveCost).toFixed(2)} != saved ${money(variant.supplier_cost_amount).toFixed(2)}`);
            }
          }
          liveCjPassed = !issues.some((issue) => issue.startsWith('live CJ') || issue.startsWith('VID '));
        } catch (error) {
          issues.push(`live CJ check failed: ${error instanceof Error ? error.message : String(error)}`);
          liveCjPassed = false;
        }
      }

      const passed = databasePassed && (liveCjPassed !== false) && issues.length === 0;
      if (passed) {
        const { data: activated, error: activationError } = await supabase
          .from('products')
          .update({ is_active: true, is_promotable: true, status: 'active', updated_at: new Date().toISOString() })
          .eq('id', productId)
          .select('verification_status,is_active,is_promotable,status')
          .single();
        if (activationError) issues.push(`activation verification failed: ${activationError.message}`);
        else if (text(activated?.verification_status) !== 'verified' || activated?.is_active !== true) issues.push('database activation gate did not certify product');
      } else {
        await supabase
          .from('products')
          .update({
            is_active: false,
            is_promotable: false,
            status: 'draft',
            verification_status: 'failed',
            verified_at: null,
            verification_details: {
              audit_source: 'cj-verify-catalog',
              checked_at: new Date().toISOString(),
              issues,
              saved_variant_count: savedVariants.length,
              live_variant_count: liveVariantCount,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', productId);
      }

      const { data: refreshed } = await supabase
        .from('products')
        .select('verification_status')
        .eq('id', productId)
        .maybeSingle();

      reports.push({
        product_id: productId,
        cj_product_id: cjProductId,
        title: text(product.title),
        passed: issues.length === 0 && passed,
        database_passed: databasePassed,
        live_cj_passed: liveCjPassed,
        saved_variant_count: savedVariants.length,
        live_variant_count: liveVariantCount,
        issues,
        verification_status: text(refreshed?.verification_status) || null,
      });
    }

    return response(200, {
      ok: reports.length > 0 && reports.every((report) => report.passed),
      max_batch: MAX_BATCH,
      checked: reports.length,
      passed: reports.filter((report) => report.passed).length,
      failed: reports.filter((report) => !report.passed).length,
      live_check: liveCheck,
      reports,
    });
  } catch (error: any) {
    const statusCode = Number(error?.statusCode) || 500;
    return response(statusCode, { error: error instanceof Error ? error.message : 'CJ catalog audit failed' });
  }
};

export default handler;
