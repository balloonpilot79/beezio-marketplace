import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { ensureSellerProductInOrder } from '../utils/sellerProductOrder';
import ImageUpload from './ImageUpload';
import ImageGallery from './ImageGallery';
import { PricingBreakdown } from '../lib/pricing';
import { callGPT } from '../lib/gptClient';
import { useNavigate, useParams } from 'react-router-dom';
import { normalizeMoneyInput } from '../utils/pricing';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import { calculatePricing } from '../lib/pricing';
import { getAdminOnlyLowPriceMessage, isAdminUser } from '../utils/adminPricePolicy';
import { isTestItemTitle } from '../../shared/testItemPricing';
import { getNormalizedAccountRoles, isBuyerOnlyAccount } from '../utils/accountRoles';
import { normalizeProductVideos } from '../utils/imageHelpers';
import { evaluateListingGuardrails } from '../utils/listingGuardrails';

interface ProductFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  editMode?: boolean;
  product?: {
    title: string;
    description: string;
    images: string[];
    videos?: string[];
    shipping_options?: Array<Record<string, unknown>> | null;
    category_id: string;
    stock_quantity: number;
    is_subscription: boolean;
    subscription_interval: string;
    requires_shipping: boolean;
    shipping_price?: number;
    shipping_cost?: number;
    base_weight_oz?: number;
    package_length_in?: number;
    package_width_in?: number;
    package_height_in?: number;
  };
}

const normalizeCategoryToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const isDigitalCategoryOption = (category: { id?: string; name?: string }) => {
  const idToken = normalizeCategoryToken(category.id);
  const nameToken = normalizeCategoryToken(category.name);
  return idToken === 'digital-products' || nameToken === 'digital-products';
};

const DIGITAL_RETURN_POLICY_DEFAULT =
  'No refunds are available after a digital file is downloaded unless the file is corrupted, inaccessible, or materially different from the listing.';

const DIGITAL_CATEGORY_FALLBACK = { id: 'digital-products', name: 'Digital Products' };

