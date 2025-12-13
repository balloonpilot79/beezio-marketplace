import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ProductGrid from '../components/ProductGrid';
import FundraiserStoreCustomization from '../components/FundraiserStoreCustomization';
import { useAuth } from '../contexts/AuthContextMultiRole';
import StoreContactModal from '../components/StoreContactModal';
import { Settings, User, Target, Heart, TrendingUp, Globe, Share2, Facebook, Instagram, Twitter, ExternalLink, Package, DollarSign } from 'lucide-react';

interface FundraiserStorePageProps {
  fundraiserId?: string;
  isCustomDomain?: boolean;
}

const FundraiserStorePage: React.FC<FundraiserStorePageProps> = ({ fundraiserId: propFundraiserId, isCustomDomain = false }) => {
  const { fundraiserId: paramFundraiserId } = useParams<{ fundraiserId: string }>();
  const fundraiserId = propFundraiserId || paramFundraiserId;
  const { profile, user } = useAuth();
  const [fundraiser, setFundraiser] = useState<any>(null);
  const [storeSettings, setStoreSettings] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canonicalFundraiserId, setCanonicalFundraiserId] = useState<string | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [customPages, setCustomPages] = useState<any[]>([]);
  const [contactModal, setContactModal] = useState(false);

  useEffect(() => {
    if (!fundraiserId) {
      setLoading(false);
      setFundraiser(null);
      return;
    }

    const loadFundraiserStore = async () => {
      try {
        setLoading(true);
        
        const { data: fundraiserRecord, error: fundraiserError } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${fundraiserId},user_id.eq.${fundraiserId}`)
          .maybeSingle();

        if (fundraiserError || !fundraiserRecord) {
          setFundraiser(null);
          setLoading(false);
          return;
        }

        setFundraiser(fundraiserRecord);
        setCanonicalFundraiserId(fundraiserRecord.id);

        const canonicalId = fundraiserRecord.id;

        const [{ data: storeSettingsData }, { data: productRows }] = await Promise.all([
          supabase
            .from('fundraiser_store_settings')
            .select('*')
            .eq('user_id', canonicalId)
            .maybeSingle(),
          supabase
            .from('fundraiser_products')
            .select(`
              *,
              products (
                id,
                title,
                description,
                price,
                images,
                category_id,
                stock_quantity,
                seller_id,
                profiles!products_seller_id_fkey (full_name)
              )
            `)
            .eq('fundraiser_id', canonicalId)
            .order('display_order')
        ]);

        if (storeSettingsData) {
          setStoreSettings({
            ...storeSettingsData,
            subdomain: storeSettingsData.subdomain,
            custom_domain: storeSettingsData.custom_domain
          });
        }

        const buyerFacingProducts = productRows?.map((row: any) => ({
          id: row.products.id,
          title: row.products.title,
          description: row.custom_description || row.products.description,
          price: row.products.price,
          images: row.products.images,
          category_id: row.products.category_id,
          stock_quantity: row.products.stock_quantity,
          seller_name: row.products.profiles?.full_name,
          is_featured: row.is_featured
        })).filter((p: any) => p.id) || [];

        setProducts(buyerFacingProducts);

        const { data: pagesData, error: pagesError } = await supabase
          .from('custom_pages')
          .select('page_slug,page_title,is_active,display_order')
          .eq('owner_id', canonicalId)
          .eq('owner_type', 'fundraiser')
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        if (pagesError) {
          console.warn('[FundraiserStorePage] Error fetching custom pages (non-fatal):', pagesError);
        }
        setCustomPages(pagesData || []);

        // Set fundraiser referral in localStorage
        localStorage.setItem('fundraiser_referral', canonicalId);
        setLoading(false);
      } catch (error) {
        console.error('Error loading fundraiser store:', error);
        setFundraiser(null);
        setProducts([]);
        setStoreSettings(null);
        setLoading(false);
      }
    };

    loadFundraiserStore();
  }, [fundraiserId]);

  const resolvedFundraiserId = canonicalFundraiserId || fundraiserId || '';
  const isOwner = Boolean(
    (profile?.id && resolvedFundraiserId && profile.id === resolvedFundraiserId) ||
    (profile?.user_id && fundraiserId && profile.user_id === fundraiserId) ||
    (user?.id && fundraiserId && user.id === fundraiserId)
  );

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-teal-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
        <p className="mt-4 text-lg font-medium text-gray-600">Loading fundraiser...</p>
      </div>
    </div>
  );
  
  if (!fundraiser) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-teal-50 flex items-center justify-center">
      <div className="text-center">
        <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Fundraiser Not Found</h2>
        <p className="text-gray-600">The fundraiser you're looking for doesn't exist.</p>
      </div>
    </div>
  );

  if (showCustomization && isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-teal-50">
        <div className="max-w-7xl mx-auto py-8 px-4">
          <div className="mb-6">
            <button
              onClick={() => setShowCustomization(false)}
              className="flex items-center gap-2 text-green-600 hover:text-green-700 font-medium"
            >
              ← Back to Fundraiser
            </button>
          </div>
          <FundraiserStoreCustomization fundraiserId={resolvedFundraiserId || fundraiserId || ''} />
        </div>
      </div>
    );
  }

  const goalPercentage = storeSettings?.fundraiser_goal > 0
    ? Math.min((storeSettings.current_raised / storeSettings.fundraiser_goal) * 100, 100)
    : 0;

  const storeUrl = storeSettings?.subdomain
    ? `https://${storeSettings.subdomain}.beezio.co`
    : storeSettings?.custom_domain
    ? `https://${storeSettings.custom_domain}`
    : `${window.location.origin}/fundraiser/${resolvedFundraiserId}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-teal-50">
      {/* Admin Toolbar - Only visible to fundraiser owner when logged in */}
      {isOwner && isCustomDomain && (
        <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-4 py-3 shadow-lg sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              <span className="font-semibold">Fundraiser Owner View</span>
              <span className="text-green-100 text-sm">| You're viewing your custom domain fundraiser</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCustomization(true)}
                className="px-4 py-1.5 bg-white text-green-600 rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
              >
                Customize Store
              </button>
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
      
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Fundraiser Header */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-2xl p-8 text-white mb-8 relative overflow-hidden">
          {storeSettings?.banner_url && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-30"
              style={{ backgroundImage: `url(${storeSettings.banner_url})` }}
            />
          )}
          <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-6">
            <div className="flex items-start gap-6">
              {(storeSettings?.logo_url || fundraiser?.avatar_url) && (
                <img
                  src={storeSettings?.logo_url || fundraiser?.avatar_url}
                  alt="Profile"
                  className="w-20 h-20 rounded-full border-4 border-white/20 object-cover"
                />
              )}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-6 h-6" />
                  <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">FUNDRAISER</span>
                </div>
                <h1 className="text-4xl font-extrabold mb-2 tracking-tight">
                  {storeSettings?.store_name || `${fundraiser.full_name}'s Fundraiser`}
                </h1>
                <p className="text-lg text-white/90 mb-4">
                  {storeSettings?.store_description || 'Help us reach our fundraising goal!'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Social Links */}
              {(storeSettings?.facebook_url || storeSettings?.instagram_url || storeSettings?.twitter_url) && (
                <div className="flex items-center gap-3">
                  {storeSettings.facebook_url && (
                    <a href={storeSettings.facebook_url} target="_blank" rel="noopener noreferrer" 
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {storeSettings.instagram_url && (
                    <a href={storeSettings.instagram_url} target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {storeSettings.twitter_url && (
                    <a href={storeSettings.twitter_url} target="_blank" rel="noopener noreferrer"
                       className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                </div>
              )}

              {/* Share Button */}
              <button 
                onClick={() => navigator.share?.({ url: storeUrl, title: `${fundraiser.full_name}'s Fundraiser` }) || 
                         navigator.clipboard.writeText(storeUrl)}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <Share2 className="w-5 h-5" />
                <span className="hidden sm:inline">Share</span>
              </button>

              <button
                onClick={() => setContactModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-black rounded-lg hover:bg-amber-500 transition-colors font-semibold"
              >
                <ExternalLink className="w-5 h-5" />
                <span>Contact</span>
              </button>

              {customPages.filter(p => p.page_slug !== 'contact').map((p) => (
                <Link
                  key={p.page_slug}
                  to={`/fundraiser/${canonicalFundraiserId || fundraiserId}/${p.page_slug}`}
                  className="px-3 py-2 border border-white/40 text-white rounded-lg hover:bg-white/10 text-sm font-semibold"
                >
                  {p.page_title}
                </Link>
              ))}

              {/* Customize Button (only for owner) */}
              {isOwner && (
                <button
                  onClick={() => setShowCustomization(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-white/90 transition-colors font-medium"
                >
                  <Settings className="w-5 h-5" />
                  <span>Customize</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Fundraising Goal Progress */}
        {storeSettings?.show_goal_on_store && storeSettings?.fundraiser_goal > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-6 h-6 text-green-600" />
                Fundraising Goal
              </h3>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  ${storeSettings.current_raised?.toLocaleString() || '0'}
                </div>
                <div className="text-sm text-gray-600">
                  of ${storeSettings.fundraiser_goal.toLocaleString()} goal
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                style={{ width: `${goalPercentage}%` }}
              >
                {goalPercentage > 15 && (
                  <span className="text-white text-xs font-bold">
                    {Math.round(goalPercentage)}%
                  </span>
                )}
              </div>
            </div>

            {storeSettings.goal_description && (
              <p className="text-gray-700 mb-3">{storeSettings.goal_description}</p>
            )}

            {storeSettings.goal_deadline && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <TrendingUp className="w-4 h-4" />
                Deadline: {new Date(storeSettings.goal_deadline).toLocaleDateString()}
              </div>
            )}

            {/* Impact Message */}
            <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-green-800 font-medium text-center">
                💚 Every purchase helps us get closer to our goal! Thank you for your support!
              </p>
            </div>
          </div>
        )}

        {/* Call to Action - How Shopping Helps */}
        <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Heart className="w-8 h-8 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Shop & Support Our Cause
              </h3>
              <p className="text-gray-700 mb-3">
                When you purchase products through this fundraiser, a portion of each sale goes directly toward 
                <span className="font-semibold text-green-700"> {storeSettings?.goal_description || 'our fundraising goal'}</span>.
                You get amazing products AND support a great cause!
              </p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span><strong>5% of sales</strong> support this fundraiser</span>
                </span>
                <span className="flex items-center gap-2 text-gray-700">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Quality products from trusted sellers</span>
                </span>
                <span className="flex items-center gap-2 text-gray-700">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span>Same prices, bigger impact</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div className="bg-white/90 rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-7 h-7 text-green-600" />
              Support Through Shopping
            </h2>
            <div className="text-sm text-gray-600">
              {products.length} products available
            </div>
          </div>

          {products.length > 0 ? (
            <>
              {/* Featured Products First */}
              {products.some(p => p.is_featured) && (
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-yellow-500" />
                    Featured Products
                  </h3>
                  <ProductGrid 
                    products={products.filter(p => p.is_featured)} 
                    gridLayout={storeSettings?.layout_config?.grid_layout || 'standard'}
                    colorScheme={storeSettings?.color_scheme}
                  />
                </div>
              )}

              {/* All Products */}
              <ProductGrid 
                products={products} 
                gridLayout={storeSettings?.layout_config?.grid_layout || 'standard'}
                colorScheme={storeSettings?.color_scheme}
              />
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="w-20 h-20 text-green-400 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {isOwner ? "Start Adding Products!" : "Products Coming Soon"}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {isOwner 
                  ? "Browse the marketplace and select products to help reach your fundraising goal."
                  : "This fundraiser is currently selecting products. Check back soon!"
                }
              </p>
              
              {isOwner && !isCustomDomain && (
                <div className="space-y-4">
                  <Link
                    to="/marketplace"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg"
                  >
                    <Globe className="w-5 h-5" />
                    Browse Marketplace
                  </Link>
                  
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h4>
                    <div className="grid md:grid-cols-3 gap-4 text-left">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 mb-2">1</div>
                        <h5 className="font-semibold text-gray-900 mb-1">Select Products</h5>
                        <p className="text-sm text-gray-600">Choose products from marketplace that align with your cause</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 mb-2">2</div>
                        <h5 className="font-semibold text-gray-900 mb-1">Share Your Store</h5>
                        <p className="text-sm text-gray-600">Promote your fundraiser store to your community</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 mb-2">3</div>
                        <h5 className="font-semibold text-gray-900 mb-1">Reach Your Goal</h5>
                        <p className="text-sm text-gray-600">5% of each sale goes toward your fundraising goal</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Trust & Transparency Section */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
            How Your Purchase Makes a Difference
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-3xl mb-2">🛍️</div>
              <h4 className="font-semibold text-gray-900 mb-1">You Shop</h4>
              <p className="text-sm text-gray-600">Purchase products you love at regular prices</p>
            </div>
            <div>
              <div className="text-3xl mb-2">💚</div>
              <h4 className="font-semibold text-gray-900 mb-1">We Donate</h4>
              <p className="text-sm text-gray-600">5% of each sale supports this fundraiser</p>
            </div>
            <div>
              <div className="text-3xl mb-2">🎯</div>
              <h4 className="font-semibold text-gray-900 mb-1">Goal Reached</h4>
              <p className="text-sm text-gray-600">Your purchases help achieve meaningful change</p>
            </div>
          </div>
        </div>
      </div>

      <StoreContactModal
        isOpen={contactModal}
        onClose={() => setContactModal(false)}
        ownerId={canonicalFundraiserId || fundraiserId || ''}
        ownerType="fundraiser"
        storeName={fundraiser?.full_name}
      />
    </div>
  );
};

export default FundraiserStorePage;
