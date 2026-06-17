import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { Plus, Check, Star, TrendingUp, Link as LinkIcon, Copy, ExternalLink, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getBuyerFacingProductPrice } from '../utils/buyerPrice';
import { ensureProfileIdForUser, resolveProfileIdForUser } from '../utils/resolveProfileId';
import { addAffiliateProduct } from '../api/affiliateStore';
import { getPayoutSettingsHref, hasStoredPayoutEmail } from '../utils/payoutSetup';
import { getNormalizedAccountRoles, normalizeAccountRole } from '../utils/accountRoles';

interface AddToAffiliateStoreButtonProps {
  productId: string;
  sellerId: string;
  productTitle: string;
  productPrice: number;
  defaultCommissionRate: number;
  commissionType?: 'percentage' | 'flat_rate';
  flatCommissionAmount?: number;
  productImage?: string;
  productCategory?: string;
  productDescription?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon' | 'card';
  ctaText?: string;
  addedText?: string;
  showRemove?: boolean;
  instantAdd?: boolean;
}

const AddToAffiliateStoreButton: React.FC<AddToAffiliateStoreButtonProps> = ({
  productId,
  sellerId,
  productTitle,
  productPrice,
  defaultCommissionRate,
  commissionType = 'percentage',
  flatCommissionAmount = 0,
  productImage = '',
  productCategory = '',
  productDescription = '',
  size = 'md',
  variant = 'button',
  ctaText,
  addedText,
  showRemove = true,
  instantAdd = false,
}) => {
  const { user, profile, userRoles, currentRole, hasRole } = useAuth();
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [affiliateLink, setAffiliateLink] = useState('');
  const [minimumBuyerPrice, setMinimumBuyerPrice] = useState<number | null>(null);
  const [resolvedAffiliateId, setResolvedAffiliateId] = useState<string>('');
  const [payoutReady, setPayoutReady] = useState<boolean>(false);
  const [payoutChecked, setPayoutChecked] = useState<boolean>(false);
  const [customSettings, setCustomSettings] = useState({
    isFeatured: false,
    affiliateDescription: '',
    notes: ''
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const commissionDisplayLabel =
    commissionType === 'flat_rate'
      ? `$${Number(flatCommissionAmount || 0).toFixed(2)} per sale`
      : `${Number(defaultCommissionRate || 0)}%`;
  const commissionEarningsPreview =
    commissionType === 'flat_rate'
      ? Number(flatCommissionAmount || 0)
      : (minimumBuyerPrice ?? productPrice) * (defaultCommissionRate / 100);

  // Check if user is affiliate and if they already added this product
  const role = normalizeAccountRole(profile?.primary_role || profile?.role || currentRole);
  const normalizedRoles = getNormalizedAccountRoles(userRoles);
  const isAffiliate =
    role === 'affiliate' ||
    normalizedRoles.includes('affiliate') ||
    hasRole('affiliate') ||
    hasRole('partner');
  const affiliateProfileId = resolvedAffiliateId;

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setResolvedAffiliateId('');
      return;
    }
    const profileId = (profile as any)?.id;
    const profileIsFallback = Boolean((profile as any)?.__is_fallback);
    if (profileId && !profileIsFallback) {
      setResolvedAffiliateId(profileId);
      return;
    }
    void (async () => {
      const canonicalId = await resolveProfileIdForUser(user.id);
      if (!cancelled) {
        setResolvedAffiliateId(canonicalId || user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, (profile as any)?.id, (profile as any)?.__is_fallback]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setPayoutReady(false);
      setPayoutChecked(false);
      return;
    }

    const candidateOwnerIds = Array.from(
      new Set(
        [user.id, resolvedAffiliateId, profile?.id, profile?.user_id]
          .filter(Boolean)
          .map((value) => String(value).trim())
          .filter((value) => value.length > 0)
      )
    );
    if (!candidateOwnerIds.length) {
      setPayoutReady(false);
      setPayoutChecked(true);
      return;
    }

    (async () => {
      try {
        const hasPayoutEmail = await hasStoredPayoutEmail(candidateOwnerIds);
        if (cancelled) return;
        setPayoutReady(hasPayoutEmail);
        setPayoutChecked(true);
      } catch {
        if (!cancelled) {
          setPayoutReady(false);
          setPayoutChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, resolvedAffiliateId, profile?.id]);

  const extractMissingColumnName = (message: string): string | null => {
    const msg = String(message || '');
    const pg = msg.match(/column\s+"([^"]+)"\s+of\s+relation\s+"[^"]+"\s+does\s+not\s+exist/i);
    if (pg?.[1]) return pg[1];
    const pgDot = msg.match(/column\s+([a-z0-9_]+\.[a-z0-9_]+)\s+does\s+not\s+exist/i);
    if (pgDot?.[1]) return pgDot[1].split('.').pop() || pgDot[1];
    const pgrst = msg.match(/Could not find the '([^']+)' column of '[^']+' in the schema cache/i);
    if (pgrst?.[1]) return pgrst[1];
    return null;
  };

  const insertAffiliateLink = async (payload: Record<string, any>) => {
    let working = { ...payload };
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await supabase
        .from('affiliate_links')
        .insert(working)
        .select('*')
        .maybeSingle();
      if (!error) return data;
      const code = String((error as any)?.code || '').trim();
      if (code === '23505') return null;
      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
        delete (working as any)[missing];
        continue;
      }
      break;
    }
    return null;
  };

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
          .select('price,seller_ask,seller_amount,seller_ask_price,commission_rate,affiliate_commission_rate,commission_type,flat_commission_amount,affiliate_commission_type,affiliate_commission_value')
          .eq('id', productId)
          .maybeSingle();

        if (cancelled) return;
        if (error || !data) {
          setMinimumBuyerPrice(productPrice);
          return;
        }

        const buyerPrice = getBuyerFacingProductPrice(data as any);
        setMinimumBuyerPrice(buyerPrice);

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
      const candidateIds = Array.from(
        new Set([currentAffiliateId, user?.id].filter(Boolean).map(String))
      );
      const { data } = await supabase
        .from('affiliate_products')
        .select('id, affiliate_id')
        .in('affiliate_id', candidateIds)
        .eq('product_id', productId)
        .maybeSingle();

      setIsAdded(Boolean(data));
    } catch (error) {
      console.error('Error checking affiliate product status:', error);
    }
  };

  const resolveEffectiveAffiliateId = async (): Promise<string> => {
    const current = String(resolvedAffiliateId || affiliateProfileId || '').trim();
    if (current) return current;
    const ensured = user ? await ensureProfileIdForUser(user as any) : '';
    const nextId = String(ensured || '').trim();
    if (nextId && nextId !== resolvedAffiliateId) {
      setResolvedAffiliateId(nextId);
    }
    return nextId;
  };

  const handleAddToStore = async () => {
    if (isLoading) return;
    if (!user || !isAffiliate) {
      alert('Please sign up as a partner to promote products!');
      return;
    }

    const effectiveId = await resolveEffectiveAffiliateId();
    if (!effectiveId) {
      alert('We could not find your partner profile. Please refresh and try again.');
      return;
    }

    if (instantAdd) {
      await handleConfirmAdd({ silent: true });
      return;
    }

    setShowModal(true);
  };

  const handleConfirmAdd = async (options?: { silent?: boolean }) => {
    if (isLoading) return;
    const effectiveIdFromSession = await resolveEffectiveAffiliateId();
    if (!effectiveIdFromSession) {
      alert('We could not find your partner profile. Please refresh and try again.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const resolvedId = effectiveIdFromSession || resolvedAffiliateId || affiliateProfileId;
      const ensureId = resolvedId || (user ? await ensureProfileIdForUser(user) : '');
      if (ensureId && ensureId !== resolvedAffiliateId) {
        setResolvedAffiliateId(ensureId);
      }

      if (!ensureId) {
        alert('We could not find your partner profile. Please refresh and try again.');
        setIsLoading(false);
        return;
      }

      let addResult;
      try {
        addResult = await addAffiliateProduct(productId, {
          isFeatured: customSettings.isFeatured,
          affiliateId: ensureId || affiliateProfileId,
        });
      } catch (err: any) {
        let msg = 'Failed to add product: ';
        if (err && typeof err === 'object') {
          if (err.message) msg += err.message;
          if (err.details) msg += '\nDetails: ' + err.details;
        } else {
          msg += String(err || 'Unknown error');
        }
        setErrorMessage(msg);
        setIsLoading(false);
        alert(msg);
        return;
      }
      const effectiveAffiliateId = String(addResult.affiliate_id || ensureId || affiliateProfileId || '').trim();
      if (effectiveAffiliateId && effectiveAffiliateId !== resolvedAffiliateId) {
        setResolvedAffiliateId(effectiveAffiliateId);
      }

      setIsAdded(true);
      setShowModal(false);
      if (!options?.silent) {
        setShowSuccessModal(true);
      }

      try {
        // Generate trackable link (affiliate attribution) without blocking the add flow.
        const promoterUserId = user?.id || affiliateProfileId;
        const shareBase = await resolveAffiliateShareBase(effectiveAffiliateId);
        const effectiveIdForLink = String(effectiveAffiliateId || resolvedAffiliateId || affiliateProfileId || '').trim();
        const publicToken = String(shareBase.publicToken || effectiveIdForLink).trim();
        const linkCode = await generateLinkCode(publicToken, productId);
        if (effectiveIdForLink) {
          const fullUrl = `${shareBase.origin}${shareBase.pathPrefix}/product/${productId}?ref=${encodeURIComponent(publicToken)}&uid=${encodeURIComponent(String(promoterUserId))}&code=${encodeURIComponent(publicToken)}`;
          try {
            const linkData = await insertAffiliateLink({
              affiliate_id: effectiveIdForLink,
              product_id: productId,
              link_code: linkCode,
              full_url: fullUrl,
              is_active: true
            });
            setAffiliateLink(String(linkData?.full_url || fullUrl));
          } catch {
            setAffiliateLink(fullUrl);
          }
        }
      } catch (linkError) {
        console.warn('AddToAffiliateStoreButton: share-link generation failed (non-fatal):', linkError);
      }

      try {
        const storageKey = `affiliate_products_${user.id}`;
        const existing = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
        const rows = Array.isArray(existing) ? existing : [];
        const withoutCurrent = rows.filter((entry: any) => String(entry?.productId || '') !== String(productId));
        window.localStorage.setItem(
          storageKey,
          JSON.stringify([
            ...withoutCurrent,
            {
              productId,
              selected: true,
              dateAdded: new Date().toISOString(),
              product: {
                id: productId,
                title: productTitle,
                description: productDescription,
                price: minimumBuyerPrice ?? productPrice,
                commission_rate: defaultCommissionRate,
                commission_type: commissionType === 'flat_rate' ? 'fixed' : 'percentage',
                flat_commission_amount: flatCommissionAmount,
                seller_id: sellerId,
                category: productCategory || 'General',
                image_url: productImage,
                images: productImage ? [productImage] : [],
              },
            },
          ])
        );
      } catch {
        // Local fallback is best-effort only; the database insert above is the source of truth.
      }
      if (payoutChecked && !payoutReady) {
        const shouldRedirect = window.confirm(
          'Product added to your store. You can keep promoting, but payouts stay on hold until you connect PayPal. Go to payout settings now?'
        );
        if (shouldRedirect) {
          window.location.assign(getPayoutSettingsHref('affiliate'));
          return;
        }
      }

      // Tracking should never turn a successful product add into a visible failure.
      try {
        await supabase.from('integration_logs').insert({
          integration_id: null,
          action: 'add_to_affiliate_store',
          status: 'success',
          products_imported: 1,
          metadata: {
            product_id: productId,
            affiliate_id: effectiveAffiliateId || affiliateProfileId,
            commission_rate: defaultCommissionRate
          }
        });
      } catch (loggingError) {
        console.warn('AddToAffiliateStoreButton: integration log insert failed (non-fatal):', loggingError);
      }

    } catch (error: any) {
      setErrorMessage(error instanceof Error ? error.message : 'Product failed to import from marketplace.');
      alert('Failed to add product: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromStore = async () => {
    if (isLoading) return;
    const effectiveId = await resolveEffectiveAffiliateId();
    if (!effectiveId) {
      alert('We could not find your partner profile. Please refresh and try again.');
      return;
    }

    if (!confirm('Remove this product from your store?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('affiliate_products')
        .delete()
        .eq('affiliate_id', effectiveId)
        .eq('product_id', productId);
      if (error) throw error;

      setIsAdded(false);
      alert('Product removed from your store');
    } catch (error) {
      console.error('Error removing product:', error);
      alert('Failed to remove product');
    }
    setIsLoading(false);
  };

  const generateLinkCode = async (publicToken: string, currentProductId: string): Promise<string> => {
    const cleanToken = String(publicToken || '').trim().toLowerCase();
    const cleanProductId = String(currentProductId || '').trim().slice(0, 8).toLowerCase();
    return cleanToken && cleanProductId ? `${cleanToken}-${cleanProductId}` : cleanToken || cleanProductId || 'affiliate-link';
  };

  const resolveAffiliateShareBase = async (affiliateIdOverride?: string) => {
    const activeAffiliateId = String(affiliateIdOverride || affiliateProfileId || '').trim();
    if (!activeAffiliateId) {
      return { origin: window.location.origin, pathPrefix: '', publicToken: activeAffiliateId };
    }
    try {
      const { data } = await supabase
        .from('affiliate_store_settings')
        .select('subdomain, custom_domain')
        .eq('affiliate_id', activeAffiliateId)
        .maybeSingle();
      const customDomain = String(data?.custom_domain || '').trim();
      const subdomain = String(data?.subdomain || '').trim().toLowerCase();
      const origin = customDomain ? `https://${customDomain}` : window.location.origin;
      const pathPrefix = customDomain ? '' : subdomain ? `/store/${subdomain}` : '';
      return { origin, pathPrefix, publicToken: subdomain || activeAffiliateId };
    } catch {
      return { origin: window.location.origin, pathPrefix: '', publicToken: activeAffiliateId };
    }
  };

  const resolveAffiliateStoreDestination = async (affiliateIdOverride?: string) => {
    const activeAffiliateId = String(affiliateIdOverride || resolvedAffiliateId || affiliateProfileId || user?.id || '').trim();
    if (!activeAffiliateId) return '/dashboard?section=affiliate&tab=products';

    try {
      const { data } = await supabase
        .from('affiliate_store_settings')
        .select('subdomain, custom_domain')
        .eq('affiliate_id', activeAffiliateId)
        .maybeSingle();

      const customDomain = String(data?.custom_domain || '').trim();
      if (customDomain) {
        return `https://${customDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
      }

      const subdomain = String(data?.subdomain || '').trim().toLowerCase();
      if (subdomain) {
        return `/store/${subdomain}`;
      }
    } catch {
      // Fallback route below keeps the storefront reachable without custom setup.
    }

    return `/partner/${encodeURIComponent(activeAffiliateId)}`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    alert('Partner link copied to clipboard!');
  };

  const stopCardNavigation = (
    event:
      | React.MouseEvent<HTMLButtonElement>
      | React.PointerEvent<HTMLButtonElement>
      | React.TouchEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
  };

  const stopCardNavigationClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // Show a clear CTA for non-affiliates so there is always an “accept/add” path visible.
  if (!isAffiliate) {
    if (variant === 'icon') return null;

    const label = size === 'sm' ? 'Become a Partner' : 'Become a Partner to Add';

    return (
      <button
        onClick={(e) => {
          stopCardNavigationClick(e);
          window.location.assign('/start-earning');
        }}
        onMouseDown={stopCardNavigation}
        onPointerDown={stopCardNavigation}
        onTouchStart={stopCardNavigation}
        type="button"
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
          type="button"
          onClick={(e) => {
            stopCardNavigationClick(e);
            if (isAdded && showRemove) {
              void handleRemoveFromStore();
            } else {
              void handleAddToStore();
            }
          }}
          onMouseDown={stopCardNavigation}
          onPointerDown={stopCardNavigation}
          onTouchStart={stopCardNavigation}
          disabled={isLoading || (isAdded && !showRemove)}
          className={`p-2 rounded-full transition-all ${
            isAdded
              ? showRemove
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-green-600 text-white'
              : 'bg-purple-500 text-white hover:bg-purple-600'
          } disabled:opacity-50`}
          title={isAdded ? 'Remove from my store' : 'Promote this product in my store'}
        >
          {isAdded ? (showRemove ? <X className={iconSizes[size]} /> : <Check className={iconSizes[size]} />) : <Plus className={iconSizes[size]} />}
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
                {commissionType === 'flat_rate'
                  ? `Earn $${Number(flatCommissionAmount || 0).toFixed(2)} on every sale!`
                  : `Earn ${defaultCommissionRate}% commission on every sale!`}
              </p>
              <p className="text-xs text-purple-700 mb-3">Promoting this product also adds it to your custom store.</p>
          <button
            type="button"
            onClick={(e) => {
              stopCardNavigationClick(e);
              if (isAdded && showRemove) {
                void handleRemoveFromStore();
              } else {
                void handleAddToStore();
              }
            }}
            onMouseDown={stopCardNavigation}
            onPointerDown={stopCardNavigation}
            onTouchStart={stopCardNavigation}
            disabled={isLoading || (isAdded && !showRemove)}
                className={`w-full ${buttonSizes[size]} rounded-lg font-semibold transition-all shadow-sm ${
                  isAdded
                    ? showRemove
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-green-600 text-white'
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
                    {showRemove ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    {showRemove ? 'Remove from My Store' : (addedText || 'In My Store')}
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    Promote This Product
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
        type="button"
        onClick={(e) => {
          stopCardNavigationClick(e);
          if (isAdded && showRemove) {
            void handleRemoveFromStore();
          } else {
            void handleAddToStore();
          }
        }}
        onMouseDown={stopCardNavigation}
        onPointerDown={stopCardNavigation}
        onTouchStart={stopCardNavigation}
        disabled={isLoading || (isAdded && !showRemove)}
        className={`${buttonSizes[size]} rounded-lg font-semibold transition-all shadow-sm flex items-center gap-2 ${
          isAdded
            ? showRemove
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-green-600 text-white'
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
            {showRemove ? <X className={iconSizes[size]} /> : <Check className={iconSizes[size]} />}
            {showRemove ? 'Remove from My Store' : (addedText || 'In My Store')}
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
                <h3 className="text-2xl font-bold text-white">Promote Product in Your Store</h3>
                <p className="text-purple-100 mt-1">Configure your promotion settings and add it to your custom store</p>
              </div>
              
              <div className="p-6 space-y-6">
                {errorMessage && (
                  <div className="mb-2 p-2 bg-red-100 text-red-700 rounded">
                    {errorMessage}
                  </div>
                )}
                {/* Product Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{productTitle}</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Original Price:</span>
                    <span className="font-bold text-gray-900">${productPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Default Commission:</span>
                    <span className="font-bold text-green-600">{commissionDisplayLabel}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600">Your Earnings:</span>
                    <span className="font-bold text-purple-600">
                      ${commissionEarningsPreview.toFixed(2)} per sale
                    </span>
                  </div>
                </div>

                {/* Commission Rate Override */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {commissionType === 'flat_rate' ? 'Commission payout ($)' : 'Commission rate (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={commissionType === 'flat_rate' ? undefined : '100'}
                    value={commissionType === 'flat_rate' ? Number(flatCommissionAmount || 0) : defaultCommissionRate}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You'll earn ${commissionEarningsPreview.toFixed(2)} per sale
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
                    value={minimumBuyerPrice ?? productPrice}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-700"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Price is set by the seller for all partners
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
                  {isLoading ? 'Adding...' : 'Promote This Product'}
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
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Product Ready to Promote!</h3>
                <p className="text-gray-600 mb-6">
                  {productTitle} is now in your custom store and ready to promote
                </p>

                {affiliateLink && (
                  <div className="bg-purple-50 rounded-lg p-4 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Partner Link
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    onClick={() => {
                      void (async () => {
                        const destination = await resolveAffiliateStoreDestination();
                        window.open(destination, '_blank');
                      })();
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View My Store
                  </button>
                  <button
                    onClick={() => {
                      setShowSuccessModal(false);
                      window.location.assign('/dashboard?section=affiliate&tab=products');
                    }}
                    className="px-4 py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors font-medium"
                  >
                    Open Dashboard
                  </button>
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all font-semibold"
                  >
                    Keep Adding
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
