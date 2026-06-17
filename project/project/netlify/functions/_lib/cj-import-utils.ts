type CsvRow = Record<string, string>;

export type ImportVariantInput = {
  cj_variant_id: string;
  sku?: string;
  option1_name?: string;
  option1_value?: string;
  option2_name?: string;
  option2_value?: string;
  option3_name?: string;
  option3_value?: string;
  weight_oz?: number;
  cost_cents?: number;
  inventory?: number | null;
  inventory_policy?: 'deny' | 'continue';
  is_active?: boolean;
  image_url?: string | null;
  attributes?: Record<string, string>;
  raw?: any;
};

export type ImportProductInput = {
  cj_product_id: string;
  title: string;
  description?: string;
  cj_category_path?: string;
  primary_image_url?: string | null;
  image_urls?: string[];
  base_weight_oz?: number;
  base_cost_cents?: number;
  affiliate_percent?: number;
  affiliate_floor_cents?: number;
  affiliate_enabled?: boolean;
  markup_type?: 'flat' | 'percent';
  markup_value?: number;
  paypal_fee_bps?: number;
  paypal_fixed_cents?: number;
  track_inventory?: boolean;
  status?: 'draft' | 'active' | 'archived';
  variants?: ImportVariantInput[];
  raw?: any;
};

export type PricingRules = {
  affiliate_percent: number;
  affiliate_floor_cents: number;
  affiliate_enabled: boolean;
  markup_type: 'flat' | 'percent';
  markup_value: number;
  paypal_fee_bps: number;
  paypal_fixed_cents: number;
};

export type ShippingTier = {
  min_oz: number;
  max_oz: number;
  shipping_cents: number;
};

const MIN_CJ_MARKUP_CENTS = 300;
const ATTRIBUTE_PART_SPLIT = /[|,;\/]+/;

const normalizeHeader = (value: string) => value.trim().toLowerCase();

export function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    current.push(field);
    field = '';
  };

  const pushRow = () => {
    if (current.length === 0 && field.trim() === '') return;
    pushField();
    rows.push(current);
    current = [];
  };

  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }

    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }

    if (ch === '\r') {
      if (next === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }

    field += ch;
    i += 1;
  }

  pushRow();

  if (rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  const dataRows = rows.slice(1);
  return dataRows
    .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => {
      const obj: CsvRow = {};
      headers.forEach((header, idx) => {
        obj[header] = String(row[idx] ?? '').trim();
      });
      return obj;
    });
}

export function parseVariantAttributes(raw: { variantKey?: string; variantNameEn?: string; attributes?: any }): Record<string, string> {
  const attributes: Record<string, string> = {};
  const looseFragments: string[] = [];

  const hydrate = (source?: string) => {
    if (!source) return;
    const cleaned = String(source).replace(/[\r\n]+/g, ' ').trim();
    if (!cleaned) return;
    const parts = cleaned
      .split(ATTRIBUTE_PART_SPLIT)
      .map((part) => part.trim())
      .filter(Boolean);

    parts.forEach((part) => {
      const separatorIndex = part.search(/[:=]/);
      if (separatorIndex >= 0) {
        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (key && value) {
          attributes[key] = value;
          return;
        }
      }
      looseFragments.push(part);
    });
  };

  hydrate(raw.variantKey);
  hydrate(raw.variantNameEn);

  if (raw.attributes && typeof raw.attributes === 'object' && !Array.isArray(raw.attributes)) {
    Object.entries(raw.attributes).forEach(([key, value]) => {
      const safeKey = String(key || '').trim();
      const safeValue = String(value ?? '').trim();
      if (!safeKey || !safeValue) return;
      attributes[safeKey] = safeValue;
    });
  }

  if (looseFragments.length > 0) {
    looseFragments.forEach((fragment, index) => {
      const fallbackKey = `Option ${index + 1}`;
      if (!attributes[fallbackKey]) {
        attributes[fallbackKey] = fragment;
      }
    });
  }

  if (Object.keys(attributes).length === 0 && raw.variantNameEn) {
    attributes['Variant'] = raw.variantNameEn;
  }

  return attributes;
}

