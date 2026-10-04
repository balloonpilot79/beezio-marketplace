// Curated stores may use a seller layout while promoting another seller's items.
// Resolve commissions from saved placements, rather than the presentation type.
export async function resolvePlacedStorefrontAffiliate(db: any, storefrontId: string | null, productIds: string[], sellerId: string): Promise<string | null> {
  if (!storefrontId || !productIds.length) return null;
  const store = await db.from('storefronts').select('owner_id').eq('id', storefrontId).maybeSingle();
  if (store.error) throw new Error(store.error.message);
  const ownerId = String(store.data?.owner_id || '').trim();
  if (!ownerId || ownerId === sellerId) return null;
  const placements = await db.from('storefront_products').select('product_id,placement_source,source_owner_id').eq('storefront_id', storefrontId).in('product_id', productIds);
  if (placements.error) throw new Error(placements.error.message);
  return productIds.every(id => (placements.data || []).some((row: any) => row.product_id === id && row.placement_source === 'affiliate' && row.source_owner_id === ownerId)) ? ownerId : null;
}
