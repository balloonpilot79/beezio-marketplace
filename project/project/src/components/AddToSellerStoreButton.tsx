import React, { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { resolveProfileIdForUser } from '../utils/resolveProfileId';
import { addSellerStoreProduct } from '../api/sellerStore';
import { getPayoutSettingsHref, hasStoredPayoutEmail } from '../utils/payoutSetup';
import StorePlacementPicker, {
  EMPTY_STORE_PLACEMENT,
  StorePlacementSelection,
} from './StorePlacementPicker';
import { saveStoreProductPlacement } from '../utils/storeProductPlacement';

interface AddToSellerStoreButtonProps {
  productId: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon';
  addedText?: string;
  showRemove?: boolean;
}

const AddToSellerStoreButton: React.FC<AddToSellerStoreButtonProps> = ({
  productId,
  size = 'md',
  variant = 'button',
  addedText,
  showRemove = true,
}) => {
  const { profile, user, userRoles, currentRole, hasRole } = useAuth();
  const [resolvedSellerId, setResolvedSellerId] = useState<string | null>(profile?.id || null);
  const normalizedRoles = (userRoles || []).map((r) => String(r).toLowerCase());
  const role = String(profile?.primary_role || profile?.role || currentRole || '').toLowerCase();
  const isSeller = role === 'seller' || normalizedRoles.includes('seller') || hasRole?.('seller');

  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOwnerProduct, setIsOwnerProduct] = useState(false);
  const [productSellerId, setProductSellerId] = useState<string | null>(null);
  const [payoutReady, setPayoutReady] = useState(false);
  const [payoutChecked, setPayoutChecked] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [placement, setPlacement] = useState<StorePlacementSelection>({ ...EMPTY_STORE_PLACEMENT });

  useEffect(() => {
    let cancelled = false;
    const profileIsFallback = Boolean((profile as any)?.__is_fallback);
    const profileId = profile?.id;
    if (profileId && !profileIsFallback) {
      setResolvedSellerId(profileId);
      return;
    }
    if (!user?.id) {
      setResolvedSellerId(null);
      return;
    }
    void (async () => {
      const canonicalId = await resolveProfileIdForUser(user.id);
      if (!cancelled) {
        setResolvedSellerId(canonicalId || user.id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, (profile as any)?.__is_fallback, user?.id]);

  useEffect(() => {
    if (!resolvedSellerId || !isSeller) return;

    let mounted = true;
    (async () => {
      try {
        const { data: productRow, error: productError } = await supabase
          .from('products')
          .select('seller_id')
          .eq('id', productId)
          .maybeSingle();

        if (!mounted) return;
        if (productError) throw productError;
        const productSellerId = String(productRow?.seller_id || '').trim();
        setProductSellerId(productSellerId || null);
        const isOwner = Boolean(productSellerId && productSellerId === resolvedSellerId);
        setIsOwnerProduct(isOwner);
        if (isOwner) {
          // Seller-owned products are already part of the seller storefront.
          setIsAdded(true);
          return;
        }

        const { data, error } = await supabase
          .from('seller_product_order')
          .select('product_id')
          .eq('seller_id', resolvedSellerId)
          .eq('product_id', productId)
          .maybeSingle();

        if (!mounted) return;
        if (error) throw error;
        setIsAdded(Boolean(data));
      } catch (e) {
        console.error('[AddToSellerStoreButton] check failed', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [resolvedSellerId, isSeller, productId]);

  useEffect(() => {
    let cancelled = false;
    if (!isSeller || !user?.id) {
      setPayoutReady(false);
      setPayoutChecked(false);
      return;
    }

    void (async () => {
      try {
        const ready = await hasStoredPayoutEmail([resolvedSellerId, profile?.id, user?.id]);
        if (!cancelled) {
          setPayoutReady(ready);
          setPayoutChecked(true);
        }
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
  }, [isSeller, profile?.id, resolvedSellerId, user?.id]);

  const generateLinkCode = async (): Promise<string> => {
    try {
      const { data } = await supabase.rpc('generate_affiliate_link_code');
      return data || Math.random().toString(36).substring(2, 10).toUpperCase();
    } catch {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  };

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
      const { error } = await supabase.from('affiliate_links').insert(working);
      if (!error) return;
      const code = String((error as any)?.code || '').trim();
      if (code === '23505') return;
      const missing = extractMissingColumnName(String((error as any)?.message || ''));
      if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
        delete (working as any)[missing];
        continue;
      }
      break;
    }
  };

  const resolveSellerShareBase = async () => {
    if (!resolvedSellerId) {
      return { origin: window.location.origin, pathPrefix: '' };
    }
    try {
      const { data } = await supabase
        .from('store_settings')
        .select('subdomain, custom_domain')
        .eq('seller_id', resolvedSellerId)
        .maybeSingle();
      const customDomain = String(data?.custom_domain || '').trim();
      const subdomain = String(data?.subdomain || '').trim().toLowerCase();
      const origin = customDomain ? `https://${customDomain}` : window.location.origin;
      const pathPrefix = customDomain ? '' : subdomain ? `/store/${subdomain}` : '';
      return { origin, pathPrefix };
    } catch {
      return { origin: window.location.origin, pathPrefix: '' };
    }
  };

  const ensureShareLink = async () => {
    if (!resolvedSellerId) return;

    try {
      // If a link already exists, keep it.
      const { data: existing } = await supabase
        .from('affiliate_links')
        .select('*')
        .eq('affiliate_id', resolvedSellerId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing?.full_url || existing?.link_url) return;

      const linkCode = await generateLinkCode();
      const shareBase = await resolveSellerShareBase();
      const params = new URLSearchParams({ promo: '1', owner: resolvedSellerId, code: linkCode });
      if (productSellerId && productSellerId !== resolvedSellerId) {
        params.set('ref', resolvedSellerId);
        params.set('uid', resolvedSellerId);
      }
      const fullUrl = `${shareBase.origin}${shareBase.pathPrefix}/product/${productId}?${params.toString()}`;
      // Best-effort insert; handle missing columns or unique constraints gracefully.
      await insertAffiliateLink({
        affiliate_id: resolvedSellerId,
        product_id: productId,
        link_code: linkCode,
        full_url: fullUrl,
        is_active: true,
      });
    } catch (e) {
      // Non-fatal: dashboard will still generate a share URL fallback.
      console.warn('[AddToSellerStoreButton] ensureShareLink failed (non-fatal):', e);
    }
  };

  const handleAdd = async () => {
    if (isLoading) return;
    if (!resolvedSellerId || !isSeller) {
      alert('Please switch to a seller account to add products to your store.');
      return;
    }

    try {
      setIsLoading(true);

      // Prefer server endpoint (more robust than client-side RLS across deployments)
      await addSellerStoreProduct(productId, { isFeatured: placement.featureOnHomepage });

      try {
        await saveStoreProductPlacement(resolvedSellerId, productId, placement);
      } catch (placementError) {
        console.warn('[AddToSellerStoreButton] placement save failed (product remains added)', placementError);
        alert('Product added to All Products, but its additional store location could not be saved.');
      }

      // Best-effort: create a share link + QR target for the dashboard.
      await ensureShareLink();
      setIsAdded(true);
      setShowPlacementModal(false);
      if (payoutChecked && !payoutReady) {
        const shouldRedirect = window.confirm(
          'Product added to your store. You can keep selling, but payouts stay on hold until you connect PayPal. Go to payout settings now?'
        );
        if (shouldRedirect) {
          window.location.assign(getPayoutSettingsHref('seller'));
          return;
        }
      }
    } catch (e) {
      console.error('[AddToSellerStoreButton] add failed', e);
      const msg = String(e?.message || '').trim();
      alert(msg ? `Unable to add that product right now. ${msg}` : 'Unable to add that product right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    if (isLoading) return;
    if (!resolvedSellerId || !isSeller) return;

    if (!confirm('Remove this product from your seller storefront?')) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('seller_product_order')
        .delete()
        .eq('seller_id', resolvedSellerId)
        .eq('product_id', productId);

      if (error) throw error;

      // Best-effort cleanup of share link
      try {
        await supabase
          .from('affiliate_links')
          .delete()
          .eq('affiliate_id', resolvedSellerId)
          .eq('product_id', productId);
      } catch {
        // ignore
      }
      try {
        window.dispatchEvent(
          new CustomEvent('seller-products-changed', {
            detail: { productId, sellerId: resolvedSellerId },
          })
        );
      } catch {
        // ignore
      }
      setIsAdded(false);
    } catch (e) {
      console.error('[AddToSellerStoreButton] remove failed', e);
      alert('Unable to remove that product right now.');
    } finally {
      setIsLoading(false);
    }
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

  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
  const effectiveShowRemove = showRemove && !isOwnerProduct;

  if (!isSeller) return null;

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          onClick={(event) => {
            stopCardNavigationClick(event);
            if (isAdded && effectiveShowRemove) void handleRemove();
            else setShowPlacementModal(true);
          }}
          onMouseDown={stopCardNavigation}
          onPointerDown={stopCardNavigation}
          onTouchStart={stopCardNavigation}
          disabled={isLoading || (isAdded && !effectiveShowRemove)}
          title={isAdded ? 'Remove from My Store' : 'Add to My Store'}
          className={
            `h-10 w-10 rounded-full flex items-center justify-center border shadow-sm transition-colors ` +
            (isAdded
              ? effectiveShowRemove
                ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
                : 'bg-green-600 border-green-600 text-white'
              : 'bg-white border-gray-200 text-gray-900 hover:border-[#ffcb05]')
          }
        >
          {isAdded ? <Check size={iconSize} /> : <Plus size={iconSize} />}
        </button>
        {renderPlacementModal()}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          stopCardNavigationClick(event);
          if (isAdded && effectiveShowRemove) void handleRemove();
          else setShowPlacementModal(true);
        }}
        onMouseDown={stopCardNavigation}
        onPointerDown={stopCardNavigation}
        onTouchStart={stopCardNavigation}
        disabled={isLoading || (isAdded && !effectiveShowRemove)}
        className={
          `inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold border transition-colors ` +
          (isAdded
            ? effectiveShowRemove
              ? 'bg-green-600 border-green-600 text-white hover:bg-green-700'
              : 'bg-green-600 border-green-600 text-white'
            : 'bg-white border-gray-300 text-gray-900 hover:border-[#ffcb05]')
        }
      >
        {isAdded ? <Check size={iconSize} /> : <Plus size={iconSize} />}
        {isAdded ? (addedText || 'In My Store') : 'Add to Store'}
      </button>
      {renderPlacementModal()}
    </>
  );

  function renderPlacementModal() {
    if (!showPlacementModal || !resolvedSellerId) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(event) => event.stopPropagation()}>
        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="border-b border-slate-200 p-5">
            <h3 className="text-xl font-bold text-slate-900">Add product to your store</h3>
            <p className="mt-1 text-sm text-slate-600">Choose its locations now, or leave it in All Products.</p>
          </div>
          <div className="p-5">
            <StorePlacementPicker
              ownerId={resolvedSellerId}
              ownerType="seller"
              value={placement}
              onChange={setPlacement}
            />
          </div>
          <div className="flex gap-3 border-t border-slate-200 p-5">
            <button
              type="button"
              onClick={() => setShowPlacementModal(false)}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isLoading}
              className="flex-1 rounded-lg bg-[#ffcb05] px-4 py-2 font-bold text-[#131921] disabled:opacity-50"
            >
              {isLoading ? 'Adding...' : 'Add to Store'}
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default AddToSellerStoreButton;
