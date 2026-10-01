type PriceRefreshItem = { productId: string; price: number; variantId?: string; isSample?: boolean };

export function refreshCartPublishedPrices<T extends PriceRefreshItem>(items: T[], prices: Map<string, number>): T[] {
  let changed = false;
  const updated = items.map(item => {
    const price = prices.get(item.productId);
    if (item.variantId || item.isSample || !Number.isFinite(price) || !(price! > 0) || item.price === price) return item;
    changed = true;
    return { ...item, price: price! };
  });
  return changed ? updated : items;
}
