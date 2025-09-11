import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingCart, Shield, Truck, RotateCcw, DollarSign, Gift, Star, Users, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useCart } from '../contexts/CartContext';
import AuthModal from '../components/AuthModal';
import RecommendationEngine from '../components/RecommendationEngine';
import ShippingSelector from '../components/ShippingSelector';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';

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
  shipping_options?: Array<{ name: string; cost: number; estimated_days: string }>;
  requires_shipping?: boolean;
  is_subscription?: boolean;
  subscription_interval?: 'weekly' | 'monthly';
  average_rating?: number;
  review_count?: number;
}

const ProductDetailPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const { profile, user } = useAuth();
  const { addToCart: addItemToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedShipping, setSelectedShipping] = useState<{ id: string; name: string; cost: number; estimated_days: string } | null>(null);
  
  // Behavior tracking
  const { trackView, trackClick, trackCartAdd } = useBehaviorTracker();

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

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
          // Map sample product format to expected Product interface
          const mappedProduct = {
            id: sampleProduct.id,
            title: sampleProduct.name,
            description: sampleProduct.description,
            price: sampleProduct.price,
            images: [sampleProduct.image],
            videos: [],
            commission_rate: sampleProduct.commission_rate,
            commission_type: 'percentage' as const,
            flat_commission_amount: 0,
            seller_id: sampleProduct.seller || 'sample-seller',
            profiles: {
              full_name: sampleProduct.seller || 'Sample Seller',
              location: 'Sample Location'
            },
            shipping_cost: 9.99,
            is_subscription: false,
            subscription_interval: 'monthly' as const,
            average_rating: sampleProduct.rating,
          };
          setProduct(mappedProduct);
        }
      } else {
        setProduct(data);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      // Fallback to sample data
      const sampleProduct = SAMPLE_PRODUCTS.find(p => p.id === productId);
      if (sampleProduct) {
        // Map sample product format to expected Product interface
        const mappedProduct = {
          id: sampleProduct.id,
          title: sampleProduct.name,
          description: sampleProduct.description,
          price: sampleProduct.price,
          images: [sampleProduct.image],
          videos: [],
          commission_rate: sampleProduct.commission_rate,
          commission_type: 'percentage' as const,
          flat_commission_amount: 0,
          seller_id: sampleProduct.seller || 'sample-seller',
          profiles: {
            full_name: sampleProduct.seller || 'Sample Seller',
            location: 'Sample Location'
          },
          shipping_cost: 9.99,
          is_subscription: false,
          subscription_interval: 'monthly' as const,
          average_rating: sampleProduct.rating,
        };
        setProduct(mappedProduct);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateCommission = () => {
    if (!product) return 0;
    
    if (product.commission_type === 'percentage') {
      return (product.price * product.commission_rate) / 100;
    } else {
      return product.flat_commission_amount || 0;
    }
  };

  const handleAffiliateAction = () => {
    if (!user) {
      // Not logged in - show auth modal
      setAuthMode('register');
      setShowAuthModal(true);
      return;
    }

    if (profile?.role === 'affiliate') {
      // Already an affiliate - add to campaign
      addToCampaign();
    } else {
      // Regular user - buy now
      addToCart();
    }
  };

  const addToCampaign = async () => {
    // Track affiliate campaign action
    if (product) {
      trackClick(product.id, 'affiliate_campaign_add');
    }
    
    // TODO: Implement add to affiliate campaign
    console.log('Adding product to affiliate campaign:', product?.id);
    alert('Product added to your affiliate campaign!');
  };

  const addToCart = async () => {
    if (!product) return;
    
    // Check if shipping is required but no option is selected
    if (product.requires_shipping && !selectedShipping) {
      alert('Please select a shipping option before adding to cart.');
      return;
    }
    
    // Track add to cart behavior
    trackCartAdd(product.id);
    
    // Add product to cart with selected shipping cost
    addItemToCart({
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: quantity,
      image: product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800',
      sellerId: product.seller_id,
      sellerName: product.profiles?.full_name || 'Unknown Seller',
      shippingCost: selectedShipping?.cost || 0,
      maxQuantity: 99 // You might want to track inventory
    });
    
    // Show success message or redirect to cart
    alert(`Product added to cart! ${selectedShipping ? `Shipping: ${selectedShipping.name} (+$${selectedShipping.cost.toFixed(2)})` : ''}`);
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
        <p className="text-gray-600 mb-4">The product you're looking for doesn't exist.</p>
        <Link to="/products" className="text-amber-600 hover:text-amber-700 font-medium">
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
      <Link 
        to="/marketplace" 
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
                  <img src={image} alt={`${product.title} ${index + 1}`} className="w-full h-full object-cover" />
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
                  <span className="text-yellow-400 text-lg">★★★★★</span>
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
              {product.requires_shipping && (
                <span className="text-lg text-gray-600">
                  + shipping (calculated below)
                </span>
              )}
            </div>
            
            {product.commission_rate > 0 && (
              <div className="text-green-600 font-medium">
                {product.commission_type === 'percentage' 
                  ? `${product.commission_rate}% affiliate commission`
                  : `$${product.flat_commission_amount.toFixed(2)} affiliate commission`
                }
              </div>
            )}
          </div>

          {/* Description */}
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 text-lg leading-relaxed">
              {product.description}
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
            <BuyerRewards
              productPrice={product.price}
              commissionRate={product.commission_rate}
            />

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
                    <span>${(product.price * quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{selectedShipping.name}:</span>
                    <span>{selectedShipping.cost === 0 ? 'FREE' : `$${selectedShipping.cost.toFixed(2)}`}</span>
                  </div>
                  <div className="border-t border-gray-300 pt-1 mt-2">
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total:</span>
                      <span>${(product.price * quantity + selectedShipping.cost).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Main Action Button */}
              <div className="flex space-x-4">
                <button 
                  onClick={handleAffiliateAction}
                  className="flex-1 bg-amber-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-amber-700 transition-colors flex items-center justify-center space-x-2"
                >
                  {!user ? (
                    <>
                      <DollarSign className="w-5 h-5" />
                      <span>Sign In to Start Selling</span>
                    </>
                  ) : profile?.role === 'affiliate' ? (
                    <>
                      <TrendingUp className="w-5 h-5" />
                      <span>Start Selling - Earn ${calculateCommission().toFixed(2)}</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Buy Now</span>
                    </>
                  )}
                </button>
                
                <button className="border border-gray-300 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Heart className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Secondary Action for Non-Affiliates */}
              {user && profile?.role !== 'affiliate' && product.commission_rate > 0 && (
                <button 
                  onClick={() => addToCampaign()}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>Become an Affiliate - Earn ${calculateCommission().toFixed(2)} per sale</span>
                </button>
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

      {/* Related Products / AI Recommendations */}
      {product && (
        <div className="mt-16">
          <RecommendationEngine
            type="product_detail"
            contextProductId={product.id}
            title="You might also like"
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
