import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Grid, List, Search, SlidersHorizontal } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { canUseStoreTools, getNormalizedAccountRoles, normalizeAccountRole } from '../utils/accountRoles';
import { extractUsStateFromLocation } from '../utils/locationMatching';
import { normalizeAverageRating, normalizeReviewCount } from '../utils/socialProof';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';

interface ProductProfile {
  full_name?: string;
  location?: string;
}

interface MarketplaceProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  calculated_customer_price?: number | null;
  seller_ask?: number | null;
  seller_amount?: number | null;
  seller_ask_price?: number | null;
  is_digital?: boolean | null;
  category?: string;
  category_id?: string | null;
  category_slug?: string | null;
  category_parent_id?: string | null;
  images?: string[];
  commission_rate?: number;
  affiliate_commission_rate?: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
  affiliate_commission_type?: 'percent' | 'flat';
  affiliate_commission_value?: number;
  seller_id?: string;
  status?: string;
  is_promotable?: boolean | null;
  profiles?: ProductProfile | null;
  average_rating?: number;
  review_count?: number;
  created_at?: string;
}

type SortOption = 'featured' | 'price-low' | 'price-high' | 'commission-high' | 'commission-low' | 'popular' | 'newest';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
};

const PAGE_SIZE = 160;
const MARKETPLACE_FETCH_TIMEOUT_MS = 12000;
const MARKETPLACE_SELECT_FIELDS =
  'id,title,description,price,calculated_customer_price,seller_ask,seller_amount,seller_ask_price,is_digital,category,category_id,images,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value,seller_id,average_rating,review_count,created_at,is_active,is_promotable,status,lineage,dropship_provider,source_platform';

const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  { category: 'Electronics', keywords: ['microphone', 'usb', 'keyboard', 'speaker', 'charger', 'camera', 'phone', 'tablet', 'laptop', 'tech', 'wireless', 'led', 'headphone'] },
  { category: 'Pet Supplies', keywords: ['dog', 'cat', 'pet', 'kitty', 'kennel', 'grooming', 'litter', 'puppy', 'leash'] },
  { category: 'Home & Garden', keywords: ['garden', 'house', 'porch', 'lamp', 'outdoor', 'kitchen', 'bedding', 'furniture', 'home', 'decor'] },
  { category: 'Sports & Outdoors', keywords: ['camp', 'hiking', 'bike', 'bicycle', 'outdoor', 'travel', 'fitness', 'sports', 'tent'] },
  { category: 'Beauty & Personal Care', keywords: ['beauty', 'makeup', 'skincare', 'hair', 'cosmetic', 'lotion'] },
  { category: 'Fashion', keywords: ['shirt', 'hoodie', 'jacket', 'fashion', 'dress', 'shoe', 'hat', 'pants', 'bag'] },
  { category: 'Toys & Games', keywords: ['toy', 'game', 'kids', 'puzzle', 'play'] },
  { category: 'Automotive', keywords: ['car', 'auto', 'vehicle', 'truck', 'tire'] },
];

const isMarketplaceVisible = (row: any) => {
  const status = String(row?.status || '').trim().toLowerCase();
  if (status === 'draft' || status === 'archived' || status === 'store_only') {
    return false;
  }
  const promotable = row?.is_promotable === true;
  const active = row?.is_active === true;
  const sourcePlatform = String(row?.source_platform || '').trim().toLowerCase();
  const lineage = String(row?.lineage || '').trim().toUpperCase();
  const isImportedCjProduct = sourcePlatform === 'cj' || lineage === 'CJ';
  const hasExplicitVisibilityState =
    Object.prototype.hasOwnProperty.call(row || {}, 'is_active') ||
    Object.prototype.hasOwnProperty.call(row || {}, 'is_promotable') ||
    status.length > 0;
  if (status === 'active' || promotable || active || isImportedCjProduct) {
    return true;
  }
  return !hasExplicitVisibilityState;
};

