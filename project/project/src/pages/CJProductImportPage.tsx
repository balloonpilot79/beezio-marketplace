import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, DollarSign, Package, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';
import { canAccessCJImport } from '../utils/cjImportAccess';
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
  categoryId?: string;
  categoryName: string;
  sellPrice: number;
}

interface CJVariant {
  vid: string;
  variantSku: string;
  variantNameEn: string;
  variantImage?: string;
  variantSellPrice: number;
  variantStock?: number;
  variantKey?: string;
}

interface CJProductDetail {
  pid: string;
  description?: string;
  productImageList?: string[];
  variants?: CJVariant[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const looksLikeUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_REGEX.test(trimmed);
};

const CJProductImportPage: React.FC = () => {
  const { user, profile } = useAuth();
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
  const didAttemptCategoryLoadRef = useRef(false);

  // Beezio categories (for dropdown) + per-item override (stored as category_id)
  const defaultBeezioCategories = [
    { id: 'electronics', name: 'Electronics' },
    { id: 'fashion', name: 'Fashion & Apparel' },
    { id: 'home-garden', name: 'Home & Garden' },
    { id: 'books-media', name: 'Books & Media' },
    { id: 'sports-outdoors', name: 'Sports & Outdoors' },
    { id: 'beauty-personal-care', name: 'Beauty & Personal Care' },
    { id: 'health-wellness', name: 'Health & Wellness' },
    { id: 'technology', name: 'Technology' },
    { id: 'arts-crafts', name: 'Arts & Crafts' },
    { id: 'automotive', name: 'Automotive' },
    { id: 'pet-supplies', name: 'Pet Supplies' },
    { id: 'toys-games', name: 'Toys & Games' },
    { id: 'education', name: 'Education & Courses' },
    { id: 'services', name: 'Services' },
    { id: 'digital-products', name: 'Digital Products' },
    { id: 'food-beverages', name: 'Food & Beverages' },
    { id: 'other', name: 'Other' },
  ];
  const [beezioCategories, setBeezioCategories] = useState<Array<{ id: string; name: string }>>(defaultBeezioCategories);
  const [beezioCategoryIdOverrides, setBeezioCategoryIdOverrides] = useState<Record<string, string>>({});

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeoutHandle: number | undefined;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = window.setTimeout(() => {
        reject(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) window.clearTimeout(timeoutHandle);
    }
  };

  // Pricing settings for each product
  const [pricingSettings, setPricingSettings] = useState<Record<string, { markup: number; affiliateCommission: number }>>({});
  // Keep as strings so the user can type naturally (e.g. "5.") without the input snapping to 0.
  const [shippingSettings, setShippingSettings] = useState<Record<string, string>>({});

  // Variants + inventory
  const [detailByPid, setDetailByPid] = useState<Record<string, { detail: CJProductDetail | null; loading: boolean; error?: string }>>({});
  const [selectedVariantsByPid, setSelectedVariantsByPid] = useState<Record<string, string[]>>({});
  const [inventoryByKey, setInventoryByKey] = useState<Record<string, { stock: number; loading: boolean; error?: string }>>({});

  const inventoryKey = (pid: string, vid?: string) => `${pid}:${vid || 'base'}`;

  const parseMoney = (value: unknown): number => {
    const raw = String(value ?? '').trim();
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  const ensureCJDetail = async (pid: string): Promise<CJProductDetail | null> => {
    const existing = detailByPid[pid];
    if (existing?.detail) return existing.detail;
    if (existing?.loading) return null;

    setDetailByPid(prev => ({
      ...prev,
      [pid]: { detail: prev[pid]?.detail ?? null, loading: true, error: undefined },
    }));

    try {
      const detail = await withTimeout(getCJProductDetail(pid) as any, 8000, 'CJ product detail');
      setDetailByPid(prev => ({
        ...prev,
        [pid]: { detail: (detail as CJProductDetail) ?? null, loading: false, error: undefined },
      }));
      return (detail as CJProductDetail) ?? null;
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e);
      setDetailByPid(prev => ({
        ...prev,
        [pid]: { detail: prev[pid]?.detail ?? null, loading: false, error: message },
      }));
      return null;
    }
  };

  const ensureCJInventory = async (pid: string, vid?: string): Promise<number | null> => {
    const key = inventoryKey(pid, vid);
    const existing = inventoryByKey[key];
    if (existing && !existing.loading && typeof existing.stock === 'number') return existing.stock;
    if (existing?.loading) return null;

    setInventoryByKey(prev => ({
      ...prev,
      [key]: { stock: prev[key]?.stock ?? 0, loading: true, error: undefined },
    }));

    try {
      const stock = await withTimeout(getCJProductInventory(pid, vid), 8000, 'CJ inventory');
      const safe = Number.isFinite(stock) && stock >= 0 ? stock : 0;
      setInventoryByKey(prev => ({
        ...prev,
        [key]: { stock: safe, loading: false, error: undefined },
      }));
      return safe;
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e);
      setInventoryByKey(prev => ({
        ...prev,
        [key]: { stock: prev[key]?.stock ?? 0, loading: false, error: message },
      }));
      return null;
    }
  };

