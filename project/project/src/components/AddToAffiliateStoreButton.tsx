import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Plus, Check, Star, TrendingUp, Link as LinkIcon, Copy, ExternalLink, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';

interface AddToAffiliateStoreButtonProps {
  productId: string;
  sellerId: string;
  productTitle: string;
  productPrice: number;
  defaultCommissionRate: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon' | 'card';
  ctaText?: string;
}

const AddToAffiliateStoreButton: React.FC<AddToAffiliateStoreButtonProps> = ({
  productId,
  sellerId,
  productTitle,
  productPrice,
  defaultCommissionRate,
  size = 'md',
  variant = 'button',
  ctaText,
}) => {
  const { user, profile, userRoles, currentRole, hasRole } = useAuth();
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [affiliateLink, setAffiliateLink] = useState('');
  const [minimumBuyerPrice, setMinimumBuyerPrice] = useState<number | null>(null);
  const [customSettings, setCustomSettings] = useState({
    customCommissionRate: defaultCommissionRate,
    customPrice: productPrice,
    isFeatured: false,
    affiliateDescription: '',
    notes: ''
  });

  // Check if user is affiliate or fundraiser and if they already added this product
  const role = String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase();
  const normalizedRoles = (userRoles || []).map(r => String(r).toLowerCase());
  const isFundraiser = role === 'fundraiser' || normalizedRoles.includes('fundraiser') || hasRole('fundraiser');
  const isAffiliate =
    isFundraiser ||
    role === 'affiliate' ||
    normalizedRoles.includes('affiliate') ||
    hasRole('affiliate');
  const affiliateProfileId = (profile as any)?.id || user?.id;
  const isOwnProduct = Boolean(
    (affiliateProfileId && affiliateProfileId === sellerId) ||
    (user?.id && user.id === sellerId)
  );

  useEffect(() => {
    if (affiliateProfileId && isAffiliate) {
      checkIfAdded(affiliateProfileId);
    }
  }, [affiliateProfileId, productId, isAffiliate]);

  useEffect(() => {
    if (!showModal) return;

    let cancelled = false;
    const loadCanonicalPrice = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('price,seller_ask,seller_amount,seller_ask_price,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount')
          .eq('id', productId)
          .maybeSingle();

        if (cancelled) return;
        if (error || !data) {
          setMinimumBuyerPrice(productPrice);
          return;
        }

        const buyerPrice = getBuyerFacingProductPrice(data as any);
        setMinimumBuyerPrice(buyerPrice);

        // Default the curated storefront price to the buyer-facing price.
        // Do not allow setting a lower price that would bypass Beezio fees.
        setCustomSettings((prev) => ({
          ...prev,
          customPrice: buyerPrice > 0 ? buyerPrice : prev.customPrice,
        }));
      } catch (e) {
        console.warn('AddToAffiliateStoreButton: failed to load canonical product price (non-fatal):', e);
        setMinimumBuyerPrice(productPrice);
      }
    };

    loadCanonicalPrice();
    return () => {
      cancelled = true;
    };
  }, [showModal, productId, productPrice]);

  const checkIfAdded = async (currentAffiliateId: string) => {
    try {
      if (isFundraiser) {
        const { data } = await supabase
          .from('fundraiser_products')
          .select('id')
          .eq('fundraiser_id', currentAffiliateId)
          .eq('product_id', productId)
          .maybeSingle();
        setIsAdded(!!data);
        return;
      }

      // Canonical affiliate store listings live in affiliate_products.
      const { data } = await supabase
        .from('affiliate_products')
        .select('id')
        .eq('affiliate_id', currentAffiliateId)
        .eq('product_id', productId)
        .maybeSingle();

      setIsAdded(Boolean(data));
    } catch (error) {
      console.error('Error checking affiliate product status:', error);
    }
  };

  const handleAddToStore = async () => {
    if (!user || !isAffiliate) {
      alert('Please sign up as an affiliate to promote products!');
      return;
    }

    if (isOwnProduct) {
      alert('You cannot promote your own products as an affiliate!');
      return;
    }

    if (!affiliateProfileId) {
      alert('We could not find your affiliate profile. Please refresh and try again.');
      return;
    }

    setShowModal(true);
  };

  const handleConfirmAdd = async () => {
    if (!affiliateProfileId) {
      alert('We could not find your affiliate profile. Please refresh and try again.');
      return;
    }

    setIsLoading(true);
    try {
      if (isFundraiser) {
        // Fundraiser storefront reads fundraiser_products
        const { error } = await supabase
          .from('fundraiser_products')
          .upsert(
            {
              fundraiser_id: affiliateProfileId,
              product_id: productId,
              custom_description: customSettings.affiliateDescription || null,
              display_order: 0,
              is_featured: customSettings.isFeatured,
            },
            { onConflict: 'fundraiser_id,product_id' }
          );

        if (error) {
          if ((error as any).code === '23505') {
            alert('You already have this product in your fundraiser store!');
          } else {
            throw error;
          }
          setIsLoading(false);
          return;
        }
      } else {
        // Canonical affiliate store listing.
        const { error: addError } = await supabase
          .from('affiliate_products')
          .upsert(
            {
              affiliate_id: affiliateProfileId,
              product_id: productId,
              display_order: 0,
              is_featured: customSettings.isFeatured,
            },
            { onConflict: 'affiliate_id,product_id' }
          );

        if (addError) {
          if ((addError as any).code === '23505') {
            alert('You already have this product in your store!');
          } else {
            throw addError;
          }
          setIsLoading(false);
          return;
        }
      }

      // Generate trackable link (affiliates + fundraisers both use ref attribution)
      const linkCode = await generateLinkCode();
      const { data: linkData, error: linkError } = await supabase
        .from('affiliate_links')
        .insert({
          affiliate_id: affiliateProfileId,
          product_id: productId,
          link_code: linkCode,
          full_url: `${window.location.origin}/product/${productId}?ref=${affiliateProfileId}&code=${linkCode}`,
          is_active: true
        })
        .select()
        .single();

      if (!linkError && linkData) {
        setAffiliateLink(linkData.full_url);
      }

      setIsAdded(true);
      setShowModal(false);
      setShowSuccessModal(true);

      // Track event
      await supabase.from('integration_logs').insert({
        integration_id: null,
        action: 'add_to_affiliate_store',
        status: 'success',
        products_imported: 1,
        metadata: {
          product_id: productId,
          affiliate_id: affiliateProfileId,
          commission_rate: customSettings.customCommissionRate
        }
      });

    } catch (error) {
      console.error('Error adding product:', error);
      alert('Failed to add product to your store. Please try again.');
    }
    setIsLoading(false);
  };

  const handleRemoveFromStore = async () => {
    if (!affiliateProfileId) {
      alert('We could not find your affiliate profile. Please refresh and try again.');
      return;
    }

    if (!confirm('Remove this product from your store?')) return;

    setIsLoading(true);
    try {
      if (isFundraiser) {
        const { error } = await supabase
          .from('fundraiser_products')
          .delete()
          .eq('fundraiser_id', affiliateProfileId)
          .eq('product_id', productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('affiliate_products')
          .delete()
          .eq('affiliate_id', affiliateProfileId)
          .eq('product_id', productId);
        if (error) throw error;
      }

      setIsAdded(false);
      alert('Product removed from your store');
    } catch (error) {
      console.error('Error removing product:', error);
      alert('Failed to remove product');
    }
    setIsLoading(false);
  };

  const generateLinkCode = async (): Promise<string> => {
    const { data } = await supabase.rpc('generate_affiliate_link_code');
    return data || Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const copyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    alert('Affiliate link copied to clipboard!');
  };

  // Never show on own products
  if (isOwnProduct) {
    return null;
  }

  // Show a clear CTA for non-affiliates so there is always an “accept/add” path visible.
  if (!isAffiliate) {
    if (variant === 'icon') return null;

    const label = size === 'sm' ? 'Become an Affiliate' : 'Become an Affiliate to Add';

    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.assign('/start-earning');
        }}
        className={`w-full rounded-lg border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 transition-colors ${
          size === 'sm'
            ? 'px-3 py-2 text-xs font-semibold'
            : size === 'lg'
              ? 'px-6 py-3 text-base font-semibold'
              : 'px-4 py-2 text-sm font-semibold'
        }`}
      >
        {label}
      </button>
    );
  }

  // Button variants
  const buttonSizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isAdded) {
              void handleRemoveFromStore();
            } else {
              void handleAddToStore();
            }
          }}
          disabled={isLoading}
          className={`p-2 rounded-full transition-all ${
            isAdded
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          } disabled:opacity-50`}
          title={isAdded ? 'Remove from my store' : 'Add to my store'}
        >
          {isAdded ? <X className={iconSizes[size]} /> : <Plus className={iconSizes[size]} />}
        </button>
        {renderModals()}
      </>
    );
  }

  if (variant === 'card') {
    return (
      <>
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="bg-purple-500 rounded-full p-2">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">Promote This Product</h3>
              <p className="text-sm text-gray-600 mb-3">
                Earn {defaultCommissionRate}% commission on every sale!
              </p>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isAdded) {
                    void handleRemoveFromStore();
                  } else {
                    void handleAddToStore();
                  }
                }}
                disabled={isLoading}
                className={`w-full ${buttonSizes[size]} rounded-lg font-semibold transition-all shadow-sm ${
                  isAdded
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                } disabled:opacity-50`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </span>
                ) : isAdded ? (
                  <span className="flex items-center justify-center gap-2">
                    <X className="w-4 h-4" />
                    Remove from My Store
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add to My Store
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
        {renderModals()}
      </>
    );
  }

  // Default button variant
  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isAdded) {
            void handleRemoveFromStore();
          } else {
            void handleAddToStore();
          }
        }}
        disabled={isLoading}
        className={`${buttonSizes[size]} rounded-lg font-semibold transition-all shadow-sm flex items-center gap-2 ${
          isAdded
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
        } disabled:opacity-50`}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Processing...
          </>
        ) : isAdded ? (
          <>
            <X className={iconSizes[size]} />
            Remove from My Store
          </>
        ) : (
          <>
            <Plus className={iconSizes[size]} />
            {ctaText || 'Promote Product'}
          </>
        )}
      </button>
      {renderModals()}
    </>
  );

  function renderModals() {
    return (
      <>
        {/* Configuration Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b bg-gradient-to-r from-purple-500 to-pink-500">
                <h3 className="text-2xl font-bold text-white">Add Product to Your Store</h3>
                <p className="text-purple-100 mt-1">Configure your promotion settings</p>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Product Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{productTitle}</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Original Price:</span>
                    <span className="font-bold text-gray-900">${productPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Default Commission:</span>
                    <span className="font-bold text-green-600">{defaultCommissionRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Your Earnings:</span>
                    <span className="font-bold text-purple-600">
                      ${(productPrice * (defaultCommissionRate / 100)).toFixed(2)} per sale
                    </span>
                  </div>
                </div>

                {/* Commission Rate Override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={customSettings.customCommissionRate}
                    onChange={(e) => setCustomSettings(prev => ({ 
                      ...prev, 
                      customCommissionRate: parseFloat(e.target.value) || 0 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You'll earn ${((customSettings.customPrice || productPrice) * (customSettings.customCommissionRate / 100)).toFixed(2)} per sale
                  </p>
                </div>

                {/* Custom Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Price (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customSettings.customPrice}
                    onChange={(e) => setCustomSettings(prev => ({ 
                      ...prev, 
                      customPrice: parseFloat(e.target.value) || 0 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave at ${productPrice.toFixed(2)} or set your own price
                  </p>
                </div>

                {/* Featured */}
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={customSettings.isFeatured}
                      onChange={(e) => setCustomSettings(prev => ({ 
                        ...prev, 
                        isFeatured: e.target.checked 
                      }))}
                      className="rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="font-medium text-gray-900">
                      <Star className="w-4 h-4 inline text-yellow-500 mr-1" />
                      Feature this product in my store
                    </span>
                  </label>
                </div>

                {/* Custom Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Description (Optional)
                  </label>
                  <textarea
                    value={customSettings.affiliateDescription}
                    onChange={(e) => setCustomSettings(prev => ({ 
                      ...prev, 
                      affiliateDescription: e.target.value 
                    }))}
                    placeholder="Add your own marketing copy..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                {/* Private Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Private Notes (Only you can see)
                  </label>
                  <textarea
                    value={customSettings.notes}
                    onChange={(e) => setCustomSettings(prev => ({ 
                      ...prev, 
                      notes: e.target.value 
                    }))}
                    placeholder="Track your promotion strategy..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="p-6 border-t flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAdd}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-semibold disabled:opacity-50"
                >
                  {isLoading ? 'Adding...' : 'Add to My Store'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Product Added!</h3>
                <p className="text-gray-600 mb-6">
                  {productTitle} is now in your store and ready to promote
                </p>

                {affiliateLink && (
                  <div className="bg-purple-50 rounded-lg p-4 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Affiliate Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={affiliateLink}
                        readOnly
                        className="flex-1 px-3 py-2 border border-purple-200 rounded-lg bg-white text-sm font-mono"
                      />
                      <button
                        onClick={copyLink}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center justify-center">
                      <div className="bg-white p-3 rounded-lg border border-purple-200">
                        <QRCodeSVG value={affiliateLink} size={112} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => window.open(`/affiliate/${affiliateProfileId ?? user?.id ?? ''}`, '_blank')}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View My Store
                  </button>
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
};

export default AddToAffiliateStoreButton;
