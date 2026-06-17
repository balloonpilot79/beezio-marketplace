import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { Heart, ShoppingCart, Star, Award, ExternalLink } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { deriveAskPriceFromFinalPrice } from '../utils/pricingEngine';
import { DEFAULT_PAYOUT_SETTINGS, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import { getFallbackProductImage, normalizeProductImages } from '../utils/imageHelpers';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { getAffiliateAmount, resolveAffiliateCommission } from '../utils/pricing';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { getProductIdentifierLines } from '../utils/productIdentifiers';
import { formatMoneyDisplay, formatShippingLineItem, isFreeShippingValue } from '../utils/moneyDisplay';
import AddToAffiliateStoreButton from './AddToAffiliateStoreButton';
import AddToSellerStoreButton from './AddToSellerStoreButton';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { normalizeAccountRole } from '../utils/accountRoles';

interface Product {
  id: string;
  title: string;
  price: number;
  seller_ask?: number;
  seller_amount?: number;
  images: string[];
  variants?: unknown;
  has_variants?: boolean;
  product_variants?: Array<{ id?: string }> | null;
  description?: string;
  shipping_cost?: number;
  stock_quantity?: number;
  requires_shipping?: boolean;
  lineage?: string;
  in_stock?: boolean;
  total_inventory?: number;
  dropship_provider?: string;
  track_inventory?: boolean;
  source_platform?: string;
  source?: string;
  inventory_source?: string;
  is_active?: boolean;
  is_promotable?: boolean;
  status?: string;
  commission_rate?: number;
  affiliate_commission_rate?: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
  affiliate_commission_type?: 'percent' | 'flat';
  affiliate_commission_value?: number;
  seller_id?: string;
  category?: string;
  profiles?: {
    full_name: string;
  };
  average_rating?: number;
  review_count?: number;
}

interface ProductCardProps {
  product: Product;
  viewMode: 'grid' | 'list';
  affiliateRef?: string | null;
  affiliateUid?: string | null;
  compact?: boolean;
  ctaMode?: 'marketplace' | 'storefront';
  forcePurchaseCtas?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  viewMode,
  affiliateRef,
  affiliateUid,
  compact = false,
  ctaMode = 'marketplace',
  forcePurchaseCtas = false,
}) => {
  const { addToCart, clearCart } = useCart();
  const { user, profile, currentRole, userRoles, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
    const shippingCost = typeof product.shipping_cost === 'number' ? product.shipping_cost : 0;
  const displayDescription = useMemo(() => {
      return sanitizeDescriptionForDisplay(product.description, product.lineage);
    }, [product.description, product.lineage]);
  const identifierLines = useMemo(() => getProductIdentifierLines(product), [product]);
  const commissionConfig = resolveAffiliateCommission(product as any);
  const commissionRate = commissionConfig.type === 'percent' ? commissionConfig.value : DEFAULT_PAYOUT_SETTINGS.affiliatePercent;
  const commissionType = commissionConfig.type === 'flat' ? 'flat_rate' : 'percentage';
  const flatCommission = commissionConfig.type === 'flat' ? commissionConfig.value : 0;
  const payout = {
    affiliatePercent: commissionType === 'flat_rate' ? 0 : commissionRate,
    platformPercent: PLATFORM_FEE_PERCENT,
  };
  const commissionBadgeLabel = commissionType === 'flat_rate'
    ? 'Per sale'
    : `${commissionRate}% per sale`;
  const commissionPromoLabel = commissionType === 'flat_rate'
    ? `Earn $${flatCommission.toFixed(2)}`
    : `Earn ${commissionRate}%`;
  const commissionDisplayLabel = commissionType === 'flat_rate'
    ? `$${flatCommission.toFixed(2)} affiliate commission`
    : `${commissionRate}% affiliate commission`;
  const showCommissionDisplay =
    commissionType === 'flat_rate'
      ? flatCommission > 0
      : commissionRate > 0;

  const derivedRole = normalizeAccountRole(profile?.primary_role || profile?.role || currentRole);
  const effectiveRole = derivedRole;
  const isSellerRole = effectiveRole === 'seller';
  const isAffiliateRole = effectiveRole === 'affiliate';
  const canAddAsAffiliate =
    Boolean(user?.id) &&
    (isAffiliateRole ||
      hasRole('affiliate') ||
      hasRole('partner'));
  const canAddAsSeller =
    Boolean(user?.id) &&
    (isSellerRole || hasRole('seller'));
  const isSellingRole = isSellerRole || isAffiliateRole || canAddAsAffiliate;
  const isStorefrontCtas = ctaMode === 'storefront';
  const showPurchaseCtas = forcePurchaseCtas || isStorefrontCtas || !isSellingRole;
  const showStoreCta = Boolean(user?.id) && !isStorefrontCtas && isSellingRole;
  const showAffiliateEarnings = !isStorefrontCtas && canAddAsAffiliate;
  const cartAffiliateId = String(affiliateRef || affiliateUid || '').trim() || undefined;

  // Variants can be represented in 3 different ways across the codebase:
  // 1) Legacy `products.variants` JSONB
  // 2) Normalized `product_variants` table (recommended)
  // 3) Derived/materialized `products.has_variants` boolean (best for lists)
  const rawVariants = (product as any)?.variants;
  const hasVariants =
    Boolean((product as any)?.has_variants) ||
    (Array.isArray((product as any)?.product_variants) && (product as any).product_variants.length > 0) ||
    (Array.isArray(rawVariants) && rawVariants.length > 0);

  const rawInventory =
    typeof product.stock_quantity === 'number' && Number.isFinite(product.stock_quantity)
      ? product.stock_quantity
      : typeof product.total_inventory === 'number' && Number.isFinite(product.total_inventory)
      ? product.total_inventory
      : null;
  const stockQuantity = typeof rawInventory === 'number' ? Math.max(0, Math.floor(rawInventory)) : null;
  const hasKnownStock = typeof stockQuantity === 'number';
  const allowBackorder =
    String((product as any)?.lineage || '').toUpperCase() === 'CJ' ||
    String((product as any)?.dropship_provider || '').toLowerCase() === 'cj' ||
    String((product as any)?.source_platform || '').toLowerCase() === 'cj' ||
    String((product as any)?.source || '').toLowerCase() === 'cj' ||
    String((product as any)?.inventory_source || '').toLowerCase() === 'cj' ||
    Boolean((product as any)?.cj_product_id || (product as any)?.cj_pid || (product as any)?.cj_spu || (product as any)?.display_search_code);
  const tracksInventory = product.track_inventory !== false;
  const explicitInStock = typeof product.in_stock === 'boolean' ? product.in_stock : null;
  const isListedProduct =
    product.is_active === true ||
    product.is_promotable === true ||
    String(product.status || '').trim().toLowerCase() === 'active';
  const isOutOfStock =
    !isListedProduct &&
    !allowBackorder &&
    tracksInventory &&
    (
      (hasKnownStock && stockQuantity <= 0) ||
      (!hasKnownStock && explicitInStock === false)
    );
  const inventoryLabel =
    isListedProduct
      ? 'Available'
      : !tracksInventory
      ? 'In stock'
      : allowBackorder && (!hasKnownStock || Number(stockQuantity) <= 0)
      ? 'Live inventory checked at checkout'
      : hasKnownStock
      ? isOutOfStock
        ? 'Out of stock'
        : `${stockQuantity} in stock`
      : explicitInStock === true
      ? 'In stock'
      : stockQuantity === null
      ? 'Inventory unavailable'
      : 'In stock';
  const inventoryTone =
    isListedProduct
      ? 'text-green-600'
      : !tracksInventory
      ? 'text-green-600'
      : allowBackorder && (!hasKnownStock || Number(stockQuantity) <= 0)
      ? 'text-amber-600'
      : hasKnownStock
      ? isOutOfStock
        ? 'text-red-600'
        : stockQuantity <= 5
        ? 'text-amber-600'
        : 'text-green-600'
      : explicitInStock === true
      ? 'text-green-600'
      : stockQuantity === null
      ? 'text-gray-500'
      : 'text-green-600';

  const finalPrice = useMemo(() => {
    return getBuyerFacingProductPrice(product as any);
  }, [product]);

  const derivedAskPrice = useMemo(() => {
    if (typeof product.seller_ask === 'number' && product.seller_ask > 0) return product.seller_ask;
    if (typeof product.seller_amount === 'number' && product.seller_amount > 0) return product.seller_amount;
    return deriveAskPriceFromFinalPrice(finalPrice, payout);
  }, [finalPrice, payout, product.seller_amount, product.seller_ask]);

  const earningsAmount = useMemo(() => {
    // Only show affiliate earnings to logged-in affiliates or sellers
    if (isAffiliateRole || isSellerRole) {
      return getAffiliateAmount(derivedAskPrice, commissionType === 'flat_rate' ? 'flat' : 'percent', commissionType === 'flat_rate' ? flatCommission : commissionRate);
    }
    return null;
  }, [commissionRate, commissionType, derivedAskPrice, flatCommission, isAffiliateRole, isSellerRole]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Allow purchase if:
    // - stockQuantity is null/undefined (treat as in stock)
    // - stockQuantity > 0
    // Only block if stockQuantity is explicitly 0 or less
    if (isOutOfStock) {
      alert('Out of stock.');
      return;
    }

    if (hasVariants) {
      const params = new URLSearchParams();
      if (affiliateRef) params.set('ref', affiliateRef);
      if (affiliateUid) params.set('uid', affiliateUid);
      const search = params.toString();
      const url = search ? `/product/${product.id}?${search}` : `/product/${product.id}`;
      navigate(url, { state: backState });
      return;
    }

    const sellerAsk =
      typeof product.seller_ask === 'number' && product.seller_ask > 0
        ? product.seller_ask
        : typeof product.seller_amount === 'number' && product.seller_amount > 0
        ? product.seller_amount
        : finalPrice;

    flushSync(() => {
      addToCart(buildCartItem({ sellerAsk, commissionType, flatCommission }));
    });
    navigate('/cart');
  };

  const buildCartItem = (args: {
    sellerAsk: number;
    commissionType: 'percentage' | 'flat_rate';
    flatCommission: number;
  }) => {
    return {
      productId: product.id,
      title: product.title,
      price: finalPrice,
      sellerAsk: args.sellerAsk,
      quantity: 1,
      image: currentImage,
      sellerId: product.seller_id || 'unknown-seller',
      sellerName: product.profiles?.full_name || 'Seller',
      shippingCost,
      maxQuantity: allowBackorder && stockQuantity !== null && stockQuantity <= 0 ? undefined : (stockQuantity ?? undefined),
      commission_rate: args.commissionType === 'flat_rate' ? args.flatCommission : commissionRate,
      commission_type: args.commissionType,
      flat_commission_amount: args.commissionType === 'flat_rate' ? args.flatCommission : 0,
      affiliateId: cartAffiliateId,
      isDigital: (product as any).is_digital === true,
    };
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOutOfStock) {
      alert('Out of stock.');
      return;
    }

    if (hasVariants) {
      const params = new URLSearchParams();
      if (affiliateRef) params.set('ref', affiliateRef);
      if (affiliateUid) params.set('uid', affiliateUid);
      const search = params.toString();
      const url = search ? `/product/${product.id}?${search}` : `/product/${product.id}`;
      navigate(url, { state: backState });
      return;
    }

    const sellerAsk = derivedAskPrice;

    flushSync(() => {
      clearCart();
      addToCart(buildCartItem({ sellerAsk, commissionType, flatCommission }));
    });
    navigate('/checkout');
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Wishlist logic here
    console.log('Adding to wishlist:', product.id);
  };

  const handleViewProduct = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const params = new URLSearchParams();
    if (affiliateRef) params.set('ref', affiliateRef);
    if (affiliateUid) params.set('uid', affiliateUid);
    const search = params.toString();
    const url = search ? `/product/${product.id}?${search}` : `/product/${product.id}`;
    navigate(url, { state: backState });
  };

  const productTo = (() => {
    const params = new URLSearchParams();
    if (affiliateRef) params.set('ref', affiliateRef);
    if (affiliateUid) params.set('uid', affiliateUid);
    const search = params.toString();
    return search
      ? { pathname: `/product/${product.id}`, search: `?${search}` }
      : { pathname: `/product/${product.id}` };
  })();

  const backState = useMemo(
    () => ({ from: `${location.pathname}${location.search}`, product }),
    [location.pathname, location.search],
  );

  const fallbackSeed = product.id || product.title;
  const imageCandidates = useMemo(
    () => normalizeProductImages(product.images),
    [product.images],
  );
  const fallbackImage = useMemo(
    () => getFallbackProductImage(fallbackSeed),
    [fallbackSeed],
  );
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const currentImage = useMemo(
    () => imageCandidates.find((image) => !failedImages[image]) || fallbackImage,
    [fallbackImage, failedImages, imageCandidates],
  );

  useEffect(() => {
    setFailedImages({});
  }, [imageCandidates]);

  const handleImageError = useCallback(() => {
    setFailedImages((prev) => (currentImage && !prev[currentImage] ? { ...prev, [currentImage]: true } : prev));
  }, [currentImage]);

  if (viewMode === 'list') {
    return (
      <Link to={productTo} state={backState} className="block">
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 p-6 transition-all duration-300 hover:border-purple-200 group">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <img
                src={currentImage}
                alt={product.title}
                className="w-32 h-32 object-cover rounded-xl group-hover:scale-105 transition-transform duration-300"
                onError={handleImageError}
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
              {showStoreCta && (commissionType === 'flat_rate' ? flatCommission > 0 : commissionRate > 15) && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                  {commissionPromoLabel}
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h3
                  data-testid={`product-title-${product.id}`}
                  className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2"
                >
                  {product.title}
                </h3>
              </div>

              {identifierLines.length > 0 && (
                <div className="mb-2 space-y-1">
                  {identifierLines.map((line) => (
                    <div key={line} className="text-xs text-amber-700 font-medium">
                      {line}
                    </div>
                  ))}
                </div>
              )}
              
              <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                {displayDescription}
              </p>
              
              <div className="flex items-center space-x-4 mb-3">
                {Number(product.average_rating) > 0 && Number(product.review_count) > 0 ? (
                  <div className="flex items-center">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.average_rating || 0) ? 'fill-current' : ''}`} />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500 ml-2">
                      ({product.review_count})
                    </span>
                  </div>
                ) : null}
                
                {showAffiliateEarnings && (
                  <div className="flex items-center bg-green-50 px-2 py-1 rounded-full">
                    <Award className="w-3 h-3 text-green-600 mr-1" />
                    <span className="text-xs text-green-700 font-medium">
                      {commissionBadgeLabel}
                    </span>
                  </div>
                )}
                <div className={`text-xs font-medium ${inventoryTone}`}>{inventoryLabel}</div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div data-testid={`product-price-${product.id}`} className="text-2xl font-bold text-gray-900">
                    {formatMoneyDisplay(finalPrice)}
                  </div>
                  <button
                    onClick={handleWishlist}
                    className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-red-500 transition-colors"
                    aria-label="Add to wishlist"
                  >
                    <Heart className="w-4 h-4" />
                    <span>Save</span>
                  </button>
                  {showPurchaseCtas && (
                    <div className="text-xs text-gray-500">Buyer price (before tax & shipping)</div>
                  )}
                  {showCommissionDisplay && (
                    <div className="text-xs text-gray-500">{commissionDisplayLabel}</div>
                  )}
                  {showAffiliateEarnings && earningsAmount !== null && (
                    <div className="text-xs text-gray-500">You earn ${earningsAmount.toFixed(2)}</div>
                  )}
                  {(product.requires_shipping || shippingCost > 0) && (
                    <div className="text-xs text-gray-500">{formatShippingLineItem(shippingCost)}</div>
                  )}
                  <div className="text-sm text-gray-500">
                    by {product.profiles?.full_name || 'Seller'}
                  </div>
                </div>
                
                <div className="flex flex-col items-stretch gap-2">
                  {showAffiliateEarnings && earningsAmount !== null && (
                    <div className="mb-1 text-xs text-green-700 font-semibold text-center">
                      Affiliate earns: ${earningsAmount.toFixed(2)} per sale
                    </div>
                  )}
                  {showPurchaseCtas && (
                    <>
                      <button
                        onClick={handleAddToCart}
                        disabled={isOutOfStock}
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                      >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        {isStorefrontCtas ? 'Add to Cart' : hasVariants ? 'Choose Options' : 'Add to Cart'}
                      </button>
                      <button
                        onClick={handleBuyNow}
                        disabled={isOutOfStock}
                        className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center"
                      >
                        {isStorefrontCtas ? 'Buy Now' : hasVariants ? 'Choose Options' : 'Buy Now'}
                      </button>
                    </>
                  )}

                  {showStoreCta && (
                    <div className="pt-1">
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      {isOutOfStock ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
                          Out of stock
                        </div>
                      ) : canAddAsAffiliate ? (
                        <AddToAffiliateStoreButton
                          productId={product.id}
                          sellerId={product.seller_id || ''}
                          productTitle={product.title}
                          productPrice={finalPrice}
                          defaultCommissionRate={commissionRate}
                          commissionType={commissionType}
                          flatCommissionAmount={flatCommission}
                          productImage={currentImage}
                          productCategory={product.category || ''}
                          productDescription={displayDescription}
                          size="sm"
                          ctaText="Add to Store"
                          addedText="In your affiliate store"
                          showRemove={false}
                          instantAdd
                        />
                      ) : canAddAsSeller ? (
                        <AddToSellerStoreButton productId={product.id} size="sm" variant="button" addedText="In your seller store" showRemove={false} />
                      ) : null}
                      
                    </div>

                      <button
                        type="button"
                        onClick={handleViewProduct}
                        className="mt-2 w-full bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center border border-gray-200 hover:border-gray-300"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Product
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={productTo} state={backState} className={`block group ${compact ? 'w-40 min-w-40 flex-none sm:w-44 sm:min-w-44 lg:w-48 lg:min-w-48' : ''}`}>
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:border-purple-200 hover:-translate-y-1">
        <div className="relative">
          <img
            src={currentImage}
            alt={product.title}
            className={`w-full object-cover group-hover:scale-105 transition-transform duration-500 ${compact ? 'h-24 sm:h-28' : 'h-56'}`}
            onError={handleImageError}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
          
          {/* Badges */}
          <div className={`absolute left-3 flex flex-col ${compact ? 'top-1.5 space-y-1' : 'top-3 space-y-2'}`}>
            {showStoreCta && (commissionType === 'flat_rate' ? flatCommission > 0 : commissionRate > 15) && (
              <div className={`bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-full font-bold shadow-lg backdrop-blur-sm ${compact ? 'text-[9px] px-2 py-0.5' : 'text-xs px-3 py-1'}`}>
                {commissionPromoLabel}
              </div>
            )}
            {showStoreCta && (
              <div className={`bg-green-500/90 backdrop-blur-sm text-white rounded-full font-medium ${compact ? 'text-[9px] px-2 py-0.5' : 'text-xs px-3 py-1'}`}>
                {commissionBadgeLabel}
              </div>
            )}
          </div>
          
        </div>
        
        <div className={compact ? 'p-2.5' : 'p-5'}>
          <div className={compact ? 'mb-1.5' : 'mb-3'}>
            <h3 className={`font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 mb-1 ${compact ? 'text-xs leading-4' : 'text-lg mb-2'}`}>
              {product.title}
            </h3>

            {identifierLines.length > 0 && (
              <div className={`${compact ? 'text-[10px] mb-1' : 'text-xs mb-2'} space-y-1 text-amber-700 font-medium`}>
                {identifierLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
            
            <div className={`text-gray-500 ${compact ? 'text-[10px] mb-0.5' : 'text-sm mb-2'}`}>
              by {product.profiles?.full_name || 'Seller'}
            </div>
            
            {Number(product.average_rating) > 0 && Number(product.review_count) > 0 ? (
              <div className={`flex items-center ${compact ? 'space-x-1' : 'space-x-2'}`}>
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${i < Math.floor(product.average_rating || 0) ? 'fill-current' : ''}`} />
                  ))}
                </div>
                <span className={`${compact ? 'text-[10px]' : 'text-sm'} text-gray-500`}>
                  ({product.review_count})
                </span>
              </div>
            ) : null}
            <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium ${inventoryTone}`}>{inventoryLabel}</div>
          </div>
          
          <div className={`flex items-start justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
            <div className="space-y-0.5">
              <div data-testid={`product-price-${product.id}`} className={`${compact ? 'text-sm' : 'text-2xl'} font-bold text-gray-900`}>{formatMoneyDisplay(finalPrice)}</div>
              <button
                onClick={handleWishlist}
                className={`inline-flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition-colors ${compact ? 'text-[10px] mt-1' : 'text-sm mt-2 font-medium'}`}
                aria-label="Add to wishlist"
              >
                <Heart className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
                <span>Save</span>
              </button>
              {showPurchaseCtas && (
                <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>Buyer price</div>
              )}
              {showCommissionDisplay && (
                <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>{commissionDisplayLabel}</div>
              )}
              {showStoreCta && earningsAmount !== null && canAddAsAffiliate && (
                <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>You earn ${earningsAmount.toFixed(2)}</div>
              )}
            </div>
            {(product.requires_shipping || shippingCost > 0) && (
              <div className={`${compact ? 'text-[10px]' : 'text-sm'} text-gray-600 font-medium text-right`}>
                {isFreeShippingValue(shippingCost) ? 'Free shipping' : `+ ${formatMoneyDisplay(shippingCost)} shipping`}
              </div>
            )}
          </div>

          
          <div className={compact ? 'space-y-1' : 'space-y-2'}>
            <div className="flex flex-col gap-1">
              {showPurchaseCtas && (
                <>
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className={`flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-xl font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-purple-500/25 transform hover:scale-105 ${compact ? 'py-1.5 text-[10px]' : 'py-3'}`}
                  >
                    <ShoppingCart className={`${compact ? 'w-3 h-3 mr-1' : 'w-5 h-5 mr-2'}`} />
                    {isStorefrontCtas ? 'Add to Cart' : hasVariants ? 'Choose Options' : 'Add to Cart'}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    disabled={isOutOfStock}
                    className={`flex-1 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-medium transition-colors ${compact ? 'py-1.5 text-[10px]' : 'py-3'}`}
                  >
                    {isStorefrontCtas ? 'Buy Now' : hasVariants ? 'Choose Options' : 'Buy Now'}
                  </button>
                </>
              )}
            </div>

                  {showStoreCta && (
                    <div
                      className="pt-1"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      {isOutOfStock ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
                          Out of stock
                        </div>
                      ) : canAddAsAffiliate ? (
                        <AddToAffiliateStoreButton
                          productId={product.id}
                          sellerId={product.seller_id || ''}
                          productTitle={product.title}
                      productPrice={finalPrice}
                      defaultCommissionRate={commissionRate}
                      commissionType={commissionType}
                      flatCommissionAmount={flatCommission}
                      productImage={currentImage}
                      productCategory={product.category || ''}
                      productDescription={displayDescription}
                      size="sm"
                          ctaText="Add to Store"
                          addedText="In your affiliate store"
                          showRemove={false}
                          instantAdd
                        />
                      ) : canAddAsSeller ? (
                        <AddToSellerStoreButton productId={product.id} size="sm" variant="button" addedText="In your seller store" showRemove={false} />
                      ) : null}
                      
                    </div>
                  )}

            <Link
              to={productTo}
              state={backState}
              className={`w-full bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-medium transition-all duration-200 flex items-center justify-center border border-gray-200 hover:border-gray-300 ${compact ? 'py-1.5 text-[10px]' : 'py-3'}`}
            >
              <ExternalLink className={`${compact ? 'w-3 h-3 mr-1' : 'w-4 h-4 mr-2'}`} />
              {showStoreCta ? 'View Product' : hasVariants ? 'View Options' : 'View Product'}
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
