// Catalog prices remain the complete pre-tax price for compatibility with saved orders.
export function getProductShipping(product: any): number {
  if (product?.is_digital === true) return 0;
  const raw = Number(product?.shipping_reserve_amount ?? product?.shipping_price ?? product?.shipping_cost ?? 0);
  return Number.isFinite(raw) ? Math.round(Math.max(0, raw) * 100) / 100 : 0;
}
export function priceBeforeShipping(deliveredPrice: number, shipping: number): number {
  return Math.round(Math.max(0, deliveredPrice - shipping) * 100) / 100;
}

export function productWithSelectedVariant(product: any, variant: any): any {
  if (!variant) return product;
  const source = String(product?.source_platform || product?.source || '').toLowerCase();
  const shipping = ['cj', 'supplyline_plus'].includes(source) ? getProductShipping({ ...product, ...variant }) : getProductShipping(product);
  return { ...product, ...variant, shipping_reserve_amount: shipping };
}