const slugify = (value: string) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const getCommissionScore = (product: MarketplaceProduct) => {
  const rawType = String(product.affiliate_commission_type || product.commission_type || 'percentage').toLowerCase();
  if (rawType === 'flat' || rawType === 'flat_rate') {
    return Number(product.affiliate_commission_value ?? product.flat_commission_amount ?? 0);
  }
  return Number(product.affiliate_commission_value ?? product.commission_rate ?? product.affiliate_commission_rate ?? 0);
};

const isDigitalMarketplaceProduct = (product: MarketplaceProduct) => {
  if (product.is_digital === true) return true;
  const categorySignals = [
    product.category,
    product.category_slug,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    categorySignals.includes('digital') ||
    categorySignals.includes('download') ||
    categorySignals.includes('ebook') ||
    categorySignals.includes('software') ||
    categorySignals.includes('course')
  );
};

const normalizeMarketplaceRows = (rows: any[]) =>
  (rows || [])
    .filter((row) => isMarketplaceVisible(row))
    .map((row) => {
      const reviewCount = normalizeReviewCount((row as any)?.review_count);
      const averageRating = normalizeAverageRating((row as any)?.average_rating, reviewCount);
      const buyerFacingPrice = getBuyerFacingProductPrice(row || {});
      return {
        ...row,
        price: buyerFacingPrice,
        average_rating: averageRating,
        review_count: reviewCount,
      } as MarketplaceProduct;
    });

const parseMarketplaceResponse = async (response: Response) => {
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(text || `Marketplace request failed with ${response.status}`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html') || /<html/i.test(text)) {
    throw new Error('Marketplace endpoint returned HTML instead of JSON');
  }

  let payload: any = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Marketplace endpoint returned invalid JSON');
  }

  if (!Array.isArray(payload?.products)) {
    throw new Error('Marketplace endpoint returned an unexpected payload');
  }

  return payload.products as any[];
};

const fetchMarketplaceRows = async (signal: AbortSignal) => {
  const urls = [
    `/api/public/marketplace/products?limit=${PAGE_SIZE}`,
    `/.netlify/functions/public-marketplace-products?limit=${PAGE_SIZE}`,
  ];

  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal });
      return await parseMarketplaceResponse(response);
    } catch (error) {
      lastError = error;
    }
  }

  const { data, error } = await supabase
    .from('products')
    .select(MARKETPLACE_SELECT_FIELDS)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (error) {
    throw error;
  }

  if (Array.isArray(data)) {
    return data;
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load marketplace products');
};

const resolveDerivedCategory = (product: MarketplaceProduct, categoryById: Map<string, CategoryRow>) => {
  if (isDigitalMarketplaceProduct(product)) return 'Digital Products';
  const linkedCategory = product.category_id ? categoryById.get(product.category_id) : null;
  const parentCategory = linkedCategory?.parent_id ? categoryById.get(linkedCategory.parent_id) : null;
  const explicit = String(parentCategory?.name || linkedCategory?.name || product.category || '').trim();
  if (explicit) return explicit;

  const haystack = `${product.title || ''} ${product.description || ''}`.toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword))) {
      return entry.category;
    }
  }

  return 'Other';
};

