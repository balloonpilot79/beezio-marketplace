import React, { useState, useEffect } from 'react';
import { Store, Link as LinkIcon, QrCode, Check, ChevronRight, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface AffiliatePromotionChoiceProps {
  affiliateId: string;
  onChoiceMade?: (choice: 'store' | 'links') => void;
}

const AffiliatePromotionChoice: React.FC<AffiliatePromotionChoiceProps> = ({ 
  affiliateId, 
  onChoiceMade 
}) => {
  const { profile } = useAuth();
  const [currentChoice, setCurrentChoice] = useState<'store' | 'links' | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasStore, setHasStore] = useState(false);

  useEffect(() => {
    loadCurrentChoice();
  }, [affiliateId]);

  const loadCurrentChoice = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_store_settings')
        .select('promotion_method, subdomain')
        .eq('affiliate_id', affiliateId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading promotion choice:', error);
        return;
      }

      if (data) {
        setCurrentChoice(data.promotion_method || 'store');
        setHasStore(!!data.subdomain);
      }
    } catch (error) {
      console.error('Error loading promotion choice:', error);
    }
  };

  const selectChoice = async (choice: 'store' | 'links') => {
    setSaving(true);
    try {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('affiliate_store_settings')
        .select('id')
        .eq('affiliate_id', affiliateId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('affiliate_store_settings')
          .update({ promotion_method: choice })
          .eq('affiliate_id', affiliateId);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('affiliate_store_settings')
          .insert({
            affiliate_id: affiliateId,
            promotion_method: choice,
            store_enabled: choice === 'store'
          });

        if (error) throw error;
      }

      setCurrentChoice(choice);
      if (onChoiceMade) onChoiceMade(choice);
    } catch (error) {
      console.error('Error saving promotion choice:', error);
      alert('Failed to save your choice. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border border-purple-200">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-purple-600 p-2 rounded-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Choose Your Promotion Style</h2>
            <p className="text-sm text-gray-600">How do you want to promote and sell products?</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Option 1: Full Store */}
        <button
          onClick={() => selectChoice('store')}
          disabled={saving}
          className={`relative bg-white rounded-xl p-6 border-2 transition-all text-left ${
            currentChoice === 'store'
              ? 'border-purple-500 shadow-xl scale-105'
              : 'border-gray-200 hover:border-purple-300 hover:shadow-lg'
          }`}
        >
          {currentChoice === 'store' && (
            <div className="absolute top-3 right-3 bg-purple-600 text-white rounded-full p-1">
              <Check className="w-4 h-4" />
            </div>
          )}
          
          <div className="bg-purple-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
            <Store className="w-7 h-7 text-purple-600" />
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">Full Storefront</h3>
          <p className="text-sm text-gray-600 mb-4">
            Create a complete mini-website with your brand, custom domain, and products
          </p>
          
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">Custom domain (yourbrand.com)</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">Professional templates & themes</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">Contact forms & custom pages</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">No platform branding (white-label)</span>
            </div>
          </div>

          <div className="flex items-center text-purple-600 font-semibold text-sm">
            <span>Build Your Store</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </button>

        {/* Option 2: Links & QR Codes Only */}
        <button
          onClick={() => selectChoice('links')}
          disabled={saving}
          className={`relative bg-white rounded-xl p-6 border-2 transition-all text-left ${
            currentChoice === 'links'
              ? 'border-blue-500 shadow-xl scale-105'
              : 'border-gray-200 hover:border-blue-300 hover:shadow-lg'
          }`}
        >
          {currentChoice === 'links' && (
            <div className="absolute top-3 right-3 bg-blue-600 text-white rounded-full p-1">
              <Check className="w-4 h-4" />
            </div>
          )}
          
          <div className="bg-blue-100 w-14 h-14 rounded-lg flex items-center justify-center mb-4">
            <div className="relative">
              <LinkIcon className="w-6 h-6 text-blue-600" />
              <QrCode className="w-4 h-4 text-blue-600 absolute -bottom-1 -right-1" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-gray-900 mb-2">Links & QR Codes</h3>
          <p className="text-sm text-gray-600 mb-4">
            Promote products with custom affiliate links and QR codes - no store needed
          </p>
          
          <div className="space-y-2 mb-4">
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">Custom affiliate links for any product</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">Downloadable QR codes for offline promo</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">Share on social media, email, anywhere</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">Track clicks & conversions</span>
            </div>
          </div>

          <div className="flex items-center text-blue-600 font-semibold text-sm">
            <span>Generate Links</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </div>
        </button>
      </div>

      {currentChoice && (
        <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
          <div className="flex items-start gap-3">
            <div className="bg-green-100 p-2 rounded-lg">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">
                {currentChoice === 'store' ? 'Store Mode Active' : 'Link Promotion Active'}
              </h4>
              <p className="text-sm text-gray-600">
                {currentChoice === 'store'
                  ? 'You can customize your storefront, add custom pages, and set up your domain. Customers see your branded website.'
                  : 'You can generate custom links and QR codes for any product. Share them anywhere to earn commissions.'}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                💡 You can switch between modes anytime from your dashboard settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {saving && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
          <p className="text-sm text-gray-600 mt-2">Saving your choice...</p>
        </div>
      )}
    </div>
  );
};

export default AffiliatePromotionChoice;
