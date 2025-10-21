import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductGrid from '../components/ProductGrid';
import AffiliateStoreCustomization from '../components/AffiliateStoreCustomization';
import { Settings, User, Award, Heart, Star, Globe, Share2, Facebook, Instagram, Twitter, Youtube, ExternalLink } from 'lucide-react';

const AffiliateStorePage: React.FC = () => {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  const [affiliate, setAffiliate] = useState<any>(null);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [showCustomization, setShowCustomization] = useState(false);

  useEffect(() => {
    if (!affiliateId) return;
    checkCurrentUser();
    fetchAffiliate();
    fetchStoreSettings();
    fetchProducts();
  }, [affiliateId]);

  const checkCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsOwner(user?.id === affiliateId);
  };

  const fetchAffiliate = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', affiliateId).single();
    setAffiliate(data);
  };

  const fetchStoreSettings = async () => {
    const { data } = await supabase.from('affiliate_store_settings').select('*').eq('affiliate_id', affiliateId).single();
    setStoreSettings(data);
  };

  const fetchProducts = async () => {
    // Fetch ONLY products this affiliate is actively promoting (from affiliate_products table)
    const { data } = await supabase
      .from('affiliate_store_products')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .eq('is_active', true);
    
    // Transform data to hide commission info from buyers (they only see final price)
    const buyerFacingProducts = data?.map(product => ({
      id: product.product_id,
      title: product.title,
      description: product.affiliate_description || product.description, // Use affiliate's custom description if available
      price: product.price, // Final price buyer pays
      images: product.custom_images?.length > 0 ? product.custom_images : product.images, // Use affiliate's custom images if available
      category_id: product.category_id,
      stock_quantity: product.stock_quantity,
      seller_name: product.seller_name,
      // DO NOT expose commission_rate or commission_type to buyers!
      // Tracking happens server-side when they purchase
    })) || [];
    
    // Track views (server-side)
    if (data && data.length > 0) {
      data.forEach(async (product) => {
        await supabase.rpc('increment_affiliate_product_metric', {
          p_affiliate_id: affiliateId,
          p_product_id: product.product_id,
          p_metric: 'views'
        });
      });
    }
    
    // Store affiliate ID in localStorage so cart knows who gets credit for sale
    localStorage.setItem('affiliate_referral', affiliateId || '');
    
    setProducts(buyerFacingProducts || [
      {
        id: '1',
        name: 'Premium Wireless Headphones',
        price: 199.99,
        image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
        description: 'High-quality wireless headphones with noise cancellation',
        commission_rate: 15,
        is_active: true
      },
      {
        id: '2',
        name: 'Smart Fitness Watch',
        price: 299.99,
        image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
        description: 'Advanced fitness tracking with heart rate monitor',
        commission_rate: 12,
        is_active: true
      },
      {
        id: '3',
        name: 'Bluetooth Speaker',
        price: 89.99,
        image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400',
        description: 'Portable speaker with amazing sound quality',
        commission_rate: 20,
        is_active: true
      },
      {
        id: '4',
        name: 'Professional Camera Lens',
        price: 549.99,
        image_url: 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=400',
        description: 'High-quality lens for professional photography',
        commission_rate: 10,
        is_active: true
      }
    ]);
    setLoading(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-4 text-lg font-medium text-gray-600">Loading affiliate store...</p>
      </div>
    </div>
  );
  
  if (!affiliate) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Affiliate Not Found</h2>
        <p className="text-gray-600">The affiliate store you're looking for doesn't exist.</p>
      </div>
    </div>
  );

  if (showCustomization && isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="mb-6">
            <button
              onClick={() => setShowCustomization(false)}
              className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
            >
              ← Back to Store
            </button>
          </div>
          <AffiliateStoreCustomization affiliateId={affiliateId!} />
        </div>
      </div>
    );
  }

  const getThemeClasses = (theme: string) => {
    switch (theme) {
      case 'vibrant':
        return 'from-pink-500 to-purple-500';
      case 'energetic':
        return 'from-orange-500 to-red-500';
      case 'nature':
        return 'from-green-400 to-blue-500';
      case 'elegant':
        return 'from-purple-600 to-blue-600';
      case 'minimal':
        return 'from-gray-400 to-gray-600';
      case 'sunset':
        return 'from-yellow-400 to-pink-500';
      default:
        return 'from-purple-500 to-pink-500';
    }
  };

  const storeUrl = `${window.location.origin}/affiliate/${affiliateId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Store Header */}
        <div className={`bg-gradient-to-r ${getThemeClasses(storeSettings?.store_theme || 'vibrant')} rounded-2xl p-8 text-white mb-8 relative overflow-hidden`}>
          {storeSettings?.store_banner && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: `url(${storeSettings.store_banner})` }}
            />
          )}
          <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="flex items-start gap-6">
              {(storeSettings?.store_logo || affiliate?.avatar_url) && (
                <img
                  src={storeSettings?.store_logo || affiliate?.avatar_url}
                  alt="Profile"
                  className="w-20 h-20 rounded-full border-4 border-white/20 object-cover"
                />
              )}
              <div>
                <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
                  {storeSettings?.store_name || `${affiliate.full_name}'s Store`}
                </h1>
                <p className="text-lg text-white/90 mb-4">
                  {storeSettings?.store_description || 'Discover amazing products with great affiliate commissions!'}
                </p>
                {storeSettings?.personal_message && (
                  <div className="bg-white/20 rounded-lg p-4 mb-4">
                    <p className="text-white/95 italic">"{storeSettings.personal_message}"</p>
                  </div>
                )}
                {storeSettings?.commission_goal && (
                  <div className="flex items-center gap-2 text-white/90">
                    <Award className="w-5 h-5" />
                    <span>Monthly Goal: ${storeSettings.commission_goal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Social Links */}
              {storeSettings?.social_links && (
                <div className="flex items-center gap-3">
                  {storeSettings.social_links.facebook && (
                    <a href={storeSettings.social_links.facebook} target="_blank" rel="noopener noreferrer" 
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {storeSettings.social_links.instagram && (
                    <a href={storeSettings.social_links.instagram} target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {storeSettings.social_links.twitter && (
                    <a href={storeSettings.social_links.twitter} target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {storeSettings.social_links.youtube && (
                    <a href={storeSettings.social_links.youtube} target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <Youtube className="w-5 h-5" />
                    </a>
                  )}
                  {storeSettings.social_links.website && (
                    <a href={storeSettings.social_links.website} target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}

              {/* Share Button */}
              <button 
                onClick={() => navigator.share?.({ url: storeUrl, title: `${affiliate.full_name}'s Store` }) || 
                         navigator.clipboard.writeText(storeUrl)}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                <span className="hidden sm:inline">Share</span>
              </button>

              {/* Customize Button (only for owner) */}
              {isOwner && (
                <button
                  onClick={() => setShowCustomization(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-white/90 transition-colors font-medium"
                >
                  <Settings className="w-5 h-5" />
                  <span>Customize Store</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Social Proof & Stats - HIDE earnings from buyers, show trust signals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Star className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
                <p className="text-sm text-gray-600">Curated Products</p>
              </div>
            </div>
            <p className="text-sm text-green-600 font-medium">Hand-picked for quality</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <User className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">1,247</p>
                <p className="text-sm text-gray-600">Happy Customers</p>
              </div>
            </div>
            <p className="text-sm text-blue-600 font-medium">Customers I've helped</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">4.9★</p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
            <p className="text-sm text-purple-600 font-medium">Trusted by thousands</p>
          </div>
        </div>

        {/* Customer Testimonials */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500" />
            What Customers Are Saying
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-100 rounded-lg p-4">
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
              <p className="text-sm text-gray-700 italic">"Thanks to this affiliate's recommendation, I found exactly what I was looking for. Great products and even better service!"</p>
            </div>
            <div className="border border-gray-100 rounded-lg p-4">
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
              <p className="text-sm text-gray-700 italic">"I've purchased through this affiliate multiple times. They only recommend quality products and the commissions clearly support their work."</p>
            </div>
          </div>
        </div>

        {/* Favorite Categories */}
        {storeSettings?.favorite_categories && storeSettings.favorite_categories.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              My Favorite Categories
            </h3>
            <div className="flex flex-wrap gap-2">
              {storeSettings.favorite_categories.map((category: string) => (
                <span key={category} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Bio Section */}
        {storeSettings?.bio && (
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-6 h-6 text-purple-600" />
              About Me
            </h3>
            <p className="text-gray-700 leading-relaxed">{storeSettings.bio}</p>
          </div>
        )}

        {/* Store Stats - HIDE commission info from buyers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{products.length}</div>
            <div className="text-gray-600 font-medium">Products Available</div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              <Heart className="w-8 h-8 inline text-red-500" />
            </div>
            <div className="text-gray-600 font-medium">Curated Selection</div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100 text-center">
            <div className="text-3xl font-bold text-orange-600 mb-2">
              <Star className="w-8 h-8 inline text-yellow-500" />
            </div>
            <div className="text-gray-600 font-medium">Trusted Affiliate</div>
          </div>
        </div>

        {/* Products Section */}
        <div className="bg-white/90 rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Globe className="w-7 h-7 text-purple-600" />
              Featured Products
            </h2>
            <div className="text-sm text-gray-600">
              {products.length} products available
            </div>
          </div>

          {/* Call to Action Banner - Transparent about affiliate support */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  🎯 Support Quality Content & Great Products
                </h3>
                <p className="text-gray-700 text-sm mb-3">
                  When you shop through my store, you're getting amazing products AND
                  supporting independent creators like myself at no extra cost to you!
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    Quality Products
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4 text-red-500" />
                    Creator Support
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-purple-500" />
                    Same Prices
                  </span>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">Your Purchase</div>
                  <div className="text-sm text-gray-600">Helps creators like me</div>
                  <div className="text-sm text-gray-600">continue making content</div>
                </div>
              </div>
            </div>
          </div>

          <ProductGrid products={products} />
        </div>
      </div>
    </div>
  );
};

export default AffiliateStorePage;
