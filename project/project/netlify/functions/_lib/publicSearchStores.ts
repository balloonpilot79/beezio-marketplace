import { SEARCH_APP_ROUTES } from '../../../shared/searchMetadata';
import { normalizeStoreSlug } from '../../../src/utils/normalizeStoreSlug';
import { RESERVED_STORE_SLUGS } from '../../../src/utils/storeSlug';

export type SearchStore = { slug: string; name: string; description: string; image: string | null };

// Page every source independently: affiliate-only members and empty stores count too.
export async function loadPublicSearchStores(db: any): Promise<SearchStore[]> {
  const read = async (table: string, fields: string, order: string) => {
    const rows: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from(table).select(fields).order(order, { ascending: true }).range(offset, offset + 499);
      if (error) throw new Error(`Public store directory unavailable (${table})`);
      rows.push(...(data || []));
      if (!data || data.length < 500) return rows;
    }
  };
  const [brands, sellers, affiliates, profiles] = await Promise.all([
    read('storefronts','id,slug,name,description,logo_url,is_active','id'),
    read('store_settings','seller_id,subdomain,store_name,store_description,store_logo','seller_id'),
    read('affiliate_store_settings','affiliate_id,subdomain,store_name,store_description,store_logo,is_active','affiliate_id'),
    read('profiles','id,subdomain,full_name,bio,role,primary_role','id'),
  ]);
  const result = new Map<string, SearchStore>();
  const inactiveBrands = new Set(brands.filter(r => r.is_active === false).map(r => normalizeStoreSlug(r.slug)));
  const add = (row: any, brand = false) => {
    const slug = normalizeStoreSlug(brand ? row.slug : row.subdomain);
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug) || RESERVED_STORE_SLUGS.has(slug) || SEARCH_APP_ROUTES.has(slug) || ['ambassadors','earn-by-referring','business','store-builder'].includes(slug) || row.is_active === false || inactiveBrands.has(slug)) return;
    if (!result.has(slug)) result.set(slug, { slug, name: String((brand ? row.name : row.store_name || row.full_name) || slug), description: String((brand ? row.description : row.store_description || row.bio) || ''), image: (brand ? row.logo_url : row.store_logo) || null });
  };
  // Match the public slug resolver's precedence; never turn buyer profiles into stores.
  brands.forEach(r => add(r,true));
  sellers.forEach(r => add(r));
  affiliates.forEach(r => add(r));
  const settingsOwners = new Set([...sellers.map(r => r.seller_id), ...affiliates.map(r => r.affiliate_id)]);
  profiles.filter(r => !settingsOwners.has(r.id) && ['seller','affiliate'].includes(String(r.primary_role || r.role).toLowerCase())).forEach(r => add(r));
  return [...result.values()].sort((a,b) => a.name.localeCompare(b.name));
}
