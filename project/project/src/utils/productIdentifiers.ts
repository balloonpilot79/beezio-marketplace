const firstText = (...values: unknown[]): string | null => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return null;
};

const joinParts = (parts: Array<[string, string | null]>): string | null => {
  const rendered = parts
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`);
  return rendered.length ? rendered.join(' | ') : null;
};

export const getProductIdentifierLines = (product: any, variant?: any): string[] => {
  const productSku = firstText(product?.cj_product_sku, product?.sku, product?.productSku);
  const productSpu = firstText(product?.cj_spu, product?.productSpu, product?.spu);
  const variantSku = firstText(
    variant?.variant_display_sku,
    variant?.cj_variant_sku,
    variant?.sku,
    variant?.variantSku,
  );
  const variantReference = firstText(variant?.cj_vid, variant?.cj_variant_id, variant?.vid, variant?.variantId);

  const lines = [
    joinParts([
      ['SKU', productSku],
      ['SPU', productSpu],
    ]),
    variant
      ? joinParts([
          ['Variant', variantSku],
          ['VID', variantReference],
        ])
      : null,
  ].filter(Boolean);

  return lines as string[];
};

export const getProductReferenceLine = (product: any): string | null => {
  const productId = firstText(product?.id);
  return productId ? `Product ID: ${productId}` : null;
};
