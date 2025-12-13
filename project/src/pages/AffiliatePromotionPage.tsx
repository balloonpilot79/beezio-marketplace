import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import AffiliatePromotionChoice from '../components/AffiliatePromotionChoice';
import AffiliateLinkGenerator from '../components/AffiliateLinkGenerator';
import AffiliateStoreCustomization from '../components/AffiliateStoreCustomization';
import { Store, Link as LinkIcon, ArrowRight } from 'lucide-react';

const AffiliatePromotionPage: React.FC = () => {
  const { profile, user } = useAuth();
  const [promotionMethod, setPromotionMethod] = useState<'store' | 'links' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPromotionMethod();
  }, [user?.id]);

  const loadPromotionMethod = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('affiliate_store_settings')
        .select('promotion_method')
        .eq('affiliate_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading promotion method:', error);
      }

      if (data) {
        setPromotionMethod(data.promotion_method || 'store');
      }
    } catch (error) {
      console.error('Error loading promotion method:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChoiceMade = (choice: 'store' | 'links') => {
    setPromotionMethod(choice);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Affiliate Promotion Center
          </h1>
          <p className="text-lg text-gray-600">
            Choose how you want to promote products and earn commissions
          </p>
        </div>

        {/* Show choice selector if no method selected */}
        {!promotionMethod && user?.id && (
          <AffiliatePromotionChoice 
            affiliateId={user.id} 
            onChoiceMade={handleChoiceMade}
          />
        )}

        {/* Show appropriate interface based on choice */}
        {promotionMethod && user?.id && (
          <div className="space-y-8">
            {/* Current Mode Banner */}
            <div className={`rounded-xl p-6 ${
              promotionMethod === 'store' 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600' 
                : 'bg-gradient-to-r from-blue-600 to-cyan-600'
            } text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl">
                    {promotionMethod === 'store' ? (
                      <Store className="w-8 h-8" />
                    ) : (
                      <LinkIcon className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">
                      {promotionMethod === 'store' ? 'Full Storefront Mode' : 'Links & QR Codes Mode'}
                    </h2>
                    <p className="text-white/90">
                      {promotionMethod === 'store' 
                        ? 'Customize your branded storefront and share your custom domain'
                        : 'Generate custom affiliate links and QR codes for any product'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPromotionMethod(null)}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-semibold backdrop-blur-sm transition-all flex items-center gap-2"
                >
                  Switch Mode
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content based on mode */}
            {promotionMethod === 'store' ? (
              <>
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Store Customization</h3>
                    <p className="text-gray-600">
                      Customize your store's appearance, templates, and settings. Your store will be 
                      accessible at your custom domain or subdomain.
                    </p>
                  </div>
                  <AffiliateStoreCustomization />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-blue-600" />
                    Want links too?
                  </h4>
                  <p className="text-sm text-gray-700 mb-4">
                    Even with a store, you can still generate individual product links to share on 
                    social media, emails, or anywhere else. Just click "Switch Mode" above to access 
                    the link generator, or use both!
                  </p>
                </div>
              </>
            ) : (
              <>
                <AffiliateLinkGenerator affiliateId={user.id} />

                <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                  <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Store className="w-5 h-5 text-purple-600" />
                    Want a full store instead?
                  </h4>
                  <p className="text-sm text-gray-700 mb-4">
                    Create a complete branded storefront with your custom domain, professional templates, 
                    and all your products in one place. Click "Switch Mode" above to set up your store.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-12 bg-white rounded-xl shadow-lg border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">How It Works</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-purple-100 p-2 rounded-lg flex-shrink-0">
                  <Store className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Full Storefront</h4>
                  <p className="text-sm text-gray-600">
                    Perfect for building a brand. Get a custom domain (like yourbrand.com), 
                    choose professional templates, add custom pages, and collect messages securely. 
                    No platform branding - it's all yours.
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex items-start gap-3 mb-4">
                <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                  <LinkIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Links & QR Codes</h4>
                  <p className="text-sm text-gray-600">
                    Perfect for quick promotion. Generate custom links for any product and share 
                    them anywhere - social media, email, text messages. Download QR codes to print 
                    on flyers, business cards, or share digitally.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              💡 <strong>Pro Tip:</strong> You can switch between modes anytime! Many affiliates start 
              with links to test products, then build a full store once they find what works. Or use 
              both - run a store AND share individual product links on social media.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AffiliatePromotionPage;
