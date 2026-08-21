import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Award, ExternalLink, Heart, ShoppingCart, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useCart } from '../contexts/CartContext';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { getFallbackProductImage, normalizeProductImages } from '../utils/imageHelpers';
import { resolveAffiliateCommission, getAffiliateAmount } from '../utils/pricing';
import AddToAffiliateStoreButton from './AddToAffiliateStoreButton';
import AddToSellerStoreButton from './AddToSellerStoreButton';

export interface CanonicalProductCardProduct {
  id: string;
  title: string;
  price: number;
  images?: string[];
  image?: string;
  description?: string;
  seller_ask?: number;
  seller_amount?: number;
  seller_id?: string;
  shipping_cost?: number;
  requires_shipping?: boolean;
  stock_quantity?: number;
  total_inventory?: number;
  in_stock?: boolean;
  track_inventory?: boolean;
  is_active?: boolean;
  is_promotable?: boolean;
  status?: string;
  is_digital?: boolean;
  has_variants?: boolean;
  variants?: unknown;
  product_variants?: unknown[] | null;
  category?: string;
  commission_rate?: number;
  affiliate_commission_rate?: number;
  commission_type?: 'percentage' | 'flat_rate';
  flat_commission_amount?: number;
  affiliate_commission_type?: 'percent' | 'flat';
  affiliate_commission_value?: number;
  affiliate_payout_amount?: number;
  profiles?: { full_name?: string } | null;
  average_rating?: number;
  review_count?: number;
}

interface Props {
  product: CanonicalProductCardProduct;
  viewMode: 'grid' | 'list';
  affiliateRef?: string | null;
  affiliateUid?: string | null;
  compact?: boolean;
  ctaMode?: 'marketplace' | 'storefront';
  forcePurchaseCtas?: boolean;
}

const stop = (event: React.SyntheticEvent) => {
  event.preventDefault();
  event.stopPropagation();
};

