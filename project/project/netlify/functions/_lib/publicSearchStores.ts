import { SEARCH_APP_ROUTES } from '../../../shared/searchMetadata';
import { isPublicAffiliateProduct, isPublicStoreProduct } from '../../../shared/publicProductVisibility';
import { normalizeStoreSlug } from '../../../src/utils/normalizeStoreSlug';
import { RESERVED_STORE_SLUGS } from '../../../src/utils/storeSlug';

export type SearchStore = { slug: string; name: string; description: string; image: string | null };

// Page storefronts and their catalog sources independently.
export async function loadPublicSearchStores(db: any, { ownListingsOnly = false } = {}): Promise<SearchStore[]> {
  const read = async (table: string, fields: string, order: string) => {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(table).select(fields).order(order, { ascending: true }).range(offset, offset + 499);
      if (error) throw new Error(`Public store directory unavailable (${table})`);
      rows.push(...(data || []));
      if (!data || data.length < 500) return rows;
    }
  };
  const [brands, sellers, affiliates, profiles, products, brandProducts, sellerOrder, affiliateProducts] = await Promise.all([
    read('storefronts','id,owner_id,slug,name,description,logo_url,is_active','id'),
    read('store_settings','seller_id,subdomain,store_name,store_description,store_logo','seller_id'),
    read('affiliate_store_settings','affiliate_id,subdomain,store_name,store_description,store_logo,is_active','affiliate_id'),
    read('profiles','id,user_id,subdomain,full_name,bio,role,primary_role,store_logo_url,avatar_url','id'),
    read('products','id,seller_id,is_active,status,is_promotable,affiliate_enabled,stock_quantity,total_inventory,in_stock,track_inventory','id'),
    read('storefront_products','storefront_id,product_id,placement_source','id'),
    ownListingsOnly ? [] : read('seller_product_order','seller_id,product_id','id'),
    ownListingsOnly ? [] : read('affiliate_products','affiliate_id,product_id,is_active','id'),
  ]);
  const profileByOwner = new Map<string, any>();
  profiles.forEach(profile => {
    if (profile.id) profileByOwner.set(profile.id, profile);
    if (profile.user_id) profileByOwner.set(profile.user_id, profile);
  });
  const canonicalOwner = (id: string) => profileByOwner.get(id)?.id || id;
  const publicProducts = new Map(products.filter(isPublicStoreProduct).map(product => [product.id, product]));
  const memberStoresWithProducts = new Set<string>();
  const brandStoresWithProducts = new Set<string>();

  publicProducts.forEach(product => {
    if (product.seller_id) memberStoresWithProducts.add(canonicalOwner(product.seller_id));
  });
  sellerOrder.forEach(row => {
    const product = publicProducts.get(row.product_id);
    const owner = canonicalOwner(row.seller_id);
    if (owner && (canonicalOwner(product?.seller_id) === owner || isPublicAffiliateProduct(product))) {
      memberStoresWithProducts.add(owner);
    }
  });
  affiliateProducts.forEach(row => {
    if (row.affiliate_id && row.is_active === true && isPublicAffiliateProduct(publicProducts.get(row.product_id))) {
      memberStoresWithProducts.add(canonicalOwner(row.affiliate_id));
    }
  });
  const brandOwnerById = new Map(brands.map(brand => [brand.id, canonicalOwner(brand.owner_id)]));
  brandProducts.forEach(row => {
    const product = publicProducts.get(row.product_id);
    const owner = brandOwnerById.get(row.storefront_id);
    const ownsListing = canonicalOwner(product?.seller_id) === owner && row.placement_source !== 'affiliate';
    if (owner && (ownsListing || (!ownListingsOnly && isPublicAffiliateProduct(product)))) {
      brandStoresWithProducts.add(row.storefront_id);
    }
  });
  const logoFor = (row: any, brand: boolean) => {
    if (brand) return row.logo_url || null;
    const profile = profileByOwner.get(row.seller_id || row.affiliate_id || row.id || row.user_id);
    return row.store_logo || row.store_logo_url || profile?.store_logo_url || profile?.avatar_url || row.avatar_url || null;
  };
  const result = new Map<string, SearchStore | null>();
  const inactiveBrands = new Set(brands.filter(r => r.is_active === false).map(r => normalizeStoreSlug(r.slug)));
  const add = (row: any, brand = false) => {
    const slug = normalizeStoreSlug(brand ? row.slug : row.subdomain);
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug) || RESERVED_STORE_SLUGS.has(slug) || SEARCH_APP_ROUTES.has(slug) || ['ambassadors','earn-by-referring','business','store-builder'].includes(slug) || row.is_active === false || inactiveBrands.has(slug)) return;
    if (result.has(slug)) return;
    const hasProducts = brand
      ? brandStoresWithProducts.has(row.id)
      : memberStoresWithProducts.has(canonicalOwner(row.seller_id || row.affiliate_id || row.id));
    result.set(slug, hasProducts
      ? { slug, name: String((brand ? row.name : row.store_name || row.full_name) || slug), description: String((brand ? row.description : row.store_description || row.bio) || ''), image: logoFor(row, brand) }
      : null);
  };
  // Match the public slug resolver's precedence; never turn buyer profiles into stores.
  brands.forEach(r => add(r,true));
  sellers.forEach(r => add(r));
  affiliates.forEach(r => add(r));
  const settingsOwners = new Set([...sellers.map(r => r.seller_id), ...affiliates.map(r => r.affiliate_id)]);
  profiles.filter(r => !settingsOwners.has(r.id) && ['seller','affiliate'].includes(String(r.primary_role || r.role).toLowerCase())).forEach(r => add(r));
  return [...result.values()].filter((store): store is SearchStore => store !== null).sort((a,b) => a.name.localeCompare(b.name));
}
