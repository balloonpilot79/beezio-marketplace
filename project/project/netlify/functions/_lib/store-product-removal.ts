// Only caller-owned store selections are removed. Product/order history is retained.
export async function removeStoreProducts(db: any, ownerIds: string[], productIds: string[], role: 'affiliate' | 'seller') {
  if (!ownerIds.length || !productIds.length) throw new Error('Missing removal scope');
  const stores = await db.from('storefronts').select('id').in('owner_id', ownerIds);
  if (stores.error) throw new Error(stores.error.message);
  const storeIds = (stores.data || []).map((store: any) => store.id);
  if (storeIds.length) {
    const placements = await db.from('storefront_products').delete().in('storefront_id', storeIds).in('product_id', productIds);
    if (placements.error) throw new Error(placements.error.message);
  }
  const table = role === 'affiliate' ? 'affiliate_products' : 'seller_product_order';
  const ownerColumn = role === 'affiliate' ? 'affiliate_id' : 'seller_id';
  const result = await db.from(table).delete().in(ownerColumn, ownerIds).in('product_id', productIds);
  if (result.error) throw new Error(result.error.message);
}