const CanonicalProductCard: React.FC<Props> = ({
  product,
  viewMode,
  affiliateRef,
  affiliateUid,
  compact = false,
  ctaMode = 'marketplace',
  forcePurchaseCtas = false,
}) => {
  const { addToCart } = useCart();
  const { user, profile, currentRole, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);

  const productUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (affiliateRef) params.set('ref', affiliateRef);
    if (affiliateUid) params.set('uid', affiliateUid);
    const query = params.toString();
    const path = location.pathname;
    let route = `/product/${product.id}`;

    if (ctaMode === 'storefront') {
      const namedStore = path.match(/^\/(store|seller|partner)\/([^/]+)/);
      if (namedStore) {
        route = `/${namedStore[1]}/${namedStore[2]}/product/${product.id}`;
      } else {
        const genericStore = path.match(/^\/([^/]+)(?:\/[^/]+)?$/);
        const reserved = new Set(['marketplace', 'products', 'product', 'dashboard', 'account', 'admin', 'affiliate', 'partner', 'seller', 'store', 'cart', 'checkout', 'search', 'signup', 'login', 'auth']);
        if (genericStore && !reserved.has(genericStore[1])) {
          route = `/${genericStore[1]}/product/${product.id}`;
        }
      }
    }

    return `${route}${query ? `?${query}` : ''}`;
  }, [affiliateRef, affiliateUid, ctaMode, location.pathname, product.id]);

  const images = useMemo(() => {
    const source = product.images?.length ? product.images : product.image ? [product.image] : [];
    return normalizeProductImages(source);
  }, [product.images, product.image]);
  const image = imageFailed ? getFallbackProductImage(product.id) : (images[0] || getFallbackProductImage(product.id));

  const buyerPrice = useMemo(() => getBuyerFacingProductPrice(product as any), [product]);
  const commission = useMemo(() => resolveAffiliateCommission(product as any), [product]);
  const affiliateAmount = useMemo(() => {
    const ask = Number(product.seller_ask ?? product.seller_amount ?? buyerPrice);
    return getAffiliateAmount(ask, commission.type, commission.value);
  }, [buyerPrice, commission.type, commission.value, product.seller_amount, product.seller_ask]);

  const role = String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase();
  const canAffiliate = Boolean(user?.id) && (role === 'affiliate' || role === 'partner' || hasRole('affiliate') || hasRole('partner'));
  const canSeller = Boolean(user?.id) && (role === 'seller' || hasRole('seller'));
  const showStoreTools = ctaMode !== 'storefront' && (canAffiliate || canSeller);
  const purchaseVisible = forcePurchaseCtas || ctaMode === 'storefront' || product.is_active === true || product.is_promotable === true || String(product.status || '').toLowerCase() === 'active';
  const hasVariants = Boolean(product.has_variants) || (Array.isArray(product.product_variants) && product.product_variants.length > 0) || (Array.isArray(product.variants) && product.variants.length > 0);
  const stock = Number.isFinite(product.stock_quantity) ? Number(product.stock_quantity) : Number.isFinite(product.total_inventory) ? Number(product.total_inventory) : null;
  const outOfStock = product.track_inventory !== false && ((stock !== null && stock <= 0) || (stock === null && product.in_stock === false));
  const sellerAsk = Number(product.seller_ask ?? product.seller_amount ?? buyerPrice);
  const affiliateId = String(affiliateRef || affiliateUid || '').trim() || undefined;

  const cartItem = () => ({
    productId: product.id,
    title: product.title,
    price: buyerPrice,
    sellerAsk,
    quantity: 1,
    image,
    sellerId: product.seller_id || 'unknown-seller',
    sellerName: product.profiles?.full_name || 'Seller',
    shippingCost: 0,
    maxQuantity: stock === null ? undefined : Math.max(0, stock),
    commission_rate: commission.value,
    commission_type: commission.type === 'flat' ? 'flat_rate' : 'percentage',
    flat_commission_amount: commission.type === 'flat' ? commission.value : 0,
    affiliateId,
    isDigital: product.is_digital === true,
  });

  const handleAddToCart = (event: React.MouseEvent) => {
    stop(event);
    if (outOfStock) return;
    if (hasVariants) {
      navigate(productUrl, { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    addToCart(cartItem() as any);
    navigate('/cart');
  };

  const handleBuyNow = (event: React.MouseEvent) => {
    stop(event);
    if (outOfStock) return;
    if (hasVariants) {
      navigate(productUrl, { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    addToCart(cartItem() as any);
    navigate('/checkout');
  };

  const commonImageProps = {
    src: image,
    alt: product.title,
    onError: () => setImageFailed(true),
    loading: 'lazy' as const,
    decoding: 'async' as const,
  };

  const ProductLink = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <Link to={productUrl} state={{ from: `${location.pathname}${location.search}` }} className={`block ${className}`} aria-label={`View ${product.title}`}>
      {children}
    </Link>
  );

  const purchaseButtons = purchaseVisible ? (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={handleAddToCart} disabled={outOfStock} className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 disabled:opacity-50 text-white rounded-xl py-3 font-medium flex items-center justify-center">
        <ShoppingCart className="w-5 h-5 mr-2" />
        {outOfStock ? 'Out of Stock' : hasVariants ? 'Choose Options' : 'Add to Cart'}
      </button>
      <button type="button" onClick={handleBuyNow} disabled={outOfStock} className="w-full bg-gray-900 disabled:opacity-50 text-white rounded-xl py-3 font-medium">
        {hasVariants ? 'Choose Options' : 'Buy Now'}
      </button>
    </div>
  ) : null;

  const storeButtons = showStoreTools ? (
    <div className="space-y-2" onClick={stop} onMouseDown={stop} onPointerDown={stop}>
      {canAffiliate ? (
        <AddToAffiliateStoreButton
          productId={product.id}
          sellerId={product.seller_id || ''}
          productTitle={product.title}
          productPrice={buyerPrice}
          defaultCommissionRate={commission.type === 'percent' ? commission.value : 0}
          commissionType={commission.type === 'flat' ? 'flat_rate' : 'percentage'}
          flatCommissionAmount={commission.type === 'flat' ? commission.value : 0}
          productImage={image}
          productCategory={product.category || ''}
          productDescription={product.description || ''}
          size="sm"
          ctaText="Add to Store"
          addedText="In your affiliate store"
          showRemove={false}
          instantAdd
        />
      ) : null}
      {canSeller ? <AddToSellerStoreButton productId={product.id} size="sm" variant="button" addedText="In your seller store" showRemove={false} /> : null}
    </div>
  ) : null;

  const content = viewMode === 'list' ? (
    <div className="flex gap-5 p-5">
      <ProductLink className="w-32 shrink-0">
        <img {...commonImageProps} className="w-32 h-32 object-cover rounded-xl" />
      </ProductLink>
      <div className="min-w-0 flex-1">
        <ProductLink>
          <h3 className="text-lg font-semibold text-gray-900 hover:text-purple-600 line-clamp-2">{product.title}</h3>
          <p className="text-sm text-gray-500 mt-1">by {product.profiles?.full_name || 'Seller'}</p>
          <p className="text-2xl font-bold text-gray-900 mt-3">${buyerPrice.toFixed(2)}</p>
        </ProductLink>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">{purchaseButtons}{storeButtons}</div>
      </div>
    </div>
  ) : (
    <div>
      <ProductLink>
        <div className="relative">
          <img {...commonImageProps} className={`${compact ? 'h-28' : 'h-56'} w-full object-cover`} />
        </div>
        <div className={compact ? 'p-3' : 'p-5'}>
          <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-gray-900 hover:text-purple-600 line-clamp-2`}>{product.title}</h3>
          <p className="text-sm text-gray-500 mt-1">by {product.profiles?.full_name || 'Seller'}</p>
          {Number(product.average_rating) > 0 && (
            <div className="flex items-center gap-1 mt-2 text-yellow-400">
              <Star className="w-4 h-4 fill-current" /><span className="text-sm text-gray-500">{Number(product.average_rating).toFixed(1)} ({product.review_count || 0})</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="text-2xl font-bold text-gray-900">${buyerPrice.toFixed(2)}</span>
            {canAffiliate && commission.value > 0 && <span className="text-xs text-green-700"><Award className="inline w-3 h-3" /> ${affiliateAmount.toFixed(2)}</span>}
          </div>
          <div className="text-xs text-gray-500 mt-1">Free shipping • tax at checkout</div>
        </div>
      </ProductLink>
      <div className={compact ? 'p-3 pt-0' : 'p-5 pt-0'}>
        {purchaseButtons}
        {storeButtons}
        <Link to={productUrl} state={{ from: `${location.pathname}${location.search}` }} className="mt-2 w-full bg-gray-50 border border-gray-200 text-gray-700 rounded-xl py-3 font-medium flex items-center justify-center">
          <ExternalLink className="w-4 h-4 mr-2" /> View Product
        </Link>
        <button type="button" onClick={(e) => stop(e)} className="mt-2 text-sm text-gray-500 hover:text-red-500 flex items-center gap-1"><Heart className="w-4 h-4" /> Save</button>
      </div>
    </div>
  );

  return <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300">{content}</div>;
};

export default CanonicalProductCard;
