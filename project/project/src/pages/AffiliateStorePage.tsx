import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductGrid from '../components/ProductGrid';
import AffiliateStoreCustomization from '../components/AffiliateStoreCustomization';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StoreContactModal from '../components/StoreContactModal';
import TrustBadges from '../components/TrustBadges';
import { User, Star, Globe, ExternalLink, Package } from 'lucide-react';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { applyThemeToDocument, getThemeStyles, normalizeThemeName, type ThemeName } from '../utils/themes';
import { normalizeProductImages, normalizeStorageImagePath } from '../utils/imageHelpers';

interface AffiliateStorePageProps {
  affiliateId?: string;
  isCustomDomain?: boolean;
  storeSlug?: string;
}

const isVisibleStorefrontProduct = (product: any): boolean => {
  const status = String(product?.status || '').trim().toLowerCase();
  const isActive = product?.is_active === true;
  const isPromotable = product?.is_promotable === true;
  if (status === 'active' || isActive || isPromotable) return true;
  const hasExplicitFlags =
    Object.prototype.hasOwnProperty.call(product || {}, 'is_active') ||
    Object.prototype.hasOwnProperty.call(product || {}, 'is_promotable') ||
    status.length > 0;
  return !hasExplicitFlags;
};

const isProductInStock = (product: any): boolean => {
  if (product?.track_inventory === false) return true;
  const rawStock = product?.stock_quantity ?? product?.total_inventory;
  const stock = Number(rawStock);
  const hasKnownStock =
    rawStock !== null &&
    rawStock !== undefined &&
    String(rawStock).trim() !== '' &&
    Number.isFinite(stock);

  if (typeof product?.in_stock === 'boolean' && (product?.track_inventory === true || hasKnownStock)) {
    return product.in_stock;
  }

  if (hasKnownStock) return stock > 0;
  return true;
};

