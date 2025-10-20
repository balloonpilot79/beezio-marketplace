import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AffiliateLink from './AffiliateLink';
import { useAuth } from '../contexts/AuthContextMultiRole';
import ProductAffiliateQRCode from './ProductAffiliateQRCode';
import AddToAffiliateStoreButton from './AddToAffiliateStoreButton';
import { SAMPLE_PRODUCTS } from '../lib/sampleData';
import StarRating from './StarRating';
import SocialShareButton from './SocialShareButton';
import { calculatePricing, formatPricingBreakdown } from '../lib/pricing';

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
}

const ProductGrid: React.FC<ProductGridProps> = ({ products: externalProducts, hideFilters = false }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'affiliate'>('all');
  const { profile } = useAuth();
  // Determine user role
  const userRole = profile?.role;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalProducts, filter]);

  const fetchProducts = async () => {
    try {
      // Load sample data immediately
      console.log('ProductGrid: Loading sample data immediately');
      setProducts(SAMPLE_PRODUCTS);
      setLoading(false);
      setError(null);
      
      // Try to fetch from Supabase in background
      try {
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

        if (!error && data && data.length > 0) {
          console.log('ProductGrid: Loaded real products from database:', data.length);
          setProducts(data);
        }
      } catch (supabaseError) {
        console.log('ProductGrid: Supabase error (using sample data):', supabaseError);
      }
    } catch (error) {
      console.log('ProductGrid: Error in fetchProducts:', error);
      setProducts(SAMPLE_PRODUCTS);
      setLoading(false);
      setError(null);
    }
  };


  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
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
                <span className="text-4xl">⚠️</span>
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
              <span className="mr-2">🛍️</span>
              Shop by Category
            </h3>
            <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 ${
                filter === 'all'
                  ? 'bg-primary-500 text-white shadow-lg border-2 border-primary-600'
                  : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-200'
              }`}
            >
              🛍️ All Products
            </button>
            <button
              onClick={() => setFilter('affiliate')}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 transform hover:scale-105 ${
                filter === 'affiliate'
                  ? 'bg-accent-500 text-white shadow-lg border-2 border-accent-600'
                  : 'bg-accent-100 text-accent-800 border-2 border-accent-300 hover:border-accent-400 hover:bg-accent-200'
              }`}
            >
              💰 Affiliate Products
            </button>
            {/* Additional category buttons based on available categories */}
            <button
              className="px-6 py-3 rounded-full font-semibold bg-primary-50 text-primary-700 border-2 border-primary-300 hover:border-primary-400 hover:bg-primary-100 transition-all duration-300 transform hover:scale-105"
            >
              📱 Electronics
            </button>
            <button
              className="px-6 py-3 rounded-full font-semibold bg-green-100 text-green-800 border-2 border-green-300 hover:border-green-400 hover:bg-green-200 transition-all duration-300 transform hover:scale-105"
            >
              👕 Fashion
            </button>
            <button
              className="px-6 py-3 rounded-full font-semibold bg-orange-50 text-orange-800 border-2 border-orange-300 hover:border-orange-400 hover:bg-orange-100 transition-all duration-300 transform hover:scale-105"
            >
              � Food & Beverage
            </button>
            <button
              className="px-6 py-3 rounded-full font-semibold bg-yellow-100 text-yellow-800 border-2 border-yellow-300 hover:border-yellow-400 hover:bg-yellow-200 transition-all duration-300 transform hover:scale-105"
            >
              🏠 Home & Garden
            </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Site-wide Affiliate Link for logged-in affiliates */}
      {userRole === 'affiliate' && (
        <div className="mb-8">
          <AffiliateLink siteWide />
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 group border border-primary-200 hover:border-primary-400">
            <Link to={`/product/${product.id}`} className="block">
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=500'}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex flex-col space-y-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SocialShareButton 
                    product={product}
                    variant="icon"
                    size="sm"
                    className="bg-primary-50 bg-opacity-90 hover:bg-opacity-100 shadow-md border border-primary-200"
                  />
                </div>
                
                {/* Commission info - show to everyone with transparent calculation */}
                {product.commission_rate > 0 && (
                  <div className="absolute bottom-2 left-2 bg-primary-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1 shadow-lg">
                    <TrendingUp className="h-3 w-3" />
                    <span>
                      ${(() => {
                        const pricing = calculatePricing({
                          sellerDesiredAmount: product.price,
                          affiliateRate: product.commission_type === 'flat_rate' 
                            ? product.flat_commission_amount 
                            : product.commission_rate,
                          affiliateType: product.commission_type
                        });
                        return pricing.affiliateAmount.toFixed(2);
                      })()} 💰
                      {product.is_subscription && product.subscription_interval && (
                        <>
                          {' '}<span className="ml-1">(recurring {product.subscription_interval})</span>
                        </>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </Link>

            <div className="p-4">
              <Link to={`/product/${product.id}`}>
                <h3 className="font-display font-semibold text-gray-800 mb-2 hover:text-primary-600 transition-colors line-clamp-2">
                  {product.title}
                </h3>
              </Link>
              
              {/* Rating Display */}
              {product.average_rating && (
                <div className="flex items-center space-x-2 mb-2">
                  <StarRating rating={product.average_rating} size="sm" />
                  <span className="text-gray-600 text-sm">
                    {product.average_rating.toFixed(1)} ({product.review_count || 0} {(product.review_count || 0) === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {/* Transparent Pricing Display */}
                  <div className="group relative">
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-800 font-bold text-lg">
                        ${(() => {
                          const pricing = calculatePricing({
                            sellerDesiredAmount: product.price,
                            affiliateRate: product.commission_type === 'flat_rate' 
                              ? product.flat_commission_amount 
                              : product.commission_rate,
                            affiliateType: product.commission_type
                          });
                          return pricing.listingPrice.toFixed(2);
                        })()}
                      </span>
                      <Info className="w-4 h-4 text-gray-400 cursor-help" />
                    </div>
                    
                    {/* Pricing Breakdown Tooltip */}
                    <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      <div className="text-sm text-gray-700">
                        <div className="font-semibold text-gray-900 mb-2">💰 Transparent Pricing - Everyone Wins!</div>
                        {(() => {
                          const pricing = calculatePricing({
                            sellerDesiredAmount: product.price,
                            affiliateRate: product.commission_type === 'flat_rate' 
                              ? product.flat_commission_amount 
                              : product.commission_rate,
                            affiliateType: product.commission_type
                          });
                          const formatted = formatPricingBreakdown(pricing);
                          return (
                            <div className="space-y-1">
                              <div className="flex justify-between">
                                <span>🎯 Seller gets:</span>
                                <span className="font-medium text-green-600">{formatted.seller}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>🎁 Affiliate earns:</span>
                                <span className="font-medium text-blue-600">{formatted.affiliate}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>🏢 Platform fee:</span>
                                <span className="font-medium text-purple-600">{formatted.platform}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>💳 Processing:</span>
                                <span className="font-medium text-gray-600">{formatted.stripe}</span>
                              </div>
                              <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                                <span>You pay:</span>
                                <span className="text-gray-900">{formatted.total}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                No hidden fees - transparent pricing!
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {product.is_subscription && product.subscription_interval && (
                    <span className="ml-2 text-primary-600 text-xs font-semibold bg-primary-50 px-2 py-1 rounded-full">
                      📅 {product.subscription_interval.charAt(0).toUpperCase() + product.subscription_interval.slice(1)}
                    </span>
                  )}
                  {/* Show shipping cost if available */}
                  {product.shipping_cost && (
                    <span className="text-primary-500 text-xs font-semibold">+ ${product.shipping_cost.toFixed(2)} 🚚</span>
                  )}
                </div>
              </div>

              {product.description && (
                <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                  {product.description}
                </p>
              )}

              {/* Seller Info and Share Button */}
              <div className="flex items-center justify-between mb-4">
                {product.profiles && (
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      <Link to={`/profile/${product.seller_id}`}>
                        <img
                          src={`https://ui-avatars.com/api/?name=${encodeURIComponent(product.profiles.full_name)}&size=128&background=random`}
                          alt={product.profiles.full_name}
                          className="w-10 h-10 rounded-full object-cover border-2 border-primary-300"
                        />
                      </Link>
                    </div>
                    <div className="flex-1">
                      <Link to={`/profile/${product.seller_id}`}>
                        <p className="text-gray-800 font-semibold text-sm line-clamp-1 hover:text-primary-600 transition-colors">
                          {product.profiles?.full_name}
                        </p>
                      </Link>
                      {product.profiles?.location && (
                        <p className="text-gray-600 text-xs line-clamp-1">
                          📍 {product.profiles.location}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Share Button */}
                <div className="flex-shrink-0">
                  <SocialShareButton 
                    product={product}
                    size="sm"
                  />
                </div>
              </div>

              {/* Add to Affiliate Store Button - for affiliates */}
              {(userRole === 'affiliate' || userRole === 'fundraiser') && (
                <div className="mt-3 mb-2">
                  <AddToAffiliateStoreButton
                    productId={product.id}
                    sellerId={product.seller_id}
                    productTitle={product.title}
                    productPrice={product.price}
                    defaultCommissionRate={product.commission_rate}
                    size="sm"
                    variant="button"
                  />
                </div>
              )}

              {/* Affiliate Link for this product - only for affiliates */}
              {userRole === 'affiliate' && (
                <div className="mt-4 space-y-2">
                  <AffiliateLink
                    productId={product.id}
                    commissionRate={product.commission_rate}
                    commissionType={product.commission_type}
                    flatCommissionAmount={product.flat_commission_amount}
                    price={product.price}
                  />
                  <ProductAffiliateQRCode product={product} profile={profile} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductGrid;