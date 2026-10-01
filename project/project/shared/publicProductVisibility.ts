export const PUBLIC_TEST_PRODUCT_IDS = new Set(['721f1a14-645b-4aee-97b2-ec9ae780eeca']);

export function isPublicTestProduct(product: { id?: string | null }) {
  return PUBLIC_TEST_PRODUCT_IDS.has(String(product?.id || ''));
}