export function attributesToOptions(attributes: Record<string, string> | null | undefined) {
  const entries = Object.entries(attributes || {});
  const [opt1, opt2, opt3] = entries;
  return {
    option1_name: opt1?.[0],
    option1_value: opt1?.[1],
    option2_name: opt2?.[0],
    option2_value: opt2?.[1],
    option3_name: opt3?.[0],
    option3_value: opt3?.[1],
  };
}

const toInt = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const toCents = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (Math.abs(n) >= 1000 && Number.isInteger(n)) {
    return Math.round(n);
  }
  return Math.round(n * 100);
};

const normalizeStringList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.includes(',')) return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
    return [trimmed];
  }
  return [];
};

export function normalizeJsonInput(input: any[]): ImportProductInput[] {
  return input
    .map((raw) => {
      const cjProductId = String(raw?.cj_product_id ?? raw?.pid ?? raw?.productId ?? raw?.product_id ?? '').trim();
      if (!cjProductId) return null;

      const title = String(raw?.title ?? raw?.productNameEn ?? raw?.name ?? '').trim();
      if (!title) return null;

      const imageUrls = normalizeStringList(raw?.image_urls ?? raw?.images ?? raw?.productImageList ?? raw?.productImages);
      const primaryImage = String(raw?.primary_image_url ?? raw?.productImage ?? imageUrls[0] ?? '').trim() || null;
      const variantsRaw = Array.isArray(raw?.variants) ? raw.variants : [];

      const variants = variantsRaw
        .map((variant: any) => {
          const cjVariantId = String(variant?.cj_variant_id ?? variant?.vid ?? variant?.variantId ?? '').trim();
          if (!cjVariantId) return null;

          const attributes = parseVariantAttributes({
            variantKey: String(variant?.variantKey ?? '').trim(),
            variantNameEn: String(variant?.variantNameEn ?? variant?.name ?? '').trim(),
            attributes: variant?.attributes,
          });
          const options = attributesToOptions(attributes);

          return {
            cj_variant_id: cjVariantId,
            sku: String(variant?.sku ?? variant?.variantSku ?? '').trim() || undefined,
            weight_oz: toInt(variant?.weight_oz ?? variant?.weightOz ?? variant?.variantWeight),
            cost_cents: toCents(variant?.cost_cents ?? variant?.variantSellPrice ?? variant?.sellPrice ?? variant?.price),
            inventory: toInt(variant?.inventory ?? variant?.variantStock ?? variant?.stock),
            inventory_policy: (String(variant?.inventory_policy ?? '').trim() as 'deny' | 'continue') || undefined,
            is_active: variant?.is_active === false ? false : undefined,
            image_url: String(variant?.image_url ?? variant?.variantImage ?? variant?.image ?? '').trim() || undefined,
            attributes,
            ...options,
            raw: variant,
          } as ImportVariantInput;
        })
        .filter(Boolean) as ImportVariantInput[];

      return {
        cj_product_id: cjProductId,
        title,
        description: String(raw?.description ?? '').trim() || undefined,
        cj_category_path: String(raw?.cj_category_path ?? raw?.categoryPath ?? raw?.categoryName ?? '').trim() || undefined,
        primary_image_url: primaryImage,
        image_urls: imageUrls.length ? imageUrls : primaryImage ? [primaryImage] : [],
        base_weight_oz: toInt(raw?.base_weight_oz ?? raw?.weightOz ?? raw?.weight ?? raw?.productWeight),
        base_cost_cents: toCents(raw?.base_cost_cents ?? raw?.sellPrice ?? raw?.baseCost),
        affiliate_percent: toInt(raw?.affiliate_percent ?? raw?.affiliatePercent),
        affiliate_floor_cents: toCents(raw?.affiliate_floor_cents ?? raw?.affiliateFloor),
        affiliate_enabled: raw?.affiliate_enabled === false ? false : undefined,
        markup_type: (String(raw?.markup_type ?? '').trim() as 'flat' | 'percent') || undefined,
        markup_value: toInt(raw?.markup_value ?? raw?.markupValue),
        paypal_fee_bps: toInt(raw?.paypal_fee_bps ?? raw?.paypalFeeBps),
        paypal_fixed_cents: toCents(raw?.paypal_fixed_cents ?? raw?.paypalFixedCents),
        track_inventory: raw?.track_inventory === false ? false : undefined,
        status: (String(raw?.status ?? '').trim() as 'draft' | 'active' | 'archived') || undefined,
        variants,
        raw,
      } as ImportProductInput;
    })
    .filter(Boolean) as ImportProductInput[];
}

export function normalizeCsvInput(rows: CsvRow[]): ImportProductInput[] {
  const byProduct = new Map<string, ImportProductInput>();

  rows.forEach((row) => {
    const cjProductId = String(row['cj_product_id'] || row['pid'] || row['product_id'] || '').trim();
    if (!cjProductId) return;

    const title = String(row['title'] || row['product_name'] || row['productnameen'] || '').trim();
    if (!title) return;

    const imageUrls = normalizeStringList(row['image_urls'] || row['images']);
    const primaryImage = String(row['primary_image_url'] || row['productimage'] || imageUrls[0] || '').trim() || null;

    const base = byProduct.get(cjProductId) || {
      cj_product_id: cjProductId,
      title,
      description: String(row['description'] || '').trim() || undefined,
      cj_category_path: String(row['cj_category_path'] || row['category_path'] || row['categoryname'] || '').trim() || undefined,
      primary_image_url: primaryImage,
      image_urls: imageUrls.length ? imageUrls : primaryImage ? [primaryImage] : [],
      base_weight_oz: toInt(row['base_weight_oz'] || row['weight_oz'] || row['weight']),
      base_cost_cents: toCents(row['base_cost_cents'] || row['base_cost'] || row['sell_price']),
      affiliate_percent: toInt(row['affiliate_percent']),
      affiliate_floor_cents: toCents(row['affiliate_floor_cents']),
      affiliate_enabled: row['affiliate_enabled'] ? row['affiliate_enabled'].toLowerCase() !== 'false' : undefined,
      markup_type: (String(row['markup_type'] || '').trim() as 'flat' | 'percent') || undefined,
      markup_value: toInt(row['markup_value']),
      paypal_fee_bps: toInt(row['paypal_fee_bps']),
      paypal_fixed_cents: toCents(row['paypal_fixed_cents']),
      track_inventory: row['track_inventory'] ? row['track_inventory'].toLowerCase() !== 'false' : undefined,
      status: (String(row['status'] || '').trim() as 'draft' | 'active' | 'archived') || undefined,
      variants: [],
      raw: row,
    };

    const variantsJsonRaw = String(row['variants_json'] || '').trim();
    if (variantsJsonRaw) {
      try {
        const parsed = JSON.parse(variantsJsonRaw);
        if (Array.isArray(parsed)) {
          base.variants = parsed
            .map((variant: any) => {
              const cjVariantId = String(variant?.cj_variant_id ?? variant?.vid ?? variant?.variantId ?? '').trim();
              if (!cjVariantId) return null;
              const attributes = parseVariantAttributes({
                variantKey: String(variant?.variantKey ?? '').trim(),
                variantNameEn: String(variant?.variantNameEn ?? variant?.name ?? '').trim(),
                attributes: variant?.attributes,
              });
              const options = attributesToOptions(attributes);
              return {
                cj_variant_id: cjVariantId,
                sku: String(variant?.sku ?? variant?.variantSku ?? '').trim() || undefined,
                weight_oz: toInt(variant?.weight_oz ?? variant?.weightOz ?? variant?.variantWeight),
                cost_cents: toCents(variant?.cost_cents ?? variant?.variantSellPrice ?? variant?.sellPrice ?? variant?.price),
                inventory: toInt(variant?.inventory ?? variant?.variantStock ?? variant?.stock),
                inventory_policy: (String(variant?.inventory_policy ?? '').trim() as 'deny' | 'continue') || undefined,
                is_active: variant?.is_active === false ? false : undefined,
                image_url: String(variant?.image_url ?? variant?.variantImage ?? variant?.image ?? '').trim() || undefined,
                attributes,
                ...options,
                raw: variant,
              } as ImportVariantInput;
            })
            .filter(Boolean) as ImportVariantInput[];
        }
      } catch {
        // ignore malformed variants_json
      }
    }

    const cjVariantId = String(row['cj_variant_id'] || row['vid'] || '').trim();
    if (cjVariantId) {
      const attributes: Record<string, string> = {};
      const optionPairs = [
        [row['option1_name'], row['option1_value']],
        [row['option2_name'], row['option2_value']],
        [row['option3_name'], row['option3_value']],
      ];
      optionPairs.forEach(([name, value]) => {
        const key = String(name || '').trim();
        const val = String(value || '').trim();
        if (key && val) attributes[key] = val;
      });

      base.variants = base.variants || [];
      base.variants.push({
        cj_variant_id: cjVariantId,
        sku: String(row['sku'] || '').trim() || undefined,
        option1_name: String(row['option1_name'] || '').trim() || undefined,
        option1_value: String(row['option1_value'] || '').trim() || undefined,
        option2_name: String(row['option2_name'] || '').trim() || undefined,
        option2_value: String(row['option2_value'] || '').trim() || undefined,
        option3_name: String(row['option3_name'] || '').trim() || undefined,
        option3_value: String(row['option3_value'] || '').trim() || undefined,
        weight_oz: toInt(row['variant_weight_oz'] || row['weight_oz_variant']),
        cost_cents: toCents(row['variant_cost_cents'] || row['variant_sell_price'] || row['variant_price']),
        inventory: toInt(row['inventory'] || row['variant_stock']),
        inventory_policy: (String(row['inventory_policy'] || '').trim() as 'deny' | 'continue') || undefined,
        is_active: row['is_active'] ? row['is_active'].toLowerCase() !== 'false' : undefined,
        image_url: String(row['image_url'] || row['variant_image'] || '').trim() || undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined,
        raw: row,
      });
    }

    byProduct.set(cjProductId, base);
  });

  return Array.from(byProduct.values());
}

