import { SUPPLYLINE_PLUS_NAME } from './cjContract';

const asText = (value: unknown): string => String(value ?? '').trim();

const PRIVATE_SUPPLYLINE_FIELDS = [
  'api_integration',
  'cj_name_raw',
  'cj_pid',
  'cj_product_code',
  'cj_product_id',
  'cj_product_sku',
  'cj_source_payload_json',
  'cj_spu',
  'cj_variant_code',
  'cj_variant_id',
  'cj_variant_sku',
  'cj_vid',
  'display_search_code',
  'dropship_provider',
  'external_inventory_key',
  'external_product_id',
  'external_variant_id',
  'platform_fee',
  'paypal_processing_allowance',
  'raw_variant_payload_json',
  'searchable_code_pairs',
  'searchable_codes',
  'seller_amount',
  'seller_ask',
  'seller_ask_price',
  'seller_markup_amount',
  'seller_payout_amount',
  'shipping_reserve_amount',
  'supplier_cost_amount',
  'supplier_variant_ref',
] as const;

export function isSupplyLineProduct(product: any): boolean {
  const markers = [
    product?.source_platform,
    product?.source,
    product?.dropship_provider,
    product?.inventory_source,
    product?.lineage,
  ]
    .map((value) => asText(value).toLowerCase())
    .filter(Boolean);

  if (markers.some((value) => value === 'cj' || value === 'supplyline_plus' || value === 'supplyline plus')) {
    return true;
  }

  if (
    asText(product?.cj_product_id) ||
    asText(product?.cj_pid) ||
    asText(product?.cj_spu) ||
    asText(product?.cj_vid)
  ) {
    return true;
  }

  const media = [
    ...(Array.isArray(product?.images) ? product.images : []),
    ...(Array.isArray(product?.videos) ? product.videos : []),
    product?.image_url,
    product?.primary_image_url,
  ];
  return media.some((entry) => asText(entry).toLowerCase().includes('cjdropshipping.com'));
}

export function sanitizeSupplyLineVariant<T extends Record<string, any>>(variant: T): T {
  const sanitized: Record<string, any> = { ...(variant || {}) };
  for (const field of PRIVATE_SUPPLYLINE_FIELDS) delete sanitized[field];

  // Variant database ids and customer-facing option labels remain available;
  // supplier order identifiers stay server-side.
  delete sanitized.sku;
  delete sanitized.variant_display_sku;
  sanitized.source = 'supplyline_plus';
  sanitized.source_platform = 'supplyline_plus';
  sanitized.inventory_source = 'managed';
  return sanitized as T;
}

export function sanitizeSupplyLineProduct<T extends Record<string, any>>(product: T): T {
  if (!isSupplyLineProduct(product)) return product;

  const sanitized: Record<string, any> = { ...(product || {}) };
  for (const field of PRIVATE_SUPPLYLINE_FIELDS) delete sanitized[field];

  delete sanitized.sku;
  sanitized.source = 'supplyline_plus';
  sanitized.source_platform = 'supplyline_plus';
  sanitized.inventory_source = 'managed';
  sanitized.lineage = SUPPLYLINE_PLUS_NAME;

  if (Array.isArray(sanitized.variants)) {
    sanitized.variants = sanitized.variants.map((variant: any) => sanitizeSupplyLineVariant(variant || {}));
  }

  return sanitized as T;
}
