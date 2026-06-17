export type CjWarningCode =
  | 'missing_product_reference'
  | 'missing_variant_reference'
  | 'missing_variant_display_code'
  | 'duplicate_variant_display_code'
  | 'display_code_not_attached'
  | 'parent_code_shown_as_variant';

export type CjWarning = {
  code: CjWarningCode;
  message: string;
  variantIndex?: number;
};

export type NormalizedSearchableCode = {
  value: string;
  normalized: string;
};

export type NormalizedCjVariant = {
  source: 'cj';
  cj_variant_id: string | null;
  cj_vid: string | null;
  cj_variant_sku: string | null;
  cj_variant_code: string | null;
  cj_sku: string | null;
  cj_pid: string | null;
  option_summary: string | null;
  price: number | null;
  inventory: number | null;
  image: string | null;
  supplier_variant_ref: string | null;
  external_inventory_key: string | null;
  variant_display_sku: string | null;
  searchable_codes: string[];
  searchable_code_pairs: NormalizedSearchableCode[];
  is_orderable: boolean;
  order_reference_type: 'cj_vid' | 'cj_variant_id' | 'none';
  raw_variant_payload_json: Record<string, unknown>;
  warnings: CjWarning[];
};

export type NormalizedCjProduct = {
  source: 'cj';
  cj_product_id: string | null;
  cj_pid: string | null;
  cj_product_code: string | null;
  cj_product_sku: string | null;
  cj_spu: string | null;
  cj_name_raw: string | null;
  title: string | null;
  description: string | null;
  images: string[];
  searchable_codes: string[];
  searchable_code_pairs: NormalizedSearchableCode[];
  display_search_code: string | null;
  import_status: 'ready' | 'needs_review';
  source_import_version: string;
  cj_source_payload_json: Record<string, unknown>;
  variants: NormalizedCjVariant[];
  warnings: CjWarning[];
};

