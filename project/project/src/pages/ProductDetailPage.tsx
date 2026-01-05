import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingCart, Shield, Truck, RotateCcw, DollarSign, Star, Users, TrendingUp, Play, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useCart } from '../contexts/CartContext';
import AuthModal from '../components/AuthModal';
import BuyerRewards from '../components/BuyerRewards';
import RecommendationEngine from '../components/RecommendationEngine';
import ShippingSelector from '../components/ShippingSelector';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';
import { trackAffiliateClick } from '../utils/affiliateTracking';
import { calculateFinalPrice, computePayoutBreakdown, deriveAskPriceFromFinalPrice } from '../utils/pricingEngine';
import { DEFAULT_PAYOUT_SETTINGS, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import AddToAffiliateStoreButton from '../components/AddToAffiliateStoreButton';
import AddToSellerStoreButton from '../components/AddToSellerStoreButton';
import AffiliateShareWidget from '../components/AffiliateShareWidget';
import { sanitizeDescriptionForDisplay } from '../utils/sanitizeDescription';
import { getVariantOptions, resolveVariant, type ProductVariant } from '../services/productService';

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
  images: string[];
  videos: string[];
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  seller_id: string;
  is_active?: boolean;
  profiles?: {
    full_name: string;
    location?: string;
  };
  shipping_cost?: number;
  shipping_options?: Array<{ name: string; cost: number; estimated_days: string }>;
  requires_shipping?: boolean;
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
  average_rating?: number;
  review_count?: number;
  stock_quantity?: number;
}

