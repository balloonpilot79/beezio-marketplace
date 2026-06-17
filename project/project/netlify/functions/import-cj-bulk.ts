import type { Handler } from '@netlify/functions';
import { createSupabaseAdmin } from './_lib/supabase';
import { json, assertPost, parseJson } from './_lib/http';
import { requireAdmin } from './_lib/auth';
import {
  parseCsv,
  normalizeCsvInput,
  normalizeJsonInput,
  calculateRetailPriceCents,
  estimateShippingCents,
  deriveProductStock,
  deriveVariantInStock,
  type ImportProductInput,
  type PricingRules,
  type ShippingTier,
  attributesToOptions,
} from './_lib/cj-import-utils';
import { buildSearchableCodes, normalizeCjDetailPayload } from '../../shared/cjIdentity';

type ImportResponse = {
  ok: boolean;
  dry_run: boolean;
  summary: {
    products_total: number;
    products_created: number;
    products_updated: number;
    variants_total: number;
    variants_created: number;
    variants_updated: number;
    errors: number;
  };
  errors?: Array<{ cj_product_id?: string; cj_variant_id?: string; message: string }>;
  preview?: ImportProductInput[];
};

const DEFAULT_RULES: PricingRules = {
  affiliate_percent: 20,
  affiliate_floor_cents: 500,
  affiliate_enabled: true,
  markup_type: 'percent',
  markup_value: 15,
  paypal_fee_bps: 350,
  paypal_fixed_cents: 50,
};

const DEFAULT_SHIPPING_TIERS: ShippingTier[] = [
  { min_oz: 0, max_oz: 8, shipping_cents: 499 },
  { min_oz: 9, max_oz: 32, shipping_cents: 699 },
  { min_oz: 33, max_oz: 80, shipping_cents: 999 },
  { min_oz: 81, max_oz: 160, shipping_cents: 1499 },
  { min_oz: 161, max_oz: 999999, shipping_cents: 1999 },
];

const DEFAULT_UNKNOWN_INVENTORY_POLICY =
  (String(process.env.DEFAULT_UNKNOWN_INVENTORY_POLICY || '').trim().toLowerCase() as 'deny' | 'continue') || 'deny';

const normalizeStatus = (value?: string): 'draft' | 'active' | 'archived' => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'active' || raw === 'archived' || raw === 'draft') return raw;
  return 'draft';
};

const coerceBool = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

const parseMultipart = (event: any): { filename?: string; content?: string } => {
  const contentType = String(event.headers['content-type'] || event.headers['Content-Type'] || '');
  const match = contentType.match(/boundary=([^;]+)/i);
  if (!match) return {};
  const boundary = match[1];
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf-8') : String(event.body || '');
  const parts = rawBody.split(`--${boundary}`);
  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;
    const filenameMatch = part.match(/filename=\"([^\"]+)\"/i);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const content = part.slice(headerEnd + 4).replace(/\r\n--$/, '').trim();
    if (content) {
      return { filename: filenameMatch?.[1], content };
    }
  }
  return {};
};

const extractMissingColumnName = (message: string): string | null => {
  const msg = String(message || '');
  const pg = msg.match(/column\s+\"([^\"]+)\"\s+of\s+relation\s+\"[^\"]+\"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
};

const upsertWithColumnHealing = async (
  client: any,
  table: string,
  payload: any,
  onConflict: string,
  select = 'id'
) => {
  let working = { ...payload };
  let lastError: any = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await client.from(table).upsert(working, { onConflict }).select(select).maybeSingle();
    if (!error) return { data, error: null, payload: working };
    lastError = error;
    const missing = extractMissingColumnName(String(error?.message || ''));
    if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
      delete working[missing];
      continue;
    }
    break;
  }
  return { data: null, error: lastError, payload: working };
};

const resolvePricingRules = (overrides: Partial<PricingRules>, categoryRules?: Partial<PricingRules>): PricingRules => {
  return {
    affiliate_percent:
      overrides.affiliate_percent ?? categoryRules?.affiliate_percent ?? DEFAULT_RULES.affiliate_percent,
    affiliate_floor_cents:
      overrides.affiliate_floor_cents ?? categoryRules?.affiliate_floor_cents ?? DEFAULT_RULES.affiliate_floor_cents,
    affiliate_enabled:
      overrides.affiliate_enabled ?? categoryRules?.affiliate_enabled ?? DEFAULT_RULES.affiliate_enabled,
    markup_type: (overrides.markup_type ?? categoryRules?.markup_type ?? DEFAULT_RULES.markup_type) as 'flat' | 'percent',
    markup_value: overrides.markup_value ?? categoryRules?.markup_value ?? DEFAULT_RULES.markup_value,
    paypal_fee_bps: overrides.paypal_fee_bps ?? categoryRules?.paypal_fee_bps ?? DEFAULT_RULES.paypal_fee_bps,
    paypal_fixed_cents:
      overrides.paypal_fixed_cents ?? categoryRules?.paypal_fixed_cents ?? DEFAULT_RULES.paypal_fixed_cents,
  };
};

