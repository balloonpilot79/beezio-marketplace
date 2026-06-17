import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Truck,
  Video,
} from 'lucide-react';
import {
  extractCJIdentifierFromSearchQuery,
  getCJCategories,
  getCJProductDetail,
  getCJProducts,
  mapCJCategoryToBeezio,
} from '../services/cjDropshipping';
import { supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';

type CJCategory = { id: string; name: string; parentId?: string };
type RegionFilter = 'usa-only' | 'usa-first' | 'all';
type CatalogSort = 'featured' | 'price-low' | 'price-high' | 'newest';
type CatalogViewMode = 'idle' | 'lookup' | 'catalog';
type PricingSetting = { markup: number; affiliateAmount: number; beezioFee: number; shippingCost: number };
type BeezioCategory = { id: string; name: string };

type CatalogProduct = {
  pid: string;
  productNameEn: string;
  productSku: string;
  productSpu?: string;
  productImage: string;
  categoryName: string;
  categoryId: string;
  sellPrice: number;
  shippingCountryCodes?: string[];
  isFreeShipping?: boolean;
  listedNum?: number;
  hasVideo?: boolean;
  fastestDeliveryDays?: number | null;
};

type CatalogDetail = Awaited<ReturnType<typeof getCJProductDetail>>;
type ShippingSignals = {
  isUsShippable: boolean;
  isFreeShipping: boolean;
  shippingCountryCodes: string[];
  hasVideo: boolean;
  fastestDeliveryDays: number | null;
};

interface CJAdminCatalogPageProps {
  embedded?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 50;
const INITIAL_TARGET = 200;
const MAX_INITIAL_PAGES = 12;
const LOAD_MORE_TARGET = 50;
const MAX_INCREMENTAL_PAGES = 6;
const SHIPPING_ENRICH_LIMIT_INITIAL = 24;
const SHIPPING_ENRICH_LIMIT_INCREMENTAL = 12;
const SHIPPING_ENRICH_CONCURRENCY = 4;
const DEFAULT_PRICING: PricingSetting = { markup: 3, affiliateAmount: 1, beezioFee: 1, shippingCost: 0 };
const INFLUENCER_BONUS_THRESHOLD = 20;
const INFLUENCER_BONUS_UNDER_THRESHOLD = 0.5;
const INFLUENCER_BONUS_AT_OR_ABOVE_THRESHOLD = 1;
const DEFAULT_BEEZIO_CATEGORIES: BeezioCategory[] = [
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

const normalizeCountryCode = (value: unknown): string => String(value || '').trim().toUpperCase();
const looksLikeUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value.trim());

const looksUsBased = (value: unknown): boolean => {
  const normalized = normalizeCountryCode(value);
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

const isUsShippable = (product: CatalogProduct): boolean =>
  Array.isArray(product.shippingCountryCodes) &&
  product.shippingCountryCodes.some((code) => looksUsBased(code));

const getProductSignals = (product: CatalogProduct): ShippingSignals => ({
  isUsShippable: isUsShippable(product),
  isFreeShipping: product.isFreeShipping === true,
  shippingCountryCodes: (product.shippingCountryCodes || []).map(normalizeCountryCode).filter(Boolean),
  hasVideo: product.hasVideo === true,
  fastestDeliveryDays: null,
});

const parseEstimatedDaysUpperBound = (value: unknown): number | null => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;

  const numericMatches = raw.match(/\d+(?:\.\d+)?/g) || [];
  const values = numericMatches
    .map((token) => Number(token))
    .filter((num) => Number.isFinite(num) && num > 0);

  if (!values.length) return null;
  return Math.ceil(Math.max(...values));
};

const deriveShippingSignals = (detail: CatalogDetail): ShippingSignals => {
  const rawCountryCodes = [
    ...(Array.isArray(detail?.shippingCountryCodes) ? detail.shippingCountryCodes : []),
    (detail as any)?.shipFrom,
    (detail as any)?.originCountry,
    (detail as any)?.warehouseName,
  ]
    .map(normalizeCountryCode)
    .filter(Boolean);

  const options = [
    ...(Array.isArray((detail as any)?.shippingOptions) ? (detail as any).shippingOptions : []),
    ...(Array.isArray((detail as any)?.shippingList) ? (detail as any).shippingList : []),
    ...(Array.isArray((detail as any)?.logisticList) ? (detail as any).logisticList : []),
    ...(Array.isArray((detail as any)?.logistics) ? (detail as any).logistics : []),
  ];

  const optionText = options
    .map((option) =>
      [
        option?.shippingCountryCode,
        option?.countryCode,
        option?.country,
        option?.shipToCountry,
        option?.shipFrom,
        option?.warehouseName,
        option?.name,
        option?.logisticName,
        option?.routeName,
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' ')
    )
    .join(' | ');

  const countryCodes = Array.from(new Set(rawCountryCodes));
  const freeShipping =
    detail?.isFreeShipping === true ||
    options.some((option) => {
      const price = Number(option?.cost ?? option?.price ?? option?.shipping_price ?? option?.shippingPrice);
      return Number.isFinite(price) && price <= 0;
    });

  return {
    isUsShippable: countryCodes.some(looksUsBased) || looksUsBased(optionText),
    isFreeShipping: freeShipping,
    shippingCountryCodes: countryCodes,
    hasVideo: detail?.hasVideo === true,
    fastestDeliveryDays: options.reduce<number | null>((fastest, option) => {
      const estimated = parseEstimatedDaysUpperBound(
        option?.logisticAging ??
          option?.deliveryTime ??
          option?.aging ??
          option?.estimatedDays ??
          option?.deliveryDays
      );
      if (estimated === null) return fastest;
      if (fastest === null) return estimated;
      return Math.min(fastest, estimated);
    }, null),
  };
};

const sortCatalog = (items: CatalogProduct[], regionFilter: RegionFilter): CatalogProduct[] =>
  [...items].sort((left, right) => {
    const leftUs = isUsShippable(left) ? 1 : 0;
    const rightUs = isUsShippable(right) ? 1 : 0;

    if (regionFilter !== 'all' && leftUs !== rightUs) {
      return rightUs - leftUs;
    }

    const leftFree = left.isFreeShipping ? 1 : 0;
    const rightFree = right.isFreeShipping ? 1 : 0;
    if (leftFree !== rightFree) {
      return rightFree - leftFree;
    }

    const leftListed = Number(left.listedNum || 0);
    const rightListed = Number(right.listedNum || 0);
    if (leftListed !== rightListed) {
      return rightListed - leftListed;
    }

    return String(left.productNameEn || '').localeCompare(String(right.productNameEn || ''));
  });

const filterCatalog = (
  items: CatalogProduct[],
  regionFilter: RegionFilter,
  options?: { preserveSearchResults?: boolean }
): CatalogProduct[] => {
  if (options?.preserveSearchResults) return sortCatalog(items, regionFilter);
  return regionFilter === 'usa-only' ? items.filter(isUsShippable) : sortCatalog(items, regionFilter);
};

const compareFeaturedCatalogItems = (left: CatalogProduct, right: CatalogProduct, regionFilter: RegionFilter): number => {
  const [winner] = sortCatalog([left, right], regionFilter);
  return winner?.pid === left.pid ? -1 : 1;
};

const dedupeProducts = (items: CatalogProduct[]): CatalogProduct[] => {
  const seen = new Set<string>();
  const output: CatalogProduct[] = [];

  for (const item of items) {
    const key = String(item.pid || item.productSku || item.productSpu || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
};

const parseMoney = (value: unknown): number => {
  const raw = String(value ?? '').replace(/[^0-9.-]/g, '').trim();
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapDetailToCatalogProduct = (detail: CatalogDetail): CatalogProduct => ({
  pid: String(detail?.pid || '').trim(),
  productNameEn: String(detail?.productNameEn || '').trim(),
  productSku: String((detail as any)?.productSku || '').trim(),
  productSpu: String((detail as any)?.productSpu || '').trim() || undefined,
  productImage: String(detail?.productImage || '').trim(),
  categoryName: String(detail?.categoryName || 'Uncategorized').trim(),
  categoryId: String(detail?.categoryId || '').trim(),
  sellPrice: Number(detail?.sellPrice || 0),
  shippingCountryCodes: Array.isArray((detail as any)?.shippingCountryCodes) ? (detail as any).shippingCountryCodes : [],
  isFreeShipping: detail?.isFreeShipping === true,
  listedNum: Number((detail as any)?.listedNum || 0),
  hasVideo: detail?.hasVideo === true,
});

const formatCjActionError = (value: unknown): string => {
  const message = String(value || '').trim();
  if (!message) return 'CJ is temporarily unavailable. Please wait a moment and try again.';

  const retryAfterMatch = message.match(/retry after\s*~?\s*(\d+)\s*s/i);
  const retryAfterSeconds = retryAfterMatch ? Number(retryAfterMatch[1]) : null;
  const retryAfterMinutes =
    retryAfterSeconds && Number.isFinite(retryAfterSeconds) ? Math.max(1, Math.ceil(retryAfterSeconds / 60)) : null;

  if (/429|rate limit|too many requests|qps limit/i.test(message)) {
    if (retryAfterMinutes) {
      return `CJ is rate limiting requests right now. Wait about ${retryAfterMinutes} minute${retryAfterMinutes === 1 ? '' : 's'} and try again.`;
    }
    return 'CJ is rate limiting requests right now. Wait a moment and try again.';
  }

  if (/timed out/i.test(message)) {
    return 'CJ did not respond in time. Try again in a moment.';
  }

  return message.replace(/^Edge function \d+:\s*/i, '');
};

const formatCjDescription = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return 'No description returned by CJ for this item.';

  if (typeof window === 'undefined') {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'No description returned by CJ for this item.';
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/html');
    const text = String(doc.body?.textContent || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text || 'No description returned by CJ for this item.';
  } catch {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || 'No description returned by CJ for this item.';
  }
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

const getVideoCandidates = (detail: CatalogDetail | null, variants: any[] = []): string[] => {
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
  const output: string[] = [];
  for (const candidate of raw) {
    const normalized = normalizeVideoUrl(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= 12) break;
  }

  return output;
};

const getShippingOptionsSnapshot = (detail: CatalogDetail | null, variants: any[] = [], fallbackShippingCost: number) => {
  const rows = [
    ...(Array.isArray((detail as any)?.logisticList) ? (detail as any).logisticList : []),
    ...(Array.isArray((detail as any)?.shippingList) ? (detail as any).shippingList : []),
    ...(Array.isArray((detail as any)?.shippingOptions) ? (detail as any).shippingOptions : []),
    ...(Array.isArray((detail as any)?.logistics) ? (detail as any).logistics : []),
    ...(Array.isArray((detail as any)?.data?.logisticList) ? (detail as any).data.logisticList : []),
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

  const seen = new Set<string>();
  const output: Array<{
    name: string;
    cost: number;
    estimated_days: string;
    origin_country?: string;
    origin_label?: string;
    tracking_supported?: boolean;
  }> = [];

  for (const row of rows) {
    const name = String(
      (row as any)?.logisticName ??
        (row as any)?.logisticsName ??
        (row as any)?.shippingMethod ??
        (row as any)?.methodName ??
        (row as any)?.name ??
        ''
    ).trim();
    if (!name) continue;

    const cost = normalizeShippingCost(
      (row as any)?.logisticPrice ??
        (row as any)?.shippingFee ??
        (row as any)?.freight ??
        (row as any)?.price ??
        (row as any)?.cost
    );
    const estimatedDays =
      String(
        (row as any)?.logisticAging ??
          (row as any)?.deliveryTime ??
          (row as any)?.aging ??
          (row as any)?.estimatedDays ??
          (row as any)?.deliveryDays ??
          '5-12 business days'
      ).trim() || '5-12 business days';
    const originCountry = String(
      (row as any)?.originCountry ?? (row as any)?.country ?? (row as any)?.countryCode ?? (detail as any)?.originCountry ?? ''
    ).trim();
    const originLabel = String(
      (row as any)?.warehouseName ?? (row as any)?.warehouse ?? (row as any)?.shipFrom ?? (detail as any)?.warehouseName ?? ''
    ).trim();
    const trackingSupported =
      Boolean(
        (row as any)?.trackingAble ??
          (row as any)?.tracking_enabled ??
          (row as any)?.supportTracking ??
          (row as any)?.isTracking ??
          (row as any)?.hasTracking
      ) || /track/i.test(String((row as any)?.trackingInfo ?? (row as any)?.trackingDesc ?? (row as any)?.remark ?? ''));
    const key = `${name.toLowerCase()}::${estimatedDays.toLowerCase()}::${cost}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      name,
      cost,
      estimated_days: estimatedDays,
      ...(originCountry ? { origin_country: originCountry } : {}),
      ...(originLabel ? { origin_label: originLabel } : {}),
      ...(trackingSupported ? { tracking_supported: true } : {}),
    });
    if (output.length >= 8) break;
  }

  return output.length > 0
    ? output
    : [
        {
          name: 'CJ Shipping',
          cost: Math.max(0, fallbackShippingCost),
          estimated_days: '5-12 business days',
          tracking_supported: true,
        },
      ];
};

const getFastestShippingDays = (detail: CatalogDetail | null, variants: any[] = []): number | null => {
  const options = getShippingOptionsSnapshot(detail, variants, 0);
  return options.reduce<number | null>((fastest, option) => {
    const estimated = parseEstimatedDaysUpperBound(option?.estimated_days);
    if (estimated === null) return fastest;
    if (fastest === null) return estimated;
    return Math.min(fastest, estimated);
  }, null);
};

const resolveEffectiveCjCost = (fallbackSellPrice: number, variants: any[]): number => {
  const prices = variants
    .map((variant) => Number((variant as any)?.variantSellPrice))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (prices.length > 0) return Math.max(...prices);

  const fallback = Number(fallbackSellPrice);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
};

const resolveImportInventory = (detail: CatalogDetail | null, variants: any[]): number | null => {
  const variantInventory = Array.isArray(variants)
    ? variants.reduce((sum, variant) => {
        const candidate = Number((variant as any)?.variantStock ?? (variant as any)?.inventory ?? (variant as any)?.inventoryNum);
        if (!Number.isFinite(candidate) || candidate < 0) return sum;
        return sum + Math.floor(candidate);
      }, 0)
    : 0;

  if (variantInventory > 0) return variantInventory;

  const fallbackCandidates = [
    (detail as any)?.totalVerifiedInventory,
    (detail as any)?.totalInventory,
    (detail as any)?.inventory,
    (detail as any)?.inventoryNum,
    (detail as any)?.warehouseInventoryNum,
  ];

  for (const candidate of fallbackCandidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }

  return null;
};

const calculateAdminCjPricing = (landedCost: number, pricing: PricingSetting) => {
  const safeLandedCost = Number.isFinite(landedCost) && landedCost > 0 ? landedCost : 0;
  const markup = Number.isFinite(pricing.markup) && pricing.markup >= 0 ? pricing.markup : 0;
  const affiliateAmount = Number.isFinite(pricing.affiliateAmount) && pricing.affiliateAmount >= 0 ? pricing.affiliateAmount : 0;
  const sellerAsk = safeLandedCost + markup;
  const influencerBonusPerSlot = sellerAsk < INFLUENCER_BONUS_THRESHOLD ? INFLUENCER_BONUS_UNDER_THRESHOLD : INFLUENCER_BONUS_AT_OR_ABOVE_THRESHOLD;
  // Admin-owned CJ items reserve only the affiliate-side influencer slot.
  const influencerBonusPool = influencerBonusPerSlot;
  const defaultPlatformBase = Math.max((safeLandedCost + markup + affiliateAmount) * 0.10, 1);
  const baseBeezioFee = Number.isFinite(pricing.beezioFee) && pricing.beezioFee >= 0 ? pricing.beezioFee : defaultPlatformBase;
  const beezioFee = baseBeezioFee + influencerBonusPool;
  const processingPercent = 0.0399;
  const processingFixed = 0.6;
  const finalPrice = (sellerAsk + affiliateAmount + beezioFee + processingFixed) / (1 - processingPercent);
  const processingFee = finalPrice * processingPercent + processingFixed;

  return {
    cjCost: safeLandedCost,
    markup,
    sellerAsk,
    affiliateAmount,
    beezioFee,
    influencerBonusPool,
    processingFee,
    finalPrice,
    defaultPlatform: defaultPlatformBase + influencerBonusPool,
    baseBeezioFee,
  };
};

const CJAdminCatalogPage: React.FC<CJAdminCatalogPageProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<CJCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<CatalogViewMode>('idle');
  const [catalogReloadToken, setCatalogReloadToken] = useState(0);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('usa-only');
  const [sortBy, setSortBy] = useState<CatalogSort>('featured');
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [fastShippingOnly, setFastShippingOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState(1);
  const [selectedPid, setSelectedPid] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<CatalogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [shippingSignalsByPid, setShippingSignalsByPid] = useState<Record<string, ShippingSignals>>({});
  const [pricingSettings, setPricingSettings] = useState<Record<string, PricingSetting>>({});
  const [beezioCategories, setBeezioCategories] = useState<BeezioCategory[]>(DEFAULT_BEEZIO_CATEGORIES);
  const [beezioCategoryIdOverrides, setBeezioCategoryIdOverrides] = useState<Record<string, string>>({});
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [importingPid, setImportingPid] = useState('');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [lastImportAttemptPid, setLastImportAttemptPid] = useState<string>('');
  const enrichRunRef = useRef(0);

  const mergeSignalsIntoProducts = (items: CatalogProduct[], signalMap: Record<string, ShippingSignals>): CatalogProduct[] =>
    items.map((item) => {
      const signals = signalMap[item.pid];
      if (!signals) return item;
      return {
        ...item,
        shippingCountryCodes: signals.shippingCountryCodes.length > 0 ? signals.shippingCountryCodes : item.shippingCountryCodes,
        isFreeShipping: signals.isFreeShipping || item.isFreeShipping === true,
        hasVideo: signals.hasVideo || item.hasVideo === true,
        fastestDeliveryDays:
          typeof signals.fastestDeliveryDays === 'number' && Number.isFinite(signals.fastestDeliveryDays)
            ? signals.fastestDeliveryDays
            : (item as any).fastestDeliveryDays ?? null,
      };
    });

  const resolveBeezioCategoryOverride = (cjName: string, cjId?: string) => {
    const nameKey = String(cjName || '').trim().toLowerCase();
    const idKey = String(cjId || '').trim().toLowerCase();
    const fromMap =
      (nameKey && (categoryMap[`path:${nameKey}`] || categoryMap[`slug:${nameKey}`] || categoryMap[`name:${nameKey}`])) ||
      (idKey && (categoryMap[`path:${idKey}`] || categoryMap[`slug:${idKey}`] || categoryMap[`name:${idKey}`])) ||
      '';
    return fromMap || mapCJCategoryToBeezio(cjName);
  };

  const resolveCategoryId = async (categoryName: string): Promise<string | null> => {
    const normalized = String(categoryName || '').trim();
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
        // Non-fatal fallback. Some environments may not have a slug index yet.
      }

      if (looksLikeUuid(normalized)) {
        const { data: byId } = await supabase.from('categories').select('id').eq('id', normalized).limit(1).maybeSingle();
        if ((byId as any)?.id) return (byId as any).id as string;
      }

      const { data: byName } = await supabase.from('categories').select('id').ilike('name', normalized).limit(1).maybeSingle();
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
        // Non-fatal fallback. Some environments may not have the "other" slug row yet.
      }

      const { data: otherByName } = await supabase
        .from('categories')
        .select('id')
        .ilike('name', 'Other')
        .limit(1)
        .maybeSingle();
      return (otherByName as any)?.id ?? null;
    } catch {
      return null;
    }
  };

  const updatePricing = (pid: string, field: keyof PricingSetting, value: number) => {
    setPricingSettings((prev) => ({
      ...prev,
      [pid]: {
        ...(prev[pid] || DEFAULT_PRICING),
        [field]: Number.isFinite(value) ? Math.max(0, value) : 0,
      },
    }));
  };

  const updateBeezioCategoryId = (pid: string, value: string) => {
    setBeezioCategoryIdOverrides((prev) => ({ ...prev, [pid]: value }));
  };

  const invokeImportCJProduct = async (payload: any): Promise<any> => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('You must be signed in to import products');

    const response = await fetch(`${supabaseUrl}/functions/v1/import-cj-product`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const detail = parsed?.details || parsed?.error || text || `HTTP ${response.status}`;
      throw new Error(`Edge function ${response.status}: ${detail}`);
    }

    return parsed;
  };

  const buildImportSuccessMessage = (result: any, productId: string) => {
    return `Added to marketplace. Edit it later in the seller dashboard. Product id: ${productId}`;
  };

  const enrichShippingSignals = async (
    items: CatalogProduct[],
    targetVisibleCount: number,
    maxInspect: number
  ): Promise<Record<string, ShippingSignals>> => {
    if (regionFilter === 'all') return {};

    const knownSignals: Record<string, ShippingSignals> = {};
    items.forEach((item) => {
      const existing = shippingSignalsByPid[item.pid];
      if (existing) {
        knownSignals[item.pid] = existing;
      } else if (item.shippingCountryCodes?.length || item.isFreeShipping === true || item.hasVideo === true) {
        knownSignals[item.pid] = getProductSignals(item);
      }
    });

    const getVisibleCount = (signalMap: Record<string, ShippingSignals>) =>
      items.filter((item) => {
        const signals = signalMap[item.pid] || getProductSignals(item);
        return regionFilter === 'usa-only' ? signals.isUsShippable : true;
      }).length;

    const pending = items.filter((item) => !knownSignals[item.pid]).slice(0, maxInspect);
    if (pending.length === 0) return knownSignals;

    const workers = Array.from({ length: Math.min(SHIPPING_ENRICH_CONCURRENCY, pending.length) }, async (_, workerIndex) => {
      for (let index = workerIndex; index < pending.length; index += SHIPPING_ENRICH_CONCURRENCY) {
        if (getVisibleCount(knownSignals) >= targetVisibleCount) return;
        const item = pending[index];
        try {
          const detail = await getCJProductDetail(item.pid);
          knownSignals[item.pid] = deriveShippingSignals(detail);
        } catch {
          knownSignals[item.pid] = getProductSignals(item);
        }
      }
    });

    await Promise.all(workers);
    return knownSignals;
  };

  const runShippingEnrichment = async (items: CatalogProduct[], targetCount: number, maxInspect: number) => {
    const runId = enrichRunRef.current;
    try {
      const signalMap = await enrichShippingSignals(items, targetCount, maxInspect);
      if (enrichRunRef.current !== runId) return;
      setShippingSignalsByPid((prev) => ({ ...prev, ...signalMap }));
      setProducts((prev) => {
        const mergedItems = dedupeProducts([...items, ...prev]);
        return sortCatalog(mergeSignalsIntoProducts(mergedItems, signalMap), regionFilter);
      });
    } catch (shippingError) {
      console.warn('CJ shipping enrichment failed:', shippingError);
    }
  };

  const loadCatalog = async (options?: { reset?: boolean }) => {
    const reset = options?.reset !== false;
    const activeSearch = String(searchQuery || '').trim();
    const preserveSearchResults = activeSearch.length > 0;
    const pagesToTry = reset ? MAX_INITIAL_PAGES : MAX_INCREMENTAL_PAGES;
    const targetCount = reset ? INITIAL_TARGET : LOAD_MORE_TARGET;
    const startPage = reset ? 1 : nextPage;

    if (reset) {
      enrichRunRef.current += 1;
      setLoading(true);
      setProducts([]);
      setSelectedPid('');
      setSelectedDetail(null);
      setDetailError(null);
      setImportError(null);
      setImportFeedback(null);
    } else {
      setLoadingMore(true);
    }

    setError(null);

    try {
      const cjFilters =
        regionFilter === 'usa-only' || regionFilter === 'usa-first'
          ? { countryCode: 'US', productType: 'SUPPLIER_PRODUCT' }
          : undefined;

      let page = startPage;
      let attempts = 0;
      let merged = reset ? [] : [...products];

      while (attempts < pagesToTry) {
        const response = await getCJProducts(
          page,
          PAGE_SIZE,
          selectedCategoryId || undefined,
          true,
          activeSearch || undefined,
          cjFilters
        );
        const batch = dedupeProducts((response.products || []) as CatalogProduct[]);
        if (batch.length === 0) break;

        merged = dedupeProducts([...merged, ...batch]);
        const visibleCount = filterCatalog(merged, regionFilter, { preserveSearchResults }).length;
        attempts += 1;
        page += 1;

        if (visibleCount >= targetCount) break;
      }

      const visibleImmediately = sortCatalog(mergeSignalsIntoProducts(merged, shippingSignalsByPid), regionFilter);
      setProducts(visibleImmediately);
      setNextPage(page);
      void runShippingEnrichment(
        merged,
        targetCount,
        reset ? SHIPPING_ENRICH_LIMIT_INITIAL : SHIPPING_ENRICH_LIMIT_INCREMENTAL
      );
    } catch (fetchError: any) {
      setError(formatCjActionError(fetchError?.message || 'Unable to load CJ catalog.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadSingleProduct = async (value: string) => {
    const raw = String(value || '').trim();
    const identifier = extractCJIdentifierFromSearchQuery(raw);

    if (!identifier) {
      setError('Enter a CJ product URL, PID, SKU, or SPU to load one item.');
      return;
    }

    enrichRunRef.current += 1;
    setViewMode('lookup');
    setLoading(true);
    setProducts([]);
    setSelectedPid('');
    setSelectedDetail(null);
    setDetailError(null);
    setImportError(null);
    setImportFeedback(null);
    setLastImportAttemptPid('');
    setError(null);

    try {
      let detail: CatalogDetail | null = null;

      try {
        detail = await getCJProductDetail(identifier);
      } catch {
        const cjFilters =
          regionFilter === 'usa-only' || regionFilter === 'usa-first'
            ? { countryCode: 'US', productType: 'SUPPLIER_PRODUCT' }
            : undefined;
        const response = await getCJProducts(1, 1, selectedCategoryId || undefined, true, identifier, cjFilters);
        const matched = Array.isArray(response.products) ? response.products[0] : null;
        if (!matched?.pid) {
          throw new Error('CJ did not return a matching item for that URL.');
        }
        detail = await getCJProductDetail(matched.pid);
      }

      if (!detail?.pid) {
        throw new Error('CJ returned an incomplete item payload.');
      }

      const signals = deriveShippingSignals(detail);
      const singleProduct = mergeSignalsIntoProducts([mapDetailToCatalogProduct(detail)], { [detail.pid]: signals });
      setShippingSignalsByPid((prev) => ({ ...prev, [detail!.pid]: signals }));
      setProducts(sortCatalog(singleProduct, regionFilter));
      setSelectedPid(detail.pid);
      setSelectedDetail(detail);
      setNextPage(1);
    } catch (fetchError: any) {
      setProducts([]);
      setSelectedPid('');
      setSelectedDetail(null);
      setError(formatCjActionError(fetchError?.message || 'Unable to load the CJ item from that URL.'));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      try {
        setCategoriesLoading(true);
        const rows = await getCJCategories();
        if (!cancelled) setCategories(rows || []);
      } catch (categoryError) {
        console.warn('Failed to load CJ categories:', categoryError);
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    };

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBeezioMetadata = async () => {
      try {
        const [{ data: categoryRows, error: categoryError }, { data: mapRows }] = await Promise.all([
          supabase.from('categories').select('id, name'),
          supabase
            .from('category_map_cj_to_beezio')
            .select('cj_category_path,beezio_category_id,categories:beezio_category_id(id,name,slug)')
            .limit(1000),
        ]);

        if (!cancelled && !categoryError && Array.isArray(categoryRows) && categoryRows.length > 0) {
          const sorted = [...(categoryRows as BeezioCategory[])].sort((left, right) =>
            String(left?.name || '').localeCompare(String(right?.name || ''), undefined, { sensitivity: 'base' })
          );
          setBeezioCategories(sorted);
        }

        if (!cancelled && Array.isArray(mapRows)) {
          const nextMap: Record<string, string> = {};
          for (const row of mapRows as any[]) {
            const cjPath = String(row?.cj_category_path || '').trim().toLowerCase();
            const catId = String(row?.beezio_category_id || row?.categories?.id || '').trim();
            const catSlug = String(row?.categories?.slug || '').trim();
            const catName = String(row?.categories?.name || '').trim();
            if (cjPath && catId) nextMap[`path:${cjPath}`] = catId;
            if (cjPath && catSlug) nextMap[`slug:${cjPath}`] = catSlug;
            if (cjPath && catName) nextMap[`name:${cjPath}`] = catName;
          }
          setCategoryMap(nextMap);
        }
      } catch (metadataError) {
        console.warn('Failed to load Beezio category metadata:', metadataError);
      }
    };

    void loadBeezioMetadata();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (viewMode !== 'catalog') return;
    void loadCatalog({ reset: true });
  }, [catalogReloadToken, regionFilter, searchQuery, selectedCategoryId, viewMode]);

  useEffect(() => {
    if (products.length === 0) return;
    setPricingSettings((prev) => {
      const next = { ...prev };
      for (const product of products) {
                        if (!next[product.pid]) {
                          const estimatedLandedCost = Number(product.sellPrice || 0);
                          next[product.pid] = {
                            ...DEFAULT_PRICING,
                            beezioFee: Math.max((estimatedLandedCost + DEFAULT_PRICING.markup + DEFAULT_PRICING.affiliateAmount) * 0.10, 1),
                          };
                        }
      }
      return next;
    });
    setBeezioCategoryIdOverrides((prev) => {
      const next = { ...prev };
      for (const product of products) {
        if (!next[product.pid]) next[product.pid] = resolveBeezioCategoryOverride(product.categoryName, product.categoryId);
      }
      return next;
    });
  }, [products, categoryMap]);

  useEffect(() => {
    if (!selectedPid) return;
    let cancelled = false;

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        setImportError(null);
        setImportFeedback(null);
        const detail = await getCJProductDetail(selectedPid);
        if (!cancelled) {
          const signals = deriveShippingSignals(detail);
          setShippingSignalsByPid((prev) => ({ ...prev, [selectedPid]: signals }));
          setProducts((prev) =>
            sortCatalog(
              mergeSignalsIntoProducts(
                prev.map((item) =>
                  item.pid === selectedPid ? { ...item, fastestDeliveryDays: signals.fastestDeliveryDays ?? null } : item
                ),
                { [selectedPid]: signals }
              ),
              regionFilter
            )
          );
          setSelectedDetail(detail);
        }
      } catch (detailLoadError: any) {
        if (!cancelled) {
          setSelectedDetail(null);
          setDetailError(formatCjActionError(detailLoadError?.message || 'Unable to load CJ item detail.'));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedPid, regionFilter]);

  const visibleProducts = useMemo(() => {
    const base = filterCatalog(products, regionFilter, {
      preserveSearchResults: String(searchQuery || '').trim().length > 0,
    });
    const filtered = base.filter((product) => {
      if (freeShippingOnly && product.isFreeShipping !== true) return false;
      if (fastShippingOnly) {
        const fastest = Number((product as any).fastestDeliveryDays);
        if (!Number.isFinite(fastest) || fastest <= 0 || fastest > 7) return false;
      }
      return true;
    });

      return [...filtered].sort((left, right) => {
      if (sortBy === 'price-low') return Number(left.sellPrice || 0) - Number(right.sellPrice || 0);
      if (sortBy === 'price-high') return Number(right.sellPrice || 0) - Number(left.sellPrice || 0);
      if (sortBy === 'newest') {
        const leftTime = Date.parse(String(left.createdAt || ''));
        const rightTime = Date.parse(String(right.createdAt || ''));
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      }
      return compareFeaturedCatalogItems(left, right, regionFilter);
    });
  }, [fastShippingOnly, freeShippingOnly, products, regionFilter, searchQuery, sortBy]);
  const selectedProduct = useMemo(
    () =>
      visibleProducts.find((product) => product.pid === selectedPid) ||
      products.find((product) => product.pid === selectedPid) ||
      null,
    [products, selectedPid, visibleProducts]
  );
  const selectedPricing = selectedPid ? pricingSettings[selectedPid] || DEFAULT_PRICING : DEFAULT_PRICING;
  const selectedVariants = Array.isArray((selectedDetail as any)?.variants) ? ((selectedDetail as any)?.variants as any[]) : [];
  const selectedVideoUrls = getVideoCandidates(selectedDetail, selectedVariants);
  const selectedShippingOptions = getShippingOptionsSnapshot(selectedDetail, selectedVariants, 0);
  const selectedShippingCost = Number.isFinite(selectedPricing.shippingCost) ? Math.max(0, selectedPricing.shippingCost) : 0;
  const selectedCjBaseCost = resolveEffectiveCjCost(Number(selectedDetail?.sellPrice || selectedProduct?.sellPrice || 0), selectedVariants);
  const selectedLandedCost = selectedCjBaseCost + (Number.isFinite(selectedShippingCost) ? selectedShippingCost : 0);
  const selectedPriceBreakdown = calculateAdminCjPricing(selectedLandedCost, selectedPricing);

  const getDetailForPid = async (pid: string): Promise<CatalogDetail> => {
    if (selectedPid === pid && selectedDetail) return selectedDetail;

    const detail = await getCJProductDetail(pid);
    const signals = deriveShippingSignals(detail);
    setShippingSignalsByPid((prev) => ({ ...prev, [pid]: signals }));
    setProducts((prev) =>
      sortCatalog(
        mergeSignalsIntoProducts(
          prev.map((item) => (item.pid === pid ? { ...item, fastestDeliveryDays: signals.fastestDeliveryDays ?? null } : item)),
          { [pid]: signals }
        ),
        regionFilter
      )
    );

    if (selectedPid === pid) {
      setSelectedDetail(detail);
      setDetailError(null);
    }

    return detail;
  };

  const categoryOptions = useMemo(() => {
    const rows = [...categories];
    rows.sort((left, right) => left.name.localeCompare(right.name));
    return rows;
  }, [categories]);

  const importProductByPid = async (pid: string, openEditorAfterImport: boolean) => {
    const product =
      visibleProducts.find((item) => item.pid === pid) ||
      products.find((item) => item.pid === pid) ||
      null;
    if (!product) return;

    try {
      setSelectedPid(pid);
      setLastImportAttemptPid(pid);
      setImportingPid(pid);
      setImportError(null);
      setImportFeedback(null);

      const detail = await getDetailForPid(pid);
      const variants = Array.isArray((detail as any)?.variants) ? ((detail as any).variants as any[]) : [];
      const shippingOptions = getShippingOptionsSnapshot(detail, variants, 0);
      const cjBaseCost = resolveEffectiveCjCost(Number(detail?.sellPrice || product.sellPrice || 0), variants);
      const pricing = pricingSettings[pid] || DEFAULT_PRICING;
      const shippingCost = Number.isFinite(pricing.shippingCost) ? Math.max(0, pricing.shippingCost) : 0;
      const categoryKey = String(
        beezioCategoryIdOverrides[pid] || resolveBeezioCategoryOverride(product.categoryName, product.categoryId)
      ).trim();
      const categoryLabel =
        beezioCategories.find((category) => String(category.id) === categoryKey)?.name || categoryKey || 'Other';
      const resolvedCategoryId = looksLikeUuid(categoryKey) ? categoryKey : await resolveCategoryId(categoryLabel);
      const selectedVariant = variants[0] || null;
      const inventory = resolveImportInventory(detail, variants);
      const landedCost = cjBaseCost + (Number.isFinite(shippingCost) ? shippingCost : 0);
      const priceBreakdown = calculateAdminCjPricing(landedCost, pricing);
      const videos = getVideoCandidates(detail, variants);

      const result = await invokeImportCJProduct({
        cjProduct: product,
        detailedProduct: detail,
        selectedVariant,
        variants,
        inventory,
        pricing: {
          markup: pricing.markup,
          markupType: 'flat',
          affiliateCommission: pricing.affiliateAmount,
          affiliateCommissionType: 'flat',
          platformFee: pricing.beezioFee,
          platformFeeType: 'flat',
        },
        shippingCost,
        shippingOptions,
        videos,
        beezioCategory: categoryLabel,
        categoryId: resolvedCategoryId,
        computed: {
          finalPrice: priceBreakdown.finalPrice,
          sellerAsk: priceBreakdown.sellerAsk,
        },
      });

      const newProductId = String(result?.product?.id || '').trim();
      if (!newProductId) throw new Error('Import completed without returning a product id');

      if (openEditorAfterImport) {
        navigate(`/dashboard/products/edit/${newProductId}`);
        return;
      }

      setImportFeedback(buildImportSuccessMessage(result, newProductId));
    } catch (importFailure: any) {
      setImportError(formatCjActionError(importFailure?.message || 'Failed to add the CJ item to the marketplace.'));
    } finally {
      setImportingPid('');
    }
  };

  const importSelectedProduct = async (openEditorAfterImport: boolean) => {
    if (!selectedProduct) return;
    await importProductByPid(selectedProduct.pid, openEditorAfterImport);
  };

  const wrapperClass = embedded ? '' : 'min-h-screen bg-[#f7f1e3]';
  const detailPanelOrderClass = selectedPid ? 'order-first xl:order-none' : 'order-last xl:order-none';
  const resultsPanelOrderClass = selectedPid ? 'order-last xl:order-none' : 'order-first xl:order-none';

  return (
    <div className={wrapperClass}>
      <div className={embedded ? '' : 'max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-8'}>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">CJ URL Import</h1>
                <p className="text-sm text-slate-600">
                  Paste one CJ product URL to load that item, review pricing, then add it to the marketplace.
                </p>
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Mobile flow: paste the CJ URL, load the item, review pricing, then tap Add to marketplace.
                </p>
              </div>
              <div className="hidden text-xs text-slate-500 sm:block">Showing {visibleProducts.length} item{visibleProducts.length === 1 ? '' : 's'}</div>
            </div>
          </div>

          <div className="px-6 py-5">
            <form
              className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_220px_180px_220px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                const nextQuery = queryInput.trim();
                setSearchQuery(nextQuery);
                void loadSingleProduct(nextQuery);
              }}
            >
              <label className="relative block min-w-0">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={queryInput}
                  onChange={(event) => setQueryInput(event.target.value)}
                  placeholder="Paste CJ product URL, PID, SKU, or SPU"
                  className="w-full min-w-0 rounded-xl border border-slate-300 px-10 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                />
              </label>

              <select
                value={selectedCategoryId}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              >
                <option value="">All CJ categories</option>
                {categoryOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <select
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value as RegionFilter)}
                className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              >
                <option value="usa-only">USA shipping only</option>
                <option value="usa-first">USA first</option>
                <option value="all">All regions</option>
              </select>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as CatalogSort)}
                className="w-full min-w-0 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
              >
                <option value="featured">Featured / best source</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
                <option value="newest">Newest</option>
              </select>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#101820] px-5 py-3 text-sm font-semibold text-white transition hover:bg-black sm:w-auto"
                >
                  Load item
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(queryInput.trim());
                    setViewMode('catalog');
                    setCatalogReloadToken((prev) => prev + 1);
                  }}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 sm:w-auto"
                  title="Browse catalog"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="ml-2 sm:hidden">Browse catalog</span>
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>{categoriesLoading ? 'Loading categories...' : `${categoryOptions.length} categories loaded`}</span>
              <span>Catalog loading is optional. Use the URL field above for one-item imports.</span>
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600">
                <input
                  type="checkbox"
                  checked={freeShippingOnly}
                  onChange={(event) => setFreeShippingOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
                />
                Free shipping only
              </label>
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600">
                <input
                  type="checkbox"
                  checked={fastShippingOnly}
                  onChange={(event) => setFastShippingOnly(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-300"
                />
                7 days or less
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,2fr)_380px]">
          <div className={`${resultsPanelOrderClass} rounded-2xl border border-slate-200 bg-white shadow-sm`}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Catalog results</h2>
              <p className="text-sm text-slate-600">
                Load a single CJ item from its URL, or use refresh to browse the catalog with the current filters.
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{viewMode === 'catalog' ? 'Loading CJ catalog...' : 'Loading CJ item...'}</span>
                </div>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-slate-600">
                {viewMode === 'catalog'
                  ? 'No CJ products matched the current filters.'
                  : 'Paste a CJ product URL above to load one item here.'}
              </div>
            ) : (
              <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map((product) => {
                  const selected = selectedPid === product.pid;
                  const countryList = (product.shippingCountryCodes || []).slice(0, 4).join(', ');
                  const pricing = pricingSettings[product.pid] || DEFAULT_PRICING;
                  const landedCost = Number(product.sellPrice || 0);
                  const priceBreakdown = calculateAdminCjPricing(landedCost, pricing);
                  const categoryValue =
                    beezioCategoryIdOverrides[product.pid] || resolveBeezioCategoryOverride(product.categoryName, product.categoryId);
                  const isImporting = importingPid === product.pid;
                  const fastestDeliveryDays = Number((product as any).fastestDeliveryDays);

                  return (
                    <div
                      key={product.pid}
                      className={[
                        'overflow-hidden rounded-2xl border bg-white text-left transition',
                        selected
                          ? 'border-amber-400 bg-amber-50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
                      ].join(' ')}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedPid(product.pid)}
                        className="block w-full text-left"
                      >
                        <div className="aspect-square bg-slate-100">
                          {product.productImage ? (
                            <img
                              src={product.productImage}
                              alt={product.productNameEn}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
                          )}
                        </div>
                      </button>
                      <div className="space-y-3 p-4 min-w-0">
                        <div>
                          <div className="line-clamp-2 text-sm font-semibold text-slate-900">{product.productNameEn}</div>
                          <div className="mt-1 break-all text-xs text-slate-500">
                            SKU/SPU: {product.productSku || product.productSpu || product.pid}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{product.categoryName}</span>
                          {isUsShippable(product) && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">USA shipping</span>
                          )}
                          {product.isFreeShipping && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">Free shipping</span>
                          )}
                          {Number.isFinite(fastestDeliveryDays) && fastestDeliveryDays > 0 && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">{fastestDeliveryDays} days</span>
                          )}
                          {product.hasVideo && (
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">Video</span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-lg font-bold text-slate-900">${Number(product.sellPrice || 0).toFixed(2)}</div>
                          <div className="text-xs text-slate-500">Listed: {Number(product.listedNum || 0)}</div>
                        </div>

                        <div className="flex min-w-0 items-start gap-2 text-xs text-slate-500">
                          <MapPin className="h-4 w-4" />
                          <span className="min-w-0 break-words">{countryList || 'Shipping countries not returned on list view'}</span>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick pricing</div>
                              <div className="text-lg font-bold text-slate-900">${priceBreakdown.finalPrice.toFixed(2)}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedPid(product.pid)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                            >
                              {selected ? 'Viewing details' : 'Open details'}
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <label className="space-y-1 text-xs min-w-0">
                              <span className="text-slate-600">Markup $</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pricing.markup}
                                onChange={(event) => updatePricing(product.pid, 'markup', parseMoney(event.target.value))}
                                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                              />
                            </label>
                            <label className="space-y-1 text-xs min-w-0">
                              <span className="text-slate-600">Affiliate payout $</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pricing.affiliateAmount}
                                onChange={(event) => updatePricing(product.pid, 'affiliateAmount', parseMoney(event.target.value))}
                                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                              />
                            </label>
                            <label className="space-y-1 text-xs min-w-0">
                              <span className="text-slate-600">Beezio fee $</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pricing.beezioFee}
                                onChange={(event) => updatePricing(product.pid, 'beezioFee', parseMoney(event.target.value))}
                                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                              />
                            </label>
                            <label className="space-y-1 text-xs min-w-0">
                              <span className="text-slate-600">Shipping baked in $</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={pricing.shippingCost}
                                onChange={(event) => updatePricing(product.pid, 'shippingCost', parseMoney(event.target.value))}
                                className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                              />
                            </label>
                          </div>

                          <label className="mt-3 block space-y-1 text-xs min-w-0">
                            <span className="text-slate-600">Beezio category</span>
                            <select
                              value={categoryValue}
                              onChange={(event) => updateBeezioCategoryId(product.pid, event.target.value)}
                              className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                            >
                              {beezioCategories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                            <div className="rounded-lg bg-white px-3 py-2">
                              <span className="block text-slate-500">Seller ask</span>
                              <span className="font-semibold text-slate-900">${priceBreakdown.sellerAsk.toFixed(2)}</span>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-2">
                              <span className="block text-slate-500">Pricing base incl. shipping</span>
                              <span className="font-semibold text-slate-900">${landedCost.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={isImporting}
                              onClick={() => void importProductByPid(product.pid, false)}
                              className="inline-flex items-center justify-center rounded-xl bg-[#101820] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isImporting ? 'Adding...' : 'Add to marketplace'}
                            </button>
                            <button
                              type="button"
                              disabled={isImporting}
                              onClick={() => void importProductByPid(product.pid, true)}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Add and edit
                            </button>
                          </div>

                          {lastImportAttemptPid === product.pid && importError && (
                            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                              {importError}
                            </div>
                          )}

                          {lastImportAttemptPid === product.pid && importFeedback && (
                            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                              {importFeedback}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => void loadCatalog({ reset: false })}
                disabled={loading || loadingMore || viewMode !== 'catalog'}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Load more
              </button>
            </div>
          </div>

          <div className={`${detailPanelOrderClass} rounded-2xl border border-slate-200 bg-white shadow-sm`}>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">CJ item detail</h2>
              <p className="text-sm text-slate-600">
                Use this panel to price the item, apply Beezio fees, and add it into your marketplace.
              </p>
            </div>

            {!selectedPid ? (
              <div className="px-6 py-16 text-center text-sm text-slate-500">
                Select a CJ product from the catalog to inspect it here.
              </div>
            ) : detailLoading ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <div className="flex items-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading product detail...</span>
                </div>
              </div>
            ) : detailError ? (
              <div className="px-6 py-8">
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{detailError}</div>
              </div>
            ) : selectedDetail && selectedProduct ? (
              <div className="space-y-5 px-6 py-5">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-slate-900">{selectedDetail.productNameEn}</h3>
                  <div className="text-xs text-slate-500">
                    PID: {selectedDetail.pid} | SKU: {(selectedDetail as any).productSku || 'n/a'} | SPU:{' '}
                    {(selectedDetail as any).productSpu || 'n/a'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {((selectedDetail as any).productImageList || [])
                    .slice(0, 6)
                    .map((imageUrl: string, index: number) => (
                      <div key={`${imageUrl}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <img
                          src={imageUrl}
                          alt={`${selectedDetail.productNameEn} ${index + 1}`}
                          className="h-28 w-full object-cover"
                        />
                      </div>
                    ))}
                </div>

                <div className="grid gap-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-500">CJ unit price</span>
                    <span className="font-semibold text-slate-900">${selectedCjBaseCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-500">Shipping baked into buyer price</span>
                    <span className="font-semibold text-slate-900">${selectedShippingCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-500">Pricing base</span>
                    <span className="font-semibold text-slate-900">${selectedLandedCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-500">Variants</span>
                    <span className="font-semibold text-slate-900">{selectedVariants.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-500">Free shipping</span>
                    <span className="font-semibold text-slate-900">Yes on Beezio</span>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Beezio pricing</div>
                    <div className="text-xs text-slate-600">
                      Set your markup and partner commission before sending the item into the marketplace.
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600">Markup $</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={selectedPricing.markup}
                        onChange={(event) => updatePricing(selectedPid, 'markup', parseMoney(event.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600">Affiliate payout $</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={selectedPricing.affiliateAmount}
                        onChange={(event) => updatePricing(selectedPid, 'affiliateAmount', parseMoney(event.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600">Beezio fee $</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={selectedPricing.beezioFee}
                        onChange={(event) => updatePricing(selectedPid, 'beezioFee', parseMoney(event.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="text-slate-600">Shipping baked in $</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={selectedPricing.shippingCost}
                        onChange={(event) => updatePricing(selectedPid, 'shippingCost', parseMoney(event.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                      />
                    </label>
                  </div>

                  <label className="space-y-1 text-sm">
                    <span className="text-slate-600">Beezio category</span>
                    <select
                      value={beezioCategoryIdOverrides[selectedPid] || resolveBeezioCategoryOverride(selectedProduct.categoryName, selectedProduct.categoryId)}
                      onChange={(event) => updateBeezioCategoryId(selectedPid, event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    >
                      {beezioCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-3 text-sm text-slate-700">
                    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                      <span className="text-slate-500">Markup</span>
                      <span className="font-semibold text-slate-900">${selectedPriceBreakdown.markup.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                      <span className="text-slate-500">Seller ask</span>
                      <span className="font-semibold text-slate-900">${selectedPriceBreakdown.sellerAsk.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                      <span className="text-slate-500">Affiliate amount</span>
                      <span className="font-semibold text-slate-900">${selectedPriceBreakdown.affiliateAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-white">
                      <span>Final buyer price</span>
                      <span className="text-base font-semibold">${selectedPriceBreakdown.finalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600">
                    Defaults are flat amounts, and optional shipping is baked into the item price. CJ items imported through Beezio show free shipping to buyers because shipping is already included in the final buyer price. Taxes are added at checkout.
                  </div>

                  {importError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{importError}</div>
                  )}

                  {importFeedback && (
                    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{importFeedback}</span>
                    </div>
                  )}

                  <div className="sticky bottom-2 z-10 -mx-4 rounded-2xl bg-amber-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0">
                    <div className="mb-2 text-xs font-medium text-slate-600 sm:hidden">Ready to import? Use one of these actions.</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={importingPid === selectedPid}
                        onClick={() => void importSelectedProduct(false)}
                        className="inline-flex items-center justify-center rounded-xl bg-[#101820] px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {importingPid === selectedPid ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Adding...
                          </span>
                        ) : (
                          'Add to marketplace'
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={importingPid === selectedPid}
                        onClick={() => void importSelectedProduct(true)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Add and edit
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    <Truck className="h-4 w-4" />
                    Shipping
                  </div>
                  <div className="text-sm text-slate-600">
                    Countries: {((selectedDetail as any).shippingCountryCodes || []).join(', ') || 'Not returned on detail payload'}
                  </div>
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {selectedShippingOptions.map((option, index) => (
                      <div key={`${option.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <div className="font-medium text-slate-900">{option.name}</div>
                          <div className="text-xs text-slate-500">
                            {option.estimated_days}
                            {option.origin_label ? ` | ${option.origin_label}` : ''}
                          </div>
                        </div>
                        <div className="font-semibold text-slate-900">${Number(option.cost || 0).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Description</div>
                  <div className="max-h-44 overflow-y-auto overflow-x-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700 break-words">
                    {formatCjDescription((selectedDetail as any).description)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Variants</div>
                  <div className="max-h-52 overflow-auto rounded-xl border border-slate-200">
                    {selectedVariants.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">No variants returned.</div>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {selectedVariants.map((variant) => (
                          <div key={variant.vid} className="px-4 py-3 text-sm">
                            <div className="font-medium text-slate-900">
                              {variant.variantNameEn || variant.variantSku || variant.vid}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              SKU: {variant.variantSku || 'n/a'} | Price: ${Number(variant.variantSellPrice || 0).toFixed(2)} |
                              Stock: {variant.variantStock ?? 'unknown'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const url = `https://app.cjdropshipping.com/product-detail.html?pid=${encodeURIComponent(selectedDetail.pid)}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ffcb05] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#e0b000]"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in CJ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const identifier = (selectedDetail as any).productSku || (selectedDetail as any).productSpu || selectedDetail.pid;
                      navigator.clipboard?.writeText(identifier).catch(() => undefined);
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Copy SKU/SPU
                  </button>
                </div>

                {selectedDetail.hasVideo && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <Video className="h-4 w-4" />
                      CJ reports a product video for this item.
                    </div>
                    <div className="mt-2 text-xs">
                      {selectedVideoUrls.length > 0
                        ? `${selectedVideoUrls.length} video URL${selectedVideoUrls.length === 1 ? '' : 's'} will be carried into the import.`
                        : 'CJ flagged video support but did not expose a direct video URL in this payload.'}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CJAdminCatalogPage;