const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, user, hasRole, currentRole } = useAuth();
  const { addToCart: addItemToCart, clearCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedShipping, setSelectedShipping] = useState<{ id: string; name: string; cost: number; estimated_days: string } | null>(null);
  const [listingUpdating, setListingUpdating] = useState(false);
  const [variantOptions, setVariantOptions] = useState<ProductVariant[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  };

  useEffect(() => {
    if (!productId) return;

    (async () => {
      try {
        const variants = await withTimeout(getVariantOptions(productId), 12000, 'getVariantOptions');
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

  const handleAttributeChange = (key: string, value: string) => {
    setSelectedAttributes((prev) => ({ ...prev, [key]: value }));
  };

  const handleVariantSelect = (variantId: string) => {
    setSelectedVariantId(variantId);
    const picked = variantOptions.find((variant) => String(variant.id) === String(variantId));
    setSelectedAttributes(((picked?.attributes ?? {}) as Record<string, string>) || {});
  };

  const formatVariantLabel = (variant: ProductVariant): string => {
    const attrs = variant.attributes as Record<string, string> | null;
    if (attrs && Object.keys(attrs).length) {
      return Object.entries(attrs)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' • ');
    }
    return variant.sku || variant.cj_variant_id || variant.id;
  };
  
  // Behavior tracking
  const { trackView, trackClick, trackCartAdd } = useBehaviorTracker();

  // IMPORTANT: Use the *active* role (currentRole) for CTA selection.
  // Otherwise multi-role users can get stuck seeing seller CTAs while switched to buyer/affiliate.
  const derivedRole = String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase();
  const isSellerRole = derivedRole === 'seller';
  const isAffiliateRole = derivedRole === 'affiliate';
  const isFundraiserRole = derivedRole === 'fundraiser';
  const isSellingRole = isSellerRole || isAffiliateRole || isFundraiserRole;
  const showBuyerCtas = !isSellingRole;

  const isAdminRole = useMemo(() => {
    const email = String(user?.email || '').toLowerCase();
    const emailWhitelisted = email === 'jason@beezio.co' || email === 'jasonlovingsr@gmail.com';
    // Admin can be any granted role, even if currentRole is something else.
    return emailWhitelisted || hasRole('admin') || derivedRole === 'admin';
  }, [derivedRole, hasRole, user?.email]);

  const sellerProfileId = (profile as any)?.id as string | undefined;

  const canManageListing = useMemo(() => {
    if (!user || !product) return false;
    if (isAdminRole) return true;
    // In this project, products.seller_id typically references profiles.id.
    if (sellerProfileId && product.seller_id === sellerProfileId) return true;
    // Legacy fallback (some rows may have used auth user id).
    if (user.id && product.seller_id === user.id) return true;
    return false;
  }, [isAdminRole, product, sellerProfileId, user]);

  const isListed = useMemo(() => {
    if (!product) return true;
    return product.is_active !== false;
  }, [product]);

  const payoutSettings = useMemo(() => ({
    affiliatePercent: product?.commission_rate ?? product?.affiliate_commission_rate ?? DEFAULT_PAYOUT_SETTINGS.affiliatePercent,
    platformPercent: PLATFORM_FEE_PERCENT,
    fundraiserPercent: DEFAULT_PAYOUT_SETTINGS.fundraiserPercent,
  }), [product]);

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
      // Prefer seller_ask when available; otherwise assume `price` is already customer-facing.
      if (typeof product.seller_ask === 'number' && product.seller_ask > 0) return calculateFinalPrice(product.seller_ask, payoutSettings);
      if (typeof product.seller_amount === 'number' && product.seller_amount > 0) return calculateFinalPrice(product.seller_amount, payoutSettings);
      if (typeof product.seller_ask_price === 'number' && product.seller_ask_price > 0) return calculateFinalPrice(product.seller_ask_price, payoutSettings);
      if (typeof product.calculated_customer_price === 'number' && product.calculated_customer_price > 0) {
        return product.calculated_customer_price;
      }
      return product.price;
    } catch (e) {
      console.warn('BEEZIO_PRICING_ENGINE display fallback', e);
      return (typeof product.calculated_customer_price === 'number' && product.calculated_customer_price > 0)
        ? product.calculated_customer_price
        : product.price;
    }
  }, [product, payoutSettings]);

  const payoutBreakdown = useMemo(() => {
    return computePayoutBreakdown(finalDisplayPrice, derivedSellerAsk, payoutSettings);
  }, [derivedSellerAsk, finalDisplayPrice, payoutSettings]);

  // Always show affiliate earnings for display
  const affiliateEarnings = payoutBreakdown.affiliateAmount;

  const displayDescription = useMemo(() => {
    return sanitizeDescriptionForDisplay(product?.description, product?.lineage);
  }, [product?.description, product?.lineage]);

  const backTarget = useMemo(() => {
    const from = (location.state as any)?.from;
    if (typeof from === 'string' && from.trim().length > 0) return from;
    try {
      const last = sessionStorage.getItem('beezio:lastMarketplaceUrl');
      if (last && last.trim().length > 0) return last;
    } catch {
      // ignore
    }
    return '/marketplace';
  }, [location.state]);

  // Track affiliate referral on page load
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const linkCode = searchParams.get('code') || null;
    
    if (linkCode) {
      trackAffiliateClick(linkCode);
    }
  }, [location.search]);

  // Function to get embed URL from video URL
  const getVideoEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    
    // TikTok
    const tiktokMatch = url.match(/tiktok\.com\/@[\w.-]+\/video\/(\d+)/);
    if (tiktokMatch) {
      return `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`;
    }
    
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    
    // Instagram
    const instagramMatch = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
    if (instagramMatch) {
      return `https://www.instagram.com/p/${instagramMatch[1]}/embed/`;
    }
    
    return null;
  };

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

  const fetchProduct = async () => {
    try {
      setLoading(true);
      setError(null);
      
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
        12000,
        'fetchProduct'
      );

      if (fetchError || !data) throw fetchError || new Error('Product not found');

      setProduct(data as any);
    } catch (error) {
      console.error('Error fetching product:', error);
      setProduct(null);
      setError(error instanceof Error ? error.message : 'Unable to load product.');
    } finally {
      setLoading(false);
    }
  };

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
    
    const computedMaxQuantity = (() => {
      const variantStock = selectedVariant?.inventory;
      if (Number.isFinite(variantStock)) return Math.max(0, Math.floor(variantStock as number));
      const productStock = (product as any)?.stock_quantity;
      if (Number.isFinite(productStock)) return Math.max(0, Math.floor(productStock));
      return 99;
    })();

    if (computedMaxQuantity <= 0) {
      if (!options?.silent) {
        const variantText = selectedVariant ? ` (${formatVariantLabel(selectedVariant)})` : '';
        alert(`Out of stock${variantText}.`);
      }
      return false;
    }

    // Add product to cart with selected shipping cost
    addItemToCart({
      productId: product.id,
      title: product.title,
      price: finalDisplayPrice,
      sellerAsk: derivedSellerAsk,
      commission_rate: product.commission_rate,
      commission_type: product.commission_type,
      flat_commission_amount: product.flat_commission_amount,
      quantity: quantity,
      image: selectedVariant?.image_url || product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
      sellerId: product.seller_id,
      sellerName: product.profiles?.full_name || 'Unknown Seller',
      shippingCost: Number(selectedShipping?.cost ?? product.shipping_cost ?? 0) || 0,
      maxQuantity: computedMaxQuantity,
      variantId: selectedVariant?.id ?? undefined,
      variantName: selectedVariant ? formatVariantLabel(selectedVariant) : undefined
    });
    
    // Show success message or redirect to cart
    if (!options?.silent) {
      const variantText = selectedVariant ? ` (${formatVariantLabel(selectedVariant)})` : '';
      alert(`Product${variantText} added to cart! ${selectedShipping ? `Shipping: ${selectedShipping.name} (+$${selectedShipping.cost.toFixed(2)})` : ''}`);
    }

    return true;
  };

  const handleBuyNow = async () => {
    clearCart();
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
      let upd = supabase.from('products').update({ is_active: nextIsActive }).eq('id', product.id);
      if (!isAdminRole) {
        upd = upd.eq('seller_id', sellerProfileId || user?.id || '');
      }
      const { error } = await upd;
      if (error) throw error;

      setProduct({ ...(product as any), is_active: nextIsActive });
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
          <Link to="/marketplace" className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-white transition-colors">
            Browse All Products
          </Link>
        </div>
      </div>
    );
  }

  if (product.is_active === false && !canManageListing) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h1>
        <p className="text-gray-600 mb-4">This product is currently unlisted.</p>
        <Link to="/marketplace" className="text-amber-600 hover:text-amber-700 font-medium">
          Browse All Products
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-gray-700">Home</Link>
        <span>/</span>
        <Link to="/marketplace" className="hover:text-gray-700">Products</Link>
        <span>/</span>
        <span className="text-gray-900">{product.title}</span>
      </div>

      {/* Back Button */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => {
            // Always go back into Beezio's marketplace context (never leave the app).
            navigate(backTarget || '/marketplace');
          }}
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </button>

        {canManageListing && (
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
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Media (Images & Videos) */}
        <div className="space-y-3">
          {/* Media Tabs */}
          {(product.images.length > 0 || product.videos.length > 0) && (
            <div className="flex space-x-1 mb-2">
              {product.images.length > 0 && (
                <button
                  onClick={() => setSelectedImageIndex(0)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                    selectedImageIndex < product.images.length 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Photos ({product.images.length})
                </button>
              )}
              {product.videos.length > 0 && (
                <button
                  onClick={() => setSelectedImageIndex(product.images.length)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                    selectedImageIndex >= product.images.length 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Videos ({product.videos.length})
                </button>
              )}
            </div>
          )}

          {/* Main Media Display */}
          <div className="w-full h-72 lg:h-80 rounded-lg overflow-hidden bg-gray-100">
            {selectedImageIndex < product.images.length ? (
              // Display Image
              <img
                src={product.images[selectedImageIndex] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800'}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              // Display Video
              (() => {
                const videoIndex = selectedImageIndex - product.images.length;
                const videoUrl = product.videos[videoIndex];
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
                } else {
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
                }
              })()
            )}
          </div>
          
          {/* Thumbnail Navigation */}
          <div className="flex space-x-2 overflow-x-auto">
            {/* Image Thumbnails */}
            {product.images.map((image, index) => (
              <button
                key={`image-${index}`}
                onClick={() => setSelectedImageIndex(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                  selectedImageIndex === index ? 'border-amber-500' : 'border-gray-200'
                }`}
              >
                <img src={image} alt={`${product.title} ${index + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
            
            {/* Video Thumbnails */}
            {product.videos.map((_, index) => (
              <button
                key={`video-${index}`}
                onClick={() => setSelectedImageIndex(product.images.length + index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 bg-gray-100 flex items-center justify-center ${
                  selectedImageIndex === product.images.length + index ? 'border-amber-500' : 'border-gray-200'
                }`}
              >
                <Play className="w-6 h-6 text-gray-600" />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-4">
          {/* Title and Rating */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.title}</h1>
            
            {product.average_rating && (
              <div className="flex items-center space-x-2 mb-3">
                <div className="flex items-center">
                  <span className="text-yellow-400">★★★★★</span>
                </div>
                <span className="text-sm text-gray-600">
                  {product.average_rating.toFixed(1)} ({product.review_count || 0} reviews)
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <span className="text-3xl font-bold text-gray-900">
                {showBuyerCtas ? `$${finalDisplayPrice.toFixed(2)}` : `$${(earningsAmount ?? 0).toFixed(2)}`}
              </span>
              {showBuyerCtas && product.requires_shipping && (
                <span className="text-sm text-gray-600">
                  {typeof product.shipping_cost === 'number' && product.shipping_cost > 0
                    ? `+ $${product.shipping_cost.toFixed(2)} shipping`
                    : '+ shipping'}
                </span>
              )}
            </div>

            {!showBuyerCtas && (
              <div className="text-xs text-gray-500">You would make</div>
            )}
          </div>

          {/* Description */}
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed">
              {displayDescription}
            </p>
          </div>

          {/* Social Proof & Reviews */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">What Buyers Say</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="flex text-yellow-400">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  <span className="text-sm text-gray-600 ml-2">Sarah M.</span>
                </div>
                <p className="text-sm text-gray-700">"Amazing quality and fast shipping! Will definitely buy again."</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="flex text-yellow-400">
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                  <span className="text-sm text-gray-600 ml-2">Mike R.</span>
                </div>
                <p className="text-sm text-gray-700">"Exactly as described. Great seller and love supporting local businesses!"</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                127 happy customers
              </span>
              <Link to="#reviews" className="text-blue-600 hover:text-blue-700">
                View all reviews →
              </Link>
            </div>
          </div>

          {/* Seller Info */}
          <div className="border-t border-b py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Sold by {product.profiles?.full_name || 'Unknown Seller'}
                </h3>
                {product.profiles?.location && (
                  <p className="text-gray-600">{product.profiles.location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Share Tools */}
          <div className="mt-4">
            <AffiliateShareWidget
              type="product"
              targetId={product.id}
              targetPath={`/product/${product.id}`}
              sellerId={product.seller_id}
              title={product.title}
            />
          </div>

          {/* Add to Cart Section */}
          <div className="space-y-4">
            {/* Buyer Benefits & Trust Signals */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <Shield className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-gray-900">Secure Payment</div>
                <div className="text-xs text-gray-600">SSL Protected</div>
              </div>
              <div className="text-center">
                <Truck className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-gray-900">Fast Shipping</div>
                <div className="text-xs text-gray-600">2-3 Day Delivery</div>
              </div>
              <div className="text-center">
                <RotateCcw className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <div className="text-sm font-medium text-gray-900">Easy Returns</div>
                <div className="text-xs text-gray-600">30-Day Policy</div>
              </div>
            </div>

            {/* Smart Shopping Bonus */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-4">
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

            {/* Buyer Rewards */}
            {showBuyerCtas && (
              <BuyerRewards
                productPrice={product.price}
                commissionRate={product.commission_rate}
              />
            )}

            {/* Creator Support Badge */}
            {product.commission_rate > 0 && (
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
                {/* Affiliate Earnings Display */}
                <div className="mb-2 text-xs text-green-700 font-semibold text-center">
                  Affiliate earns: ${affiliateEarnings?.toFixed(2)} per sale
                </div>
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

                <div className="flex items-center space-x-4">
                  <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                    Quantity:
                  </label>
                  <select
                    id="quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value))}
                    className="border border-gray-300 rounded-md px-3 py-1"
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>

                {/* Shipping Options */}
                {product && productId && (
                  <div className="border-t border-gray-200 pt-4">
                    <ShippingSelector
                      productId={productId}
                      selectedShipping={selectedShipping}
                      onShippingChange={setSelectedShipping}
                    />
                  </div>
                )}

                {/* Order Summary */}
                {selectedShipping && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Order Summary</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Product Price (×{quantity}):</span>
                        <span>${(finalDisplayPrice * quantity).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{selectedShipping.name}:</span>
                        <span>{selectedShipping.cost === 0 ? 'FREE' : `$${selectedShipping.cost.toFixed(2)}`}</span>
                      </div>
                      <div className="border-t border-gray-300 pt-1 mt-2">
                        <div className="flex justify-between font-semibold text-lg">
                          <span>Total:</span>
                          <span>${(finalDisplayPrice * quantity + selectedShipping.cost).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-3">
              {/* Main Action Buttons */}
              {showBuyerCtas ? (
                <div className="space-y-3">
                  <button
                    onClick={() => addToCart()}
                    className="w-full bg-amber-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>Add to Cart</span>
                  </button>

                  <button
                    onClick={handleBuyNow}
                    className="w-full bg-gray-900 text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    Buy Now
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {isSellerRole ? (
                    <AddToSellerStoreButton productId={product.id} size="lg" variant="button" />
                  ) : (
                    <AddToAffiliateStoreButton
                      productId={product.id}
                      sellerId={product.seller_id || ''}
                      productTitle={product.title}
                      productPrice={finalDisplayPrice}
                      defaultCommissionRate={product.commission_rate}
                      size="lg"
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

          {/* Trust Badges */}
          <div className="border-t pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center space-y-2">
                <Shield className="w-8 h-8 text-green-600" />
                <span className="text-sm text-gray-600">Secure Payment</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Truck className="w-8 h-8 text-blue-600" />
                <span className="text-sm text-gray-600">Fast Shipping</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <RotateCcw className="w-8 h-8 text-amber-600" />
                <span className="text-sm text-gray-600">Easy Returns</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products / AI Recommendations - Only show if products exist */}
      {product && (
        <div className="mt-16">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-900">You might also like</h2>
          </div>
          <RecommendationEngine
            type="product_detail"
            contextProductId={product.id}
            title=""
            className=""
          />
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
      />
    </div>
  );
};

export default ProductDetailPage;
