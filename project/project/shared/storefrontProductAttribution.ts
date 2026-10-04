// A store's presentation type does not determine who earns its commission.
export function storefrontProductAttribution(store: any, placement: any, product: any) {
  if (!store?.id || placement?.product_id !== product?.id) return {};
  const owner = String(store.owner_id || '').trim();
  const affiliate = placement.placement_source === 'affiliate' &&
    placement.source_owner_id === owner && owner !== product.seller_id &&
    product.affiliate_enabled !== false;
  return {
    storefront_id: store.id,
    storefront_scope: `store:${store.type === 'affiliate' ? 'affiliate' : 'seller'}:${store.id}`,
    ...(affiliate ? { affiliate_id: owner } : {}),
  };
}
