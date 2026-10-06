export type CombinedShippingPolicy = { additionalItemCost: number };
export type ShippingItem = {
  quantity: number; shippingCost?: number; sellerId?: string; affiliateId?: string | null;
  storefrontScope?: string | null; shippingOptionName?: string; isDigital?: boolean;
  combinedShipping?: CombinedShippingPolicy | null;
};
const cents = (value: number) => Math.round(Math.max(0, Number(value) || 0) * 100);

/** Only a seller's saved opt-in can change shipping. Supplier-quoted goods remain separate. */
export function getCombinedShippingPolicy(product: any): CombinedShippingPolicy | null {
  if (product?.is_digital === true || product?.isSample === true || /^test item/i.test(String(product?.title || '')) || /checkout test/i.test(String(product?.title || ''))) return null;
  const source = [product?.source_platform, product?.source, product?.dropship_provider, product?.lineage, product?.inventory_source].map(x => String(x || '').toLowerCase());
  if (source.some(x => ['cj', 'supplyline_plus', 'supplyline plus'].includes(x))) return null;
  let options = product?.shipping_options;
  if (typeof options === 'string') { try { options = JSON.parse(options); } catch { return null; } }
  const option = Array.isArray(options) ? options[0] : null;
  if (option?.bundle_shipping !== true || option?.additional_item_cost == null || option?.additional_item_cost === '') return null;
  const cost = Number(option.additional_item_cost);
  const base = Number(product?.shipping_reserve_amount ?? product?.shipping_price ?? product?.shipping_cost ?? 0);
  return Number.isFinite(cost) && cost >= 0 && cost <= base ? { additionalItemCost: cents(cost) / 100 } : null;
}

export function shippingChannelKey(item: Pick<ShippingItem, 'sellerId' | 'affiliateId' | 'storefrontScope' | 'shippingOptionName'>): string {
  return JSON.stringify([item.sellerId || '']);
}

/** Return exact line totals; eligible items from the same seller can share a first-item charge. */
export function allocateCombinedShipping(items: ShippingItem[]): number[] {
  const totals = items.map(item => item.isDigital ? 0 : cents(Number(item.shippingCost || 0)) * Math.max(1, Math.floor(Number(item.quantity) || 1)));
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const additional = item.combinedShipping?.additionalItemCost;
    if (!item.sellerId || item.isDigital || additional == null || !Number.isFinite(additional) || additional < 0 || cents(additional) > cents(Number(item.shippingCost || 0))) return;
    const key = shippingChannelKey(item);
    groups.set(key, [...(groups.get(key) || []), index]);
  });
  for (const indices of groups.values()) {
    let anchor = indices[0];
    let surcharge = -1;
    for (const index of indices) {
      const item = items[index];
      const extra = cents(item.combinedShipping!.additionalItemCost);
      const first = cents(Number(item.shippingCost || 0)) - extra;
      totals[index] = extra * Math.max(1, Math.floor(Number(item.quantity) || 1));
      if (first > surcharge) { surcharge = first; anchor = index; }
    }
    totals[anchor] += surcharge;
  }
  return totals.map(value => value / 100);
}
export function getCombinedShippingTotal(items: ShippingItem[]): number {
  return allocateCombinedShipping(items).reduce((sum, value) => sum + cents(value), 0) / 100;
}

export function getCombinedShippingSavings(items: ShippingItem[]): number {
  const standard = items.reduce((sum, item) => sum + (item.isDigital ? 0 : cents(Number(item.shippingCost || 0)) * Math.max(1, Math.floor(Number(item.quantity) || 1))), 0);
  return Math.max(0, standard - cents(getCombinedShippingTotal(items))) / 100;
}

/** Split only when necessary to preserve exact cents in per-unit order snapshots. */
export function applyShippingAllocations<T extends { quantity: number; shippingReserveUnit: number }>(items: T[], lineTotals: number[]): T[] {
  return items.flatMap((item, index) => {
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const total = cents(lineTotals[index]);
    const unit = Math.floor(total / quantity);
    const remainder = total - unit * quantity;
    return [
      ...(quantity - remainder > 0 ? [{ ...item, quantity: quantity - remainder, shippingReserveUnit: unit / 100 }] : []),
      ...(remainder > 0 ? [{ ...item, quantity: remainder, shippingReserveUnit: (unit + 1) / 100 }] : []),
    ];
  });
}