const MarketplacePageDual: React.FC = () => {
  const { user, profile, currentRole, userRoles, hasRole } = useAuth();
  const location = useLocation();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeRole = normalizeAccountRole(profile?.primary_role || profile?.role || currentRole || 'buyer');
  const normalizedRoles = getNormalizedAccountRoles(userRoles, profile?.primary_role, profile?.role, currentRole);
  const canAddToStore =
    Boolean(user?.id) &&
    (activeRole === 'seller' ||
      activeRole === 'affiliate' ||
      hasRole('seller') ||
      hasRole('affiliate') ||
      hasRole('partner') ||
      canUseStoreTools(normalizedRoles));
  const affiliateRef = (profile as any)?.id || user?.id || null;
  const affiliateUid = user?.id || affiliateRef;
  const viewerState = useMemo(() => extractUsStateFromLocation((profile as any)?.location || ''), [profile]);

  useEffect(() => {
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
      setError(null);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort(new DOMException('Marketplace request timed out', 'AbortError'));
      }, MARKETPLACE_FETCH_TIMEOUT_MS);
      try {
        const rows = await fetchMarketplaceRows(controller.signal);
        if (!isMounted) return;
        const normalizedRows = normalizeMarketplaceRows(rows as any[]);
        setProducts(normalizedRows);
      } catch (error) {
        console.warn('MarketplacePageDual: failed to load products', error);
        if (isMounted) {
          setProducts([]);
          setError(
            error instanceof DOMException && error.name === 'AbortError'
              ? 'Marketplace took too long to load. Please try again.'
              : 'Unable to load marketplace products right now. Please try again.'
          );
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (isMounted) setLoading(false);
      }
    };

    const fetchCategories = async () => {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id,name,slug,parent_id')
          .order('name', { ascending: true });
        if (!error && Array.isArray(data) && isMounted) {
          setCategoryRows(data as CategoryRow[]);
        }
      } catch {
        // non-fatal
      }
    };

    fetchProducts();
    fetchCategories();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const categoryById = useMemo(() => new Map(categoryRows.map((row) => [row.id, row])), [categoryRows]);

  const productsWithCategory = useMemo(
    () =>
      products.map((product) => ({
        ...product,
        derivedCategory: resolveDerivedCategory(product, categoryById),
      })),
    [products, categoryById]
  );

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    productsWithCategory.forEach((product) => {
      const category = String((product as any).derivedCategory || '').trim();
      if (!category) return;
      counts.set(category, (counts.get(category) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, count]) => ({ label, value: slugify(label), count }));
  }, [productsWithCategory]);

  const categoryLabelBySlug = useMemo(
    () => new Map(categoryOptions.map((option) => [option.value, option.label])),
    [categoryOptions]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedCategory = slugify(params.get('category') || '');
    const nextCategory = requestedCategory;

    if (!nextCategory) {
      setSelectedCategory('All');
      return;
    }

    if (categoryLabelBySlug.has(nextCategory)) {
      setSelectedCategory(nextCategory);
      return;
    }

    setSelectedCategory('All');
  }, [location.pathname, location.search, categoryLabelBySlug]);

  const filteredProducts = useMemo(() => {
    let filtered = [...productsWithCategory];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.title.toLowerCase().includes(term) ||
          product.description?.toLowerCase().includes(term) ||
          String((product as any).derivedCategory || '').toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((product) => slugify((product as any).derivedCategory || '') === selectedCategory);
    }

    filtered.sort((a, b) => {
      const aLocal = viewerState && extractUsStateFromLocation(a.profiles?.location || '') === viewerState ? 1 : 0;
      const bLocal = viewerState && extractUsStateFromLocation(b.profiles?.location || '') === viewerState ? 1 : 0;
      if (aLocal !== bLocal) {
        return bLocal - aLocal;
      }
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'commission-high':
          return getCommissionScore(b) - getCommissionScore(a);
        case 'commission-low':
          return getCommissionScore(a) - getCommissionScore(b);
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'popular':
          return (b.review_count || 0) - (a.review_count || 0);
        default:
          return a.title.localeCompare(b.title);
      }
    });

    return filtered;
  }, [productsWithCategory, searchTerm, selectedCategory, sortBy, viewerState]);

  const shelfRows = useMemo(() => {
    const buckets = new Map<string, MarketplaceProduct[]>();
    filteredProducts.forEach((product) => {
      const category = String((product as any).derivedCategory || '').trim();
      if (!category) return;
      if (!buckets.has(category)) buckets.set(category, []);
      buckets.get(category)!.push(product);
    });

    return Array.from(buckets.entries())
      .map(([category, rows]) => ({
        category,
        slug: slugify(category),
        products: rows.slice(0, 12),
        total: rows.length,
      }))
      .filter((row) => row.products.length > 0)
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [filteredProducts]);

  const newItemsProducts = useMemo(
    () =>
      [...productsWithCategory]
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        .slice(0, 12),
    [productsWithCategory]
  );

  const needsPromotingProducts = useMemo(
    () =>
      [...productsWithCategory]
        .filter((product) => product.is_promotable !== false)
        .sort((a, b) => {
          const commissionDelta = getCommissionScore(b) - getCommissionScore(a);
          if (commissionDelta !== 0) return commissionDelta;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
        .slice(0, 12),
    [productsWithCategory]
  );

  const selectedCategoryLabel = selectedCategory === 'All'
    ? 'All Products'
    : categoryLabelBySlug.get(selectedCategory) || selectedCategory;

  const showShelves = selectedCategory === 'All' && !searchTerm.trim();

  return (
    <div className="min-h-screen bg-[#eaeded]">
      <section className="border-b border-slate-200 bg-white shadow-sm md:sticky md:top-16 md:z-20">
        <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-5 lg:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search marketplace products"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffcb05] sm:py-3 sm:pl-12 sm:pr-4"
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:flex sm:flex-wrap sm:gap-3">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortOption)}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm sm:px-4 sm:py-3"
              >
                <option value="featured">Featured</option>
                <option value="popular">Most Popular</option>
                <option value="newest">Newest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="commission-high">Commission: High to Low</option>
                <option value="commission-low">Commission: Low to High</option>
              </select>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 md:hidden"
                aria-expanded={mobileFiltersOpen}
                aria-controls="marketplace-mobile-filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
              </button>
              <div className="flex justify-self-end rounded-2xl bg-slate-100 p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`rounded-2xl p-2 transition ${viewMode === 'grid' ? 'bg-white shadow' : 'text-slate-500'}`}
                  aria-label="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`rounded-2xl p-2 transition ${viewMode === 'list' ? 'bg-white shadow' : 'text-slate-500'}`}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500 md:hidden">
            <span>
              {selectedCategory === 'All' ? 'All products' : selectedCategoryLabel}
            </span>
            <span>{filteredProducts.length} items</span>
          </div>

          {mobileFiltersOpen && (
            <div id="marketplace-mobile-filters" className="mt-3 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 md:hidden">
              <div>
                <label htmlFor="marketplace-mobile-category" className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Category
                </label>
                <select
                  id="marketplace-mobile-category"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#ffcb05]"
                >
                  <option value="All">All Products</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => {
                    setSortBy('newest');
                    setMobileFiltersOpen(false);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition ${sortBy === 'newest' ? 'border-[#131921] bg-[#131921] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'}`}
                >
                  New Items
                </button>
                <button
                  onClick={() => {
                    setSortBy('price-high');
                    setMobileFiltersOpen(false);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition ${sortBy === 'price-high' ? 'border-[#131921] bg-[#131921] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'}`}
                >
                  High Price
                </button>
                <button
                  onClick={() => {
                    setSortBy('commission-high');
                    setMobileFiltersOpen(false);
                  }}
                  className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition ${sortBy === 'commission-high' ? 'border-[#131921] bg-[#131921] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'}`}
                >
                  Top Commission
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 hidden gap-3 overflow-x-auto pb-1 md:flex">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                selectedCategory === 'All'
                  ? 'border-[#131921] bg-[#131921] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'
              }`}
            >
              All Products
            </button>
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedCategory(option.value)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  selectedCategory === option.value
                    ? 'border-[#131921] bg-[#131921] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'
                }`}
              >
                {option.label} ({option.count})
              </button>
            ))}
          </div>

          <div className="mt-3 hidden gap-2 overflow-x-auto pb-1 md:mt-4 md:flex md:flex-wrap md:items-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quick Filters</span>
            <button
              onClick={() => setSortBy('newest')}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${sortBy === 'newest' ? 'border-[#131921] bg-[#131921] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'}`}
            >
              New Items
            </button>
            <button
              onClick={() => setSortBy('price-high')}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${sortBy === 'price-high' ? 'border-[#131921] bg-[#131921] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'}`}
            >
              High Price
            </button>
            <button
              onClick={() => setSortBy('commission-high')}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${sortBy === 'commission-high' ? 'border-[#131921] bg-[#131921] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#ffcb05] hover:text-[#131921]'}`}
            >
              Top Commission
            </button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-4 flex flex-col gap-2 text-sm text-slate-600 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing <strong>{filteredProducts.length}</strong> products
            {selectedCategory !== 'All' && ` in ${selectedCategoryLabel}`}
          </span>
          <Link to="/start-earning" className="text-sm font-semibold text-[#0f6cbf] hover:underline">
            {canAddToStore ? 'Add products to your store from this marketplace' : 'Explore selling and affiliate tools'}
          </Link>
        </div>

        {viewerState && (
          <div className="mb-4 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 sm:mb-6 sm:px-5 sm:py-4">
            Local marketplace mode is active for <strong>{viewerState}</strong>. Sellers in your area are shown first when location data is available, so traffic stays more relevant.
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mb-6 rounded-3xl border border-red-200 bg-white p-8 text-center">
            <h3 className="mb-3 text-xl font-semibold text-slate-900">Marketplace unavailable right now.</h3>
            <p className="mb-6 text-slate-600">{error}</p>
            <button
              onClick={() => setRefreshKey((value) => value + 1)}
              className="rounded-full bg-[#131921] px-6 py-3 font-semibold text-white transition hover:bg-[#0f1720]"
            >
              Retry marketplace
            </button>
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="rounded-3xl border border-dashed border-amber-300 bg-white p-12 text-center">
            <h3 className="mb-3 text-xl font-semibold text-slate-900">No products found.</h3>
            <p className="mb-6 text-slate-600">Try clearing your search or switching categories.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSortBy('featured');
              }}
              className="rounded-full bg-[#ffcb05] px-6 py-3 font-semibold text-[#131921] transition hover:bg-[#f0b400]"
            >
              Reset filters
            </button>
          </div>
        )}

        {!loading && filteredProducts.length > 0 && showShelves && (
          <div className="space-y-8">
            {newItemsProducts.length > 0 && (
              <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">New Items</h2>
                    <p className="text-sm text-slate-500">Latest products added to the marketplace</p>
                  </div>
                  <button
                    onClick={() => {
                      setSortBy('newest');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#ffcb05] hover:bg-amber-50"
                  >
                    View newest
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="-mx-1 overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-3 px-1">
                    {newItemsProducts.map((product) => (
                      <ProductCard
                        key={`new-${product.id}`}
                        product={product as any}
                        viewMode="grid"
                        affiliateRef={affiliateRef}
                        affiliateUid={affiliateUid}
                        compact
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {needsPromotingProducts.length > 0 && (
              <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Products That Need Promoting</h2>
                    <p className="text-sm text-slate-500">Promotable products with stronger affiliate upside</p>
                  </div>
                  <button
                    onClick={() => {
                      setSortBy('commission-high');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#ffcb05] hover:bg-amber-50"
                  >
                    View top commissions
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="-mx-1 overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-3 px-1">
                    {needsPromotingProducts.map((product) => (
                      <ProductCard
                        key={`promote-${product.id}`}
                        product={product as any}
                        viewMode="grid"
                        affiliateRef={affiliateRef}
                        affiliateUid={affiliateUid}
                        compact
                      />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {shelfRows.map((row) => (
              <section key={row.slug} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{row.category}</h2>
                    <p className="text-sm text-slate-500">{row.total} live products in this category</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCategory(row.slug);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#ffcb05] hover:bg-amber-50"
                  >
                    View more
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="-mx-1 overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-3 px-1">
                    {row.products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product as any}
                        viewMode="grid"
                        affiliateRef={affiliateRef}
                        affiliateUid={affiliateUid}
                        compact
                      />
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}

        {!loading && filteredProducts.length > 0 && !showShelves && (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5' : 'space-y-4'}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product as any}
                viewMode={viewMode}
                affiliateRef={affiliateRef}
                affiliateUid={affiliateUid}
                compact={viewMode === 'grid'}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MarketplacePageDual;