const AffiliateStorePage: React.FC<AffiliateStorePageProps> = ({ affiliateId: propAffiliateId, isCustomDomain = false, storeSlug }) => {
  const { affiliateId: paramAffiliateId } = useParams<{ affiliateId: string }>();
  const affiliateId = propAffiliateId || paramAffiliateId;
  const { profile, user } = useAuth();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [insuranceListings, setInsuranceListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [canonicalAffiliateId, setCanonicalAffiliateId] = useState<string | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customPages, setCustomPages] = useState<any[]>([]);
  const [contactModal, setContactModal] = useState(false);
  const [activeCollection, setActiveCollection] = useState<'all' | 'featured' | 'in-stock'>('all');

  useEffect(() => {
    console.log('[AffiliateStorePage] useEffect triggered with affiliateId:', affiliateId);
    
    if (!affiliateId) {
      console.error('[AffiliateStorePage] No affiliateId provided');
      setLoading(false);
      setAffiliate(null);
      setInsuranceListings([]);
      return;
    }

    const loadAffiliateStore = async () => {
      try {
        console.log('[AffiliateStorePage] Starting data fetch for affiliateId:', affiliateId);
        setLoading(true);
        setLoadError(null);

        // Primary source: public Netlify API backed by Supabase service role.
        // This avoids client-side RLS hiding newly added affiliate products.
        try {
          const resp = await fetch(`/api/public/affiliate/store/get?affiliate=${encodeURIComponent(String(affiliateId || ''))}&_ts=${Date.now()}`);
          if (resp.ok) {
            const payload: any = await resp.json().catch(() => ({}));
            if (payload?.ok) {
              const canonicalId = String(payload?.canonical_affiliate_id || affiliateId || '').trim();
              if (canonicalId) setCanonicalAffiliateId(canonicalId);

              const affiliateRecord = payload?.affiliate || null;
              const settingsRecord = payload?.store_settings || null;

              if (affiliateRecord) {
                setAffiliate(affiliateRecord);
              } else if (settingsRecord) {
                setAffiliate({
                  id: canonicalId || settingsRecord?.affiliate_id || affiliateId,
                  full_name: settingsRecord.store_name || 'Store',
                  bio: settingsRecord.store_description || '',
                  store_banner: settingsRecord.store_banner,
                  store_logo: settingsRecord.store_logo,
                  store_theme: settingsRecord.store_theme || 'vibrant',
                  subdomain: settingsRecord.subdomain,
                  custom_domain: settingsRecord.custom_domain,
                  social_links: settingsRecord.social_links || {}
                });
              } else {
                setAffiliate(null);
              }

              if (settingsRecord) {
                setStoreSettings({
                  ...settingsRecord,
                  subdomain: settingsRecord.subdomain,
                  custom_domain: settingsRecord.custom_domain
                });
              } else {
                setStoreSettings(null);
              }

              const buyerFacingProducts = (Array.isArray(payload?.rows) ? payload.rows : [])
                .map((row: any) => {
                  const baseProduct = row?.products;
                  if (!baseProduct) return null;
                  if (!isVisibleStorefrontProduct(baseProduct)) return null;
                  const normalizedImages = normalizeProductImages(
                    baseProduct.images || baseProduct.primary_image_url || baseProduct.image_url
                  );
                  return {
                    id: baseProduct.id,
                    title: baseProduct.title,
                    description: baseProduct.description,
                    price: getBuyerFacingProductPrice(baseProduct),
                    seller_id: baseProduct.seller_id,
                    images: normalizedImages,
                    image_url: normalizedImages[0] || null,
                    category_id: baseProduct.category_id,
                    stock_quantity: baseProduct.stock_quantity,
                    total_inventory: baseProduct.total_inventory,
                    track_inventory: baseProduct.track_inventory,
                    in_stock: baseProduct.in_stock,
                    seller_name: baseProduct?.profiles?.full_name,
                    is_featured: Boolean(row?.is_featured),
                    display_order: Number.isFinite(Number(row?.display_order)) ? Number(row.display_order) : 999,
                  };
                })
                .filter((product): product is any => Boolean(product))
                .sort((a, b) => {
                  if (a.is_featured && !b.is_featured) return -1;
                  if (!a.is_featured && b.is_featured) return 1;
                  return (a.display_order ?? 0) - (b.display_order ?? 0);
                });

              setProducts(buyerFacingProducts);
              setInsuranceListings(Array.isArray(payload?.insurance_listings) ? payload.insurance_listings : []);
              setCustomPages(Array.isArray(payload?.custom_pages) ? payload.custom_pages : []);

              if (canonicalId) {
                localStorage.setItem('affiliate_referral', canonicalId);
              }

              setLoading(false);
              return;
            }
          }
          const body = await resp.text().catch(() => '');
          console.warn('[AffiliateStorePage] public API failed, falling back to client query:', resp.status, body);
        } catch (publicError) {
          console.warn('[AffiliateStorePage] public API request failed, falling back to client query:', publicError);
        }
        
        // Allow friendly slug from affiliate_store_settings.subdomain
        let lookupId = affiliateId;
        let storeSettingsData: any | null = null;
        const { data: slugMatch, error: slugError } = await supabase
          .from('affiliate_store_settings')
          .select('*')
          .eq('subdomain', lookupId || '')
          .maybeSingle();
        if (slugError && slugError.code !== 'PGRST116') {
          console.warn('[AffiliateStorePage] Error checking subdomain slug (non-fatal):', slugError);
        }
        if (slugMatch?.affiliate_id) {
          lookupId = slugMatch.affiliate_id;
          storeSettingsData = slugMatch;
        }

        console.log('[AffiliateStorePage] Fetching affiliate profile from database...');
        const { data: affiliateRecord, error: affiliateError } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${lookupId},user_id.eq.${lookupId}`)
          .maybeSingle();

        if (affiliateError) {
          console.error('[AffiliateStorePage] Database error fetching profile:', affiliateError);
          setAffiliate(null);
          setLoading(false);
          return;
        }

        if (!storeSettingsData && lookupId) {
          const { data: storeSettingsByAffiliate, error: settingsError } = await supabase
            .from('affiliate_store_settings')
            .select('*')
            .eq('affiliate_id', lookupId)
            .maybeSingle();
          if (settingsError && settingsError.code !== 'PGRST116') {
            console.warn('[AffiliateStorePage] Error fetching store settings (non-fatal):', settingsError);
          }
          if (storeSettingsByAffiliate) {
            storeSettingsData = storeSettingsByAffiliate;
          }
        }

        if (!affiliateRecord) {
          console.log('[AffiliateStorePage] No affiliate record found for:', affiliateId);
          if (!storeSettingsData) {
            setAffiliate(null);
            setProducts([]);
            setStoreSettings(null);
            setInsuranceListings([]);
            setLoading(false);
            return;
          }
        }

        const canonicalId = affiliateRecord?.id || storeSettingsData?.affiliate_id || lookupId;
        if (!canonicalId) {
          console.warn('[AffiliateStorePage] Missing canonical affiliate id');
          setAffiliate(null);
          setProducts([]);
          setStoreSettings(null);
          setInsuranceListings([]);
          setLoading(false);
          return;
        }

        if (affiliateRecord) {
          console.log('[AffiliateStorePage] Affiliate found:', affiliateRecord.full_name, 'ID:', affiliateRecord.id);
          setAffiliate(affiliateRecord);
          setCanonicalAffiliateId(affiliateRecord.id);
        } else if (storeSettingsData) {
          console.log('[AffiliateStorePage] Using store settings fallback for affiliate:', canonicalId);
          setAffiliate({
            id: canonicalId,
            full_name: storeSettingsData.store_name || 'Store',
            bio: storeSettingsData.store_description || '',
            store_banner: storeSettingsData.store_banner,
            store_logo: storeSettingsData.store_logo,
            store_theme: storeSettingsData.store_theme || 'vibrant',
            subdomain: storeSettingsData.subdomain,
            custom_domain: storeSettingsData.custom_domain,
            social_links: storeSettingsData.social_links || {}
          });
          setCanonicalAffiliateId(canonicalId);
        }

        console.log('[AffiliateStorePage] Fetching store settings and products for:', canonicalId);
        const [{ data: settingsData, error: settingsError }, { data: productRows, error: productsError }] = await Promise.all([
          storeSettingsData
            ? Promise.resolve({ data: storeSettingsData, error: null })
            : supabase
                .from('affiliate_store_settings')
                .select('*')
                .eq('affiliate_id', canonicalId)
                .maybeSingle(),
          supabase
            .from('affiliate_products')
            .select(`
              *,
              products (
                id,
                title,
                description,
                price,
                images,
                primary_image_url,
                image_url,
                is_active,
                is_promotable,
                status,
                category_id,
                stock_quantity,
                total_inventory,
                track_inventory,
                in_stock,
                seller_id,
                profiles!products_seller_id_fkey (full_name)
              )
            `)
            .eq('affiliate_id', canonicalId)
        ]);

        if (settingsError) {
          console.warn('[AffiliateStorePage] Error fetching store settings (non-fatal):', settingsError);
        }

        if (productsError) {
          console.warn('[AffiliateStorePage] Error fetching products (non-fatal):', productsError);
          if (String(productsError.message || '').includes('average_rating')) {
            console.warn('[AffiliateStorePage] Skipping legacy average_rating column mismatch.');
          } else {
            setLoadError('Unable to load products right now. Please refresh.');
          }
        }

        if (settingsData) {
          console.log('[AffiliateStorePage] Store settings found');
          setStoreSettings({
            ...settingsData,
            subdomain: settingsData.subdomain,
            custom_domain: settingsData.custom_domain
          });
        } else {
          console.log('[AffiliateStorePage] No store settings found, using defaults');
          setStoreSettings(null);
        }

        const buyerFacingProducts = (productRows || [])
          .map((row: any) => {
            const baseProduct = row.products;
            if (!baseProduct) return null;
            if (!isVisibleStorefrontProduct(baseProduct)) return null;
            const normalizedImages = normalizeProductImages(
              baseProduct.images || baseProduct.primary_image_url || baseProduct.image_url
            );

            return {
              id: baseProduct.id,
              title: baseProduct.title,
              description: baseProduct.description,
              price: getBuyerFacingProductPrice(baseProduct),
              seller_id: baseProduct.seller_id,
              images: normalizedImages,
              image_url: normalizedImages[0] || null,
              category_id: baseProduct.category_id,
              stock_quantity: baseProduct.stock_quantity,
              total_inventory: baseProduct.total_inventory,
              track_inventory: baseProduct.track_inventory,
              in_stock: baseProduct.in_stock,
              seller_name: baseProduct.profiles?.full_name,
              is_featured: Boolean(row?.is_featured),
              display_order: Number.isFinite(Number(row?.display_order)) ? Number(row.display_order) : 999,
            };
          })
          .filter((product): product is any => Boolean(product))
          .sort((a, b) => {
            if (a.is_featured && !b.is_featured) return -1;
            if (!a.is_featured && b.is_featured) return 1;
            return (a.display_order ?? 0) - (b.display_order ?? 0);
          });

        console.log('[AffiliateStorePage] Found', buyerFacingProducts.length, 'products');
        setProducts(buyerFacingProducts);

        // Load custom pages
        const { data: pagesData, error: pagesError } = await supabase
          .from('custom_pages')
          .select('page_slug,page_title,is_active,display_order')
          .eq('owner_id', canonicalId)
          .eq('owner_type', 'affiliate')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (pagesError) {
          console.warn('[AffiliateStorePage] Error fetching custom pages (non-fatal):', pagesError);
        }
        setCustomPages(pagesData || []);

        if (buyerFacingProducts.length > 0) {
          // Track views (non-fatal errors)
          await Promise.all(
            (productRows || []).map(product =>
              supabase.rpc('increment_affiliate_product_metric', {
                p_affiliate_id: canonicalId,
                p_product_id: product.product_id,
                p_metric: 'views'
              }).then(undefined, (err: Error) => {
                console.warn('[AffiliateStorePage] Could not increment view metric:', err);
                return undefined;
              })
            )
          );
        }

        // Set referral in localStorage
        localStorage.setItem('affiliate_referral', canonicalId);
        console.log('[AffiliateStorePage] Data fetch complete, setting loading to false');
        setLoading(false);
      } catch (error) {
        console.error('[AffiliateStorePage] CRITICAL ERROR in loadAffiliateStore:', error);
        setLoadError('We could not load this store yet. Please try again.');
        setAffiliate(null);
        setProducts([]);
        setStoreSettings(null);
        setInsuranceListings([]);
        setLoading(false);
      }
    };

    loadAffiliateStore();
  }, [affiliateId, loadAttempt]);

  useEffect(() => {
    const themeName = normalizeThemeName(storeSettings?.store_theme || affiliate?.store_theme) as ThemeName;
    applyThemeToDocument(themeName);
  }, [storeSettings?.store_theme, affiliate?.store_theme]);

  useEffect(() => {
    const title = String(storeSettings?.store_name || affiliate?.full_name || '').trim();
    if (!title) return;
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = previousTitle;
    };
  }, [storeSettings?.store_name, affiliate?.full_name]);

  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (loadAttempt < 1) {
        setLoadAttempt((prev) => prev + 1);
        return;
      }
      setLoadError('This store is taking too long to load. Please refresh or try again.');
      setLoading(false);
    }, 45000);
    return () => clearTimeout(timeout);
  }, [loadAttempt, loading]);

  const resolvedAffiliateId = canonicalAffiliateId || affiliateId || '';
  const isOwner = Boolean(
    (profile?.id && resolvedAffiliateId && profile.id === resolvedAffiliateId) ||
    (profile?.user_id && affiliateId && profile.user_id === affiliateId) ||
    (user?.id && affiliateId && user.id === affiliateId)
  );

  const normalizedSlug = storeSlug?.trim() ? storeSlug.trim() : '';
  const storeRouteId = normalizedSlug || storeSettings?.subdomain || resolvedAffiliateId || affiliateId || '';

  useEffect(() => {
    if (!storeRouteId) return;
    const scopeKey = `store:affiliate:${storeRouteId}`;
    localStorage.setItem('beezio-store-scope', scopeKey);
    window.dispatchEvent(new Event('beezio-store-scope-changed'));
  }, [storeRouteId]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/95">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-semibold">
            Storefront
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-600">Loading store...</p>
        </div>
      </div>
    </div>
  );

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white/95">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              Storefront
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-center max-w-md">
            <Package className="w-14 h-14 text-slate-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Store unavailable</h2>
            <p className="text-gray-600 mb-6">{loadError}</p>
            <button
              onClick={() => {
                setLoadAttempt((prev) => prev + 1);
                setLoading(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (!affiliate) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h2>
        <p className="text-gray-600">The store you're looking for doesn't exist.</p>
      </div>
    </div>
  );

  if (showCustomization && isOwner) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="mb-6">
            <button
              onClick={() => setShowCustomization(false)}
              className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
            >
              Back to Store
            </button>
          </div>
          <AffiliateStoreCustomization affiliateId={resolvedAffiliateId || affiliateId || ''} />
        </div>
      </div>
    );
  }

  const storeName = storeSettings?.store_name || `${affiliate.full_name}'s Store`;
  const storeTagline = String(storeSettings?.store_description || '').trim();
  const storeDescription = '';
  const visibleCustomPages = customPages.filter((page) => page.page_slug !== 'contact');
  const headerStyle = String((storeSettings?.layout_config as any)?.header_style || '').trim().toLowerCase();
  const storeLogoUrl = normalizeStorageImagePath(
    storeSettings?.store_logo || affiliate?.avatar_url,
    ['store-logos', 'profile-avatars', 'avatars', 'user-avatars']
  );
  const storeBannerUrl = normalizeStorageImagePath(
    storeSettings?.store_banner,
    ['store-banners', 'store-branding']
  );
  const storefrontBackgroundImageUrl = normalizeStorageImagePath(
    storeSettings?.layout_config?.background_image_url,
    ['store-banners', 'store-branding']
  );
  const heroImage = storeBannerUrl || storefrontBackgroundImageUrl || '';
  const showStoreIntroSection = Boolean(heroImage) || (headerStyle ? headerStyle !== 'minimal' : false);
  const filteredProducts = products.filter((product) => {
    if (activeCollection === 'featured') return Boolean(product?.is_featured);
    if (activeCollection === 'in-stock') return isProductInStock(product);
    return true;
  });
  const storeHomePath = isCustomDomain
    ? '/'
    : normalizedSlug
      ? `/store/${normalizedSlug}`
      : `/store/${encodeURIComponent(String(storeRouteId))}`;
  const productBasePath = isCustomDomain
    ? '/product'
    : normalizedSlug
      ? `/store/${normalizedSlug}/product`
      : `/store/${encodeURIComponent(String(storeRouteId))}/product`;

  const theme = getThemeStyles(
    normalizeThemeName(storeSettings?.store_theme || affiliate?.store_theme) as ThemeName
  );
  const storeColors = storeSettings?.color_scheme || {};
  const primaryColor = String(storeColors?.primary || theme?.colors?.primary || '#7c3aed');
  const secondaryColor = String(storeColors?.secondary || theme?.colors?.secondary || '#0ea5e9');
  const accentColor = String(storeColors?.accent || '#f59e0b');
  const backgroundColor = String(storeColors?.background || theme?.colors?.background || '#f8fafc');
  const textColor = String(storeColors?.text || '#0f172a');
  const navPages = visibleCustomPages.filter((page) => page.page_slug !== 'about').slice(0, 3);
  const heroProductCount = filteredProducts.length || products.length;

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor,
        backgroundImage: storefrontBackgroundImageUrl
          ? `linear-gradient(180deg, rgba(248,250,252,0.84), rgba(255,255,255,0.92)), url(${storefrontBackgroundImageUrl})`
          : 'radial-gradient(circle at 5% 0%, rgba(14,116,144,0.12), transparent 35%), radial-gradient(circle at 95% 10%, rgba(168,85,247,0.14), transparent 30%)',
        backgroundSize: storefrontBackgroundImageUrl ? 'cover' : undefined,
        backgroundPosition: storefrontBackgroundImageUrl ? 'center' : undefined,
      }}
    >
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
          <Link to={storeHomePath} className="flex items-center gap-3">
            {storeLogoUrl ? (
              <img
                src={storeLogoUrl}
                alt={`${storeName} logo`}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 bg-white"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-semibold" style={{ backgroundColor: primaryColor }}>
                {storeName?.charAt(0) || 'S'}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[0.6rem] font-semibold uppercase tracking-[0.28em]" style={{ color: accentColor }}>Independent shop</div>
              <div className="text-lg font-semibold" style={{ color: textColor }}>{storeName}</div>
            </div>
          </Link>

          <div className="hidden lg:flex flex-1 items-center justify-center px-4">
            <nav className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-semibold text-slate-600">
              <a href="#products" className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900">Shop</a>
              {(() => {
                const hasAboutPage = visibleCustomPages.some((p) => p.page_slug === 'about');
                if (hasAboutPage) {
                  return (
                    <Link to={`${storeHomePath === '/' ? '' : storeHomePath}/about`.replace('//', '/')} className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900">
                      About
                    </Link>
                  );
                }
                return (
                  <Link to={`${storeHomePath}/about`.replace('//', '/')} className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900">
                    About
                  </Link>
                );
              })()}
              {navPages.slice(0, 2).map((p) => {
                const basePath = storeHomePath === '/' ? '' : storeHomePath;
                const pageUrl = `${basePath}/${p.page_slug}`.replace('//', '/');
                return (
                  <Link
                    key={p.page_slug}
                    to={pageUrl}
                    className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900"
                  >
                    {p.page_title}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href="#products"
              className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>Start shopping</span>
            </a>
            <button
              onClick={() => setContactModal(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              aria-label="Contact store"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            {user ? (
              <Link
                to="/account"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
                aria-label="Open account"
              >
                <User className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                to="/account/login"
                className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>Sign In</span>
              </Link>
            )}
            <Link
              to="/cart"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
              aria-label="Open cart"
            >
              <Package className="w-4 h-4" />
            </Link>
            {isOwner && (
              <button
                onClick={() => setShowCustomization(true)}
                className="flex items-center gap-2 rounded-full border border-purple-200 px-4 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
              >
                <span>Manage</span>
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          <a href="#products" className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">Products</a>
          <button
            onClick={() => setContactModal(true)}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Contact
          </button>
          <Link
            to={`${storeHomePath === '/' ? '' : storeHomePath}/about`.replace('//', '/')}
            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            About
          </Link>
          {navPages.slice(0, 2).map((p) => {
            const basePath = storeHomePath === '/' ? '' : storeHomePath;
            const pageUrl = `${basePath}/${p.page_slug}`.replace('//', '/');
            return (
              <Link
                key={p.page_slug}
                to={pageUrl}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {p.page_title}
              </Link>
            );
          })}
        </div>
      </header>

      <div className="max-w-6xl mx-auto py-1 md:py-2 px-4">
        {showStoreIntroSection && (
          <section className="mb-4 overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
            <div
              className="relative min-h-[280px]"
              style={{
                background: heroImage
                  ? `linear-gradient(135deg, rgba(15,23,42,0.38), rgba(15,23,42,0.12)), url(${heroImage}) center/cover`
                  : `linear-gradient(135deg, ${primaryColor}, ${accentColor} 55%, ${secondaryColor})`,
              }}
            >
              <div className="grid gap-8 px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[minmax(0,1.5fr)_320px] lg:items-end">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-4">
                    {storeLogoUrl ? (
                      <img
                        src={storeLogoUrl}
                        alt={`${storeName} logo`}
                        className="h-16 w-16 rounded-2xl border border-white/30 bg-white/90 object-cover shadow-lg"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-2xl font-bold text-white shadow-lg">
                        {storeName?.charAt(0) || 'S'}
                      </div>
                    )}
                    <div>
                      <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">{storeName}</h1>
                      {storeTagline ? (
                        <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">{storeTagline}</p>
                      ) : null}
                    </div>
                  </div>
                  {storeDescription ? (
                    <p className="mt-5 max-w-2xl text-sm leading-6 text-white/80 md:text-base">{storeDescription}</p>
                  ) : null}
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="#products"
                      className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Shop collection
                    </a>
                    <button
                      onClick={() => setContactModal(true)}
                      className="inline-flex items-center rounded-full border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Contact
                    </button>
                  </div>
                </div>
                <div className="max-w-sm rounded-[28px] border border-white/20 bg-white/12 p-5 text-white backdrop-blur-sm">
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white/75">Shop details</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                    <div>
                      <div className="text-2xl font-black">{heroProductCount}</div>
                      <div className="text-sm text-white/78">products live</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black">Fast</div>
                      <div className="text-sm text-white/78">browse and share</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black">Direct</div>
                      <div className="text-sm text-white/78">contact support</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {!products.length ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <div className="text-sm font-semibold text-amber-900">Your storefront is ready to launch</div>
            <div className="text-sm text-amber-800 mt-1">Add products to make this look like a complete public store.</div>
          </div>
        ) : null}

        {storeSettings?.favorite_categories && storeSettings.favorite_categories.length > 0 && (
          <div className="mt-2">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Featured Categories</h3>
            <div className="flex flex-wrap gap-2">
              {storeSettings.favorite_categories.map((category: string) => (
                <span key={category} className="px-3 py-1 border rounded-full text-sm font-semibold" style={{ borderColor: secondaryColor, color: textColor, backgroundColor: '#ffffff' }}>
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}

        <div id="products" className="mt-3 scroll-mt-28 rounded-[32px] border bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.08)] md:scroll-mt-32 md:p-6" style={{ borderColor: secondaryColor }}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: accentColor }}>Collection</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight" style={{ color: textColor }}>
                Shop the picks
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: textColor, opacity: 0.72 }}>
                A storefront built to showcase recommendations cleanly and move shoppers into the cart without distraction.
              </p>
            </div>
            <div className="text-sm" style={{ color: textColor, opacity: 0.72 }}>
              Showing {filteredProducts.length} of {products.length}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'featured', label: 'Featured' },
              { id: 'in-stock', label: 'In Stock' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCollection(tab.id as 'all' | 'featured' | 'in-stock')}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors border"
                style={
                  activeCollection === tab.id
                    ? { backgroundColor: primaryColor, color: '#ffffff', borderColor: primaryColor }
                    : { borderColor: secondaryColor, color: textColor, backgroundColor: '#ffffff' }
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {filteredProducts.length > 0 ? (
            <ProductGrid
              products={filteredProducts}
              hideAffiliateUI
              hideFilters
              hideShareUI
              hideSellerInfo
              ctaMode="storefront"
              forcePurchaseCtas
              storefrontBrand={{
                name: storeName || affiliate?.full_name || 'Store',
                logoUrl: storeSettings?.logo_url || storeLogoUrl || null,
              }}
              gridLayout={(() => {
                const layout = storeSettings?.layout_config as any;
                if (layout?.grid_layout) return layout.grid_layout;
                switch (layout?.product_grid) {
                  case '2-col':
                    return 'large';
                  case '3-col':
                    return 'comfortable';
                  case '4-col':
                    return 'standard';
                  case 'masonry':
                    return 'comfortable';
                  case 'carousel':
                    return 'large';
                  default:
                    return 'standard';
                }
              })()}
              productBasePath={productBasePath}
              colorScheme={storeColors}
              platformLabel="Service fee"
            />
          ) : (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-5" />
              <h3 className="text-2xl font-bold text-slate-900 mb-3">
                {isOwner ? 'No products yet' : 'Store coming soon'}
              </h3>
              <p className="text-slate-600 mb-8 max-w-md mx-auto">
                {isOwner
                  ? 'Products added to your store will appear here.'
                  : 'This store is being set up. Check back soon for products.'}
              </p>
              {isOwner && (
                <div className="max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3 mb-8 text-left">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Step 1</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Pick products</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Step 2</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Feature top items</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Step 3</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Share your link</div>
                  </div>
                </div>
              )}
              {isOwner && !isCustomDomain && (
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                  >
                    <Globe className="w-5 h-5" />
                    Browse Marketplace
                  </Link>
                  <button
                    onClick={() => setShowCustomization(true)}
                    className="inline-flex items-center gap-2 px-6 py-3 border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                  >
                    Manage Store
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white/95">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr_1fr]">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Store highlights</div>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <Package className="w-4 h-4 text-slate-700 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900">{products.length} curated products</div>
                    <div>Every item is selected with care.</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Star className="w-4 h-4 text-amber-400 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900">Trusted recommendations</div>
                    <div>Shop confidently with clear product info.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Policies</div>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div>
                  <div className="font-semibold text-slate-900">Shipping</div>
                  <div>Shown at checkout.</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Returns & terms</div>
                  <div>See refunds & terms.</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Checkout</div>
              <div className="mt-4">
                <TrustBadges />
              </div>
            </div>
          </div>
        </div>
      </footer>

      <StoreContactModal
        isOpen={contactModal}
        onClose={() => setContactModal(false)}
        ownerId={canonicalAffiliateId || affiliateId || ''}
        ownerType="affiliate"
        storeName={storeName}
      />
    </div>
  );
};

export default AffiliateStorePage;
