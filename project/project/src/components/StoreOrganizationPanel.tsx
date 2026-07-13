import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, FolderOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StorePlacementPicker, {
  EMPTY_STORE_PLACEMENT,
  StorePlacementSelection,
} from './StorePlacementPicker';
import { saveStoreProductPlacement } from '../utils/storeProductPlacement';

type StoreOrganizationPanelProps = {
  ownerId: string;
  role: 'seller' | 'affiliate';
};

const StoreOrganizationPanel: React.FC<StoreOrganizationPanelProps> = ({ ownerId, role }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [placements, setPlacements] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selection, setSelection] = useState<StorePlacementSelection>({ ...EMPTY_STORE_PLACEMENT });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    setError(null);
    try {
      const catalogResult = role === 'affiliate'
        ? await supabase.from('affiliate_products').select('product_id').eq('affiliate_id', ownerId)
        : await supabase.from('seller_product_order').select('product_id').eq('seller_id', ownerId);
      if (catalogResult.error) throw catalogResult.error;

      let productIds = (catalogResult.data || []).map((row: any) => row.product_id).filter(Boolean);
      if (role === 'seller') {
        const { data: ownedProducts, error: ownedError } = await supabase
          .from('products')
          .select('id')
          .eq('seller_id', ownerId);
        if (ownedError) throw ownedError;
        productIds = [...productIds, ...(ownedProducts || []).map((product: any) => product.id)];
      }
      productIds = Array.from(new Set(productIds));

      const [productResult, placementResult] = await Promise.all([
        productIds.length
          ? supabase.from('products').select('id,title,images,primary_image_url').in('id', productIds)
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from('store_product_placements')
          .select('product_id,placement_type,collection_id,custom_page_id,section_key')
          .eq('owner_id', ownerId),
      ]);
      if (productResult.error) throw productResult.error;
      if (placementResult.error) throw placementResult.error;
      setProducts(productResult.data || []);
      setPlacements(placementResult.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load product organization.');
    } finally {
      setLoading(false);
    }
  }, [ownerId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const organizedProductIds = useMemo(
    () => new Set(placements.map((placement) => placement.product_id)),
    [placements]
  );
  const unorganizedProducts = products.filter((product) => !organizedProductIds.has(product.id));

  const openProduct = (product: any) => {
    const current = placements.filter((placement) => placement.product_id === product.id);
    setSelection({
      collectionIds: current.filter((row) => row.placement_type === 'collection').map((row) => row.collection_id).filter(Boolean),
      pageIds: current.filter((row) => row.placement_type === 'page').map((row) => row.custom_page_id).filter(Boolean),
      featureOnHomepage: current.some((row) => row.placement_type === 'homepage' && row.section_key === 'featured-products'),
    });
    setSelectedProduct(product);
  };

  const handleSave = async () => {
    if (!selectedProduct || saving) return;
    try {
      setSaving(true);
      setError(null);
      await saveStoreProductPlacement(ownerId, selectedProduct.id, selection);
      setSelectedProduct(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save product locations.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-stone-950">Organize store products</h4>
          <p className="text-sm text-stone-600">Products can appear in several collections or pages without being duplicated.</p>
        </div>
        <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
          {unorganizedProducts.length} unorganized
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Loading store products...</p>
      ) : products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">Add a product first, then its placement controls will appear here.</p>
      ) : (
        <div className="space-y-2">
          {products.map((product) => {
            const organized = organizedProductIds.has(product.id);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => openProduct(product)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3 text-left hover:bg-stone-50"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-stone-900">{product.title || 'Product'}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${organized ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {organized ? <Check className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
                  {organized ? 'Organized' : 'Choose location'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedProduct && (
        <div className="mt-5 rounded-2xl border border-stone-300 p-4">
          <div className="mb-3 font-semibold text-stone-900">Organize: {selectedProduct.title}</div>
          <StorePlacementPicker ownerId={ownerId} ownerType={role} value={selection} onChange={setSelection} />
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={() => setSelectedProduct(null)} className="flex-1 rounded-lg border border-stone-300 px-4 py-2 font-semibold">Cancel</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving} className="flex-1 rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save locations'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
};

export default StoreOrganizationPanel;
