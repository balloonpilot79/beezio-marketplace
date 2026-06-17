import type { Handler } from '@netlify/functions';
import { json, assertPost, parseJson } from './_lib/http';
import { createSupabaseAdmin } from './_lib/supabase';
import { extractAuthHeader, getAuthedUser, resolveProfileId } from './_lib/auth';
import { decryptSecret } from './_lib/crypto';
import { round2 } from './_lib/money';
import { listPrintifyProducts, getPrintifyProduct } from './_lib/printify';
import { listPrintfulProducts, getPrintfulProduct } from './_lib/printful';
import { calculateCustomerProductPrice } from '../../src/utils/pricing';

type ImportBody = {
  platform?: string;
  commissionRate?: number;
  markAsAffiliate?: boolean;
  autoSync?: boolean;
};

type InsertResult = {
  created: number;
  updated: number;
  skipped: number;
  variants_created: number;
  variants_updated: number;
  errors: string[];
  preview: Array<{
    product_id?: string | null;
    external_id: string;
    title: string;
    image?: string | null;
    status: 'created' | 'updated' | 'skipped';
    platform: 'printify' | 'printful';
  }>;
};

const normalizeMoney = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (Number.isInteger(num) && num >= 1000) return num / 100;
  return num;
};

const safeUpsert = async (supabaseAdmin: any, table: string, payload: any, onConflict?: string) => {
  let working = { ...payload };
  let lastError: any = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const query = supabaseAdmin.from(table).upsert(working, onConflict ? { onConflict } : undefined);
    const { error } = await query;
    if (!error) return { error: null };
    lastError = error;
    const message = String((error as any)?.message || '');
    const missing = extractMissingColumnName(message);
    if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
      delete working[missing];
      continue;
    }
    break;
  }
  return { error: lastError };
};

const safeInsert = async (supabaseAdmin: any, table: string, payload: any) => {
  let working = { ...payload };
  let lastError: any = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await supabaseAdmin.from(table).insert(working).select('*').maybeSingle();
    if (!error) return { data, error: null };
    lastError = error;
    const message = String((error as any)?.message || '');
    const missing = extractMissingColumnName(message);
    if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
      delete working[missing];
      continue;
    }
    break;
  }
  return { data: null, error: lastError };
};

function extractMissingColumnName(message: string): string | null {
  const msg = String(message || '');
  const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
  if (pg?.[1]) return pg[1];
  const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
  if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
  const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
  if (pgrst?.[1]) return pgrst[1];
  return null;
}

