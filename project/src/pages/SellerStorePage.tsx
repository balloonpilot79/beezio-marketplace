import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import ProductGrid from '../components/ProductGrid';
import StoreCustomization from '../components/StoreCustomization';
import StoreContactModal from '../components/StoreContactModal';
import { Star, MapPin, Clock, Package, Award, ExternalLink, Share2, Settings, MessageSquare, Facebook, Instagram, Twitter, Linkedin, Globe, Target, Sparkles, Shield, Download, Zap, Lock, Store, Eye, BarChart, Users, FileText } from 'lucide-react';
import { applyThemeToDocument, getThemeStyles, type ThemeName } from '../utils/themes';
import { SAMPLE_PRODUCTS } from '../data/sampleProducts';

interface SellerStorePageProps {
  sellerId?: string;
  isCustomDomain?: boolean;
}

const SellerStorePage: React.FC<SellerStorePageProps> = ({ sellerId: propSellerId, isCustomDomain = false }) => {
  const { sellerId: paramSellerId } = useParams<{ sellerId: string }>();
  const sellerId = propSellerId || paramSellerId;
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
  const [customPages, setCustomPages] = useState<any[]>([]);
  const [contactModal, setContactModal] = useState(false);
  
  useEffect(() => {
    console.log('[SellerStorePage] useEffect triggered with sellerId:', sellerId);
    
    if (!sellerId) {
      console.error('[SellerStorePage] No sellerId provided');
      setLoading(false);
      setSeller(null);
      return;
    }
    
    const fetchSellerData = async () => {
      try {
        console.log('[SellerStorePage] Starting data fetch for sellerId:', sellerId);
        setLoading(true);
        
        // Sample store fallback data (check FIRST to avoid database queries)
        // Each store is a UNIQUE mini-website with custom domains, internal messaging, and distinct designs
        const sampleStores: Record<string, any> = {
          'beezio-store': {
            id: 'beezio-store',
            full_name: 'Beezio Marketplace',
            bio: '🚀 FULL FEATURE DEMO: This store showcases everything Beezio offers - custom pages, white-label branding, affiliate links, analytics, and more. Your store can look just like this (or completely different with our templates)!',
            store_theme: 'modern',
            store_banner: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=80',
            store_logo: '/bzobee.png',
            subdomain: 'beezio-store',
            custom_domain: 'shop.beezio.co',
            location: 'Seattle, WA',
            business_hours: 'Open 24/7',
            social_links: {
              facebook: 'https://facebook.com/beezio',
              instagram: 'https://instagram.com/beezio',
              twitter: 'https://twitter.com/beezio'
            },
            template_id: 'modern-grid',
            product_page_template: 'product-detailed',
            layout_config: {
              header_style: 'banner',
              product_grid: '4-col',
              sidebar: false,
              footer_style: 'detailed',
              show_ratings: true,
              show_quick_view: true,
              show_all_features: true
            },
            demo_features: {
              showcase_all: true,
              active_affiliates: 23,
              total_sales: 1847,
              avg_conversion: '3.2%',
              custom_pages: ['About', 'FAQ', 'Shipping'],
              white_label: true
            },
            custom_css: '.product-card { border-radius: 16px; transition: transform 0.3s ease; } .product-card:hover { transform: translateY(-8px); }',
            has_contact_page: true
          },
          'harbor-coffee': {
            id: 'harbor-coffee',
            full_name: 'Harbor Coffee Roasters',
            bio: '☕ Artisan coffee roasted fresh daily. Try our MESSAGING feature - click "Contact Store" to see how customers can reach you directly! We source the finest single-origin beans from sustainable farms.',
            store_theme: 'elegant',
            store_banner: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1600&q=80',
            store_logo: null,
            subdomain: 'harbor-coffee',
            custom_domain: 'harborcoffee.com',
            location: 'Portland, OR',
            business_hours: 'Mon-Fri 7am-6pm',
            social_links: {
              instagram: 'https://instagram.com/harborcoffee',
              facebook: 'https://facebook.com/harborcoffee',
              website: 'https://harborcoffee.com'
            },
            template_id: 'boutique-story',
            product_page_template: 'product-immersive',
            layout_config: {
              header_style: 'full-width',
              product_grid: '2-col',
              sidebar: false,
              footer_style: 'elegant',
              show_large_images: true,
              show_story: true,
              show_messaging_demo: true
            },
            demo_features: {
              messaging: true,
              hasUnreadMessages: 3,
              messagePreview: 'Try the built-in messaging system! Click Contact Store to see how customers can message you directly.'
            },
            custom_css: '.store-header { background: linear-gradient(135deg, #6B4423 0%, #3E2723 100%); color: white; } .product-card { box-shadow: 0 8px 24px rgba(0,0,0,0.12); }',
            has_contact_page: true
          },
          'luma-labs': {
            id: 'luma-labs',
            full_name: 'Luma Labs',
            bio: '💻 DIGITAL STORE DEMO: Instant delivery, custom pages, and digital downloads. Perfect template for selling courses, templates, ebooks, and software. Browse our catalog to see digital commerce in action!',
            store_theme: 'minimalist',
            store_banner: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1600&q=80',
            store_logo: null,
            subdomain: 'luma-labs',
            custom_domain: 'lumalabs.io',
            location: 'Remote-First',
            business_hours: 'Instant Digital Delivery',
            social_links: {
              twitter: 'https://twitter.com/lumalabs',
              website: 'https://lumalabs.io'
            },
            template_id: 'catalog-browse',
            product_page_template: 'product-minimal',
            layout_config: {
              header_style: 'minimal',
              product_grid: '3-col',
              sidebar: true,
              footer_style: 'minimal',
              show_categories: true,
              show_filters: true,
              show_digital_features: true
            },
            demo_features: {
              digital_products: true,
              instant_delivery: true,
              download_stats: {
                total_downloads: 2847,
                monthly_customers: 156,
                avg_rating: 4.9
              },
              subscription_option: true
            },
            custom_css: '.store-header { background: #f8fafc; border-bottom: 1px solid #e2e8f0; } .product-card { border: 1px solid #e2e8f0; background: white; }',
            has_contact_page: true
          },
          'cause-collective': {
            id: 'cause-collective',
            full_name: 'Cause Collective',
            bio: '🎯 FUNDRAISER DEMO: See the progress bar below! Every purchase supports local causes. This store shows how fundraisers can track their goals and engage supporters in real-time.',
            store_theme: 'vibrant',
            store_banner: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1600&q=80',
            store_logo: null,
            subdomain: 'cause-collective',
            custom_domain: 'causecollective.org',
            location: 'Nationwide',
            business_hours: 'Shop Anytime, Impact Always',
            social_links: {
              instagram: 'https://instagram.com/causecollective',
              facebook: 'https://facebook.com/causecollective',
              twitter: 'https://twitter.com/causecollective'
            },
            template_id: 'marketplace-hub',
            product_page_template: 'product-comparison',
            layout_config: {
              header_style: 'split',
              product_grid: '3-col',
              sidebar: true,
              footer_style: 'detailed',
              show_featured: true,
              show_impact_badge: true,
              show_fundraiser_goal: true
            },
            demo_features: {
              fundraiser: true,
              goal_amount: 10000,
              current_raised: 7350,
              supporters_count: 89,
              days_remaining: 12,
              fundraiser_title: 'Community Youth Sports Program',
              fundraiser_description: 'Help us raise $10,000 to provide sports equipment and coaching for local youth programs'
            },
            custom_css: '.store-header { background: linear-gradient(135deg, #ec4899 0%, #f59e0b 100%); color: white; } .product-card { border: 2px solid #fbbf24; } .impact-badge { background: #10b981; }',
            has_contact_page: true
          }
        };

        const isSampleStore = Boolean(sampleStores[sellerId]);
        const isBeezioDemoStore = sellerId === 'beezio-store';

        // Allow friendly slug from store_settings.subdomain
        // Special case: beezio-store should prefer real DB-backed data when configured.
        let lookupId = sellerId;
        if (lookupId) {
          const { data: slugMatch, error: slugError } = await supabase
            .from('store_settings')
            .select('seller_id')
            .eq('subdomain', lookupId)
            .maybeSingle();
          if (slugError && slugError.code !== 'PGRST116') {
            console.warn('[SellerStorePage] Error checking subdomain slug (non-fatal):', slugError);
          }
          if (slugMatch?.seller_id) {
            lookupId = slugMatch.seller_id;
          }

          // If this is a sample store and there is no DB match (lookupId unchanged), fall back.
          if (isSampleStore && (!isBeezioDemoStore || lookupId === sellerId)) {
            console.log('[SellerStorePage] Loading sample store:', sellerId);
            const sampleStore = sampleStores[sellerId];
            setCanonicalSellerId(sampleStore.id);
            setSeller(sampleStore);
            setProducts(SAMPLE_PRODUCTS.slice(0, 12));
            setStoreStats(prev => ({
              ...prev,
              totalProducts: 12,
              memberSince: 2024
            }));
            setLoading(false);
            return;
          }
        }

        // Try to fetch seller profile by profile id or auth user id
        console.log('[SellerStorePage] Fetching profile from database...');
        const { data: sellerData, error: sellerError } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${lookupId},user_id.eq.${lookupId}`)
          .maybeSingle();

        if (sellerError) {
          console.error('[SellerStorePage] Database error fetching profile:', sellerError);
          throw sellerError;
        }

        // If no seller found in database
        if (!sellerData) {
          console.log('[SellerStorePage] No seller found in database for ID:', sellerId);
          setSeller(null);
          setLoading(false);
          return;
        }

        console.log('[SellerStorePage] Profile found:', sellerData.full_name, 'ID:', sellerData.id);
        setCanonicalSellerId(sellerData.id);
        setSeller(sellerData);

        // Fetch store settings
        const canonicalId = sellerData.id;
        console.log('[SellerStorePage] Fetching store settings for:', canonicalId);

        const { data: storeSettingsData, error: storeError } = await supabase
          .from('store_settings')
          .select('*')
          .eq('seller_id', canonicalId)
          .maybeSingle();

        if (storeError) {
          console.warn('[SellerStorePage] Error fetching store settings (non-fatal):', storeError);
        }

        if (storeSettingsData) {
          console.log('[SellerStorePage] Store settings found, applying customization');
          // Override seller data with store settings
          setSeller((prev: any) => ({
            ...prev,
            full_name: storeSettingsData.store_name || prev?.full_name,
            bio: storeSettingsData.store_description || prev?.bio,
            store_banner: storeSettingsData.store_banner,
            store_logo: storeSettingsData.store_logo,
            store_theme: storeSettingsData.store_theme || 'modern',
            subdomain: storeSettingsData.subdomain,
            custom_domain: storeSettingsData.custom_domain,
            social_links: storeSettingsData.social_links || {},
            business_hours: storeSettingsData.business_hours,
            shipping_policy: storeSettingsData.shipping_policy,
            return_policy: storeSettingsData.return_policy
          }));
        }

        // Fetch product order settings / curated list
        const { data: orderData, error: orderError } = await supabase
          .from('seller_product_order')
          .select('product_id, display_order, is_featured')
          .eq('seller_id', canonicalId);

        if (orderError) {
          console.warn('[SellerStorePage] Error fetching product order (non-fatal):', orderError);
        }

        let productsData: any[] = [];
        const orderIds = orderData?.map(entry => entry.product_id).filter(Boolean) || [];

        if (orderIds.length > 0) {
          console.log('[SellerStorePage] Loading curated product list:', orderIds.length, 'items');
          const { data: curatedProducts, error: curatedError } = await supabase
            .from('products')
            .select('*')
            .in('id', orderIds)
            .eq('is_active', true);

          if (curatedError) {
            console.error('[SellerStorePage] Error fetching curated products:', curatedError);
          } else {
            productsData = curatedProducts || [];
          }
        }

        if (productsData.length === 0) {
          console.log('[SellerStorePage] Falling back to seller-owned products list');
          const { data: fallbackProducts, error: productsError } = await supabase
            .from('products')
            .select('*')
            .eq('seller_id', canonicalId)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (productsError) {
            console.error('[SellerStorePage] Error fetching products:', productsError);
          }

          productsData = fallbackProducts || [];
        }

        console.log('[SellerStorePage] Found', productsData.length, 'products for storefront');

        // Merge products with order settings and sort
        const orderedProducts = productsData.map(product => {
          const orderSetting = orderData?.find(o => o.product_id === product.id);
          return {
            ...product,
            display_order: orderSetting?.display_order ?? 999,
            is_featured: orderSetting?.is_featured ?? false
          };
        });

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

        // Fetch custom pages
        const { data: pagesData, error: pagesError } = await supabase
          .from('custom_pages')
          .select('page_slug,page_title,is_active,display_order')
          .eq('owner_id', sellerData.id)
          .eq('owner_type', 'seller')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (pagesError) {
          console.warn('[SellerStorePage] Error fetching custom pages (non-fatal):', pagesError);
        }
        setCustomPages(pagesData || []);

        console.log('[SellerStorePage] Data fetch complete, setting loading to false');
        setLoading(false);
      } catch (error) {
        console.error('[SellerStorePage] CRITICAL ERROR in fetchSellerData:', error);
        setSeller(null);
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

  const storeUrl = seller?.custom_domain
    ? `https://${seller.custom_domain}`
    : seller?.subdomain
    ? `https://${seller.subdomain}.beezio.co`
    : `${window.location.origin}/store/${resolvedSellerId}`;

  const handleShare = async () => {
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
          {!isCustomDomain && (
            <Link to="/" className="text-amber-600 hover:text-amber-700 font-medium">
              Return to Homepage
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme?.colors.background || '#fef3c7' }}>
      {/* Apply custom CSS for unique store styling */}
      {seller.custom_css && (
        <style>{seller.custom_css}</style>
      )}
      
      {/* Admin Toolbar - Only visible to store owner when logged in */}
      {isOwner && !isCustomDomain && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <span className="font-semibold">Store Owner View</span>
              {seller.custom_domain && (
                <span className="text-amber-100 text-sm">| Your store is live at: {seller.custom_domain}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsCustomizing(true)}
                className="px-4 py-1.5 bg-white text-amber-600 rounded-lg hover:bg-amber-50 transition-colors text-sm font-medium"
              >
                Customize Store
              </button>
              {!isCustomDomain && (
                <Link
                  to="/dashboard"
                  className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
                >
                  Dashboard
                </Link>
              )}
              <a
                href="https://beezio.co/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium flex items-center gap-1"
              >
                <ExternalLink className="w-4 h-4" />
                Beezio Dashboard
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Custom Domain Banner - Shows customers the professional custom domain */}
      {seller.custom_domain && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-center gap-2 text-sm">
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">PROFESSIONAL STORE</span>
            <span className="font-semibold">{seller.custom_domain}</span>
            <span className="opacity-75">|</span>
            <span className="opacity-90">Secure checkout & payments</span>
          </div>
        </div>
      )}
      
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
                  <div className="flex items-center gap-2">
                    {seller.social_links.facebook && (
                      <a 
                        href={seller.social_links.facebook} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                        title="Follow us on Facebook"
                      >
                        <Facebook className="w-4 h-4" />
                        <span className="font-medium">Facebook</span>
                      </a>
                    )}
                    {seller.social_links.instagram && (
                      <a 
                        href={seller.social_links.instagram} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                        title="Follow us on Instagram"
                      >
                        <Instagram className="w-4 h-4" />
                        <span className="font-medium">Instagram</span>
                      </a>
                    )}
                    {seller.social_links.twitter && (
                      <a 
                        href={seller.social_links.twitter} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                        title="Follow us on Twitter"
                      >
                        <Twitter className="w-4 h-4" />
                        <span className="font-medium">Twitter</span>
                      </a>
                    )}
                    {seller.social_links.linkedin && (
                      <a 
                        href={seller.social_links.linkedin} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                        title="Follow us on LinkedIn"
                      >
                        <Linkedin className="w-4 h-4" />
                        <span className="font-medium">LinkedIn</span>
                      </a>
                    )}
                    {seller.social_links.website && (
                      <a 
                        href={seller.social_links.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
                        title="Visit our website"
                      >
                        <Globe className="w-4 h-4" />
                        <span className="font-medium">Website</span>
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
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storeUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 text-sm font-semibold"
              >
                Share on Facebook
              </a>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(storeUrl)}&text=${encodeURIComponent(`${seller.full_name}'s store on Beezio`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-slate-50 text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-100 text-sm font-semibold"
              >
                Share on X
              </a>
              <button
                onClick={() => setContactModal(true)}
                className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg font-semibold"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Message</span>
              </button>
              {customPages.filter(p => p.page_slug !== 'contact').map((p) => (
                <Link
                  key={p.page_slug}
                  to={`/store/${resolvedSellerId}/${p.page_slug}`}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:border-amber-500 hover:text-amber-600 text-sm font-semibold"
                >
                  {p.page_title}
                </Link>
              ))}
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

      {/* Interactive Demo Features */}
      {seller.demo_features?.fundraiser && (
        <div className="bg-gradient-to-br from-pink-50 to-orange-50 border-y border-pink-200">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-pink-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-br from-pink-500 to-orange-500 p-3 rounded-xl">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-pink-600 uppercase tracking-wider">Active Fundraiser</div>
                  <h3 className="text-2xl font-bold text-gray-900">{seller.demo_features.fundraiser_title}</h3>
                </div>
              </div>
              <p className="text-gray-700 mb-6">{seller.demo_features.fundraiser_description}</p>
              
              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-600">Progress</span>
                  <span className="text-2xl font-bold text-pink-600">
                    ${seller.demo_features.current_raised.toLocaleString()} / ${seller.demo_features.goal_amount.toLocaleString()}
                  </span>
                </div>
                <div className="h-6 bg-gray-200 rounded-full overflow-hidden border-2 border-gray-300">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-orange-500 rounded-full transition-all duration-1000 flex items-center justify-end pr-2"
                    style={{ width: `${(seller.demo_features.current_raised / seller.demo_features.goal_amount) * 100}%` }}
                  >
                    <span className="text-white text-xs font-bold drop-shadow">
                      {Math.round((seller.demo_features.current_raised / seller.demo_features.goal_amount) * 100)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="text-center p-4 bg-pink-50 rounded-xl border border-pink-200">
                  <div className="text-3xl font-bold text-pink-600">{seller.demo_features.supporters_count}</div>
                  <div className="text-sm text-gray-600 font-medium">Supporters</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="text-3xl font-bold text-orange-600">{seller.demo_features.days_remaining}</div>
                  <div className="text-sm text-gray-600 font-medium">Days Left</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="text-3xl font-bold text-green-600">
                    {Math.round((seller.demo_features.current_raised / seller.demo_features.goal_amount) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Complete</div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <strong>FUNDRAISER DEMO:</strong> This progress bar updates in real-time as purchases are made. 
                    Every product sold contributes to the goal. Perfect for schools, charities, sports teams, and community causes!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {seller.demo_features?.messaging && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-y border-green-200">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-green-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-xl relative">
                  <MessageSquare className="w-8 h-8 text-white" />
                  {seller.demo_features.hasUnreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
                      {seller.demo_features.hasUnreadMessages}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-green-600 uppercase tracking-wider">Messaging</div>
                  <h3 className="text-2xl font-bold text-gray-900">Direct Customer Communication</h3>
                </div>
              </div>

              <div className="mb-6 p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-500 rounded-full w-12 h-12 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    JD
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">John Doe</span>
                      <span className="text-xs text-gray-500">2 hours ago</span>
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">NEW</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">
                      {seller.demo_features.messagePreview}
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setContactModal(true)}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <MessageSquare className="w-6 h-6" />
                Send Message (Goes to Seller Dashboard)
              </button>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <strong>MESSAGING DEMO:</strong> Click "Contact Store" or "Message" to see the internal messaging system. 
                    No email exposed, spam-free, and all conversations appear in your dashboard at /dashboard/messages!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {seller.demo_features?.digital_products && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-y border-blue-200">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-blue-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-500 p-3 rounded-xl">
                  <Download className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-blue-600 uppercase tracking-wider">Digital Commerce</div>
                  <h3 className="text-2xl font-bold text-gray-900">Instant Delivery & Downloads</h3>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300">
                  <div className="text-4xl font-bold text-blue-600 mb-2">
                    {seller.demo_features.download_stats.total_downloads.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-700 font-semibold">Total Downloads</div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl border-2 border-indigo-300">
                  <div className="text-4xl font-bold text-indigo-600 mb-2">
                    {seller.demo_features.download_stats.monthly_customers}
                  </div>
                  <div className="text-sm text-gray-700 font-semibold">Monthly Customers</div>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-300">
                  <div className="text-4xl font-bold text-purple-600 mb-2">
                    {seller.demo_features.download_stats.avg_rating} ⭐
                  </div>
                  <div className="text-sm text-gray-700 font-semibold">Average Rating</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-green-900">Instant Delivery</span>
                  </div>
                  <p className="text-sm text-gray-700">Download links sent immediately after purchase</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-5 h-5 text-purple-600" />
                    <span className="font-bold text-purple-900">Secure Files</span>
                  </div>
                  <p className="text-sm text-gray-700">Protected links with expiration & access control</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <strong>DIGITAL STORE DEMO:</strong> Perfect for selling courses, ebooks, templates, software, and more. 
                    Automated delivery, no shipping hassles, global reach 24/7!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {seller.demo_features?.showcase_all && (
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border-y border-amber-200">
          <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-amber-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-gradient-to-br from-amber-500 to-yellow-500 p-3 rounded-xl">
                  <Store className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-sm font-bold text-amber-600 uppercase tracking-wider">Full Platform Demo</div>
                  <h3 className="text-2xl font-bold text-gray-900">Complete Marketplace Features</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl text-center border-2 border-blue-200">
                  <div className="text-3xl font-bold text-blue-600">{seller.demo_features.active_affiliates}</div>
                  <div className="text-sm text-gray-700 font-semibold mt-1">Active Affiliates</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl text-center border-2 border-green-200">
                  <div className="text-3xl font-bold text-green-600">{seller.demo_features.total_sales.toLocaleString()}</div>
                  <div className="text-sm text-gray-700 font-semibold mt-1">Total Sales</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl text-center border-2 border-purple-200">
                  <div className="text-3xl font-bold text-purple-600">{seller.demo_features.avg_conversion}</div>
                  <div className="text-sm text-gray-700 font-semibold mt-1">Conversion Rate</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl text-center border-2 border-pink-200">
                  <div className="text-3xl font-bold text-pink-600">{seller.demo_features.custom_pages.length}</div>
                  <div className="text-sm text-gray-700 font-semibold mt-1">Custom Pages</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-5 h-5 text-amber-600" />
                    <span className="font-bold text-amber-900">White-Label Branding</span>
                  </div>
                  <p className="text-sm text-gray-700">Your domain, your logo, zero platform branding</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-900">Analytics Dashboard</span>
                  </div>
                  <p className="text-sm text-gray-700">Track sales, conversions, and affiliate performance</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-green-900">Affiliate Network</span>
                  </div>
                  <p className="text-sm text-gray-700">Built-in affiliate system with commission tracking</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    <span className="font-bold text-purple-900">Custom Pages</span>
                  </div>
                  <p className="text-sm text-gray-700">Add About, FAQ, Terms, and any custom content</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <strong>MARKETPLACE DEMO:</strong> This store showcases all platform capabilities. 
                    Browse different sample stores to see how each template and feature set works differently!
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Showcase Banner (only for sample stores) */}
      {['beezio-store', 'harbor-coffee', 'luma-labs', 'cause-collective'].includes(sellerId || '') && (
        <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 text-white">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                    Demo Mini-Website
                  </span>
                  <span className="text-sm opacity-90 flex items-center gap-2">
                    <span className="bg-green-500 px-2 py-0.5 rounded text-xs font-bold">MESSAGING</span>
                    <span className="bg-blue-500 px-2 py-0.5 rounded text-xs font-bold">CUSTOM DOMAIN: {seller.custom_domain}</span>
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-1">🚀 Your Customers See a Complete Website - Not Just a Store</h3>
                <p className="text-white/90 text-sm max-w-3xl">
                  This is <strong>{seller.full_name}</strong> using the <strong>{seller.template_id ? seller.template_id.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Modern Grid'}</strong> template
                  on their custom domain <strong className="bg-white/20 px-2 py-0.5 rounded">{seller.custom_domain}</strong>.
                  {' '}Messages go through secure internal platform. Checkout uses verified payment system.
                  {' '}<strong>Each store looks completely different - no platform branding required!</strong>
                </p>
              </div>
              <div className="hidden md:flex flex-col gap-2 text-right">
                <div className="text-xs opacity-75 font-semibold">Compare Different Designs:</div>
                <div className="flex gap-2">
                  {['beezio-store', 'harbor-coffee', 'luma-labs', 'cause-collective']
                    .filter(id => id !== sellerId)
                    .map(id => (
                      <a
                        key={id}
                        href={`/store/${id}`}
                        className="px-3 py-1.5 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-lg text-xs font-semibold transition-all border border-white/30"
                      >
                        {id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </a>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <div className="text-center py-12 bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
            <Package className="w-20 h-20 text-amber-400 mx-auto mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {isOwner ? "Welcome to Your Store!" : "No Products Yet"}
            </h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              {isOwner ? (
                activeCategory === 'all'
                  ? "Your store is ready! Start adding products to showcase your offerings to customers."
                  : `No products in the "${activeCategory}" category yet. Add some products to get started!`
              ) : (
                "This store is being set up. Check back soon for amazing products!"
              )}
            </p>
            
            {isOwner && (
              <div className="space-y-4">
                <Link
                  to="/dashboard/products"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium shadow-lg"
                >
                  <Package className="w-5 h-5" />
                  Add Your First Product
                </Link>
                
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Quick Start Guide</h4>
                  <div className="grid md:grid-cols-3 gap-4 text-left">
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600 mb-2">1</div>
                      <h5 className="font-semibold text-gray-900 mb-1">Add Products</h5>
                      <p className="text-sm text-gray-600">Upload your products with images and descriptions</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600 mb-2">2</div>
                      <h5 className="font-semibold text-gray-900 mb-1">Customize Store</h5>
                      <p className="text-sm text-gray-600">Set up your branding, theme, and custom domain</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600 mb-2">3</div>
                      <h5 className="font-semibold text-gray-900 mb-1">Start Selling</h5>
                      <p className="text-sm text-gray-600">Share your store link and start earning</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <ProductGrid 
            products={filteredProducts} 
            hideAffiliateUI 
            gridLayout={seller?.layout_config?.grid_layout || 'standard'}
            colorScheme={seller?.color_scheme}
          />
        )}

        {/* Store Customization Panel */}
        {isOwner && isCustomizing && (
          <div className="mt-8 border-t pt-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Customize Your Store</h3>
            <StoreCustomization userId={resolvedSellerId || sellerId || ''} role="seller" />
          </div>
        )}
      </div>

      {/* Contact Modal */}
      <StoreContactModal
        isOpen={contactModal}
        onClose={() => setContactModal(false)}
        ownerId={resolvedSellerId}
        ownerType="seller"
        storeName={seller?.full_name}
      />
    </div>
  );
};

export default SellerStorePage;
