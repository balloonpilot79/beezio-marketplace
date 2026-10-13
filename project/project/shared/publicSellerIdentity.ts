import { resolveHouseBrandIdentity } from './houseBrandIdentity';

// A product can be promoted in someone else's store. That store's branding
// must never replace the identity of the product's actual seller.
export function getPublicSellerName(profileName: unknown, settings: any, storefront?: any): string {
  const brand = resolveHouseBrandIdentity(storefront?.slug, storefront?.theme_settings?.brand_personality);
  return String(brand?.name || storefront?.name || settings?.store_name || profileName || 'Seller').trim() || 'Seller';
}

export function getOwnedProductStorefront(storefronts: any[], sellerId: unknown): any | null {
  const owned = storefronts.filter(store => String(store?.owner_id || '') === String(sellerId || '') && Boolean(sellerId));
  return owned.find(store => Boolean(resolveHouseBrandIdentity(store?.slug, store?.theme_settings?.brand_personality))) || owned[0] || null;
}
