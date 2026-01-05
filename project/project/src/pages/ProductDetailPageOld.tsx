import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingCart, Shield, Truck, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SAMPLE_PRODUCTS } from '../lib/sampleData';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface Product {
  id: string;
  title: string;
  description?: string;
  price: number;
  images: string[];
  videos: string[];
  commission_rate: number;
  commission_type: 'percentage' | 'flat_rate';
  flat_commission_amount: number;
  seller_id: string;
  profiles?: {
    full_name: string;
    location?: string;
  };
  shipping_cost?: number;
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
  average_rating?: number;
  review_count?: number;
}

const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const { profile } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      
      // Try to fetch from database first
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          profiles:seller_id (
            full_name,
            location
          )
        `)
        .eq('id', productId)
        .single();

      if (error || !data) {
        // Fallback to sample data
        const sampleProduct = SAMPLE_PRODUCTS.find(p => p.id === productId);
        if (sampleProduct) {
          setProduct(sampleProduct);
        }
      } else {
        setProduct(data);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      // Fallback to sample data
      const sampleProduct = SAMPLE_PRODUCTS.find(p => p.id === productId);
      if (sampleProduct) {
        setProduct(sampleProduct);
      }
    } finally {
      setLoading(false);
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
        <Link to="/" className="text-amber-600 hover:text-amber-700">
          Return to Home
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
        <span className="text-gray-900">{product.title}</span>
      </div>

      {/* Back Button */}
      <Link 
        to="/" 
        className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Products</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Product Images */}
        <div className="space-y-4">
          {/* Main Image */}
          <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
            <img
              src={product.images[selectedImageIndex] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800'}
              alt={product.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Thumbnail Images */}
          {product.images.length > 1 && (
            <div className="flex space-x-2">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImageIndex(index)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 ${
                    selectedImageIndex === index ? 'border-amber-500' : 'border-gray-200'
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.title} ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Title and Rating */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{product.title}</h1>
            
            {product.average_rating && (
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex items-center">
                  <span className="text-yellow-400">★★★★★</span>
                </div>
                <span className="text-lg text-gray-600">
                  {product.average_rating.toFixed(1)} ({product.review_count || 0} reviews)
                </span>
              </div>
            )}
          </div>

          {/* Price */}
          <div className="space-y-2">
            <div className="flex items-center space-x-4">
              <span className="text-4xl font-bold text-gray-900">
                ${product.price.toFixed(2)}
              </span>
              {product.is_subscription && product.subscription_interval && (
                <span className="text-lg text-amber-600 font-semibold">
                  /{product.subscription_interval}
                </span>
              )}
            </div>
            
            {product.shipping_cost && (
              <p className="text-gray-600">+ ${product.shipping_cost.toFixed(2)} shipping</p>
            )}
          </div>

          {/* Seller Info */}
          {product.profiles && (
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(product.profiles.full_name)}&size=64&background=random`}
                alt={product.profiles.full_name}
                className="w-16 h-16 rounded-full"
              />
              <div>
                <h3 className="font-semibold text-gray-900">{product.profiles.full_name}</h3>
                {product.profiles.location && (
                  <p className="text-gray-600">{product.profiles.location}</p>
                )}
                <Link 
                  to={`/store/${product.seller_id}`}
                  className="text-amber-600 hover:text-amber-700 font-medium"
                >
                  Visit Store
                </Link>
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Quantity and Actions */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label htmlFor="quantity" className="text-sm font-medium text-gray-700">
                Quantity:
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                {[...Array(10)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-4">
              <button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center space-x-2">
                <ShoppingCart className="w-5 h-5" />
                <span>Add to Cart</span>
              </button>
              
              <button className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-4 rounded-lg transition-colors">
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Social Share */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Share this product</h3>
            <SocialShareButton 
              product={product}
              affiliateCode={affiliateCode || undefined}
              size="lg"
              className="w-full"
            />
          </div>

          {/* Affiliate Section */}
          {profile?.role === 'affiliate' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Affiliate Tools</h3>
              <AffiliateLink
                productId={product.id}
                commissionRate={product.commission_rate}
                commissionType={product.commission_type}
                flatCommissionAmount={product.flat_commission_amount}
                price={product.price}
              />
            </div>
          )}

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

      {/* Reviews Section */}
      <div className="mt-16 border-t pt-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Customer Reviews</h2>
          {profile && (
            <button
              onClick={() => setShowWriteReview(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Write a Review
            </button>
          )}
        </div>
        
        <ProductReviews 
          productId={product.id} 
          averageRating={product.average_rating || 0}
          reviewCount={product.review_count || 0}
        />
      </div>

      {/* Write Review Modal */}
      {showWriteReview && (
        <WriteReview
          productId={product.id}
          productTitle={product.title}
          onClose={() => setShowWriteReview(false)}
          onReviewSubmitted={() => {
            setShowWriteReview(false);
            // Refresh reviews if needed
          }}
        />
      )}

      {/* Floating Share Button for Mobile */}
      <div className="lg:hidden">
        <SocialShareButton 
          product={product}
          affiliateCode={affiliateCode || undefined}
          variant="floating"
        />
      </div>
    </div>
  );
};

export default ProductDetailPage;
