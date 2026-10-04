// Dedicated storefronts curate their own product list separately from affiliate_products.
export async function ensureAffiliateStorefrontPlacement(db: any, affiliateId: string, productId: string) {
  const settings = await db.from('affiliate_store_settings').select('subdomain').eq('affiliate_id', affiliateId).maybeSingle();
  if (settings.error) throw new Error(`Failed to load affiliate store: ${settings.error.message}`);
  const slug = String(settings.data?.subdomain || '').trim().toLowerCase();
  if (!slug) return;
  const store = await db.from('storefronts').select('id').eq('owner_id', affiliateId).eq('slug', slug).maybeSingle();
  if (store.error) throw new Error(`Failed to resolve affiliate storefront: ${store.error.message}`);
  if (!store.data?.id) return;
  const existing = await db.from('storefront_products').select('id').eq('storefront_id', store.data.id).eq('product_id', productId).limit(1);
  if (existing.error) throw new Error(`Failed to check storefront placement: ${existing.error.message}`);
  if (existing.data?.length) return;
  const placement = await db.from('storefront_products').insert({
    storefront_id: store.data.id, product_id: productId, position: 0,
    placement_source: 'affiliate', source_owner_id: affiliateId,
  });
  if (placement.error) throw new Error(`Failed to add product to storefront: ${placement.error.message}`);
}
