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
  productSpu?: string;
  productImage: string;
  categoryId?: string;
  categoryName: string;
  sellPrice: number;
  createdAt?: string;
  brandName?: string;
  listedNum?: number;
  warehouseInventoryNum?: number;
  totalVerifiedInventory?: number;
  verifiedWarehouse?: number;
  hasVideo?: boolean;
  isFreeShipping?: boolean;
  shippingCountryCodes?: string[];
}

interface CJVariant {
  vid: string;
  variantSku: string;
  variantNameEn: string;
  variantImage?: string;
  variantSellPrice: number;
  variantStock?: number;
  variantKey?: string;
  variantWeight?: number;
  variantWeightOz?: number;
  weight?: number;
  weight_oz?: number;
}

interface CJProductDetail {
  pid: string;
  description?: string;
  productImageList?: string[];
  productVideo?: string;
  productVideoUrl?: string;
  productVideoList?: string[];
  videoList?: string[];
  videos?: string[];
  logisticList?: any[];
  shippingList?: any[];
  logistics?: any[];
  shippingOptions?: any[];
  warehouseName?: string;
  shipFrom?: string;
  originCountry?: string;
  variants?: CJVariant[];
  productWeight?: number;
  packingWeight?: number;
  weight?: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const looksLikeUuid = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_REGEX.test(trimmed);
};

const normalizeCountryCode = (value: unknown): string => {
  return String(value || '').trim().toUpperCase();
};

const looksUsBased = (value: unknown): boolean => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return false;
  return (
    normalized === 'US' ||
    normalized === 'USA' ||
    normalized === 'UNITED STATES' ||
    normalized === 'UNITED STATES OF AMERICA' ||
    normalized.includes('US WAREHOUSE') ||
    normalized.includes('USA WAREHOUSE') ||
    normalized.includes('UNITED STATES')
  );
};

const getNormalizedShippingCountryCodes = (product: CJProduct): string[] => {
  if (!Array.isArray(product.shippingCountryCodes)) return [];
  return product.shippingCountryCodes
    .map((value) => normalizeCountryCode(value))
    .filter(Boolean);
};

const productHasUsaShippingFlag = (product: CJProduct): boolean => {
  return getNormalizedShippingCountryCodes(product).some((code) => looksUsBased(code));
};

const productHasFreeShippingFlag = (product: CJProduct): boolean => product.isFreeShipping === true;

