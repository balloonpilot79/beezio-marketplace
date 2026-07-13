import { supabase } from '../lib/supabase';

export type StoreCollection = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  display_order: number;
  is_visible: boolean;
};

export type StorePageOption = {
  id: string;
  page_title: string;
  page_slug: string;
  owner_type: string;
};

export type StorePlacementSelection = {
  collectionIds: string[];
  pageIds: string[];
  featureOnHomepage: boolean;
};

export const EMPTY_STORE_PLACEMENT: StorePlacementSelection = {
  collectionIds: [],
  pageIds: [],
  featureOnHomepage: false,
};

export const slugifyCollectionName = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export async function loadStorePlacementOptions(ownerId: string, ownerType?: 'seller' | 'affiliate') {
  const cleanOwnerId = String(ownerId || '').trim();
  if (!cleanOwnerId) return { collections: [], pages: [] };

  let pagesQuery = supabase
    .from('custom_pages')
    .select('id,page_title,page_slug,owner_type')
    .eq('owner_id', cleanOwnerId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (ownerType) pagesQuery = pagesQuery.eq('owner_type', ownerType);

  const [collectionsResult, pagesResult] = await Promise.all([
    supabase
      .from('store_collections')
      .select('id,owner_id,name,slug,display_order,is_visible')
      .eq('owner_id', cleanOwnerId)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true }),
    pagesQuery,
  ]);

  if (collectionsResult.error) throw collectionsResult.error;
  if (pagesResult.error) throw pagesResult.error;

  return {
    collections: (collectionsResult.data || []) as StoreCollection[],
    pages: (pagesResult.data || []) as StorePageOption[],
  };
}

export async function createStoreCollection(ownerId: string, name: string): Promise<StoreCollection> {
  const cleanOwnerId = String(ownerId || '').trim();
  const cleanName = String(name || '').trim();
  const slug = slugifyCollectionName(cleanName);
  if (!cleanOwnerId) throw new Error('Missing storefront owner');
  if (!slug) throw new Error('Enter a collection name');

  const { count, error: countError } = await supabase
    .from('store_collections')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', cleanOwnerId);
  if (countError) throw countError;

  const { data, error } = await supabase
    .from('store_collections')
    .insert({
      owner_id: cleanOwnerId,
      name: cleanName,
      slug,
      display_order: count || 0,
      is_visible: true,
    })
    .select('id,owner_id,name,slug,display_order,is_visible')
    .single();

  if (error) {
    if (String((error as any)?.code || '') === '23505') {
      throw new Error('A collection with that name already exists.');
    }
    throw error;
  }
  return data as StoreCollection;
}

export async function saveStoreProductPlacement(
  ownerId: string,
  productId: string,
  selection: StorePlacementSelection
) {
  const cleanOwnerId = String(ownerId || '').trim();
  const cleanProductId = String(productId || '').trim();
  if (!cleanOwnerId || !cleanProductId) throw new Error('Missing storefront product information');

  const collectionIds = Array.from(new Set((selection.collectionIds || []).filter(Boolean)));
  const pageIds = Array.from(new Set((selection.pageIds || []).filter(Boolean)));
  const placements = [
    ...collectionIds.map((collectionId, index) => ({
      owner_id: cleanOwnerId,
      product_id: cleanProductId,
      placement_type: 'collection',
      collection_id: collectionId,
      display_order: index,
      is_visible: true,
    })),
    ...pageIds.map((customPageId, index) => ({
      owner_id: cleanOwnerId,
      product_id: cleanProductId,
      placement_type: 'page',
      custom_page_id: customPageId,
      display_order: index,
      is_visible: true,
    })),
    ...(selection.featureOnHomepage
      ? [{
          owner_id: cleanOwnerId,
          product_id: cleanProductId,
          placement_type: 'homepage',
          section_key: 'featured-products',
          display_order: 0,
          is_visible: true,
        }]
      : []),
  ];

  const { error: deleteError } = await supabase
    .from('store_product_placements')
    .delete()
    .eq('owner_id', cleanOwnerId)
    .eq('product_id', cleanProductId);
  if (deleteError) throw deleteError;

  if (placements.length) {
    const { error: insertError } = await supabase
      .from('store_product_placements')
      .insert(placements);
    if (insertError) throw insertError;
  }

  return { organized: placements.length > 0, placementCount: placements.length };
}
