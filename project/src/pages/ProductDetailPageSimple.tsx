import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Star, ShoppingCart } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAffiliate } from '../contexts/AffiliateContext';
import { SocialShareButton } from '../components/SocialShareButton';
import { SampleProduct, products as sampleProducts } from '../data/sampleProducts';
import { isProductSampleDataEnabled } from '../config/sampleDataConfig';
import { fetchProductById } from '../services/productService';
import { calculateSalePriceFromSellerAsk, DEFAULT_AFFILIATE_RATE, normalizeAffiliateRate } from '../utils/pricing';

const ProductDetailPageSimple: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { trackClick } = useAffiliate();
  const [product, setProduct] = useState<SampleProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const sampleDataEnabled = isProductSampleDataEnabled();

  const sellerAsk = useMemo(
    () => (product ? (product as any).seller_ask ?? (product as any).seller_amount ?? 0 : 0),
    [product]
  );

  const affiliateRateDecimal = useMemo(() => {
    if (product?.commission_type === 'flat_rate') return 0;
    return normalizeAffiliateRate(product?.commission_rate ?? DEFAULT_AFFILIATE_RATE);
  }, [product?.commission_rate, product?.commission_type]);

  const salePrice = useMemo(() => {
    const direct = (product as any)?.price;
    if (typeof direct === 'number' && !Number.isNaN(direct)) {
      return direct;
    }
    if (!sellerAsk) return 0;
    return calculateSalePriceFromSellerAsk(
      sellerAsk,
      affiliateRateDecimal,
      product?.commission_type === 'flat_rate' ? 'flat' : 'percent'
    );
  }, [product, sellerAsk, affiliateRateDecimal]);

  const shippingPrice = useMemo(
    () => (product as any)?.shipping_price ?? product?.shipping_cost ?? 0,
    [product]
  );

  const imageGallery = useMemo(() => {
    const images: string[] = [];
    const productImages = (product as any)?.images;

    if (Array.isArray(productImages)) {
      images.push(...productImages.filter(Boolean));
    }

    if ((product as any)?.image && !images.includes((product as any).image)) {
      images.unshift((product as any).image);
    }

    if (images.length === 0) {
      images.push('/api/placeholder/600/600');
    }

    return images.slice(0, 6);
  }, [product]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: (product as any)?.currency || 'USD',
      }),
    [product]
  );
  const formatMoney = (value: number) => currencyFormatter.format(value);

  // Handle affiliate tracking
  useEffect(() => {
    const affiliateId = searchParams.get('ref');
    if (affiliateId && productId) {
      localStorage.setItem('affiliate_ref', affiliateId);
      trackClick(productId, affiliateId);
    }
  }, [searchParams, productId, trackClick]);

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      setError(null);

      if (!productId) {
        setProduct(null);
        setLoading(false);
        return;
      }

      if (sampleDataEnabled) {
        const foundProduct = sampleProducts.find(p => p.id === productId) || null;
        setProduct(foundProduct);
        setLoading(false);
        return;
      }

      try {
        const realProduct = await fetchProductById(productId);
        if (realProduct) {
          setProduct(realProduct);
        } else {
          setProduct(null);
          setError('We couldn’t find that product. Double-check the link or add it to your catalog.');
        }
      } catch (err) {
        console.error('ProductDetailPageSimple: failed to load Supabase product', err);
        setProduct(null);
        setError('Unable to load product details from Supabase.');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId, sampleDataEnabled]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [productId]);

  const handleAddToCart = () => {
    if (product) {
      addToCart({
        productId: product.id,
        title: product.name,
        price: salePrice,
        sellerAsk,
        currency: (product as any)?.currency || 'USD',
        affiliateRate: affiliateRateDecimal,
        quantity: quantity,
        image: product.image,
        sellerId: product.sellerId || product.seller || 'unknown-seller',
        sellerName: product.seller,
        commission_rate: product.commission_rate || 25,
        commission_type: product.commission_type,
        flat_commission_amount: product.flat_commission_amount,
        shippingCost: shippingPrice,
        maxQuantity: product.stock_quantity
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-600 mb-6">{error || "The product you're looking for doesn't exist."}</p>
          <Link
            to="/marketplace"
            className="inline-flex items-center bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const displayImage =
    imageGallery[activeImageIndex] ||
    '/api/placeholder/600/600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-orange-50 to-yellow-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link
            to="/marketplace"
            className="inline-flex items-center text-gray-600 hover:text-orange-600 font-medium transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Marketplace
          </Link>
        </div>

        <div className="grid lg:grid-cols-12 gap-10 items-start">
          {/* Left: image + meta */}
          <div className="lg:col-span-6 space-y-6">
            <div className="relative bg-gradient-to-br from-yellow-100 via-orange-100 to-purple-100 rounded-3xl aspect-square flex items-center justify-center shadow-lg overflow-hidden">
              <img
                src={displayImage}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/api/placeholder/600/600';
                }}
              />
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-orange-200 rounded-full blur-2xl opacity-40 pointer-events-none" />
            </div>

            {imageGallery.length > 1 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {imageGallery.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${idx === activeImageIndex ? 'border-orange-500 ring-2 ring-orange-100' : 'border-transparent hover:border-orange-200'}`}
                    aria-label={`View image ${idx + 1}`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} ${idx + 1}`}
                      className="w-full h-20 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = '/api/placeholder/200/200';
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
                {product.name}
              </h1>
              <p className="text-gray-700 text-lg leading-relaxed">
                {product.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-semibold text-gray-800">{product.rating}</span>
                  <span className="text-gray-500">({product.reviews} reviews)</span>
                </span>
                <span className="text-gray-400">•</span>
                <span>Sold by <span className="font-semibold text-gray-900">{product.seller}</span></span>
                <span className="text-gray-400">•</span>
                <span>Category: <span className="font-semibold text-gray-900">{product.category}</span></span>
              </div>
            </div>
          </div>

          {/* Right: pricing + actions */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 md:p-8 space-y-6 sticky top-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-extrabold text-gray-900">{formatMoney(salePrice)}</span>
                    {product.is_subscription && product.subscription_interval && (
                      <span className="text-lg text-gray-500">/ {product.subscription_interval}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Taxes and shipping are calculated at checkout. No extra payout or commission details are shown to buyers.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Quantity</span>
                <div className="flex items-center border rounded-lg overflow-hidden shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 text-gray-700 hover:bg-gray-100"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 text-gray-900 font-semibold min-w-[40px] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 text-gray-700 hover:bg-gray-100"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full inline-flex items-center justify-center bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-semibold shadow-lg"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Add to Cart
              </button>

              {/* Social Share Section */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Share this product:</p>
                <SocialShareButton
                  product={{
                    id: product.id,
                    title: product.name,
                    description: product.description,
                    price: salePrice,
                    images: imageGallery,
                    seller_id: product.sellerId || product.seller,
                    profiles: { full_name: product.seller }
                  }}
                  affiliateCode={searchParams.get('ref') || undefined}
                  variant="button"
                  size="md"
                />
              </div>

              <div className="text-sm text-gray-500 space-y-1">
                <p>
                  Shipping: {shippingPrice ? formatMoney(shippingPrice) : '$0.00 (seller-defined)'}
                </p>
                <p>Shipping & tax added at checkout. Free returns within 30 days.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPageSimple;
