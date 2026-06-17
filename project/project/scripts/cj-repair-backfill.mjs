import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cjApiKey = String(process.env.CJ_API_KEY || '').trim();
const cjBaseUrl = String(process.env.CJ_API_BASE_URL || 'https://developers.cjdropshipping.com/api2.0/v1').replace(/\/$/, '');
const dryRun = !process.argv.includes('--live');

if (!supabaseUrl || !serviceRoleKey || !cjApiKey) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or CJ_API_KEY.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const firstString = (...values) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return null;
};

const normalizeCode = (value) => String(value ?? '').trim().toUpperCase();

const buildSearchableCodes = (values) => {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const original = String(value ?? '').trim();
    if (!original) continue;
    const normalized = normalizeCode(original);
    for (const candidate of [original, normalized]) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      out.push(candidate);
    }
  }
  return out;
};

const normalizeCjDetailPayload = (rawPayload, options = {}) => {
  const payload = rawPayload || {};
  const variants = Array.isArray(payload.variants) ? payload.variants : [];
  const normalizedVariants = variants.map((variant) => {
    const cjVariantId = firstString(variant.variantId, variant.variant_id, variant.id, variant.vid, variant.skuId);
    const cjVid = firstString(variant.vid, variant.variantId, variant.variant_id, variant.id, variant.skuId);
    const cjVariantSku = firstString(variant.variantSku, variant.variant_sku);
    const cjVariantCode = firstString(variant.variantCode, variant.variant_code, variant.productCode, variant.code);
    const cjSku = firstString(variant.sku, variant.productSku);
    const variantDisplaySku = firstString(cjVariantSku, cjVariantCode, cjSku);
    return {
      cj_variant_id: cjVariantId,
      cj_vid: cjVid,
      cj_variant_sku: cjVariantSku,
      cj_variant_code: cjVariantCode,
      cj_sku: cjSku,
      option_summary: firstString(variant.variantNameEn, variant.variantName, variant.variantKey),
      supplier_variant_ref: firstString(variant.variantKey, variant.variantKeyEn),
      external_inventory_key: firstString(cjVid, cjVariantId),
      variant_display_sku: variantDisplaySku,
      searchable_codes: buildSearchableCodes([
        payload.productSku,
        payload.productCode,
        payload.productSpu,
        payload.pid,
        payload.productId,
        cjVariantSku,
        cjVariantCode,
        cjSku,
        cjVid,
        cjVariantId,
      ]),
      is_orderable: Boolean(cjVid || cjVariantId),
      order_reference_type: cjVid ? 'cj_vid' : cjVariantId ? 'cj_variant_id' : 'none',
      raw_variant_payload_json: variant,
      warnings: !(cjVid || cjVariantId) ? [{ code: 'missing_variant_reference' }] : [],
    };
  });

  const warnings = normalizedVariants.flatMap((variant) => variant.warnings || []);

  return {
    cj_product_id: firstString(payload.productId, payload.product_id, payload.id, payload.pid),
    cj_pid: firstString(payload.pid, payload.productId, payload.product_id, payload.id),
    cj_product_code: firstString(payload.productCode, payload.productCodeEn, payload.code),
    cj_product_sku: firstString(payload.productSku, payload.sku),
    cj_spu: firstString(payload.productSpu, payload.spu, payload.spuCode, payload.spuId),
    cj_name_raw: firstString(payload.productNameEn, payload.nameEn, payload.productName, payload.name, payload.title),
    cj_source_payload_json: payload,
    searchable_codes: buildSearchableCodes([
      payload.productCode,
      payload.productSku,
      payload.productSpu,
      payload.pid,
      payload.productId,
      ...normalizedVariants.flatMap((variant) => [
        variant.cj_variant_sku,
        variant.cj_variant_code,
        variant.cj_sku,
        variant.cj_vid,
        variant.cj_variant_id,
      ]),
    ]),
    display_search_code: firstString(
      normalizedVariants.find((variant) => variant.variant_display_sku)?.variant_display_sku,
      payload.productSku,
      payload.productCode,
      payload.productSpu,
      payload.pid,
      payload.productId,
    ),
    import_status: warnings.length ? 'needs_review' : 'ready',
    source_import_version: String(options.importVersion || 'cj-import-v2-repair'),
    variants: normalizedVariants,
    warnings,
  };
};

let cachedToken = null;

