import { getPublicSellerName } from './publicSellerIdentity';
import { isPublicAffiliateProduct } from './publicProductVisibility';

export type PublicStoreDirectoryEntry = { slug: string; name: string; image: string | null; productCount: number };

export function buildPublicStoreDirectory(products: any[], settingsBySeller: Map<string, any>, storefrontsByProduct: Map<string, any[]>, affiliateStores: any[] = []): PublicStoreDirectoryEntry[] {
  const directory = new Map<string, { slug: string; name: string; image: string | null; productIds: Set<string> }>();
  const visibleProducts = products.filter(isPublicAffiliateProduct);
  const productsById = new Map(visibleProducts.map(product => [String(product.id), product]));
  const addStore = (slugValue: unknown, name: string, product: any) => {
    const slug = String(slugValue || '').trim();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return;
    const store = directory.get(slug) || { slug, name, image: product?.images?.[0] || null, productIds: new Set<string>() };
    store.productIds.add(String(product.id));
    directory.set(slug, store);
  };
  const brandSlugs = new Set(Array.from(storefrontsByProduct.values()).flat().map(store => String(store.slug)));
  visibleProducts.forEach(product => {
    const settings = settingsBySeller.get(String(product.seller_id));
    if (settings?.subdomain && !brandSlugs.has(String(settings.subdomain))) {
      addStore(settings.subdomain, getPublicSellerName(product.profiles?.full_name, settings), product);
    }
    (storefrontsByProduct.get(String(product.id)) || []).forEach(store => {
      if (store.is_active === false) return;
      addStore(store.slug, getPublicSellerName(null, null, store), product);
    });
  });
  affiliateStores.forEach(store => {
    (store.productIds || []).forEach((id: string) => {
      const product = productsById.get(String(id));
      if (product) addStore(store.subdomain, getPublicSellerName(null, store), product);
    });
  });
  return Array.from(directory.values()).map(({ productIds, ...store }) => ({ ...store, productCount: productIds.size }));
}
