import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sparkles, 
  TrendingUp, 
  Eye, 
  ShoppingCart, 
  Star,
  ChevronLeft,
  ChevronRight,
  Zap,
  Users,
  Heart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import ProductGallery from './ProductGallery';
import StarRating from './StarRating';

interface RecommendedProduct {
  id: string;
  title: string;
  price: number;
  images: string[];
  average_rating: number;
  review_count: number;
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  recommendation_score: number;
  recommendation_reason: string;
}

interface RecommendationEngineProps {
  type: 'homepage' | 'product_detail' | 'cart' | 'search';
  contextProductId?: string;
  title?: string;
  className?: string;
  maxItems?: number;
  showReasons?: boolean;
  variant?: 'horizontal' | 'grid';
}

const RecommendationEngine: React.FC<RecommendationEngineProps> = ({
  type,
  contextProductId,
  title,
  className = '',
  maxItems = 8,
  showReasons = true,
  variant = 'horizontal'
}) => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [productImages, setProductImages] = useState<{ [key: string]: any[] }>({});

  useEffect(() => {
    loadRecommendations();
  }, [type, contextProductId, user]);

  useEffect(() => {
    if (recommendations.length > 0) {
      loadProductImages();
    }
  }, [recommendations]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      // Track the recommendation request
      await trackBehavior('recommendation_request', contextProductId);

      // Get personalized recommendations
      const { data, error: recError } = await supabase
        .rpc('get_personalized_recommendations', {
          target_user_id: user?.id || null,
          target_session_id: getSessionId(),
          recommendation_type: type,
          context_product_id: contextProductId || null,
          limit_count: maxItems
        });

      if (recError) throw recError;

      if (data && data.length > 0) {
        // Get full product details
        const productIds = data.map((r: any) => r.product_id);
        const { data: products, error: prodError } = await supabase
          .from('products')
          .select(`
            id,
            title,
            price,
            images,
            average_rating,
            review_count,
            commission_rate,
            commission_type,
            flat_commission_amount
          `)
          .in('id', productIds)
          .eq('is_active', true);

        if (prodError) throw prodError;

        // Combine recommendation data with product details
        const enrichedRecommendations = products?.map(product => {
          const recData = data.find((r: any) => r.product_id === product.id);
          return {
            ...product,
            recommendation_score: recData?.recommendation_score || 0,
            recommendation_reason: recData?.recommendation_reason || 'recommended'
          };
        }) || [];

        setRecommendations(enrichedRecommendations);
      } else {
        // Fallback to popular products
        await loadFallbackRecommendations();
      }
    } catch (error) {
      console.error('Failed to load recommendations:', error);
      setError('Failed to load recommendations');
      await loadFallbackRecommendations();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackRecommendations = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          title,
          price,
          images,
          average_rating,
          review_count,
          commission_rate,
          commission_type,
          flat_commission_amount
        `)
        .eq('is_active', true)
        .order('average_rating', { ascending: false })
        .limit(maxItems);

      if (error) throw error;

      const fallbackRecommendations = data?.map(product => ({
        ...product,
        recommendation_score: product.average_rating || 0,
        recommendation_reason: 'popular'
      })) || [];

      setRecommendations(fallbackRecommendations);
    } catch (error) {
      console.error('Failed to load fallback recommendations:', error);
    }
  };

  const loadProductImages = async () => {
    const imagePromises = recommendations.map(async (product) => {
      try {
        const { data, error } = await supabase
          .from('product_images')
          .select('*')
          .eq('product_id', product.id)
          .order('display_order', { ascending: true });
        
        if (error) throw error;
        return { productId: product.id, images: data || [] };
      } catch (error) {
        return { productId: product.id, images: [] };
      }
    });

    const imageResults = await Promise.all(imagePromises);
    const imageMap: { [key: string]: any[] } = {};
    imageResults.forEach(({ productId, images }) => {
      imageMap[productId] = images;
    });
    setProductImages(imageMap);
  };

  const trackBehavior = async (behaviorType: string, productId?: string) => {
    try {
      await supabase
        .from('user_behaviors')
        .insert([{
          user_id: user?.id || null,
          session_id: getSessionId(),
          behavior_type: behaviorType,
          product_id: productId || null,
          page_url: window.location.href,
          referrer_url: document.referrer,
          device_type: getDeviceType()
        }]);
    } catch (error) {
      console.error('Failed to track behavior:', error);
    }
  };

  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  };

  const getDeviceType = () => {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };

  const handleProductClick = (product: RecommendedProduct) => {
    trackBehavior('click', product.id);
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'also_viewed':
        return <Eye className="w-4 h-4" />;
      case 'category_preference':
        return <Heart className="w-4 h-4" />;
      case 'trending':
        return <TrendingUp className="w-4 h-4" />;
      case 'complementary':
        return <Zap className="w-4 h-4" />;
      case 'popular':
        return <Users className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getReasonText = (reason: string) => {
    switch (reason) {
      case 'also_viewed':
        return 'Others also viewed';
      case 'category_preference':
        return 'Based on your interests';
      case 'trending':
        return 'Trending now';
      case 'complementary':
        return 'Perfect together';
      case 'popular':
        return 'Popular choice';
      case 'cached':
        return 'Recommended for you';
      default:
        return 'Recommended';
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'homepage':
        return 'Recommended for You';
      case 'product_detail':
        return 'You Might Also Like';
      case 'cart':
        return 'Complete Your Order';
      case 'search':
        return 'Discover More';
      default:
        return 'Recommended Products';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const calculateCommission = (product: RecommendedProduct) => {
    if (product.commission_type === 'percentage') {
      return (product.price * product.commission_rate) / 100;
    }
    return product.flat_commission_amount;
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, recommendations.length - 3));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + Math.max(1, recommendations.length - 3)) % Math.max(1, recommendations.length - 3));
  };

  if (loading) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center space-x-2 mb-6">
          <Sparkles className="w-6 h-6 text-primary-500 animate-pulse" />
          <h2 className="text-2xl font-bold text-gray-900">{title || getDefaultTitle()}</h2>
        </div>
        <div className={variant === 'grid' ? 'grid grid-cols-2 md:grid-cols-4 gap-4' : 'flex space-x-4 overflow-hidden'}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200"></div>
              <div className="p-4 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Don't show anything if no recommendations
  }

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-bold text-gray-900">{title || getDefaultTitle()}</h2>
        </div>
        
        {variant === 'horizontal' && recommendations.length > 4 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={prevSlide}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
              disabled={currentIndex >= recommendations.length - 4}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Recommendations Grid/Carousel */}
      <div className={variant === 'grid' 
        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
        : 'relative overflow-hidden'
      }>
        {variant === 'horizontal' && (
          <div 
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 25}%)` }}
          >
            {recommendations.map((product) => {
              const images = productImages[product.id] || [];
              const commission = calculateCommission(product);
              
              return (
                <div key={product.id} className="w-1/4 flex-shrink-0 px-2">
                  <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group">
                    <Link
                      to={`/product/${product.id}`}
                      onClick={() => handleProductClick(product)}
                      className="block"
                    >
                      <div className="aspect-square relative overflow-hidden">
                        {images.length > 0 ? (
                          <ProductGallery
                            images={images}
                            productTitle={product.title}
                            className="w-full h-full"
                          />
                        ) : (
                          <img
                            src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=500'}
                            alt={product.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        )}

                        {/* Recommendation Reason Badge */}
                        {showReasons && (
                          <div className="absolute top-2 left-2 bg-primary-500 bg-opacity-90 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
                            {getReasonIcon(product.recommendation_reason)}
                            <span className="hidden sm:inline">{getReasonText(product.recommendation_reason)}</span>
                          </div>
                        )}

                        {/* Commission Badge */}
                        {commission > 0 && (
                          <div className="absolute bottom-2 right-2 bg-secondary-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                            ${commission.toFixed(2)} 💰
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="p-4">
                      <Link
                        to={`/product/${product.id}`}
                        onClick={() => handleProductClick(product)}
                        className="block hover:text-primary-600 transition-colors"
                      >
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                          {product.title}
                        </h3>
                      </Link>

                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xl font-bold text-primary-600">
                          {formatPrice(product.price)}
                        </span>
                        {product.average_rating > 0 && (
                          <div className="flex items-center space-x-1">
                            <StarRating rating={product.average_rating} size="sm" readonly />
                            <span className="text-sm text-gray-600">
                              ({product.review_count})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Recommendation Score */}
                      {showReasons && (
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Match: {Math.round(product.recommendation_score * 100)}%</span>
                          <button
                            onClick={() => trackBehavior('cart_add', product.id)}
                            className="flex items-center space-x-1 text-primary-600 hover:text-primary-700"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {variant === 'grid' && recommendations.map((product) => {
          const images = productImages[product.id] || [];
          const commission = calculateCommission(product);
          
          return (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group">
              <Link
                to={`/product/${product.id}`}
                onClick={() => handleProductClick(product)}
                className="block"
              >
                <div className="aspect-square relative overflow-hidden">
                  {images.length > 0 ? (
                    <ProductGallery
                      images={images}
                      productTitle={product.title}
                      className="w-full h-full"
                    />
                  ) : (
                    <img
                      src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=500'}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Recommendation Reason Badge */}
                  {showReasons && (
                    <div className="absolute top-2 left-2 bg-primary-500 bg-opacity-90 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1">
                      {getReasonIcon(product.recommendation_reason)}
                      <span>{getReasonText(product.recommendation_reason)}</span>
                    </div>
                  )}

                  {/* Commission Badge */}
                  {commission > 0 && (
                    <div className="absolute bottom-2 right-2 bg-secondary-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      ${commission.toFixed(2)} 💰
                    </div>
                  )}
                </div>
              </Link>

              <div className="p-4">
                <Link
                  to={`/product/${product.id}`}
                  onClick={() => handleProductClick(product)}
                  className="block hover:text-primary-600 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {product.title}
                  </h3>
                </Link>

                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-primary-600">
                    {formatPrice(product.price)}
                  </span>
                  {product.average_rating > 0 && (
                    <div className="flex items-center space-x-1">
                      <StarRating rating={product.average_rating} size="sm" readonly />
                      <span className="text-sm text-gray-600">
                        ({product.review_count})
                      </span>
                    </div>
                  )}
                </div>

                {/* Recommendation Score */}
                {showReasons && (
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Match: {Math.round(product.recommendation_score * 100)}%</span>
                    <button
                      onClick={() => trackBehavior('cart_add', product.id)}
                      className="flex items-center space-x-1 text-primary-600 hover:text-primary-700"
                    >
                      <ShoppingCart className="w-3 h-3" />
                      <span>Add</span>
                    </button>
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

export default RecommendationEngine;
