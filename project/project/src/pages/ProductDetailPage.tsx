import React, { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useParams, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Heart, Play, ShoppingCart, Shield, Truck, RotateCcw, DollarSign, Star, Users, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getStoreSlugLookupCandidates, normalizeStoreSlug } from '../utils/normalizeStoreSlug';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useCart } from '../contexts/CartContext';
import AuthModal from '../components/AuthModal';
import ShippingSelector from '../components/ShippingSelector';
import StoreContactModal from '../components/StoreContactModal';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';
import { trackAffiliateClick } from '../utils/affiliateTracking';
import { getReferralAttribution } from '../utils/referralTracking';
import { resolveCheckoutAttribution } from '../utils/checkoutAttribution';
import { deriveAskPriceFromFinalPrice } from '../utils/pricingEngine';
import { DEFAULT_PAYOUT_SETTINGS, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import AddToAffiliateStoreButton from '../components/AddToAffiliateStoreButton';
import AddToSellerStoreButton from '../components/AddToSellerStoreButton';
import AffiliateShareWidget from '../components/AffiliateShareWidget';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { getAffiliateAmount, resolveAffiliateCommission } from '../utils/pricing';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { getProductIdentifierLines } from '../utils/productIdentifiers';
import { normalizeAccountRole } from '../utils/accountRoles';
import { fetchProductById, getVariantOptions, resolveImageUrl, resolveVariant, type ProductVariant } from '../services/productService';
import { getCJProductInventory } from '../services/cjDropshipping';
import { deleteProductById } from '../utils/deleteProduct';
import { archiveProductById } from '../utils/archiveProduct';
import { fetchAccountOwnedProducts } from '../utils/accountOwnedProducts';
import { formatMoneyDisplay, formatShippingDisplay, formatShippingLineItem } from '../utils/moneyDisplay';
import { normalizeProductVideos } from '../utils/imageHelpers';
import {
  fetchProductReviews as fetchProductReviewsFromService,
  getUserProductReviewStatus,
  submitProductReview as submitProductReviewFromService,
} from '../services/reviewService';

const PLACEHOLDER_IMAGE = '/api/placeholder/300/200';

interface Product {
  id: string;
  title: string;
  description?: string;
  lineage?: string;
  price: number;
  calculated_customer_price?: number;
  seller_ask?: number;
  seller_amount?: number;
  seller_ask_price?: number;
  affiliate_commission_rate?: number;
  affiliate_id?: string;
  images: string[];
  videos: string[];
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  affiliate_commission_type?: 'percent' | 'flat';
  affiliate_commission_value?: number;
  seller_id: string;
  is_active?: boolean;
  is_promotable?: boolean;
  status?: string;
  profiles?: {
    full_name: string;
    location?: string;
  };
  shipping_cost?: number;
  shipping_options?: Array<{
    name: string;
    cost: number;
    estimated_days: string;
    origin_country?: string;
    origin_label?: string;
    processing_time?: string;
  }>;
  requires_shipping?: boolean;
  is_digital?: boolean;
  digital_download_instructions?: string;
  digital_return_policy_notice?: string;
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
  average_rating?: number;
  review_count?: number;
  stock_quantity?: number;
  sample_enabled?: boolean;
  sample_price?: number;
}

interface ProductReview {
  id: string;
  rating: number;
  title?: string | null;
  content?: string | null;
  review?: string | null;
  created_at?: string | null;
  verified_purchase?: boolean | null;
  reviewer_id?: string | null;
  profiles?: {
    full_name?: string | null;
  } | null;
}

const ProductDetailPage: React.FC = () => {
  const { productId: rawProductId, storeSlug } = useParams<{ productId: string; storeSlug?: string }>();
  const [searchParams] = useSearchParams();
  const productId = useMemo(() => {
    const decoded = decodeURIComponent(String(rawProductId || ''));
    return decoded.replace(/\s+/g, '').trim();
  }, [rawProductId]);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, hasRole, currentRole, userRoles } = useAuth();
  const { addToCart: addItemToCart, clearCart } = useCart();
  const normalizeImageList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  };
  const initialPrefill = (() => {
    const state = location.state as any;
    return state?.product && state?.product?.id === productId ? state.product : null;
  })();
  const [product, setProduct] = useState<Product | null>(() => {
    if (!initialPrefill) return null;
    return {
      ...(initialPrefill as any),
      images: normalizeImageList((initialPrefill as any)?.images),
      videos: normalizeProductVideos((initialPrefill as any)?.videos),
    } as Product;
  });
  const [loading, setLoading] = useState(!initialPrefill);
  const [error, setError] = useState<string | null>(null);
  const [ownedSellerIds, setOwnedSellerIds] = useState<string[]>([]);
  const [sellerStoreSettings, setSellerStoreSettings] = useState<any>(null);
  const [contactModal, setContactModal] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});
  const [failedVideoUrls, setFailedVideoUrls] = useState<Record<string, boolean>>({});
  const [quantity, setQuantity] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedShipping, setSelectedShipping] = useState<{ id: string; name: string; cost: number; estimated_days: string } | null>(null);
  const [listingUpdating, setListingUpdating] = useState(false);
  const [deleteUpdating, setDeleteUpdating] = useState(false);
  const [variantOptions, setVariantOptions] = useState<ProductVariant[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState<string | null>(null);
  const [hasUserReviewed, setHasUserReviewed] = useState(false);
  const [reviewsVersion, setReviewsVersion] = useState(0);
  const [canViewStoreScopedUnlisted, setCanViewStoreScopedUnlisted] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    content: '',
  });
  const requestedVariantId = useMemo(() => String(searchParams.get('variant') || '').trim(), [searchParams]);

  const PRODUCT_FETCH_TIMEOUT_MS = 12000;
  const VARIANT_FETCH_TIMEOUT_MS = 12000;
  const MAX_FETCH_RETRIES = 1;
  const MINIMAL_PRODUCT_COLUMNS = [
    'id',
    'title',
    'description',
    'price',
    'calculated_customer_price',
    'currency',
    'images',
    'videos',
    'shipping_cost',
    'shipping_price',
    'shipping_options',
    'requires_shipping',
    'is_digital',
    'digital_download_instructions',
    'digital_return_policy_notice',
    'stock_quantity',
    'total_inventory',
    'in_stock',
    'track_inventory',
    'commission_rate',
    'affiliate_commission_rate',
    'commission_type',
    'flat_commission_amount',
    'affiliate_commission_type',
    'affiliate_commission_value',
    'seller_id',
    'seller_ask',
    'seller_amount',
    'seller_ask_price',
    'tags',
    'created_at',
    'lineage',
    'dropship_provider',
    'is_active',
    'is_promotable',
    'status',
    'source_platform',
    'source',
    'inventory_source',
    'cj_product_id',
    'cj_pid',
    'cj_spu',
  ];

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  };

  const extractMissingColumnName = (message: string): string | null => {
    const pg = message.match(/column\s+"([^"]+)"\s+does\s+not\s+exist/i);
    if (pg?.[1]) return pg[1].split('.').pop() || pg[1];
    const pgUnquoted = message.match(/column\s+([a-z0-9_.]+)\s+does\s+not\s+exist/i);
    if (pgUnquoted?.[1]) return pgUnquoted[1].split('.').pop() || pgUnquoted[1];
    const pgrst = message.match(/Could not find the '([^']+)' column/i);
    if (pgrst?.[1]) return pgrst[1];
    return null;
  };

  const retryWithBackoff = async <T,>(fn: () => Promise<T>, label: string): Promise<T> => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const delayMs = 600 + attempt * 700;
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
        console.warn(`ProductDetailPage: retrying ${label} (attempt ${attempt + 1})`);
      }
    }
    throw lastError;
  };

  useEffect(() => {
    if (!productId) return;

    (async () => {
      try {
        const variants = await retryWithBackoff(
          () => withTimeout(getVariantOptions(productId), VARIANT_FETCH_TIMEOUT_MS, 'getVariantOptions'),
          'getVariantOptions'
        );
        setVariantOptions(Array.isArray(variants) ? variants : []);
      } catch (e) {
        console.warn('Failed to load product variants:', e);
        setVariantOptions([]);
      }
    })();
  }, [productId, loadAttempt]);

  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    variantOptions.forEach((variant) => {
      Object.keys((variant.attributes as any) ?? {}).forEach((k) => {
        if (k) keys.add(k);
      });
    });
    return Array.from(keys);
  }, [variantOptions]);

  const isPlaceholderAttributeKey = (key: string) => {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized) return true;
    if (normalized === 'variant') return true;
    return /^(option|variant option)\s*\d+$/.test(normalized);
  };

  const meaningfulAttributeKeys = useMemo(
    () => attributeKeys.filter((key) => !isPlaceholderAttributeKey(key)),
    [attributeKeys]
  );

  const useAttributeSelectors = meaningfulAttributeKeys.length > 0;

  const attributeOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    variantOptions.forEach((variant) => {
      Object.entries(((variant.attributes as any) ?? {}) as Record<string, string>).forEach(([k, v]) => {
        if (!k || !v) return;
        const existing = options[k] || [];
        if (!existing.includes(v)) existing.push(v);
        options[k] = existing;
      });
    });
    return options;
  }, [variantOptions]);

  useEffect(() => {
    if (variantOptions.length !== 1) return;
    const only = variantOptions[0];
    const attrs = (only?.attributes ?? {}) as Record<string, string>;
    if (attrs && Object.keys(attrs).length) setSelectedAttributes(attrs);
  }, [variantOptions]);

  useEffect(() => {
    if (!requestedVariantId || !variantOptions.length) return;
    const matchedVariant = variantOptions.find((variant) => String(variant.id) === requestedVariantId);
    if (!matchedVariant) return;
    setSelectedVariantId(String(matchedVariant.id));
    setSelectedAttributes(((matchedVariant.attributes ?? {}) as Record<string, string>) || {});
  }, [requestedVariantId, variantOptions]);

  const selectedVariant = useMemo(() => {
    if (!variantOptions.length) return null;
    if (variantOptions.length === 1) return variantOptions[0];

    if (!useAttributeSelectors) {
      if (!selectedVariantId) return null;
      return variantOptions.find((variant) => String(variant.id) === String(selectedVariantId)) ?? null;
    }

    const hasCompleteSelection = meaningfulAttributeKeys.every((k) => Boolean(selectedAttributes[k]));
    if (!hasCompleteSelection) return null;

    return resolveVariant(variantOptions, selectedAttributes);
  }, [meaningfulAttributeKeys, selectedAttributes, selectedVariantId, useAttributeSelectors, variantOptions]);
  const cjIdentity = useMemo(() => {
    if (!product) return null;
    const provider = String((product as any)?.source || (product as any)?.source_platform || (product as any)?.lineage || '').trim().toLowerCase();
    if (provider !== 'cj') return null;
    const variant = selectedVariant as any;
    const productRecord = product as any;
    return {
      product: {
        cj_product_id: productRecord.cj_product_id || null,
        cj_pid: productRecord.cj_pid || null,
        cj_product_code: productRecord.cj_product_code || null,
        cj_product_sku: productRecord.cj_product_sku || null,
        cj_spu: productRecord.cj_spu || null,
      },
      variant: variant
        ? {
            cj_variant_id: variant.cj_variant_id || null,
            cj_vid: variant.cj_vid || null,
            cj_variant_sku: variant.cj_variant_sku || null,
            cj_variant_code: variant.cj_variant_code || null,
            cj_sku: variant.cj_sku || null,
            cj_option_summary: variant.cj_option_summary || null,
            variant_display_sku: variant.variant_display_sku || variant.sku || null,
            is_orderable: variant.is_orderable !== false,
          }
        : null,
    };
  }, [product, selectedVariant]);

  const allowBackorder = useMemo(
    () =>
      String((product as any)?.lineage || '').toUpperCase() === 'CJ' ||
      String((product as any)?.dropship_provider || '').toLowerCase() === 'cj' ||
      String((product as any)?.source_platform || '').toLowerCase() === 'cj' ||
      String((product as any)?.source || '').toLowerCase() === 'cj' ||
      String((product as any)?.inventory_source || '').toLowerCase() === 'cj' ||
      Boolean((product as any)?.cj_product_id || (product as any)?.cj_pid || (product as any)?.cj_spu || (product as any)?.display_search_code),
    [product?.lineage, (product as any)?.dropship_provider, (product as any)?.source_platform, (product as any)?.source, (product as any)?.inventory_source, (product as any)?.cj_product_id, (product as any)?.cj_pid, (product as any)?.cj_spu, (product as any)?.display_search_code]
  );

  const effectiveStockQty = useMemo(() => {
    const variantStock = selectedVariant?.inventory;
    if (Number.isFinite(variantStock)) {
      return Math.max(0, Math.floor(variantStock as number));
    }
    const productStock = Number((product as any)?.stock_quantity ?? (product as any)?.total_inventory);
    if (Number.isFinite(productStock)) {
      return Math.max(0, Math.floor(productStock));
    }
    return null;
  }, [product?.stock_quantity, (product as any)?.total_inventory, selectedVariant]);

  const isOutOfStock = useMemo(() => {
    if (!product) return false;
    if (allowBackorder) return false;
    if ((product as any)?.track_inventory === false) return false;

    const variantExplicitInStock =
      typeof (selectedVariant as any)?.in_stock === 'boolean'
        ? Boolean((selectedVariant as any).in_stock)
        : null;
    if (effectiveStockQty !== null) return effectiveStockQty <= 0;
    if (variantExplicitInStock !== null) {
      return !variantExplicitInStock;
    }

    const rawProductStock = (product as any)?.stock_quantity ?? (product as any)?.total_inventory;
    const productStockNum = Number(rawProductStock);
    const hasKnownProductStock =
      rawProductStock !== null &&
      rawProductStock !== undefined &&
      String(rawProductStock).trim() !== '' &&
      Number.isFinite(productStockNum);

    const productExplicitInStock =
      typeof (product as any)?.in_stock === 'boolean'
        ? Boolean((product as any).in_stock)
        : null;

    if (!hasKnownProductStock && productExplicitInStock !== null) {
      return !productExplicitInStock;
    }

    return false;
  }, [allowBackorder, effectiveStockQty, product, selectedVariant]);

  const handleAttributeChange = (key: string, value: string) => {
    setSelectedAttributes((prev) => ({ ...prev, [key]: value }));
  };

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    const picked = variantOptions.find((variant) => String(variant.id) === String(variantId));
    setSelectedAttributes(((picked?.attributes ?? {}) as Record<string, string>) || {});
  };

  const copyToClipboard = async (label: string, value: unknown) => {
    const text = String(value || '').trim();
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
      setReviewSubmitSuccess(`${label} copied`);
      window.setTimeout(() => setReviewSubmitSuccess((current) => (current === `${label} copied` ? null : current)), 2000);
    } catch {
      // non-fatal
    }
  };

  const formatVariantLabel = (variant: ProductVariant): string => {
    const attrs = variant.attributes as Record<string, string> | null;
    if (attrs && Object.keys(attrs).length) {
      const entries = Object.entries(attrs).filter(([, value]) => Boolean(String(value || '').trim()));
      const meaningfulEntries = entries.filter(([key]) => !isPlaceholderAttributeKey(key));
      if (meaningfulEntries.length > 0) {
        return meaningfulEntries
          .map(([key, value]) => `${key}: ${value}`)
          .join(' • ');
      }

      const values = Array.from(new Set(entries.map(([, value]) => String(value).trim()).filter(Boolean)));
      if (values.length > 0) return values.join(' / ');
      return Object.entries(attrs)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' • ');
    }
    return (variant as any)?.variantNameEn || variant.sku || variant.cj_variant_id || variant.id;
  };
  
  // Behavior tracking
  const { trackView, trackClick, trackCartAdd } = useBehaviorTracker();

  const derivedRole = normalizeAccountRole(profile?.primary_role || profile?.role || currentRole);
  const effectiveRole = derivedRole;
  const isSellerRole = effectiveRole === 'seller';
  const isAffiliateRole = effectiveRole === 'affiliate';
  const canAddToAffiliateStore =
    Boolean(user?.id) &&
    (hasRole('affiliate') ||
      hasRole('partner') ||
      isAffiliateRole);
  const isSellingRole = isSellerRole || isAffiliateRole || canAddToAffiliateStore;
  const canAddToSellerStore = hasRole('seller') || isSellerRole;
  const storeScope = String(localStorage.getItem('beezio-store-scope') || '');
  const isStorefrontScope = storeScope.startsWith('store:seller:') || storeScope.startsWith('store:affiliate:');
  const showBuyerCtas = true;
  const rawStoreSlug = storeSlug?.trim().toLowerCase() || '';
  const lookupStoreSlug = normalizeStoreSlug(rawStoreSlug);
  const isCustomDomainHost = useMemo(() => {
    const host = window.location.hostname.toLowerCase();
    return !host.includes('localhost') && !host.includes('netlify.app') && !host.endsWith('beezio.co');
  }, []);
  const isStorefrontProductView = useMemo(() => {
    if (rawStoreSlug) return true;
    const path = String(location.pathname || '').toLowerCase();
    return path.startsWith('/store/') || path.startsWith('/partner/');
  }, [location.pathname, rawStoreSlug]);
  const showStoreAddCtas = Boolean(user?.id) && isSellingRole && !isStorefrontProductView && !isStorefrontScope && !isCustomDomainHost;

  const isAdminRole = useMemo(() => {
    const profileRole = String(profile?.primary_role || profile?.role || '').toLowerCase();
    // Admin can be any granted role, even if currentRole is something else.
    return hasRole('admin') || effectiveRole === 'admin' || profileRole === 'admin';
  }, [effectiveRole, hasRole, profile?.primary_role, profile?.role]);

  const sellerProfileId = (profile as any)?.id as string | undefined;

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setOwnedSellerIds([]);
      return;
    }

    (async () => {
      try {
        const owned = await fetchAccountOwnedProducts();
        if (!cancelled) {
          setOwnedSellerIds(owned.ownerIds);
        }
      } catch {
        if (!cancelled) {
          setOwnedSellerIds([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const canManageListing = useMemo(() => {
    if (!user || !product) return false;
    if (isAdminRole) return true;
    if (ownedSellerIds.includes(String(product.seller_id || '').trim())) return true;
    // In this project, products.seller_id typically references profiles.id.
    if (sellerProfileId && product.seller_id === sellerProfileId) return true;
    // Legacy fallback (some rows may have used auth user id).
    if (user.id && product.seller_id === user.id) return true;
    return false;
  }, [isAdminRole, ownedSellerIds, product, sellerProfileId, user]);
  const showListingManagement = canManageListing && !isStorefrontProductView && !isStorefrontScope && !isCustomDomainHost;

  const isListed = useMemo(() => {
    if (!product) return true;
    const status = String((product as any)?.status || '').trim().toLowerCase();
    if (status === 'draft' || status === 'archived' || status === 'store_only') return false;
    return product.is_active === true || product.is_promotable === true || status === 'active';
  }, [product]);

  useEffect(() => {
    let cancelled = false;

    const verifyStoreScopedProduct = async () => {
      if (!product || !productId || !isStorefrontProductView) {
        if (!cancelled) setCanViewStoreScopedUnlisted(false);
        return;
      }

      const productSellerId = String(product.seller_id || '').trim();
      const path = String(location.pathname || '').toLowerCase();
      const isPartnerPath = path.startsWith('/partner/');
      const isStorePath = path.startsWith('/store/');
      const slug = lookupStoreSlug;

      try {
        if (isStorePath || (!isPartnerPath && slug)) {
          if (slug && productSellerId && slug === productSellerId.toLowerCase()) {
            if (!cancelled) setCanViewStoreScopedUnlisted(true);
            return;
          }

          if (slug) {
            const slugCandidates = getStoreSlugLookupCandidates(slug);
            const { data: sellerMatch, error: sellerError } = await supabase
              .from('store_settings')
              .select('seller_id')
              .in('subdomain', slugCandidates)
              .maybeSingle();
            if (!sellerError && String(sellerMatch?.seller_id || '').trim() === productSellerId) {
              if (!cancelled) setCanViewStoreScopedUnlisted(true);
              return;
            }
          }
        }

        if (isPartnerPath || (!isStorePath && slug)) {
          let affiliateId = '';

          if (slug) {
            const slugCandidates = getStoreSlugLookupCandidates(slug);
            const { data: affiliateMatch, error: affiliateError } = await supabase
              .from('affiliate_store_settings')
              .select('affiliate_id')
              .in('subdomain', slugCandidates)
              .maybeSingle();
            if (!affiliateError) {
              affiliateId = String(affiliateMatch?.affiliate_id || '').trim();
            }
          }

          if (!affiliateId && rawStoreSlug) {
            affiliateId = rawStoreSlug;
          }

          if (affiliateId) {
            const { data: affiliateProduct, error: affiliateProductError } = await supabase
              .from('affiliate_products')
              .select('id')
              .eq('affiliate_id', affiliateId)
              .eq('product_id', productId)
              .maybeSingle();
            if (!affiliateProductError && affiliateProduct?.id) {
              if (!cancelled) setCanViewStoreScopedUnlisted(true);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[ProductDetailPage] Store-scoped product visibility check failed:', err);
      }

      if (!cancelled) setCanViewStoreScopedUnlisted(false);
    };

    void verifyStoreScopedProduct();

    return () => {
      cancelled = true;
    };
  }, [isStorefrontProductView, location.pathname, lookupStoreSlug, product, productId, rawStoreSlug]);

  const commissionType = useMemo<'percent' | 'flat'>(() => {
    return resolveAffiliateCommission(product as any).type;
  }, [product]);

  const commissionValue = useMemo(() => {
    const commission = resolveAffiliateCommission(product as any);
    return Number(
      commission.type === 'flat'
        ? commission.value
        : commission.value || DEFAULT_PAYOUT_SETTINGS.affiliatePercent
    );
  }, [product]);

  const payoutSettings = useMemo(() => ({
    affiliatePercent: commissionType === 'percent' ? commissionValue : 0,
    platformPercent: PLATFORM_FEE_PERCENT,
  }), [commissionType, commissionValue]);

  const derivedSellerAsk = useMemo(() => {
    if (!product) return 0;
    if (typeof product.seller_ask === 'number' && product.seller_ask > 0) return product.seller_ask;
    if (typeof product.seller_amount === 'number' && product.seller_amount > 0) return product.seller_amount;
    if (typeof product.seller_ask_price === 'number' && product.seller_ask_price > 0) return product.seller_ask_price;
    // If legacy data stored only final price, invert the pricing formula.
    try {
      const assumedFinal =
        typeof product.calculated_customer_price === 'number' && product.calculated_customer_price > 0
          ? product.calculated_customer_price
          : product.price;
      return deriveAskPriceFromFinalPrice(assumedFinal, payoutSettings);
    } catch {
      return product.price;
    }
  }, [product, payoutSettings]);

  const finalDisplayPrice = useMemo(() => {
    if (!product) return 0;
    try {
      return getBuyerFacingProductPrice(product as any);
    } catch (e) {
      console.warn('BEEZIO_PRICING_ENGINE display fallback', e);
      return (typeof product.calculated_customer_price === 'number' && product.calculated_customer_price > 0)
        ? product.calculated_customer_price
        : product.price;
    }
  }, [product]);

  const samplePrice = useMemo(() => {
    if (!product?.sample_enabled) return null;
    const value = Number(product.sample_price);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value;
  }, [product?.sample_enabled, product?.sample_price]);

  const affiliateEarnings = useMemo(() => {
    return getAffiliateAmount(derivedSellerAsk, commissionType, commissionValue);
  }, [commissionType, commissionValue, derivedSellerAsk]);
  const earningsAmount = useMemo(() => {
    if (isSellingRole) return affiliateEarnings;
    return null;
  }, [affiliateEarnings, isSellingRole]);
  const showAffiliatePayoutPreview = isAffiliateRole && !showBuyerCtas;

  const displayDescription = useMemo(() => {
    return sanitizeDescriptionForDisplay(product?.description, product?.lineage);
  }, [product?.description, product?.lineage]);

  const isValidImageUrl = (value: unknown) => {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (raw === PLACEHOLDER_IMAGE) return false;
    if (raw.includes('/api/placeholder')) return false;
    if (/^\[object Object\]$/i.test(raw)) return false;
    if (/^(no image|image unavailable|n\/a)$/i.test(raw)) return false;
    return true;
  };

  const visibleImages = useMemo(() => {
    const images = Array.isArray(product?.images) ? product.images : [];
    return images.filter((image) => {
      const normalized = String(image || '').trim();
      return isValidImageUrl(normalized) && !failedImageUrls[normalized];
    });
  }, [failedImageUrls, product?.images]);

  const visibleVideos = useMemo(() => {
    const videos = Array.isArray(product?.videos) ? product.videos : [];
    return videos.filter((video) => {
      const normalized = String(video || '').trim();
      return Boolean(normalized) && !failedVideoUrls[normalized];
    });
  }, [failedVideoUrls, product?.videos]);

  const markImageFailed = (imageUrl: string) => {
    const normalized = String(imageUrl || '').trim();
    if (!normalized) return;
    setFailedImageUrls((prev) => (prev[normalized] ? prev : { ...prev, [normalized]: true }));
  };

  const markVideoFailed = (videoUrl: string) => {
    const normalized = String(videoUrl || '').trim();
    if (!normalized) return;
    setFailedVideoUrls((prev) => (prev[normalized] ? prev : { ...prev, [normalized]: true }));
  };

  useEffect(() => {
    setSelectedImageIndex(0);
    setFailedImageUrls({});
    setFailedVideoUrls({});
  }, [product?.id]);

  useEffect(() => {
    const mediaCount = visibleImages.length + visibleVideos.length;
    if (mediaCount === 0) {
      if (selectedImageIndex !== 0) setSelectedImageIndex(0);
      return;
    }
    if (selectedImageIndex >= mediaCount) {
      setSelectedImageIndex(mediaCount - 1);
    }
  }, [selectedImageIndex, visibleImages.length, visibleVideos.length]);

  const getVideoEmbedUrl = (url: string): string | null => {
    if (!url) return null;

    const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;

    const tiktokMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
    if (tiktokMatch) return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`;

    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

    const instagramMatch = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    if (instagramMatch) return `https://www.instagram.com/p/${instagramMatch[1]}/embed/`;

    return null;
  };

  const isDirectVideoUrl = (url: string): boolean => {
    const normalized = String(url || '').trim().toLowerCase();
    if (!normalized) return false;
    return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(normalized) || /\.m3u8(\?|#|$)/i.test(normalized);
  };

  const storeBasePath = useMemo(() => {
    if (rawStoreSlug) {
      if (location.pathname.startsWith('/store/')) return `/store/${rawStoreSlug}`;
      if (location.pathname.startsWith('/partner/')) return `/partner/${rawStoreSlug}`;
      return `/${rawStoreSlug}`;
    }
    return isCustomDomainHost ? '/' : '';
  }, [isCustomDomainHost, location.pathname, rawStoreSlug]);

  const rawReferralToken = String(searchParams.get('ref') || '').trim() || null;
  const referralAttribution = getReferralAttribution();
  const storefrontAffiliateId = String(
    (product as any)?.affiliate_id || (initialPrefill as any)?.affiliate_id || ''
  ).trim() || null;
  const cartAttribution = useMemo(
    () =>
      resolveCheckoutAttribution({
        referralAffiliateId: referralAttribution.type === 'affiliate' ? referralAttribution.id : rawReferralToken,
        storeScope: typeof window !== 'undefined' ? localStorage.getItem('beezio-store-scope') : null,
        cartAffiliateIds: storefrontAffiliateId ? [storefrontAffiliateId] : [],
      }),
    [rawReferralToken, referralAttribution.id, referralAttribution.type, storefrontAffiliateId]
  );
  const cartAffiliateId = storefrontAffiliateId || cartAttribution.affiliate_id || undefined;

  const backTarget = useMemo(() => {
    if (storeBasePath) return storeBasePath;
    const from = (location.state as any)?.from;
    if (typeof from === 'string' && from.trim().length > 0) return from;
    try {
      const last = sessionStorage.getItem('beezio:lastMarketplaceUrl');
      if (last && last.trim().length > 0) return last;
    } catch {
      // ignore
    }
    return '/marketplace';
  }, [location.state, storeBasePath]);

  useEffect(() => {
    if (!lookupStoreSlug) return;
    let cancelled = false;
    const applyScope = (type: 'seller' | 'affiliate', scopeId: string) => {
      if (cancelled) return;
      const scopeKey = `store:${type}:${scopeId}`;
      localStorage.setItem('beezio-store-scope', scopeKey);
      window.dispatchEvent(new Event('beezio-store-scope-changed'));
    };

    const resolveStoreScope = async () => {
      try {
        const { data: affiliateMatch, error: affiliateError } = await supabase
          .from('affiliate_store_settings')
          .select('affiliate_id')
          .eq('subdomain', lookupStoreSlug)
          .maybeSingle();
        if (!affiliateError && affiliateMatch?.affiliate_id) {
          applyScope('affiliate', lookupStoreSlug);
          return;
        }
      } catch {
        // ignore and continue
      }

      try {
        const { data: sellerMatch, error: sellerError } = await supabase
          .from('store_settings')
          .select('seller_id')
          .eq('subdomain', lookupStoreSlug)
          .maybeSingle();
        if (!sellerError && sellerMatch?.seller_id) {
          applyScope('seller', lookupStoreSlug);
          return;
        }
      } catch {
        // ignore and continue
      }
    };

    void resolveStoreScope();
    return () => {
      cancelled = true;
    };
  }, [lookupStoreSlug]);

  useEffect(() => {
    if (lookupStoreSlug || isCustomDomainHost) return;

    const hasReferralQuery =
      Boolean(searchParams.get('ref')) ||
      Boolean(searchParams.get('uid')) ||
      Boolean(searchParams.get('code'));
    if (hasReferralQuery) return;

    const cameFromStorefront = (() => {
      const from = String((location.state as any)?.from || '').trim().toLowerCase();
      return from.startsWith('/store/') || from.startsWith('/partner/');
    })();
    if (cameFromStorefront) return;

    const currentScope = String(localStorage.getItem('beezio-store-scope') || '').trim();
    if (!currentScope) return;

    // Plain `/product/:id` views should not inherit an older storefront scope,
    // otherwise checkout can fall back to the wrong affiliate storefront owner.
    localStorage.removeItem('beezio-store-scope');
    window.dispatchEvent(new Event('beezio-store-scope-changed'));
  }, [isCustomDomainHost, lookupStoreSlug]);

  // Track affiliate referral on page load
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const linkCode = searchParams.get('code') || null;
    
    if (linkCode) {
      trackAffiliateClick(linkCode);
    }
  }, [location.search]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId, loadAttempt]);

  useEffect(() => {
    // Track product page view and detailed product view
    if (product) {
      trackView(product.id);
      trackClick(product.id, 'product_detail');
    }
  }, [product, trackView, trackClick]);

  const normalizeProduct = (raw: any): Product => {
    const sellerId = raw?.seller_id || raw?.sellerId || raw?.seller_id || '';
    const rawImages = Array.isArray(raw?.images) ? raw.images : [];
    const fallbackImage = raw?.image || raw?.image_url || raw?.thumbnail || raw?.imageUrl;
    const directMarkers = [
      raw?.source_platform,
      raw?.source,
      raw?.dropship_provider,
      raw?.inventory_source,
      raw?.lineage,
    ]
      .map((value: unknown) => String(value || '').trim().toLowerCase())
      .filter(Boolean);
    const looksLikeCjProduct =
      directMarkers.some((value) => value === 'cj') ||
      Boolean(String(raw?.cj_product_id || '').trim() || String(raw?.cj_pid || '').trim() || String(raw?.cj_spu || '').trim()) ||
      (Array.isArray(raw?.images)
        ? raw.images.some((entry: unknown) => String(entry || '').toLowerCase().includes('cjdropshipping.com'))
        : false);
    const normalizedPricing = { ...(raw || {}) };
    const commissionType = String(normalizedPricing?.commission_type || '').trim().toLowerCase();
    const affiliateCommissionType = String(normalizedPricing?.affiliate_commission_type || '').trim().toLowerCase();
    const hasExplicitFlatType =
      affiliateCommissionType === 'flat' || commissionType === 'flat_rate' || commissionType === 'fixed';
    const hasStoredFlatAmount =
      Number(normalizedPricing?.flat_commission_amount || 0) > 0 ||
      (affiliateCommissionType === 'flat' && Number(normalizedPricing?.affiliate_commission_value || 0) > 0);
    if (
      hasExplicitFlatType &&
      Number(normalizedPricing?.affiliate_commission_value || 0) <= 0 &&
      Number(normalizedPricing?.flat_commission_amount || 0) <= 0 &&
      Number(normalizedPricing?.commission_rate || 0) > 0
    ) {
      normalizedPricing.affiliate_commission_type = 'flat';
      normalizedPricing.affiliate_commission_value = Number(normalizedPricing.commission_rate);
      normalizedPricing.flat_commission_amount = Number(normalizedPricing.commission_rate);
    }
    if (looksLikeCjProduct) {
      normalizedPricing.source_platform = 'cj';
      normalizedPricing.source = normalizedPricing.source || 'cj';
      normalizedPricing.inventory_source = normalizedPricing.inventory_source || 'cj';
      normalizedPricing.lineage = normalizedPricing.lineage || 'CJ';
      if (!hasExplicitFlatType && !hasStoredFlatAmount && Number(normalizedPricing?.commission_rate || 0) > 0) {
        normalizedPricing.commission_type = 'flat_rate';
        normalizedPricing.affiliate_commission_type = 'flat';
        normalizedPricing.affiliate_commission_value = Number(normalizedPricing.commission_rate);
        normalizedPricing.flat_commission_amount = Number(normalizedPricing.commission_rate);
      }
    }
    const normalizeImages = (values: unknown[], fallback?: unknown): string[] => {
      const resolved = values
        .map((image) => String(image || '').trim())
        .filter((image) => {
          if (!image) return false;
          if (image === PLACEHOLDER_IMAGE) return false;
          if (image.startsWith('/api/placeholder') || image.startsWith('api/placeholder')) return false;
          if (/^\[object Object\]$/i.test(image)) return false;
          if (/^(no image|image unavailable|n\/a)$/i.test(image)) return false;
          return true;
        })
        .map((image) => resolveImageUrl(image))
        .map((image) => String(image || '').trim())
        .filter((image) => {
          if (!image) return false;
          if (image === PLACEHOLDER_IMAGE) return false;
          if (image.includes('/api/placeholder')) return false;
          return true;
        });
      const unique: string[] = [];
      for (const img of resolved) {
        if (img === PLACEHOLDER_IMAGE) continue;
        if (unique.includes(img)) continue;
        unique.push(img);
      }
      if (unique.length) return unique;

      const fallbackResolved = fallback ? resolveImageUrl(String(fallback || '').trim()) : '';
      if (fallbackResolved && fallbackResolved !== PLACEHOLDER_IMAGE) return [fallbackResolved];
      if (fallbackResolved) return [fallbackResolved];
      return [PLACEHOLDER_IMAGE];
    };
    const images = normalizeImages(rawImages, fallbackImage);
    const sellerName = normalizedPricing?.profiles?.full_name || normalizedPricing?.seller || normalizedPricing?.seller_name || '';
    return {
      ...(normalizedPricing as any),
      seller_id: sellerId || normalizedPricing?.seller_id,
      images,
      videos: normalizeProductVideos(normalizedPricing?.videos),
      profiles: normalizedPricing?.profiles || (sellerName ? { full_name: sellerName } : undefined),
    };
  };

  const fetchProduct = async () => {
    try {
      const hadPrefill = Boolean(product);
      if (!hadPrefill) {
        setLoading(true);
      }
      setError(null);

      const fetchFromSupabase = async () => {
        const { data, error: fetchError } = await withTimeout(
          supabase
            .from('products')
            .select(
              `
            *,
            profiles:seller_id (
              full_name
            )
          `
            )
            .eq('id', productId)
            .single(),
          PRODUCT_FETCH_TIMEOUT_MS,
          'fetchProduct'
        );
        if (fetchError || !data) throw fetchError || new Error('Product not found');
        return data as any;
      };

      const fetchFromPublicApi = async () => {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), PRODUCT_FETCH_TIMEOUT_MS);
        try {
          const resp = await fetch(`/api/public/product/get?id=${encodeURIComponent(String(productId))}`, {
            signal: controller.signal,
          });
          if (!resp.ok) return null;
          const payload: any = await resp.json().catch(() => ({}));
          if (payload?.store_settings) {
            setSellerStoreSettings(payload.store_settings);
          }
          return payload?.product || null;
        } finally {
          window.clearTimeout(timeout);
        }
      };

      const fetchMinimalProduct = async () => {
        let columns = [...MINIMAL_PRODUCT_COLUMNS];
        let lastError: any = null;

        for (let attempt = 0; attempt < 6; attempt += 1) {
          const { data, error: fetchError } = await withTimeout(
            supabase
              .from('products')
              .select(columns.join(','))
              .eq('id', productId)
              .maybeSingle(),
            PRODUCT_FETCH_TIMEOUT_MS,
            'fetchProductMinimal'
          );

          if (!fetchError && data) return data as any;
          if (!fetchError && !data) throw new Error('Product not found');

          lastError = fetchError;
          const missingColumn = extractMissingColumnName(String(fetchError?.message || ''));
          if (missingColumn && columns.includes(missingColumn)) {
            columns = columns.filter((column) => column !== missingColumn);
            continue;
          }

          throw fetchError;
        }

        throw lastError || new Error('Product not found');
      };

      const preferLightweight = Boolean(initialPrefill?.lineage === 'CJ' || product?.lineage === 'CJ');
      const preferPublicEndpoint = !user;
      let data: any = null;
      let minimalLoaded = false;

      if (preferPublicEndpoint) {
        try {
          data = await retryWithBackoff(fetchFromPublicApi, 'fetchProductPublicApi');
          if (data) {
            const normalized = normalizeProduct(data as any);
            setProduct((prev) => ({
              ...(normalized as any),
              affiliate_id: String((normalized as any)?.affiliate_id || (prev as any)?.affiliate_id || '').trim() || undefined,
            }));
            setLoading(false);
          }
        } catch (publicApiError) {
          console.warn('[ProductDetailPage] Public API fetch failed, will try direct fallbacks:', publicApiError);
        }
      }

      // Fast-first: load minimal row to render the page quickly, then enrich in the background.
      if ((!hadPrefill || preferLightweight) && !data) {
        try {
          const minimal = await retryWithBackoff(fetchMinimalProduct, 'fetchProductMinimal');
          const normalized = normalizeProduct(minimal as any);
          setProduct((prev) => ({
            ...(normalized as any),
            affiliate_id: String((normalized as any)?.affiliate_id || (prev as any)?.affiliate_id || '').trim() || undefined,
          }));
          minimalLoaded = true;
          if (!hadPrefill) {
            setLoading(false);
          }
        } catch (e) {
          console.warn('[ProductDetailPage] Minimal fetch failed, will try full fetch:', e);
        }
      }

      // Fast path: server-side public product endpoint (cached + bypasses client RLS).
      try {
        if (!data) {
          data = await retryWithBackoff(fetchFromPublicApi, 'fetchProductPublicApi');
        }
      } catch (publicApiError) {
        console.warn('[ProductDetailPage] Public API fetch failed, trying direct Supabase:', publicApiError);
      }

      try {
        if (!data) {
          data = await retryWithBackoff(fetchFromSupabase, 'fetchProduct');
        }
      } catch (primaryError) {
        console.warn('[ProductDetailPage] Primary fetch failed, falling back to product service:', primaryError);

        // Keep this as a fallback in case the first API call timed out.
        if (!data) {
          try {
            data = await fetchFromPublicApi();
          } catch {
            // ignore and continue
          }
        }

        let fallback: any = null;
        if (!data) {
          try {
            fallback = await retryWithBackoff(
              () => withTimeout(fetchProductById(String(productId)), PRODUCT_FETCH_TIMEOUT_MS, 'fetchProductById'),
              'fetchProductById'
            );
          } catch (serviceError) {
            console.warn('[ProductDetailPage] Product service fallback failed, using minimal query:', serviceError);
          }
        }

        if (!data) {
          if (!fallback) {
            data = await retryWithBackoff(fetchMinimalProduct, 'fetchProductMinimal');
          } else {
            data = fallback as any;
          }
        }
      }

      if (data) {
        const normalized = normalizeProduct(data as any);
        setProduct((prev) => ({
          ...(normalized as any),
          affiliate_id: String((normalized as any)?.affiliate_id || (prev as any)?.affiliate_id || '').trim() || undefined,
        }));
      } else if (!minimalLoaded) {
        throw new Error('Product not found');
      }

      const sellerId = (data as any)?.seller_id || (data as any)?.sellerId;
      if (sellerId) {
        const { data: storeSettingsData, error: storeSettingsError } = await supabase
          .from('store_settings')
          .select('store_name, return_policy, shipping_policy, subdomain, custom_domain')
          .eq('seller_id', sellerId)
          .maybeSingle();
        if (storeSettingsError && storeSettingsError.code !== 'PGRST116') {
          console.warn('[ProductDetailPage] Error fetching store settings (non-fatal):', storeSettingsError);
        }
        setSellerStoreSettings(storeSettingsData || null);
      } else {
        setSellerStoreSettings(null);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setProduct(null);
      setError(error instanceof Error ? error.message : 'Unable to load product.');
      setSellerStoreSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    if (!productId) return;

    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const list = await fetchProductReviewsFromService(productId, 20);
      setReviews((list as ProductReview[]) || []);

      if (user?.id) {
        const status = await getUserProductReviewStatus(productId, user.id);
        setHasUserReviewed(status.hasReviewed);
      } else {
        setHasUserReviewed(false);
      }
    } catch (error) {
      console.error('Error loading product reviews:', error);
      setReviews([]);
      setReviewsError('Unable to load reviews right now.');
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    void fetchReviews();
  }, [productId, user?.id, reviewsVersion]);

  const handleSubmitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user?.id) {
      setAuthMode('login');
      setShowAuthModal(true);
      return;
    }
    if (!productId) return;

    const cleanContent = reviewForm.content.trim();
    if (cleanContent.length < 5) {
      setReviewSubmitError('Please write a short review before submitting.');
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewSubmitError(null);
      setReviewSubmitSuccess(null);

      await submitProductReviewFromService({
        productId,
        userId: user.id,
        rating: Number(reviewForm.rating) || 5,
        title: cleanContent.slice(0, 100),
        content: cleanContent,
        requireVerifiedPurchase: true,
      });

      setReviewForm({ rating: 5, content: '' });
      setReviewSubmitSuccess('Review submitted. Thank you for your feedback.');
      setHasUserReviewed(true);
      setReviewsVersion((prev) => prev + 1);
    } catch (error: any) {
      const message = String(error?.message || '').trim();
      setReviewSubmitError(
        message === 'Only customers who purchased this product can leave a review.'
          ? 'Reviews unlock after a completed purchase from this account.'
          : (message || 'Unable to submit review right now.')
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  const reviewAverage = useMemo(() => {
    if (reviews.length > 0) {
      const total = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
      return total / reviews.length;
    }
    return Number(product?.average_rating || 0);
  }, [product?.average_rating, reviews]);

  const reviewCountDisplay = useMemo(() => {
    if (reviews.length > 0) return reviews.length;
    return Number(product?.review_count || 0);
  }, [product?.review_count, reviews.length]);

  // Absolute guardrail: never spin forever if Supabase hangs.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => {
      setError('Product is taking too long to load. Please try again.');
      setLoading(false);
    }, 15000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  const handleRetry = () => setLoadAttempt((n) => n + 1);

  const addToCart = async (options?: { silent?: boolean }) => {
    if (!product) return;
    
    if (variantOptions.length > 1 && !selectedVariant) {
      if (!options?.silent) {
        alert('Please choose options (size/color/etc) before adding to cart.');
      }
      return false;
    }

    // Track add to cart behavior
    trackCartAdd(product.id);
    
    const computedMaxQuantity = await (async () => {
      const lineage = String((product as any)?.lineage || '').toUpperCase();
      const provider = String((product as any)?.dropship_provider || '').toLowerCase();
      const isCJ = lineage === 'CJ' || provider === 'cj';
      const tracksInventory = (product as any)?.track_inventory !== false;

      if (isCJ && !tracksInventory) {
        return null;
      }

      const variantStock = selectedVariant?.inventory;
      if (Number.isFinite(variantStock)) {
        const normalized = Math.max(0, Math.floor(variantStock as number));
        return normalized;
      }
      const productStock = (product as any)?.stock_quantity;
      if (Number.isFinite(productStock)) {
        const normalized = Math.max(0, Math.floor(productStock));
        return normalized;
      }

      if (isCJ) {
        let cjProductId = String(
          (selectedVariant as any)?.cj_product_id ||
          (product as any)?.cj_product_id ||
          ''
        ).trim();
        let cjVariantId = String((selectedVariant as any)?.cj_vid || (selectedVariant as any)?.cj_variant_id || '').trim();

        if (!cjProductId && product.id) {
          const { data: mapping } = await supabase
            .from('cj_product_mappings')
            .select('cj_product_id, cj_variant_id')
            .eq('beezio_product_id', product.id)
            .maybeSingle();

          cjProductId = String((mapping as any)?.cj_product_id || '').trim();
          if (!cjVariantId) {
            cjVariantId = String((mapping as any)?.cj_variant_id || '').trim();
          }
        }

        if (cjProductId) {
          try {
            const live = await getCJProductInventory(cjProductId, cjVariantId || undefined);
            if (typeof live === 'number' && Number.isFinite(live)) {
              return Math.max(0, Math.floor(live));
            }
          } catch (e) {
            console.warn('[ProductDetailPage] Live CJ inventory check failed:', e);
          }
        }

        return null;
      }

      return 99;
    })();

    if (typeof computedMaxQuantity === 'number' && computedMaxQuantity <= 0) {
      if (!options?.silent) {
        const variantText = selectedVariant ? ` (${formatVariantLabel(selectedVariant)})` : '';
        alert(`Out of stock${variantText}.`);
      }
      return false;
    }

    // Add product to cart with selected shipping cost
    flushSync(() => {
      addItemToCart({
        productId: product.id,
        title: product.title,
        price: finalDisplayPrice,
        sellerAsk: derivedSellerAsk,
        commission_rate: product.commission_rate,
        commission_type: product.commission_type,
        flat_commission_amount: product.flat_commission_amount,
        quantity: quantity,
          image: (selectedVariant?.image_url ? resolveImageUrl(selectedVariant.image_url) : '') || product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
        sellerId: product.seller_id,
        sellerName: product.profiles?.full_name || 'Unknown Seller',
        shippingCost: Number(selectedShipping?.cost ?? product.shipping_cost ?? 0) || 0,
        maxQuantity: typeof computedMaxQuantity === 'number' ? computedMaxQuantity : undefined,
        affiliateId: cartAffiliateId,
        variantId: selectedVariant?.id ?? undefined,
        variantName: selectedVariant ? formatVariantLabel(selectedVariant) : undefined,
        isDigital: product.is_digital === true,
      });
    });
    
      // Show success message or redirect to checkout
      if (!options?.silent) {
        const variantText = selectedVariant ? ` (${formatVariantLabel(selectedVariant)})` : '';
        alert(`Product${variantText} added to cart! ${selectedShipping ? `Shipping: ${selectedShipping.name} (+$${selectedShipping.cost.toFixed(2)})` : ''}`);
        navigate('/cart');
      }

    return true;
  };

  const addSampleToCart = async () => {
    if (!product || !samplePrice) return;

    if (variantOptions.length > 1 && !selectedVariant) {
      alert('Please choose options (size/color/etc) before adding a sample.');
      return;
    }

    flushSync(() => {
      addItemToCart({
        productId: product.id,
        title: product.title,
        price: samplePrice,
        sellerAsk: derivedSellerAsk,
        commission_rate: 0,
        commission_type: 'percentage',
        flat_commission_amount: 0,
        affiliateCommissionRate: 0,
        quantity: 1,
        image: (selectedVariant?.image_url ? resolveImageUrl(selectedVariant.image_url) : '') || product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
        sellerId: product.seller_id,
        sellerName: product.profiles?.full_name || 'Unknown Seller',
        shippingCost: Number(selectedShipping?.cost ?? product.shipping_cost ?? 0) || 0,
        maxQuantity: 1,
        affiliateId: cartAffiliateId,
        variantId: selectedVariant?.id ?? undefined,
        variantName: selectedVariant ? formatVariantLabel(selectedVariant) : undefined,
        isSample: true,
        isDigital: product.is_digital === true,
      });
    });

    alert('Sample added to cart. Samples are final sale. Price includes platform + processing fees. No commissions on samples.');
  };

  const handleBuyNow = async () => {
    if (variantOptions.length > 1 && !selectedVariant) {
      alert('Please choose options (size/color/etc) before buying.');
      return;
    }

    flushSync(() => {
      clearCart();
    });
    const added = await addToCart({ silent: true });
    if (!added) return;
    navigate('/checkout');
  };

  const handleToggleListing = async () => {
    if (!product) return;
    if (!canManageListing) {
      alert('You do not have permission to change this listing.');
      return;
    }

    const nextIsActive = !isListed;
    const verb = nextIsActive ? 'Relist' : 'Unlist';
    const needsConfirm = !nextIsActive;
    if (needsConfirm && !confirm('Unlist this product from the marketplace? Buyers will no longer see it.')) return;

    try {
      setListingUpdating(true);
      const nextStatus = nextIsActive ? 'active' : 'archived';
      let upd = supabase
        .from('products')
        .update({
          is_active: nextIsActive,
          is_promotable: nextIsActive,
          status: nextStatus,
        })
        .eq('id', product.id);
      if (!isAdminRole) {
        upd = upd.eq('seller_id', sellerProfileId || user?.id || '');
      }
      const { error } = await upd;
      if (error) throw error;

      setProduct({ ...(product as any), is_active: nextIsActive, is_promotable: nextIsActive, status: nextStatus });
      alert(`${verb}ed.`);
      if (!nextIsActive) {
        navigate(backTarget);
      }
    } catch (e: any) {
      console.error('Error updating listing:', e);
      alert(e?.message || 'Failed to update listing');
    } finally {
      setListingUpdating(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!product) return;
    if (!canManageListing || (!isSellerRole && !isAdminRole)) {
      alert('You do not have permission to delete this product.');
      return;
    }

    if (!confirm('Remove this product from your active dashboard and marketplace listings? Promoter links and payout history will be kept.')) return;

    try {
      setDeleteUpdating(true);
      const sellerId = canManageListing ? product.seller_id : undefined;
      if (canManageListing) {
        await archiveProductById({ productId: product.id, sellerId });
      } else {
        await deleteProductById({ productId: product.id, sellerId });
      }
      alert(canManageListing ? 'Product removed from active listings.' : 'Listing removed by admin.');
      navigate(isAdminRole ? '/dashboard?section=admin' : '/dashboard/products');
    } catch (e) {
      console.error('[ProductDetailPage] delete failed', e);
      alert('Unable to remove this product right now.');
    } finally {
      setDeleteUpdating(false);
    }
  };

  const storeNavigationPath = storeBasePath || '/marketplace';
  const storeNavigationLabel = storeBasePath ? 'Store' : 'Products';
  const backButtonLabel = storeBasePath ? 'Back to Store' : 'Back to Products';
  const isDigitalPreviewProtected = product?.is_digital === true;
  const shareProductPath = productId
    ? `${storeBasePath ? storeBasePath : ''}/product/${productId}`.replace(/\/+/g, '/')
    : '/product';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-gray-300 rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-3/4"></div>
              <div className="h-6 bg-gray-300 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
        <p className="text-gray-600 mb-6">{error || "The product you're looking for doesn't exist."}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={handleRetry}
            className="px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Retry
          </button>
          <Link to={storeNavigationPath} className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-white transition-colors">
            {storeBasePath ? 'Back to Store' : 'Browse All Products'}
          </Link>
        </div>
      </div>
    );
  }

  if (!isListed && !canManageListing && !canViewStoreScopedUnlisted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
        <p className="text-gray-600 mb-4">This product is currently unlisted.</p>
        <Link to={storeNavigationPath} className="text-amber-600 hover:text-amber-700 font-medium">
          {storeBasePath ? 'Back to Store' : 'Browse All Products'}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 md:py-8">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500 mb-4 md:mb-6 overflow-x-auto whitespace-nowrap">
        <Link to="/" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <Link to={storeNavigationPath} className="hover:text-gray-700">{storeNavigationLabel}</Link>
        <span>/</span>
        <span className="text-gray-900">{product.title}</span>
      </div>

      {/* Back Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-6">
        <button
          type="button"
          onClick={() => {
            // Always go back into Beezio's marketplace context (never leave the app).
            navigate(backTarget || storeNavigationPath);
          }}
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backButtonLabel}</span>
        </button>

        {showListingManagement && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleListing}
              disabled={listingUpdating}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border disabled:opacity-60 ${
                isListed
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
              }`}
              title={isListed ? 'Unlist product' : 'Relist product'}
            >
              <span>{listingUpdating ? 'Updating…' : isListed ? 'Unlist' : 'Relist'}</span>
            </button>
            {(isSellerRole || isAdminRole) && (
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={deleteUpdating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60"
                title="Remove product"
              >
                <span>{deleteUpdating ? 'Deleting…' : 'Delete'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Product Media */}
        <div className="space-y-3">
          {/* Media Tabs */}
          {(visibleImages.length > 0 || visibleVideos.length > 0) && (
            <div className="flex space-x-1 mb-2">
              {visibleImages.length > 0 && (
                <button
                  onClick={() => setSelectedImageIndex(0)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                    selectedImageIndex < visibleImages.length 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Photos ({visibleImages.length})
                </button>
              )}
              {visibleVideos.length > 0 && (
                <button
                  onClick={() => setSelectedImageIndex(visibleImages.length)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                    selectedImageIndex >= visibleImages.length
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Videos ({visibleVideos.length})
                </button>
              )}
            </div>
          )}

          {/* Main Media Display */}
          <div className="w-full h-64 sm:h-72 lg:h-80 rounded-lg overflow-hidden bg-gray-100">
            {selectedImageIndex < visibleImages.length ? (
              (() => {
                const imageSrc = visibleImages[selectedImageIndex];
                if (!imageSrc) {
                  return (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-700 text-sm font-medium">
                      Image unavailable
                    </div>
                  );
                }
                return (
                  <div
                    className="relative w-full h-full"
                    onContextMenu={isDigitalPreviewProtected ? (e) => e.preventDefault() : undefined}
                  >
                    <img
                      src={imageSrc}
                      alt={product.title}
                      className={`w-full h-full object-cover ${isDigitalPreviewProtected ? 'select-none pointer-events-none' : ''}`}
                      onError={() => markImageFailed(imageSrc)}
                      draggable={isDigitalPreviewProtected ? false : undefined}
                    />
                    {isDigitalPreviewProtected && (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/20" />
                        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
                          <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gray-900">
                            Preview Only
                          </span>
                        </div>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span className="rotate-[-18deg] text-3xl font-extrabold uppercase tracking-[0.35em] text-white/55">
                            Beezio Preview
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()
            ) : visibleVideos.length > 0 ? (
              (() => {
                const videoIndex = selectedImageIndex - visibleImages.length;
                const videoUrl = visibleVideos[videoIndex];
                if (!videoUrl) {
                  return (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-700 text-sm font-medium">
                      Video unavailable
                    </div>
                  );
                }

                const embedUrl = getVideoEmbedUrl(videoUrl);
                if (embedUrl) {
                  return (
                    <iframe
                      src={embedUrl}
                      className="w-full h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={`Video ${videoIndex + 1} for ${product.title}`}
                    />
                  );
                }

                if (isDirectVideoUrl(videoUrl) || /^https?:\/\//i.test(videoUrl) || videoUrl.startsWith('/')) {
                  return (
                    <video
                      src={videoUrl}
                      className="w-full h-full object-cover bg-black"
                      controls
                      playsInline
                      preload="metadata"
                      onError={() => markVideoFailed(videoUrl)}
                    />
                  );
                }

                return (
                  <div className="w-full h-full flex items-center justify-center bg-gray-200">
                    <div className="text-center">
                      <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm">Video not supported</p>
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 text-sm underline"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-700 text-sm font-medium">
                Media unavailable
              </div>
            )}
          </div>
          
          {/* Thumbnail Navigation */}
          <div className="flex space-x-2 overflow-x-auto pb-1">
            {visibleImages.map((image, index) => {
              return (
              <button
                key={`image-${index}`}
                onClick={() => setSelectedImageIndex(index)}
                onContextMenu={isDigitalPreviewProtected ? (e) => e.preventDefault() : undefined}
                className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 ${
                  selectedImageIndex === index ? 'border-amber-500' : 'border-gray-200'
                }`}
              >
                <img
                  src={image}
                  alt={`${product.title} ${index + 1}`}
                  className={`w-full h-full object-cover ${isDigitalPreviewProtected ? 'select-none pointer-events-none' : ''}`}
                  onError={() => markImageFailed(image)}
                  draggable={isDigitalPreviewProtected ? false : undefined}
                />
                {isDigitalPreviewProtected && (
                  <>
                    <div className="pointer-events-none absolute inset-0 bg-black/15" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rotate-[-18deg] text-[8px] font-extrabold uppercase tracking-[0.2em] text-white/80 sm:text-[10px]">
                        Preview
                      </span>
                    </div>
                  </>
                )}
              </button>
            )})}
            {visibleVideos.map((video, index) => (
              <button
                key={`video-${video}-${index}`}
                onClick={() => setSelectedImageIndex(visibleImages.length + index)}
                className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 bg-gray-100 flex items-center justify-center ${
                  selectedImageIndex === visibleImages.length + index ? 'border-amber-500' : 'border-gray-200'
                }`}
              >
                <Play className="w-6 h-6 text-gray-600" />
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="prose prose-gray max-w-none pt-1">
            <p className="text-gray-700 leading-relaxed">
              {displayDescription}
            </p>
          </div>

          {product.is_digital && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600">
              Preview images are display-only and watermarked. Do not upload your actual downloadable file as a preview image.
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-4">
          {/* Title, Rating, Price */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>

            {getProductIdentifierLines(product, selectedVariant).length > 0 && (
              <div className="mb-3 space-y-1">
                {getProductIdentifierLines(product, selectedVariant).map((line) => (
                  <div key={line} className="text-sm text-amber-700 font-medium">
                    {line}
                  </div>
                ))}
              </div>
            )}

            {Number(product.average_rating) > 0 && Number(product.review_count) > 0 && (
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex items-center">
                  <span className="text-yellow-400">★★★★★</span>
                </div>
                <span className="text-sm text-gray-600">
                  {product.average_rating.toFixed(1)} ({product.review_count || 0} reviews)
                </span>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <span data-testid="product-detail-price" className="text-3xl font-bold text-gray-900">
                  {showBuyerCtas ? formatMoneyDisplay(finalDisplayPrice) : formatMoneyDisplay(earningsAmount ?? 0)}
                </span>
                {showBuyerCtas && product.requires_shipping && (
                  <span className="text-sm text-gray-600">
                    {allowBackorder
                      ? 'Shipping calculated at checkout'
                      : formatShippingLineItem(Number((product as any)?.shipping_price ?? product.shipping_cost ?? 0))}
                  </span>
                )}
                {showBuyerCtas && product.is_digital && (
                  <span className="text-sm font-medium text-amber-700">Secure digital download</span>
                )}
              </div>

              {!showBuyerCtas && (
                <div className="text-xs text-gray-500">You would make</div>
              )}

              {showBuyerCtas && isOutOfStock && (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  Out of stock
                </div>
              )}
            </div>
          </div>

          {showBuyerCtas && product.is_digital && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold text-gray-900">Digital delivery</div>
              <div className="mt-1">This file is released only after payment to the purchasing account and can only be downloaded the number of times purchased.</div>
              <div className="mt-2">
                {product.digital_return_policy_notice || 'Once this digital product is downloaded, returns are not available. Contact the seller for any issues with the file.'}
              </div>
              {product.digital_download_instructions && (
                <div className="mt-2 text-gray-700">Seller note: {product.digital_download_instructions}</div>
              )}
            </div>
          )}

          {/* Add to Cart Section */}
          <div className="space-y-4">
            {showAffiliatePayoutPreview && commissionValue > 0 && (
              <div className="flex items-center space-x-2 mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <Heart className="w-4 h-4 mr-2" />
                  Creator-Supported Purchase
                </span>
                <span className="text-sm text-gray-600">
                  Helps independent sellers grow their business
                </span>
              </div>
            )}

            {showBuyerCtas && (
              <>
                {showAffiliatePayoutPreview && (
                  <div className="mb-2 text-xs text-green-700 font-semibold text-center">
                    Partner earns: ${affiliateEarnings?.toFixed(2)} per sale
                  </div>
                )}
                {/* Variant Selector */}
                {variantOptions.length > 0 && (
                  <div className="mb-4 space-y-3">
                    <div className="text-sm font-medium text-gray-700">Options</div>

                    {useAttributeSelectors ? (
                      <div className="space-y-3">
                        {meaningfulAttributeKeys.map((key) => (
                          <div key={key}>
                            <div className="text-xs font-semibold text-gray-600 mb-1">{key}</div>
                            <div className="flex flex-wrap gap-2">
                              {(attributeOptions[key] || []).map((value) => {
                                const selected = selectedAttributes[key] === value;
                                return (
                                  <button
                                    key={`${key}:${value}`}
                                    type="button"
                                    onClick={() => handleAttributeChange(key, value)}
                                    className={`px-3 py-1 rounded-full border text-sm transition-colors ${
                                      selected
                                        ? 'bg-amber-600 text-white border-amber-600'
                                        : 'bg-white text-gray-800 border-gray-300 hover:border-amber-400'
                                    }`}
                                  >
                                    {value}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {variantOptions.length > 1 && !selectedVariant && (
                          <div className="text-xs text-red-600">Please choose all options to continue.</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-600 block">Choose from</label>
                        <select
                          value={selectedVariantId}
                          onChange={(e) => handleVariantSelect(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        >
                          <option value="">Select an option…</option>
                          {variantOptions.map((variant) => (
                            <option key={String(variant.id)} value={String(variant.id)}>
                              {formatVariantLabel(variant)}
                            </option>
                          ))}
                        </select>
                        <div className="text-sm text-gray-600">
                          {selectedVariant ? `Selected: ${formatVariantLabel(selectedVariant)}` : 'Select a variant to continue.'}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                    Quantity:
                  </label>
                  <select
                    id="quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-2"
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>

              </>
            )}

            <div className="space-y-3">
              {showBuyerCtas && samplePrice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-amber-900">Order a sample</div>
                      <div className="text-xs text-amber-700">Sample price: ${samplePrice.toFixed(2)}</div>
                    </div>
                    <button
                      onClick={addSampleToCart}
                      className="px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800"
                    >
                      Buy Sample
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-amber-700">
                    Samples are final sale. Use them for videos and quality checks. Price includes platform + processing fees. No commissions on samples.
                  </p>
                </div>
              )}

              {/* Main Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => addToCart()}
                  disabled={isOutOfStock}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2 ${
                    isOutOfStock
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  <ShoppingCart className="w-5 h-5" />
                  <span>Add to Cart</span>
                </button>

                <button
                  onClick={handleBuyNow}
                  disabled={isOutOfStock}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
                    isOutOfStock ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  Buy Now
                </button>
              </div>

              {/* Shipping (after primary CTAs) */}
              {showBuyerCtas && product && productId && !isOutOfStock && (
                <div className="border-t border-gray-200 pt-4">
                  <ShippingSelector
                    productId={productId}
                    selectedShipping={selectedShipping}
                    onShippingChange={setSelectedShipping}
                  />
                </div>
              )}

              {/* Order Summary (after shipping selection) */}
              {showBuyerCtas && selectedShipping && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Order Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Product Price (×{quantity}):</span>
                      <span>{formatMoneyDisplay(finalDisplayPrice * quantity)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{selectedShipping.name}:</span>
                      <span>{formatShippingDisplay(selectedShipping.cost)}</span>
                    </div>
                    <div className="border-t border-gray-300 pt-1 mt-2">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total:</span>
                        <span>{formatMoneyDisplay(finalDisplayPrice * quantity + selectedShipping.cost)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showBuyerCtas && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <Heart className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-green-900">Support Independent Sellers</h4>
                      <p className="text-sm text-green-700">
                        Help creators and local businesses thrive!
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {showStoreAddCtas && (
                <div className="space-y-3">
                  {canAddToSellerStore && (
                    <AddToSellerStoreButton productId={product.id} size="lg" variant="button" addedText="Added" />
                  )}
                  {canAddToAffiliateStore && (
                    <AddToAffiliateStoreButton
                      productId={product.id}
                      sellerId={product.seller_id || ''}
                      productTitle={product.title}
                      productPrice={finalDisplayPrice}
                      defaultCommissionRate={product.commission_rate}
                      commissionType={product.commission_type}
                      flatCommissionAmount={product.flat_commission_amount}
                      size="lg"
                      addedText="Added"
                      ctaText="Click to start selling this product"
                    />
                  )}
                </div>
              )}

              {/* Sign Up Prompt for Non-Users */}
              {!user && (
                <div className="text-center py-2">
                  <p className="text-gray-600 text-sm">
                    Not registered? 
                    <button 
                      onClick={() => {
                        setAuthMode('register');
                        setShowAuthModal(true);
                      }}
                      className="text-purple-600 hover:text-purple-700 font-medium ml-1"
                    >
                      Sign up here
                    </button>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Social Proof & Reviews */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What Buyers Say</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {reviewCountDisplay} {reviewCountDisplay === 1 ? 'review' : 'reviews'}
                </span>
                <span className="flex items-center gap-1 font-medium text-gray-800">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  {reviewAverage > 0 ? reviewAverage.toFixed(1) : '0.0'}
                </span>
              </div>

              {reviewsLoading ? (
                <div className="text-sm text-gray-600">Loading reviews...</div>
              ) : reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.slice(0, 3).map((review) => {
                    const body = String(review.content || review.review || '').trim();
                    return (
                      <div key={review.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            {String(review.profiles?.full_name || 'Verified Buyer')}
                          </span>
                          <span className="flex items-center gap-1 text-amber-600 text-sm font-medium">
                            <Star className="w-4 h-4 fill-current" />
                            {Number(review.rating || 0).toFixed(1)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-gray-700">{body || 'Great product.'}</p>
                        <div className="mt-2 text-xs text-gray-500">
                          {review.created_at ? new Date(review.created_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No reviews yet. Be the first to leave one.</div>
              )}

              {reviewsError && <div className="text-sm text-red-600">{reviewsError}</div>}

              {user ? (
                hasUserReviewed ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    You already left a review for this product.
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="rounded-lg border border-gray-200 p-3 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your rating</label>
                      <select
                        value={reviewForm.rating}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: Number(e.target.value) || 5 }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value={5}>5 - Excellent</option>
                        <option value={4}>4 - Very good</option>
                        <option value={3}>3 - Good</option>
                        <option value={2}>2 - Fair</option>
                        <option value={1}>1 - Poor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your review</label>
                      <textarea
                        value={reviewForm.content}
                        onChange={(e) => setReviewForm((prev) => ({ ...prev, content: e.target.value }))}
                        rows={3}
                        placeholder="Share your experience with this product"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    {reviewSubmitError && <div className="text-sm text-red-600">{reviewSubmitError}</div>}
                    {reviewSubmitSuccess && <div className="text-sm text-green-700">{reviewSubmitSuccess}</div>}
                    <button
                      type="submit"
                      disabled={reviewSubmitting}
                      className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
                    >
                      {reviewSubmitting ? 'Submitting...' : 'Leave Review'}
                    </button>
                  </form>
                )
              ) : (
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                  }}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Sign in to leave a review
                </button>
              )}
            </div>
          </div>

          {/* Seller Info */}
          {isAdminRole && cjIdentity && (
            <div className="border-t border-gray-200 pt-6">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">CJ Identity</h3>
                    <p className="text-sm text-gray-700">Dashboard and storefront now read the same saved CJ record.</p>
                  </div>
                  {cjIdentity.product.cj_pid && (
                    <button
                      type="button"
                      onClick={() => window.open(`https://app.cjdropshipping.com/product-detail.html?pid=${encodeURIComponent(cjIdentity.product.cj_pid)}`, '_blank', 'noopener,noreferrer')}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#ffcb05] px-3 py-2 text-sm font-semibold text-black"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open matching CJ record
                    </button>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-white p-3 text-sm">
                    <div className="font-semibold text-gray-900">Parent/product-level</div>
                    <div className="mt-2 space-y-1 text-gray-700">
                      <div>CJ Product ID: {cjIdentity.product.cj_product_id || 'n/a'}</div>
                      <div>CJ PID: {cjIdentity.product.cj_pid || 'n/a'}</div>
                      <div>CJ Product Code: {cjIdentity.product.cj_product_code || 'n/a'}</div>
                      <div>CJ Product SKU: {cjIdentity.product.cj_product_sku || 'n/a'}</div>
                      <div>CJ SPU: {cjIdentity.product.cj_spu || 'n/a'}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cjIdentity.product.cj_product_code && (
                        <button
                          type="button"
                          onClick={() => void copyToClipboard('CJ Product Code', cjIdentity.product.cj_product_code)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800"
                        >
                          Copy CJ Product Code
                        </button>
                      )}
                      {cjIdentity.product.cj_product_sku && (
                        <button
                          type="button"
                          onClick={() => void copyToClipboard('CJ Product SKU', cjIdentity.product.cj_product_sku)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800"
                        >
                          Copy CJ Product SKU
                        </button>
                      )}
                      {cjIdentity.product.cj_spu && (
                        <button
                          type="button"
                          onClick={() => void copyToClipboard('CJ SPU', cjIdentity.product.cj_spu)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800"
                        >
                          Copy CJ SPU
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-3 text-sm">
                    <div className="font-semibold text-gray-900">Selected variant</div>
                    {cjIdentity.variant ? (
                      <>
                        <div className="mt-2 space-y-1 text-gray-700">
                          <div>CJ Variant ID: {cjIdentity.variant.cj_variant_id || 'n/a'}</div>
                          <div>CJ VID: {cjIdentity.variant.cj_vid || 'n/a'}</div>
                          <div>CJ Variant SKU: {cjIdentity.variant.cj_variant_sku || 'n/a'}</div>
                          <div>CJ Variant Code: {cjIdentity.variant.cj_variant_code || 'n/a'}</div>
                          <div>CJ SKU: {cjIdentity.variant.cj_sku || 'n/a'}</div>
                          <div>Option summary: {cjIdentity.variant.cj_option_summary || 'n/a'}</div>
                          <div>variant_display_sku: {cjIdentity.variant.variant_display_sku || 'n/a'}</div>
                          <div>is_orderable: {cjIdentity.variant.is_orderable ? 'yes' : 'no'}</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {cjIdentity.variant.cj_variant_code && (
                            <button
                              type="button"
                              onClick={() => void copyToClipboard('CJ Variant Code', cjIdentity.variant.cj_variant_code)}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800"
                            >
                              Copy CJ Variant Code
                            </button>
                          )}
                          {cjIdentity.variant.cj_variant_sku && (
                            <button
                              type="button"
                              onClick={() => void copyToClipboard('CJ Variant SKU', cjIdentity.variant.cj_variant_sku)}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800"
                            >
                              Copy CJ Variant SKU
                            </button>
                          )}
                          {cjIdentity.variant.cj_vid && (
                            <button
                              type="button"
                              onClick={() => void copyToClipboard('CJ VID', cjIdentity.variant.cj_vid)}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800"
                            >
                              Copy CJ VID
                            </button>
                          )}
                          {(cjIdentity.variant.cj_vid || cjIdentity.product.cj_pid) && (
                            <button
                              type="button"
                              onClick={() => window.open(`https://app.cjdropshipping.com/product-detail.html?pid=${encodeURIComponent(String(cjIdentity.product.cj_pid || ''))}`, '_blank', 'noopener,noreferrer')}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-800"
                            >
                              Open matching CJ record
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-gray-600">Select a variant to inspect CJ variant identity.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Seller Info */}
          <div className="border-t border-b py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Sold by {sellerStoreSettings?.store_name || product.profiles?.full_name || 'Unknown Seller'}
                </h3>
                <p className="text-sm text-gray-600">
                  Returns and support are handled directly by the seller.
                </p>
                {sellerStoreSettings?.return_policy && (
                  <p className="text-sm text-gray-600 mt-1">
                    Return policy: {sellerStoreSettings.return_policy}
                  </p>
                )}
              </div>
              <button
                onClick={() => setContactModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Message Seller
              </button>
            </div>
          </div>

          {/* Share Tools */}
          <div className="mt-4">
            <AffiliateShareWidget
              type="product"
              targetId={product.id}
              targetPath={shareProductPath}
              sellerId={product.seller_id}
              title={product.title}
            />
          </div>

        </div>
      </div>

      <StoreContactModal
        isOpen={contactModal}
        onClose={() => setContactModal(false)}
        ownerId={product?.seller_id || ''}
        ownerType="seller"
        storeName={sellerStoreSettings?.store_name || product?.profiles?.full_name || 'Seller'}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
        audience="buyer"
      />
    </div>
  );
};

export default ProductDetailPage;
