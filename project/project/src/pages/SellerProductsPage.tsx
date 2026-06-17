import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Package, Plus, Eye, DollarSign, TrendingUp, Search, Image as ImageIcon, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import ProductForm from '../components/ProductForm'; // Import the ProductForm component
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { ensureSellerProductInOrder } from '../utils/sellerProductOrder';
import { normalizeProductImages } from '../utils/imageHelpers';
import { archiveProductById } from '../utils/archiveProduct';
import { fetchAccountOwnedProducts } from '../utils/accountOwnedProducts';
import { getProductReferenceLine } from '../utils/productIdentifiers';
import { formatMoneyDisplay } from '../utils/moneyDisplay';

// Define Product interface
interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images?: string[];
  category: string;
  affiliate_commission_rate: number;
  affiliate_commission_type: 'percentage' | 'fixed';
  sales_count: number;
  is_active: boolean;
  created_at: string;
  unique_slug?: string;
  seller_id?: string;
  stock_quantity?: number | null;
  total_inventory?: number | null;
}

interface ProductDraftState {
  price: string;
  stock_quantity: string;
}

const SellerProductsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draftValues, setDraftValues] = useState<Record<string, ProductDraftState>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, string>>({});
  const ownerIds = Array.from(
    new Set([profile?.id, (profile as any)?.user_id, user?.id].map((value) => String(value || '').trim()).filter(Boolean))
  );

  useEffect(() => {
    if (user && profile) {
      fetchProducts();
    }
  }, [user, profile]);

  const buildDraftState = (product: Product): ProductDraftState => ({
    price: Number.isFinite(Number(product.price)) ? Number(product.price).toFixed(2) : '0.00',
    stock_quantity: String(
      Number.isFinite(Number(product.stock_quantity ?? product.total_inventory))
        ? Math.max(0, Math.floor(Number(product.stock_quantity ?? product.total_inventory)))
        : 0
    ),
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let ownedProducts: any[] = [];
      let effectiveOwnerIds = ownerIds;
      const mergeProducts = (...groups: any[][]) =>
        Array.from(
          new Map(
            groups
              .flat()
              .filter((product: any) => Boolean(product) && String(product?.status || '').trim().toLowerCase() !== 'archived')
              .map((product: any) => [String(product?.id || '').trim(), product])
          ).values()
        ).sort((a: any, b: any) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')));

      try {
        const owned = await fetchAccountOwnedProducts();
        ownedProducts = owned.products;
        if (owned.ownerIds.length > 0) {
          effectiveOwnerIds = Array.from(new Set([...effectiveOwnerIds, ...owned.ownerIds].map((value) => String(value || '').trim()).filter(Boolean)));
        }
      } catch (ownedError) {
        console.warn('[SellerProductsPage] account-owned-products lookup failed, falling back to direct query:', ownedError);
      }

      const { data: directOwnedProducts, error: directOwnedError } = await supabase
        .from('products')
        .select('*')
        .in('seller_id', effectiveOwnerIds)
        .neq('status', 'archived');
      if (directOwnedError) throw directOwnedError;

      const { data: dropshippedProducts } = await supabase
        .from('products')
        .select('*')
        .eq('is_dropshipped', true)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      const mergedProducts = mergeProducts(
        ownedProducts,
        (directOwnedProducts as any[]) || [],
        (dropshippedProducts as any[]) || []
      );

      if (mergedProducts.length > 0) {
        setProducts(mergedProducts);
        setDraftValues(
          mergedProducts.reduce<Record<string, ProductDraftState>>((acc, product) => {
            acc[String(product.id)] = buildDraftState(product as Product);
            return acc;
          }, {})
        );
        return;
      }

      // Fetch both seller's own products and CJ/global products
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or(effectiveOwnerIds.map((id) => `seller_id.eq.${id}`).concat('is_dropshipped.eq.true').join(','))
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
      setDraftValues(
        ((data || []) as Product[]).reduce<Record<string, ProductDraftState>>((acc, product) => {
          acc[String(product.id)] = buildDraftState(product);
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const normalizePriceInput = (value: string) => value.replace(/[^\d.]/g, '');

  const normalizeStockInput = (value: string) => value.replace(/[^\d]/g, '');

  const getDraftForProduct = (product: Product): ProductDraftState =>
    draftValues[product.id] || buildDraftState(product);

  const getNormalizedRowValues = (product: Product) => {
    const draft = getDraftForProduct(product);
    const nextPrice = Number.parseFloat(draft.price);
    const nextStock = Number.parseInt(draft.stock_quantity, 10);
    const normalizedPrice = Number.isFinite(nextPrice) ? Math.max(0, Math.round((nextPrice + Number.EPSILON) * 100) / 100) : 0;
    const normalizedStock = Number.isFinite(nextStock) ? Math.max(0, Math.floor(nextStock)) : 0;
    const currentPrice = Number.isFinite(Number(product.price)) ? Math.max(0, Number(product.price)) : 0;
    const currentStockSource = product.stock_quantity ?? product.total_inventory;
    const currentStock = Number.isFinite(Number(currentStockSource)) ? Math.max(0, Math.floor(Number(currentStockSource))) : 0;

    return {
      normalizedPrice,
      normalizedStock,
      currentPrice,
      currentStock,
      changed:
        Math.abs(normalizedPrice - currentPrice) > 0.0001 ||
        normalizedStock !== currentStock,
    };
  };

  const handleInlineFieldChange = (productId: string, field: keyof ProductDraftState, value: string) => {
    setDraftValues((prev) => {
      const current = prev[productId];
      return {
        ...prev,
        [productId]: {
          price: current?.price ?? '0.00',
          stock_quantity: current?.stock_quantity ?? '0',
          [field]: field === 'price' ? normalizePriceInput(value) : normalizeStockInput(value),
        },
      };
    });
    setRowFeedback((prev) => {
      if (!prev[productId]) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleInlineSave = async (product: Product) => {
    const sellerId = String((product as any)?.seller_id || profile?.id || '').trim();
    if (!sellerId) return;

    const { normalizedPrice, normalizedStock, changed } = getNormalizedRowValues(product);
    if (!changed) {
      setRowFeedback((prev) => ({ ...prev, [product.id]: 'No changes to save.' }));
      return;
    }

    try {
      setSavingRowId(product.id);
      const { error } = await supabase
        .from('products')
        .update({
          price: normalizedPrice,
          stock_quantity: normalizedStock,
          total_inventory: normalizedStock,
        })
        .eq('id', product.id)
        .eq('seller_id', sellerId);

      if (error) throw error;

      setProducts((prev) =>
        prev.map((entry) =>
          entry.id === product.id
            ? { ...entry, price: normalizedPrice, stock_quantity: normalizedStock, total_inventory: normalizedStock }
            : entry
        )
      );
      setDraftValues((prev) => ({
        ...prev,
        [product.id]: {
          price: normalizedPrice.toFixed(2),
          stock_quantity: String(normalizedStock),
        },
      }));
      setRowFeedback((prev) => ({ ...prev, [product.id]: 'Saved.' }));
    } catch (error) {
      console.error('Error saving inline product changes:', error);
      setRowFeedback((prev) => ({ ...prev, [product.id]: 'Save failed.' }));
    } finally {
      setSavingRowId(null);
    }
  };

  const toggleListing = async (product: Product) => {
    try {
      const isListed = product.is_active !== false;
      const nextIsActive = !isListed;
      if (!nextIsActive && !confirm('Unlist this product from the marketplace?')) return;

      const nextStatus = nextIsActive ? 'active' : 'archived';
      const { error } = await supabase
        .from('products')
        .update({ is_active: nextIsActive, is_promotable: nextIsActive, status: nextStatus })
        .eq('id', product.id)
        .eq('seller_id', profile?.id);

      if (error) throw error;

      setProducts((prev) => prev.map((p) => (
        p.id === product.id
          ? { ...p, is_active: nextIsActive, ...( { is_promotable: nextIsActive, status: nextStatus } as any) }
          : p
      )));
    } catch (error) {
      console.error('Error updating listing:', error);
      // Replace with a notification system
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmMessage = `Remove "${product.title}" from your active seller dashboard and marketplace listings? Promoter links and payout history will be kept.`;
    if (!confirm(confirmMessage)) return;

    try {
      await archiveProductById({ productId: product.id, sellerId: String((product as any)?.seller_id || profile?.id || '').trim() || undefined });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
    } catch (error) {
      console.error('Error removing product:', error);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch =
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.is_active) ||
        (statusFilter === 'inactive' && !product.is_active);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, categoryFilter, statusFilter]);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);

  const handleFormSubmit = async (product: Product) => {
    try {
      const sellerId = profile?.id || null;
      const affiliateEnabled = Boolean((product as any)?.affiliate_enabled ?? true);

      const payload: any = {
        ...product,
        seller_id: sellerId,
        affiliate_enabled: affiliateEnabled,
        status: affiliateEnabled ? 'active' : 'store_only',
        is_promotable: affiliateEnabled,
        is_active: (product as any)?.is_active ?? true,
        total_inventory: Number.isFinite((product as any)?.stock_quantity)
          ? (product as any).stock_quantity
          : (product as any)?.total_inventory ?? null,
      };

      const res = editingProduct
        ? await supabase.from('products').update(payload).eq('id', editingProduct.id).select('id').single()
        : await supabase.from('products').insert(payload).select('id').single();

      if (res.error) throw res.error;

      if (!editingProduct) {
        await ensureSellerProductInOrder({ sellerId, productId: (res.data as any)?.id });
      } else {
        await ensureSellerProductInOrder({ sellerId, productId: editingProduct.id });
      }
      fetchProducts();
      setShowForm(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading your products...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Products</h1>
              <p className="text-gray-600 mt-2">Manage your product catalog</p>
            </div>
            <Link
              to="/seller/products/new"
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Add New Product</span>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Package className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Eye className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Products</p>
                <p className="text-2xl font-bold text-gray-900">{products.filter(p => p.is_active).length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">{products.reduce((sum, p) => sum + p.sales_count, 0)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Commission</p>
                <p className="text-2xl font-bold text-gray-900">
                  {products.length > 0
                    ? Math.round(products.reduce((sum, p) => sum + p.affiliate_commission_rate, 0) / products.length)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products List */}
        <div className="bg-white rounded-lg shadow-sm border">
          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first product'}
              </p>
              <Link
                to="/seller/products/new"
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 font-medium inline-flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Add Your First Product</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => {
                    const imageUrl = normalizeProductImages(product.images)[0];
                    const productReferenceLine = getProductReferenceLine(product);
                    const draft = getDraftForProduct(product);
                    const rowState = getNormalizedRowValues(product);
                    return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-12 w-12">
                            {imageUrl ? (
                              <img
                                className="h-12 w-12 rounded-lg object-cover"
                                src={imageUrl}
                                alt={product.title}
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-gray-200 flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{product.title}</div>
                            {productReferenceLine && (
                              <div className="text-xs font-medium text-amber-700">{productReferenceLine}</div>
                            )}
                            <div className="text-sm text-gray-500 truncate max-w-xs">{sanitizeDescriptionForDisplay(product.description, (product as any).lineage)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="space-y-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={draft.price}
                            onChange={(e) => handleInlineFieldChange(product.id, 'price', e.target.value)}
                            className="w-28 rounded-md border border-gray-300 px-2 py-1 text-sm"
                            aria-label={`Price for ${product.title}`}
                          />
                          <div className="text-xs text-gray-500">Current: {formatMoneyDisplay(product.price)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="space-y-1">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draft.stock_quantity}
                            onChange={(e) => handleInlineFieldChange(product.id, 'stock_quantity', e.target.value)}
                            className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                            aria-label={`Stock quantity for ${product.title}`}
                          />
                          <div className="text-xs text-gray-500">
                            Current: {Number.isFinite(Number(product.stock_quantity ?? product.total_inventory))
                              ? Math.max(0, Math.floor(Number(product.stock_quantity ?? product.total_inventory)))
                              : 0}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.affiliate_commission_type === 'percentage'
                          ? `${product.affiliate_commission_rate}%`
                          : `$${product.affiliate_commission_rate}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.sales_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          product.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleInlineSave(product)}
                          disabled={!rowState.changed || savingRowId === product.id}
                          className={`inline-flex items-center space-x-1 rounded px-2 py-1 text-xs ${
                            rowState.changed
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>{savingRowId === product.id ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 hover:text-blue-900 hover:bg-blue-50 text-xs px-2 py-1 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleListing(product)}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50 text-xs px-2 py-1 rounded"
                        >
                          {product.is_active ? 'Unlist' : 'Relist'}
                        </button>
                        <button
                          onClick={() => handleDelete(product)}
                          className="text-red-700 hover:text-red-900 hover:bg-red-100 text-xs px-2 py-1 rounded"
                        >
                          Remove
                        </button>
                        {rowFeedback[product.id] && (
                          <div className={`pt-1 text-xs ${rowFeedback[product.id] === 'Saved.' ? 'text-emerald-600' : 'text-amber-700'}`}>
                            {rowFeedback[product.id]}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Product Form */}
        {showForm && (
          <ProductForm
            product={editingProduct || undefined}
            onSubmit={handleFormSubmit}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </div>
  );
};

export default SellerProductsPage;
