import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, ShoppingCart, Star, Award, ExternalLink } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { calculateFinalPrice, computePayoutBreakdown, deriveAskPriceFromFinalPrice } from '../utils/pricingEngine';
import { DEFAULT_PAYOUT_SETTINGS, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import { resolveProductImage } from '../utils/imageHelpers';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import AddToAffiliateStoreButton from './AddToAffiliateStoreButton';
import AddToSellerStoreButton from './AddToSellerStoreButton';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';

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
  commission_rate?: number;
  affiliate_commission_rate?: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
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
}

const ProductCard: React.FC<ProductCardProps> = ({ product, viewMode, affiliateRef }) => {
  const { addToCart, clearCart } = useCart();
  const { profile, currentRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
    const shippingCost = typeof product.shipping_cost === 'number' ? product.shipping_cost : 0;
    const displayDescription = useMemo(() => {
      return sanitizeDescriptionForDisplay(product.description, product.lineage);
    }, [product.description, product.lineage]);
  const commissionRate = product.commission_rate ?? product.affiliate_commission_rate ?? DEFAULT_PAYOUT_SETTINGS.affiliatePercent;
  const payout = {
    affiliatePercent: commissionRate,
    platformPercent: PLATFORM_FEE_PERCENT,
    fundraiserPercent: DEFAULT_PAYOUT_SETTINGS.fundraiserPercent,
  };

  // IMPORTANT: Use the *active* role (currentRole) to decide which CTAs to show.
  // Otherwise multi-role users would always see seller CTAs even when switched to affiliate/buyer.
  const derivedRole = String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase();
  const isSellerRole = derivedRole === 'seller';
  const isAffiliateRole = derivedRole === 'affiliate';
  const isFundraiserRole = derivedRole === 'fundraiser';
  const isSellingRole = isSellerRole || isAffiliateRole || isFundraiserRole;
  const showPurchaseCtas = true;
  const showStoreCta = isSellingRole;

  // Variants can be represented in 3 different ways across the codebase:
  // 1) Legacy `products.variants` JSONB
  // 2) Normalized `product_variants` table (recommended)
  // 3) Derived/materialized `products.has_variants` boolean (best for lists)
  const rawVariants = (product as any)?.variants;
  const hasVariants =
    Boolean((product as any)?.has_variants) ||
    (Array.isArray((product as any)?.product_variants) && (product as any).product_variants.length > 0) ||
    (Array.isArray(rawVariants) && rawVariants.length > 0);

  const stockQuantity = typeof product.stock_quantity === 'number' && Number.isFinite(product.stock_quantity)
    ? Math.max(0, Math.floor(product.stock_quantity))
    : null;

  const finalPrice = useMemo(() => {
    if (typeof product.seller_ask === 'number' && product.seller_ask > 0) {
      return calculateFinalPrice(product.seller_ask, payout);
    }
    // If seller_ask isn't present, assume `price` is already customer-facing.
    return product.price;
  }, [product.price, product.seller_ask, payout]);

  const derivedAskPrice = useMemo(() => {
    if (typeof product.seller_ask === 'number' && product.seller_ask > 0) return product.seller_ask;
    if (typeof product.seller_amount === 'number' && product.seller_amount > 0) return product.seller_amount;
    return deriveAskPriceFromFinalPrice(finalPrice, payout);
  }, [finalPrice, payout, product.seller_amount, product.seller_ask]);

  const payoutBreakdown = useMemo(
    () => computePayoutBreakdown(finalPrice, derivedAskPrice, payout),
    [derivedAskPrice, finalPrice, payout],
  );

  const earningsAmount = useMemo(() => {
    // Only show affiliate earnings to logged-in affiliates, sellers, or fundraisers
    if (isAffiliateRole || isSellerRole || isFundraiserRole) {
      return payoutBreakdown.affiliateAmount;
    }
    return null;
  }, [isAffiliateRole, isSellerRole, isFundraiserRole, payoutBreakdown]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (stockQuantity !== null && stockQuantity <= 0) {
      alert('Out of stock.');
      return;
    }

    if (hasVariants) {
      const url = affiliateRef ? `/product/${product.id}?ref=${affiliateRef}` : `/product/${product.id}`;
      navigate(url, { state: backState });
      return;
    }

    const commissionType = product.commission_type ?? 'percentage';
    const flatCommission = product.flat_commission_amount ?? 0;
    const sellerAsk =
      typeof product.seller_ask === 'number' && product.seller_ask > 0
        ? product.seller_ask
        : typeof product.seller_amount === 'number' && product.seller_amount > 0
        ? product.seller_amount
        : finalPrice;

    addToCart(buildCartItem({ sellerAsk, commissionType, flatCommission }));
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
      sellerName: product.profiles?.full_name || 'Beezio Seller',
      shippingCost,
      maxQuantity: stockQuantity ?? undefined,
      commission_rate: args.commissionType === 'flat_rate' ? args.flatCommission : commissionRate,
      commission_type: args.commissionType,
      flat_commission_amount: args.commissionType === 'flat_rate' ? args.flatCommission : 0,
    };
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (stockQuantity !== null && stockQuantity <= 0) {
      alert('Out of stock.');
      return;
    }

    if (hasVariants) {
      const url = affiliateRef ? `/product/${product.id}?ref=${affiliateRef}` : `/product/${product.id}`;
      navigate(url, { state: backState });
      return;
    }

    const commissionType = product.commission_type ?? 'percentage';
    const flatCommission = product.flat_commission_amount ?? 0;
    const sellerAsk = derivedAskPrice;

    clearCart();
    addToCart(buildCartItem({ sellerAsk, commissionType, flatCommission }));
    navigate('/checkout');
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Wishlist logic here
    console.log('Adding to wishlist:', product.id);
  };

  const productTo = affiliateRef
    ? { pathname: `/product/${product.id}`, search: `?ref=${affiliateRef}` }
    : { pathname: `/product/${product.id}` };

  const backState = useMemo(
    () => ({ from: `${location.pathname}${location.search}` }),
    [location.pathname, location.search],
  );

  const fallbackSeed = product.id || product.title;
  const primaryImage = product.images?.[0];
  const resolvedImage = useMemo(
    () => resolveProductImage(primaryImage, fallbackSeed),
    [primaryImage, fallbackSeed],
  );
  const fallbackImage = useMemo(
    () => resolveProductImage(undefined, fallbackSeed),
    [fallbackSeed],
  );
  const [currentImage, setCurrentImage] = useState(resolvedImage);

  useEffect(() => {
    setCurrentImage(resolvedImage);
  }, [resolvedImage]);

  const handleImageError = useCallback(() => {
    setCurrentImage(fallbackImage);
  }, [fallbackImage]);

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
              />
              {commissionRate > 15 && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                  {product.commission_rate}% off
                </div>
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                  {product.title}
                </h3>
                <button
                  onClick={handleWishlist}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Heart className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                {displayDescription}
              </p>
              
              <div className="flex items-center space-x-4 mb-3">
                <div className="flex items-center">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.average_rating || 0) ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500 ml-2">
                    ({product.review_count || 0})
                  </span>
                </div>
                
                <div className="flex items-center bg-green-50 px-2 py-1 rounded-full">
                  <Award className="w-3 h-3 text-green-600 mr-1" />
                  <span className="text-xs text-green-700 font-medium">
                    {commissionRate}% commission
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${finalPrice.toFixed(2)}
                  </div>
                  {showStoreCta && earningsAmount !== null && (
                    <div className="text-xs text-gray-500">You earn ${earningsAmount.toFixed(2)}</div>
                  )}
                  {(product.requires_shipping || shippingCost > 0) && (
                    <div className="text-xs text-gray-500">
                      {shippingCost > 0 ? `+ $${shippingCost.toFixed(2)} shipping` : '+ shipping'}
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    by {product.profiles?.full_name || 'Beezio Seller'}
                  </div>
                </div>
                
                <div className="flex flex-col items-stretch gap-2">
                  {/* Affiliate Earnings Display (only for affiliates/sellers/fundraisers) */}
                  {earningsAmount !== null && (
                    <div className="mb-1 text-xs text-green-700 font-semibold text-center">
                      Affiliate earns: ${earningsAmount.toFixed(2)} per sale
                    </div>
                  )}
                  {showPurchaseCtas && (
                    <>
                      <button
                        onClick={handleAddToCart}
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                      >
                        <ShoppingCart className="w-5 h-5 mr-2" />
                        {hasVariants ? 'Choose Options' : 'Add to Cart'}
                      </button>
                      <button
                        onClick={handleBuyNow}
                        className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center justify-center"
                      >
                        {hasVariants ? 'Choose Options' : 'Buy Now'}
                      </button>
                    </>
                  )}

                  {showStoreCta && (
                    <div className="pt-1">
                      {isSellerRole ? (
                        <AddToSellerStoreButton productId={product.id} size="sm" variant="button" />
                      ) : (
                        <AddToAffiliateStoreButton
                          productId={product.id}
                          sellerId={product.seller_id || ''}
                          productTitle={product.title}
                          productPrice={finalPrice}
                          defaultCommissionRate={commissionRate}
                          size="sm"
                          ctaText="Add to My Store"
                        />
                      )}
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
    <Link to={productTo} state={backState} className="block group">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 hover:border-purple-200 hover:-translate-y-1">
        <div className="relative">
          <img
            src={currentImage}
            alt={product.title}
            className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
            onError={handleImageError}
            loading="lazy"
          />
          
          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col space-y-2">
            {commissionRate > 15 && (
              <div className="bg-gradient-to-r from-orange-400 to-red-400 text-white text-xs px-3 py-1 rounded-full font-bold shadow-lg backdrop-blur-sm">
                Hot Deal
              </div>
            )}
            <div className="bg-green-500/90 backdrop-blur-sm text-white text-xs px-3 py-1 rounded-full font-medium">
              {commissionRate}% commission
            </div>
          </div>
          
          <button
            onClick={handleWishlist}
            className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-600 hover:text-red-500 hover:bg-white transition-all duration-200 shadow-lg"
          >
            <Heart className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5">
          <div className="mb-3">
            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 mb-2">
              {product.title}
            </h3>
            
            <div className="text-sm text-gray-500 mb-2">
              by {product.profiles?.full_name || 'Beezio Seller'}
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.average_rating || 0) ? 'fill-current' : ''}`} />
                ))}
              </div>
              <span className="text-sm text-gray-500">
                ({product.review_count || 0})
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <div className="text-2xl font-bold text-gray-900">${finalPrice.toFixed(2)}</div>
              {showStoreCta && earningsAmount !== null && (
                <div className="text-xs text-gray-500">You earn ${earningsAmount.toFixed(2)}</div>
              )}
            </div>
            {shippingCost > 0 && (
              <div className="text-sm text-gray-600 font-medium">
                + ${shippingCost.toFixed(2)} shipping
              </div>
            )}
          </div>

          
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              {showPurchaseCtas && (
                <>
                  <button
                    onClick={handleAddToCart}
                    className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {hasVariants ? 'Choose Options' : 'Add to Cart'}
                  </button>
                  <button
                    onClick={handleBuyNow}
                    className="flex-1 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-medium transition-colors"
                  >
                    {hasVariants ? 'Choose Options' : 'Buy Now'}
                  </button>
                </>
              )}
            </div>

            {showStoreCta && (
              <div className="pt-1">
                {isSellerRole ? (
                  <AddToSellerStoreButton productId={product.id} size="sm" variant="button" />
                ) : (
                  <AddToAffiliateStoreButton
                    productId={product.id}
                    sellerId={product.seller_id || ''}
                    productTitle={product.title}
                    productPrice={finalPrice}
                    defaultCommissionRate={commissionRate}
                    size="sm"
                    ctaText="Add to My Store"
                  />
                )}
              </div>
            )}

            <Link
              to={productTo}
              state={backState}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center border border-gray-200 hover:border-gray-300"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {hasVariants ? 'View Options' : 'View Details'}
            </Link>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
