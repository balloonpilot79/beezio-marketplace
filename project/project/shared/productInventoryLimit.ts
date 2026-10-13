// null means inventory tracking is disabled; undefined means no stock count
// is known yet. Neither should be interpreted as zero units available.
export function getProductInventoryLimit(product: any, variant?: any): number | null | undefined {
  if (product?.in_stock === false || variant?.is_active === false || variant?.in_stock === false) return 0;
  if (product?.track_inventory === false) return null;
  for (const raw of [variant?.inventory, product?.stock_quantity ?? product?.total_inventory]) {
    if (raw == null || String(raw).trim() === '') continue;
    const stock = Number(raw);
    if (Number.isFinite(stock)) return Math.max(0, Math.floor(stock));
  }
  return undefined;
}
