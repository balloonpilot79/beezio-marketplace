// Public catalog responses may omit variant metadata. In that case, load the
// product detail page before adding an item so its actual options can be chosen.
export function shouldOpenProductDetailsBeforePurchase(product: any): boolean {
  const nonEmpty = (value: unknown) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value && typeof value === 'object' && Object.keys(value).length);
  return product?.has_variants !== false || nonEmpty(product?.variants) || nonEmpty(product?.product_variants);
}