  // CJ import is intentionally only available for the official Beezio store account(s).
  const isAuthorized = canAccessCJImport(user?.email);

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
      try {
        const { data: bySlug, error: bySlugError } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', normalized)
          .limit(1)
          .maybeSingle();
        if (!bySlugError && (bySlug as any)?.id) return (bySlug as any).id as string;
      } catch {
        // ignore missing slug column / query issues
      }

      if (looksLikeUuid(normalized)) {
        const { data: byId } = await supabase
          .from('categories')
          .select('id')
          .eq('id', normalized)
          .limit(1)
          .maybeSingle();
        if ((byId as any)?.id) return (byId as any).id as string;
      }

      const { data: byName } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', normalized)
        .limit(1)
        .maybeSingle();

      if ((byName as any)?.id) return (byName as any).id as string;

      try {
        const { data: otherSlug, error: otherSlugError } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', 'other')
          .limit(1)
          .maybeSingle();
        if (!otherSlugError && (otherSlug as any)?.id) return (otherSlug as any).id as string;
      } catch {
        // ignore
      }

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

  // Intentionally do NOT auto-call CJ on mount.
  // CJ is heavily rate-limited; this page should only hit CJ when the admin clicks Refresh / Load buttons.

  useEffect(() => {
    // Safe to load Beezio categories on mount (DB only; no CJ API calls).
    (async () => {
      try {
        const { data, error } = await supabase.from('categories').select('id, name');
        if (!error && data && data.length > 0) {
          const sorted = [...(data as any[])].sort((a, b) =>
            String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' })
          );
          setBeezioCategories(sorted as any);
        }
      } catch (e) {
        // Keep fallbacks
        console.warn('CJ Import: Beezio category fetch failed, using defaults', e);
      }
    })();
  }, []);

