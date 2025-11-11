/**
 * Custom Domain Router
 * Automatically detects when a user visits via their custom domain
 * and routes them to the correct store
 */

import { supabase } from '../lib/supabase';

export interface DomainRouteResult {
  isCustomDomain: boolean;
  storeType?: 'seller' | 'affiliate';
  userId?: string;
  storeSettings?: any;
}

/**
 * Check if current domain is a custom domain and get associated store
 */
export async function checkCustomDomain(): Promise<DomainRouteResult> {
  const currentDomain = window.location.hostname.toLowerCase();
  
  // Skip if it's the main beezio.co domain or localhost
  if (
    currentDomain === 'beezio.co' ||
    currentDomain === 'www.beezio.co' ||
    currentDomain === 'localhost' ||
    currentDomain.includes('netlify.app') ||
    currentDomain.includes('127.0.0.1')
  ) {
    return { isCustomDomain: false };
  }

  console.log('[CustomDomain] Checking domain:', currentDomain);

  try {
    // Check seller stores
    const { data: sellerStore, error: sellerError } = await supabase
      .from('store_settings')
      .select('seller_id, *')
      .eq('custom_domain', currentDomain)
      .maybeSingle();

    if (sellerError && sellerError.code !== 'PGRST116') {
      console.error('[CustomDomain] Error checking seller stores:', sellerError);
    }

    if (sellerStore) {
      console.log('[CustomDomain] Found seller store:', sellerStore.seller_id);
      return {
        isCustomDomain: true,
        storeType: 'seller',
        userId: sellerStore.seller_id,
        storeSettings: sellerStore
      };
    }

    // Check affiliate stores
    const { data: affiliateStore, error: affiliateError } = await supabase
      .from('affiliate_store_settings')
      .select('affiliate_id, *')
      .eq('custom_domain', currentDomain)
      .maybeSingle();

    if (affiliateError && affiliateError.code !== 'PGRST116') {
      console.error('[CustomDomain] Error checking affiliate stores:', affiliateError);
    }

    if (affiliateStore) {
      console.log('[CustomDomain] Found affiliate store:', affiliateStore.affiliate_id);
      return {
        isCustomDomain: true,
        storeType: 'affiliate',
        userId: affiliateStore.affiliate_id,
        storeSettings: affiliateStore
      };
    }

    // Also check subdomain (in case they pointed subdomain.beezio.co to their own domain)
    const subdomain = currentDomain.split('.')[0];
    
    const { data: subdomainSeller } = await supabase
      .from('store_settings')
      .select('seller_id, *')
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (subdomainSeller) {
      console.log('[CustomDomain] Found seller by subdomain:', subdomainSeller.seller_id);
      return {
        isCustomDomain: true,
        storeType: 'seller',
        userId: subdomainSeller.seller_id,
        storeSettings: subdomainSeller
      };
    }

    const { data: subdomainAffiliate } = await supabase
      .from('affiliate_store_settings')
      .select('affiliate_id, *')
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (subdomainAffiliate) {
      console.log('[CustomDomain] Found affiliate by subdomain:', subdomainAffiliate.affiliate_id);
      return {
        isCustomDomain: true,
        storeType: 'affiliate',
        userId: subdomainAffiliate.affiliate_id,
        storeSettings: subdomainAffiliate
      };
    }

    console.log('[CustomDomain] No custom domain mapping found');
    return { isCustomDomain: false };

  } catch (error) {
    console.error('[CustomDomain] Error checking custom domain:', error);
    return { isCustomDomain: false };
  }
}

/**
 * Get the correct store URL for a user (prioritizes custom domain)
 */
export function getStoreUrl(
  userId: string,
  storeType: 'seller' | 'affiliate',
  customDomain?: string,
  subdomain?: string
): string {
  // Priority 1: Custom domain
  if (customDomain) {
    return `https://${customDomain}`;
  }
  
  // Priority 2: Subdomain
  if (subdomain) {
    return `https://${subdomain}.beezio.co`;
  }
  
  // Priority 3: Path-based URL
  const path = storeType === 'seller' ? 'store' : 'affiliate';
  return `${window.location.origin}/${path}/${userId}`;
}
