import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { getCJProductDetail } from './_lib/cj-api';
import { parseCJUsd } from '../../shared/cjContract';

const MAX_PRODUCTS_PER_RUN = 5;
const text = (value: unknown) => String(value ?? '').trim();
const money = (value: unknown) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const handler: Handler = async (event) => {
  const serviceRoleKey = text(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const suppliedToken = text(event.headers.authorization || event.headers.Authorization).replace(/^Bearer\s+/i, '');
  if (!serviceRoleKey || suppliedToken !== serviceRoleKey) return { statusCode: 403, body: '' };

  const supabase = createSupabaseAdmin();
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id,title,cj_product_id,cj_pid,cj_product_sku,verification_status,is_active,is_promotable,status,created_at')
    .eq('source_platform', 'cj')
    .eq('verification_status', 'verified')
    .eq('is_active', true)
    .eq('is_promotable', true)
    .neq('cj_live_audit_status', 'passed')
    .order('created_at', { ascending: true })
    .limit(MAX_PRODUCTS_PER_RUN);

  if (productError || !products?.length) return { statusCode: 202, body: '' };

  for (const product of products as any[]) {
    const checkedAt = new Date().toISOString();
    const issues: string[] = [];
    const pid = text(product?.cj_pid || product?.cj_product_id);

    try {
      if (!pid) throw new Error('missing CJ PID/product id');
      const live = await getCJProductDetail({
        pid,
        productSku: text(product?.cj_product_sku) || null,
      });
      const liveVariants = Array.isArray(live?.variants) ? live.variants : [];
      const liveByVid = new Map(liveVariants.map((row: any) => [text(row?.vid), row]));

      const [{ data: savedVariants, error: variantError }, { data: mappings, error: mappingError }] = await Promise.all([
        supabase
          .from('product_variants')
          .select('id,cj_product_id,cj_variant_id,cj_vid,cj_variant_sku,supplier_cost_amount,is_orderable,order_reference_type,import_status')
          .eq('product_id', product.id)
          .or('source_platform.eq.cj,source.eq.cj,provider.eq.CJ'),
        supabase
          .from('cj_variant_mappings')
          .select('product_variant_id,beezio_product_id,cj_product_id,cj_vid,cj_variant_sku,supplier_cost_amount,is_active')
          .eq('beezio_product_id', product.id),
      ]);

      if (variantError) throw new Error(`saved variant lookup failed: ${variantError.message}`);
      if (mappingError) throw new Error(`private mapping lookup failed: ${mappingError.message}`);

      const saved = (savedVariants || []) as any[];
      const privateMappings = (mappings || []) as any[];
      const mappingByVariantId = new Map(privateMappings.map((row) => [text(row?.product_variant_id), row]));
      const seenVids = new Set<string>();

      if (!liveVariants.length) issues.push('CJ returned no live variants');
      if (saved.length !== liveVariants.length) issues.push(`variant count mismatch: saved ${saved.length}, CJ ${liveVariants.length}`);
      if (privateMappings.length !== saved.length) issues.push(`private mapping count mismatch: ${privateMappings.length} vs ${saved.length}`);

      for (const variant of saved) {
        const vid = text(variant?.cj_vid);
        const savedSku = text(variant?.cj_variant_sku);
        if (!vid) {
          issues.push(`saved variant ${variant?.id} has no CJ VID`);
          continue;
        }
        if (seenVids.has(vid)) issues.push(`duplicate saved CJ VID ${vid}`);
        seenVids.add(vid);

        if (variant?.is_orderable !== true || text(variant?.order_reference_type).toLowerCase() !== 'cj_vid') {
          issues.push(`VID ${vid} is not orderable by exact CJ VID`);
        }

        const liveVariant: any = liveByVid.get(vid);
        if (!liveVariant) {
          issues.push(`CJ no longer returned VID ${vid}`);
          continue;
        }

        const liveSku = text(liveVariant?.variantSku);
        if (!savedSku || liveSku !== savedSku) {
          issues.push(`VID ${vid} SKU mismatch: saved ${savedSku || '(blank)'}, CJ ${liveSku || '(blank)'}`);
        }

        const savedCost = money(variant?.supplier_cost_amount);
        const liveCost = money(parseCJUsd(liveVariant?.variantSellPrice));
        if (!(savedCost > 0) || !(liveCost > 0) || Math.abs(savedCost - liveCost) > 0.01) {
          issues.push(`VID ${vid} supplier cost mismatch: saved ${savedCost.toFixed(2)}, CJ ${liveCost.toFixed(2)}`);
        }

        const mapping: any = mappingByVariantId.get(text(variant?.id));
        if (!mapping) {
          issues.push(`VID ${vid} has no private fulfillment mapping`);
          continue;
        }
        if (mapping?.is_active !== true) issues.push(`VID ${vid} private mapping is inactive`);
        if (text(mapping?.beezio_product_id) !== text(product.id)) issues.push(`VID ${vid} mapping points to wrong Beezio product`);
        if (text(mapping?.cj_product_id) !== pid) issues.push(`VID ${vid} mapping points to wrong CJ product`);
        if (text(mapping?.cj_vid) !== vid) issues.push(`VID ${vid} private mapping VID mismatch`);
        if (text(mapping?.cj_variant_sku) !== savedSku) issues.push(`VID ${vid} private mapping SKU mismatch`);
        if (Math.abs(money(mapping?.supplier_cost_amount) - savedCost) > 0.01) issues.push(`VID ${vid} private mapping cost mismatch`);
      }

      const details = {
        checked_at: checkedAt,
        cj_product_id: pid,
        saved_variant_count: saved.length,
        live_variant_count: liveVariants.length,
        private_mapping_count: privateMappings.length,
        issues,
      };

      if (issues.length) {
        await supabase.from('products').update({
          is_active: false,
          is_promotable: false,
          status: 'draft',
          import_status: 'needs_review',
          verification_status: 'failed',
          verified_at: null,
          cj_live_audit_status: 'failed',
          cj_live_audited_at: checkedAt,
          cj_live_audit_details: details,
          updated_at: checkedAt,
        }).eq('id', product.id);
      } else {
        await supabase.from('products').update({
          cj_live_audit_status: 'passed',
          cj_live_audited_at: checkedAt,
          cj_live_audit_details: details,
          updated_at: checkedAt,
        }).eq('id', product.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from('products').update({
        cj_live_audit_status: 'retrying',
        cj_live_audited_at: checkedAt,
        cj_live_audit_details: { checked_at: checkedAt, cj_product_id: pid || null, error: message },
        updated_at: checkedAt,
      }).eq('id', product.id);
    }
  }

  return { statusCode: 202, body: '' };
};

export default handler;
