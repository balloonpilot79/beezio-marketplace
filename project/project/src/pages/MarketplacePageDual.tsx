import React, { useEffect, useMemo, useState } from 'react';
import { Grid, List, Search, ShoppingCart, Store, TrendingUp, Plus, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../contexts/AuthContextMultiRole';
import AddToAffiliateStoreButton from '../components/AddToAffiliateStoreButton';
import AddToSellerStoreButton from '../components/AddToSellerStoreButton';

interface ProductProfile {
  full_name?: string;
}

interface MarketplaceProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  category?: string;
  category_id?: string | null;
  category_slug?: string | null;
  category_parent_id?: string | null;
  images?: string[];
  commission_rate?: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
  seller_id?: string;
  profiles?: ProductProfile | null;
  average_rating?: number;
  review_count?: number;
}

type SortOption = 'featured' | 'price-low' | 'price-high' | 'commission' | 'popular';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const MarketplacePageDual: React.FC = () => {
  const { user, profile, currentRole } = useAuth();
  const location = useLocation();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [loading, setLoading] = useState(false);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);

  const activeRole = String(profile?.primary_role || profile?.role || currentRole || 'buyer').toLowerCase();
  const isSellerActive = activeRole === 'seller';
  const isAffiliateActive = activeRole === 'affiliate' || activeRole === 'fundraiser';
  const canAddToStore = isSellerActive || isAffiliateActive;

  // Attribution should use profile.id when possible (matches affiliate_links / store tables).
  const affiliateRef = (profile as any)?.id || user?.id || null;

  useEffect(() => {
    // Used by ProductDetailPage as a reliable fallback for the back button.
    try {
      sessionStorage.setItem('beezio:lastMarketplaceUrl', `${location.pathname}${location.search}`);
    } catch {
      // ignore
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const runQuery = async (filters: Array<{ column: string; value: any }>) => {
          let query = supabase
            .from('products')
            .select('*, profiles(full_name), categories:category_id (id,name,slug,parent_id)')
            .limit(100);
          filters.forEach((f) => {
            query = query.eq(f.column as any, f.value);
          });
          return query;
        };

        // Prefer filtering on `is_promotable`/`is_active`, but gracefully fall back if those columns
        // don't exist yet in the connected Supabase project (otherwise the page shows only samples).
        const preferredFilters = [
          { column: 'is_active', value: true },
          { column: 'is_promotable', value: true },
        ];

        let data: any[] | null = null;
        let error: any = null;

        ({ data, error } = await runQuery(preferredFilters));

        const message = String(error?.message || '');
        if (error && /could not find/i.test(message) && /is_promotable/i.test(message)) {
          ({ data, error } = await runQuery([{ column: 'is_active', value: true }]));
        }
        const message2 = String(error?.message || '');
        if (error && /could not find/i.test(message2) && /is_active/i.test(message2)) {
          ({ data, error } = await runQuery([]));
        }

        const message3 = String(error?.message || '');
        if (error && (/relationship/i.test(message3) || /categories/i.test(message3) || /category_id/i.test(message3))) {
          const runFallback = async (filters: Array<{ column: string; value: any }>) => {
            let query = supabase.from('products').select('*, profiles(full_name)').limit(100);
            filters.forEach((f) => {
              query = query.eq(f.column as any, f.value);
            });
            return query;
          };

          ({ data, error } = await runFallback(preferredFilters));
          const m4 = String(error?.message || '');
          if (error && /could not find/i.test(m4) && /is_promotable/i.test(m4)) {
            ({ data, error } = await runFallback([{ column: 'is_active', value: true }]));
          }
          const m5 = String(error?.message || '');
          if (error && /could not find/i.test(m5) && /is_active/i.test(m5)) {
            ({ data, error } = await runFallback([]));
          }
        }

        if (!error && data && data.length && isMounted) {
          const normalized = (data as any[]).map((row) => {
            const joined = (row as any)?.categories;
            const categoryName = joined?.name || row.category || '';
            const categorySlug = joined?.slug || (categoryName ? slugify(categoryName) : null);
            return {
              ...row,
              category: categoryName || undefined,
              category_id: row.category_id ?? null,
              category_slug: categorySlug,
              category_parent_id: joined?.parent_id ?? null,
            } as MarketplaceProduct;
          });
          setProducts(normalized);
        }
      } catch (error) {
        console.warn('MarketplacePageDual: failed to load products', error);
        if (isMounted) {
          setProducts([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id,name,slug,parent_id')
          .order('name', { ascending: true });
        if (!error && Array.isArray(data) && isMounted) {
          setCategoryRows(data as any);
        }
      } catch {
        // non-fatal
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  const categoryModel = useMemo(() => {
    if (!categoryRows.length) {
      const unique = Array.from(
        new Set(
          products
            .map((product) => (product.category ? product.category.trim() : ''))
            .filter(Boolean)
        )
      );
      return {
        mode: 'flat' as const,
        options: ['All', ...unique],
        byId: new Map<string, CategoryRow>(),
        parents: [] as CategoryRow[],
        childrenByParentSlug: {} as Record<string, CategoryRow[]>,
      };
    }

    const byId = new Map(categoryRows.map((c) => [c.id, c]));
    const parents = categoryRows.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name));
    const childrenByParentSlug: Record<string, CategoryRow[]> = {};
    for (const child of categoryRows.filter((c) => c.parent_id)) {
      const parent = child.parent_id ? byId.get(child.parent_id) : null;
      const parentSlug = parent?.slug || '';
      if (!parentSlug) continue;
      childrenByParentSlug[parentSlug] = childrenByParentSlug[parentSlug] || [];
      childrenByParentSlug[parentSlug].push(child);
    }
    Object.values(childrenByParentSlug).forEach((arr) => arr.sort((a, b) => a.name.localeCompare(b.name)));

    return { mode: 'tree' as const, options: [] as string[], byId, parents, childrenByParentSlug };
  }, [categoryRows, products]);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.title.toLowerCase().includes(term) ||
          product.description?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'All') {
      const selectedSlug = selectedCategory;
      filtered = filtered.filter((product) => {
        const pSlug = product.category_slug || (product.category ? slugify(product.category) : '');
        const parentSlug = product.category_parent_id ? categoryModel.byId.get(product.category_parent_id)?.slug || '' : '';
        return pSlug === selectedSlug || parentSlug === selectedSlug;
      });
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'commission':
          return (b.commission_rate || 0) - (a.commission_rate || 0);
        case 'popular':
          return (b.review_count || 0) - (a.review_count || 0);
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return filtered;
  }, [products, searchTerm, selectedCategory, sortBy, categoryModel]);

  const categorySelectOptions = useMemo(() => {
    if (categoryModel.mode === 'tree') {
      return {
        mode: 'tree' as const,
        parents: categoryModel.parents,
        childrenByParentSlug: categoryModel.childrenByParentSlug,
      };
    }

    const unique = categoryModel.options
      .filter((label) => label !== 'All')
      .map((label) => ({ label, value: slugify(label) }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return { mode: 'flat' as const, options: unique };
  }, [categoryModel]);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === 'All') return 'All Products';

    if (categoryRows.length) {
      const match = categoryRows.find((row) => row.slug === selectedCategory);
      return match?.name || selectedCategory;
    }

    const match =
      categoryModel.mode === 'flat'
        ? categoryModel.options.find((label) => label !== 'All' && slugify(label) === selectedCategory)
        : null;

    return match || selectedCategory;
  }, [selectedCategory, categoryRows, categoryModel]);

  const marketplaceStats = useMemo(() => {
    const totalProducts = products.length;
    const totalSellers = new Set(products.map((product) => product.profiles?.full_name).filter(Boolean)).size;
    const avgRating = products.length
      ? (
          products.reduce((sum, product) => sum + (product.average_rating || 4.7), 0) /
          products.length
        ).toFixed(1)
      : '4.9';

    return {
      totalProducts,
      totalSellers,
      avgRating,
    };
  }, [products]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section - Dual Function Messaging */}
      <section className="bg-gradient-to-br from-yellow-50 to-white border-b-4 border-[#ffcb05] shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-start justify-between flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-[#ffcb05] p-3 rounded-xl shadow-lg">
                  <Store className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-4xl font-bold text-[#101820]">
                  Beezio Marketplace
                </h1>
              </div>
              <p className="text-lg text-gray-700 max-w-3xl mb-4">
                <span className="font-semibold text-[#101820]">🛍️ Buyers:</span> Purchase any product directly • {' '}
                <span className="font-semibold text-[#101820]">🏪 Sellers/Affiliates:</span> Add products to your store & earn commissions
              </p>
              {canAddToStore && (
                <div className="bg-yellow-50 border-2 border-[#ffcb05] rounded-xl p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <Plus className="w-6 h-6 text-[#101820] mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-bold text-[#101820] mb-1">Add Products to Your Store</h3>
                      <p className="text-sm text-gray-700">
                        Click "Add to My Store" on any product below to add it to your storefront with your custom affiliate link. 
                        Products added here will appear in your dashboard and your public store page.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/80 backdrop-blur rounded-xl p-4 shadow-md border-2 border-[#ffcb05] text-center">
                <ShoppingCart className="w-8 h-8 text-[#101820] mx-auto mb-2" />
                <div className="text-2xl font-bold text-[#101820]">{filteredProducts.length}</div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Products</div>
              </div>
              <div className="bg-white/80 backdrop-blur rounded-xl p-4 shadow-md border-2 border-[#ffcb05] text-center">
                <TrendingUp className="w-8 h-8 text-[#101820] mx-auto mb-2" />
                <div className="text-2xl font-bold text-[#101820]">Unlimited</div>
                <div className="text-xs text-gray-600 uppercase tracking-wide">Earnings</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Section */}
      <section className="bg-white shadow-sm sticky top-16 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by product, brand, or cause..."
                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#ffcb05]"
              />
            </div>
            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="px-4 py-3 rounded-2xl border border-gray-200 text-sm"
              >
                <option value="featured">Featured</option>
                <option value="popular">Most Popular</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="commission">Highest Commission</option>
              </select>
              <div className="flex bg-gray-100 rounded-2xl p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-2xl transition-all ${viewMode === 'grid' ? 'bg-white shadow' : 'text-gray-500'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-2xl transition-all ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-500'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filter */}
      <section className="border-b border-gray-200 bg-white/90 backdrop-blur sticky top-36 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-4 text-sm">
            <label htmlFor="marketplace-category" className="font-semibold text-gray-700 whitespace-nowrap">
              Category
            </label>
            <select
              id="marketplace-category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full sm:w-80 px-4 py-2 rounded-2xl border border-gray-200 bg-white text-sm"
            >
              <option value="All">All Products</option>
              {categorySelectOptions.mode === 'tree' &&
                categorySelectOptions.parents.map((parent) => (
                  <optgroup key={parent.slug} label={parent.name}>
                    <option value={parent.slug}>{parent.name} (All)</option>
                    {(categorySelectOptions.childrenByParentSlug[parent.slug] || []).map((child) => (
                      <option key={child.slug} value={child.slug}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              {categorySelectOptions.mode === 'flat' &&
                categorySelectOptions.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </section>

      {/* Main Products Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-6 text-sm text-gray-600">
          <span>
            Showing <strong>{filteredProducts.length}</strong> products
            {selectedCategory !== 'All' && ` in ${selectedCategoryLabel}`}
          </span>
          <Link to="/start-earning" className="text-[#ffcb05] font-semibold hover:underline flex items-center gap-2">
            Promote products · earn commissions <ExternalLink className="w-4 h-4" />
          </Link>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 bg-white border border-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filteredProducts.length === 0 && (
          <div className="bg-white border border-dashed border-amber-300 rounded-2xl p-12 text-center">
            <h3 className="text-xl font-semibold mb-3">No products found.</h3>
            <p className="text-gray-600 mb-6">
              Try clearing your filters or search for another product category.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSortBy('featured');
              }}
              className="px-6 py-3 bg-[#ffcb05] text-[#101820] rounded-full font-semibold hover:bg-[#e0b000] transition-colors"
            >
              Reset Filters
            </button>
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {filteredProducts.map((product) => (
              <div key={product.id} className="relative group">
                <ProductCard product={product as any} viewMode={viewMode} affiliateRef={affiliateRef} />
                
                {/* Add to Store Button Overlay for Sellers/Affiliates/Fundraisers */}
                {canAddToStore && product.seller_id && (
                  <div className="absolute top-2 right-2 z-10">
                    {isSellerActive ? (
                      <AddToSellerStoreButton
                        productId={product.id}
                        size="sm"
                        variant="icon"
                      />
                    ) : (
                      <AddToAffiliateStoreButton
                        productId={product.id}
                        sellerId={product.seller_id}
                        productTitle={product.title}
                        productPrice={product.price}
                        defaultCommissionRate={product.commission_rate || 10}
                        size="sm"
                        variant="icon"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* CTA Section */}
      <section className="bg-[#101820] text-white py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <p className="text-sm uppercase tracking-[0.4em] text-[#ffcb05]">Why everyone loves this marketplace</p>
          <h2 className="text-3xl font-bold">Dual-Function Marketplace</h2>
          <div className="grid md:grid-cols-2 gap-8 text-left max-w-4xl mx-auto mt-8">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
              <ShoppingCart className="w-10 h-10 text-[#ffcb05] mb-4" />
              <h3 className="text-xl font-bold mb-2">For Buyers</h3>
              <p className="text-white/80">
                Purchase any product directly from the marketplace. Simple checkout, secure payments, and transparent pricing.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/20">
              <Store className="w-10 h-10 text-[#ffcb05] mb-4" />
              <h3 className="text-xl font-bold mb-2">For Sellers & Affiliates</h3>
              <p className="text-white/80">
                Add any product to your custom store. Get instant affiliate links. Earn commissions on every sale. Build your business.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Link
              to="/start-earning"
              className="px-8 py-3 rounded-full bg-[#ffcb05] text-[#101820] font-semibold shadow-lg hover:bg-[#e0b000] transition-colors"
            >
              Start Selling & Earning
            </Link>
            <Link
              to="/signup"
              className="px-8 py-3 rounded-full border-2 border-[#ffcb05] text-[#ffcb05] font-semibold hover:bg-[#ffcb05] hover:text-[#101820] transition-colors"
            >
              Create Your Store
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MarketplacePageDual;