  const loadCategories = async (force: boolean = false) => {
    try {
      if (!force && categories.length > 0) return;
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

      // If CJ categories endpoint is rate-limited/unavailable, derive a usable category list from the loaded products.
      if (categories.length === 0) {
        const byId = new Map<string, string>();
        for (const p of products as any[]) {
          const id = String(p?.categoryId || '').trim();
          const name = String(p?.categoryName || '').trim();
          if (!id || !name || name === 'Uncategorized') continue;
          if (!byId.has(id)) byId.set(id, name);
        }
        const derived = Array.from(byId.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (derived.length) setCategories(derived);
      }

      // Try fetching the real category tree once per session so the dropdown has readable names.
      if (!didAttemptCategoryLoadRef.current && categories.length === 0) {
        didAttemptCategoryLoadRef.current = true;
        await loadCategories(true);
      }

      // Initialize default pricing for each product
      const defaultPricing: Record<string, { markup: number; affiliateCommission: number }> = {};
      const defaultCategoryOverrides: Record<string, string> = {};
      products.forEach(product => {
        defaultPricing[product.pid] = {
          markup: 115, // 115% markup by default
          affiliateCommission: 30, // 30% affiliate commission
        };

        // Default Beezio category based on CJ category mapping (user can override per item)
        defaultCategoryOverrides[product.pid] = mapCJCategoryToBeezio(product.categoryName);
      });
      setPricingSettings(defaultPricing);

      // Only set defaults for items we haven't already edited (preserves user overrides across refresh/page)
      setBeezioCategoryIdOverrides(prev => {
        const next = { ...prev };
        for (const pid of Object.keys(defaultCategoryOverrides)) {
          if (typeof next[pid] !== 'string' || next[pid].trim() === '') {
            next[pid] = defaultCategoryOverrides[pid];
          }
        }
        return next;
      });
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

      const raw = await response.text();
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        const snippet = raw?.slice(0, 500)?.replace(/\s+/g, ' ') || '';
        const details = parsed ? JSON.stringify(parsed, null, 2) : snippet;
        throw new Error(`Proxy returned ${response.status} ${response.statusText}. ${details}`);
      }

      if (!parsed) {
        const snippet = raw?.slice(0, 500)?.replace(/\s+/g, ' ') || '';
        throw new Error(`Proxy returned non-JSON. ${snippet}`);
      }

      setDebugInfo(JSON.stringify(parsed, null, 2));
      console.log('🔍 CJ API Test Response:', parsed);
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

  const updateShipping = (pid: string, value: number) => {
    // Backwards compat if called with a number
    const safe = Number.isFinite(value) ? String(value) : '';
    setShippingSettings(prev => ({ ...prev, [pid]: safe }));
  };

  const updateShippingRaw = (pid: string, value: string) => {
    setShippingSettings(prev => ({ ...prev, [pid]: value }));
  };

  const updateBeezioCategoryId = (pid: string, value: string) => {
    setBeezioCategoryIdOverrides(prev => ({ ...prev, [pid]: value }));
  };

  const markImporting = (pid: string, isImporting: boolean) => {
    setImporting(prev => {
      const next = new Set(prev);
      if (isImporting) next.add(pid);
      else next.delete(pid);
      return next;
    });
  };

  const invokeImportCJProduct = async (payload: any): Promise<any> => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('You must be signed in to import products');

    const url = `${supabaseUrl}/functions/v1/import-cj-product`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const detail = parsed?.details || parsed?.error || text || `HTTP ${res.status}`;
      throw new Error(`Edge function ${res.status}: ${detail}`);
    }

    return parsed;
  };

