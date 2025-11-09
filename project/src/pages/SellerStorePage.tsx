import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import ProductGrid from '../components/ProductGrid';
import StoreCustomization from '../components/StoreCustomization';
import { Star, MapPin, Clock, Package, Award, ExternalLink, Share2, Settings } from 'lucide-react';
import { applyThemeToDocument, getThemeStyles, type ThemeName } from '../utils/themes';

const SellerStorePage: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const { user, profile } = useAuth();
  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [canonicalSellerId, setCanonicalSellerId] = useState<string | null>(null);
  const [storeStats, setStoreStats] = useState({
    totalProducts: 0,
    totalSales: 0,
    rating: 4.8,
    reviewCount: 156,
    memberSince: new Date().getFullYear() - 2
  });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isCustomizing, setIsCustomizing] = useState(false);
  
  useEffect(() => {
    if (!sellerId) return;
    
    const fetchSellerData = async () => {
      try {
        // Try to fetch seller profile by profile id or auth user id
        const { data: sellerData, error: sellerError } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${sellerId},user_id.eq.${sellerId}`)
          .maybeSingle();

        if (sellerError) {
          throw sellerError;
        }

        // If no seller found, create sample seller data for demo
        if (!sellerData) {
          console.log('No seller found, using sample data for demo');
          setSeller({
            id: sellerId,
            full_name: 'Demo Store',
            email: 'demo@example.com',
            bio: 'Welcome to our amazing store! We offer high-quality products with excellent customer service.',
            role: 'seller',
            store_theme: 'modern',
            created_at: new Date().toISOString(),
            avatar_url: null,
            store_banner: null,
            store_logo: null
          });

          // Add sample products for the demo
          setProducts([
            {
              id: 'sample-1',
              title: 'Premium Wireless Headphones',
              description: 'High-quality wireless headphones with noise cancellation',
              price: 89.99,
              images: ['/api/placeholder/300/300'],
              category: 'Electronics',
              seller_id: sellerId,
              is_active: true,
              stock_quantity: 50,
              created_at: new Date().toISOString()
            },
            {
              id: 'sample-2', 
              title: 'Organic Coffee Blend',
              description: 'Premium organic coffee beans from sustainable farms',
              price: 24.99,
              images: ['/api/placeholder/300/300'],
              category: 'Food & Beverages',
              seller_id: sellerId,
              is_active: true,
              stock_quantity: 100,
              created_at: new Date().toISOString()
            },
            {
              id: 'sample-3',
              title: 'Handcrafted Leather Wallet', 
              description: 'Beautiful handcrafted leather wallet with multiple compartments',
              price: 45.00,
              images: ['/api/placeholder/300/300'],
              category: 'Fashion',
              seller_id: sellerId,
              is_active: true,
              stock_quantity: 25,
              created_at: new Date().toISOString()
            }
          ]);

          setStoreStats(prev => ({
            ...prev,
            totalProducts: 3,
            totalSales: 127,
            rating: 4.8,
            reviewCount: 156
          }));

          setCanonicalSellerId(sellerId);
          setLoading(false);
          return;
        }

        setCanonicalSellerId(sellerData.id);
        setSeller(sellerData);

        // Fetch store settings
        const canonicalId = sellerData.id;

        const { data: storeSettingsData } = await supabase
          .from('store_settings')
          .select('*')
          .eq('seller_id', canonicalId)
          .maybeSingle();

        if (storeSettingsData) {
          // Override seller data with store settings
          setSeller((prev: any) => ({
            ...prev,
            full_name: storeSettingsData.store_name || prev?.full_name,
            bio: storeSettingsData.store_description || prev?.bio,
            store_banner: storeSettingsData.store_banner,
            store_logo: storeSettingsData.store_logo,
            store_theme: storeSettingsData.store_theme || 'modern',
            social_links: storeSettingsData.social_links || {},
            business_hours: storeSettingsData.business_hours,
            shipping_policy: storeSettingsData.shipping_policy,
            return_policy: storeSettingsData.return_policy
          }));
        }

        // Fetch products
        const { data: productsData } = await supabase
          .from('products')
          .select('*')
          .eq('seller_id', canonicalId)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        // Fetch product order settings
        const { data: orderData } = await supabase
          .from('seller_product_order')
          .select('product_id, display_order, is_featured')
          .eq('seller_id', canonicalId);

        // Merge products with order settings and sort
        let orderedProducts = productsData?.map(product => {
          const orderSetting = orderData?.find(o => o.product_id === product.id);
          return {
            ...product,
            display_order: orderSetting?.display_order ?? 999,
            is_featured: orderSetting?.is_featured ?? false
          };
        }) || [];

        // Sort: featured first, then by display_order, then by created_at
        orderedProducts.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        setProducts(orderedProducts);

        // Update stats
        setStoreStats(prev => ({
          ...prev,
          totalProducts: productsData?.length || 0
        }));

        setLoading(false);
      } catch (error) {
      console.error('Error fetching seller data:', error);
      setLoading(false);
    }
  };

    fetchSellerData();
  }, [sellerId]);

  // Apply theme when seller data loads
  useEffect(() => {
    if (seller?.store_theme) {
      const themeName = (seller.store_theme as ThemeName) || 'modern';
      applyThemeToDocument(themeName, seller.theme_settings);
    }
  }, [seller]);

  const resolvedSellerId = canonicalSellerId || sellerId || '';
  const theme = seller ? getThemeStyles(seller.store_theme as ThemeName || 'modern', seller.theme_settings) : null;
  const isOwner = Boolean(
    (profile?.id && resolvedSellerId && profile.id === resolvedSellerId) ||
    (profile?.user_id && sellerId && profile.user_id === sellerId) ||
    (user?.id && sellerId && user.id === sellerId)
  );

  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))];
  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products.filter(p => p.category === activeCategory);

  const handleShare = async () => {
    const storeUrl = `${window.location.origin}/store/${resolvedSellerId}`;
    if (navigator.share) {
      await navigator.share({
        title: `${seller?.full_name}'s Store`,
        text: `Check out amazing products from ${seller?.full_name}!`,
        url: storeUrl
      });
    } else {
      navigator.clipboard.writeText(storeUrl);
      alert('Store link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Store Not Found</h1>
          <p className="text-gray-600 mb-4">The store you're looking for doesn't exist.</p>
          <Link to="/" className="text-amber-600 hover:text-amber-700 font-medium">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme?.colors.background || '#fef3c7' }}>
      {/* Store Banner */}
      {seller.store_banner && (
        <div className="h-64 bg-cover bg-center relative rounded-b-3xl shadow-lg overflow-hidden" style={{ backgroundImage: `url(${seller.store_banner})` }}>
          <div className="absolute inset-0 bg-black bg-opacity-30" />
        </div>
      )}

      {/* Store Header */}
      <div className="bg-white/90 shadow-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="flex items-start gap-8 mb-6 lg:mb-0">
              {/* Store Avatar/Logo */}
              <div className="flex-shrink-0">
                {seller.store_logo ? (
                  <img 
                    src={seller.store_logo} 
                    alt={`${seller.full_name} logo`}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-xl bg-white"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center text-white text-3xl font-extrabold shadow-xl">
                    {seller.full_name?.charAt(0) || 'S'}
                  </div>
                )}
              </div>
              {/* Store Info */}
              <div>
                <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                  {seller.full_name}'s Store
                </h1>
                <div className="flex flex-wrap items-center gap-5 text-base text-gray-600 mb-3">
                  {seller.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-5 h-5" />
                      <span>{seller.location}</span>
                    </div>
                  )}
                  {seller.business_hours && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-5 h-5" />
                      <span>{seller.business_hours}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span>{storeStats.rating} ({storeStats.reviewCount} reviews)</span>
                  </div>
                </div>
                {seller.bio && (
                  <p className="text-gray-700 max-w-2xl mb-3">{seller.bio}</p>
                )}
                
                {/* Social Links */}
                {seller.social_links && Object.keys(seller.social_links).length > 0 && (
                  <div className="flex items-center space-x-3">
                    {seller.social_links.facebook && (
                      <a href={seller.social_links.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                        Facebook
                      </a>
                    )}
                    {seller.social_links.instagram && (
                      <a href={seller.social_links.instagram} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-700">
                        Instagram
                      </a>
                    )}
                    {seller.social_links.twitter && (
                      <a href={seller.social_links.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-500">
                        Twitter
                      </a>
                    )}
                    {seller.social_links.website && (
                      <a href={seller.social_links.website} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-700">
                        Website
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Store Actions */}
            <div className="flex items-center space-x-3">
              {isOwner && (
                <button
                  onClick={() => setIsCustomizing(!isCustomizing)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                    isCustomizing 
                      ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                      : 'border border-yellow-500 text-yellow-600 hover:bg-yellow-50'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>{isCustomizing ? 'Exit Customize' : 'Customize Store'}</span>
                </button>
              )}
              <button
                onClick={handleShare}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Store</span>
              </button>
              <Link
                to={`/contact-seller/${resolvedSellerId}`}
                className="flex items-center space-x-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Contact Seller</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Store Stats */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-2">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{storeStats.totalProducts}</div>
              <div className="text-sm text-gray-600">Products</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-2">
                <Award className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{storeStats.totalSales}+</div>
              <div className="text-sm text-gray-600">Sales</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-2">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{storeStats.rating}</div>
              <div className="text-sm text-gray-600">Rating</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-2">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{storeStats.memberSince}+</div>
              <div className="text-sm text-gray-600">Years</div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Section */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="mb-8">
            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === category
                      ? 'bg-amber-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {category === 'all' ? 'All Products' : category}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Found</h3>
            <p className="text-gray-600">
              {activeCategory === 'all' 
                ? "This store doesn't have any products yet." 
                : `No products found in the "${activeCategory}" category.`}
            </p>
          </div>
        ) : (
          <ProductGrid products={filteredProducts} />
        )}

        {/* Store Customization Panel */}
        {isOwner && isCustomizing && (
          <div className="mt-8 border-t pt-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Customize Your Store</h3>
            <StoreCustomization userId={resolvedSellerId || sellerId || ''} role="seller" />
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerStorePage;
