import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
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
    if (!actionMessage) return;
    const timeout = setTimeout(() => setActionMessage(null), 3500);
    return () => clearTimeout(timeout);
  }, [actionMessage]);

  const loadMarketplaceProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles!products_seller_id_fkey (full_name)
        `)
        .eq('is_active', true)
        .eq('is_promotable', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMarketProducts(data || []);

      const uniqueCategories = Array.from(
        new Set(
          (data || [])
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
    if (selectedProductIds.has(product.id)) {
      setActionMessage('Product already selected.');
      return;
    }

    try {
      setActionLoading(true);
      const displayOrder = selectedProductIds.size;
      const { error } = await supabase.from('seller_product_order').insert({
        seller_id: sellerId,
        product_id: product.id,
        display_order: displayOrder,
        is_featured: false
      });
      if (error) throw error;
      setSelectedProductIds(prev => new Set(prev).add(product.id));
      setActionMessage('Product added to your storefront selection.');
    } catch (err) {
      console.error('[SellerProductBrowser] Failed to add product', err);
      setActionMessage('Unable to add that product. Please try again.');
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

      {filteredProducts.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
          No products match your search. Try broadening the filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProducts.map(product => {
            const inStore = selectedProductIds.has(product.id);
            const isFeatured = featuredProducts.has(product.id);
            const primaryImage = product.images?.[0];

            return (
              <div
                key={product.id}
                className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm flex flex-col md:flex-row gap-4"
              >
                <div className="w-full md:w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {primaryImage ? (
                    <img src={primaryImage} alt={product.title} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10 text-gray-400" />
                  )}
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
                  <div className="flex flex-wrap gap-2 mt-2">
                    {!inStore ? (
                      <button
                        onClick={() => handleAddProduct(product)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-full hover:bg-amber-700 transition disabled:opacity-50"
                      >
                        <PackagePlus className="w-4 h-4" />
                        Add to Store
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