  const importProduct = async (cjProduct: CJProduct) => {
    // Allow importing multiple products in parallel without race conditions.
    markImporting(cjProduct.pid, true);
    try {
      console.log('🟣 CJ Import: Starting import for pid', cjProduct.pid);
      // Get detailed product info (best-effort). CJ can be heavily rate-limited.
      let detailedProduct: CJProductDetail | null = detailByPid[cjProduct.pid]?.detail ?? null;
      if (!detailedProduct) {
        try {
          console.log('🟣 CJ Import: Fetching CJ product detail (best-effort)...');
          detailedProduct = await ensureCJDetail(cjProduct.pid);
          console.log('🟣 CJ Import: CJ detail loaded');
        } catch (e) {
          console.warn('CJ detail fetch failed; importing with list data only', e);
        }
      }

      const selectedVids = selectedVariantsByPid[cjProduct.pid] || [];
      const allVariants = detailedProduct?.variants || [];
      
      // The "primary" variant is the first selected one, or null if none selected
      const primaryVid = selectedVids[0] || '';
      const selectedVariant = primaryVid ? allVariants.find(v => String(v?.vid) === String(primaryVid)) : null;

      // Collect all selected variant objects
      // Inventory: use product-level stock by default (variant-level inventory is frequently missing/unstable in CJ payloads).
      const stock = await ensureCJInventory(cjProduct.pid);
      const stockQuantity = typeof stock === 'number' ? stock : null;

      // Get pricing settings
      const pricing = pricingSettings[cjProduct.pid] || { markup: 100, affiliateCommission: 20 };
      const shippingCost = parseMoney(shippingSettings[cjProduct.pid]);
      const hasRecruiter = Boolean(profile?.referred_by_affiliate_id);
      const cjBaseCost = Number.isFinite(selectedVariant?.variantSellPrice)
        ? Number(selectedVariant!.variantSellPrice)
        : cjProduct.sellPrice;
      const priceBreakdown = calculateBeezioPrice(
        cjBaseCost,
        pricing.markup,
        pricing.affiliateCommission,
        hasRecruiter
      );

      // Beezio category chosen by the admin (defaults to mapped CJ category).
      // `categoryId` must be a real UUID when the DB uses UUID categories; otherwise let the edge function resolve.
      const mappedCategoryKey = String(mapCJCategoryToBeezio(cjProduct.categoryName)).trim();
      const categoryKey = String(beezioCategoryIdOverrides[cjProduct.pid] ?? mappedCategoryKey).trim();

      const fallbackNameFromDefaults =
        defaultBeezioCategories.find(c => String(c.id) === String(categoryKey))?.name ||
        defaultBeezioCategories.find(c => String(c.id) === String(mappedCategoryKey))?.name ||
        '';

      const beezioCategoryName =
        beezioCategories.find(c => String(c.id) === String(categoryKey))?.name ||
        beezioCategories.find(c => String(c.id) === String(mappedCategoryKey))?.name ||
        fallbackNameFromDefaults ||
        (categoryKey || 'Other');

      const resolvedBeezioCategoryId = (() => {
        if (looksLikeUuid(categoryKey)) return categoryKey;
        const byIdMatch = beezioCategories.find(c => String(c.id) === String(categoryKey))?.id;
        if (byIdMatch && looksLikeUuid(byIdMatch)) return byIdMatch;
        const nameNeedle = (fallbackNameFromDefaults || beezioCategoryName || '').trim().toLowerCase();
        if (!nameNeedle) return null;
        const byNameMatch = beezioCategories.find(c => String(c.name || '').trim().toLowerCase() === nameNeedle)?.id ?? null;
        return byNameMatch && looksLikeUuid(byNameMatch) ? byNameMatch : null;
      })();

      // Prefer server-side import to bypass RLS/permission issues.
      // If the function is misconfigured/unavailable, fall back to the direct client insert path.
      let serverImportErrorMessage: string | null = null;
      try {
        console.log('🟣 CJ Import: Calling import-cj-product edge function...');
        const serverData = await withTimeout(
          invokeImportCJProduct({
            cjProduct,
            detailedProduct,
            selectedVariant: selectedVariant ? {
              vid: selectedVariant.vid,
              variantSku: selectedVariant.variantSku,
              variantNameEn: selectedVariant.variantNameEn,
              variantImage: selectedVariant.variantImage,
              variantSellPrice: selectedVariant.variantSellPrice,
            } : null,
            variants: allVariants.map(v => ({
              vid: v.vid,
              variantSku: v.variantSku,
              variantNameEn: v.variantNameEn,
              variantImage: v.variantImage,
              variantSellPrice: v.variantSellPrice,
              variantKey: v.variantKey,
              variantStock: v.variantStock
            })),
            inventory: stockQuantity,
            pricing,
            shippingCost,
            beezioCategory: beezioCategoryName,
            categoryId: resolvedBeezioCategoryId,
            computed: {
              finalPrice: priceBreakdown.finalPrice,
              sellerAsk: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
            },
          }),
          15000,
          'import-cj-product'
        );

        console.log('🟣 CJ Import: Edge function response received');

        if (serverData?.product?.id) {
          alert(`✅ Product "${cjProduct.productNameEn}" imported successfully!`);
          setCjProducts(prev => prev.filter(p => p.pid !== cjProduct.pid));
          return;
        } else {
          serverImportErrorMessage = 'Server import returned no product id';
        }
      } catch (e) {
        serverImportErrorMessage = e instanceof Error ? e.message : String(e);
        console.error('🛑 CJ Import: server import failed (falling back to client insert):', e);
      }

      // Create product in Beezio database
      const sellerProfileId = await resolveSellerProfileId();
      const categoryIdFallback = resolvedBeezioCategoryId ? resolvedBeezioCategoryId : (await resolveCategoryId(beezioCategoryName));
      const mergedImages = (() => {
        const isLikelyUrl = (value: string) => value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');

        // Prefer the search endpoint's `productImage` first (usually the most reliable/primary image),
        // then the detail image list, then any variant images.
        const raw = [
          cjProduct.productImage,
          ...(Array.isArray(detailedProduct?.productImageList) ? detailedProduct!.productImageList : []),
          ...allVariants.map(v => v.variantImage).filter(Boolean),
        ];

        const seen = new Set<string>();
        const out: string[] = [];
        for (const candidate of raw) {
          const url = String(candidate || '').trim();
          if (!url) continue;
          if (!isLikelyUrl(url)) continue;
          if (seen.has(url)) continue;
          seen.add(url);
          out.push(url);
          if (out.length >= 10) break;
        }

        return out;
      })();
      const primaryImageUrl = mergedImages[0] || String(cjProduct.productImage || '').trim();

      const { data: newProduct, error: productError } = await supabase
        .from('products')
        .insert({
          seller_id: sellerProfileId,
          title: cjProduct.productNameEn,
          description: detailedProduct?.description || `${cjProduct.productNameEn}. Earn ${pricing.affiliateCommission}% commission!`,
          // Store a seller ask so checkout/pricing engine can work off a stable base.
          // For CJ, the "seller" is the Beezio store account and this ask should cover CJ cost + desired profit.
          seller_ask: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
          seller_amount: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
          seller_ask_price: (priceBreakdown.cjCost ?? cjProduct.sellPrice) + (priceBreakdown.yourProfit ?? 0),
          // Keep the stored listing price for compatibility with existing UI.
          price: priceBreakdown.finalPrice,
          category: beezioCategoryName,
          category_id: categoryIdFallback,
          image_url: primaryImageUrl || cjProduct.productImage,
          images: mergedImages.length ? mergedImages : (primaryImageUrl ? [primaryImageUrl] : [cjProduct.productImage]),
          sku: cjProduct.productSku,
          stock_quantity: typeof stockQuantity === 'number' ? stockQuantity : 0,
          is_digital: false,
          requires_shipping: true,
          shipping_cost: shippingCost,
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
        const serverSuffix = serverImportErrorMessage ? ` (server import failed: ${serverImportErrorMessage})` : '';
        throw new Error(`Product insert failed: ${productError.message} (code: ${productError.code || 'n/a'})${serverSuffix}`);
      }

      // Store CJ product mapping
      const { error: mappingError } = await supabase
        .from('cj_product_mappings')
        .insert({
          beezio_product_id: newProduct.id,
          cj_product_id: cjProduct.pid,
          cj_product_sku: cjProduct.productSku,
          cj_cost: priceBreakdown.cjCost ?? cjProduct.sellPrice,
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
             <div className="flex gap-2 min-w-0 md:col-span-2">
               <select
                 value={selectedCategory}
                 onChange={(e) => setSelectedCategory(e.target.value)}
                 className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
               >
                 <option value="">All Categories</option>
                 {categories.map(cat => (
                   <option key={cat.id} value={cat.id}>{cat.name}</option>
                 ))}
               </select>
               <button
                 onClick={() => loadCategories(true)}
                 disabled={loading}
                 className="shrink-0 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                 title="Load CJ categories (rate-limited)"
               >
                 Load
               </button>
             </div>

            {/* Refresh Button */}
             <button
               onClick={loadProducts}
               disabled={loading}
               className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-[#101820] text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
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
                const shippingCostRaw = shippingSettings[product.pid] ?? '';
                const shippingCost = parseMoney(shippingCostRaw);
                const detailState = detailByPid[product.pid];
                const variants = detailState?.detail?.variants || [];
                const selectedVids = selectedVariantsByPid[product.pid] || [];
                const primaryVid = selectedVids[0] || '';
                const selectedVariant = primaryVid ? variants.find(v => String(v?.vid) === String(primaryVid)) : null;
                const invKey = inventoryKey(product.pid, selectedVariant?.vid || undefined);
                const invState = inventoryByKey[invKey];

                const effectiveCjCost = Number.isFinite(selectedVariant?.variantSellPrice)
                  ? Number(selectedVariant!.variantSellPrice)
                  : product.sellPrice;
                const hasRecruiter = Boolean(profile?.referred_by_affiliate_id);
                const priceBreakdown = calculateBeezioPrice(
                  effectiveCjCost,
                  pricing.markup,
                  pricing.affiliateCommission,
                  hasRecruiter
                );

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
                          <span className="text-gray-600">Product Price:</span>
                          <span className="font-bold text-[#101820]">${priceBreakdown.finalPrice.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Shipping:</span>
                          <input
                            type="text"
                            value="Calculated at checkout"
                            readOnly
                            className="w-40 px-3 py-1 text-sm border border-gray-200 rounded bg-gray-50 text-gray-700 text-right"
                          />
                        </div>

                        {/* Variants (sizes/options) */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs text-gray-600">Variants / Sizes</label>
                            <button
                              type="button"
                              onClick={async () => {
                                await ensureCJDetail(product.pid);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {detailState?.detail ? 'Refresh' : 'Load Variants'}
                            </button>
                          </div>
                          
                          {!detailState?.detail && !detailState?.loading && (
                             <div className="text-xs text-gray-500 italic">Click "Load Variants" to see options</div>
                          )}

                           {detailState?.loading && (
                             <div className="flex items-center gap-2 text-xs text-gray-500">
                               <RefreshCw className="w-3 h-3 animate-spin" /> Loading variants...
                             </div>
                           )}

                           {detailState?.error && (
                             <div className="text-xs text-red-600 mt-1">
                               {detailState.error}
                             </div>
                           )}

                           {detailState?.detail && !detailState?.loading && variants.length === 0 && !detailState?.error && (
                             <div className="text-xs text-gray-500 italic mt-1">No variants returned for this product.</div>
                           )}

                           {variants.length > 0 && (
                             <div className="border border-gray-200 rounded max-h-32 overflow-y-auto p-2 bg-gray-50">
                              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                                <input 
                                  type="checkbox"
                                  checked={selectedVids.length === variants.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedVariantsByPid(prev => ({ ...prev, [product.pid]: variants.map(v => v.vid) }));
                                    } else {
                                      setSelectedVariantsByPid(prev => ({ ...prev, [product.pid]: [] }));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
                                />
                                <span className="text-xs font-medium text-gray-700">Select All ({variants.length})</span>
                              </div>
                              
                              {variants.map(v => (
                                <div key={v.vid} className="flex items-start gap-2 mb-1 last:mb-0">
                                  <input
                                    type="checkbox"
                                    checked={selectedVids.includes(v.vid)}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      setSelectedVariantsByPid(prev => {
                                        const current = prev[product.pid] || [];
                                        if (isChecked) {
                                          return { ...prev, [product.pid]: [...current, v.vid] };
                                        } else {
                                          return { ...prev, [product.pid]: current.filter(id => id !== v.vid) };
                                        }
                                      });
                                    }}
                                    className="mt-0.5 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
                                  />
                                  <div className="text-xs text-gray-600 leading-tight">
                                    <span className="font-medium">{v.variantNameEn}</span>
                                    {Number.isFinite(v.variantSellPrice) && (
                                      <span className="text-gray-400 ml-1">
                                        (${Number(v.variantSellPrice).toFixed(2)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {detailState?.error && (
                            <p className="text-xs text-red-600 mt-1">Variants unavailable: {detailState.error}</p>
                          )}
                          
                          {selectedVids.length > 0 && (
                            <p className="text-xs text-green-600 mt-1 font-medium">
                              {selectedVids.length} variant{selectedVids.length !== 1 ? 's' : ''} selected
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Beezio Category</label>
                          <select
                            value={beezioCategoryIdOverrides[product.pid] ?? mapCJCategoryToBeezio(product.categoryName)}
                            onChange={(e) => updateBeezioCategoryId(product.pid, e.target.value)}
                            className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
                          >
                            {beezioCategories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-gray-500">
                            This is the category stored on the product in Beezio.
                          </p>
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
                            <span className="text-gray-600">Base Cost:</span>
                            <span className="font-medium">${effectiveCjCost.toFixed(2)}</span>
                          </div>
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
                            <span className="text-gray-600">Beezio Fee:</span>
                            <span className="font-medium">${priceBreakdown.beezioFee.toFixed(2)}</span>
                          </div>
                          {hasRecruiter && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Beezio Net (10%):</span>
                              <span className="font-medium">${priceBreakdown.beezioNet.toFixed(2)}</span>
                            </div>
                          )}
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
