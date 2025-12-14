import React, { useState, useEffect } from 'react';
import { Search, Plus, DollarSign, Package, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { 
  getCJProducts, 
  getCJProductDetail, 
  getCJCategories,
  calculateBeezioPrice,
  mapCJCategoryToBeezio 
} from '../services/cjDropshipping';

interface CJProduct {
  pid: string;
  productNameEn: string;
  productSku: string;
  productImage: string;
  categoryName: string;
  sellPrice: number;
}

const CJProductImportPage: React.FC = () => {
  const { user, profile, hasRole } = useAuth();
  const [cjProducts, setCjProducts] = useState<CJProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Pricing settings for each product
  const [pricingSettings, setPricingSettings] = useState<Record<string, { markup: number; affiliateCommission: number }>>({});

  // Admin-only: allow any admin role; keep email fallback for legacy accounts.
  const isAuthorized = Boolean(
    user && (
      hasRole('admin') ||
      profile?.role === 'admin' ||
      profile?.primary_role === 'admin' ||
      user.email === 'jason@beezio.co' ||
      user.email === 'jasonlovingsr@gmail.com'
    )
  );

  const resolveSellerProfileId = async (): Promise<string> => {
    if (profile?.id) return profile.id;
    if (!user?.id) throw new Error('You must be signed in to import products');

    // Prefer the canonical model used across the app:
    // - profiles.id == auth.users.id
    // - profiles.user_id == auth.users.id
    // Some legacy accounts may be missing the profiles row entirely; attempt to create it.
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .or(`user_id.eq.${user.id},id.eq.${user.id}`)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;

    // Create a minimal profile (best-effort) so downstream inserts that FK to profiles.id can succeed.
    const email = user.email || '';
    const defaultRole = (email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com') ? 'admin' : 'buyer';

    const { data: created, error: createError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          user_id: user.id,
          email: user.email ?? null,
          full_name: (user.user_metadata as any)?.full_name ?? (user.user_metadata as any)?.name ?? null,
          role: defaultRole,
          primary_role: defaultRole,
        },
        { onConflict: 'id' }
      )
      .select('id')
      .maybeSingle();

    if (createError) {
      console.error('Failed to auto-create profile for CJ import:', createError);
      throw new Error(
        `Could not find/create your profile (profiles.id). Please sign out/in, complete profile setup, then retry. Details: ${createError.message}`
      );
    }

    if (created?.id) return created.id;
    // As a last resort, return auth uid (matches profiles.id convention), but note FK may still fail.
    return user.id;
  };

  const resolveCategoryId = async (categoryName: string): Promise<string | null> => {
    const normalized = (categoryName || '').trim();
    if (!normalized) return null;

    try {
      const { data: exact } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', normalized)
        .limit(1)
        .maybeSingle();

      if ((exact as any)?.id) return (exact as any).id as string;

      const { data: other } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', 'Other')
        .limit(1)
        .maybeSingle();

      return (other as any)?.id ?? null;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    if (user && isAuthorized) {
      console.log('🔵 CJ Import: Loading data for', user.email);
      loadCategories();
      loadProducts();
    }
  }, [currentPage, selectedCategory, isAuthorized, user]);

  const loadCategories = async () => {
    try {
      console.log('🔵 CJ Import: Fetching categories...');
      const cats = await getCJCategories();
      console.log('🔵 CJ Import: Got categories:', cats);
      setCategories(cats);
    } catch (error) {
      console.error('❌ CJ Import: Failed to load categories:', error);
      setError(`Failed to load categories: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔵 CJ Import: Fetching products - page:', currentPage, 'category:', selectedCategory);
      const { products, total } = await getCJProducts(currentPage, 50, selectedCategory);
      console.log('🔵 CJ Import: Got products:', products?.length, 'total:', total);
      setCjProducts(products);
      setTotalProducts(total);

      // Initialize default pricing for each product
      const defaultPricing: Record<string, { markup: number; affiliateCommission: number }> = {};
      products.forEach(product => {
        defaultPricing[product.pid] = {
          markup: 115, // 115% markup by default
          affiliateCommission: 30, // 30% affiliate commission
        };
      });
      setPricingSettings(defaultPricing);
    } catch (error) {
      console.error('❌ CJ Import: Failed to load products:', error);
      setError(`Failed to load products: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setCjProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  };

  const testCJAPI = async () => {
    setDebugInfo('Testing CJ API...');
    try {
      // Test the proxy directly
      const response = await fetch('/.netlify/functions/cj-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'product/listV2',
          body: { page: 1, size: 10 },
          method: 'GET'
        })
      });
      
      const data = await response.json();
      setDebugInfo(JSON.stringify(data, null, 2));
      console.log('🔍 CJ API Test Response:', data);
    } catch (error) {
      setDebugInfo(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('🔍 CJ API Test Error:', error);
    }
  };

  const updatePricing = (pid: string, field: 'markup' | 'affiliateCommission', value: number) => {
    setPricingSettings(prev => ({
      ...prev,
      [pid]: {
        ...prev[pid],
        [field]: value,
      },
    }));
  };

  const markImporting = (pid: string, isImporting: boolean) => {
    setImporting(prev => {
      const next = new Set(prev);
      if (isImporting) next.add(pid);
      else next.delete(pid);
      return next;
    });
  };

  const importProduct = async (cjProduct: CJProduct) => {
    // Allow importing multiple products in parallel without race conditions.
    markImporting(cjProduct.pid, true);
    try {
      console.log('🟣 CJ Import: Starting import for pid', cjProduct.pid);
      // Get detailed product info (best-effort). CJ can be heavily rate-limited.
      let detailedProduct: any = null;
      try {
        detailedProduct = await getCJProductDetail(cjProduct.pid);
      } catch (e) {
        console.warn('CJ detail fetch failed; importing with list data only', e);
      }

      // Get pricing settings
      const pricing = pricingSettings[cjProduct.pid] || { markup: 100, affiliateCommission: 20 };
      const priceBreakdown = calculateBeezioPrice(
        cjProduct.sellPrice,
        pricing.markup,
        pricing.affiliateCommission
      );

      // Map CJ category to Beezio category
      const beezioCategory = mapCJCategoryToBeezio(cjProduct.categoryName);
      const categoryId = await resolveCategoryId(beezioCategory);

      const sellerProfileId = await resolveSellerProfileId();

      // Prefer server-side import to bypass RLS/permission issues.
      try {
        const { data: serverData, error: serverError } = await supabase.functions.invoke('import-cj-product', {
          body: {
            cjProduct,
            detailedProduct,
            pricing,
            beezioCategory,
            categoryId,
            computed: {
              finalPrice: priceBreakdown.finalPrice,
              sellerAsk: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
            },
          },
        });

        if (serverError) {
          const message = (serverError as any)?.message || String(serverError);
          const isMissingFunction = /not found|404/i.test(message);
          console.warn('🟠 CJ Import: import-cj-product failed', serverError);
          if (!isMissingFunction) {
            throw new Error(`Server import failed: ${message}`);
          }
          // Local/dev fallback when function isn't deployed.
          console.warn('🟠 CJ Import: import-cj-product not deployed, falling back to client insert');
        } else if (serverData?.product?.id) {
          alert(`✅ Product "${cjProduct.productNameEn}" imported successfully!`);
          setCjProducts(prev => prev.filter(p => p.pid !== cjProduct.pid));
          return;
        } else {
          throw new Error('Server import returned no product id');
        }
      } catch (e) {
        console.error('🛑 CJ Import: server import failed:', e);
        throw e;
      }

      // Create product in Beezio database
      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          seller_id: sellerProfileId,
          title: cjProduct.productNameEn,
          description: detailedProduct?.description || `${cjProduct.productNameEn} - Imported from CJ Dropshipping. Earn ${pricing.affiliateCommission}% commission!`,
          // Store a seller ask so checkout/pricing engine can work off a stable base.
          // For CJ, the "seller" is the Beezio store account and this ask should cover CJ cost + desired profit.
          seller_ask: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
          seller_amount: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
          seller_ask_price: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
          // Keep the stored listing price for compatibility with existing UI.
          price: priceBreakdown.finalPrice,
          category: beezioCategory,
          category_id: categoryId,
          image_url: cjProduct.productImage,
          images: detailedProduct?.productImageList || [cjProduct.productImage],
          sku: cjProduct.productSku,
          stock_quantity: 9999, // CJ handles inventory
          is_digital: false,
          requires_shipping: true,
          shipping_cost: 0, // Free shipping (included in price)
          // Commission fields used across the app
          affiliate_enabled: true,
          commission_rate: pricing.affiliateCommission,
          commission_type: 'percentage',
          flat_commission_amount: 0,
          affiliate_commission_rate: pricing.affiliateCommission, // legacy/compat
          product_type: 'one_time',
          dropship_provider: 'cj',
          // Explicitly tag imported CJ items so fulfillment can branch by lineage
          lineage: 'CJ',
          is_promotable: true, // CRITICAL: Shows in marketplace for affiliates/fundraisers
          is_active: true, // Active and visible
        })
        .select()
        .single();

      if (productError) {
        console.error('CJ Import: product insert failed:', productError);
        throw new Error(`Product insert failed: ${productError.message} (code: ${productError.code || 'n/a'})`);
      }

      // Store CJ product mapping
      const { error: mappingError } = await supabase
        .from('cj_product_mappings')
        .insert({
          beezio_product_id: newProduct.id,
          cj_product_id: cjProduct.pid,
          cj_product_sku: cjProduct.productSku,
          cj_cost: cjProduct.sellPrice,
          markup_percent: pricing.markup,
          affiliate_commission_percent: pricing.affiliateCommission,
          price_breakdown: priceBreakdown,
          last_synced: new Date().toISOString(),
        });

      if (mappingError) {
        console.error('Failed to create CJ mapping:', mappingError);
      }

      alert(`✅ Product "${cjProduct.productNameEn}" imported successfully!`);

      // Remove from list
      setCjProducts(prev => prev.filter(p => p.pid !== cjProduct.pid));
    } catch (error: any) {
      console.error('Import failed:', error);
      alert(`❌ Import failed: ${error.message}`);
    } finally {
      markImporting(cjProduct.pid, false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            CJ Dropshipping product import is currently only available to the official Beezio store account.
          </p>
        </div>
      </div>
    );
  }

  const filteredProducts = cjProducts.filter(product =>
    product.productNameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.productSku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#101820] text-white py-6">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-2">CJ Dropshipping Import</h1>
          <p className="text-gray-300">Browse and import products from CJ Dropshipping catalog</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={loadProducts}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#101820] text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          
          {/* Debug Test Button */}
          <div className="mt-4 flex gap-4">
            <button
              onClick={testCJAPI}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              🔍 Test CJ API
            </button>
            {debugInfo && (
              <div className="flex-1">
                <pre className="text-xs bg-gray-100 p-3 rounded max-h-40 overflow-auto">
                  {debugInfo}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Error Loading CJ Products</h3>
                <p className="text-red-700 text-sm">{error}</p>
                <button
                  onClick={loadProducts}
                  className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Product Grid */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 animate-spin text-[#ffcb05] mx-auto mb-4" />
            <p className="text-gray-600">Loading products from CJ...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Products Found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'Try adjusting your search or filters' : 'Click Refresh to load products from CJ Dropshipping'}
            </p>
            <button
              onClick={loadProducts}
              className="inline-flex items-center gap-2 px-6 py-2 bg-[#101820] text-white rounded-lg hover:bg-gray-800"
            >
              <RefreshCw className="w-5 h-5" />
              Load Products
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {filteredProducts.map(product => {
                const pricing = pricingSettings[product.pid] || { markup: 100, affiliateCommission: 20 };
                const priceBreakdown = calculateBeezioPrice(product.sellPrice, pricing.markup, pricing.affiliateCommission);

                return (
                  <div key={product.pid} className="bg-white rounded-lg shadow-sm overflow-hidden">
                    {/* Product Image */}
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={product.productImage}
                        alt={product.productNameEn}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                        {product.productNameEn}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">SKU: {product.productSku}</p>
                      <p className="text-xs text-gray-500 mb-4">{product.categoryName}</p>

                      {/* Pricing Controls */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">CJ Cost:</span>
                          <span className="font-semibold">${product.sellPrice.toFixed(2)}</span>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Your Markup (%)</label>
                          <input
                            type="number"
                            value={pricing.markup}
                            onChange={(e) => updatePricing(product.pid, 'markup', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
                            min="0"
                            step="10"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Affiliate Commission (%)</label>
                          <input
                            type="number"
                            value={pricing.affiliateCommission}
                            onChange={(e) => updatePricing(product.pid, 'affiliateCommission', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
                            min="0"
                            max="100"
                            step="5"
                          />
                        </div>

                        {/* Price Breakdown */}
                        <div className="bg-gray-50 rounded p-3 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Your Profit:</span>
                            <span className="font-medium text-green-600">${priceBreakdown.yourProfit.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Affiliate Commission:</span>
                            <span className="font-medium">${priceBreakdown.affiliateCommission.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Recruiter Bonus (5%):</span>
                            <span className="font-medium text-purple-600">${priceBreakdown.recruiterCommission.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Beezio Fee (10%):</span>
                            <span className="font-medium">${priceBreakdown.beezioFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Stripe Fee:</span>
                            <span className="font-medium">${priceBreakdown.stripeFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                            <span className="font-semibold text-gray-900">Customer Pays:</span>
                            <span className="font-bold text-[#101820]">${priceBreakdown.finalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Import Button */}
                      <button
                        onClick={() => importProduct(product)}
                        disabled={importing.has(product.pid)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#ffcb05] text-[#101820] font-semibold rounded-lg hover:bg-[#e0b000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {importing.has(product.pid) ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Import to Store
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalProducts > 50 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 bg-white border border-gray-300 rounded-lg">
                  Page {currentPage} of {Math.ceil(totalProducts / 50)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= Math.ceil(totalProducts / 50)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CJProductImportPage;