const ProductForm: React.FC<ProductFormProps> = ({ onSuccess, onCancel, editMode, product }) => {
  const { user, profile, userRoles, currentRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { id: routeProductId } = useParams<{ id?: string }>();
  const MAX_IMAGES = 10;
  const MAX_VIDEOS = 3;
  const PRODUCT_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
  const showLegacyInlineAlerts = false;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const looksLikeUuid = (value: unknown): value is string => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return UUID_REGEX.test(trimmed);
  };
  const extractMissingColumnName = (message: string): string | null => {
    const match = message.match(/Could not find the ['"]([^'"]+)['"] column/i);
    if (match?.[1]) return match[1];
    const match2 = message.match(/column ['"]?([a-zA-Z0-9_]+)['"]? does not exist/i);
    if (match2?.[1]) return match2[1];
    return null;
  };
  const isSellerIdError = (err: any): boolean => {
    const code = String(err?.code || '');
    const message = String(err?.message || '').toLowerCase();
    return (
      code === '23503' || // foreign key violation
      code === '22P02' || // invalid input syntax (uuid)
      message.includes('seller_id') ||
      message.includes('foreign key')
    );
  };
  const forceMarketplaceListing = async (productId: string) => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      await fetch('/.netlify/functions/seller-activate-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: productId }),
      });
    } catch {
      // non-fatal
    }
  };

  const restoreCjSellability = async (productId: string) => {
    try {
      const { data: row, error } = await supabase
        .from('products')
        .select('id, source_platform, dropship_provider, lineage, cj_product_id, track_inventory')
        .eq('id', productId)
        .maybeSingle();
      if (error || !row) return;

      const sourcePlatform = String((row as any)?.source_platform || '').trim().toLowerCase();
      const provider = String((row as any)?.dropship_provider || '').trim().toLowerCase();
      const lineage = String((row as any)?.lineage || '').trim().toLowerCase();
      const hasCjProductId = Boolean(String((row as any)?.cj_product_id || '').trim());
      const isCjProduct =
        sourcePlatform === 'cj' ||
        provider === 'cj' ||
        lineage === 'cj' ||
        hasCjProductId;

      if (!isCjProduct) return;

      await supabase
        .from('products')
        .update({
          track_inventory: false,
          in_stock: true,
          is_active: true,
          status: 'active',
        })
        .eq('id', productId);
    } catch {
      // non-fatal
    }
  };

  const buildSingleShippingOption = (
    shippingPrice: number,
    includeInPrice: boolean = false
  ): Array<{ name: string; cost: number; estimated_days: string; included_in_price?: boolean; seller_shipping_cost?: number }> => [{
    name: includeInPrice ? 'Free Shipping' : 'Seller Shipping',
    cost: includeInPrice ? 0 : Math.max(0, shippingPrice),
    estimated_days: '3-5 business days',
    ...(includeInPrice ? { included_in_price: true, seller_shipping_cost: Math.max(0, shippingPrice) } : {}),
  }];

  const getShippingIncludedState = (raw: any): boolean => {
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    if (!Array.isArray(raw) || raw.length === 0) return false;
    return Boolean(raw[0]?.included_in_price);
  };

  const getStoredShippingAmount = (raw: any, fallback: number): number => {
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    if (!Array.isArray(raw) || raw.length === 0) return fallback;
    const stored = Number(raw[0]?.seller_shipping_cost);
    return Number.isFinite(stored) ? stored : fallback;
  };

  const normalizeShippingOptions = (
    raw: any,
    shippingPrice: number,
    includeInPrice: boolean = false
  ): Array<{ name: string; cost: number; estimated_days: string }> => {
    let options: any = raw;

    if (typeof options === 'string') {
      try {
        options = JSON.parse(options);
      } catch {
        options = null;
      }
    }

    if (!Array.isArray(options)) {
      return buildSingleShippingOption(shippingPrice, includeInPrice);
    }

    const normalized = options
      .map((option: any, index: number) => {
        const name = String(option?.name ?? option?.title ?? (index === 0 ? 'Standard Shipping' : 'Shipping'));
        const estimatedDays = String(option?.estimated_days ?? option?.days ?? option?.estimatedDays ?? '3-5 business days');
        const costRaw = option?.cost ?? option?.price ?? option?.shipping_price ?? option?.shippingPrice;
        const cost = Number.isFinite(Number(costRaw)) ? Number(costRaw) : 0;
        return {
          name,
          estimated_days: estimatedDays,
          cost,
        };
      })
      .filter((o: any) => (o?.name || '').trim().length > 0);

    if (normalized.length === 0) {
      return buildSingleShippingOption(shippingPrice, includeInPrice);
    }

    const paidOption = normalized.find((option) => (option.cost ?? 0) > 0);
    const effectiveCost =
      Number.isFinite(shippingPrice) && shippingPrice > 0
        ? shippingPrice
        : Number(paidOption?.cost ?? normalized[0]?.cost ?? 0) || 0;

    const option = buildSingleShippingOption(effectiveCost, includeInPrice)[0] as any;
    if (includeInPrice) {
      option.included_in_price = true;
      option.seller_shipping_cost = effectiveCost;
    }
    return [option];
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [digitalUploadLoading, setDigitalUploadLoading] = useState(false);
  const [showStickyAlert, setShowStickyAlert] = useState(false);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [pricingSeed, setPricingSeed] = useState<{
    sellerAmount: number;
    affiliateAmount: number;
    affiliateType: 'percent' | 'flat';
  }>({
    sellerAmount: 0,
    affiliateAmount: 0,
    affiliateType: 'percent',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aliExpressUrl, setAliExpressUrl] = useState('');
  const [aliExpressExternalProductId, setAliExpressExternalProductId] = useState('');
  const [aliExpressSupplierSku, setAliExpressSupplierSku] = useState('');
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  const normalizedAccountRoles = getNormalizedAccountRoles(userRoles, profile?.primary_role, profile?.role, currentRole);
  const buyerOnlyAccount = Boolean(user && isBuyerOnlyAccount(normalizedAccountRoles));

  const [formData, setFormData] = useState({
    title: product?.title || '',
    description: product?.description || '',
    images: product?.images || [],
    videos: product?.videos || [],
    tags: [] as string[],
    category_id: product?.category_id || '',
    stock_quantity: product?.stock_quantity || 1,
    is_subscription: product?.is_subscription || false,
    subscription_interval: product?.subscription_interval || '',
    affiliate_enabled: true, // DEFAULT TO TRUE - Business preference
    shipping_options: buildSingleShippingOption(product?.shipping_price ?? (product as any)?.shipping_cost ?? 0),
    requires_shipping: product?.requires_shipping !== false,
    shipping_price: product?.shipping_price ?? (product as any)?.shipping_cost ?? 0,
    shipping_included_in_price: getShippingIncludedState(product?.shipping_options),
    base_weight_oz: Number((product as any)?.base_weight_oz || 0) || 0,
    package_length_in: Number((product as any)?.package_length_in || 0) || 0,
    package_width_in: Number((product as any)?.package_width_in || 0) || 0,
    package_height_in: Number((product as any)?.package_height_in || 0) || 0,
    is_digital: (product as any)?.is_digital === true,
    digital_download_bucket: (product as any)?.digital_download_bucket || '',
    digital_download_path: (product as any)?.digital_download_path || '',
    digital_download_filename: (product as any)?.digital_download_filename || '',
    digital_download_content_type: (product as any)?.digital_download_content_type || '',
    digital_download_file_size: Number((product as any)?.digital_download_file_size || 0) || 0,
    digital_download_limit: Math.max(1, Number((product as any)?.digital_download_limit || 1)),
    digital_download_instructions: (product as any)?.digital_download_instructions || '',
    digital_return_policy_notice: (product as any)?.digital_return_policy_notice || DIGITAL_RETURN_POLICY_DEFAULT,
  });

  useEffect(() => {
    if (pricingSeed.sellerAmount <= 0) {
      setPricingBreakdown(null);
      return;
    }

    const nextBreakdown = calculatePricing({
      sellerDesiredAmount: pricingSeed.sellerAmount,
      affiliateRate: formData.affiliate_enabled ? pricingSeed.affiliateAmount : 0,
      affiliateType: pricingSeed.affiliateType === 'flat' ? 'flat_rate' : 'percentage',
      shippingIncludedAmount: (formData as any).shipping_included_in_price ? Number(formData.shipping_price) || 0 : 0,
      referralRate: 0,
      platformFeeRate: undefined,
      testItem: isTestItemTitle(formData.title),
    });

    setPricingBreakdown(nextBreakdown);
  }, [formData.affiliate_enabled, formData.shipping_included_in_price, formData.shipping_price, formData.title, pricingSeed]);

  // Use hard navigation from success CTAs to avoid rare router state stalls after save.
  const goTo = (path: string) => {
    window.location.assign(path);
  };
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      images: [],
      videos: [],
      tags: [],
      category_id: '',
      stock_quantity: 1,
      is_subscription: false,
      subscription_interval: '',
      affiliate_enabled: true,
      shipping_options: buildSingleShippingOption(0),
      requires_shipping: true,
      shipping_price: 0,
      shipping_included_in_price: false,
      base_weight_oz: 0,
      package_length_in: 0,
      package_width_in: 0,
      package_height_in: 0,
      is_digital: false,
      digital_download_bucket: '',
      digital_download_path: '',
      digital_download_filename: '',
      digital_download_content_type: '',
      digital_download_file_size: 0,
      digital_download_limit: 1,
      digital_download_instructions: '',
      digital_return_policy_notice: DIGITAL_RETURN_POLICY_DEFAULT,
    });
    setPricingBreakdown(null);
    setPricingSeed({
      sellerAmount: 0,
      affiliateAmount: 0,
      affiliateType: 'percent',
    });
    setProductImages([]);
    setAliExpressUrl('');
    setAliExpressExternalProductId('');
    setAliExpressSupplierSku('');
  };

  const parsePositiveNumber = (value: unknown, fallback = 0): number => {
    const parsed = Number.parseFloat(String(value ?? '').trim());
    return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
  };

  const runAliExpressAutofill = async (): Promise<boolean> => {
    setError(null);
    setSuccess(null);

    const normalizedUrl = String(aliExpressUrl || '').trim();
    if (!normalizedUrl) {
      setError('Paste an AliExpress product URL first.');
      return false;
    }

    try {
      setAutoFillLoading(true);
      const response = await fetch('/api/aliexpress/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });

      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `AliExpress auto-fill failed (${response.status})`);
      }

      const data = payload?.data || {};
      const title = String(data?.title || '').trim();
      const description = String(data?.description || '').trim();
      const images = Array.isArray(data?.images) ? data.images.map((item: unknown) => String(item || '').trim()).filter(Boolean) : [];
      const videos = normalizeProductVideos(data?.videos);
      const sourcePrice = parsePositiveNumber(data?.sourcePrice, 0);
      const shippingCost = parsePositiveNumber(data?.shippingCost, 0);
      const externalProductId = String(data?.externalProductId || '').trim();
      const supplierSku = String(data?.supplierSku || '').trim();

      setFormData((prev) => {
        const mergedImages = [...new Set([...images, ...prev.images])].slice(0, MAX_IMAGES);
        const mergedVideos = [...new Set([...videos, ...prev.videos])];
        const aliTags = ['AliExpress Imported'];
        if (externalProductId) aliTags.push(`AliExpress ID: ${externalProductId}`);
        const mergedTags = [...new Set([...prev.tags, ...aliTags])];
        const fallbackCategoryId = prev.category_id || categories[0]?.id || '';
        return {
          ...prev,
          title: title || prev.title,
          description: description || prev.description,
          images: mergedImages,
          videos: mergedVideos,
          tags: mergedTags,
          category_id: fallbackCategoryId,
          shipping_price: Number.isFinite(shippingCost) ? shippingCost : prev.shipping_price,
        };
      });

      if (externalProductId) setAliExpressExternalProductId(externalProductId);
      if (supplierSku) setAliExpressSupplierSku(supplierSku);

      if (sourcePrice > 0) {
        const nextPricing = calculatePricing({
          sellerDesiredAmount: sourcePrice,
          affiliateRate: 10,
          affiliateType: 'percentage',
          testItem: isTestItemTitle(formData.title || title),
        });
        setPricingSeed({
          sellerAmount: nextPricing.sellerBaseAmount || nextPricing.sellerAmount || sourcePrice,
          affiliateAmount: nextPricing.affiliateType === 'flat_rate' ? nextPricing.affiliateAmount : nextPricing.affiliateRate,
          affiliateType: nextPricing.affiliateType === 'flat_rate' ? 'flat' : 'percent',
        });
        setPricingBreakdown(nextPricing);
      }

      setSuccess('AliExpress auto-fill complete. Review details, then save.');
      return true;
    } catch (err: any) {
      setError(err?.message || 'AliExpress auto-fill failed.');
      return false;
    } finally {
      setAutoFillLoading(false);
    }
  };

  const handleAutoFillAndSave = async () => {
    if (loading || autoFillLoading) return;
    const ok = await runAliExpressAutofill();
    if (!ok) return;
    await handleSubmit();
  };

  const generateCopyWithAI = async () => {
    setAiLoading(true);
    try {
      const prompt = `Write a concise product title, 3 short bullet features, and 8-12 tags for an ecommerce listing. Return as JSON with keys title, bullets (array), tags (array). Use the details:\nTitle: ${formData.title}\nDescription: ${formData.description}\nCategory: ${formData.category_id || 'Uncategorized'}`;
      const reply = await callGPT({
        mode: 'product_copy',
        messages: [{ role: 'user', content: prompt }],
      });
      const parsed = JSON.parse(reply);
      if (parsed.title) handleInputChange('title', parsed.title);
      if (Array.isArray(parsed.bullets)) {
        handleInputChange('description', parsed.bullets.join(' • ') + (formData.description ? `\n\n${formData.description}` : ''));
      }
      if (Array.isArray(parsed.tags)) {
        setFormData(prev => ({ ...prev, tags: parsed.tags.map((t: any) => String(t)) }));
      }
    } catch (err: any) {
      alert(`AI copy generation failed: ${err.message || err}`);
    } finally {
      setAiLoading(false);
    }
  };

  const [productImages, setProductImages] = useState<any[]>([]);
  const [currentProductId, setCurrentProductId] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const editProductId = editMode && looksLikeUuid(routeProductId) ? routeProductId.trim() : null;

  // Load product for editing
  React.useEffect(() => {
    if (!editProductId) return;

    setCurrentProductId(editProductId);
    (async () => {
      try {
        const { data } = await supabase.from('products').select('*').eq('id', editProductId).single();
        if (data) {
          const shippingIncludedInPrice = getShippingIncludedState(data.shipping_options);
          const shippingPrice = getStoredShippingAmount(
            data.shipping_options,
            data.shipping_price ?? data.shipping_cost ?? 0
          );
          const imageUrls = Array.isArray(data.images)
            ? data.images.map((value: unknown) => String(value || '').trim()).filter(Boolean)
            : [];

          setFormData({
            title: data.title,
            description: data.description,
            images: imageUrls,
            videos: normalizeProductVideos(data.videos),
            tags: Array.isArray(data.tags) ? data.tags : [],
            category_id: data.category_id || '',
            stock_quantity: data.stock_quantity || 1,
            is_subscription: data.is_subscription || false,
            subscription_interval: data.subscription_interval || '',
            affiliate_enabled: data.affiliate_enabled !== false,
            shipping_options: normalizeShippingOptions(data.shipping_options, shippingPrice, shippingIncludedInPrice),
            requires_shipping: data.requires_shipping !== false,
            shipping_price: shippingPrice,
            shipping_included_in_price: shippingIncludedInPrice,
            base_weight_oz: Number(data.base_weight_oz || 0) || 0,
            package_length_in: Number((data as any).package_length_in || 0) || 0,
            package_width_in: Number((data as any).package_width_in || 0) || 0,
            package_height_in: Number((data as any).package_height_in || 0) || 0,
            is_digital: data.is_digital === true,
            digital_download_bucket: data.digital_download_bucket || '',
            digital_download_path: data.digital_download_path || '',
            digital_download_filename: data.digital_download_filename || '',
            digital_download_content_type: data.digital_download_content_type || '',
            digital_download_file_size: Number(data.digital_download_file_size || 0) || 0,
            digital_download_limit: Math.max(1, Number((data as any).digital_download_limit || 1)),
            digital_download_instructions: data.digital_download_instructions || '',
            digital_return_policy_notice: data.digital_return_policy_notice || DIGITAL_RETURN_POLICY_DEFAULT,
          });
          setProductImages(
            imageUrls.map((url: string, index: number) => ({
              id: `${editProductId}-${index}`,
              image_url: url,
              display_order: index,
              is_primary: index === 0,
            }))
          );
          setPricingBreakdown({
            sellerBaseAmount: Math.max(
              0,
              Number(data.seller_amount ?? data.seller_ask ?? data.seller_ask_price ?? 0) - (shippingIncludedInPrice ? shippingPrice : 0)
            ),
            shippingIncludedAmount: shippingIncludedInPrice ? shippingPrice : 0,
            sellerAmount: data.seller_amount ?? data.seller_ask ?? data.seller_ask_price ?? 0,
            affiliateAmount: data.commission_type === 'flat_rate'
              ? data.flat_commission_amount || data.affiliate_commission_value || 0
              : (data.seller_amount ?? data.seller_ask ?? data.seller_ask_price ?? 0) * ((data.commission_rate || data.affiliate_commission_value || 0) / 100),
            platformFee: data.platform_fee,
            processingFee: data.processing_fee ?? data.paypal_fee ?? 0,
            listingPrice: data.price,
            affiliateRate: data.commission_type === 'flat_rate'
              ? data.flat_commission_amount || data.affiliate_commission_value || 0
              : data.commission_rate || data.affiliate_commission_value || 0,
            affiliateType: data.commission_type,
          });
          setPricingSeed({
            sellerAmount: Math.max(
              0,
              Number(data.seller_amount ?? data.seller_ask ?? data.seller_ask_price ?? 0) - (shippingIncludedInPrice ? shippingPrice : 0)
            ),
            affiliateAmount:
              data.commission_type === 'flat_rate'
                ? data.flat_commission_amount || data.affiliate_commission_value || 0
                : data.commission_rate || data.affiliate_commission_value || 0,
            affiliateType: data.commission_type === 'flat_rate' ? 'flat' : 'percent',
          });
        }
      } catch (error) {
        console.error('Error loading product data:', error);
      }
    })();
  }, [editProductId]);

  const [newTag, setNewTag] = useState('');

  // Default categories as fallback
  const defaultCategories = [
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
    DIGITAL_CATEGORY_FALLBACK,
    { id: 'services', name: 'Services' },
    { id: 'food-beverages', name: 'Food & Beverages' }
  ];

  const dedupeCategories = (input: Array<{ id: string; name: string }>) => {
    const seen = new Set<string>();
    return input.filter((category) => {
      const key = `${normalizeCategoryToken(category.name)}::${normalizeCategoryToken(category.id)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>(
    dedupeCategories([...defaultCategories]).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  );
  const [categoriesLoadedFromDatabase, setCategoriesLoadedFromDatabase] = useState(false);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [createdMarketplaceStatus, setCreatedMarketplaceStatus] = useState<'marketplace' | 'store_only' | null>(null);
  const digitalCategoryId = categories.find((category) => isDigitalCategoryOption(category))?.id || DIGITAL_CATEGORY_FALLBACK.id;

  useEffect(() => {
    if (error || success) setShowStickyAlert(true);
  }, [error, success]);

  const [variantConfig, setVariantConfig] = useState<{
    enabled: boolean;
    sizes: string[];
    colors: string[];
    customSize: string;
    customColor: string;
  }>({
    enabled: false,
    sizes: [],
    colors: [],
    customSize: '',
    customColor: '',
  });

  const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
  const COLOR_OPTIONS = ['Black', 'White', 'Gray', 'Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Brown', 'Navy', 'Beige'];
  const visibleSizeOptions = [...SIZE_OPTIONS, ...variantConfig.sizes.filter((size) => !SIZE_OPTIONS.includes(size))];
  const visibleColorOptions = [...COLOR_OPTIONS, ...variantConfig.colors.filter((color) => !COLOR_OPTIONS.includes(color))];

  // Debug: Log categories when they change
  useEffect(() => {
    console.log('📦 Categories state updated:', categories.length, 'categories');
    console.log('Categories:', categories);
  }, [categories]);

  useEffect(() => {
    // Try to load from database, but keep defaults if it fails
    (async () => {
      try {
        // Prefer sort_order when present, but fall back to name ordering for older schemas.
        let { data, error } = await supabase.from('categories').select('id, name').order('sort_order', { ascending: true });
        const msg = String((error as any)?.message || '');
        if (error && /sort_order/i.test(msg)) {
          ({ data, error } = await supabase.from('categories').select('id, name').order('name', { ascending: true }));
        }

        if (!error && data && data.length > 0) {
          console.log('Categories loaded from database:', data.length);
          setCategoriesLoadedFromDatabase(true);
          setCategories(
            dedupeCategories(
              [...data, DIGITAL_CATEGORY_FALLBACK].map((category) => ({
                id: String(category?.id || '').trim(),
                name: String(category?.name || '').trim(),
              }))
            ).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }))
          );
        } else {
          console.log('Using fallback categories');
          setCategoriesLoadedFromDatabase(false);
        }
      } catch (e) {
        console.log('Category fetch error, keeping defaults:', e);
        setCategoriesLoadedFromDatabase(false);
      }
    })();
  }, []);

  const toggleVariantValue = (group: 'sizes' | 'colors', value: string) => {
    setVariantConfig((prev) => {
      const existing = prev[group];
      const next = existing.includes(value) ? existing.filter((v) => v !== value) : [...existing, value];
      return { ...prev, [group]: next };
    });
  };

  const addCustomVariantValue = (group: 'sizes' | 'colors') => {
    setVariantConfig((prev) => {
      const raw = group === 'sizes' ? prev.customSize : prev.customColor;
      const cleaned = String(raw || '').trim();
      if (!cleaned) return prev;
      const existing = prev[group];
      if (existing.includes(cleaned)) {
        return { ...prev, ...(group === 'sizes' ? { customSize: '' } : { customColor: '' }) };
      }
      return {
        ...prev,
        [group]: [...existing, cleaned],
        ...(group === 'sizes' ? { customSize: '' } : { customColor: '' }),
      };
    });
  };

  const generateVariantRows = (params: {
    productId: string;
    basePrice: number;
    totalStock: number;
  }) => {
    const sizes = variantConfig.sizes;
    const colors = variantConfig.colors;

    const combos: Array<{ size?: string; color?: string }> = [];
    if (sizes.length && colors.length) {
      for (const size of sizes) for (const color of colors) combos.push({ size, color });
    } else if (sizes.length) {
      for (const size of sizes) combos.push({ size });
    } else if (colors.length) {
      for (const color of colors) combos.push({ color });
    }

    if (!combos.length) return [];

    const count = combos.length;
    const safeStock = Number.isFinite(params.totalStock) ? Math.max(0, Math.floor(params.totalStock)) : 0;
    const baseQty = count > 0 ? Math.floor(safeStock / count) : 0;
    let remainder = count > 0 ? safeStock % count : 0;

    return combos.map((c) => {
      const inventory = baseQty + (remainder-- > 0 ? 1 : 0);
      return {
        product_id: params.productId,
        price: params.basePrice,
        inventory,
        is_active: true,
        attributes: c,
      };
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]:
        name === 'stock_quantity' || name === 'digital_download_limit'
          ? parseInt(value) || 0
          : ['shipping_price', 'base_weight_oz', 'package_length_in', 'package_width_in', 'package_height_in'].includes(name)
            ? parseFloat(value) || 0
            : value,
    }));
  };

  const setProductType = (nextIsDigital: boolean) => {
    setError(null);
    setFormData((prev) => ({
      ...prev,
      is_digital: nextIsDigital,
      category_id: nextIsDigital ? digitalCategoryId : (isDigitalCategoryOption({ id: prev.category_id, name: prev.category_id }) ? '' : prev.category_id),
      requires_shipping: nextIsDigital ? false : prev.requires_shipping,
      shipping_price: nextIsDigital ? 0 : prev.shipping_price,
      shipping_included_in_price: nextIsDigital ? false : prev.shipping_included_in_price,
      shipping_options: nextIsDigital ? [] : prev.shipping_options,
      digital_download_limit: Math.max(1, Number((prev as any).digital_download_limit || 1)),
      digital_return_policy_notice: String((prev as any).digital_return_policy_notice || '').trim() || DIGITAL_RETURN_POLICY_DEFAULT,
    }));
  };

  const sanitizeStorageFileName = (value: string) => {
    const trimmed = String(value || '').trim();
    const extensionIndex = trimmed.lastIndexOf('.');
    const extension = extensionIndex > 0 ? trimmed.slice(extensionIndex).replace(/[^a-zA-Z0-9.]/g, '') : '';
    const baseName = (extensionIndex > 0 ? trimmed.slice(0, extensionIndex) : trimmed)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'download';
    return `${baseName}${extension.slice(0, 12)}`;
  };

  const uploadDigitalFile = async (file: File) => {
    if (!user?.id) {
      setError('Sign in again before uploading a digital file.');
      return;
    }

    try {
      setDigitalUploadLoading(true);
      setError(null);
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error('Sign in again before uploading a digital file.');

      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const base64 = result.includes(',') ? result.split(',').pop() || '' : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });

      const safeFilename = sanitizeStorageFileName(file.name);
      const path = `${user.id}/${Date.now()}-${safeFilename}`;
      const response = await fetch('/.netlify/functions/upload-digital-product-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          path,
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          fileData,
        }),
      });
      const payload = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(String((payload as any)?.error || 'Digital file upload failed.'));
      }

      setFormData((prev) => ({
        ...prev,
        is_digital: true,
        category_id: digitalCategoryId,
        requires_shipping: false,
        shipping_price: 0,
        shipping_included_in_price: false,
        shipping_options: [],
        digital_download_bucket: String((payload as any)?.bucket || ''),
        digital_download_path: String((payload as any)?.path || ''),
        digital_download_filename: String((payload as any)?.filename || file.name),
        digital_download_content_type: String((payload as any)?.contentType || file.type || 'application/octet-stream'),
        digital_download_file_size: Number((payload as any)?.fileSize || file.size || 0) || 0,
        digital_return_policy_notice: String(prev.digital_return_policy_notice || '').trim() || DIGITAL_RETURN_POLICY_DEFAULT,
      }));
      setSuccess(`Digital file uploaded: ${file.name}`);
    } catch (err: any) {
      setError(err?.message || 'Digital file upload failed.');
    } finally {
      setDigitalUploadLoading(false);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index),
    }));
  };

  const handleImageUploadSuccess = (uploadedImages: string[]) => {
    if (!uploadedImages || uploadedImages.length === 0) {
      return;
    }

    // Clear any prior image validation error when uploads succeed
    setError(null);

    setFormData(prev => {
      const newImages = uploadedImages.filter(url => url && !prev.images.includes(url));
      if (newImages.length === 0) {
        return prev;
      }

      const merged = [...prev.images, ...newImages];
      if (merged.length > MAX_IMAGES) {
        setError(`You can upload up to ${MAX_IMAGES} images per product`);
      }

      return {
        ...prev,
        images: merged.slice(0, MAX_IMAGES),
      };
    });

    if (currentProductId) {
      // For editing mode, allow gallery refresh while Supabase metadata catches up
      setProductImages(prev => {
        const merged = [...prev, ...uploadedImages];
        return merged.slice(0, MAX_IMAGES);
      });
    }
  };

  const handleVideoUploadSuccess = (uploadedVideos: string[]) => {
    if (!uploadedVideos || uploadedVideos.length === 0) {
      return;
    }

    setError(null);

    setFormData(prev => {
      const newVideos = uploadedVideos.filter(url => url && !prev.videos.includes(url));
      if (newVideos.length === 0) {
        return prev;
      }

      const merged = [...prev.videos, ...newVideos];
      if (merged.length > MAX_VIDEOS) {
        setError(`You can upload up to ${MAX_VIDEOS} videos per product`);
      }

      return {
        ...prev,
        videos: merged.slice(0, MAX_VIDEOS),
      };
    });
  };

  const addPlaceholderImage = () => {
    setError(null);
    const placeholderUrl = `/api/placeholder/800/800?v=${Date.now()}`;

    setFormData((prev) => {
      const existing = Array.isArray(prev.images) ? prev.images : [];
      // Keep it to one placeholder by default.
      if (existing.some((u) => String(u || '').startsWith('/api/placeholder/'))) {
        return prev;
      }

      const merged = [placeholderUrl, ...existing].slice(0, MAX_IMAGES);
      return { ...prev, images: merged };
    });

    if (currentProductId) {
      setProductImages((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        if (existing.some((u) => String(u || '').startsWith('/api/placeholder/'))) {
          return existing;
        }
        return [placeholderUrl, ...existing].slice(0, MAX_IMAGES);
      });
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const removeVideo = (index: number) => {
    setFormData(prev => ({
      ...prev,
      videos: prev.videos.filter((_, i) => i !== index),
    }));
  };

  const ensureSellerProfileId = async (): Promise<string | null> => {
    if (profile?.id) {
      return profile.id;
    }
    if (!user) {
      return null;
    }

    try {
      const fullName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        'Seller';

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: user.id,
            email: user.email,
            full_name: fullName,
            role: 'seller',
            primary_role: 'seller',
          },
          { onConflict: 'user_id', returning: 'representation' }
        );

      if (error) {
        console.error('Unable to create seller profile for user:', error);
        return null;
      }

      return data?.[0]?.id || null;
    } catch (error) {
      console.error('Unexpected error while ensuring seller profile:', error);
      return null;
    }
  };

  async function handleSubmit(e?: React.FormEvent, addAnother: boolean = false) {
    if (e) e.preventDefault();
    if (submitLockRef.current || loading) return;
    submitLockRef.current = true;
    const abortSubmit = (message: string) => {
      setError(message);
      submitLockRef.current = false;
    };
    
    if (!user) {
      abortSubmit('You must be logged in to create a product');
      return;
    }
    if (buyerOnlyAccount) {
      abortSubmit('Customer accounts can view purchases in the customer dashboard. Open a Beezio business account before creating products.');
      return;
    }

    // IMPORTANT: In production, `profiles.id` may not equal `auth.users.id`.
    // Always resolve the canonical profile id for FK writes (products.seller_id).
    let sellerProfileId = await resolveProfileIdForUser(user.id);
    if (!sellerProfileId || sellerProfileId === user.id) {
      const ensured = await ensureSellerProfileId();
      if (ensured) {
        sellerProfileId = ensured;
      }
    }

    if (!sellerProfileId) {
      abortSubmit('We could not find your seller profile. Please refresh or complete your profile.');
      return;
    }

    if (!pricingBreakdown) {
      abortSubmit('Please configure your pricing first');
      return;
    }
    const affiliateEnabled = formData.affiliate_enabled !== false;
    if (!formData.title.trim()) {
      abortSubmit('Please add a product title');
      return;
    }
    if (!formData.description.trim()) {
      abortSubmit('Please add a product description');
      return;
    }
    if (!formData.category_id) {
      abortSubmit('Please select a category');
      return;
    }
    if (!formData.images || formData.images.length === 0) {
      abortSubmit('Please upload at least one product image');
      return;
    }
    if (formData.images.length > MAX_IMAGES) {
      abortSubmit(`Please keep product images to ${MAX_IMAGES} or fewer`);
      return;
    }

    const isDigitalProduct = (formData as any).is_digital === true;
    const normalizedShippingOptions = isDigitalProduct
      ? []
      : normalizeShippingOptions(
          (formData as any).shipping_options,
          Number(formData.shipping_price) || 0,
          (formData as any).shipping_included_in_price === true
        );

    const shippingCharge = isDigitalProduct
      ? 0
      : (formData as any).shipping_included_in_price === true
        ? (Number(formData.shipping_price) || 0)
        : 0;
    const adminOnlyPriceError = getAdminOnlyLowPriceMessage({
      isAdmin: isAdminUser({ profile, user, userRoles }),
      listingPrice: pricingBreakdown.listingPrice,
      sellerAmount: pricingBreakdown.sellerAmount,
      shippingAmount: shippingCharge,
      flatCommissionAmount:
        pricingBreakdown.affiliateType === 'flat_rate' ? pricingBreakdown.affiliateAmount : 0,
    });
    if (adminOnlyPriceError) {
      abortSubmit(adminOnlyPriceError);
      return;
    }

    // Validate shipping configuration
    if (!isDigitalProduct && formData.requires_shipping) {
      if (!normalizedShippingOptions || normalizedShippingOptions.length === 0) {
        abortSubmit('Please add at least one shipping option');
        return;
      }

      // Check that all shipping options have required fields
      for (const option of normalizedShippingOptions) {
        if (!String(option?.name || '').trim()) {
          abortSubmit('All shipping options must have a name');
          return;
        }
        if (!String(option?.estimated_days || '').trim()) {
          abortSubmit('All shipping options must have estimated delivery time');
          return;
        }
        if ((option.cost ?? 0) < 0) {
          abortSubmit('Shipping costs cannot be negative');
          return;
        }
      }
    }

    if (!isDigitalProduct && formData.shipping_price < 0) {
      abortSubmit('Shipping price cannot be negative');
      return;
    }

    if (!isDigitalProduct && formData.requires_shipping) {
      if ((Number(formData.shipping_price) || 0) < 0) {
        abortSubmit('Shipping price cannot be negative');
        return;
      }
    }

    if (isDigitalProduct && !String((formData as any).digital_download_path || '').trim()) {
      abortSubmit('Upload the digital file before saving this product.');
      return;
    }

    if (isDigitalProduct && Number((formData as any).digital_download_limit || 0) < 1) {
      abortSubmit('Digital download limit must be at least 1.');
      return;
    }

    const categorySelection = String(formData.category_id || '').trim();
    const selectedCategoryName =
      categories.find((category) => String(category.id) === categorySelection)?.name || categorySelection || null;

    const listingGuardrailResult = await evaluateListingGuardrails({
      sellerId: sellerProfileId,
      title: formData.title,
      description: formData.description,
      images: formData.images,
      tags: formData.tags,
      categoryId: categorySelection || null,
      categoryName: selectedCategoryName,
      sellerAsk: Number(pricingBreakdown.sellerAmount || 0),
      listingPrice: Number(pricingBreakdown.listingPrice || 0),
      stockQuantity: Number(formData.stock_quantity || 0),
    });

    if (listingGuardrailResult.action === 'block') {
      abortSubmit(`Listing blocked: ${listingGuardrailResult.hardReasons.join(' ')}`);
      return;
    }

    const requiresManualReview = false;


    setLoading(true);
    setError(null);
    setSuccess(null);
    setCreatedProductId(null);
    setCreatedMarketplaceStatus(null);

    try {
      let savedProductId: string | null = null;
      const normalizedCategoryId =
        categoriesLoadedFromDatabase && categories.some((category) => String(category.id) === categorySelection)
          ? categorySelection
          : looksLikeUuid(categorySelection)
            ? categorySelection
            : null;
      const normalizedCategoryName =
        categories.find((c) => String(c.id) === categorySelection)?.name || categorySelection || null;
      const normalizedAliExpressUrl = String(aliExpressUrl || '').trim();
      const normalizedExternalProductId = String(aliExpressExternalProductId || '').trim();
      const normalizedSupplierSku = String(aliExpressSupplierSku || '').trim();
      const isAliExpressImport = Boolean(normalizedAliExpressUrl);
      const importTags = isAliExpressImport
        ? [
            'AliExpress Imported',
            ...(normalizedExternalProductId ? [`AliExpress ID: ${normalizedExternalProductId}`] : []),
          ]
        : [];
      const mergedTags = [...new Set([...formData.tags, ...importTags])];
      const importPayloadFields = isAliExpressImport
        ? {
            source_platform: 'aliexpress',
            external_product_id: normalizedExternalProductId || null,
            dropship_provider: 'aliexpress',
            is_dropshipped: true,
            supplier_name: 'AliExpress',
            supplier_product_id: normalizedSupplierSku || normalizedExternalProductId || null,
            supplier_url: normalizedAliExpressUrl,
            supplier_info: {
              supplier_name: 'AliExpress',
              supplier_product_id: normalizedSupplierSku || normalizedExternalProductId || null,
              supplier_url: normalizedAliExpressUrl,
              is_dropshipped: true,
            },
          }
        : {};

      if (editMode) {
        // Update product
        const productId = editProductId;
        if (!productId) {
          throw new Error('Missing product id for edit.');
        }
        const updatePayload: any = {
            title: formData.title,
            description: formData.description,
            price: pricingBreakdown.listingPrice,
            commission_rate: affiliateEnabled && pricingBreakdown.affiliateType === 'percentage' ? pricingBreakdown.affiliateRate : 0,
            commission_type: pricingBreakdown.affiliateType,
            flat_commission_amount: affiliateEnabled && pricingBreakdown.affiliateType === 'flat_rate' ? pricingBreakdown.affiliateAmount : 0,
            images: formData.images,
            videos: formData.videos,
            tags: mergedTags,
            category: normalizedCategoryName,
            category_id: normalizedCategoryId,
            stock_quantity: formData.stock_quantity,
            total_inventory: Number.isFinite(formData.stock_quantity) ? formData.stock_quantity : null,
            is_subscription: formData.is_subscription,
            subscription_interval: formData.is_subscription ? formData.subscription_interval : null,
            seller_amount: pricingBreakdown.sellerAmount,
            seller_ask: pricingBreakdown.sellerAmount,
            seller_ask_price: pricingBreakdown.sellerAmount,
            platform_fee: pricingBreakdown.platformFee,
            processing_fee: pricingBreakdown.processingFee,
            shipping_options: normalizedShippingOptions,
            requires_shipping: isDigitalProduct ? false : formData.requires_shipping,
            shipping_price: shippingCharge,
            shipping_cost: shippingCharge,
            base_weight_oz: isDigitalProduct ? null : Number(formData.base_weight_oz) || 0,
            package_length_in: isDigitalProduct ? null : Number((formData as any).package_length_in) || 0,
            package_width_in: isDigitalProduct ? null : Number((formData as any).package_width_in) || 0,
            package_height_in: isDigitalProduct ? null : Number((formData as any).package_height_in) || 0,
            is_digital: isDigitalProduct,
            digital_download_bucket: isDigitalProduct ? (formData as any).digital_download_bucket : null,
            digital_download_path: isDigitalProduct ? (formData as any).digital_download_path : null,
            digital_download_filename: isDigitalProduct ? (formData as any).digital_download_filename : null,
            digital_download_content_type: isDigitalProduct ? (formData as any).digital_download_content_type : null,
            digital_download_file_size: isDigitalProduct ? (formData as any).digital_download_file_size : null,
            digital_download_limit: isDigitalProduct ? Math.max(1, Number((formData as any).digital_download_limit || 1)) : null,
            digital_download_instructions: isDigitalProduct ? (formData as any).digital_download_instructions : null,
            digital_return_policy_notice: isDigitalProduct ? (formData as any).digital_return_policy_notice : null,
            affiliate_enabled: affiliateEnabled,
            affiliate_commission_type: pricingBreakdown.affiliateType === 'flat_rate' ? 'flat' : 'percent',
            affiliate_commission_value: affiliateEnabled ? pricingBreakdown.affiliateRate : 0,
             calculated_customer_price: pricingBreakdown.listingPrice,
             status: requiresManualReview ? 'draft' : affiliateEnabled ? 'active' : 'store_only',
             is_promotable: affiliateEnabled && !requiresManualReview,
             is_active: !requiresManualReview,
             has_variants: Boolean(variantConfig.enabled),
             ...importPayloadFields,
           };

        // Schema-tolerant update: drop missing keys and retry (for staged DB rollouts).
        let lastError: any = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          const { error } = await supabase.from('products').update(updatePayload).eq('id', productId).select().single();
          if (!error) {
            lastError = null;
            break;
          }
          lastError = error;
          const message = String((error as any)?.message || '');
          const missing = extractMissingColumnName(message);
          if (missing && Object.prototype.hasOwnProperty.call(updatePayload, missing)) {
            delete updatePayload[missing];
            continue;
          }
          break;
        }
        if (lastError) throw lastError;

        // Ensure the item is present in the seller's storefront list + ordering dashboard.
        await ensureSellerProductInOrder({ sellerId: sellerProfileId, productId });
        setCreatedProductId(productId);
        savedProductId = productId;

        // Optional: create/update variants for this product (best-effort).
        if (variantConfig.enabled) {
          try {
            const variantRows = generateVariantRows({
              productId,
              basePrice: Number(pricingBreakdown.listingPrice || 0),
              totalStock: Number(formData.stock_quantity || 0),
            });
            if (variantRows.length) {
              // Clear existing variants first (best effort; ignore if table/RLS differs)
              try {
                await supabase.from('product_variants').delete().eq('product_id', productId);
              } catch {
                // ignore
              }

              let payloadRows: any[] = variantRows.map((r) => ({ ...r }));
              for (let attempt = 0; attempt < 6; attempt++) {
                const res = await supabase.from('product_variants').insert(payloadRows).select('id').limit(1);
                if (!res.error) break;
                const message = String((res.error as any)?.message || '');
                const missing = extractMissingColumnName(message);
                if (missing) {
                  payloadRows = payloadRows.map((row) => {
                    const next = { ...row };
                    delete (next as any)[missing];
                    return next;
                  });
                  continue;
                }
                break;
              }

              // Mark product as having variants when supported.
              try {
                await supabase.from('products').update({ has_variants: true }).eq('id', productId);
              } catch {
                // ignore
              }
            }
          } catch (e) {
            console.warn('[ProductForm] variant generation failed (non-fatal):', e);
          }
        }
      } else {
        // Create product
        let insertPayload: any = {
            title: formData.title,
            description: formData.description,
            price: pricingBreakdown.listingPrice,
            commission_rate: affiliateEnabled && pricingBreakdown.affiliateType === 'percentage' ? pricingBreakdown.affiliateRate : 0,
            commission_type: pricingBreakdown.affiliateType,
            flat_commission_amount: affiliateEnabled && pricingBreakdown.affiliateType === 'flat_rate' ? pricingBreakdown.affiliateAmount : 0,
            images: formData.images,
            videos: formData.videos,
            tags: mergedTags,
            category: normalizedCategoryName,
            category_id: normalizedCategoryId,
            stock_quantity: formData.stock_quantity,
            is_subscription: formData.is_subscription,
            subscription_interval: formData.is_subscription ? formData.subscription_interval : null,
            seller_amount: pricingBreakdown.sellerAmount,
            seller_ask: pricingBreakdown.sellerAmount,
            seller_ask_price: pricingBreakdown.sellerAmount,
            platform_fee: pricingBreakdown.platformFee,
            processing_fee: pricingBreakdown.processingFee,
            seller_id: sellerProfileId,
            shipping_options: normalizedShippingOptions,
            requires_shipping: isDigitalProduct ? false : formData.requires_shipping,
            shipping_price: shippingCharge,
            shipping_cost: shippingCharge,
            base_weight_oz: isDigitalProduct ? null : Number(formData.base_weight_oz) || 0,
            package_length_in: isDigitalProduct ? null : Number((formData as any).package_length_in) || 0,
            package_width_in: isDigitalProduct ? null : Number((formData as any).package_width_in) || 0,
            package_height_in: isDigitalProduct ? null : Number((formData as any).package_height_in) || 0,
            is_digital: isDigitalProduct,
            digital_download_bucket: isDigitalProduct ? (formData as any).digital_download_bucket : null,
            digital_download_path: isDigitalProduct ? (formData as any).digital_download_path : null,
            digital_download_filename: isDigitalProduct ? (formData as any).digital_download_filename : null,
            digital_download_content_type: isDigitalProduct ? (formData as any).digital_download_content_type : null,
            digital_download_file_size: isDigitalProduct ? (formData as any).digital_download_file_size : null,
            digital_download_limit: isDigitalProduct ? Math.max(1, Number((formData as any).digital_download_limit || 1)) : null,
            digital_download_instructions: isDigitalProduct ? (formData as any).digital_download_instructions : null,
            digital_return_policy_notice: isDigitalProduct ? (formData as any).digital_return_policy_notice : null,
            affiliate_enabled: affiliateEnabled,
            affiliate_commission_type: pricingBreakdown.affiliateType === 'flat_rate' ? 'flat' : 'percent',
            affiliate_commission_value: affiliateEnabled ? pricingBreakdown.affiliateRate : 0,
             calculated_customer_price: pricingBreakdown.listingPrice,
             status: requiresManualReview ? 'draft' : affiliateEnabled ? 'active' : 'store_only',
             is_promotable: affiliateEnabled && !requiresManualReview,
             is_active: !requiresManualReview,
             has_variants: Boolean(variantConfig.enabled),
             ...importPayloadFields,
           };

        // Schema-tolerant insert: drop missing keys and retry (for staged DB rollouts).
        let newProduct: any = null;
        let lastError: any = null;
        const insertWithColumnHealing = async (payload: any) => {
          const working = { ...payload };
          let data: any = null;
          let error: any = null;
          for (let attempt = 0; attempt < 8; attempt++) {
            const res = await supabase.from('products').insert([working]).select().single();
            if (!res.error) {
              data = res.data;
              error = null;
              break;
            }
            error = res.error;
            const message = String((res.error as any)?.message || '');
            const missing = extractMissingColumnName(message);
            if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
              delete working[missing];
              continue;
            }
            break;
          }
          return { data, error, payload: working };
        };

        const sellerIdCandidates = Array.from(
          new Set(
            [
              sellerProfileId,
              profile?.id,
              profile?.user_id,
              user?.id,
            ]
              .map((v) => (v ? String(v).trim() : ''))
              .filter((v) => v.length > 0)
          )
        );

        for (const candidate of sellerIdCandidates) {
          insertPayload.seller_id = candidate;
          const result = await insertWithColumnHealing(insertPayload);
          newProduct = result.data;
          lastError = result.error;
          insertPayload = result.payload;
          if (!lastError) break;
          if (!isSellerIdError(lastError)) break;
        }
        
        if (lastError) throw lastError;
        
        // Set the product ID for image uploads
        if (newProduct?.id) {
          setCurrentProductId(newProduct.id);
          setCreatedProductId(newProduct.id);
          savedProductId = newProduct.id;
          // Ensure the item is present in the seller's storefront list + ordering dashboard.
          await ensureSellerProductInOrder({ sellerId: sellerProfileId, productId: newProduct.id });

          // Optional: create variants for this product (best-effort).
          if (variantConfig.enabled) {
            try {
              const variantRows = generateVariantRows({
                productId: newProduct.id,
                basePrice: Number(pricingBreakdown.listingPrice || 0),
                totalStock: Number(formData.stock_quantity || 0),
              });
              if (variantRows.length) {
                let payloadRows: any[] = variantRows.map((r) => ({ ...r }));
                for (let attempt = 0; attempt < 6; attempt++) {
                  const res = await supabase.from('product_variants').insert(payloadRows).select('id').limit(1);
                  if (!res.error) break;
                  const message = String((res.error as any)?.message || '');
                  const missing = extractMissingColumnName(message);
                  if (missing) {
                    payloadRows = payloadRows.map((row) => {
                      const next = { ...row };
                      delete (next as any)[missing];
                      return next;
                    });
                    continue;
                  }
                  break;
                }

                // Mark product as having variants when supported.
                try {
                  await supabase.from('products').update({ has_variants: true }).eq('id', newProduct.id);
                } catch {
                  // ignore
                }
              }
            } catch (e) {
              console.warn('[ProductForm] variant generation failed (non-fatal):', e);
            }
          }
        }
      }

      if (savedProductId && !requiresManualReview) {
        await forceMarketplaceListing(savedProductId);
        await restoreCjSellability(savedProductId);
      }

      const marketplaceStatus = requiresManualReview ? 'store_only' : 'marketplace';
      setCreatedMarketplaceStatus(marketplaceStatus);
      setSuccess(
        requiresManualReview
          ? `Product saved as draft for manual review. ${reviewSummary || 'Beezio flagged this listing for launch protection checks.'}`
          : marketplaceStatus === 'marketplace'
          ? 'Product saved and listed in the marketplace.'
          : 'Product saved to your store (not listed in marketplace).'
      );
      setError(null);

      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (addAnother) {
        setTimeout(() => {
          resetForm();
        }, 600);
      }

    } catch (err: any) {
      try {
        console.error('Error creating product:', err);
        console.error('Error creating product (serialized):', JSON.stringify(err, Object.getOwnPropertyNames(err)));
      } catch {
        // ignore
      }
      const message =
        (err && (err.message || err.error_description || err.details || err.hint)) ||
        (typeof err === 'string' ? err : null) ||
        'Failed to create product';
      setError(String(message));
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-sm font-medium text-gray-600">Loading account access...</div>
      </div>
    );
  }

  if (buyerOnlyAccount) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">Customer Account</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Business tools are not active on this account</h1>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            This login can still view purchases, receipts, and support in the customer dashboard. To sell products,
            promote products, or refer sellers and affiliates, upgrade the same login to a Beezio business account.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/account')}
              className="inline-flex justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Customer dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="inline-flex justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open business account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header */}
      <div className="bg-[#ffcc00] border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-black">Add New Product</h1>
                <p className="text-sm text-gray-700">Use the quick fields first. Open the optional sections only if you need them.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <button
                  onClick={() => handleSubmit(undefined, true)}
                  disabled={loading || autoFillLoading}
                  className="w-full bg-white border border-gray-300 text-gray-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-gray-50 disabled:bg-gray-200 transition-all sm:w-auto"
                >
                  {loading ? 'Saving...' : 'Save & Add Another'}
                </button>
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading || autoFillLoading}
                  className="w-full bg-black hover:bg-gray-800 disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 sm:w-auto"
                >
                  {loading ? 'Saving...' : editMode ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </div>
        </div>
      </div>

      {/* Alerts */}
      {(error || success) && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-3">
          {error && (
            <div className="bg-red-50 border-2 border-red-500 text-red-800 px-6 py-4 rounded-lg">
              <div className="font-semibold">Error</div>
              <div className="mt-1">{error}</div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-2 border-green-500 text-green-800 px-6 py-4 rounded-lg">
              <div className="font-semibold">Success</div>
              <div className="mt-1">{success}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {createdProductId && (
                  <button
                    type="button"
                    onClick={() => goTo(`/product/${createdProductId}`)}
                    className="px-4 py-2 rounded-lg bg-white border border-green-200 text-green-900 font-semibold hover:bg-green-50"
                  >
                    View product
                  </button>
                )}
                {createdMarketplaceStatus === 'marketplace' && (
                  <button
                    type="button"
                    onClick={() => goTo('/marketplace')}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                  >
                    Go to marketplace
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => goTo('/dashboard?section=seller&tab=products')}
                  className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 font-semibold hover:bg-gray-50"
                >
                  Go to products
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {showLegacyInlineAlerts && error && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
          <div className="bg-red-50 border-2 border-red-500 text-red-700 px-6 py-4 rounded-lg">
            ⚠️ {error}
          </div>
        </div>
      )}

      {showLegacyInlineAlerts && success && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">
          <div className="bg-green-50 border-2 border-green-500 text-green-700 px-6 py-4 rounded-lg">
            ✅ {success}
          </div>
        </div>
      )}

      {showStickyAlert && (error || success) && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2">
          <div
            className={[
              'rounded-xl border shadow-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3',
              error ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200',
            ].join(' ')}
            role="status"
            aria-live="polite"
          >
            <div className="min-w-0 flex-1">
              <div className={['font-semibold', error ? 'text-red-900' : 'text-green-900'].join(' ')}>
                {error ? 'Save failed' : 'Saved'}
              </div>
              <div className={['text-sm truncate', error ? 'text-red-800' : 'text-green-800'].join(' ')}>
                {error || success}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {createdProductId && !error && (
                <button
                  type="button"
                  onClick={() => goTo(`/product/${createdProductId}`)}
                  className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 font-semibold hover:bg-gray-50"
                >
                  View product
                </button>
              )}
              {createdMarketplaceStatus === 'marketplace' && !error && (
                <button
                  type="button"
                  onClick={() => goTo('/marketplace')}
                  className="px-3 py-2 rounded-lg bg-black text-white font-semibold hover:bg-gray-800"
                >
                  Marketplace
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowStickyAlert(false)}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-900 font-semibold hover:bg-gray-50"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Form - Single Column */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:py-8 sm:pb-28">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-8 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Fast phone flow</div>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-3">
              <div>1. Add title, category, photos, and price.</div>
              <div>2. Save fast if this is a simple product.</div>
              <div>3. Open optional sections for variants, shipping, or video only.</div>
            </div>
          </div>

          {/* Product Title */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Product Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="e.g., Wireless Headphones"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Describe your product features and benefits..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Product Type <span className="text-red-500">*</span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setProductType(false)}
                className={`rounded-xl border px-4 py-4 text-left transition ${formData.is_digital ? 'border-gray-200 bg-white text-gray-700 hover:border-gray-300' : 'border-[#ffcb05] bg-amber-50 text-gray-900 shadow-sm'}`}
              >
                <div className="font-semibold">Physical Product</div>
                <div className="mt-1 text-sm text-gray-600">Ships to the buyer and uses fulfillment tracking.</div>
              </button>
              <button
                type="button"
                onClick={() => setProductType(true)}
                className={`rounded-xl border px-4 py-4 text-left transition ${formData.is_digital ? 'border-[#ffcb05] bg-amber-50 text-gray-900 shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
              >
                <div className="font-semibold">Digital Download</div>
                <div className="mt-1 text-sm text-gray-600">Buyer gets a secure account-tied download after payment.</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleInputChange}
              required
              disabled={formData.is_digital === true}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {formData.is_digital === true && (
              <p className="mt-2 text-xs text-gray-600">
                Digital products are automatically listed in the Digital Products marketplace category.
              </p>
            )}
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Stock Quantity
            </label>
            <input
              type="number"
              name="stock_quantity"
              value={formData.stock_quantity}
              onChange={handleInputChange}
              min="0"
              placeholder="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
            />
          </div>

          {/* Product Images */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Product Images
            </label>
            
            {currentProductId && productImages.length > 0 && (
              <div className="mb-4">
                <ImageGallery
                  productId={currentProductId}
                  images={productImages}
                  onImagesChange={setProductImages}
                  canEdit={true}
                />
              </div>
            )}

            <ImageUpload
              bucket="product-images"
              folder="product-form"
              onUploadComplete={handleImageUploadSuccess}
              onUploadError={(message) => setError(message || 'Image upload failed')}
              maxFiles={MAX_IMAGES}
              maxFileSize={10}
            />

            <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={addPlaceholderImage}
                className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Use placeholder image
              </button>
              <div className="text-xs text-gray-500">
                Useful if you don't have an image handy.
              </div>
            </div>

            {formData.images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formData.images.map((img, idx) => (
                  <div key={`${img}-${idx}`} className="relative group">
                    <img
                      src={img}
                      alt={`Product ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove image ${idx + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {false && (
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Product Videos
            </label>
            <p className="mb-3 text-sm text-gray-600">
              Upload short videos for this product so sellers and affiliates can promote it with motion as well as photos.
            </p>

            <ImageUpload
              bucket="product-images"
              folder="product-videos"
              onUploadComplete={handleVideoUploadSuccess}
              onUploadError={(message) => setError(message || 'Video upload failed')}
              maxFiles={MAX_VIDEOS}
              maxFileSize={15}
              allowedTypes={PRODUCT_VIDEO_TYPES}
              preview={false}
              title="Upload Videos"
              description="Drag & drop videos here, or click to browse"
            />

            <div className="mt-3 text-xs text-gray-500">
              Supported formats: MP4, WebM, MOV, and M4V. Keep each video under 15MB.
            </div>

            {formData.videos.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.videos.map((video, idx) => (
                  <div key={`${video}-${idx}`} className="relative group">
                    <video
                      src={video}
                      className="w-full h-48 rounded-lg border border-gray-200 bg-black object-cover"
                      controls
                      playsInline
                      preload="metadata"
                    />
                    <button
                      type="button"
                      onClick={() => removeVideo(idx)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      aria-label={`Remove video ${idx + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Pricing */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-bold text-gray-900 mb-3">
              Pricing <span className="text-red-500">*</span>
            </label>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                    Seller Payout
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingSeed.sellerAmount}
                      onChange={(e) => setPricingSeed((prev) => ({
                        ...prev,
                        sellerAmount: Math.max(0, Number.parseFloat(normalizeMoneyInput(e.target.value)) || 0),
                      }))}
                      className="w-full rounded-lg border border-gray-300 py-3 pl-8 pr-3 focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                    Affiliate Type
                  </label>
                  <select
                    value={pricingSeed.affiliateType}
                    onChange={(e) => setPricingSeed((prev) => ({
                      ...prev,
                      affiliateType: e.target.value === 'flat' ? 'flat' : 'percent',
                    }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                  >
                    <option value="percent">Percent</option>
                    <option value="flat">Flat Dollar Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
                    Affiliate {pricingSeed.affiliateType === 'flat' ? 'Payout' : 'Rate'}
                  </label>
                  <div className="relative">
                    {pricingSeed.affiliateType === 'flat' ? (
                      <span className="absolute left-3 top-3 text-gray-500">$</span>
                    ) : (
                      <span className="absolute right-3 top-3 text-gray-500">%</span>
                    )}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricingSeed.affiliateAmount}
                      onChange={(e) => setPricingSeed((prev) => ({
                        ...prev,
                        affiliateAmount: Math.max(0, Number.parseFloat(normalizeMoneyInput(e.target.value)) || 0),
                      }))}
                      className={`w-full rounded-lg border border-gray-300 py-3 focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20 ${pricingSeed.affiliateType === 'flat' ? 'pl-8 pr-3' : 'px-4 pr-8'}`}
                    />
                  </div>
                </div>
              </div>
          </div>

          <div className="border border-gray-200 rounded-xl bg-white p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="font-bold text-gray-900">Variants</div>
                <div className="text-sm text-gray-600">
                  Check this if the product has sizes, colors, or other options.
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={variantConfig.enabled}
                  onChange={(e) => setVariantConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                />
                This product has variants
              </label>
            </div>

            {variantConfig.enabled && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 mb-2">Sizes</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {visibleSizeOptions.map((size) => (
                      <label key={size} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={variantConfig.sizes.includes(size)}
                          onChange={() => toggleVariantValue('sizes', size)}
                        />
                        <span>{size}</span>
                      </label>
                    ))}
                  </div>
                  {variantConfig.sizes.length > 0 && (
                    <div className="mt-2 text-xs text-gray-700">
                      Selected: {variantConfig.sizes.join(', ')}
                    </div>
                  )}
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      value={variantConfig.customSize}
                      onChange={(e) => setVariantConfig((prev) => ({ ...prev, customSize: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomVariantValue('sizes');
                        }
                      }}
                      placeholder="Custom size (e.g. 14, 3T)"
                      className="w-full min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomVariantValue('sizes')}
                      disabled={!variantConfig.customSize.trim()}
                      className="w-full sm:w-auto flex-shrink-0 px-4 py-2 rounded-lg bg-white border border-gray-300 font-semibold hover:bg-gray-50 whitespace-nowrap"
                    >
                      Add custom
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="font-semibold text-gray-900 mb-2">Colors</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {visibleColorOptions.map((color) => (
                      <label key={color} className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={variantConfig.colors.includes(color)}
                          onChange={() => toggleVariantValue('colors', color)}
                        />
                        <span>{color}</span>
                      </label>
                    ))}
                  </div>
                  {variantConfig.colors.length > 0 && (
                    <div className="mt-2 text-xs text-gray-700">
                      Selected: {variantConfig.colors.join(', ')}
                    </div>
                  )}
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      value={variantConfig.customColor}
                      onChange={(e) => setVariantConfig((prev) => ({ ...prev, customColor: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomVariantValue('colors');
                        }
                      }}
                      placeholder="Custom color (e.g. Teal)"
                      className="w-full min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => addCustomVariantValue('colors')}
                      disabled={!variantConfig.customColor.trim()}
                      className="w-full sm:w-auto flex-shrink-0 px-4 py-2 rounded-lg bg-white border border-gray-300 font-semibold hover:bg-gray-50 whitespace-nowrap"
                    >
                      Add custom
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <details className="rounded-xl border border-gray-200 bg-gray-50">
            <summary className="cursor-pointer list-none px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-gray-900">Optional selling details</div>
                  <div className="mt-1 text-sm text-gray-600">Open this for shipping, videos, and affiliate settings.</div>
                </div>
                <div className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                  Optional
                </div>
              </div>
            </summary>
            <div className="space-y-6 border-t border-gray-200 p-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-3">
                  Product Videos
                </label>
                <p className="mb-3 text-sm text-gray-600">
                  Upload short videos for this product so sellers and affiliates can promote it with motion as well as photos.
                </p>

                <ImageUpload
                  bucket="product-images"
                  folder="product-videos"
                  onUploadComplete={handleVideoUploadSuccess}
                  onUploadError={(message) => setError(message || 'Video upload failed')}
                  maxFiles={MAX_VIDEOS}
                  maxFileSize={15}
                  allowedTypes={PRODUCT_VIDEO_TYPES}
                  preview={false}
                  title="Upload Videos"
                  description="Drag & drop videos here, or click to browse"
                />

                <div className="mt-3 text-xs text-gray-500">
                  Supported formats: MP4, WebM, MOV, and M4V. Keep each video under 15MB.
                </div>

                {formData.videos.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {formData.videos.map((video, idx) => (
                      <div key={`${video}-${idx}`} className="relative group">
                        <video
                          src={video}
                          className="w-full h-48 rounded-lg border border-gray-200 bg-black object-cover"
                          controls
                          playsInline
                          preload="metadata"
                        />
                        <button
                          type="button"
                          onClick={() => removeVideo(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove video ${idx + 1}`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(formData as any).is_digital === true && (
                <div className="border-t border-gray-200 pt-6">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Digital Delivery File
                  </label>
                  <p className="mb-3 text-sm text-gray-600">
                    Upload the exact file the buyer should receive. It is stored in private storage and released only through signed download links after payment.
                  </p>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadDigitalFile(file);
                      e.currentTarget.value = '';
                    }}
                    disabled={digitalUploadLoading}
                    className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900"
                  />
                  <div className="mt-2 text-xs text-gray-600">
                    Private upload limit: 25 MB per file. Accepted format depends on what you are selling.
                  </div>
                  {formData.digital_download_path ? (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                      <div className="font-semibold">{formData.digital_download_filename || 'Digital file uploaded'}</div>
                      <div className="mt-1 text-xs">
                        Stored privately and ready for buyer delivery.
                        {Number((formData as any).digital_download_file_size || 0) > 0 ? ` File size: ${Math.max(1, Math.round(Number((formData as any).digital_download_file_size || 0) / 1024))} KB.` : ''}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Download limit per purchase</label>
                      <input
                        type="number"
                        name="digital_download_limit"
                        min="1"
                        step="1"
                        value={(formData as any).digital_download_limit}
                        onChange={handleInputChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                      />
                      <p className="mt-2 text-xs text-gray-600">
                        Default is 1. Quantity purchased can still increase available downloads automatically.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Buyer instructions</label>
                      <textarea
                        name="digital_download_instructions"
                        value={(formData as any).digital_download_instructions}
                        onChange={handleInputChange}
                        rows={4}
                        placeholder="Example: unzip the file, open the PDF first, then follow the setup steps."
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-gray-900">Digital refund policy notice</label>
                    <textarea
                      name="digital_return_policy_notice"
                      value={(formData as any).digital_return_policy_notice}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                    />
                    <p className="mt-2 text-xs text-gray-600">
                      Buyers should be told clearly that downloads are non-refundable after download unless the file is broken or not what was sold.
                    </p>
                  </div>
                </div>
              )}

              {/* Shipping Setup */}
              {(formData as any).is_digital !== true && (
                <div className="border-t border-gray-200 pt-6">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    Shipping Setup
                  </label>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Built-in shipping amount</label>
                      <input
                        type="number"
                        name="shipping_price"
                        min="0"
                        step="0.01"
                        value={formData.shipping_price}
                        onChange={handleInputChange}
                        onBlur={(e) =>
                          setFormData(prev => ({
                            ...prev,
                            shipping_price: parseFloat(normalizeMoneyInput(e.target.value)) || 0
                          }))
                        }
                        placeholder="4.99"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                      />
                      <p className="mt-2 text-xs text-gray-600">
                        This is the shipping amount the seller wants charged at checkout unless free shipping is turned on.
                      </p>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Package weight (oz)</label>
                      <input
                        type="number"
                        name="base_weight_oz"
                        min="0"
                        step="0.1"
                        value={(formData as any).base_weight_oz}
                        onChange={handleInputChange}
                        placeholder="12"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                      />
                      <p className="mt-2 text-xs text-gray-600">
                        Optional for now. Keep this if you want package details on the product record.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Package length (in)</label>
                      <input
                        type="number"
                        name="package_length_in"
                        min="0"
                        step="0.1"
                        value={(formData as any).package_length_in}
                        onChange={handleInputChange}
                        placeholder="10"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Package width (in)</label>
                      <input
                        type="number"
                        name="package_width_in"
                        min="0"
                        step="0.1"
                        value={(formData as any).package_width_in}
                        onChange={handleInputChange}
                        placeholder="8"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-gray-900">Package height (in)</label>
                      <input
                        type="number"
                        name="package_height_in"
                        min="0"
                        step="0.1"
                        value={(formData as any).package_height_in}
                        onChange={handleInputChange}
                        placeholder="4"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-[#ffcc00] focus:ring-2 focus:ring-[#ffcc00]/20"
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-600">
                    If free shipping is off, buyers will be charged the seller shipping amount entered here.
                  </p>
                  <label className="mt-3 flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean((formData as any).shipping_included_in_price)}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          shipping_included_in_price: e.target.checked,
                          shipping_options: normalizeShippingOptions(
                            (prev as any).shipping_options,
                            Number(prev.shipping_price) || 0,
                            e.target.checked
                          ),
                        }))
                      }
                      className="mt-1 w-5 h-5 text-[#ffcc00] border-gray-300 rounded focus:ring-[#ffcc00]"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Include shipping in product price</div>
                      <div className="text-sm text-gray-600">
                        Checkout will show free shipping and the shipping amount will be folded into the product price.
                      </div>
                    </div>
                  </label>
                </div>
              )}

              {/* Affiliate Marketing Toggle */}
              <div className="border-t border-gray-200 pt-6">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={formData.affiliate_enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, affiliate_enabled: e.target.checked }))}
                    className="mt-1 w-5 h-5 text-[#ffcc00] border-gray-300 rounded focus:ring-[#ffcc00]"
                  />
                  <div>
                    <div className="font-bold text-gray-900 group-hover:text-[#ffcc00] transition-colors">
                      Enable affiliate marketing for this product
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Allow affiliates to promote this product and earn commissions on sales
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </details>


          {/* Bottom submit action */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || autoFillLoading}
              className="w-full bg-black text-white rounded-lg py-3 font-semibold shadow-md hover:shadow-lg hover:bg-gray-800 disabled:bg-gray-400 transition-all"
            >
              {loading ? 'Saving...' : editMode ? 'Update Product' : 'Add Product'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default ProductForm;