export const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);
    const admin = await requireAdmin(event);
    const supabaseAdmin = createSupabaseAdmin();

    const contentType = String(event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    let importItems: ImportProductInput[] = [];

    let dryRun = false;

    let defaultStatus = normalizeStatus(event.queryStringParameters?.default_status || 'active');

    if (contentType.includes('multipart/form-data')) {
      const file = parseMultipart(event);
      if (!file.content) return json(400, { error: 'Missing CSV or JSON file upload' });
      if (file.content.trim().startsWith('[') || file.content.trim().startsWith('{')) {
        const payload = JSON.parse(file.content);
        const list = Array.isArray(payload) ? payload : payload?.products ?? payload?.items ?? [];
        importItems = normalizeJsonInput(list);
        defaultStatus = normalizeStatus(payload?.default_status || defaultStatus);
      } else {
        const rows = parseCsv(file.content);
        importItems = normalizeCsvInput(rows);
      }
    } else if (contentType.includes('text/csv')) {
      const rows = parseCsv(event.body || '');
      importItems = normalizeCsvInput(rows);
    } else {
      const payload = parseJson<any>(event.body);
      if (payload?.csv) {
        const rows = parseCsv(String(payload.csv));
        importItems = normalizeCsvInput(rows);
      } else {
        const list = Array.isArray(payload) ? payload : payload?.products ?? payload?.items ?? [];
        importItems = normalizeJsonInput(list);
      }
      dryRun = coerceBool(payload?.dry_run ?? payload?.dryRun ?? false, false);
      defaultStatus = normalizeStatus(payload?.default_status || defaultStatus);
    }

    if (!importItems.length) return json(400, { error: 'No importable products found' });
    if (event.queryStringParameters?.dry_run) {
      dryRun = coerceBool(event.queryStringParameters.dry_run, dryRun);
    }

    const { data: shippingRule } = await supabaseAdmin
      .from('shipping_rules')
      .select('tiers_json')
      .eq('name', 'default')
      .maybeSingle();
    const tiers = (shippingRule as any)?.tiers_json || DEFAULT_SHIPPING_TIERS;

    const { data: categoryMapRows } = await supabaseAdmin
      .from('category_map_cj_to_beezio')
      .select('cj_category_path, beezio_category_id, fallback');
    const categoryMap = new Map<string, string>();
    let fallbackCategoryId: string | null = null;
    (categoryMapRows as any[] | null)?.forEach((row) => {
      if (!row?.cj_category_path) return;
      categoryMap.set(String(row.cj_category_path), String(row.beezio_category_id || ''));
      if (row.fallback) fallbackCategoryId = String(row.beezio_category_id || '') || fallbackCategoryId;
    });

    const { data: pricingRuleRows } = await supabaseAdmin.from('pricing_rules').select('*');
    const pricingMap = new Map<string, Partial<PricingRules>>();
    (pricingRuleRows as any[] | null)?.forEach((row) => {
      if (!row?.beezio_category_id) return;
      pricingMap.set(String(row.beezio_category_id), {
        affiliate_percent: row.affiliate_percent,
        affiliate_floor_cents: row.affiliate_floor_cents,
        affiliate_enabled: row.affiliate_enabled,
        markup_type: row.markup_type,
        markup_value: row.markup_value,
        paypal_fee_bps: row.paypal_fee_bps,
        paypal_fixed_cents: row.paypal_fixed_cents,
      });
    });

    const productsCreated = new Set<string>();
    const productsUpdated = new Set<string>();
    const variantsCreated = new Set<string>();
    const variantsUpdated = new Set<string>();
    const errors: Array<{ cj_product_id?: string; cj_variant_id?: string; message: string }> = [];

    if (dryRun) {
      const preview = importItems.slice(0, 20);
      const summary: ImportResponse['summary'] = {
        products_total: importItems.length,
        products_created: 0,
        products_updated: 0,
        variants_total: importItems.reduce((acc, item) => acc + (item.variants?.length || 0), 0),
        variants_created: 0,
        variants_updated: 0,
        errors: 0,
      };
      return json(200, { ok: true, dry_run: true, summary, preview } as ImportResponse);
    }

    for (const item of importItems) {
      try {
        if (!item.cj_product_id || !item.title) {
          errors.push({ cj_product_id: item.cj_product_id, message: 'Missing cj_product_id or title' });
          continue;
        }

        const mappedCategoryId = item.cj_category_path ? categoryMap.get(item.cj_category_path) || null : null;
        const beezioCategoryId =
          mappedCategoryId || fallbackCategoryId || (process.env.DEFAULT_BEEZIO_CATEGORY_ID || null);

        const categoryRules = beezioCategoryId ? pricingMap.get(String(beezioCategoryId)) : undefined;
        const rules = resolvePricingRules(
          {
            affiliate_percent: item.affiliate_percent,
            affiliate_floor_cents: item.affiliate_floor_cents,
            affiliate_enabled: item.affiliate_enabled,
            markup_type: item.markup_type,
            markup_value: item.markup_value,
            paypal_fee_bps: item.paypal_fee_bps,
            paypal_fixed_cents: item.paypal_fixed_cents,
          },
          categoryRules
        );

        const variants = item.variants || [];
        const variantCosts = variants.map((v) => v.cost_cents || 0).filter((v) => v > 0);
        const baseCostCents =
          item.base_cost_cents && item.base_cost_cents > 0
            ? item.base_cost_cents
            : variantCosts.length
              ? Math.min(...variantCosts)
              : 0;

        const baseWeightOz =
          item.base_weight_oz && item.base_weight_oz > 0
            ? item.base_weight_oz
            : Math.max(0, ...variants.map((v) => v.weight_oz || 0));

        const retailPriceCents = calculateRetailPriceCents(baseCostCents, rules);
        const shippingEstimateCents = estimateShippingCents(baseWeightOz, tiers as ShippingTier[]);

        const normalizedVariants = variants.map((variant) => {
          const inventory =
            typeof variant.inventory === 'number' && Number.isFinite(variant.inventory) ? Math.max(0, Math.floor(variant.inventory)) : null;
          const inventoryPolicy =
            (variant.inventory_policy || (inventory === null ? DEFAULT_UNKNOWN_INVENTORY_POLICY : 'deny')) as 'deny' | 'continue';
          const isActive = variant.is_active !== false;
          const resolvedInventory = inventory ?? 0;
          const costCents = variant.cost_cents && variant.cost_cents > 0 ? variant.cost_cents : baseCostCents;
          const variantRetail = calculateRetailPriceCents(costCents, rules);
          const inStock = deriveVariantInStock({
            is_active: isActive,
            inventory: resolvedInventory,
            inventory_policy: inventoryPolicy,
          });
          const attributes = variant.attributes || {};
          const options = attributesToOptions(attributes);
          return {
            ...variant,
            ...options,
            cost_cents: costCents,
            retail_price_cents: variantRetail,
            inventory: resolvedInventory,
            inventory_policy: inventoryPolicy,
            is_active: isActive,
            in_stock: inStock,
            inventory_source: 'cj',
          };
        });

        const status = normalizeStatus(item.status || defaultStatus);
        const trackInventory = item.track_inventory !== false;
        const stock = deriveProductStock({
          track_inventory: trackInventory,
          status,
          variants: normalizedVariants.map((v) => ({
            inventory: v.inventory || 0,
            is_active: v.is_active !== false,
            in_stock: v.in_stock || false,
          })),
        });

        const rawMarkupCents = rules.markup_type === 'percent'
          ? Math.round(baseCostCents * (rules.markup_value / 100))
          : rules.markup_value;
        const markupCents = Math.max(Math.max(0, rawMarkupCents), 300);
        const sellerAskCents = baseCostCents + markupCents;

        const price = retailPriceCents / 100;
        const sellerAsk = sellerAskCents / 100;
        const normalizedCj = normalizeCjDetailPayload(
          {
            productId: item.cj_product_id,
            pid: item.raw?.pid || item.cj_product_id,
            productSku: item.raw?.productSku || item.raw?.sku || null,
            productSpu: item.raw?.productSpu || item.raw?.spu || null,
            productNameEn: item.title,
            description: item.description || null,
            productImageList: item.image_urls || [],
            variants: normalizedVariants.map((variant) => ({
              vid: variant.cj_variant_id,
              variantSku: variant.sku,
              variantNameEn: [variant.option1_value, variant.option2_value, variant.option3_value].filter(Boolean).join(' / ') || variant.sku,
              inventory: variant.inventory,
            })),
          },
          { importVersion: 'cj-import-v2' }
        );

        const productPayload: any = {
          seller_id: admin.profileId,
          source: 'cj',
          cj_product_id: item.cj_product_id,
          cj_pid: normalizedCj.cj_pid,
          cj_product_code: normalizedCj.cj_product_code,
          cj_product_sku: normalizedCj.cj_product_sku,
          cj_spu: normalizedCj.cj_spu,
          cj_name_raw: normalizedCj.cj_name_raw,
          cj_source_payload_json: normalizedCj.cj_source_payload_json,
          searchable_codes: normalizedCj.searchable_codes,
          import_status: normalizedCj.import_status,
          display_search_code: normalizedCj.display_search_code,
          source_import_version: normalizedCj.source_import_version,
          title: item.title,
          description: item.description || null,
          beezio_category_id: beezioCategoryId,
          category_id: beezioCategoryId,
          status,
          is_active: status === 'active',
          primary_image_url: item.primary_image_url,
          images: item.image_urls || [],
          price,
          calculated_customer_price: price,
          seller_ask: sellerAsk,
          seller_amount: sellerAsk,
          seller_ask_price: sellerAsk,
          currency: 'USD',
          base_weight_oz: baseWeightOz,
          base_cost_cents: baseCostCents,
          retail_price_cents: retailPriceCents,
          shipping_estimate_cents: shippingEstimateCents,
          shipping_cost: shippingEstimateCents / 100,
          affiliate_percent: rules.affiliate_percent,
          affiliate_floor_cents: rules.affiliate_floor_cents,
          affiliate_enabled: rules.affiliate_enabled,
          commission_rate: rules.affiliate_percent,
          commission_type: 'percentage',
          flat_commission_amount: 0,
          markup_type: rules.markup_type,
          markup_value: rules.markup_value,
          paypal_fee_bps: rules.paypal_fee_bps,
          paypal_fixed_cents: rules.paypal_fixed_cents,
          track_inventory: trackInventory,
          total_inventory: stock.total_inventory,
          in_stock: stock.in_stock,
          stock_quantity: stock.total_inventory,
          lineage: 'CJ',
          sku: normalizedCj.display_search_code,
          variants: normalizedVariants.map((variant) => ({
            cj_variant_id: variant.cj_variant_id,
            sku: variant.sku,
            option1_name: variant.option1_name,
            option1_value: variant.option1_value,
            option2_name: variant.option2_name,
            option2_value: variant.option2_value,
            option3_name: variant.option3_name,
            option3_value: variant.option3_value,
            inventory: variant.inventory,
            in_stock: variant.in_stock,
            cost_cents: variant.cost_cents,
            retail_price_cents: variant.retail_price_cents,
            image_url: variant.image_url,
            attributes: variant.attributes || null,
          })),
        };

        const { data: existingProduct } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('cj_product_id', item.cj_product_id)
          .maybeSingle();

        const productResult = await upsertWithColumnHealing(
          supabaseAdmin,
          'products',
          productPayload,
          'cj_product_id',
          'id'
        );

        if (productResult.error) {
          throw new Error(`Product upsert failed: ${String(productResult.error?.message || productResult.error)}`);
        }

        const productId = String((productResult.data as any)?.id || '');
        if (!productId) throw new Error('Product upsert did not return id');
        if (existingProduct?.id) productsUpdated.add(item.cj_product_id);
        else productsCreated.add(item.cj_product_id);

        const variantPayloads = normalizedVariants
          .filter((v) => v.cj_variant_id)
          .map((variant, index) => {
            const normalizedVariant = normalizedCj.variants[index] || null;
            return ({
            product_id: productId,
            provider: 'CJ',
            source: 'cj',
            cj_product_id: item.cj_product_id,
            cj_variant_id: variant.cj_variant_id,
            cj_vid: normalizedVariant?.cj_vid || variant.cj_variant_id,
            cj_variant_sku: normalizedVariant?.cj_variant_sku || variant.sku || null,
            cj_variant_code: normalizedVariant?.cj_variant_code || null,
            cj_sku: normalizedVariant?.cj_sku || variant.sku || null,
            cj_option_summary: normalizedVariant?.option_summary || null,
            supplier_variant_ref: normalizedVariant?.supplier_variant_ref || null,
            external_inventory_key: normalizedVariant?.external_inventory_key || variant.cj_variant_id,
            variant_display_sku: normalizedVariant?.variant_display_sku || variant.sku || `CJ Variant ID: ${variant.cj_variant_id}`,
            searchable_codes: normalizedVariant?.searchable_codes || buildSearchableCodes([
              normalizedCj.cj_product_sku,
              normalizedCj.cj_spu,
              variant.sku,
              variant.cj_variant_id,
            ]),
            is_orderable: normalizedVariant?.is_orderable ?? true,
            order_reference_type: normalizedVariant?.order_reference_type || 'cj_variant_id',
            raw_variant_payload_json: normalizedVariant?.raw_variant_payload_json || variant.raw || variant,
            import_status: normalizedVariant?.warnings?.length ? 'needs_review' : 'ready',
            sku: normalizedVariant?.variant_display_sku || variant.sku || `CJ Variant ID: ${variant.cj_variant_id}`,
            price: (variant.retail_price_cents || retailPriceCents) / 100,
            currency: 'USD',
            image_url: variant.image_url || item.primary_image_url,
            attributes: variant.attributes || null,
            inventory: variant.inventory,
            is_active: variant.is_active !== false,
            option1_name: variant.option1_name,
            option1_value: variant.option1_value,
            option2_name: variant.option2_name,
            option2_value: variant.option2_value,
            option3_name: variant.option3_name,
            option3_value: variant.option3_value,
            weight_oz: variant.weight_oz || 0,
            cost_cents: variant.cost_cents,
            retail_price_cents: variant.retail_price_cents,
            inventory_policy: variant.inventory_policy,
            in_stock: variant.in_stock,
            inventory_source: 'cj',
          })});

        if (variantPayloads.length > 0) {
          const { data: existingVariants } = await supabaseAdmin
            .from('product_variants')
            .select('cj_variant_id')
            .in(
              'cj_variant_id',
              variantPayloads.map((v) => v.cj_variant_id)
            );
          const existingSet = new Set((existingVariants as any[] | null)?.map((v) => v.cj_variant_id) || []);
          variantPayloads.forEach((v) => {
            if (existingSet.has(v.cj_variant_id)) variantsUpdated.add(v.cj_variant_id);
            else variantsCreated.add(v.cj_variant_id);
          });

          const { error: variantError } = await supabaseAdmin
            .from('product_variants')
            .upsert(variantPayloads as any[], { onConflict: 'cj_variant_id' });
          if (variantError) {
            throw new Error(`Variant upsert failed: ${variantError.message}`);
          }
        }

        await supabaseAdmin.from('cj_products').upsert({
          cj_product_id: item.cj_product_id,
          raw_json: item.raw || {},
          imported_at: new Date().toISOString(),
        });

        await supabaseAdmin.from('audit_log').insert({
          actor_user_id: admin.userId,
          action: 'IMPORT_BULK',
          entity_type: 'product',
          entity_id: productId,
          details: {
            cj_product_id: item.cj_product_id,
            variants_imported: variantPayloads.length,
          },
        });

        // Best-effort mapping for CJ fulfillment if table exists.
        try {
          await supabaseAdmin
            .from('cj_product_mappings')
            .upsert(
              {
                beezio_product_id: productId,
                cj_product_id: item.cj_product_id,
                cj_product_sku: variantPayloads[0]?.sku || null,
                price_breakdown: {
                  retail_price_cents: retailPriceCents,
                  base_cost_cents: baseCostCents,
                  identifier_snapshot: {
                    cjProductId: item.cj_product_id,
                    productSku: String(item.raw?.productSku || item.raw?.sku || variantPayloads[0]?.sku || '').trim() || null,
                    productSpu: String(item.raw?.productSpu || item.raw?.spu || '').trim() || null,
                    variantId: variantPayloads[0]?.cj_variant_id || null,
                    variantSku: variantPayloads[0]?.sku || null,
                  },
                  verification: {
                    verified: false,
                    verified_at: null,
                    source: 'pending_verification',
                  },
                },
                last_synced: new Date().toISOString(),
              },
              { onConflict: 'cj_product_id' }
            );
        } catch {
          // optional table
        }
      } catch (err) {
        errors.push({
          cj_product_id: item.cj_product_id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const variantsTotal = importItems.reduce((acc, item) => acc + (item.variants?.length || 0), 0);
    const response: ImportResponse = {
      ok: errors.length === 0,
      dry_run: false,
      summary: {
        products_total: importItems.length,
        products_created: productsCreated.size,
        products_updated: productsUpdated.size,
        variants_total: variantsTotal,
        variants_created: variantsCreated.size,
        variants_updated: variantsUpdated.size,
        errors: errors.length,
      },
      errors: errors.length ? errors : undefined,
    };

    return json(200, response);
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};