const getProductSearchTokens = (product: CJProduct): string[] => {
  return [
    product.productNameEn,
    product.productSku,
    product.productSpu,
    product.pid,
    product.brandName,
    product.categoryName,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
};

interface CJProductImportPageProps {
  embedded?: boolean;
}

const CJProductImportPage: React.FC<CJProductImportPageProps> = ({ embedded = false }) => {
  const { user, profile } = useAuth();
  const [cjProducts, setCjProducts] = useState<CJProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [minListingPrice, setMinListingPrice] = useState('');
  const [maxListingPrice, setMaxListingPrice] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [usaShippingOnly, setUsaShippingOnly] = useState(false);
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [highQualityOnly, setHighQualityOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'best-import' | 'listing-high' | 'listing-low' | 'newest'>('best-import');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<50 | 100>(100);
  const [totalProducts, setTotalProducts] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showImportedProducts, setShowImportedProducts] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const didAttemptCategoryLoadRef = useRef(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [batchImporting, setBatchImporting] = useState(false);
  const [imageIndexByPid, setImageIndexByPid] = useState<Record<string, number>>({});
  const [showCategoryOverrideByPid, setShowCategoryOverrideByPid] = useState<Record<string, boolean>>({});
  const [globalMatchAffiliateToMarkup, setGlobalMatchAffiliateToMarkup] = useState(false);
  const [matchAffiliateByPid, setMatchAffiliateByPid] = useState<Record<string, boolean>>({});
  const [autoLoadVariants, setAutoLoadVariants] = useState(true);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});

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

  useEffect(() => {
    const loadCategoryMap = async () => {
      try {
        const { data } = await supabase
          .from('category_map_cj_to_beezio')
          .select('cj_category_path,beezio_category_id,categories:beezio_category_id(id,name,slug)')
          .limit(1000);
        const map: Record<string, string> = {};
        for (const row of data || []) {
          const cjPath = String(row?.cj_category_path || '').trim().toLowerCase();
          const catId = String((row as any)?.beezio_category_id || (row as any)?.categories?.id || '').trim();
          const catSlug = String((row as any)?.categories?.slug || '').trim();
          const catName = String((row as any)?.categories?.name || '').trim();
          if (cjPath && catId) {
            map[`path:${cjPath}`] = catId;
          }
          if (cjPath && catSlug) {
            map[`slug:${cjPath}`] = catSlug;
          }
          if (cjPath && catName) {
            map[`name:${cjPath}`] = catName;
          }
        }
        setCategoryMap(map);
      } catch (e) {
        console.warn('CJ category map load failed (non-blocking):', e);
        setCategoryMap({});
      }
    };
    void loadCategoryMap();
  }, []);

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
  const [pricingSettings, setPricingSettings] = useState<Record<string, { markup: number; affiliatePercent: number }>>({});
  // Shipping is calculated at checkout for CJ (weight-based).

  // Variants + inventory
  const [detailByPid, setDetailByPid] = useState<Record<string, { detail: CJProductDetail | null; loading: boolean; error?: string }>>({});
  const [selectedVariantsByPid, setSelectedVariantsByPid] = useState<Record<string, string[]>>({});
  const [inventoryByKey, setInventoryByKey] = useState<Record<string, { stock: number | null; loading: boolean; error?: string }>>({});

  const inventoryKey = (pid: string, vid?: string) => `${pid}:${vid || 'base'}`;

  const parseMoney = (value: unknown): number => {
    const raw = String(value ?? '').trim();
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  const toWeightOz = (value: unknown): number => {
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    if (raw >= 50) {
      return Math.max(0, Math.round(raw / 28.3495));
    }
    return Math.max(0, Math.round(raw));
  };

  const resolveBaseWeightOz = (detail?: CJProductDetail | null): number => {
    const candidates = [
      detail?.packingWeight,
      detail?.productWeight,
      detail?.weight,
    ];
    for (const candidate of candidates) {
      const oz = toWeightOz(candidate);
      if (oz > 0) return oz;
    }
    return 0;
  };

  const normalizeImageUrl = (value: string): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('//')) return `https:${raw}`;
    if (raw.startsWith('http://')) return `https://${raw.slice(7)}`;
    return raw;
  };

  const getImageCandidates = (product: CJProduct, detail?: CJProductDetail | null): string[] => {
    const variantImages = Array.isArray(detail?.variants)
      ? detail!.variants!.map(v => v.variantImage).filter(Boolean)
      : [];
    const raw = [
      product.productImage,
      ...(Array.isArray(detail?.productImageList) ? detail!.productImageList : []),
      ...variantImages,
    ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const candidate of raw) {
      const normalized = normalizeImageUrl(String(candidate || '').trim());
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      out.push(normalized);
      if (out.length >= 10) break;
    }
    return out;
  };

  const normalizeVideoUrl = (value: unknown): string => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('//')) return `https:${raw}`;
    return raw;
  };

  const extractVideoUrls = (value: unknown): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap((entry) => extractVideoUrls(entry));
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) return [];
      if (raw.includes(',')) return raw.split(',').map((part) => normalizeVideoUrl(part)).filter(Boolean);
      return [normalizeVideoUrl(raw)].filter(Boolean);
    }
    if (typeof value === 'object') {
      const candidate =
        (value as any)?.videoUrl ??
        (value as any)?.video_url ??
        (value as any)?.url ??
        (value as any)?.video ??
        (value as any)?.src ??
        '';
      return candidate ? [normalizeVideoUrl(candidate)].filter(Boolean) : [];
    }
    return [];
  };

  const getVideoCandidates = (detail?: CJProductDetail | null, variants: CJVariant[] = []): string[] => {
    const raw = [
      ...extractVideoUrls((detail as any)?.productVideoList),
      ...extractVideoUrls((detail as any)?.videoList),
      ...extractVideoUrls((detail as any)?.videos),
      ...extractVideoUrls((detail as any)?.productVideo),
      ...extractVideoUrls((detail as any)?.productVideoUrl),
      ...extractVideoUrls((detail as any)?.videoUrl),
      ...variants.flatMap((variant) => [
        ...extractVideoUrls((variant as any)?.videoUrl),
        ...extractVideoUrls((variant as any)?.videos),
      ]),
    ];

    const seen = new Set<string>();
    const out: string[] = [];
    for (const candidate of raw) {
      const url = normalizeVideoUrl(candidate);
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= 12) break;
    }
    return out;
  };

  const getShippingOptionsSnapshot = (
    detail: CJProductDetail | null | undefined,
    variants: CJVariant[] = [],
    fallbackShippingCost: number
  ): Array<{
    name: string;
    cost: number;
    estimated_days: string;
    min_days?: number;
    max_days?: number;
    tracking_supported?: boolean;
    origin_country?: string;
    origin_label?: string;
    processing_time?: string;
  }> => {
    const rows = [
      ...(((detail as any)?.logisticList && Array.isArray((detail as any).logisticList)) ? (detail as any).logisticList : []),
      ...(((detail as any)?.shippingList && Array.isArray((detail as any).shippingList)) ? (detail as any).shippingList : []),
      ...(((detail as any)?.shippingOptions && Array.isArray((detail as any).shippingOptions)) ? (detail as any).shippingOptions : []),
      ...(((detail as any)?.logistics && Array.isArray((detail as any).logistics)) ? (detail as any).logistics : []),
      ...(((detail as any)?.data?.logisticList && Array.isArray((detail as any).data.logisticList)) ? (detail as any).data.logisticList : []),
      ...variants.flatMap((variant) => (Array.isArray((variant as any)?.shippingOptions) ? (variant as any).shippingOptions : [])),
    ];

    const normalizeShippingCost = (value: unknown): number => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) return Math.max(0, fallbackShippingCost);
      if (Number.isInteger(parsed) && parsed >= 1000 && parsed <= 500000) {
        return Math.round(((parsed / 100) + Number.EPSILON) * 100) / 100;
      }
      return Math.round((parsed + Number.EPSILON) * 100) / 100;
    };

    const parseDays = (value: string): { min?: number; max?: number } => {
      const text = String(value || '').toLowerCase();
      const matches = text.match(/\d+/g);
      if (!matches || matches.length === 0) return {};
      const nums = matches.map(Number).filter((n) => Number.isFinite(n) && n >= 0);
      if (!nums.length) return {};
      if (nums.length === 1) return { min: nums[0], max: nums[0] };
      const sorted = [...nums].sort((a, b) => a - b);
      return { min: sorted[0], max: sorted[sorted.length - 1] };
    };

    const mapped = rows
      .map((row: any) => {
        const name = String(
          row?.logisticName ?? row?.logisticsName ?? row?.shippingMethod ?? row?.methodName ?? row?.name ?? ''
        ).trim();
        if (!name) return null;

        const costRaw = row?.logisticPrice ?? row?.shippingFee ?? row?.freight ?? row?.price ?? row?.cost;
        const cost = normalizeShippingCost(costRaw);

        const estimated = String(
          row?.logisticAging ?? row?.deliveryTime ?? row?.aging ?? row?.estimatedDays ?? row?.deliveryDays ?? '5-12 business days'
        ).trim() || '5-12 business days';
        const dayRange = parseDays(estimated);

        const originCountry = String(
          row?.originCountry ?? row?.country ?? row?.countryCode ?? (detail as any)?.originCountry ?? ''
        ).trim();
        const originLabel = String(
          row?.warehouseName ?? row?.warehouse ?? row?.shipFrom ?? (detail as any)?.warehouseName ?? (detail as any)?.shipFrom ?? ''
        ).trim();
        const processingTime = String(row?.processingTime ?? row?.processingDays ?? (detail as any)?.processingTime ?? '').trim();
        const trackingSupported =
          Boolean(row?.trackingAble ?? row?.tracking_enabled ?? row?.supportTracking ?? row?.isTracking ?? row?.hasTracking) ||
          /track/i.test(String(row?.trackingInfo ?? row?.trackingDesc ?? row?.remark ?? ''));

        return {
          name,
          cost,
          estimated_days: estimated,
          ...(dayRange.min !== undefined ? { min_days: dayRange.min } : {}),
          ...(dayRange.max !== undefined ? { max_days: dayRange.max } : {}),
          ...(trackingSupported ? { tracking_supported: true } : {}),
          ...(originCountry ? { origin_country: originCountry } : {}),
          ...(originLabel ? { origin_label: originLabel } : {}),
          ...(processingTime ? { processing_time: processingTime } : {}),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const seen = new Set<string>();
    const deduped: Array<{ name: string; cost: number; estimated_days: string; origin_country?: string; origin_label?: string; processing_time?: string }> = [];
    for (const option of mapped) {
      const key = `${option.name.toLowerCase()}::${option.estimated_days.toLowerCase()}::${option.cost}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(option);
      if (deduped.length >= 8) break;
    }

    if (deduped.length > 0) return deduped;

    return [
      {
        name: 'CJ Shipping',
        cost: Math.max(0, fallbackShippingCost),
        estimated_days: '5-12 business days',
        tracking_supported: true,
      },
    ];
  };

  const getUsaShippingOptions = (
    detail: CJProductDetail | null | undefined,
    variants: CJVariant[] = [],
    fallbackShippingCost: number = 0
  ) => {
    const options = getShippingOptionsSnapshot(detail, variants, fallbackShippingCost);
    return options.filter((option) => {
      const originCountry = normalizeCountryCode(option.origin_country);
      const originLabel = String(option.origin_label || '').trim();
      const methodName = String(option.name || '').trim();
      return looksUsBased(originCountry) || looksUsBased(originLabel) || looksUsBased(methodName);
    });
  };

  const hasFreeShippingOption = (
    detail: CJProductDetail | null | undefined,
    variants: CJVariant[] = [],
    fallbackShippingCost: number = 0
  ) => {
    return getShippingOptionsSnapshot(detail, variants, fallbackShippingCost).some(
      (option) => Number.isFinite(Number(option.cost)) && Number(option.cost) <= 0
    );
  };

  const getBestImportScore = (
    product: CJProduct,
    detail: CJProductDetail | null | undefined,
    selectedVids: string[],
    shippingOptions: Array<{ cost: number; tracking_supported?: boolean }>,
    usaShippingOptions: Array<{ cost: number; tracking_supported?: boolean }>
  ) => {
    const variants = detail?.variants || [];
    const effectiveCjCost = resolveEffectiveCjCost(product.sellPrice, variants, selectedVids);
    const cheapestShipping = shippingOptions.length
      ? Math.min(...shippingOptions.map((option) => Number(option.cost || 0)).filter((value) => Number.isFinite(value) && value >= 0))
      : 0;
    const listedNum = Number(product.listedNum || 0);
    const verifiedInventory = Number(product.totalVerifiedInventory || 0);
    const warehouseInventory = Number(product.warehouseInventoryNum || 0);
    const hasTracking = shippingOptions.some((option) => Boolean(option.tracking_supported));
    const freeShipping = shippingOptions.some((option) => Number(option.cost || 0) <= 0);
    const usaShipping = usaShippingOptions.length > 0;
    const multiImageCount = getImageCandidates(product, detail).length;
    const videoCount = getVideoCandidates(detail, variants).length;

    return (
      (usaShipping ? 600 : 0) +
      (freeShipping ? 300 : 0) +
      (hasTracking ? 120 : 0) +
      Math.min(160, listedNum / 8) +
      Math.min(120, verifiedInventory / 25) +
      Math.min(90, warehouseInventory / 500) +
      Math.min(60, multiImageCount * 8) +
      Math.min(50, videoCount * 20) +
      Math.max(0, 80 - effectiveCjCost * 2) +
      Math.max(0, 60 - cheapestShipping * 5)
    );
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
      const variants = Array.isArray((detail as CJProductDetail)?.variants) ? (detail as CJProductDetail).variants! : [];
      setDetailByPid(prev => ({
        ...prev,
        [pid]: { detail: (detail as CJProductDetail) ?? null, loading: false, error: undefined },
      }));
      if (variants.length > 0) {
        setSelectedVariantsByPid(prev => {
          const existing = prev[pid] || [];
          if (existing.length > 0) return prev;
          return { ...prev, [pid]: variants.map(v => v.vid) };
        });
      }
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
      [key]: { stock: prev[key]?.stock ?? null, loading: true, error: undefined },
    }));

    try {
      const stock = await withTimeout(getCJProductInventory(pid, vid), 8000, 'CJ inventory');
      const safe = Number.isFinite(stock) && (stock as number) >= 0 ? Number(stock) : null;
      setInventoryByKey(prev => ({
        ...prev,
        [key]: { stock: safe, loading: false, error: undefined },
      }));
      return safe;
    } catch (e: any) {
      const message = e instanceof Error ? e.message : String(e);
      setInventoryByKey(prev => ({
        ...prev,
        [key]: { stock: prev[key]?.stock ?? null, loading: false, error: message },
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
    const defaultRole = (email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com' || email === 'shop@beezio.co') ? 'admin' : 'buyer';

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

  const loadProducts = async (
    pageOverride?: number,
    categoryOverride?: string,
    pageSizeOverride?: number,
    showImportedOverride?: boolean
  ) => {
    setLoading(true);
    setError(null);
    try {
      const targetPage = Number.isFinite(pageOverride) && Number(pageOverride) > 0 ? Number(pageOverride) : currentPage;
      const targetCategory = typeof categoryOverride === 'string' ? categoryOverride : selectedCategory;
      const targetPageSize = Number.isFinite(pageSizeOverride) && Number(pageSizeOverride) > 0 ? Number(pageSizeOverride) : pageSize;
      const includeImported = typeof showImportedOverride === 'boolean' ? showImportedOverride : showImportedProducts;
      console.log('🔵 CJ Import: Fetching products - page:', targetPage, 'category:', targetCategory);
      const { products, total } = await getCJProducts(targetPage, targetPageSize, targetCategory, true, searchQuery);

      let importedCjIds = new Set<string>();
      try {
        const { data: importedRows } = await supabase
          .from('cj_product_mappings')
          .select('cj_product_id')
          .limit(5000);
        importedCjIds = new Set(
          (importedRows || [])
            .map((row: any) => String(row?.cj_product_id || '').trim())
            .filter(Boolean)
        );
      } catch (importedLookupError) {
        console.warn('CJ Import: Failed to load imported CJ IDs (non-blocking):', importedLookupError);
      }

      const freshProducts = products.filter((product) => !importedCjIds.has(String(product?.pid || '').trim()));
      const visibleProducts = includeImported ? products : freshProducts;

      console.log('🔵 CJ Import: Got products:', products?.length, 'fresh:', freshProducts?.length, 'visible:', visibleProducts?.length, 'total:', total);
      setCjProducts(visibleProducts);
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
      const defaultPricing: Record<string, { markup: number; affiliatePercent: number }> = {};
      const defaultCategoryOverrides: Record<string, string> = {};
      visibleProducts.forEach(product => {
        defaultPricing[product.pid] = {
          markup: 3,
          affiliatePercent: 5,
        };

        // Default Beezio category based on CJ category mapping (user can override per item)
        defaultCategoryOverrides[product.pid] = resolveBeezioCategoryOverride(product.categoryName, product.categoryId);
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

      if (autoLoadVariants) {
        const queue = visibleProducts.filter(p => !(detailByPid[p.pid]?.detail || detailByPid[p.pid]?.loading));
        if (queue.length > 0) {
          void runWithConcurrency(queue, 2, async (p) => {
            await ensureCJDetail(p.pid);
          });
        }
      }
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

  const updatePricing = (pid: string, field: 'markup' | 'affiliatePercent', value: number) => {
    setPricingSettings(prev => {
      const current = prev[pid] || { markup: 3, affiliatePercent: 5 };
      const next = {
        ...current,
        [field]: value,
      };
      const shouldMatch = globalMatchAffiliateToMarkup || matchAffiliateByPid[pid];
      if (field === 'markup' && shouldMatch) {
        next.affiliatePercent = value;
      }
      return {
        ...prev,
        [pid]: next,
      };
    });
  };

  const updateBeezioCategoryId = (pid: string, value: string) => {
    setBeezioCategoryIdOverrides(prev => ({ ...prev, [pid]: value }));
  };

  const resolveBeezioCategoryOverride = (cjName: string, cjId?: string) => {
    const nameKey = String(cjName || '').trim().toLowerCase();
    const idKey = String(cjId || '').trim().toLowerCase();
    const fromMap =
      (nameKey && (categoryMap[`path:${nameKey}`] || categoryMap[`slug:${nameKey}`] || categoryMap[`name:${nameKey}`])) ||
      (idKey && (categoryMap[`path:${idKey}`] || categoryMap[`slug:${idKey}`] || categoryMap[`name:${idKey}`])) ||
      '';
    if (fromMap) return fromMap;
    return mapCJCategoryToBeezio(cjName);
  };

  const markImporting = (pid: string, isImporting: boolean) => {
    setImporting(prev => {
      const next = new Set(prev);
      if (isImporting) next.add(pid);
      else next.delete(pid);
      return next;
    });
  };

  const resolveSelectedVids = (pid: string, variants: CJVariant[]) => {
    const selected = selectedVariantsByPid[pid] || [];
    if (selected.length > 0) return selected;
    if (variants.length === 0) return [];
    return variants.map(v => v.vid);
  };

  const resolveEffectiveCjCost = (
    fallbackSellPrice: number,
    variants: CJVariant[],
    selectedVids: string[]
  ): number => {
    const selectedSet = new Set((selectedVids || []).map((vid) => String(vid || '').trim()));
    const source = selectedSet.size > 0
      ? variants.filter((variant) => selectedSet.has(String(variant?.vid || '').trim()))
      : variants;

    const prices = source
      .map((variant) => Number(variant?.variantSellPrice))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (prices.length > 0) {
      return Math.max(...prices);
    }

    const fallback = Number(fallbackSellPrice);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
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

  const buildImportSuccessMessage = (productName: string, result: any) => {
    const productId = String(result?.product?.id || '').trim();
    return `Imported "${productName}" successfully.${productId ? ` Product id: ${productId}` : ''}`;
  };

  const invokeCjInventorySync = async (payload: { cj_product_ids?: string[]; cj_variant_ids?: string[] }) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('You must be signed in to sync inventory');

    const res = await fetch('/.netlify/functions/inventory-cj-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Inventory sync failed (${res.status})`);
    }

    return await res.json().catch(() => ({}));
  };

  const importProduct = async (cjProduct: CJProduct, options?: { silent?: boolean }) => {
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

      if (!detailedProduct) {
        try {
          detailedProduct = await withTimeout(getCJProductDetail(cjProduct.pid) as any, 15000, 'CJ product detail retry');
          setDetailByPid(prev => ({
            ...prev,
            [cjProduct.pid]: { detail: (detailedProduct as CJProductDetail) ?? null, loading: false, error: undefined },
          }));
        } catch (retryError) {
          console.warn('CJ detail retry failed (continuing):', retryError);
        }
      }

      const allVariants = detailedProduct?.variants || [];
      const selectedVids = resolveSelectedVids(cjProduct.pid, allVariants);
      if ((selectedVariantsByPid[cjProduct.pid] || []).length === 0 && allVariants.length > 0) {
        setSelectedVariantsByPid(prev => ({ ...prev, [cjProduct.pid]: selectedVids }));
      }
      
      // The "primary" variant is the first selected one, or null if none selected
      const primaryVid = selectedVids[0] || '';
      const selectedVariant = primaryVid ? allVariants.find(v => String(v?.vid) === String(primaryVid)) : null;

      // Inventory strategy:
      // 1) Sum selected variant inventory from live CJ variant queries.
      // 2) Fallback to detail payload variantStock values when present.
      // 3) Fallback to product-level inventory query.
      let stockQuantity: number | null = null;
      if (selectedVids.length > 0) {
        const variantStocks = await Promise.all(
          selectedVids.map(async (vid) => {
            const live = await ensureCJInventory(cjProduct.pid, vid);
            if (typeof live === 'number' && Number.isFinite(live) && live >= 0) return live;
            const fromDetail = allVariants.find((v) => String(v?.vid) === String(vid))?.variantStock;
            return Number.isFinite(fromDetail) && Number(fromDetail) >= 0 ? Number(fromDetail) : null;
          })
        );
        const numeric = variantStocks.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0);
        if (numeric.length > 0) {
          stockQuantity = numeric.reduce((acc, n) => acc + n, 0);
        }
      }

      if (stockQuantity === null || stockQuantity <= 0) {
        const productLevel = await ensureCJInventory(cjProduct.pid);
        const normalizedProductLevel =
          typeof productLevel === 'number' && Number.isFinite(productLevel) && productLevel >= 0 ? productLevel : null;
        if (stockQuantity === null) {
          stockQuantity = normalizedProductLevel;
        } else if (normalizedProductLevel !== null && normalizedProductLevel > stockQuantity) {
          stockQuantity = normalizedProductLevel;
        }
      }

      // Get pricing settings
      const pricing = pricingSettings[cjProduct.pid] || { markup: 3, affiliatePercent: 5 };
      const shippingOptionsSnapshot = getShippingOptionsSnapshot(detailedProduct, allVariants, 0);
      const shippingCost = shippingOptionsSnapshot.length
        ? Math.min(...shippingOptionsSnapshot.map((option) => Number(option.cost || 0)).filter((value) => Number.isFinite(value) && value >= 0))
        : 0;
      const videoCandidates = getVideoCandidates(detailedProduct, allVariants);
      const hasRecruiter = false;
      const cjBaseCost = resolveEffectiveCjCost(cjProduct.sellPrice, allVariants, selectedVids);
      const landedCost = cjBaseCost + (Number.isFinite(shippingCost) ? shippingCost : 0);
      const priceBreakdown = calculateBeezioPrice(
        landedCost,
        pricing.markup,
        pricing.affiliatePercent,
        hasRecruiter,
        { applyMinimums: false }
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

      const categoryIdFallback = resolvedBeezioCategoryId ? resolvedBeezioCategoryId : (await resolveCategoryId(beezioCategoryName));
      const serverImportResult = await invokeImportCJProduct({
        cjProduct,
        detailedProduct,
        selectedVariant,
        variants: allVariants,
        inventory: stockQuantity,
        pricing: {
          markup: pricing.markup,
          affiliateCommission: pricing.affiliatePercent,
          affiliateCommissionType: 'percent',
        },
        shippingCost,
        shippingOptions: shippingOptionsSnapshot,
        videos: videoCandidates,
        beezioCategory: beezioCategoryName,
        categoryId: categoryIdFallback,
        computed: {
          finalPrice: priceBreakdown.finalPrice,
          sellerAsk: (priceBreakdown.cjCost ?? landedCost) + (priceBreakdown.yourProfit ?? 0),
        },
      });

      const newProduct = serverImportResult?.product;
      if (!newProduct?.id) {
        throw new Error('Server import completed without returning a product record');
      }

      if (!options?.silent) {
        alert(buildImportSuccessMessage(cjProduct.productNameEn, serverImportResult));
      }

      try {
        const variantIdsForSync = selectedVids.filter((vid) => String(vid || '').trim().length > 0);
        await invokeCjInventorySync({
          cj_product_ids: [String(cjProduct.pid)],
          cj_variant_ids: variantIdsForSync,
        });
      } catch (syncError) {
        console.warn('Post-import CJ inventory sync failed (non-blocking):', syncError);
      }

      // Remove from list
      setCjProducts(prev => prev.filter(p => p.pid !== cjProduct.pid));
    } catch (error: any) {
      console.error('Import failed:', error);
      if (!options?.silent) {
        alert(`❌ Import failed: ${error.message}`);
      }
      throw error;
    } finally {
      markImporting(cjProduct.pid, false);
    }
  };

  const runWithConcurrency = async <T,>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<void>
  ) => {
    const queue = [...items];
    const runners = Array.from({ length: Math.max(1, limit) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        await worker(item);
      }
    });
    await Promise.all(runners);
  };

  const importSelectedProducts = async () => {
    if (selectedProducts.size === 0 || batchImporting) return;
    setBatchImporting(true);
    const selectedList = cjProducts.filter(p => selectedProducts.has(p.pid));
    let successCount = 0;
    let failCount = 0;
    await runWithConcurrency(selectedList, 3, async (product) => {
      try {
        await importProduct(product, { silent: true });
        successCount += 1;
      } catch {
        failCount += 1;
      }
    });
    setSelectedProducts(new Set());
    setBatchImporting(false);
    alert(`Batch import complete. Success: ${successCount}, Failed: ${failCount}`);
  };

  const filteredProducts = cjProducts.filter(product => {
    const normalizedSearch = String(searchQuery || '').trim().toLowerCase();
    const matchesText =
      !normalizedSearch ||
      getProductSearchTokens(product).some((token) => token.includes(normalizedSearch));

    const pricing = pricingSettings[product.pid] || { markup: 3, affiliatePercent: 5 };
    const detailState = detailByPid[product.pid];
    const variants = detailState?.detail?.variants || [];
    const selectedVids = selectedVariantsByPid[product.pid] || [];
    const effectiveCjCost = resolveEffectiveCjCost(product.sellPrice, variants, selectedVids);
    const shippingOptionsSnapshot = getShippingOptionsSnapshot(detailState?.detail, variants, 0);
    const hasRecruiter = false;
    const landedCost = effectiveCjCost + (shippingOptionsSnapshot.length
      ? Math.min(...shippingOptionsSnapshot.map((option) => Number(option.cost || 0)).filter((value) => Number.isFinite(value) && value >= 0))
      : 0);
    const priceBreakdown = calculateBeezioPrice(
      landedCost,
      pricing.markup,
      pricing.affiliatePercent,
      hasRecruiter,
      { applyMinimums: false }
    );

    const minListing = parseMoney(minListingPrice);
    const maxListing = parseMoney(maxListingPrice);
    const minProfitValue = parseMoney(minProfit);
    const listing = priceBreakdown.finalPrice;
    const profit = priceBreakdown.yourProfit;
    const usaShippingOptions = getUsaShippingOptions(detailState?.detail, variants, 0);
    const hasUsaShipping = productHasUsaShippingFlag(product) || usaShippingOptions.length > 0;
    const freeShipping = productHasFreeShippingFlag(product) || hasFreeShippingOption(detailState?.detail, variants, 0);
    const qualitySignals =
      (Number(product.listedNum || 0) >= 25 ? 1 : 0) +
      (Number(product.totalVerifiedInventory || 0) > 0 || Number(product.warehouseInventoryNum || 0) > 0 ? 1 : 0) +
      (getImageCandidates(product, detailState?.detail).length >= 3 ? 1 : 0) +
      ((product.hasVideo || getVideoCandidates(detailState?.detail, variants).length > 0) ? 1 : 0) +
      (shippingOptionsSnapshot.some((option) => Boolean(option.tracking_supported)) ? 1 : 0);

    if (minListing > 0 && listing < minListing) return false;
    if (maxListing > 0 && listing > maxListing) return false;
    if (minProfitValue > 0 && profit < minProfitValue) return false;
    if (usaShippingOnly && !hasUsaShipping) return false;
    if (freeShippingOnly && !freeShipping) return false;
    if (highQualityOnly && qualitySignals < 2) return false;

    return matchesText;
  });

  const sortedProducts = (() => {
    const sorted = [...filteredProducts];
    sorted.sort((a, b) => {
      const pricingA = pricingSettings[a.pid] || { markup: 3, affiliatePercent: 5 };
      const pricingB = pricingSettings[b.pid] || { markup: 3, affiliatePercent: 5 };

      const detailA = detailByPid[a.pid]?.detail;
      const detailB = detailByPid[b.pid]?.detail;

      const variantsA = detailA?.variants || [];
      const variantsB = detailB?.variants || [];

      const selectedA = selectedVariantsByPid[a.pid]?.[0];
      const selectedB = selectedVariantsByPid[b.pid]?.[0];

      const variantA = selectedA ? variantsA.find(v => String(v?.vid) === String(selectedA)) : null;
      const variantB = selectedB ? variantsB.find(v => String(v?.vid) === String(selectedB)) : null;

      const costA = resolveEffectiveCjCost(a.sellPrice, variantsA, selectedVariantsByPid[a.pid] || []);
      const costB = resolveEffectiveCjCost(b.sellPrice, variantsB, selectedVariantsByPid[b.pid] || []);
      const shippingA = getShippingOptionsSnapshot(detailA, variantsA, 0);
      const shippingB = getShippingOptionsSnapshot(detailB, variantsB, 0);

      const costWithShippingA = costA + (shippingA.length
        ? Math.min(...shippingA.map((option) => Number(option.cost || 0)).filter((value) => Number.isFinite(value) && value >= 0))
        : 0);
      const costWithShippingB = costB + (shippingB.length
        ? Math.min(...shippingB.map((option) => Number(option.cost || 0)).filter((value) => Number.isFinite(value) && value >= 0))
        : 0);
      const priceA = calculateBeezioPrice(costWithShippingA, pricingA.markup, pricingA.affiliatePercent, false, { applyMinimums: false }).finalPrice;
      const priceB = calculateBeezioPrice(costWithShippingB, pricingB.markup, pricingB.affiliatePercent, false, { applyMinimums: false }).finalPrice;

      if (sortBy === 'listing-high') return priceB - priceA;
      if (sortBy === 'listing-low') return priceA - priceB;
      if (sortBy === 'newest') {
        const aTime = Date.parse(String(a.createdAt || ''));
        const bTime = Date.parse(String(b.createdAt || ''));
        const aValid = Number.isFinite(aTime) ? aTime : 0;
        const bValid = Number.isFinite(bTime) ? bTime : 0;
        return bValid - aValid;
      }

      const usaShippingA = productHasUsaShippingFlag(a) ? [{ cost: 0, tracking_supported: true }] : getUsaShippingOptions(detailA, variantsA, 0);
      const usaShippingB = productHasUsaShippingFlag(b) ? [{ cost: 0, tracking_supported: true }] : getUsaShippingOptions(detailB, variantsB, 0);
      const scoreA = getBestImportScore(a, detailA, selectedVariantsByPid[a.pid] || [], shippingA, usaShippingA);
      const scoreB = getBestImportScore(b, detailB, selectedVariantsByPid[b.pid] || [], shippingB, usaShippingB);
      return scoreB - scoreA;
    });
    return sorted;
  })();

  const handleCategoryChange = (nextCategory: string) => {
    setSelectedCategory(nextCategory);
    setCurrentPage(1);
    void loadProducts(1, nextCategory, pageSize, showImportedProducts);
  };

  const handlePageChange = (nextPage: number) => {
    const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
    const boundedPage = Math.max(1, Math.min(totalPages, nextPage));
    setCurrentPage(boundedPage);
    void loadProducts(boundedPage, selectedCategory, pageSize, showImportedProducts);
  };

  useEffect(() => {
    if (sortedProducts.length === 0) return;
    const visibleProducts = sortedProducts.slice(0, 12);
    for (const product of visibleProducts) {
      const variants = detailByPid[product.pid]?.detail?.variants || [];
      const selectedVids = resolveSelectedVids(product.pid, variants);
      const primaryVid = selectedVids[0] || '';
      const key = inventoryKey(product.pid, primaryVid || undefined);
      const totalKey = inventoryKey(product.pid);
      const hasVariantInventory = Boolean(inventoryByKey[key]);
      const hasTotalInventory = Boolean(inventoryByKey[totalKey]);

      if (!hasTotalInventory) {
        void ensureCJInventory(product.pid);
      }
      if (hasVariantInventory) continue;

      const selectedVariantStocks = selectedVids
        .map((vid) => {
          const stock = variants.find((v) => String(v?.vid) === String(vid))?.variantStock;
          return Number.isFinite(stock) && Number(stock) >= 0 ? Number(stock) : null;
        })
        .filter((stock): stock is number => typeof stock === 'number');

      const hasDetailFallback = selectedVariantStocks.length > 0;
      if (hasDetailFallback) continue;

      void ensureCJInventory(product.pid, primaryVid || undefined);
    }
  }, [sortedProducts, detailByPid, selectedVariantsByPid, inventoryByKey]);

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

  return (
    <div className={embedded ? 'bg-transparent' : 'min-h-screen bg-gray-50'}>
      {/* Header */}
      {!embedded && (
        <div className="bg-[#101820] text-white py-6">
          <div className="max-w-7xl mx-auto px-4">
            <h1 className="text-3xl font-bold mb-2">CJ Dropshipping Import</h1>
            <p className="text-gray-300">Browse and import products from CJ Dropshipping catalog</p>
          </div>
        </div>
      )}

      <div className={embedded ? 'max-w-7xl mx-auto px-0 py-4' : 'max-w-7xl mx-auto px-4 py-8'}>
        {embedded && (
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">CJ Dropshipping Import</h2>
            <p className="text-sm text-gray-600">Browse and import CJ products with pricing controls.</p>
          </div>
        )}
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-6 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            {/* Search */}
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search SKU, SPU, PID, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  setCurrentPage(1);
                  void loadProducts(1, selectedCategory, pageSize, showImportedProducts);
                }}
                className="w-full min-w-0 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
              />
            </div>

             {/* Category Filter */}
             <div className="flex flex-col gap-2 min-w-0 sm:flex-row md:col-span-2">
               <select
                 value={selectedCategory}
                 onChange={(e) => handleCategoryChange(e.target.value)}
                 className="flex-1 min-w-0 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
               >
                 <option value="">All Categories</option>
                 {categories.map(cat => (
                   <option key={cat.id} value={cat.id}>{cat.name}</option>
                 ))}
               </select>
               <button
                 onClick={async () => {
                   await loadCategories(true);
                   await loadProducts(1, selectedCategory, pageSize, showImportedProducts);
                 }}
                 disabled={loading}
                 className="shrink-0 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                 title="Load categories and products"
               >
                 Load
               </button>
             </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Min Listing Price</label>
              <input
                type="text"
                value={minListingPrice}
                onChange={(e) => setMinListingPrice(e.target.value)}
                placeholder="e.g. 49.99"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Max Listing Price</label>
              <input
                type="text"
                value={maxListingPrice}
                onChange={(e) => setMaxListingPrice(e.target.value)}
                placeholder="e.g. 199.99"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1">Min Profit</label>
              <input
                type="text"
                value={minProfit}
                onChange={(e) => setMinProfit(e.target.value)}
                placeholder="e.g. 15"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 min-w-0">
            <button
              onClick={() => { void loadProducts(currentPage, selectedCategory, pageSize, showImportedProducts); }}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-[#101820] text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <div className="flex w-full min-w-0 items-center gap-2 text-sm text-gray-600 sm:w-auto">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'best-import' | 'listing-high' | 'listing-low' | 'newest')}
                className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm sm:flex-none"
              >
                <option value="best-import">Best Import</option>
                <option value="newest">Newest</option>
                <option value="listing-high">Listing Price: High → Low</option>
                <option value="listing-low">Listing Price: Low → High</option>
              </select>
            </div>

            <div className="flex w-full min-w-0 items-center gap-2 text-sm text-gray-600 sm:w-auto">
              <span>Page size:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const next = Number(e.target.value) === 100 ? 100 : 50;
                  setPageSize(next);
                  setCurrentPage(1);
                  void loadProducts(1, selectedCategory, next, showImportedProducts);
                }}
                className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm sm:flex-none"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={usaShippingOnly}
                onChange={(e) => setUsaShippingOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
              />
              USA shipping only
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={freeShippingOnly}
                onChange={(e) => setFreeShippingOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
              />
              Free shipping only
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={highQualityOnly}
                onChange={(e) => setHighQualityOnly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
              />
              High quality only
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showImportedProducts}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowImportedProducts(checked);
                  setCurrentPage(1);
                  void loadProducts(1, selectedCategory, pageSize, checked);
                }}
                className="h-4 w-4 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
              />
              Show already imported
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={globalMatchAffiliateToMarkup}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setGlobalMatchAffiliateToMarkup(checked);
                  if (checked) {
                    setPricingSettings(prev => {
                      const next: typeof prev = {};
                      Object.entries(prev).forEach(([pid, pricing]) => {
                        next[pid] = { ...pricing, affiliatePercent: pricing.markup };
                      });
                      return next;
                    });
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
              />
              Match affiliate % to markup (global)
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={autoLoadVariants}
                onChange={(e) => setAutoLoadVariants(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
              />
              Auto-load variants
            </label>
          </div>
          
          {/* Debug Test Button */}
          <div className="mt-4 flex flex-col gap-4 min-w-0 lg:flex-row">
            <button
              onClick={testCJAPI}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              🔍 Test CJ API
            </button>
            {debugInfo && (
              <div className="flex-1 min-w-0">
                <pre className="text-xs bg-gray-100 p-3 rounded max-h-40 overflow-auto">
                  {debugInfo}
                </pre>
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{sortedProducts.length}</span> sourceable products.
            {(usaShippingOnly || freeShippingOnly || highQualityOnly) && (
              <span>
                {' '}
                Active filters:
                {usaShippingOnly ? ' USA shipping' : ''}
                {freeShippingOnly ? ' free shipping' : ''}
                {highQualityOnly ? ' high quality' : ''}
              </span>
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
                  onClick={() => { void loadProducts(currentPage, selectedCategory, pageSize, showImportedProducts); }}
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
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Products Found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery ? 'Try adjusting your search or filters' : 'Click Refresh to load products from CJ Dropshipping'}
            </p>
            <button
              onClick={() => { void loadProducts(currentPage, selectedCategory, pageSize, showImportedProducts); }}
              className="inline-flex items-center gap-2 px-6 py-2 bg-[#101820] text-white rounded-lg hover:bg-gray-800"
            >
              <RefreshCw className="w-5 h-5" />
              Load Products
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 min-w-0">
              <div className="text-sm text-gray-600">
                Showing <span className="font-semibold">{sortedProducts.length}</span> products (page {currentPage}, total {totalProducts})
              </div>
              <div className="flex flex-wrap gap-2 min-w-0">
                <button
                  onClick={() => setSelectedProducts(new Set(sortedProducts.map(p => p.pid)))}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Select All
                </button>
                <button
                  onClick={() => {
                    setSelectedProducts(new Set(sortedProducts.map(p => p.pid)));
                    setTimeout(() => {
                      void importSelectedProducts();
                    }, 0);
                  }}
                  disabled={batchImporting || sortedProducts.length === 0}
                  className="px-3 py-2 text-sm bg-amber-100 text-amber-900 rounded-lg hover:bg-amber-200 disabled:opacity-50"
                >
                  Import All Filtered
                </button>
                <button
                  onClick={() => setSelectedProducts(new Set())}
                  className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Clear
                </button>
                <button
                  onClick={importSelectedProducts}
                  disabled={batchImporting || selectedProducts.size === 0}
                  className="px-4 py-2 text-sm bg-[#ffcb05] text-[#101820] font-semibold rounded-lg hover:bg-[#e0b000] disabled:opacity-50"
                >
                  {batchImporting ? 'Importing…' : `Import Selected (${selectedProducts.size})`}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {sortedProducts.map(product => {
                const pricing = pricingSettings[product.pid] || { markup: 3, affiliatePercent: 5 };
                const detailState = detailByPid[product.pid];
                const variants = detailState?.detail?.variants || [];
                const selectedVids = resolveSelectedVids(product.pid, variants);
                const primaryVid = selectedVids[0] || '';
                const selectedVariant = primaryVid ? variants.find(v => String(v?.vid) === String(primaryVid)) : null;
                const invKey = inventoryKey(product.pid, selectedVariant?.vid || undefined);
                const invState = inventoryByKey[invKey];
                const productInvState = inventoryByKey[inventoryKey(product.pid)];
                const activeInvState = invState || productInvState;
                const selectedVariantStocks = selectedVids
                  .map((vid) => {
                    const stock = variants.find((v) => String(v?.vid) === String(vid))?.variantStock;
                    return Number.isFinite(stock) && Number(stock) >= 0 ? Number(stock) : null;
                  })
                  .filter((stock): stock is number => typeof stock === 'number');
                const detailFallbackStock = selectedVariantStocks.length > 0
                  ? selectedVariantStocks.reduce((acc, stock) => acc + stock, 0)
                  : null;
                const selectedLiveStock = typeof invState?.stock === 'number' ? invState.stock : null;
                const totalLiveStock = typeof productInvState?.stock === 'number' ? productInvState.stock : null;
                const liveStock = selectedLiveStock ?? totalLiveStock;
                const displayStock = liveStock ?? detailFallbackStock;
                const isOutOfStock = typeof displayStock === 'number' && displayStock <= 0;

                const effectiveCjCost = resolveEffectiveCjCost(product.sellPrice, variants, selectedVids);
                const shippingOptionsSnapshot = getShippingOptionsSnapshot(detailState?.detail, variants, 0);
                const usaShippingOptions = productHasUsaShippingFlag(product)
                  ? [{ cost: 0, tracking_supported: true }]
                  : getUsaShippingOptions(detailState?.detail, variants, 0);
                const freeShipping = productHasFreeShippingFlag(product) || shippingOptionsSnapshot.some((option) => Number(option.cost || 0) <= 0);
                const cheapestShipping = shippingOptionsSnapshot.length
                  ? Math.min(...shippingOptionsSnapshot.map((option) => Number(option.cost || 0)).filter((value) => Number.isFinite(value) && value >= 0))
                  : 0;
                const landedCost = effectiveCjCost + (Number.isFinite(cheapestShipping) ? cheapestShipping : 0);
                const hasRecruiter = false;
                const bestImportScore = getBestImportScore(product, detailState?.detail, selectedVids, shippingOptionsSnapshot, usaShippingOptions);
                const priceBreakdown = calculateBeezioPrice(
                  landedCost,
                  pricing.markup,
                  pricing.affiliatePercent,
                  hasRecruiter,
                  { applyMinimums: false }
                );

                return (
                  <div key={product.pid} className="min-w-0 bg-white rounded-lg shadow-sm overflow-hidden">
                    {/* Product Image */}
                    <div className="aspect-square bg-gray-100 relative">
                      <div className="absolute p-2">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.pid)}
                          onChange={(e) => {
                            setSelectedProducts(prev => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(product.pid);
                              else next.delete(product.pid);
                              return next;
                            });
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
                        />
                      </div>
                      <img
                        src={
                          getImageCandidates(product, detailState?.detail)[imageIndexByPid[product.pid] || 0] ||
                          normalizeImageUrl(product.productImage)
                        }
                        alt={product.productNameEn}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => {
                          const candidates = getImageCandidates(product, detailState?.detail);
                          setImageIndexByPid(prev => {
                            const current = prev[product.pid] || 0;
                            const nextIndex = current + 1;
                            if (nextIndex >= candidates.length) return prev;
                            return { ...prev, [product.pid]: nextIndex };
                          });
                        }}
                      />
                    </div>

                    {/* Product Info */}
                    <div className="min-w-0 p-4">
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                        {product.productNameEn}
                      </h3>
                      <p className="mb-2 break-all text-sm text-gray-500">
                        SKU/SPU: {product.productSku}{product.productSpu && product.productSpu !== product.productSku ? ` / ${product.productSpu}` : ''}
                      </p>
                      <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
                        {usaShippingOptions.length > 0 && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-800">USA shipping</span>
                        )}
                        {freeShipping && (
                          <span className="rounded-full bg-blue-100 px-2 py-1 font-medium text-blue-800">Free shipping</span>
                        )}
                        {Number(product.listedNum || 0) >= 25 && (
                          <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900">
                            {product.listedNum} listed
                          </span>
                        )}
                        {(Number(product.totalVerifiedInventory || 0) > 0 || Number(product.warehouseInventoryNum || 0) > 0) && (
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                            Stock {product.totalVerifiedInventory || product.warehouseInventoryNum}
                          </span>
                        )}
                        <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
                          Score {Math.round(bestImportScore)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">{product.categoryName}</p>

                      {/* Pricing Controls */}
                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Listing Price:</span>
                          <span className="font-bold text-[#101820]">${priceBreakdown.finalPrice.toFixed(2)}</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Shipping:</span>
                          <span className="text-gray-700 text-xs">Included in listing price</span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Dropship Total (unit + cheapest ship):</span>
                          <span className="font-semibold text-gray-900">${landedCost.toFixed(2)}</span>
                        </div>

                        <div className="bg-blue-50 rounded p-2 space-y-1 text-[11px] border border-blue-100">
                          <p className="font-semibold text-blue-900">Shipping Methods</p>
                          {shippingOptionsSnapshot.slice(0, 3).map((option, idx) => (
                            <div key={`${product.pid}-ship-${idx}`} className="flex items-start justify-between gap-3 text-blue-900">
                              <span className="truncate">
                                {option.name}
                                {option.tracking_supported ? ' · tracking' : ''}
                                {option.estimated_days ? ` · ${option.estimated_days}` : ''}
                              </span>
                              <span className="font-semibold">${Number(option.cost || 0).toFixed(2)}</span>
                            </div>
                          ))}
                          {shippingOptionsSnapshot.length > 3 && (
                            <p className="text-blue-800">+{shippingOptionsSnapshot.length - 3} more methods</p>
                          )}
                          <p className="text-blue-800">Tracking numbers are generated by CJ after order fulfillment.</p>
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
                            <div className="min-w-0 border border-gray-200 rounded max-h-32 overflow-y-auto p-2 bg-gray-50">
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
                                <div key={v.vid} className="flex min-w-0 items-start gap-2 mb-1 last:mb-0">
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
                                  <div className="min-w-0 break-words text-xs text-gray-600 leading-tight">
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
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs text-gray-600">Inventory</label>
                            <button
                              type="button"
                              onClick={() => {
                                void ensureCJInventory(product.pid, selectedVariant?.vid || undefined);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Refresh Live
                            </button>
                          </div>
                          {activeInvState?.loading ? (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <RefreshCw className="w-3 h-3 animate-spin" /> Loading live inventory...
                            </div>
                          ) : typeof displayStock === 'number' ? (
                            <div className="space-y-1">
                              <p className={`text-xs font-medium ${displayStock > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {displayStock > 0 ? `${displayStock} in stock` : 'Out of stock'}
                                {liveStock === null ? ' (from CJ variant details)' : ''}
                              </p>
                              {typeof totalLiveStock === 'number' && (
                                <p className="text-[11px] text-gray-600">
                                  Live total inventory: <span className="font-semibold">{totalLiveStock}</span>
                                </p>
                              )}
                              {selectedVids.length > 1 && typeof selectedLiveStock === 'number' && (
                                <p className="text-[11px] text-gray-600">
                                  Selected variant inventory: <span className="font-semibold">{selectedLiveStock}</span>
                                </p>
                              )}
                            </div>
                          ) : activeInvState?.error ? (
                            <p className="text-xs text-amber-700">Live inventory temporarily unavailable. You can still import, and stock will sync automatically.</p>
                          ) : (
                            <p className="text-xs text-gray-500">Inventory not loaded yet. Click Refresh Live.</p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <label className="block text-xs text-gray-600">Beezio Category</label>
                            <button
                              type="button"
                              onClick={() => setShowCategoryOverrideByPid(prev => ({
                                ...prev,
                                [product.pid]: !prev[product.pid],
                              }))}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {showCategoryOverrideByPid[product.pid] ? 'Hide' : 'Change'}
                            </button>
                          </div>
                          {!showCategoryOverrideByPid[product.pid] ? (
                            <div className="mt-1 text-sm text-gray-700">
                              {beezioCategories.find(c => String(c.id) === String(beezioCategoryIdOverrides[product.pid] ?? mapCJCategoryToBeezio(product.categoryName)))?.name
                                || mapCJCategoryToBeezio(product.categoryName)}
                            </div>
                          ) : (
                            <>
                              <select
                                value={beezioCategoryIdOverrides[product.pid] ?? mapCJCategoryToBeezio(product.categoryName)}
                                onChange={(e) => updateBeezioCategoryId(product.pid, e.target.value)}
                                className="w-full min-w-0 mt-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
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
                            </>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Your Markup (%)</label>
                          <input
                            type="number"
                            value={pricing.markup}
                            onChange={(e) => updatePricing(product.pid, 'markup', parseFloat(e.target.value) || 0)}
                            className="w-full min-w-0 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
                            min="0"
                            step="0.1"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <label className="block text-xs text-gray-600">Partner Commission (%)</label>
                            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                              <input
                                type="checkbox"
                                checked={Boolean(matchAffiliateByPid[product.pid]) || globalMatchAffiliateToMarkup}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setMatchAffiliateByPid(prev => ({ ...prev, [product.pid]: checked }));
                                  if (checked) {
                                    updatePricing(product.pid, 'affiliatePercent', pricing.markup);
                                  }
                                }}
                                disabled={globalMatchAffiliateToMarkup}
                                className="h-3 w-3 rounded border-gray-300 text-[#ffcb05] focus:ring-[#ffcb05]"
                              />
                              Match markup
                            </label>
                          </div>
                            <input
                              type="number"
                              value={pricing.affiliatePercent}
                              onChange={(e) => updatePricing(product.pid, 'affiliatePercent', parseFloat(e.target.value) || 0)}
                              disabled={globalMatchAffiliateToMarkup || matchAffiliateByPid[product.pid]}
                              className="w-full min-w-0 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-[#ffcb05] focus:border-transparent"
                              min="0"
                              max="100"
                              step="0.1"
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
                            <span className="text-gray-600">Partner Commission:</span>
                            <span className="font-medium">${priceBreakdown.affiliateCommission.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Beezio Fee:</span>
                            <span className="font-medium">${priceBreakdown.beezioFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Processing Fee:</span>
                            <span className="font-medium">${priceBreakdown.processingFee.toFixed(2)}</span>
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
                        disabled={importing.has(product.pid) || isOutOfStock}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#ffcb05] text-[#101820] font-semibold rounded-lg hover:bg-[#e0b000] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {importing.has(product.pid) ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Importing...
                          </>
                        ) : isOutOfStock ? (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            Out of Stock
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
            {totalProducts > pageSize && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 bg-white border border-gray-300 rounded-lg">
                  Page {currentPage} of {Math.ceil(totalProducts / pageSize)}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= Math.ceil(totalProducts / pageSize)}
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
