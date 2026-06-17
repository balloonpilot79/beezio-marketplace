import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Star, 
  DollarSign, 
  TrendingUp, 
  Copy, 
  Check, 
  Plus, 
  Minus,
  Search,
  Filter,
  ExternalLink
} from 'lucide-react';
import { products } from '../data/sampleProducts';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useAffiliate } from '../contexts/AffiliateContext';
import { supabase } from '../lib/supabase';
import { resolveSamplePrice } from '../utils/samplePricing';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';

const UUID_LIKE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_IMAGE_FALLBACK = 'https://placehold.co/400x300?text=No+Image';

const normalizeCategoryLabel = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Other';
  if (UUID_LIKE_PATTERN.test(raw)) return 'Other';
  if (raw.includes('_') || raw.includes('-')) {
    return raw
      .split(/[_-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return raw;
};

const normalizeCommissionType = (product: any): 'percentage' | 'flat_rate' => {
  const raw = String(
    product?.commission_type ||
    product?.affiliate_commission_type ||
    ''
  ).trim().toLowerCase();

  return raw === 'flat_rate' || raw === 'fixed' ? 'flat_rate' : 'percentage';
};

const getCommissionValue = (product: any): number => {
  const commissionType = normalizeCommissionType(product);

  if (commissionType === 'flat_rate') {
    return Number(
      product?.flat_commission_amount ??
      product?.affiliate_commission_value ??
      product?.commission_rate ??
      0
    ) || 0;
  }

  return Number(
    product?.commission_rate ??
    product?.affiliate_commission_rate ??
    0
  ) || 0;
};

const formatCommissionLabel = (product: any) => {
  const commissionType = normalizeCommissionType(product);
  const commissionValue = getCommissionValue(product);

  return commissionType === 'percentage'
    ? `${commissionValue}% Commission`
    : `$${commissionValue.toFixed(2)} Commission`;
};

const calculateCommissionEarnings = (product: any, quantity: number = 1) => {
  const commissionType = normalizeCommissionType(product);
  const commissionValue = getCommissionValue(product);
  const price = Number(product?.price || 0);

  if (commissionType === 'flat_rate') {
    return (commissionValue * quantity).toFixed(2);
  }

  return (price * (commissionValue / 100) * quantity).toFixed(2);
};

const AffiliateProductsPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { 
    selectedProducts, 
    generateAffiliateLink, 
    addProduct, 
    removeProduct, 
    isProductSelected 
  } = useAffiliate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('commission');
  const [copiedLinks, setCopiedLinks] = useState<Set<string>>(new Set());
  const [realProducts, setRealProducts] = useState<any[]>([]);
  const [productVariants, setProductVariants] = useState<Record<string, any[]>>({});
  const [dbSelectedProductIds, setDbSelectedProductIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [resolvedAffiliateId, setResolvedAffiliateId] = useState<string>('');

  useEffect(() => {
    let alive = true;
    if (!user?.id) {
      setResolvedAffiliateId('');
      return () => {
        alive = false;
      };
    }

    void (async () => {
      const resolved = await resolveProfileIdForUser(user.id);
      if (alive) {
        setResolvedAffiliateId(String(resolved || profile?.id || user.id).trim());
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id, profile?.id]);

  useEffect(() => {
    fetchRealProducts();
    void loadDbSelectedProducts();

    const onAffiliateProductsChanged = () => {
      void loadDbSelectedProducts();
    };
    window.addEventListener('affiliate-products-changed', onAffiliateProductsChanged as EventListener);
    return () => {
      window.removeEventListener('affiliate-products-changed', onAffiliateProductsChanged as EventListener);
    };
  }, [user?.id, profile?.id, resolvedAffiliateId]);

  const loadDbSelectedProducts = async () => {
    const candidateIds = Array.from(
      new Set(
        [resolvedAffiliateId, String((profile as any)?.id || '').trim(), String((profile as any)?.user_id || '').trim(), String(user?.id || '').trim()]
          .filter(Boolean)
      )
    );
    if (!candidateIds.length) {
      setDbSelectedProductIds(new Set());
      return;
    }

    try {
      const { data, error } = await supabase
        .from('affiliate_products')
        .select('product_id,affiliate_id')
        .in('affiliate_id', candidateIds);
      if (error) {
        console.warn('Could not load affiliate selections from DB:', error.message);
        return;
      }
      const ids = new Set<string>((data || []).map((row: any) => String(row?.product_id || '').trim()).filter(Boolean));
      setDbSelectedProductIds(ids);
    } catch (e) {
      console.warn('Could not load affiliate selections from DB:', e);
    }
  };

  const fetchRealProducts = async () => {
    try {
      setLoading(true);
      let data: any[] = [];
      try {
        const resp = await fetch('/api/public/marketplace/products?limit=200');
        if (resp.ok) {
          const payload: any = await resp.json().catch(() => ({}));
          if (Array.isArray(payload?.products)) {
            data = payload.products;
          }
        }
      } catch (e) {
        console.warn('Marketplace API fetch failed, falling back to client query:', e);
      }

      if (!Array.isArray(data) || data.length === 0) {
        const { data: fallbackData, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (error) {
          console.warn('Error fetching real products, using sample data:', error);
          setRealProducts(products.map(product => ({
            ...product,
            commission_rate: 20 // Default commission rate
          })));
          setLoading(false);
          return;
        }
        data = fallbackData || [];
      }

      // Fetch variants for all products
      const productIds = (data || []).map(p => p.id);
      let variantsByProduct: Record<string, any[]> = {};
      if (productIds.length) {
        const { data: variantsData, error: variantsError } = await supabase
          .from('product_variants')
          .select('*')
          .in('product_id', productIds);
        if (!variantsError && variantsData) {
          variantsByProduct = productIds.reduce((acc, pid) => {
            acc[pid] = variantsData.filter(v => v.product_id === pid);
            return acc;
          }, {});
        }
      }
      setProductVariants(variantsByProduct);

      // Transform real products to match sample product format
      const transformedProducts = (data || []).map(product => {
        const lineage = String(product.lineage || '').toUpperCase();
        const sampleEligible = lineage === 'CJ' || lineage === 'BEEZIO_HOUSE';
        const sampleEnabled = sampleEligible && (product as any).sample_enabled !== false;
        const samplePrice = resolveSamplePrice({
          sample_enabled: sampleEnabled,
          sample_price: product.sample_price,
          base_cost: (product as any).cj_cost ?? (product as any).base_cost ?? (product as any).seller_amount ?? (product as any).seller_ask ?? product.price,
        });

        return {
          id: product.id,
          name: product.title || 'Untitled Product',
          price: getBuyerFacingProductPrice(product),
          image: product.images && product.images.length > 0 ? product.images[0] : PRODUCT_IMAGE_FALLBACK,
          rating: 0, // Prelaunch: no social proof until real reviews exist
          category: normalizeCategoryLabel(product.category_name || product.category || product.category_id || 'Other'),
          description: product.description || 'No description available',
          seller: 'Marketplace Seller',
          reviews: 0, // New products start with 0 reviews
          commission_rate: product.commission_rate || 20, // Use commission_rate field or default to 20%
          commission_type: normalizeCommissionType(product),
          flat_commission_amount: Number(product.flat_commission_amount || product.affiliate_commission_value || 0) || 0,
          sample_enabled: sampleEnabled,
          sample_price: samplePrice ?? undefined,
          created_at: product.created_at
        };
      });

      // If no real products, use sample products
      if (transformedProducts.length === 0) {
        console.log('No real products found, using sample data');
        setRealProducts(products.map(product => ({
          ...product,
          commission_rate: 20 // Default commission rate
        })));
      } else {
        setRealProducts(transformedProducts);
      }
    } catch (error) {
      console.error('Error in fetchRealProducts, using sample data:', error);
      // Fallback to sample products on any error
      setRealProducts(products.map(product => ({
        ...product,
        commission_rate: 20 // Default commission rate
      })));
    } finally {
      setLoading(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    if (isProductSelected(productId)) {
      removeProduct(productId);
    } else {
      addProduct(productId);
    }
  };

  const copyAffiliateLink = async (productId: string) => {
    const link = generateAffiliateLink(productId);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLinks(prev => new Set(prev).add(productId));
      setTimeout(() => {
        setCopiedLinks(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const launchSmsShare = (productId: string) => {
    const link = generateAffiliateLink(productId);
    const message = `Check this out on Beezio: ${link}`;
    window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
  };

  const calculateEarnings = (price: number, commissionRate: number, quantity: number = 1) => {
    return (price * (commissionRate / 100) * quantity).toFixed(2);
  };

  // Combine sample products and real products
  const allProducts = [...products, ...realProducts];

  const isSelectedFromAnySource = (productId: string) =>
    dbSelectedProductIds.has(productId) || isProductSelected(productId);

  // Filter and sort products
  const filteredProducts = allProducts
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'commission':
          return Number(calculateCommissionEarnings(b)) - Number(calculateCommissionEarnings(a));
        case 'price':
          return b.price - a.price;
        case 'rating':
          return b.rating - a.rating;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  const selectedProductsCount = new Set([
    ...selectedProducts.filter(sp => sp.selected).map(sp => sp.productId),
    ...Array.from(dbSelectedProductIds),
  ]).size;
  const totalPotentialEarnings = filteredProducts
    .filter(product => isSelectedFromAnySource(product.id))
    .reduce((sum, product) => sum + Number(calculateCommissionEarnings(product)), 0);

  const categories = [...new Set(allProducts.map(p => p.category))];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading your partner tools</h2>
          <p className="text-gray-600">Restoring your account and saved products...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Please Log In</h2>
          <p className="text-gray-600 mb-6">You need to be logged in to access partner products.</p>
          <Link to="/" className="btn-primary">Go to Home</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Products</h2>
          <p className="text-gray-600">Fetching available products for promotion...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Partner Products</h1>
              <p className="mt-2 text-gray-600">
                Select high-converting products and start earning commissions immediately
              </p>
            </div>
            <div className="mt-4 lg:mt-0 flex flex-col sm:flex-row gap-4">
              <div className="bg-blue-50 px-4 py-3 rounded-lg">
                <div className="text-sm text-blue-600 font-medium">Selected Products</div>
                <div className="text-2xl font-bold text-blue-900">{selectedProductsCount}</div>
              </div>
              <div className="bg-green-50 px-4 py-3 rounded-lg border border-green-200">
                <div className="text-sm text-green-600 font-medium">Potential Earnings</div>
                <div className="text-2xl font-bold text-green-900">${totalPotentialEarnings.toFixed(2)}</div>
                <div className="text-xs text-green-600">per sale cycle</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${selectedProductsCount > 0 ? 'pb-40 sm:pb-32' : ''}`}>
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="lg:w-48">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div className="lg:w-48">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="commission">Highest Commission</option>
                <option value="price">Highest Price</option>
                <option value="rating">Highest Rating</option>
                <option value="name">Name A-Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map((product) => {
            const isSelected = isSelectedFromAnySource(product.id);
            const isCopied = copiedLinks.has(product.id);
            
            return (
              <div
                key={product.id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all duration-200 overflow-hidden ${
                  isSelected 
                    ? 'border-blue-500 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Product Image */}
                <div className="relative">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-48 object-cover"
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (target.src !== PRODUCT_IMAGE_FALLBACK) {
                          target.src = PRODUCT_IMAGE_FALLBACK;
                        }
                      }}
                    />
                  <div className="absolute top-4 right-4">
                    <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                      {formatCommissionLabel(product)}
                    </div>
                  </div>
                  <div className="absolute top-4 left-4">
                    <button
                      onClick={() => toggleProductSelection(product.id)}
                      className={`h-10 min-w-10 rounded-full px-3 flex items-center justify-center transition-colors shadow-sm ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-400 hover:text-blue-500'
                      }`}
                    >
                      {isSelected ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="p-4">
                  {/* Product Info */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{product.category}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-600 ml-1">{product.rating}</span>
                      </div>
                      <span className="text-gray-300">•</span>
                      <span className="text-sm text-gray-600">{product.reviews} reviews</span>
                    </div>
                  </div>

                  {/* Price and Commission - Side by Side */}
                  <div className="mb-4">
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Product Price</div>
                        <div className="text-2xl font-bold text-gray-900">${product.price}</div>
                        {product.sample_enabled && Number.isFinite(product.sample_price) ? (
                          <div className="text-xs text-gray-500 mt-1">
                            Sample: <span className="text-gray-900 font-semibold">${product.sample_price.toFixed(2)}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-green-600 font-medium mb-1">Commission</div>
                        <div className="text-3xl font-bold text-green-600">
                          {normalizeCommissionType(product) === 'percentage'
                            ? `${getCommissionValue(product)}%`
                            : `$${getCommissionValue(product).toFixed(2)}`}
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          {normalizeCommissionType(product) === 'percentage' ? 'Percent of sale' : 'Fixed per sale'}
                        </div>
                      </div>
                    </div>
                    
                    {/* Your Earnings Banner */}
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">You Earn Per Sale:</span>
                        <span className="text-xl font-bold">
                          ${calculateCommissionEarnings(product)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button
                      onClick={() => toggleProductSelection(product.id)}
                      className={`w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-4 h-4" />
                          Promoted in My Store
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Promote This Product
                        </>
                      )}
                    </button>
                    <div className="flex gap-2">
                    <Link
                      to={`/product/${product.id}`}
                      className="flex-1 bg-gray-100 text-gray-700 py-2 px-3 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View
                    </Link>
                    {isSelected && (
                      <>
                        <button
                          onClick={() => copyAffiliateLink(product.id)}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1 ${
                            isCopied
                              ? 'bg-green-500 text-white'
                              : 'bg-blue-500 text-white hover:bg-blue-600'
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy Link
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => launchSmsShare(product.id)}
                          className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          Text Share
                        </button>
                      </>
                    )}
                    </div>
                    {isSelected && (
                      <div className="text-xs text-blue-700">
                        This product is ready to promote and is now in your custom store. Next step: copy your link or text it out.
                      </div>
                    )}
                    {!isSelected && (
                      <div className="text-xs text-gray-600">
                        Promoting this product also adds it to your custom store.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Selected Products Summary */}
      {selectedProductsCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <div className="font-semibold text-gray-900">
                {selectedProductsCount} products selected for promotion
              </div>
              <div className="text-sm text-gray-600">
                Potential earnings: <span className="font-bold text-green-600">${totalPotentialEarnings.toFixed(2)}</span> per sale cycle
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:flex">
              <Link
                to="/affiliate/dashboard"
                className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors text-center"
              >
                View Earnings Dashboard
              </Link>
              <Link
                to="/affiliate/links"
                className="bg-green-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-600 transition-colors text-center"
              >
                Get Partner Links
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateProductsPage;

/*
  When rendering product details or passing to product page, include variants:
  Example: <Link to={`/product/${product.id}`} state={{ variants: productVariants[product.id] || [] }}>...</Link>
*/
