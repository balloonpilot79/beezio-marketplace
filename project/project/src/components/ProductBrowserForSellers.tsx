import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { addSellerStoreProduct } from '../api/sellerStore';
import { resolveProductImageFromList } from '../utils/imageHelpers';
import {
  Package,
  PackagePlus,
  Search,
  Filter,
  Check,
  XCircle,
  ArrowUp,
  ArrowDown,
  Star
} from 'lucide-react';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  stock_quantity?: number | null;
  total_inventory?: number | null;
  in_stock?: boolean | null;
  lineage?: string | null;
  dropship_provider?: string | null;
  is_active?: boolean | null;
  is_promotable?: boolean | null;
  status?: string | null;
  category?: string;
  profiles?: { full_name?: string | null } | null;
}

interface SellerProductBrowserProps {
  sellerId: string;
}

const ProductBrowserForSellers: React.FC<SellerProductBrowserProps> = ({ sellerId }) => {
  const [marketProducts, setMarketProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [featuredProducts, setFeaturedProducts] = useState<Set<string>>(new Set());
  const [bulkRemovalSelection, setBulkRemovalSelection] = useState<Set<string>>(new Set());
  const [bulkAddSelection, setBulkAddSelection] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    loadMarketplaceProducts();
    loadSelectedProducts();
  }, [sellerId]);

  useEffect(() => {
    const handler = () => {
      void loadSelectedProducts();
    };
    window.addEventListener('seller-products-changed', handler as EventListener);
    return () => window.removeEventListener('seller-products-changed', handler as EventListener);
  }, [sellerId]);

  useEffect(() => {
    if (!actionMessage) return;
    // Keep errors visible longer so users can actually read them.
    const isError = /^unable to|^cannot |^could not |^failed /i.test(actionMessage);
    const timeout = setTimeout(() => setActionMessage(null), isError ? 12000 : 4500);
    return () => clearTimeout(timeout);
  }, [actionMessage]);

  useEffect(() => {
    if (bulkRemovalSelection.size === 0) return;
    setBulkRemovalSelection((prev) => {
      const next = new Set(Array.from(prev).filter((id) => selectedProductIds.has(id)));
      return next;
    });
  }, [selectedProductIds, bulkRemovalSelection.size]);

  useEffect(() => {
    if (bulkAddSelection.size === 0) return;
    setBulkAddSelection((prev) => {
      const next = new Set(
        Array.from(prev).filter((id) => !selectedProductIds.has(id) && marketProducts.some((product) => product.id === id))
      );
      return next;
    });
  }, [selectedProductIds, marketProducts, bulkAddSelection.size]);

  const loadMarketplaceProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles!products_seller_id_fkey (full_name)
        `)
        .or('is_active.eq.true,is_promotable.eq.true,status.eq.active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      const normalized = (data || []).filter((product: any) => {
        const active = product?.is_active === true;
        const promotable = product?.is_promotable === true;
        const status = String(product?.status || '').trim().toLowerCase();
        return active || promotable || status === 'active';
      });

      setMarketProducts(normalized);

      const uniqueCategories = Array.from(
        new Set(
          normalized
            .map(product => product.category)
            .filter((name): name is string => Boolean(name))
        )
      );
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('[SellerProductBrowser] Failed to load market products', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_product_order')
        .select('product_id, is_featured')
        .eq('seller_id', sellerId);

      if (error) throw error;
      const selected = new Set(data?.map(row => row.product_id) || []);
      const featured = new Set(
        data?.filter(row => row.is_featured)?.map(row => row.product_id) || []
      );

      setSelectedProductIds(selected);
      setFeaturedProducts(featured);
    } catch (err) {
      console.error('[SellerProductBrowser] Failed to load curated products', err);
    }
  };

  const handleAddProduct = async (product: Product) => {
    if (!sellerId) return;

    const rawStock = product.stock_quantity ?? product.total_inventory;
    const parsedStock = Number(rawStock);
    const hasKnownStock = rawStock !== null && rawStock !== undefined && Number.isFinite(parsedStock);
    const isCj =
      String(product.lineage || '').trim().toUpperCase() === 'CJ' ||
      String(product.dropship_provider || '').trim().toLowerCase() === 'cj';
    if (!isCj && hasKnownStock && parsedStock <= 0) {
      setActionMessage('Cannot add this product: inventory is 0 (out of stock).');
      return;
    }

    if (selectedProductIds.has(product.id)) {
      setActionMessage('Product already selected.');
      return;
    }

    try {
      setActionLoading(true);
      // Prefer the server endpoint (bypasses RLS/profile-id mismatches safely).
      await addSellerStoreProduct(product.id, { isFeatured: false });
      setSelectedProductIds(prev => new Set(prev).add(product.id));
      setActionMessage('Product added to your storefront selection.');
    } catch (err) {
      console.error('[SellerProductBrowser] Failed to add product', err);
      const msg = String(err?.message || '').trim();
      setActionMessage(msg ? `Unable to add product: ${msg}` : 'Unable to add that product. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveProduct = async (productId: string) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('seller_product_order')
        .delete()
        .eq('seller_id', sellerId)
        .eq('product_id', productId);

      if (error) throw error;
      setSelectedProductIds(prev => {
        const clone = new Set(prev);
        clone.delete(productId);
        return clone;
      });
      setFeaturedProducts(prev => {
        const clone = new Set(prev);
        clone.delete(productId);
        return clone;
      });
      setActionMessage('Product removed from your storefront selection.');
    } catch (err) {
      console.error('[SellerProductBrowser] Failed to remove product', err);
      setActionMessage('Could not remove that product.');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleBulkSelection = (productId: string) => {
    setBulkRemovalSelection((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleBulkAddSelection = (productId: string) => {
    setBulkAddSelection((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = (productIds: string[]) => {
    setBulkRemovalSelection((prev) => {
      const next = new Set(prev);
      const allSelected = productIds.every((id) => next.has(id));
      if (allSelected) {
        productIds.forEach((id) => next.delete(id));
      } else {
        productIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkRemove = async (productIds: string[]) => {
    if (!sellerId || productIds.length === 0) return;
    const confirmMessage = `Remove ${productIds.length} product${productIds.length === 1 ? '' : 's'} from your storefront?`;
    if (!confirm(confirmMessage)) return;

    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('seller_product_order')
        .delete()
        .eq('seller_id', sellerId)
        .in('product_id', productIds);
      if (error) throw error;

      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        productIds.forEach((id) => next.delete(id));
        return next;
      });
      setFeaturedProducts((prev) => {
        const next = new Set(prev);
        productIds.forEach((id) => next.delete(id));
        return next;
      });
      setBulkRemovalSelection(new Set());
      setActionMessage('Selected products removed from your storefront selection.');
    } catch (err) {
      console.error('[SellerProductBrowser] Failed to bulk remove products', err);
      setActionMessage('Could not remove the selected products.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkAdd = async (productIds: string[]) => {
    if (!sellerId || productIds.length === 0) return;
    setActionLoading(true);
    setActionMessage(null);

    let addedCount = 0;
    const failures: string[] = [];

    try {
      for (const productId of productIds) {
        const product = marketProducts.find((row) => row.id === productId);
        if (!product || selectedProductIds.has(productId)) continue;

        const rawStock = product.stock_quantity ?? product.total_inventory;
        const parsedStock = Number(rawStock);
        const hasKnownStock = rawStock !== null && rawStock !== undefined && Number.isFinite(parsedStock);
        const isCj =
          String(product.lineage || '').trim().toUpperCase() === 'CJ' ||
          String(product.dropship_provider || '').trim().toLowerCase() === 'cj';
        if (!isCj && hasKnownStock && parsedStock <= 0) {
          failures.push(product.title || 'Product');
          continue;
        }

        try {
          await addSellerStoreProduct(productId, { isFeatured: false });
          addedCount += 1;
        } catch (error: any) {
          failures.push(product.title || error?.message || 'Product');
        }
      }

      if (addedCount > 0) {
        await loadSelectedProducts();
      }

      setBulkAddSelection(new Set());
      if (addedCount > 0 && failures.length === 0) {
        setActionMessage(`${addedCount} product${addedCount === 1 ? '' : 's'} added to your storefront.`);
      } else if (addedCount > 0) {
        setActionMessage(`${addedCount} product${addedCount === 1 ? '' : 's'} added. ${failures.length} skipped.`);
      } else {
        setActionMessage('No products were added. Check stock or selection.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFeatured = async (productId: string) => {
    const currentlyFeatured = featuredProducts.has(productId);
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('seller_product_order')
        .update({ is_featured: !currentlyFeatured })
        .eq('seller_id', sellerId)
        .eq('product_id', productId);
      if (error) throw error;
      setFeaturedProducts(prev => {
        const clone = new Set(prev);
        if (currentlyFeatured) {
          clone.delete(productId);
        } else {
          clone.add(productId);
        }
        return clone;
      });
      setActionMessage(
        currentlyFeatured ? 'Product removed from featured.' : 'Product marked as featured.'
      );
    } catch (err) {
      console.error('[SellerProductBrowser] Failed to toggle featured', err);
      setActionMessage('Unable to update featured status.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return marketProducts.filter(product => {
      const matchesSearch =
        product.title?.toLowerCase().includes(search.toLowerCase()) ||
        product.description?.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        categoryFilter === 'all' ||
        product.category?.toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [marketProducts, search, categoryFilter]);

  const visibleStoreProductIds = filteredProducts
    .filter((product) => selectedProductIds.has(product.id))
    .map((product) => product.id);
  const visibleAddableProductIds = filteredProducts
    .filter((product) => !selectedProductIds.has(product.id))
    .filter((product) => {
      const rawStock = product.stock_quantity ?? product.total_inventory;
      const parsedStock = Number(rawStock);
      const hasKnownStock = rawStock !== null && rawStock !== undefined && Number.isFinite(parsedStock);
      const isCj =
        String(product.lineage || '').trim().toUpperCase() === 'CJ' ||
        String(product.dropship_provider || '').trim().toLowerCase() === 'cj';
      return isCj || !hasKnownStock || parsedStock > 0;
    })
    .map((product) => product.id);
  const allVisibleSelected =
    visibleStoreProductIds.length > 0 && visibleStoreProductIds.every((id) => bulkRemovalSelection.has(id));
  const allVisibleAddSelected =
    visibleAddableProductIds.length > 0 && visibleAddableProductIds.every((id) => bulkAddSelection.has(id));

  if (!sellerId) {
    return <div className="p-4 text-sm text-gray-600">Select a seller to manage products.</div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-amber-200 via-yellow-100 to-white rounded-2xl p-6 border border-amber-300">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <PackagePlus className="w-8 h-8 text-amber-600" />
            <div>
              <h3 className="text-xl font-bold text-gray-900">Marketplace Product Library</h3>
              <p className="text-gray-700">
                Add any marketplace product to your storefront. Customers will still check out
                through Beezio, and you’ll earn on every sale.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-800">
            <span className="px-3 py-1 bg-white rounded-full border border-amber-400">
              {selectedProductIds.size} selected
            </span>
            <span className="px-3 py-1 bg-white rounded-full border border-amber-400 flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              {featuredProducts.size} featured
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name or description"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div>
          <div className="relative">
            <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="all">All categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {actionMessage}
        </div>
      )}

      {visibleAddableProductIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-emerald-900">
            <input
              type="checkbox"
              checked={allVisibleAddSelected}
              onChange={() => {
                setBulkAddSelection((prev) => {
                  const next = new Set(prev);
                  const shouldClear = visibleAddableProductIds.every((id) => next.has(id));
                  if (shouldClear) {
                    visibleAddableProductIds.forEach((id) => next.delete(id));
                  } else {
                    visibleAddableProductIds.forEach((id) => next.add(id));
                  }
                  return next;
                });
              }}
              className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              Select visible products to add
              {bulkAddSelection.size > 0 ? ` (${bulkAddSelection.size} selected)` : ''}
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleBulkAdd(visibleAddableProductIds)}
              disabled={actionLoading || visibleAddableProductIds.length === 0}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              <PackagePlus className="w-4 h-4" />
              Add all visible
            </button>
            <button
              type="button"
              onClick={() => handleBulkAdd(Array.from(bulkAddSelection))}
              disabled={bulkAddSelection.size === 0 || actionLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <PackagePlus className="w-4 h-4" />
              Add selected
            </button>
          </div>
        </div>
      )}

      {visibleStoreProductIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <label className="flex items-center gap-2 text-amber-900">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() => toggleSelectAllVisible(visibleStoreProductIds)}
              className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
            />
            <span>
              Select all in store
              {bulkRemovalSelection.size > 0 ? ` (${bulkRemovalSelection.size} selected)` : ''}
            </span>
          </label>
          <button
            type="button"
            onClick={() => handleBulkRemove(Array.from(bulkRemovalSelection))}
            disabled={bulkRemovalSelection.size === 0 || actionLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" />
            Remove selected
          </button>
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
          No products match your search. Try broadening the filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProducts.map(product => {
            const inStore = selectedProductIds.has(product.id);
            const isFeatured = featuredProducts.has(product.id);
            const primaryImage = resolveProductImageFromList(product.images, product.id);
            const rawStock = product.stock_quantity ?? product.total_inventory;
            const parsedStock = Number(rawStock);
            const hasKnownStock = rawStock !== null && rawStock !== undefined && Number.isFinite(parsedStock);
            const stockQty = hasKnownStock ? Math.max(0, Math.floor(parsedStock)) : null;
            const isCj =
              String((product as any).lineage || '').trim().toUpperCase() === 'CJ' ||
              String((product as any).dropship_provider || '').trim().toLowerCase() === 'cj';
            const isOutOfStock = !isCj && hasKnownStock && Number(stockQty) <= 0;
            const inventoryLabel =
              isCj && (!hasKnownStock || Number(stockQty) <= 0)
                ? 'Live inventory checked at checkout'
                : stockQty === null
                ? 'Inventory unavailable'
                : stockQty <= 0
                ? 'Out of stock'
                : `${stockQty} in stock`;
            const inventoryClass =
              isCj && (!hasKnownStock || Number(stockQty) <= 0)
                ? 'text-amber-600'
                : stockQty === null
                ? 'text-gray-500'
                : stockQty <= 0
                ? 'text-red-600'
                : stockQty <= 5
                ? 'text-amber-600'
                : 'text-green-600';

            return (
              <div
                key={product.id}
                className="relative border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col md:flex-row gap-4"
              >
                {inStore && (
                  <label className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">
                    <input
                      type="checkbox"
                      checked={bulkRemovalSelection.has(product.id)}
                      onChange={() => toggleBulkSelection(product.id)}
                      className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                    Select
                  </label>
                )}
                {!inStore && (
                  <label className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-2 py-1 text-xs font-medium text-emerald-700 shadow-sm">
                    <input
                      type="checkbox"
                      checked={bulkAddSelection.has(product.id)}
                      onChange={() => toggleBulkAddSelection(product.id)}
                      className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Add
                  </label>
                )}
                <div className="w-full md:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  <img src={primaryImage} alt={product.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-lg font-semibold text-gray-900 line-clamp-2">{product.title}</h4>
                    <span className="text-sm font-bold text-amber-600">${product.price.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{sanitizeDescriptionForDisplay(product.description, (product as any).lineage)}</p>
                  <div className="text-xs text-gray-500">
                    Seller: {product.profiles?.full_name || 'Marketplace Seller'}
                  </div>
                  <div className={`text-xs font-semibold ${inventoryClass}`}>{inventoryLabel}</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!inStore ? (
                      <button
                        onClick={() => handleAddProduct(product)}
                        disabled={actionLoading || isOutOfStock}
                        className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-full hover:bg-amber-700 transition disabled:opacity-50"
                      >
                        <PackagePlus className="w-4 h-4" />
                        {isOutOfStock ? 'Out of Stock' : 'Add to Store'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRemoveProduct(product.id)}
                          disabled={actionLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-full hover:bg-red-50 transition disabled:opacity-40"
                        >
                          <XCircle className="w-4 h-4" />
                          Remove
                        </button>
                        <button
                          onClick={() => handleToggleFeatured(product.id)}
                          disabled={actionLoading}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-full transition ${
                            isFeatured
                              ? 'border-yellow-300 text-yellow-600 bg-yellow-50'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${isFeatured ? 'fill-current' : ''}`} />
                          {isFeatured ? 'Featured' : 'Feature'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedProductIds.size > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex flex-col gap-2">
          <div className="font-semibold">Next steps</div>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="w-4 h-4" />
              Reorder and fine-tune featured products under the “Product Order” tab.
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="w-4 h-4" />
              Use your seller store link to promote this curated catalog immediately.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductBrowserForSellers;