const handler: Handler = async (event) => {
  try {
    assertPost(event.httpMethod);

    const authHeader = extractAuthHeader(event);
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const { user, error: authError } = await getAuthedUser(authHeader);
    if (!user) return json(401, { error: 'Unauthorized', details: authError });

    const authUserId = String(user?.id || '').trim();
    if (!authUserId) return json(400, { error: 'Missing auth user id' });

    const profileId = await resolveProfileId(user);
    if (!profileId) return json(400, { error: 'Missing profile id' });

    const body = parseJson<ImportBody>(event.body);
    const platform = String(body?.platform || '').trim().toLowerCase();
    const commissionRate = Number(body?.commissionRate ?? 0) || 0;
    const markAsAffiliate = Boolean(body?.markAsAffiliate);
    const autoSync = Boolean(body?.autoSync);

    if (!platform) return json(400, { error: 'Missing platform' });
    if (!['printify', 'printful'].includes(platform)) {
      return json(400, { error: 'Unsupported platform' });
    }

    const supabaseAdmin = createSupabaseAdmin();
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('user_integrations')
      .select('*')
      .eq('user_id', authUserId)
      .eq('platform', platform)
      .maybeSingle();

    if (integrationError) return json(500, { error: integrationError.message });
    if (!integration) return json(404, { error: 'Integration not found' });

    const token = decryptSecret((integration as any)?.api_key);
    if (!token) return json(400, { error: 'Missing API key for integration' });

    const results: InsertResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      variants_created: 0,
      variants_updated: 0,
      errors: [],
      preview: [],
    };
    const previewLimit = 25;
    const pushPreview = (entry: InsertResult['preview'][number]) => {
      if (results.preview.length >= previewLimit) return;
      results.preview.push(entry);
    };

    if (platform === 'printify') {
      const shopId = Number((integration as any)?.settings?.shop_id);
      if (!Number.isFinite(shopId)) return json(400, { error: 'Missing Printify shop id. Disconnect and reconnect.' });

      let page = 1;
      const limit = 50;
      while (true) {
        const list = await listPrintifyProducts(token, shopId, page, limit);
        const products = Array.isArray((list as any)?.data) ? (list as any).data : (Array.isArray(list) ? list : []);
        if (!products.length) break;

        for (const product of products) {
          try {
            const detail = await getPrintifyProduct(token, shopId, String((product as any)?.id || ''));
            const variants = Array.isArray((detail as any)?.variants) ? (detail as any).variants : [];
            const options = Array.isArray((detail as any)?.options) ? (detail as any).options : [];
            const optionValueMap = new Map<number, { optionName: string; value: string }>();
            for (const opt of options) {
              const name = String((opt as any)?.name || '').trim();
              for (const val of (opt as any)?.values || []) {
                const id = Number((val as any)?.id);
                if (Number.isFinite(id)) {
                  optionValueMap.set(id, { optionName: name, value: String((val as any)?.title || '').trim() });
                }
              }
            }

            const images = Array.isArray((detail as any)?.images)
              ? (detail as any).images.map((img: any) => String(img?.src || '').trim()).filter(Boolean)
              : [];
            const title = String((detail as any)?.title || '').trim() || 'Printify Product';
            const description = String((detail as any)?.description || '').trim() || '';
            const tags = Array.isArray((detail as any)?.tags) ? (detail as any).tags.map((t: any) => String(t || '').trim()).filter(Boolean) : [];

            const normalizedVariants = variants.map((variant: any) => {
              const price = normalizeMoney(variant?.price);
              const cost = normalizeMoney(variant?.cost);
              const optionIds = Array.isArray(variant?.options) ? variant.options : [];
              const optionPairs = optionIds
                .map((id: any) => optionValueMap.get(Number(id)))
                .filter(Boolean) as Array<{ optionName: string; value: string }>;
              const attributes: Record<string, string> = {};
              optionPairs.forEach((pair) => {
                if (pair.optionName && pair.value) attributes[pair.optionName] = pair.value;
              });

              return {
                external_variant_id: String(variant?.id || ''),
                sku: String(variant?.sku || '').trim() || `PRINTIFY-${variant?.id}`,
                price,
                cost_cents: Math.round(cost * 100),
                inventory: Number.isFinite(Number(variant?.quantity)) ? Math.max(0, Math.floor(Number(variant?.quantity))) : null,
                is_active: variant?.is_enabled !== false,
                option_pairs: optionPairs,
                attributes,
                print_provider_id: variant?.print_provider_id ?? null,
                blueprint_id: variant?.blueprint_id ?? null,
              };
            });

            const minSellerAsk = normalizedVariants.length
              ? Math.min(...normalizedVariants.map((v) => v.price || 0))
              : normalizeMoney((detail as any)?.price);
            const sellerAsk = round2(minSellerAsk || 0);
            const listingPrice = round2(calculateCustomerProductPrice(sellerAsk, 'percent', commissionRate));

            const existing = await supabaseAdmin
              .from('products')
              .select('id, auto_sync')
              .eq('seller_id', profileId)
              .eq('source_platform', platform)
              .eq('external_id', String((detail as any)?.id || ''))
              .maybeSingle();

            const shouldUpdate = Boolean(autoSync || (existing.data as any)?.auto_sync);
            if ((existing.data as any)?.id && !shouldUpdate) {
              results.skipped += 1;
              pushPreview({
                product_id: (existing.data as any)?.id || null,
                external_id: String((detail as any)?.id || ''),
                title,
                image: images[0] || null,
                status: 'skipped',
                platform: 'printify',
              });
              continue;
            }

            const productPayload: any = {
              title,
              description,
              price: listingPrice,
              calculated_customer_price: listingPrice,
              seller_ask: sellerAsk,
              seller_amount: sellerAsk,
              seller_ask_price: sellerAsk,
              images,
              tags,
              stock_quantity: 1,
              is_active: true,
              commission_rate: commissionRate,
              commission_type: 'percentage',
              flat_commission_amount: 0,
              affiliate_commission_type: 'percent',
              affiliate_commission_value: commissionRate,
              shipping_cost: 0,
              category: 'Other',
              seller_id: profileId,
              source_platform: platform,
              external_id: String((detail as any)?.id || ''),
              source_url: null,
              is_affiliate_product: markAsAffiliate,
              auto_sync: autoSync,
              has_variants: normalizedVariants.length > 0,
              lineage: 'SELLER_DIRECT',
            };

            let productId = (existing.data as any)?.id || null;
            if (productId && shouldUpdate) {
              const { error: updateError } = await supabaseAdmin.from('products').update(productPayload).eq('id', productId);
              if (updateError) throw updateError;
              results.updated += 1;
              pushPreview({
                product_id: productId,
                external_id: String((detail as any)?.id || ''),
                title,
                image: images[0] || null,
                status: 'updated',
                platform: 'printify',
              });
            } else if (!productId) {
              const insert = await safeInsert(supabaseAdmin, 'products', productPayload);
              if (insert.error) throw insert.error;
              productId = (insert.data as any)?.id;
              results.created += 1;
              pushPreview({
                product_id: productId,
                external_id: String((detail as any)?.id || ''),
                title,
                image: images[0] || null,
                status: 'created',
                platform: 'printify',
              });
            }

            if (!productId) continue;

            await safeUpsert(supabaseAdmin, 'imported_products', {
              product_id: productId,
              user_id: profileId,
              integration_id: (integration as any)?.id,
              external_id: String((detail as any)?.id || ''),
              external_url: null,
              platform,
              sync_status: 'synced',
              external_data: detail,
              last_synced: new Date().toISOString(),
            }, 'platform,external_id,user_id');

            if (normalizedVariants.length) {
              const variantPayloads = normalizedVariants.map((variant, index) => ({
                product_id: productId,
                provider: 'printify',
                source_platform: 'printify',
                external_product_id: String((detail as any)?.id || ''),
                external_variant_id: variant.external_variant_id,
                sku: variant.sku,
                price: round2(calculateCustomerProductPrice(round2(variant.price || sellerAsk), 'percent', commissionRate)),
                compare_at_price: null,
                currency: 'USD',
                image_url: images[0] || null,
                attributes: variant.attributes,
                inventory: variant.inventory ?? 0,
                is_active: variant.is_active,
                option1_name: variant.option_pairs?.[0]?.optionName || null,
                option1_value: variant.option_pairs?.[0]?.value || null,
                option2_name: variant.option_pairs?.[1]?.optionName || null,
                option2_value: variant.option_pairs?.[1]?.value || null,
                option3_name: variant.option_pairs?.[2]?.optionName || null,
                option3_value: variant.option_pairs?.[2]?.value || null,
                inventory_source: 'printify',
                cost_cents: variant.cost_cents || 0,
                retail_price_cents: Math.round(calculateCustomerProductPrice(round2(variant.price || sellerAsk), 'percent', commissionRate) * 100),
                external_data: {
                  print_provider_id: variant.print_provider_id,
                  blueprint_id: variant.blueprint_id,
                },
                cj_product_id: null,
                cj_variant_id: null,
              }));

              const { error: variantError } = await supabaseAdmin
                .from('product_variants')
                .upsert(variantPayloads, { onConflict: 'source_platform,external_variant_id' });
              if (variantError) throw variantError;

              results.variants_updated += variantPayloads.length;
            }
          } catch (err: any) {
            results.errors.push(err?.message || String(err));
          }
        }

        page += 1;
      }
    }

    if (platform === 'printful') {
      const storeId = Number((integration as any)?.settings?.store_id);
      let offset = 0;
      const limit = 50;

      while (true) {
        const list = await listPrintfulProducts(token, Number.isFinite(storeId) ? storeId : undefined, offset, limit);
        const products = Array.isArray((list as any)?.result) ? (list as any).result : [];
        if (!products.length) break;

        for (const product of products) {
          try {
            const detailWrap = await getPrintfulProduct(token, Number(product.id), Number.isFinite(storeId) ? storeId : undefined);
            const detail = (detailWrap as any)?.result;
            const syncProduct = detail?.sync_product || {};
            const syncVariants = Array.isArray(detail?.sync_variants) ? detail.sync_variants : [];
            const images = [
              String(syncProduct?.thumbnail_url || '').trim(),
              ...syncVariants.map((v: any) => String(v?.product?.image || '').trim()),
            ].filter(Boolean);

            const title = String(syncProduct?.name || product?.name || '').trim() || 'Printful Product';
            const description = String(syncProduct?.description || '').trim() || '';

            const normalizedVariants = syncVariants.map((variant: any) => {
              const price = normalizeMoney(variant?.retail_price ?? variant?.price);
              const options = Array.isArray(variant?.options) ? variant.options : [];
              const attributes: Record<string, string> = {};
              options.forEach((opt: any) => {
                const name = String(opt?.name || '').trim();
                const value = String(opt?.value || '').trim();
                if (name && value) attributes[name] = value;
              });
              return {
                external_variant_id: String(variant?.id || ''),
                sku: String(variant?.sku || '').trim() || `PRINTFUL-${variant?.id}`,
                price,
                attributes,
              };
            });

            const minSellerAsk = normalizedVariants.length
              ? Math.min(...normalizedVariants.map((v) => v.price || 0))
              : 0;
            const sellerAsk = round2(minSellerAsk || 0);
            const listingPrice = round2(calculateCustomerProductPrice(sellerAsk, 'percent', commissionRate));

            const existing = await supabaseAdmin
              .from('products')
              .select('id, auto_sync')
              .eq('seller_id', profileId)
              .eq('source_platform', platform)
              .eq('external_id', String(syncProduct?.id || product?.id || ''))
              .maybeSingle();

            const shouldUpdate = Boolean(autoSync || (existing.data as any)?.auto_sync);
            if ((existing.data as any)?.id && !shouldUpdate) {
              results.skipped += 1;
              pushPreview({
                product_id: (existing.data as any)?.id || null,
                external_id: String(syncProduct?.id || product?.id || ''),
                title,
                image: images[0] || null,
                status: 'skipped',
                platform: 'printful',
              });
              continue;
            }

            const productPayload: any = {
              title,
              description,
              price: listingPrice,
              calculated_customer_price: listingPrice,
              seller_ask: sellerAsk,
              seller_amount: sellerAsk,
              seller_ask_price: sellerAsk,
              images,
              tags: [],
              stock_quantity: 1,
              is_active: true,
              commission_rate: commissionRate,
              commission_type: 'percentage',
              flat_commission_amount: 0,
              affiliate_commission_type: 'percent',
              affiliate_commission_value: commissionRate,
              shipping_cost: 0,
              category: 'Other',
              seller_id: profileId,
              source_platform: platform,
              external_id: String(syncProduct?.id || product?.id || ''),
              source_url: null,
              is_affiliate_product: markAsAffiliate,
              auto_sync: autoSync,
              has_variants: normalizedVariants.length > 0,
              lineage: 'SELLER_DIRECT',
            };

            let productId = (existing.data as any)?.id || null;
            if (productId && shouldUpdate) {
              const { error: updateError } = await supabaseAdmin.from('products').update(productPayload).eq('id', productId);
              if (updateError) throw updateError;
              results.updated += 1;
              pushPreview({
                product_id: productId,
                external_id: String(syncProduct?.id || product?.id || ''),
                title,
                image: images[0] || null,
                status: 'updated',
                platform: 'printful',
              });
            } else if (!productId) {
              const insert = await safeInsert(supabaseAdmin, 'products', productPayload);
              if (insert.error) throw insert.error;
              productId = (insert.data as any)?.id;
              results.created += 1;
              pushPreview({
                product_id: productId,
                external_id: String(syncProduct?.id || product?.id || ''),
                title,
                image: images[0] || null,
                status: 'created',
                platform: 'printful',
              });
            }

            if (!productId) continue;

            await safeUpsert(supabaseAdmin, 'imported_products', {
              product_id: productId,
              user_id: profileId,
              integration_id: (integration as any)?.id,
              external_id: String(syncProduct?.id || product?.id || ''),
              external_url: null,
              platform,
              sync_status: 'synced',
              external_data: detailWrap,
              last_synced: new Date().toISOString(),
            }, 'platform,external_id,user_id');

            if (normalizedVariants.length) {
              const variantPayloads = normalizedVariants.map((variant) => ({
                product_id: productId,
                provider: 'printful',
                source_platform: 'printful',
                external_product_id: String(syncProduct?.id || product?.id || ''),
                external_variant_id: variant.external_variant_id,
                sku: variant.sku,
                price: round2(calculateCustomerProductPrice(round2(variant.price || sellerAsk), 'percent', commissionRate)),
                compare_at_price: null,
                currency: 'USD',
                image_url: images[0] || null,
                attributes: variant.attributes,
                inventory: 0,
                is_active: true,
                option1_name: Object.keys(variant.attributes || {})[0] || null,
                option1_value: Object.values(variant.attributes || {})[0] as string | null,
                option2_name: Object.keys(variant.attributes || {})[1] || null,
                option2_value: Object.values(variant.attributes || {})[1] as string | null,
                option3_name: Object.keys(variant.attributes || {})[2] || null,
                option3_value: Object.values(variant.attributes || {})[2] as string | null,
                inventory_source: 'printful',
                cost_cents: 0,
                retail_price_cents: Math.round(calculateCustomerProductPrice(round2(variant.price || sellerAsk), 'percent', commissionRate) * 100),
                external_data: {},
                cj_product_id: null,
                cj_variant_id: null,
              }));

              const { error: variantError } = await supabaseAdmin
                .from('product_variants')
                .upsert(variantPayloads, { onConflict: 'source_platform,external_variant_id' });
              if (variantError) throw variantError;
              results.variants_updated += variantPayloads.length;
            }
          } catch (err: any) {
            results.errors.push(err?.message || String(err));
          }
        }

        offset += limit;
      }
    }

    await supabaseAdmin
      .from('user_integrations')
      .update({
        last_sync: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', (integration as any)?.id);

    return json(200, { ok: true, results });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return json(statusCode, { error: e instanceof Error ? e.message : 'Unexpected error' });
  }
};

export { handler };
export default handler;
