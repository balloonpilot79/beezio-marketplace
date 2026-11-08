export const PICKUP_MODES = ['shipping', 'pickup', 'both'] as const;
export type PickupMode = typeof PICKUP_MODES[number];

type PickupProduct = {
  pickup_mode?: string | null;
  pickup_state?: string | null;
  pickup_zip?: string | null;
  seller_id?: string | null;
  is_digital?: boolean | null;
  dropship_provider?: string | null;
  source_platform?: string | null;
};

export function getCartPickupLocation(products: readonly PickupProduct[]) {
  const first = products[0];
  if (!first?.seller_id || !/^[A-Z]{2}$/.test(first.pickup_state || '') || !/^\d{5}$/.test(first.pickup_zip || '')) return null;
  const eligible = products.every(product =>
    (product.pickup_mode === 'both' || product.pickup_mode === 'pickup') &&
    product.seller_id === first.seller_id && product.pickup_state === first.pickup_state &&
    product.pickup_zip === first.pickup_zip && !product.is_digital && !product.dropship_provider &&
    (!product.source_platform || product.source_platform === 'manual')
  );
  return eligible ? { country: 'US', state: first.pickup_state!, zip: first.pickup_zip! } : null;
}
