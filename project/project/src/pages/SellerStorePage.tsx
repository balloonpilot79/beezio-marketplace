import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import ProductGrid from '../components/ProductGrid';
import StoreContactModal from '../components/StoreContactModal';
import AffiliateShareWidget from '../components/AffiliateShareWidget';
import TrustBadges from '../components/TrustBadges';
import { Star, MapPin, Clock, Package, Award, Facebook, Instagram, Twitter, Linkedin, Globe, ShoppingBag, Search, User } from 'lucide-react';
import { applyThemeToDocument, getThemeStyles, normalizeThemeName, type ThemeName } from '../utils/themes';
import { buildSellerStorefrontProducts } from '../utils/storefrontProducts';
import { normalizeStorageImagePath } from '../utils/imageHelpers';
import { resolveHouseBrandIdentity } from '../../shared/houseBrandIdentity';

interface SellerStorePageProps {
  sellerId?: string;
  isCustomDomain?: boolean;
  storeSlug?: string;
}

const safePublicUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const SellerStorePage: React.FC<SellerStorePageProps> = ({ sellerId: propSellerId, isCustomDomain = false, storeSlug }) => {
  const { sellerId: paramSellerId } = useParams<{ sellerId: string }>();
  const sellerId = propSellerId || paramSellerId;
  const { user, profile } = useAuth();
  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [insuranceListings, setInsuranceListings] = useState<any[]>([]);
  const [canonicalSellerId, setCanonicalSellerId] = useState<string | null>(null);
  const [canonicalStorefrontId, setCanonicalStorefrontId] = useState<string | null>(null);
  const [storeStats, setStoreStats] = useState({
    totalProducts: 0,
    totalSales: 0,
    rating: 0,
    reviewCount: 0,
    memberSince: new Date().getFullYear() - 2
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customPages, setCustomPages] = useState<any[]>([]);
  const [storeCollections, setStoreCollections] = useState<any[]>([]);
  const [productPlacements, setProductPlacements] = useState<any[]>([]);
  const [contactModal, setContactModal] = useState(false);
  
  useEffect(() => {
    console.log('[SellerStorePage] useEffect triggered with sellerId:', sellerId);
    
    if (!sellerId) {
      console.error('[SellerStorePage] No sellerId provided');
      setLoading(false);
      setSeller(null);
      setInsuranceListings([]);
      return;
    }
    
    const fetchSellerData = async () => {
      try {
        console.log('[SellerStorePage] Starting data fetch for sellerId:', sellerId);
        setLoading(true);
        setLoadError(null);
        
        // Sample store fallback data (check FIRST to avoid database queries)
        // Each store is a UNIQUE mini-website with custom domains, internal messaging, and distinct designs
        const sampleStores: Record<string, any> =
          import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_STORES === 'true' ? {
          'beezio-store': {
            id: 'beezio-store',
            full_name: 'Beezio Marketplace',
            bio: 'Welcome to the Beezio Marketplace demo store.',
            store_theme: 'modern',
            store_banner: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80',
            store_logo: '/bzobee.png',
            subdomain: 'beezio-store',
            custom_domain: 'shop.beezio.co',
            location: 'Seattle, WA',
            business_hours: 'Open 24/7',
            social_links: {
              facebook: 'https://facebook.com/beezio',
              instagram: 'https://instagram.com/beezio',
              twitter: 'https://twitter.com/beezio'
            },
            template_id: 'modern-grid',
            product_page_template: 'product-detailed',
            layout_config: {
              header_style: 'banner',
              product_grid: '4-col',
              sidebar: false,
              footer_style: 'detailed',
              show_ratings: true,
              show_quick_view: true,
              show_all_features: true
            },
            demo_features: {
              showcase_all: true,
              active_affiliates: 23,
              total_sales: 1847,
              avg_conversion: '3.2%',
              custom_pages: ['About', 'FAQ', 'Shipping'],
              white_label: true
            },
            custom_css: '.product-card { border-radius: 16px; transition: transform 0.3s ease; } .product-card:hover { transform: translateY(-8px); }',
            has_contact_page: true
          },
          'harbor-coffee': {
            id: 'harbor-coffee',
            full_name: 'Harbor Coffee Roasters',
            bio: '☕ Artisan coffee roasted fresh daily. Try our MESSAGING feature - click "Contact Store" to see how customers can reach you directly! We source the finest single-origin beans from sustainable farms.',
            store_theme: 'elegant',
            store_banner: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80',
            store_logo: null,
            subdomain: 'harbor-coffee',
            custom_domain: 'harborcoffee.com',
            location: 'Portland, OR',
            business_hours: 'Mon-Fri 7am-6pm',
            social_links: {
              instagram: 'https://instagram.com/harborcoffee',
              facebook: 'https://facebook.com/harborcoffee',
              website: 'https://harborcoffee.com'
            },
            template_id: 'boutique-story',
            product_page_template: 'product-immersive',
            layout_config: {
              header_style: 'full-width',
              product_grid: '2-col',
              sidebar: false,
              footer_style: 'elegant',
              show_large_images: true,
              show_story: true,
              show_messaging_demo: true
            },
            demo_features: {
              messaging: true,
              hasUnreadMessages: 3,
              messagePreview: 'Try the built-in messaging system! Click Contact Store to see how customers can message you directly.'
            },
            custom_css: '.store-header { background: linear-gradient(135deg, #6B4423 0%, #3E2723 100%); color: white; } .product-card { box-shadow: 0 8px 24px rgba(0,0,0,0.12); }',
            has_contact_page: true
          },
          'luma-labs': {
            id: 'luma-labs',
            full_name: 'Luma Labs',
            bio: '💻 DIGITAL STORE DEMO: Instant delivery, custom pages, and digital downloads. Perfect template for selling courses, templates, ebooks, and software. Browse our catalog to see digital commerce in action!',
            store_theme: 'minimal',
            store_banner: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1600&q=80',
            store_logo: null,
            subdomain: 'luma-labs',
            custom_domain: 'lumalabs.io',
            location: 'Remote-First',
            business_hours: 'Instant Digital Delivery',
            social_links: {
              twitter: 'https://twitter.com/lumalabs',
              website: 'https://lumalabs.io'
            },
            template_id: 'catalog-browse',
            product_page_template: 'product-minimal',
            layout_config: {
              header_style: 'minimal',
              product_grid: '3-col',
              sidebar: true,
              footer_style: 'minimal',
              show_categories: true,
              show_filters: true,
              show_digital_features: true
            },
            demo_features: {
              digital_products: true,
              instant_delivery: true,
              download_stats: {
                total_downloads: 2847,
                monthly_customers: 156,
                avg_rating: 4.9
              },
              subscription_option: true
            },
            custom_css: '.store-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; } .product-card { border: 1px solid #e2e8f0; background: white; }',
            has_contact_page: true
          },
          'cause-collective': {
            id: 'cause-collective',
            full_name: 'Cause Collective',
            bio: 'Community-first brand with a focus on quality apparel, events, and seasonal drops. Built to look and feel like a full retail store.',
            store_theme: 'vibrant',
            store_banner: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1600&q=80',
            store_logo: null,
            subdomain: 'cause-collective',
            custom_domain: 'causecollective.org',
            location: 'Nationwide',
            business_hours: 'Shop Anytime, Impact Always',
            social_links: {
              instagram: 'https://instagram.com/causecollective',
              facebook: 'https://facebook.com/causecollective',
              twitter: 'https://twitter.com/causecollective'
            },
            template_id: 'marketplace-hub',
            product_page_template: 'product-comparison',
            layout_config: {
              header_style: 'split',
              product_grid: '3-col',
              sidebar: true,
              footer_style: 'detailed',
              show_featured: true,
              show_impact_badge: true,
            },
            custom_css: '.store-header { background: linear-gradient(135deg, #ec4899 0%, #f59e0b 100%); color: white; } .product-card { border: 2px solid #fbbf24; } .impact-badge { background: #10b981; }',
            has_contact_page: true
          }
        } : {};

        const isSampleStore = Boolean(sampleStores[sellerId]);
        const isBeezioDemoStore = sellerId === 'beezio-store';

        const loadSampleStore = () => {
          console.log('[SellerStorePage] Loading sample store:', sellerId);
          const sampleStore = sampleStores[sellerId];
          setCanonicalSellerId(sampleStore.id);
          setSeller(sampleStore);
          setProducts([]);
          setInsuranceListings([]);
          setStoreStats(prev => ({
            ...prev,
            totalProducts: 0,
            memberSince: 2024
          }));
          setLoading(false);
        };

        // If this is a sample store (e.g. /store/luma-labs) and Supabase is unavailable, don't block on DB calls.
        // Also, for non-beezio demo sample stores, prefer the local sample experience immediately.
        if (isSampleStore && (!isSupabaseConfigured || !isBeezioDemoStore)) {
          loadSampleStore();
          return;
        }

        const requestedStoreSlug = String(storeSlug || sellerId || '').trim().toLowerCase();
        const isProtectedBrandRequest = ['marebelle', 'redtail', 'loving-nutrition'].includes(requestedStoreSlug);

        // Prefer the public API (Netlify Function w/ service role) for storefront loading.
        // This avoids RLS misconfigurations preventing products from appearing on public store pages.
        // But: don't allow it to hang the entire page on cold starts / missing env.
        try {
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 4500);
          try {
            const publicStoreLookup = String(storeSlug || sellerId);
            const resp = await fetch(`/api/public/store/get?store=${encodeURIComponent(publicStoreLookup)}`, {
              signal: controller.signal,
            });
            if (resp.ok) {
              const payload: any = await resp.json().catch(() => ({}));
              if (payload?.ok && payload?.seller_id) {
                const requestedBrandSlug = requestedStoreSlug;
                const protectedBrandName = requestedBrandSlug === 'redtail'
                  ? 'RedTail'
                  : requestedBrandSlug === 'marebelle'
                    ? 'MareBelle'
                    : requestedBrandSlug === 'loving-nutrition'
                      ? 'Loving Nutrition'
                      : '';
                const resolvedStorefrontSeller = payload.seller
                  ? {
                      ...payload.seller,
                      full_name: protectedBrandName || payload.seller.full_name,
                    }
                  : null;
                setCanonicalSellerId(String(payload.seller_id));
                setCanonicalStorefrontId(payload.storefront_id ? String(payload.storefront_id) : null);
                setSeller(resolvedStorefrontSeller);
                setProducts(Array.isArray(payload.products) ? payload.products : []);
                setInsuranceListings(Array.isArray(payload.insurance_listings) ? payload.insurance_listings : []);
                setCustomPages(Array.isArray(payload.custom_pages) ? payload.custom_pages : []);
                setStoreCollections(Array.isArray(payload.collections) ? payload.collections : []);
                setProductPlacements(Array.isArray(payload.product_placements) ? payload.product_placements : []);
                setStoreStats(prev => ({
                  ...prev,
                  totalProducts: Array.isArray(payload.products) ? payload.products.length : 0,
                }));
                setLoading(false);
                return;
              }
            }
          } finally {
            window.clearTimeout(timeout);
          }
        } catch (e) {
          if (isProtectedBrandRequest) {
            console.warn('[SellerStorePage] Protected storefront API unavailable; refusing shared-profile fallback:', e);
            setLoadError('This storefront is temporarily unavailable. Please try again.');
            setLoading(false);
            return;
          }
          // Non-fatal: fall back to direct Supabase client calls.
          console.warn('[SellerStorePage] Public store API unavailable, falling back to Supabase client:', e);
        }

        if (isProtectedBrandRequest) {
          setLoadError('This storefront is temporarily unavailable. Please try again.');
          setLoading(false);
          return;
        }

        // Allow friendly slug from store_settings.subdomain
        // Special case: beezio-store should prefer real DB-backed data when configured.
        let lookupId = sellerId;
        let storeSettingsData: any | null = null;
        if (lookupId) {
          const { data: slugMatch, error: slugError } = await supabase
            .from('store_settings')
            .select('*')
            .eq('subdomain', lookupId)
            .maybeSingle();
          if (slugError && slugError.code !== 'PGRST116') {
            console.warn('[SellerStorePage] Error checking subdomain slug (non-fatal):', slugError);
          }
          if (slugMatch?.seller_id) {
            lookupId = slugMatch.seller_id;
            storeSettingsData = slugMatch;
          }

          // For the beezio demo store: if there's no DB slug match, allow the page to fall back to local sample content.
          if (isSampleStore && isBeezioDemoStore && lookupId === sellerId) {
            loadSampleStore();
            return;
          }
        }

        // Try to fetch seller profile by profile id or auth user id
        console.log('[SellerStorePage] Fetching profile from database...');
        const { data: sellerData, error: sellerError } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${lookupId},user_id.eq.${lookupId}`)
          .maybeSingle();

        if (sellerError) {
          console.error('[SellerStorePage] Database error fetching profile:', sellerError);
          throw sellerError;
        }

        if (!storeSettingsData && lookupId) {
          const { data: storeSettingsBySeller, error: storeError } = await supabase
            .from('store_settings')
            .select('*')
            .eq('seller_id', lookupId)
            .maybeSingle();
          if (storeError && storeError.code !== 'PGRST116') {
            console.warn('[SellerStorePage] Error fetching store settings (non-fatal):', storeError);
          }
          if (storeSettingsBySeller) {
            storeSettingsData = storeSettingsBySeller;
          }
        }

        // If no seller found in database
        if (!sellerData) {
          console.log('[SellerStorePage] No seller found in database for ID:', sellerId);
          if (isBeezioDemoStore && isSampleStore) {
            loadSampleStore();
            return;
          }
          if (!storeSettingsData) {
            setSeller(null);
            setInsuranceListings([]);
            setLoading(false);
            return;
          }
        }

        const canonicalId = sellerData?.id || storeSettingsData?.seller_id || lookupId;
        if (!canonicalId) {
          console.warn('[SellerStorePage] Missing canonical seller id');
          setSeller(null);
          setInsuranceListings([]);
          setLoading(false);
          return;
        }

        const sellerIds = Array.from(
          new Set([canonicalId, sellerData?.user_id].filter(Boolean).map((id) => String(id)))
        );

        if (!storeSettingsData) {
          const { data: storeSettingsByCanonical, error: storeError } = await supabase
            .from('store_settings')
            .select('*')
            .eq('seller_id', canonicalId)
            .maybeSingle();
          if (storeError && storeError.code !== 'PGRST116') {
            console.warn('[SellerStorePage] Error fetching store settings (non-fatal):', storeError);
          }
          if (storeSettingsByCanonical) {
            storeSettingsData = storeSettingsByCanonical;
          }
        }

        if (sellerData) {
          console.log('[SellerStorePage] Profile found:', sellerData.full_name, 'ID:', sellerData.id);
          setCanonicalSellerId(sellerData.id);
          setSeller(sellerData);
        } else if (storeSettingsData && canonicalId) {
          console.log('[SellerStorePage] Using store settings fallback for seller:', canonicalId);
          setCanonicalSellerId(canonicalId);
          setSeller({
            id: canonicalId,
            full_name: storeSettingsData.store_name || 'Store',
            bio: storeSettingsData.store_description || '',
            store_banner: storeSettingsData.store_banner,
            store_logo: storeSettingsData.store_logo,
            store_theme: storeSettingsData.store_theme || 'modern',
            template_id: storeSettingsData.template_id,
            product_page_template: storeSettingsData.product_page_template,
            layout_config: storeSettingsData.layout_config || {},
            color_scheme: storeSettingsData.color_scheme || {},
            subdomain: storeSettingsData.subdomain,
            custom_domain: storeSettingsData.custom_domain,
            social_links: storeSettingsData.social_links || {},
            business_hours: storeSettingsData.business_hours,
            shipping_policy: storeSettingsData.shipping_policy,
            return_policy: storeSettingsData.return_policy
          });
        }

        if (storeSettingsData) {
          console.log('[SellerStorePage] Store settings found, applying customization');
          // Override seller data with store settings
          setSeller((prev: any) => ({
            ...prev,
            full_name: storeSettingsData.store_name || prev?.full_name,
            bio: storeSettingsData.store_description || prev?.bio,
            store_banner: storeSettingsData.store_banner,
            store_logo: storeSettingsData.store_logo,
            store_theme: storeSettingsData.store_theme || 'modern',
            template_id: storeSettingsData.template_id,
            product_page_template: storeSettingsData.product_page_template,
            layout_config: storeSettingsData.layout_config || {},
            color_scheme: storeSettingsData.color_scheme || {},
            subdomain: storeSettingsData.subdomain,
            custom_domain: storeSettingsData.custom_domain,
            social_links: storeSettingsData.social_links || {},
            business_hours: storeSettingsData.business_hours,
            shipping_policy: storeSettingsData.shipping_policy,
            return_policy: storeSettingsData.return_policy
          }));
        }

        // Fetch product order settings / curated list
        const { data: orderData, error: orderError } = await supabase
          .from('seller_product_order')
          .select('product_id, display_order, is_featured')
          .in('seller_id', sellerIds);

        if (orderError) {
          console.warn('[SellerStorePage] Error fetching product order (non-fatal):', orderError);
        }

        let productsData: any[] = [];
        const orderIds = orderData?.map(entry => entry.product_id).filter(Boolean) || [];

        // Always load seller-owned active products.
        // Important: if a seller curates marketplace products, we must not accidentally hide their own catalog.
        const { data: sellerOwnedProducts, error: sellerOwnedError } = await supabase
          .from('products')
          .select('*')
          .in('seller_id', sellerIds)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (sellerOwnedError) {
          console.error('[SellerStorePage] Error fetching seller-owned products:', sellerOwnedError);
        }

        let curatedProductsData: any[] = [];
        if (orderIds.length > 0) {
          console.log('[SellerStorePage] Loading curated product list:', orderIds.length, 'items');
          const { data: curatedProducts, error: curatedError } = await supabase
            .from('products')
            .select('*')
            .in('id', orderIds)
            .eq('is_active', true);

          if (curatedError) {
            console.error('[SellerStorePage] Error fetching curated products:', curatedError);
          } else {
            curatedProductsData = curatedProducts || [];
          }
        }

        const sharedSlug = String(storeSettingsData?.subdomain || storeSlug || '').trim().toLowerCase();
        if (sharedSlug) {
          try {
            const { data: affiliateSettingsRow } = await supabase
              .from('affiliate_store_settings')
              .select('affiliate_id')
              .eq('subdomain', sharedSlug)
              .maybeSingle();

            const sharedAffiliateId = String((affiliateSettingsRow as any)?.affiliate_id || '').trim();
            if (sharedAffiliateId) {
              const [{ data: affiliateRows }, { data: affiliateProducts }] = await Promise.all([
                supabase
                  .from('affiliate_products')
                  .select('product_id, display_order, is_featured')
                  .eq('affiliate_id', sharedAffiliateId),
                supabase
                  .from('affiliate_products')
                  .select('product_id')
                  .eq('affiliate_id', sharedAffiliateId),
              ]);

              const affiliateProductIds = Array.from(
                new Set(
                  (affiliateProducts || [])
                    .map((row: any) => String(row?.product_id || '').trim())
                    .filter(Boolean)
                )
              );

              if (affiliateProductIds.length) {
                const { data: promotedProducts, error: promotedError } = await supabase
                  .from('products')
                  .select('*')
                  .in('id', affiliateProductIds);

                if (promotedError) {
                  console.warn('[SellerStorePage] Error fetching shared-slug promoted products (non-fatal):', promotedError);
                } else {
                  const promotedOrderById = new Map<string, any>();
                  (affiliateRows || []).forEach((row: any) => {
                    const productId = String(row?.product_id || '').trim();
                    if (productId) promotedOrderById.set(productId, row);
                  });

                  const combinedById = new Map<string, any>();
                  [...(sellerOwnedProducts || []), ...curatedProductsData].forEach((product: any) => {
                    const productId = String(product?.id || '').trim();
                    if (productId) combinedById.set(productId, product);
                  });

                  (promotedProducts || []).forEach((product: any) => {
                    const productId = String(product?.id || '').trim();
                    if (!productId || combinedById.has(productId)) return;
                    const order = promotedOrderById.get(productId);
                    combinedById.set(productId, {
                      ...product,
                      affiliate_id: sharedAffiliateId,
                      display_order: Number.isFinite(Number(order?.display_order)) ? Number(order.display_order) : 999,
                      is_featured: Boolean(order?.is_featured),
                    });
                  });

                  curatedProductsData = Array.from(combinedById.values());
                }
              }
            }
          } catch (sharedSlugError) {
            console.warn('[SellerStorePage] Shared slug affiliate storefront lookup failed (non-fatal):', sharedSlugError);
          }
        }

        const orderedProducts = buildSellerStorefrontProducts({
          sellerOwnedProducts: sellerOwnedProducts || [],
          curatedProducts: curatedProductsData,
          orderEntries: orderData || [],
        });

        productsData = orderedProducts;
        console.log('[SellerStorePage] Found', productsData.length, 'products for storefront');
        setProducts(orderedProducts);

        // Update stats
        setStoreStats(prev => ({
          ...prev,
          totalProducts: orderedProducts.length
        }));

        // Fetch custom pages
        const customPagesOwnerId = sellerData?.id || canonicalId;
        if (customPagesOwnerId) {
          const { data: pagesData, error: pagesError } = await supabase
            .from('custom_pages')
            .select('page_slug,page_title,is_active,display_order')
            .eq('owner_id', customPagesOwnerId)
            .eq('owner_type', 'seller')
            .eq('is_active', true)
            .order('display_order', { ascending: true });
          if (pagesError) {
            console.warn('[SellerStorePage] Error fetching custom pages (non-fatal):', pagesError);
          }
          setCustomPages(pagesData || []);
        } else {
          setCustomPages([]);
        }

        console.log('[SellerStorePage] Data fetch complete, setting loading to false');
        setLoadError(null);
        setLoading(false);
      } catch (error) {
        console.error('[SellerStorePage] CRITICAL ERROR in fetchSellerData:', error);
        setLoadError('We could not load this store yet. Please try again.');
        setSeller(null);
        setInsuranceListings([]);
        setLoading(false);
      }
    };

    fetchSellerData();
  }, [sellerId, loadAttempt]);

  useEffect(() => {
    if (!loading) return;
    const timeout = setTimeout(() => {
      if (loadAttempt < 1) {
        setLoadAttempt((prev) => prev + 1);
        return;
      }
      const matchesProfile = Boolean(
        (profile?.id && profile.id === sellerId) ||
        (profile?.user_id && profile.user_id === sellerId) ||
        (user?.id && user.id === sellerId)
      );
      if (matchesProfile) {
        setSeller({
          id: profile?.id || sellerId,
          full_name: profile?.full_name || 'Store',
          bio: profile?.bio || '',
          store_theme: 'modern',
        });
        setProducts([]);
        setStoreStats(prev => ({ ...prev, totalProducts: 0 }));
        setLoadError(null);
        setLoading(false);
        return;
      }
      setLoadError('This store is taking too long to load. Please refresh or try again.');
      setLoading(false);
    }, 12000);
    return () => clearTimeout(timeout);
  }, [loadAttempt, loading, profile?.id, profile?.user_id, sellerId, user?.id]);

  // Apply theme when seller data loads
  useEffect(() => {
    if (seller?.store_theme) {
      const themeName = normalizeThemeName(seller.store_theme) as ThemeName;
      applyThemeToDocument(themeName, seller.theme_settings);
    }
  }, [seller]);

  const resolvedSellerId = canonicalSellerId || sellerId || '';
  const theme = seller ? getThemeStyles(normalizeThemeName(seller.store_theme) as ThemeName, seller.theme_settings) : null;
  const isOwner = Boolean(
    (profile?.id && resolvedSellerId && profile.id === resolvedSellerId) ||
    (profile?.user_id && sellerId && profile.user_id === sellerId) ||
    (user?.id && sellerId && user.id === sellerId)
  );

  const collectionLabelByFilter = new Map(
    storeCollections.map((collection) => [`collection:${collection.id}`, collection.name])
  );
  const categories = [
    'all',
    ...storeCollections.map((collection) => `collection:${collection.id}`),
    ...new Set(products.map(p => p.category).filter(Boolean)),
  ];
  const showCategoryFilters = (seller?.layout_config as any)?.show_categories !== false && categories.length > 1;
  const showSearchBar = (seller?.layout_config as any)?.show_search !== false;
  const filteredProducts = products.filter((product) => {
    const matchesCollection = activeCategory.startsWith('collection:')
      ? productPlacements.some(
          (placement) =>
            placement.product_id === product.id &&
            placement.placement_type === 'collection' &&
            `collection:${placement.collection_id}` === activeCategory
        )
      : null;
    const matchesCategory = activeCategory === 'all' || matchesCollection === true || product.category === activeCategory;
    if (!matchesCategory) return false;
    if (!searchQuery.trim()) return true;
    const needle = searchQuery.trim().toLowerCase();
    return (
      String(product?.title || product?.name || '').toLowerCase().includes(needle) ||
      String(product?.description || '').toLowerCase().includes(needle) ||
      String(product?.category || '').toLowerCase().includes(needle)
    );
  });
  const visibleCustomPages = customPages.filter((page) => page.page_slug !== 'contact');
  const resolvedGridLayout = (() => {
    const layout = seller?.layout_config as any;
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
  })();
  const normalizedSlug = storeSlug?.trim() ? storeSlug.trim() : '';
  const brandPersonality = String(seller?.theme_settings?.brand_personality || '').trim().toLowerCase();
  const houseBrandIdentity = resolveHouseBrandIdentity(normalizedSlug, brandPersonality);
  const isMareBelle = houseBrandIdentity?.slug === 'marebelle';
  const isRedTail = houseBrandIdentity?.slug === 'redtail';
  const isLovingNutrition = houseBrandIdentity?.slug === 'loving-nutrition';
  const protectedBrandName = houseBrandIdentity?.name || '';
  const storeRouteId = normalizedSlug || seller?.subdomain || resolvedSellerId || sellerId || '';
  const headerStyle = String((seller?.layout_config as any)?.header_style || '').trim().toLowerCase();
  const storeLogoUrl = normalizeStorageImagePath(seller?.store_logo, ['profile-avatars', 'avatars', 'user-avatars']);
  const storeBannerUrl = normalizeStorageImagePath(seller?.store_banner, ['store-banners', 'store-branding']);
  const storeBackgroundUrl = normalizeStorageImagePath(seller?.layout_config?.background_image_url, ['store-banners', 'store-branding']);
  // A strong brand introduction is the default for every storefront. Sellers
  // may explicitly choose the minimal header, but an omitted setting should
  // never collapse a desktop storefront into a small utility page.
  const showStoreIntroSection = headerStyle !== 'minimal';
  const storeHeroImage = storeBannerUrl || storeBackgroundUrl || '';
  const storeTagline = String(houseBrandIdentity?.about || seller?.bio || '').trim();
  const featuredProducts = products.filter((product) => Boolean(product?.is_featured)).slice(0, 4);
  const storeColors = seller?.color_scheme || {};
  const socialIconByKey: Record<string, React.ComponentType<{ className?: string }>> = {
    facebook: Facebook,
    instagram: Instagram,
    twitter: Twitter,
    x: Twitter,
    linkedin: Linkedin,
    website: Globe,
    tiktok: Globe,
    youtube: Globe,
  };
  const connectedSocialLinks = Object.entries(seller?.social_links || {})
    .map(([key, value]) => ({ key: key.toLowerCase(), url: safePublicUrl(value) }))
    .filter((item): item is { key: string; url: string } => Boolean(item.url));
  const primaryColor = String(storeColors?.primary || '#0f172a');
  const secondaryColor = String(storeColors?.secondary || '#e2e8f0');
  const accentColor = String(storeColors?.accent || '#f59e0b');
  const backgroundColor = String(storeColors?.background || theme?.colors.background || '#f8fafc');
  const textColor = String(storeColors?.text || '#0f172a');
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
  const aboutPath = isCustomDomain
    ? '/about'
    : normalizedSlug
      ? `/store/${normalizedSlug}/about`
      : `/store/${encodeURIComponent(String(storeRouteId))}/about`;
  const aboutCustomPage = visibleCustomPages.find((page) => page.page_slug === 'about');
  const hasPolicies = Boolean(seller?.shipping_policy || seller?.return_policy);
  const showFeaturedSection = (seller?.layout_config as any)?.show_featured !== false && featuredProducts.length > 0;
  const showAboutSection = (seller?.layout_config as any)?.show_about !== false && Boolean(storeTagline || aboutCustomPage);
  const showPoliciesSection = (seller?.layout_config as any)?.show_policies !== false && hasPolicies;
  const showContactButton = (seller?.layout_config as any)?.show_contact !== false;
  const storefrontSectionOrder = Array.isArray((seller?.layout_config as any)?.storefront_sections)
    ? ((seller?.layout_config as any)?.storefront_sections as string[])
    : ['hero', 'search', 'categories', 'featured', 'about', 'policies', 'contact'];
  const orderedStorefrontSections = storefrontSectionOrder.filter((sectionId, index, items) => {
    if ((sectionId === 'search' || sectionId === 'categories') && items.slice(0, index).some((value) => value === 'search' || value === 'categories')) {
      return false;
    }
    return ['search', 'categories', 'featured', 'about', 'policies'].includes(sectionId);
  });

  const storeUrl = seller?.custom_domain
    ? `https://${seller.custom_domain}`
    : normalizedSlug
    ? `https://beezio.co/store/${normalizedSlug}`
    : seller?.subdomain
    ? `https://beezio.co/store/${seller.subdomain}`
    : `${window.location.origin}/store/${resolvedSellerId}`;
  const navPages = visibleCustomPages.filter((page) => page.page_slug !== 'about').slice(0, 3);
  const aboutSummary = String(storeTagline || '').trim();
  const showAboutCard = showAboutSection && Boolean(aboutSummary);
  const heroProductCount = filteredProducts.length || products.length;
  // The three house brands temporarily share one admin profile. Keep the final
  // rendered identity tied to the storefront slug so owner-profile fallbacks,
  // stale API caches, or legacy store settings can never cross-brand a page.
  const displayStoreName = protectedBrandName || String(seller?.full_name || 'Store');
  const brandKicker = houseBrandIdentity?.kicker || 'An independent brand powered by Beezio';
  const hasEditorialBrand = isMareBelle || isRedTail || isLovingNutrition;
  const editorialHeroUrl = houseBrandIdentity?.heroUrl || '';
  const editorialLogoUrl = houseBrandIdentity?.logoUrl || '';
  const effectiveStoreLogoUrl = storeLogoUrl || editorialLogoUrl;
  const editorialAccentColor = houseBrandIdentity?.accentColor || accentColor;

  useEffect(() => {
    if (!storeRouteId) return;
    const scopeKey = `store:seller:${canonicalStorefrontId || storeRouteId}`;
    localStorage.setItem('beezio-store-scope', scopeKey);
    window.dispatchEvent(new Event('beezio-store-scope-changed'));
  }, [canonicalStorefrontId, storeRouteId]);

  const renderStorefrontSection = (sectionId: string) => {
    if (sectionId === 'search' || sectionId === 'categories') {
      if (products.length === 0 || (!showSearchBar && !showCategoryFilters)) return null;
      return (
        <div key="browse-controls" className="mb-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold" style={{ color: textColor }}>Browse the collection</div>
              <div className="text-xs" style={{ color: textColor, opacity: 0.68 }}>Find products faster with search and quick filters.</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {showSearchBar && (
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search this store"
                  className="w-full rounded-xl border px-10 py-3 text-sm outline-none transition"
                  style={{ borderColor: secondaryColor, color: textColor }}
                />
              </label>
            )}
            {showCategoryFilters && (
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
                    style={
                      activeCategory === category
                        ? { backgroundColor: primaryColor, color: '#ffffff', borderColor: primaryColor }
                        : { backgroundColor: '#ffffff', color: textColor, borderColor: secondaryColor }
                    }
                  >
                    {category === 'all' ? 'All Products' : collectionLabelByFilter.get(category) || category}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (sectionId === 'featured' && showFeaturedSection) {
      return (
        <div key="featured" className="mb-4 rounded-[24px] border bg-white p-5 shadow-sm" style={{ borderColor: secondaryColor }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Featured Picks</div>
              <h3 className="text-lg font-bold" style={{ color: textColor }}>Top products from this store</h3>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                to={`${productBasePath}/${encodeURIComponent(String(product.id))}`}
                className="rounded-xl border p-3 transition hover:shadow-md"
                style={{ borderColor: secondaryColor, backgroundColor: '#ffffff' }}
              >
                <div className="text-sm font-semibold" style={{ color: textColor }}>{product.title || product.name}</div>
                <div className="mt-1 text-xs" style={{ color: textColor, opacity: 0.65 }}>{product.category || 'Product'}</div>
                <div className="mt-3 text-sm font-bold" style={{ color: primaryColor }}>${Number(product.price || 0).toFixed(2)}</div>
              </Link>
            ))}
          </div>
        </div>
      );
    }

    if (sectionId === 'about' && showAboutCard) {
      return (
        <div id="about" key="about" className="mb-4 scroll-mt-28 rounded-[24px] border bg-white p-5 shadow-sm" style={{ borderColor: secondaryColor }}>
          <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Brand story</div>
          <p className="mt-2 text-sm leading-6" style={{ color: textColor }}>
            {aboutSummary}
          </p>
          {aboutCustomPage ? (
            <Link to={`${storeHomePath}/${aboutCustomPage.page_slug}`} className="mt-3 inline-flex text-sm font-semibold" style={{ color: primaryColor }}>
              Read the full story
            </Link>
          ) : null}
        </div>
      );
    }

    if (sectionId === 'policies' && showPoliciesSection) {
      return (
        <div key="policies" className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-[24px] border bg-white p-5 shadow-sm" style={{ borderColor: secondaryColor }}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Shipping</div>
            <p className="mt-2 text-sm leading-6" style={{ color: textColor }}>{seller?.shipping_policy || 'Shown at checkout.'}</p>
          </div>
          <div className="rounded-[24px] border bg-white p-5 shadow-sm" style={{ borderColor: secondaryColor }}>
            <div className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>Returns & Support</div>
            <p className="mt-2 text-sm leading-6" style={{ color: textColor }}>{seller?.return_policy || 'See refunds and terms.'}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${displayStoreName} Store`,
        text: `Check out products from ${displayStoreName}.`,
        url: storeUrl
      });
    } else {
      navigator.clipboard.writeText(storeUrl);
      alert('Store link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white/95">
          <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              Storefront
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white/95">
          <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
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

  if (!seller) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="border-b border-slate-200 bg-white/95">
          <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              Storefront
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
            <p className="text-gray-600 mb-4">The store you're looking for doesn't exist.</p>
            {!isCustomDomain && (
              <Link to="/" className="text-amber-600 hover:text-amber-700 font-medium">
                Return to Homepage
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const storeBackgroundImage = storeBackgroundUrl;

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor,
        backgroundImage: storeBackgroundImage
          ? `linear-gradient(180deg, rgba(248,250,252,0.84), rgba(255,255,255,0.92)), url(${storeBackgroundImage})`
          : `radial-gradient(circle at 10% 0%, color-mix(in srgb, ${accentColor} 18%, transparent), transparent 35%), radial-gradient(circle at 90% 8%, color-mix(in srgb, ${primaryColor} 14%, transparent), transparent 30%)`,
        backgroundSize: storeBackgroundImage ? 'cover' : undefined,
        backgroundPosition: storeBackgroundImage ? 'center' : undefined,
      }}
    >
      {/* Apply custom CSS for unique store styling */}
      {seller.custom_css && (
        <style>{seller.custom_css}</style>
      )}
      
      <header
        className="sticky top-0 z-40 border-b shadow-sm backdrop-blur"
        style={hasEditorialBrand
          ? { backgroundColor: isLovingNutrition ? '#063c2f' : '#070707', borderColor: isMareBelle ? '#4b3a22' : isRedTail ? '#4f1719' : '#c7a34a' }
          : { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e2e8f0' }}
      >
        <div className="mx-auto max-w-[1440px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <Link to={storeHomePath} className="flex items-center gap-3">
            {effectiveStoreLogoUrl ? (
              <img
                src={effectiveStoreLogoUrl}
                alt={`${displayStoreName} logo`}
                className="h-14 w-14 rounded-xl border bg-white object-contain p-1"
                style={{ borderColor: hasEditorialBrand ? editorialAccentColor : '#e2e8f0' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-white shadow-sm" style={{ backgroundColor: primaryColor }}>
                {displayStoreName.charAt(0) || 'S'}
              </div>
            )}
            <div className="leading-tight">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.3em]" style={{ color: hasEditorialBrand ? editorialAccentColor : accentColor }}>{houseBrandIdentity?.headerLabel || 'Independent shop'}</div>
              <div className={`text-xl tracking-tight ${hasEditorialBrand ? 'font-serif font-semibold' : 'font-black'}`} style={{ color: hasEditorialBrand ? '#ffffff' : textColor }}>{displayStoreName}</div>
            </div>
            </Link>

            <div className="hidden lg:flex flex-1 items-center justify-center px-4">
              <nav
                className="flex items-center gap-2 rounded-full border p-1 text-sm font-semibold"
                style={hasEditorialBrand
                  ? { borderColor: '#ffffff2b', backgroundColor: '#ffffff0d', color: '#ffffff' }
                  : { borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#475569' }}
              >
                <a href="#products" className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900">{products.length > 0 ? 'Shop' : 'Collection'}</a>
              {aboutCustomPage && !hasEditorialBrand ? (
                <Link
                  to={`${storeHomePath === '/' ? '' : storeHomePath}/${aboutCustomPage.page_slug}`.replace('//', '/')}
                  className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900"
                >
                  About
                </Link>
              ) : hasEditorialBrand ? (
                <a href="#about" className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900">
                  About
                </a>
              ) : (
                <Link to={aboutPath} className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900">
                  About
                </Link>
              )}
              {navPages.slice(0, 2).map((page) => (
                <Link
                  key={page.page_slug}
                  to={`${storeHomePath === '/' ? '' : storeHomePath}/${page.page_slug}`.replace('//', '/')}
                  className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900"
                >
                  {page.page_title}
                </Link>
              ))}
              {hasPolicies && (
                <a href="#policies" className="rounded-full px-4 py-2 transition-colors hover:bg-white hover:text-slate-900">
                  Policies
                </a>
              )}
              </nav>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <a
                href="#products"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: hasEditorialBrand ? editorialAccentColor : primaryColor,
                  color: hasEditorialBrand && isMareBelle ? '#080808' : '#ffffff',
                }}
              >
                <ShoppingBag className="w-4 h-4" />
                {products.length > 0 ? 'Start shopping' : 'Explore the brand'}
              </a>
              {user ? (
                <Link
                  to="/account"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
                  style={hasEditorialBrand ? { borderColor: '#ffffff55', color: '#ffffff' } : undefined}
                  aria-label="Open account"
                >
                  <User className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  to="/account/login"
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors"
                  style={hasEditorialBrand ? { borderColor: '#ffffff55', color: '#ffffff' } : undefined}
                >
                  Sign In
                </Link>
              )}
              {!isCustomDomain && (
                <Link
                  to="/cart"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors"
                  style={hasEditorialBrand ? { borderColor: '#ffffff55', color: '#ffffff' } : undefined}
                  aria-label="Open cart"
                >
                  <ShoppingBag className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <a href="#products" className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">Products</a>
            {aboutCustomPage && !hasEditorialBrand ? (
              <Link
                to={`${storeHomePath === '/' ? '' : storeHomePath}/${aboutCustomPage.page_slug}`.replace('//', '/')}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                About
              </Link>
            ) : hasEditorialBrand ? (
              <a href="#about" className="shrink-0 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                About
              </a>
            ) : (
              <Link to={aboutPath} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                About
              </Link>
            )}
            {navPages.slice(0, 2).map((page) => (
              <Link
                key={page.page_slug}
                to={`${storeHomePath === '/' ? '' : storeHomePath}/${page.page_slug}`.replace('//', '/')}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {page.page_title}
              </Link>
            ))}
            {hasPolicies && (
              <a href="#policies" className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                Policies
              </a>
            )}
          </div>
        </div>
      </header>

      {hasEditorialBrand && (
        <div className="mx-auto max-w-[1440px] px-3 pt-4 sm:px-6 lg:px-8 lg:pt-7">
          <section
            className="overflow-hidden border shadow-[0_32px_100px_rgba(0,0,0,0.24)]"
            style={{ background: isLovingNutrition ? 'radial-gradient(circle at 50% 35%, #176b50 0%, #063c2f 58%, #03271f 100%)' : '#080808', borderColor: `${editorialAccentColor}66` }}
          >
            <div className={`relative overflow-hidden ${isMareBelle ? 'h-[260px] sm:h-[340px] lg:h-[420px]' : 'h-[300px] sm:h-[380px] lg:h-[460px]'}`}>
              <img
                src={editorialHeroUrl}
                alt={`${displayStoreName} storefront artwork`}
                className={isLovingNutrition
                  ? 'absolute inset-0 h-full w-full object-contain p-4 sm:p-7'
                  : 'absolute inset-0 h-full w-full object-cover object-top'}
              />
            </div>
            <div className="flex flex-col gap-4 border-t px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between lg:px-10" style={{ borderColor: `${editorialAccentColor}55` }}>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: editorialAccentColor }}>{brandKicker}</div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/90">
                  {products.length > 0
                    ? `Shop the live ${displayStoreName} collection below.`
                    : 'This is the brand direction. The shoppable collection will appear here only when real products are published.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {products.length > 0 ? (
                  <a href="#products" className="rounded-none px-6 py-3 text-sm font-bold text-white" style={{ backgroundColor: editorialAccentColor }}>Shop the collection</a>
                ) : null}
                {showContactButton ? (
                  <button onClick={() => setContactModal(true)} className="border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">Contact</button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      )}

      {showStoreIntroSection && !hasEditorialBrand && (
        <div className="mx-auto max-w-[1440px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <section className="overflow-hidden rounded-[36px] border border-white/40 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.16)]">
            <div
              className="relative min-h-[380px] lg:min-h-[500px]"
              style={{
                background: storeHeroImage
                  ? `linear-gradient(135deg, rgba(15,23,42,0.38), rgba(15,23,42,0.12)), url(${storeHeroImage}) center/cover`
                  : `linear-gradient(135deg, ${primaryColor}, ${accentColor} 55%, ${secondaryColor})`,
              }}
            >
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 18% 24%, white 0 2px, transparent 3px), radial-gradient(circle at 72% 68%, white 0 1px, transparent 2px)', backgroundSize: '48px 48px, 34px 34px' }} />
              <div className="relative grid min-h-[380px] gap-10 px-7 py-12 sm:px-10 md:py-16 lg:min-h-[500px] lg:grid-cols-[minmax(0,1.6fr)_380px] lg:items-end lg:px-16 lg:py-20">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-4">
                    {storeLogoUrl ? (
                      <img
                        src={storeLogoUrl}
                        alt={`${displayStoreName} logo`}
                        className="h-16 w-16 rounded-2xl border border-white/30 bg-white/90 object-cover shadow-lg"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-2xl font-bold text-white shadow-lg">
                        {displayStoreName.charAt(0) || 'S'}
                      </div>
                    )}
                    <div>
                      <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-7xl">
                        {displayStoreName}
                      </h1>
                      {storeTagline ? (
                        <p className="mt-3 max-w-2xl text-base leading-7 text-white/88 md:text-lg">{storeTagline}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-7 text-xs font-bold uppercase tracking-[0.24em] text-white/75">{brandKicker}</div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="#products"
                      className="inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {products.length > 0 ? 'Shop collection' : 'Discover the story'}
                    </a>
                    {showContactButton ? (
                      <button
                        onClick={() => setContactModal(true)}
                        className="inline-flex items-center rounded-full border px-5 py-2.5 text-sm font-semibold text-white transition"
                        style={{ borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.1)' }}
                      >
                        Contact
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="max-w-sm rounded-[30px] border border-white/25 bg-slate-950/25 p-6 text-white shadow-2xl backdrop-blur-md lg:justify-self-end">
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white/75">{products.length > 0 ? 'Shop details' : 'Brand preview'}</div>
                  {products.length > 0 ? (
                    <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                      <div><div className="text-2xl font-black">{heroProductCount}</div><div className="text-sm text-white/78">products live</div></div>
                      <div><div className="text-2xl font-black">{storeStats.reviewCount > 0 ? storeStats.rating.toFixed(1) : 'New'}</div><div className="text-sm text-white/78">customer rating</div></div>
                      <div><div className="text-2xl font-black">{storeStats.reviewCount}</div><div className="text-sm text-white/78">verified reviews</div></div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="text-2xl font-black">Opening collection</div>
                      <p className="text-sm leading-6 text-white/80">The branded storefront is live while its first products are being prepared.</p>
                      <div className="inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">Built with Beezio</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
      
      {/* Products Section */}
      <div id="products" className="mx-auto max-w-[1440px] scroll-mt-28 px-4 py-6 sm:px-6 md:scroll-mt-32 md:py-8 lg:px-8">
        {orderedStorefrontSections.map((sectionId) => renderStorefrontSection(sectionId))}

        {/* Products Grid */}
        {filteredProducts.length === 0 && hasEditorialBrand ? (
          <section className="border bg-white px-7 py-12 text-center shadow-[0_24px_70px_rgba(0,0,0,0.10)] sm:px-12 lg:py-16" style={{ borderColor: `${editorialAccentColor}66` }}>
            <div className="mx-auto max-w-3xl">
              <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: editorialAccentColor }}>Collection coming soon</div>
              <h2 className="mt-4 font-serif text-4xl text-slate-950 sm:text-5xl">{displayStoreName} is preparing its first release.</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">The brand storefront is live and ready. Real products will appear here as they are published—nothing shown in the editorial artwork is presented as available for purchase.</p>
              {isOwner ? (
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to="/marketplace" className="px-6 py-3 text-sm font-bold text-white" style={{ backgroundColor: editorialAccentColor }}>Choose marketplace products</Link>
                  <Link to="/dashboard" className="border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800">Open brand dashboard</Link>
                </div>
              ) : null}
              <div className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Independent storefront • Powered by Beezio</div>
            </div>
          </section>
        ) : filteredProducts.length === 0 ? (
          <div className="overflow-hidden rounded-[36px] border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.10)]" style={{ borderColor: secondaryColor }}>
            <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
              <div className="p-8 sm:p-12 lg:p-16">
                <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-3xl" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                  <Package className="h-10 w-10" />
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.24em]" style={{ color: accentColor }}>Opening collection</div>
                <h3 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-gray-950 sm:text-4xl lg:text-5xl">
                  {isOwner ? "Your brand is ready for a deliberate first collection." : `${displayStoreName} is curating something worth waiting for.`}
                </h3>
                <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
                  {isOwner
                    ? "The storefront is already live and fully branded. Add products only when they fit this brand and you are ready to sell them."
                    : "Explore the story, connect with the brand, and return soon when the first products are released."}
                </p>
                {!isOwner && showContactButton && (
                  <button onClick={() => setContactModal(true)} className="mt-7 inline-flex rounded-full px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: primaryColor }}>Contact the brand</button>
                )}
              </div>
              <aside className="border-t p-7 sm:p-10 lg:border-l lg:border-t-0" style={{ borderColor: secondaryColor, backgroundColor: `${secondaryColor}35` }}>
                <div className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: accentColor }}>{isOwner ? 'Owner launch panel' : 'Brand details'}</div>
                {isOwner ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 mt-5 text-left">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Step 1</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Add products</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Step 2</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Customize layout</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Step 3</div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">Share store link</div>
                  </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
                  >
                    Browse Marketplace
                  </Link>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Open Dashboard
                  </Link>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 space-y-4 text-sm leading-6" style={{ color: textColor }}>
                    <p>{brandKicker}</p>
                    <p>Secure checkout, order support, and verified reviews are provided through Beezio.</p>
                    <div className="inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-bold shadow-sm">Built with Beezio</div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        ) : (
          <div className="rounded-[32px] border bg-white p-4 shadow-[0_28px_80px_rgba(15,23,42,0.08)] md:p-6" style={{ borderColor: secondaryColor }}>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: accentColor }}>Collection</div>
                <h3 className="mt-2 text-3xl font-black tracking-tight" style={{ color: textColor }}>Shop the catalog</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: textColor, opacity: 0.72 }}>
                  A cleaner storefront that puts the product selection first and keeps the buying path direct.
                </p>
              </div>
              <div className="text-sm" style={{ color: textColor, opacity: 0.7 }}>
                Showing {filteredProducts.length} of {products.length}
              </div>
            </div>
            <ProductGrid
              products={filteredProducts}
              hideAffiliateUI
              hideFilters
              hideShareUI
              hideSellerInfo
              ctaMode="storefront"
              forcePurchaseCtas
              storefrontBrand={{
                name: seller?.full_name || 'Store',
                logoUrl: effectiveStoreLogoUrl || null,
              }}
              gridLayout={resolvedGridLayout}
              productBasePath={productBasePath}
              platformLabel="Service fee"
              colorScheme={storeColors}
            />
          </div>
        )}
        {/* Store Customization Panel intentionally hidden on storefront */}
      </div>

      <footer id="policies" className="border-t border-slate-200 bg-white/95">
        <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr_1fr]">
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Store highlights</div>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <Package className="w-4 h-4 text-slate-700 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900">{storeStats.totalProducts} active products</div>
                    <div>Fresh inventory curated by the seller.</div>
                  </div>
                </div>
                {storeStats.reviewCount > 0 ? (
                  <div className="flex items-start gap-3">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400 mt-0.5" />
                    <div>
                      <div className="font-semibold text-slate-900">{storeStats.rating} rating</div>
                      <div>{storeStats.reviewCount} verified customer reviews</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <Award className="mt-0.5 h-4 w-4 text-slate-700" />
                    <div><div className="font-semibold text-slate-900">Independent brand</div><div>Storefront and checkout powered by Beezio.</div></div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Policies</div>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                {seller.shipping_policy ? (
                  <div>
                    <div className="font-semibold text-slate-900">Shipping</div>
                    <div className="whitespace-pre-line">{seller.shipping_policy}</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold text-slate-900">Shipping</div>
                    <div>Shown at checkout.</div>
                  </div>
                )}
                {seller.return_policy ? (
                  <div>
                    <div className="font-semibold text-slate-900">Returns & support</div>
                    <div className="whitespace-pre-line">{seller.return_policy}</div>
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold text-slate-900">Returns & support</div>
                    <div>See refunds & terms.</div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Checkout</div>
              <div className="mt-4">
                <TrustBadges />
              </div>
              {isOwner && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <AffiliateShareWidget
                    type="store"
                    targetId={String(resolvedSellerId || sellerId || '')}
                    targetPath={storeHomePath}
                    title={`${displayStoreName} store link`}
                  />
                </div>
              )}
            </div>
          </div>
          {connectedSocialLinks.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[24px] border bg-slate-50 px-5 py-4" style={{ borderColor: secondaryColor }}>
              <div>
                <div className="text-sm font-bold" style={{ color: textColor }}>Connect with {displayStoreName}</div>
                <div className="text-xs text-slate-500">Official website and social channels selected by the store owner.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {connectedSocialLinks.map(({ key, url }) => {
                  const SocialIcon = socialIconByKey[key] || Globe;
                  return (
                    <a key={`${key}-${url}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${key}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: secondaryColor, color: primaryColor }}>
                      <SocialIcon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </footer>

      {/* Contact Modal */}
      <StoreContactModal
        isOpen={contactModal}
        onClose={() => setContactModal(false)}
        ownerId={resolvedSellerId}
        ownerType="seller"
        storeName={seller?.full_name}
        storefrontId={canonicalStorefrontId}
      />
    </div>
  );
};

export default SellerStorePage;
