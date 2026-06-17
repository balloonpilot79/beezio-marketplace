import React, { useMemo, useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TrendingUp, Info, ShoppingBag, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AffiliateLink from './AffiliateLink';
import { useAuth } from '../contexts/AuthContextMultiRole';
import ProductAffiliateQRCode from './ProductAffiliateQRCode';
import AddToAffiliateStoreButton from './AddToAffiliateStoreButton';
import AddToSellerStoreButton from './AddToSellerStoreButton';
import StarRating from './StarRating';
import SocialShareButton from './SocialShareButton';
import { useCart } from '../contexts/CartContext';
import {
  calculatePayouts,
  calculateSalePriceFromSellerAsk,
  DEFAULT_AFFILIATE_RATE,
  deriveSellerAskFromSalePrice,
  normalizeAffiliateRate,
  resolveAffiliateCommission,
} from '../utils/pricing';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { getProductIdentifierLines } from '../utils/productIdentifiers';
import { normalizeProductImages, resolveProductImageFromList } from '../utils/imageHelpers';
import { formatMoneyDisplay, formatShippingLineItem } from '../utils/moneyDisplay';
import { getReferralAttribution } from '../utils/referralTracking';
import { resolveCheckoutAttribution } from '../utils/checkoutAttribution';
import { setPostAuthPath } from '../utils/storefrontScope';
import { normalizeAccountRole } from '../utils/accountRoles';

interface Product {
  id: string;
  title: string;
  price: number;
  images: string[];
  videos: string[];
  description?: string;
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  seller_id: string;
  affiliate_id?: string;
  affiliate_enabled?: boolean;
  profiles?: {
    full_name: string;
    location?: string;
  };
  shipping_cost?: number;
  // Subscription fields
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
  // Rating fields
  average_rating?: number;
  review_count?: number;
}

interface ProductGridProps {
  products?: Product[];
  hideFilters?: boolean;
  hideAffiliateUI?: boolean; // hide affiliate badges/tooltip (e.g., on seller storefronts)
  hideShareUI?: boolean; // hide per-product share actions (storefronts should be buy-first)
  hideSellerInfo?: boolean; // hide original seller attribution (for curated storefronts)
  storefrontBrand?: {
    name: string;
    logoUrl?: string | null;
  };
  platformLabel?: string;
  gridLayout?: 'compact' | 'standard' | 'comfortable' | 'large';
  productBasePath?: string;
  colorScheme?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  showPurchaseCtas?: boolean;
  forcePurchaseCtas?: boolean;
  ctaMode?: 'marketplace' | 'storefront';
}

const ProductGrid: React.FC<ProductGridProps> = ({ 
  products: externalProducts, 
  hideFilters = false, 
  hideAffiliateUI = false,
  hideShareUI = false,
  hideSellerInfo = false,
  storefrontBrand,
  platformLabel = 'Beezio platform',
  gridLayout = 'standard',
  productBasePath,
  colorScheme,
  showPurchaseCtas = true,
  forcePurchaseCtas = false,
  ctaMode = 'marketplace'
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'affiliate'>('all');
  const { user, profile, currentRole, userRoles, hasRole } = useAuth();
  const { addToCart, clearCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const currentSearchParams = new URLSearchParams(location.search);
  const rawReferralToken = String(currentSearchParams.get('ref') || '').trim() || null;
  const referralAttribution = getReferralAttribution();
  const cartAttribution = resolveCheckoutAttribution({
    referralAffiliateId: referralAttribution.type === 'affiliate' ? referralAttribution.id : rawReferralToken,
    storeScope: typeof window !== 'undefined' ? localStorage.getItem('beezio-store-scope') : null,
  });
  const cartAffiliateId = cartAttribution.affiliate_id || undefined;

  const activeRole = normalizeAccountRole((profile as any)?.primary_role || profile?.role || currentRole);
  const effectiveRole = activeRole;
  const isSellerActive = effectiveRole === 'seller';
  const isAffiliateActive = effectiveRole === 'affiliate';
  const canAddToSellerStore = isSellerActive || hasRole('seller');
  const canAddToAffiliateStore = isAffiliateActive || hasRole('affiliate') || hasRole('partner');
  const canManageStore = canAddToSellerStore || canAddToAffiliateStore;
  const isBuyerActive = !canManageStore || activeRole === 'buyer';
  const isStorefrontCtas = ctaMode === 'storefront';
  const shouldShowPurchaseCtas = showPurchaseCtas && (!isStorefrontCtas || isBuyerActive || forcePurchaseCtas);
  const shouldShowStoreCta = Boolean(user?.id) && !isStorefrontCtas && canManageStore && !hideAffiliateUI;

  const formatStorefrontPrice = (value: number) => {
    return formatMoneyDisplay(value);
  };

  const requireBuyerAccount = () => {
    if (user) return false;
    const nextPath = `${location.pathname}${location.search}${location.hash || ''}`;
    setPostAuthPath(nextPath);
    window.alert('Please sign in or create an account to continue with your purchase.');
    navigate(`/account/login?next=${encodeURIComponent(nextPath)}`);
    return true;
  };

  // Grid layout configurations
  const gridClasses = {
    compact: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3',
    standard: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6',
    comfortable: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8',
    large: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10'
  };

  const cardSizeClasses = {
    compact: 'text-sm',
    standard: '',
    comfortable: 'text-base',
    large: 'text-lg'
  };

  // Debug logging
  console.log('ProductGrid - Products count:', products.length);
  console.log('ProductGrid - Loading:', loading);
  console.log('ProductGrid - External products:', externalProducts?.length);

  useEffect(() => {
    if (externalProducts) {
      setProducts(externalProducts);
      setLoading(false);
      setError(null);
    } else {
      fetchProducts();
    }
  }, [externalProducts, filter]);

  const fetchProducts = async () => {
    try {
      // Fetch from Supabase only; no sample data fallback
      let query = supabase
        .from('products')
        .select(`
          *,
          profiles:seller_id (
            full_name,
            location
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (filter === 'affiliate') {
        query = query.gt('commission_rate', 0);
      }

      const { data, error } = await query;

      if (error) {
        console.log('ProductGrid: Supabase error (no sample fallback):', error);
        setError('Unable to load products yet.');
      } else {
        setProducts(data || []);
        setError(null);
      }
    } catch (error) {
      console.log('ProductGrid: Error in fetchProducts:', error);
      setError('Unable to load products yet.');
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className={gridClasses[gridLayout]}>
        {[...Array(gridLayout === 'compact' ? 12 : gridLayout === 'large' ? 6 : 8)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 aspect-square mb-4 rounded-lg"></div>
            <div className="h-4 bg-gray-300 rounded mb-2"></div>
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-display font-bold text-gray-800 mb-8">Featured Products</h2>
            <div className="bg-red-100 border border-red-300 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center mb-4">
                <span className="text-4xl">âš ï¸</span>
              </div>
              <p className="text-red-800 text-sm">{error}</p>
              <p className="text-red-600 text-xs mt-2">
                Unable to load products. Please check your configuration.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Category Filter - Only show if not hidden */}
      {!hideFilters && (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 relative overflow-hidden">
          <div className="relative">
            <h3 className="text-lg font-display font-bold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">ðŸ›ï¸</span>
              Shop by Category
            </h3>
            <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-2 sm:mx-0 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0">
            <button
              onClick={() => setFilter('all')}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:py-3 sm:text-base sm:hover:scale-105 ${
                filter === 'all'
                  ? 'bg-primary-500 text-white shadow-lg border-2 border-primary-600'
                  : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-200'
              }`}
            >
              ðŸ›ï¸ All Products
            </button>
            <button
              onClick={() => setFilter('affiliate')}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 sm:px-6 sm:py-3 sm:text-base sm:hover:scale-105 ${
                filter === 'affiliate'
                  ? 'bg-accent-500 text-white shadow-lg border-2 border-accent-600'
                  : 'bg-accent-100 text-accent-800 border-2 border-accent-300 hover:border-accent-400 hover:bg-accent-200'
              }`}
            >
              ðŸ’° Partner Products
            </button>
            {/* Additional category buttons based on available categories */}
            <button
              className="shrink-0 whitespace-nowrap rounded-full border-2 border-primary-300 bg-primary-50 px-4 py-2.5 text-sm font-semibold text-primary-700 transition-all duration-300 hover:border-primary-400 hover:bg-primary-100 sm:px-6 sm:py-3 sm:text-base sm:hover:scale-105"
            >
              ðŸ“± Electronics
            </button>
            <button
              className="shrink-0 whitespace-nowrap rounded-full border-2 border-green-300 bg-green-100 px-4 py-2.5 text-sm font-semibold text-green-800 transition-all duration-300 hover:border-green-400 hover:bg-green-200 sm:px-6 sm:py-3 sm:text-base sm:hover:scale-105"
            >
              ðŸ‘• Fashion
            </button>
            <button
              className="shrink-0 whitespace-nowrap rounded-full border-2 border-orange-300 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-800 transition-all duration-300 hover:border-orange-400 hover:bg-orange-100 sm:px-6 sm:py-3 sm:text-base sm:hover:scale-105"
            >
              ðŸ½ï¸ Food & Beverage
            </button>
            <button
              className="shrink-0 whitespace-nowrap rounded-full border-2 border-yellow-300 bg-yellow-100 px-4 py-2.5 text-sm font-semibold text-yellow-800 transition-all duration-300 hover:border-yellow-400 hover:bg-yellow-200 sm:px-6 sm:py-3 sm:text-base sm:hover:scale-105"
            >
              ðŸ  Home & Garden
            </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Site-wide Affiliate Link for logged-in affiliates */}
      {isAffiliateActive && !hideAffiliateUI && (
        <div className="mb-8">
          <AffiliateLink siteWide />
        </div>
      )}

      {/* Product Grid */}
      <div className={gridClasses[gridLayout]}>
        {products.map((product) => {
          // Normalize product data (handle both 'name' and 'title', 'image' and 'images')
          const rawImages =
            (product as any).images ?? (product as any).image ?? (product as any).image_url ?? (product as any).primary_image ?? null;
          const averageRating = Number((product as any).average_rating ?? (product as any).rating ?? 0);
          const reviewCount = Number((product as any).review_count ?? (product as any).reviews ?? 0);
          const normalizedProduct = {
            ...product,
            title: product.title || (product as any).name || 'Untitled Product',
            images: normalizeProductImages(rawImages),
            average_rating: Number.isFinite(averageRating) ? averageRating : 0,
            review_count: Number.isFinite(reviewCount) ? Math.max(0, reviewCount) : 0
          };
          const identifierLines = getProductIdentifierLines(normalizedProduct);
          const heroImage = resolveProductImageFromList(normalizedProduct.images, normalizedProduct.id);
          const rawStock =
            (normalizedProduct as any).stock_quantity ??
            (normalizedProduct as any).total_inventory;
          const stockQty = Number(rawStock);
          const hasKnownStock =
            rawStock !== null &&
            rawStock !== undefined &&
            String(rawStock).trim() !== '' &&
            Number.isFinite(stockQty);
          const lineage = String((normalizedProduct as any)?.lineage || '').trim().toUpperCase();
          const provider = String((normalizedProduct as any)?.dropship_provider || '').trim().toLowerCase();
          const allowBackorder =
            lineage.includes('CJ') ||
            provider === 'cj' ||
            provider.includes('cjdropshipping');
          const hasExplicitInStock = typeof (normalizedProduct as any)?.in_stock === 'boolean';
          const explicitInStock = hasExplicitInStock ? Boolean((normalizedProduct as any)?.in_stock) : null;
          const tracksInventory = (normalizedProduct as any)?.track_inventory === true;
          let isUnavailable = false;
          if (!allowBackorder) {
            if ((normalizedProduct as any)?.track_inventory === false) {
              isUnavailable = false;
            } else if (hasKnownStock) {
              isUnavailable = stockQty <= 0;
            } else if (hasExplicitInStock && tracksInventory) {
              isUnavailable = explicitInStock === false;
            }
          }
          
          const commissionConfig = resolveAffiliateCommission(normalizedProduct as any);
          const affiliateType = commissionConfig.type;
          const affiliateRate = affiliateType === 'flat'
            ? Number(commissionConfig.value || 0)
            : normalizeAffiliateRate(commissionConfig.value ?? normalizedProduct.commission_rate ?? DEFAULT_AFFILIATE_RATE);
          const buyerFacingPrice = getBuyerFacingProductPrice(normalizedProduct as any);
          const sellerAsk =
            (normalizedProduct as any).seller_ask ??
            (normalizedProduct as any).seller_amount ??
            (normalizedProduct as any).seller_ask_price ??
            deriveSellerAskFromSalePrice(
              buyerFacingPrice,
              affiliateRate,
              affiliateType === 'flat' ? 'flat' : 'percent'
            );
          const salePrice = buyerFacingPrice > 0
            ? buyerFacingPrice
            : calculateSalePriceFromSellerAsk(
                sellerAsk,
                affiliateRate,
                affiliateType === 'flat' ? 'flat' : 'percent'
              );
          const payouts = calculatePayouts(salePrice, sellerAsk, {
            hasAffiliate: true,
            hasAffiliateReferrer: false,
            affiliateRate,
            affiliateType,
          });
          const commissionDisplayLabel = affiliateType === 'flat'
            ? `$${Number(commissionConfig.value || 0).toFixed(2)} affiliate commission`
            : `${Number(commissionConfig.value || 0)}% affiliate commission`;

          const primaryColor = colorScheme?.primary || '#f59e0b';
          const accentColor = colorScheme?.accent || '#ef4444';

          const normalizedBasePath = productBasePath?.replace(/\/+$/, '');
          const productPath = normalizedBasePath
            ? `${normalizedBasePath}/${normalizedProduct.id}`
            : `/product/${normalizedProduct.id}`;
          const attributionSearch = (() => {
            const currentParams = new URLSearchParams(location.search);
            const nextParams = new URLSearchParams();
            ['ref', 'uid', 'code'].forEach((key) => {
              const value = String(currentParams.get(key) || '').trim();
              if (value) nextParams.set(key, value);
            });
            const query = nextParams.toString();
            return query ? `?${query}` : '';
          })();
          const productPathWithAttribution = `${productPath}${attributionSearch}`;

          const rawVariants = (normalizedProduct as any)?.variants;
          const hasVariants =
            Boolean((normalizedProduct as any)?.has_variants) ||
            (Array.isArray((normalizedProduct as any)?.product_variants) && (normalizedProduct as any).product_variants.length > 0) ||
            (Array.isArray(rawVariants) && rawVariants.length > 0);
          const requiresOptionSelection = hasVariants && !isStorefrontCtas;

          const productSellerName = storefrontBrand?.name || normalizedProduct.profiles?.full_name || 'Seller';
          const isCJProduct = allowBackorder;
          const shippingCost = isCJProduct
            ? 0
            : (typeof (normalizedProduct as any).shipping_cost === 'number' ? (normalizedProduct as any).shipping_cost : 0);
          const storefrontCard = isStorefrontCtas;
          const imageForCart = heroImage;
          const rowAffiliateId = String((normalizedProduct as any)?.affiliate_id || '').trim() || undefined;
          const itemAffiliateId = rowAffiliateId || cartAffiliateId;

          const backState = {
            from: `${location.pathname}${location.search}`,
            product: normalizedProduct,
          };

          const handleAddToCart = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (isUnavailable) return;
            if (shouldShowPurchaseCtas && requireBuyerAccount()) return;

            if (requiresOptionSelection) {
              navigate(productPathWithAttribution, { state: backState });
              return;
            }

            flushSync(() => {
              addToCart({
                productId: normalizedProduct.id,
                title: normalizedProduct.title,
                price: salePrice,
                sellerAsk,
                quantity: 1,
                image: imageForCart,
                sellerId: normalizedProduct.seller_id,
                sellerName: productSellerName,
                shippingCost,
                maxQuantity: hasKnownStock ? (allowBackorder && stockQty <= 0 ? undefined : Math.max(0, stockQty)) : undefined,
                commission_rate: normalizedProduct.commission_type === 'flat_rate' ? (normalizedProduct.flat_commission_amount ?? 0) : (normalizedProduct.commission_rate ?? DEFAULT_AFFILIATE_RATE),
                commission_type: normalizedProduct.commission_type,
                flat_commission_amount: normalizedProduct.commission_type === 'flat_rate' ? (normalizedProduct.flat_commission_amount ?? 0) : 0,
                affiliateId: itemAffiliateId,
                isDigital: (normalizedProduct as any).is_digital === true,
              });
            });
            navigate('/cart');
          };

          const handleBuyNow = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (isUnavailable) return;
            if (shouldShowPurchaseCtas && requireBuyerAccount()) return;

            if (requiresOptionSelection) {
              navigate(productPathWithAttribution, { state: backState });
              return;
            }

            flushSync(() => {
              clearCart();
              addToCart({
                productId: normalizedProduct.id,
                title: normalizedProduct.title,
                price: salePrice,
                sellerAsk,
                quantity: 1,
                image: imageForCart,
                sellerId: normalizedProduct.seller_id,
                sellerName: productSellerName,
                shippingCost,
                maxQuantity: hasKnownStock ? (allowBackorder && stockQty <= 0 ? undefined : Math.max(0, stockQty)) : undefined,
                commission_rate: normalizedProduct.commission_type === 'flat_rate' ? (normalizedProduct.flat_commission_amount ?? 0) : (normalizedProduct.commission_rate ?? DEFAULT_AFFILIATE_RATE),
                commission_type: normalizedProduct.commission_type,
                flat_commission_amount: normalizedProduct.commission_type === 'flat_rate' ? (normalizedProduct.flat_commission_amount ?? 0) : 0,
                affiliateId: itemAffiliateId,
                isDigital: (normalizedProduct as any).is_digital === true,
              });
            });
            navigate('/checkout');
          };

          const handleCardClick = (e: React.MouseEvent) => {
            if (!isStorefrontCtas) return;
            if (requiresOptionSelection) {
              e.preventDefault();
              e.stopPropagation();
              navigate(productPathWithAttribution, { state: backState });
              return;
            }
            handleBuyNow(e);
          };

          return (
          <div 
            key={normalizedProduct.id} 
            data-testid={`product-card-${normalizedProduct.id}`}
            className={`group overflow-hidden transition-all duration-300 ${cardSizeClasses[gridLayout]} ${
              storefrontCard
                ? 'rounded-[28px] border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.14)]'
                : 'bg-white rounded-lg shadow-lg hover:shadow-xl border-2'
            }`}
            style={{ 
              borderColor: colorScheme?.secondary || '#e5e7eb',
              '--hover-border': primaryColor
            } as React.CSSProperties & { '--hover-border': string }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = colorScheme?.secondary || '#e5e7eb'}
            onClick={handleCardClick}
          >
            <Link to={productPathWithAttribution} className="block" onClick={(e) => e.stopPropagation()}>
              <div className={`${storefrontCard ? 'aspect-[4/5]' : 'aspect-square'} relative overflow-hidden`}>
                <img
                  src={heroImage}
                  alt={normalizedProduct.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {storefrontCard && <div className="absolute inset-0 bg-gradient-to-t from-slate-950/18 via-transparent to-transparent" />}
                {isUnavailable && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="bg-red-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Out of stock
                    </span>
                  </div>
                )}
                
                {/* Affiliate Status Badge - Top Left */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {/* Featured Badge */}
                  {(normalizedProduct as any).is_featured && (
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-md backdrop-blur">
                      Featured
                    </span>
                  )}
                  
                  {/* Marketplace/Store Badge */}
                  {!hideAffiliateUI && (
                    normalizedProduct.affiliate_enabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
                        <ShoppingBag className="w-3 h-3" /> Marketplace
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md">
                        <Store className="w-3 h-3" /> Store Only
                      </span>
                    )
                  )}
                </div>
                
                {/* Action Buttons */}
                {!hideShareUI && (
                  <div className="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <SocialShareButton 
                      product={normalizedProduct}
                      variant="icon"
                      size="sm"
                      className="bg-primary-50 bg-opacity-90 hover:bg-opacity-100 shadow-md border border-primary-200"
                    />
                  </div>
                )}
                
                {/* Commission info - only show where affiliate UI is desired */}
                {!hideAffiliateUI && Number(commissionConfig.value || 0) > 0 && (
                  <div className="absolute bottom-2 left-2 bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 shadow-lg">
                    <TrendingUp className="h-3 w-3" />
                    <span>
                      ${payouts.affiliateCommission.toFixed(2)}
                      {normalizedProduct.is_subscription && normalizedProduct.subscription_interval && (
                        <span className="ml-1">(recurring {normalizedProduct.subscription_interval})</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </Link>

            <div className={storefrontCard ? 'p-5' : 'p-4'}>
              {storefrontCard && (
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-[0.22em]" style={{ color: accentColor }}>
                    {storefrontBrand?.name ? 'Store pick' : 'Featured item'}
                  </div>
                  {isCJProduct ? (
                    <span className="text-[11px] font-semibold text-slate-500">Shipping at checkout</span>
                  ) : typeof normalizedProduct.shipping_cost === 'number' ? (
                    <span className="text-[11px] font-semibold" style={{ color: primaryColor }}>
                      {formatShippingLineItem(normalizedProduct.shipping_cost)}
                    </span>
                  ) : null}
                </div>
              )}
              <Link to={productPathWithAttribution} onClick={(e) => e.stopPropagation()}>
                <h3
                  data-testid={`product-title-${normalizedProduct.id}`}
                  className={`font-display text-gray-800 hover:text-primary-600 transition-colors ${storefrontCard ? 'mb-3 text-[1.15rem] font-bold leading-7 line-clamp-2' : 'mb-2 font-semibold line-clamp-2'}`}
                >
                  {normalizedProduct.title}
                </h3>
              </Link>

              {!hideAffiliateUI && Number(commissionConfig.value || 0) > 0 && (
                <div className="mb-2 text-xs font-medium text-emerald-700">
                  {commissionDisplayLabel}
                </div>
              )}

              {identifierLines.length > 0 && (
                <div className="mb-2 space-y-1">
                  {identifierLines.map((line) => (
                    <div key={line} className="text-xs text-amber-700 font-medium">
                      {line}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Rating Display */}
              {normalizedProduct.average_rating > 0 && normalizedProduct.review_count > 0 && (
                <div className="flex items-center space-x-2 mb-2">
                  <StarRating rating={normalizedProduct.average_rating} size="sm" />
                  <span className="text-gray-600 text-sm">
                    {normalizedProduct.average_rating.toFixed(1)} ({normalizedProduct.review_count || 0} {(normalizedProduct.review_count || 0) === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {/* Transparent Pricing Display */}
                  <div className="group relative">
                    {hideAffiliateUI ? (
                      <div className="flex items-center space-x-2">
                        <span className={`${storefrontCard ? 'text-2xl' : 'text-lg'} font-bold text-gray-900`}>{formatStorefrontPrice(payouts.salePrice)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-2">
                          <span className={`${storefrontCard ? 'text-2xl' : 'text-lg'} font-bold text-gray-900`}>{formatStorefrontPrice(payouts.salePrice)}</span>
                          <Info className="w-4 h-4 text-gray-400 cursor-help" />
                        </div>
                        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                          <div className="text-sm text-gray-700 space-y-1">
                            <div className="font-semibold text-gray-900">Transparent pricing</div>
                            <div className="flex justify-between"><span>Seller keeps</span><span className="font-medium text-green-600">${payouts.sellerPayout.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Affiliate earns</span><span className="font-medium text-blue-600">${payouts.affiliateCommission.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>{platformLabel}</span><span className="font-medium text-purple-600">${payouts.beezioGross.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Payment fees</span><span className="font-medium text-gray-600">${payouts.processingFee.toFixed(2)}</span></div>
                            <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                              <span>Buyer pays</span><span className="text-gray-900">${payouts.salePrice.toFixed(2)}</span>
                            </div>
                            <div className="text-xs text-gray-500">No hidden fees. Shipping & tax are added at checkout.</div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {normalizedProduct.is_subscription && normalizedProduct.subscription_interval && (
                    <span className="ml-2 text-primary-600 text-xs font-semibold bg-primary-50 px-2 py-1 rounded-full">
                      {normalizedProduct.subscription_interval.charAt(0).toUpperCase() + normalizedProduct.subscription_interval.slice(1)}
                    </span>
                  )}
                  {!storefrontCard && typeof normalizedProduct.shipping_cost === 'number' && !isCJProduct && (
                    <span className="text-primary-500 text-xs font-semibold">{formatShippingLineItem(normalizedProduct.shipping_cost)}</span>
                  )}
                  {!storefrontCard && isCJProduct && (
                    <span className="text-xs font-semibold text-slate-500">Shipping calculated at checkout</span>
                  )}
                </div>
              </div>

              {normalizedProduct.description && (
                <p className={`text-gray-600 ${storefrontCard ? 'mb-5 text-[0.95rem] leading-7 line-clamp-3' : 'mb-4 text-sm line-clamp-2'}`}>
                  {normalizedProduct.description}
                </p>
              )}

              {/* Seller Info and Share Button */}
              <div className={`flex items-center justify-between ${storefrontCard ? 'mb-5 border-t border-slate-100 pt-4' : 'mb-4'}`}>
                {storefrontBrand && !hideSellerInfo ? (
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      {storefrontBrand.logoUrl ? (
                        <img
                          src={storefrontBrand.logoUrl}
                          alt={storefrontBrand.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-white"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center font-semibold">
                          {storefrontBrand.name?.charAt(0) || 'S'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-800 font-semibold text-sm line-clamp-1">
                        {storefrontBrand.name}
                      </p>
                    </div>
                  </div>
                ) : !hideSellerInfo && normalizedProduct.profiles ? (
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      <Link to={`/profile/${normalizedProduct.seller_id}`}>
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(normalizedProduct.profiles.full_name)}&size=128&background=random`}
                          alt={normalizedProduct.profiles.full_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-primary-300"
                        />
                      </Link>
                    </div>
                    <div className="flex-1">
                      <Link to={`/profile/${normalizedProduct.seller_id}`}>
                        <p className="text-gray-800 font-semibold text-sm line-clamp-1 hover:text-primary-600 transition-colors">
                          {normalizedProduct.profiles?.full_name}
                        </p>
                      </Link>
                      {normalizedProduct.profiles?.location && (
                        <p className="text-gray-600 text-xs line-clamp-1">
                          {normalizedProduct.profiles.location}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                {/* Share Button */}
                {!hideShareUI && (
                  <div className="flex-shrink-0">
                    <SocialShareButton 
                      product={normalizedProduct}
                      size="sm"
                    />
                  </div>
                )}
              </div>

              {/* Purchase CTAs */}
              {shouldShowPurchaseCtas && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isUnavailable}
                    className={`flex-1 border text-sm font-semibold transition-colors ${storefrontCard ? 'rounded-full px-4 py-3' : 'rounded-lg px-3 py-2'} ${
                      isUnavailable
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : storefrontCard
                        ? 'bg-white text-gray-900 border-gray-300 hover:border-gray-500'
                        : 'bg-white text-gray-900 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={isUnavailable}
                    className={`flex-1 text-sm font-semibold transition-colors ${storefrontCard ? 'rounded-full px-4 py-3' : 'rounded-lg px-3 py-2'} ${
                      isUnavailable
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : storefrontCard
                        ? 'text-white shadow-sm hover:brightness-95'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                    style={storefrontCard && !isUnavailable ? { backgroundColor: primaryColor } : undefined}
                  >
                    Buy Now
                  </button>
                </div>
              )}

              {/* Store management button */}
              {shouldShowStoreCta && (
                <div className="mt-3 mb-2">
                  {canAddToAffiliateStore ? (
                    <AddToAffiliateStoreButton
                      productId={normalizedProduct.id}
                      sellerId={normalizedProduct.seller_id}
                      productTitle={normalizedProduct.title}
                      productPrice={salePrice}
                      defaultCommissionRate={normalizedProduct.commission_rate}
                      size="sm"
                      variant="button"
                      ctaText="Add to Store"
                      addedText="In your affiliate store"
                      showRemove={false}
                    />
                  ) : canAddToSellerStore ? (
                    <AddToSellerStoreButton
                      productId={normalizedProduct.id}
                      size="sm"
                      variant="button"
                      addedText="In your seller store"
                      showRemove={false}
                    />
                  ) : null}
                </div>
              )}

              {/* Affiliate Link for this product - only for affiliates */}
              {isAffiliateActive && !hideAffiliateUI && (
                <div className="mt-4 space-y-2">
                  <AffiliateLink
                    productId={normalizedProduct.id}
                    commissionRate={normalizedProduct.commission_rate}
                    commissionType={normalizedProduct.commission_type}
                    flatCommissionAmount={normalizedProduct.flat_commission_amount}
                    price={salePrice}
                  />
                  <ProductAffiliateQRCode product={normalizedProduct} profile={profile} />
                </div>
              )}
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
};

export default ProductGrid;