async function getCjToken() {
  if (cachedToken) return cachedToken;
  const response = await fetch(`${cjBaseUrl}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: cjApiKey }),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.result || !payload?.data?.accessToken) {
    throw new Error(payload?.message || 'CJ authentication failed');
  }
  cachedToken = String(payload.data.accessToken);
  return cachedToken;
}

async function fetchCjDetail(pid) {
  const token = await getCjToken();
  const response = await fetch(`${cjBaseUrl}/product/query?pid=${encodeURIComponent(pid)}`, {
    headers: { 'cj-access-token': token },
  });
  const payload = await response.json();
  if (!response.ok || payload?.result === false) {
    throw new Error(payload?.message || `CJ detail fetch failed for ${pid}`);
  }
  return payload?.data ?? payload;
}

function diffVariant(current, normalized) {
  const nextDisplay = normalized.variant_display_sku || null;
  const nextOrderKey = normalized.cj_vid || normalized.cj_variant_id || null;
  const previousOrderKey = current?.cj_vid || current?.cj_variant_id || null;
  return {
    changed:
      current?.variant_display_sku !== nextDisplay ||
      current?.cj_vid !== normalized.cj_vid ||
      current?.cj_variant_id !== normalized.cj_variant_id ||
      JSON.stringify(current?.searchable_codes || []) !== JSON.stringify(normalized.searchable_codes || []),
    previous_display_sku: current?.variant_display_sku || null,
    new_display_sku: nextDisplay,
    previous_order_key: previousOrderKey,
    new_order_key: nextOrderKey,
  };
}

async function run() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id,title,sku,cj_product_id,cj_pid,source,display_search_code,import_status,source_import_version,legacy_code')
    .eq('source', 'cj');

  if (error) throw error;

  const changeLog = [];

  for (const product of products || []) {
    const pid = String(product.cj_pid || product.cj_product_id || '').trim();
    if (!pid) {
      changeLog.push({ product_id: product.id, status: 'needs_review', reason: 'missing_pid' });
      continue;
    }

    try {
      const rawDetail = await fetchCjDetail(pid);
      const normalized = normalizeCjDetailPayload(rawDetail, { importVersion: 'cj-import-v2-repair' });

      const { data: existingVariants } = await supabase
        .from('product_variants')
        .select('id,cj_variant_id,cj_vid,variant_display_sku,searchable_codes,legacy_code')
        .eq('product_id', product.id);

      const variantsByKey = new Map(
        (existingVariants || []).map((variant) => [
          String(variant.cj_vid || variant.cj_variant_id || '').trim(),
          variant,
        ])
      );

      const productPatch = {
        source: 'cj',
        cj_product_id: normalized.cj_product_id,
        cj_pid: normalized.cj_pid,
        cj_product_code: normalized.cj_product_code,
        cj_product_sku: normalized.cj_product_sku,
        cj_spu: normalized.cj_spu,
        cj_name_raw: normalized.cj_name_raw,
        cj_source_payload_json: normalized.cj_source_payload_json,
        searchable_codes: normalized.searchable_codes,
        import_status: normalized.import_status,
        legacy_code: product.legacy_code || product.sku || null,
        display_search_code: normalized.display_search_code,
        source_import_version: normalized.source_import_version,
        sku: normalized.display_search_code || product.sku || null,
      };

      const variantPatches = normalized.variants.map((variant) => {
        const key = String(variant.cj_vid || variant.cj_variant_id || '').trim();
        const existing = variantsByKey.get(key);
        const delta = diffVariant(existing, variant);
        return {
          existing,
          delta,
          patch: {
            source: 'cj',
            cj_product_id: normalized.cj_product_id,
            cj_variant_id: variant.cj_variant_id,
            cj_vid: variant.cj_vid,
            cj_variant_sku: variant.cj_variant_sku,
            cj_variant_code: variant.cj_variant_code,
            cj_sku: variant.cj_sku,
            cj_option_summary: variant.option_summary,
            supplier_variant_ref: variant.supplier_variant_ref,
            external_inventory_key: variant.external_inventory_key,
            variant_display_sku: variant.variant_display_sku,
            searchable_codes: variant.searchable_codes,
            is_orderable: variant.is_orderable,
            order_reference_type: variant.order_reference_type,
            raw_variant_payload_json: variant.raw_variant_payload_json,
            import_status: variant.warnings.length ? 'needs_review' : 'ready',
            legacy_code: existing?.legacy_code || existing?.variant_display_sku || null,
            sku: variant.variant_display_sku || (variant.cj_vid ? `CJ Variant ID: ${variant.cj_vid}` : existing?.sku || null),
          },
        };
      });

      changeLog.push({
        product_id: product.id,
        status: normalized.import_status,
        previous_display_sku: product.display_search_code || product.sku || null,
        new_display_sku: normalized.display_search_code || null,
        variants_changed: variantPatches.filter((entry) => entry.delta.changed).length,
      });

      if (dryRun) continue;

      await supabase.from('products').update(productPatch).eq('id', product.id);
      for (const entry of variantPatches) {
        if (!entry.existing?.id) continue;
        await supabase.from('product_variants').update(entry.patch).eq('id', entry.existing.id);
        if (entry.delta.changed) {
          await supabase.from('cj_import_repair_log').insert({
            product_id: product.id,
            variant_id: entry.existing.id,
            action: 'repair_variant_identity',
            previous_display_sku: entry.delta.previous_display_sku,
            new_display_sku: entry.delta.new_display_sku,
            previous_order_key: entry.delta.previous_order_key,
            new_order_key: entry.delta.new_order_key,
            source_import_version: normalized.source_import_version,
            details: { warnings: normalized.warnings },
          });
        }
      }
    } catch (repairError) {
      changeLog.push({
        product_id: product.id,
        status: 'needs_review',
        reason: repairError instanceof Error ? repairError.message : String(repairError),
      });
      if (!dryRun) {
        await supabase.from('products').update({ import_status: 'needs_review' }).eq('id', product.id);
      }
    }
  }

  console.log(JSON.stringify({ dryRun, scanned: products?.length || 0, changes: changeLog }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