export function calculateRetailPriceCents(costCents: number, rules: PricingRules): number {
  const cost = Math.max(0, Math.round(costCents));
  const markup =
    rules.markup_type === 'percent'
      ? Math.max(Math.round(cost * (Math.max(0, rules.markup_value) / 100)), MIN_CJ_MARKUP_CENTS)
      : Math.max(Math.max(0, rules.markup_value), MIN_CJ_MARKUP_CENTS);
  const sellerAsk = (cost + markup) / 100;
  const affiliateRate = rules.affiliate_enabled ? Math.max(0, rules.affiliate_percent) / 100 : 0;
  return Math.round(
    computeListingPrice({
      ask: sellerAsk,
      partnerRate: affiliateRate,
      influencerActive: true,
      beezioRate: 0.1,
      paypalPct: 0.0399,
      paypalFixed: 0.6,
      payoutBuffer: 0,
    }) * 100
  );
}

export function estimateShippingCents(weightOz: number, tiers: ShippingTier[]): number {
  const weight = Math.max(0, Math.round(weightOz));
  for (const tier of tiers) {
    const min = Math.max(0, Math.round(tier.min_oz));
    const max = Math.max(min, Math.round(tier.max_oz));
    if (weight >= min && weight <= max) {
      return Math.max(0, Math.round(tier.shipping_cents));
    }
  }
  return 0;
}

export function deriveVariantInStock(params: {
  is_active: boolean;
  inventory: number;
  inventory_policy: 'deny' | 'continue';
}) {
  if (!params.is_active) return false;
  if (params.inventory_policy === 'continue') return true;
  return params.inventory > 0;
}

export function deriveProductStock(params: {
  track_inventory: boolean;
  status: 'draft' | 'active' | 'archived';
  variants: Array<{ inventory: number; is_active: boolean; in_stock: boolean }>;
}) {
  if (!params.track_inventory) {
    return {
      total_inventory: 0,
      in_stock: params.status !== 'archived',
    };
  }
  const activeVariants = params.variants.filter((v) => v.is_active);
  const totalInventory = activeVariants.reduce((acc, v) => acc + Math.max(0, v.inventory), 0);
  const inStock = activeVariants.some((v) => v.in_stock);
  return { total_inventory: totalInventory, in_stock: inStock };
}

export function resolveCategoryMapping(
  cjCategoryPath: string | null | undefined,
  map: Record<string, string>,
  fallback: string | null
) {
  if (!cjCategoryPath) return fallback;
  return map[cjCategoryPath] || fallback;
}
