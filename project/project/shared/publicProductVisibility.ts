export const PUBLIC_TEST_PRODUCT_IDS = new Set(['721f1a14-645b-4aee-97b2-ec9ae780eeca']);

export function isPublicTestProduct(product: { id?: string | null }) {
  return PUBLIC_TEST_PRODUCT_IDS.has(String(product?.id || ''));
}

// Seller state is authoritative, even when a stale storefront placement remains.
export function isProductPublished(product: any): boolean {
  if (!product || isPublicTestProduct(product) || product.is_active === false) return false;
  const status = String(product.status || '').trim().toLowerCase();
  if (status && !['active', 'store_only'].includes(status)) return false;
  if (status || product.is_active === true) return true;
  // Legacy records without publication fields remain compatible.
  return !Object.prototype.hasOwnProperty.call(product, 'is_active');
}

export function isProductInStock(product: any): boolean {
  if (!product) return false;
  if (product.in_stock === false) return false;
  if (product.track_inventory === false) return true;
  const raw = product.stock_quantity ?? product.total_inventory;
  const known = raw != null && String(raw).trim() !== '' && Number.isFinite(Number(raw));
  return known ? Number(raw) > 0 : product.track_inventory !== true || product.in_stock === true;
}

export function isPublicStoreProduct(product: any): boolean {
  return isProductPublished(product) && isProductInStock(product);
}

export function isPublicAffiliateProduct(product: any): boolean {
  return isPublicStoreProduct(product) &&
    String(product.status || '').trim().toLowerCase() !== 'store_only' &&
    product.is_promotable !== false && product.affiliate_enabled !== false;
}

export function productAvailabilityNotice(product: any, affiliate = true): string | null {
  if (!isProductPublished(product)) return 'Withdrawn — hidden from all stores';
  if (!isProductInStock(product)) return 'Sold out — hidden from all stores';
  if (affiliate && !isPublicAffiliateProduct(product)) return 'Promotion disabled — hidden from affiliate stores';
  return null;
}