const ARRAY_SPLIT = /[|,;/]+/;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeImageList = (...values: unknown[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const list = Array.isArray(value) ? value : [value];
    for (const entry of list) {
      const text = String(entry ?? '').trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }
  return out;
};

const buildOptionSummary = (variant: Record<string, unknown>): string | null => {
  const explicit = firstString(
    variant.variantNameEn,
    variant.variantName,
    variant.variantKeyEn,
    variant.variantKey,
    variant.variant_name,
  );
  if (explicit) return explicit;

  const parts = String(variant.attributes ?? '')
    .split(ARRAY_SPLIT)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
};

export const normalizeCodeForSearch = (value: unknown): string => String(value ?? '').trim().toUpperCase();

export const buildSearchableCodePairs = (values: unknown[]): NormalizedSearchableCode[] => {
  const seen = new Set<string>();
  const out: NormalizedSearchableCode[] = [];

  for (const value of values) {
    const original = String(value ?? '').trim();
    if (!original) continue;
    const normalized = normalizeCodeForSearch(original);
    const key = `${original}::${normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ value: original, normalized });
  }

  return out;
};

export const buildSearchableCodes = (values: unknown[]): string[] => {
  const pairs = buildSearchableCodePairs(values);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const pair of pairs) {
    if (!seen.has(pair.value)) {
      seen.add(pair.value);
      out.push(pair.value);
    }
    if (!seen.has(pair.normalized)) {
      seen.add(pair.normalized);
      out.push(pair.normalized);
    }
  }

  return out;
};

export const validateCjVariantForOrdering = (variant: {
  source?: string | null;
  cj_vid?: string | null;
  cj_variant_id?: string | null;
  variant_display_sku?: string | null;
  searchable_codes?: string[] | null;
}): { ok: boolean; reason?: string; orderReferenceType: 'cj_vid' | 'cj_variant_id' | 'none' } => {
  const source = String(variant?.source || '').trim().toLowerCase();
  if (source && source !== 'cj') {
    return { ok: true, orderReferenceType: 'none' };
  }

  const cjVid = firstString(variant?.cj_vid);
  const cjVariantId = firstString(variant?.cj_variant_id);
  const displaySku = firstString(variant?.variant_display_sku);
  const searchableCodes = Array.isArray(variant?.searchable_codes) ? variant.searchable_codes : [];
  const orderReferenceType = cjVid ? 'cj_vid' : cjVariantId ? 'cj_variant_id' : 'none';

  if (!cjVid && !cjVariantId) {
    return { ok: false, reason: 'CJ variant mapping is missing a CJ VID/CJ variant id.', orderReferenceType };
  }

  if (displaySku && searchableCodes.length > 0) {
    const normalizedDisplay = normalizeCodeForSearch(displaySku);
    const codeSet = new Set(searchableCodes.map((code) => normalizeCodeForSearch(code)));
    if (!codeSet.has(normalizedDisplay)) {
      return {
        ok: false,
        reason: 'Displayed SKU is not attached to the saved CJ variant searchable codes.',
        orderReferenceType,
      };
    }
  }

  return { ok: true, orderReferenceType };
};

export const normalizeCjDetailPayload = (
  rawPayload: Record<string, unknown>,
  options?: { importVersion?: string },
): NormalizedCjProduct => {
  const importVersion = String(options?.importVersion || 'cj-import-v2').trim();
  const payload = asRecord(rawPayload);
  const variantsRaw =
    (Array.isArray(payload.variants) && payload.variants) ||
    (Array.isArray(payload.variantList) && payload.variantList) ||
    (Array.isArray(payload.variantsList) && payload.variantsList) ||
    (Array.isArray(payload.productVariantList) && payload.productVariantList) ||
    (Array.isArray(payload.variantVos) && payload.variantVos) ||
    [];

  const cjProductId = firstString(payload.productId, payload.product_id, payload.id, payload.pid);
  const cjPid = firstString(payload.pid, payload.productId, payload.product_id, payload.id);
  const cjProductCode = firstString(payload.productCode, payload.productCodeEn, payload.code);
  const cjProductSku = firstString(payload.productSku, payload.sku);
  const cjSpu = firstString(payload.productSpu, payload.spu, payload.spuCode, payload.spuId);
  const title = firstString(payload.productNameEn, payload.nameEn, payload.productName, payload.name, payload.title);
  const description = firstString(payload.description, payload.productDescription, payload.remark, payload.detail);
  const images = normalizeImageList(
    payload.productImage,
    payload.bigImage,
    payload.image,
    payload.mainImage,
    payload.productImageList,
    payload.images,
    payload.imageList,
  );

  const warnings: CjWarning[] = [];
  const seenDisplayCodes = new Map<string, number>();

  const variants: NormalizedCjVariant[] = variantsRaw.map((item, index) => {
    const variant = asRecord(item);
    const cjVariantId = firstString(variant.variantId, variant.variant_id, variant.id, variant.vid, variant.skuId);
    const cjVid = firstString(variant.vid, variant.vidCode, variant.variantVid);
    const cjVariantSku = firstString(variant.variantSku, variant.variant_sku);
    const cjVariantCode = firstString(variant.variantCode, variant.variant_code, variant.productCode, variant.code);
    const cjSku = firstString(variant.sku, variant.productSku);
    const optionSummary = buildOptionSummary(variant);
    const variantDisplaySku = firstString(cjVariantSku, cjVariantCode, cjSku);
    const searchableSourceCodes = [
      cjProductCode,
      cjProductSku,
      cjSpu,
      cjPid,
      cjProductId,
      cjVariantSku,
      cjVariantCode,
      cjSku,
      cjVid,
      cjVariantId,
    ];
    const searchableCodePairs = buildSearchableCodePairs(searchableSourceCodes);
    const searchableCodes = buildSearchableCodes(searchableSourceCodes);
    const orderable = Boolean(cjVid || cjVariantId);
    const variantWarnings: CjWarning[] = [];

    if (!orderable) {
      variantWarnings.push({
        code: 'missing_variant_reference',
        message: 'Variant is missing both CJ VID and CJ variant id.',
        variantIndex: index,
      });
    }

    if (!variantDisplaySku) {
      variantWarnings.push({
        code: 'missing_variant_display_code',
        message: 'Variant has no variant-level SKU/code. Admin UI must fall back to CJ Variant ID only.',
        variantIndex: index,
      });
    } else {
      const normalizedDisplay = normalizeCodeForSearch(variantDisplaySku);
      if (normalizedDisplay) {
        const existing = seenDisplayCodes.get(normalizedDisplay);
        if (typeof existing === 'number') {
          variantWarnings.push({
            code: 'duplicate_variant_display_code',
            message: 'Another variant already uses this displayed variant code.',
            variantIndex: index,
          });
        } else {
          seenDisplayCodes.set(normalizedDisplay, index);
        }
      }
    }

    return {
      source: 'cj',
      cj_variant_id: cjVariantId,
      cj_vid: cjVid,
      cj_variant_sku: cjVariantSku,
      cj_variant_code: cjVariantCode,
      cj_sku: cjSku,
      cj_pid: cjPid,
      option_summary: optionSummary,
      price: toNumber(variant.variantSellPrice ?? variant.sellPrice ?? variant.price ?? variant.variantPrice),
      inventory: toNumber(
        variant.variantStock ??
          variant.stock ??
          variant.inventory ??
          variant.inventoryNum ??
          variant.variantInventoryNum,
      ),
      image: firstString(
        variant.variantImage,
        variant.variantBigImage,
        variant.variantImageUrl,
        variant.image,
        variant.bigImage,
      ),
      supplier_variant_ref: firstString(variant.supplierVariantRef, variant.variantKey, variant.variantKeyEn),
      external_inventory_key: firstString(
        variant.externalInventoryKey,
        variant.inventoryKey,
        variant.inventoryCode,
        cjVid,
        cjVariantId,
      ),
      variant_display_sku: variantDisplaySku,
      searchable_codes: searchableCodes,
      searchable_code_pairs: searchableCodePairs,
      is_orderable: orderable,
      order_reference_type: cjVid ? 'cj_vid' : cjVariantId ? 'cj_variant_id' : 'none',
      raw_variant_payload_json: variant,
      warnings: variantWarnings,
    };
  });

  if (!cjPid && !cjProductId) {
    warnings.push({
      code: 'missing_product_reference',
      message: 'CJ product is missing both PID and product id.',
    });
  }

  for (let i = 0; i < variants.length; i += 1) {
    const variant = variants[i];
    const displayCode = normalizeCodeForSearch(variant.variant_display_sku);
    const parentDisplayCandidates = [cjProductSku, cjProductCode, cjSpu]
      .map(normalizeCodeForSearch)
      .filter(Boolean);

    if (displayCode && parentDisplayCandidates.includes(displayCode) && variant.cj_variant_sku == null && variant.cj_variant_code == null) {
      variant.warnings.push({
        code: 'parent_code_shown_as_variant',
        message: 'Variant display code resolves to a parent-level CJ code instead of a variant-level code.',
        variantIndex: i,
      });
    }

    warnings.push(...variant.warnings);
  }

  const searchableSourceCodes = [
    cjProductCode,
    cjProductSku,
    cjSpu,
    cjPid,
    cjProductId,
    ...variants.flatMap((variant) => [
      variant.cj_variant_sku,
      variant.cj_variant_code,
      variant.cj_sku,
      variant.cj_vid,
      variant.cj_variant_id,
    ]),
  ];
  const searchableCodePairs = buildSearchableCodePairs(searchableSourceCodes);
  const searchableCodes = buildSearchableCodes(searchableSourceCodes);
  const displaySearchCode =
    firstString(
      variants.find((variant) => variant.variant_display_sku)?.variant_display_sku,
      cjProductSku,
      cjProductCode,
      cjSpu,
      cjPid,
      cjProductId,
    ) ?? null;

  return {
    source: 'cj',
    cj_product_id: cjProductId,
    cj_pid: cjPid,
    cj_product_code: cjProductCode,
    cj_product_sku: cjProductSku,
    cj_spu: cjSpu,
    cj_name_raw: title,
    title,
    description,
    images,
    searchable_codes: searchableCodes,
    searchable_code_pairs: searchableCodePairs,
    display_search_code: displaySearchCode,
    import_status: warnings.length > 0 ? 'needs_review' : 'ready',
    source_import_version: importVersion,
    cj_source_payload_json: payload,
    variants,
    warnings,
  };
};
