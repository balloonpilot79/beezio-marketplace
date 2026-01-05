/**
 * Universal Referral Tracking System
 * Tracks affiliate and fundraiser referrals via URL parameters and cookies
 */

import { supabase } from '../lib/supabase';

const REFERRAL_COOKIE_NAME = 'beezio_referral';
const FUNDRAISER_COOKIE_NAME = 'beezio_fundraiser';
const COOKIE_EXPIRY_DAYS = 30;

export interface ReferralData {
  affiliateId?: string;
  fundraiserId?: string;
  timestamp: number;
}

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/**
 * Set a cookie with expiry
 */
function setCookie(name: string, value: string, days: number) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Get a cookie value
 */
function getCookie(name: string): string | null {
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Track referral from URL parameters
 * Supports: ?ref=affiliate-id or ?fundraiser=fundraiser-id
 */
export async function trackReferralFromURL() {
  const params = new URLSearchParams(window.location.search);
  
  // Check for affiliate referral
  const affiliateRef = params.get('ref') || params.get('affiliate');
  if (affiliateRef) {
    let resolvedAffiliateId: string | null = null;

    // Canonical format: ref is a profile UUID.
    if (isUuid(affiliateRef)) {
      resolvedAffiliateId = affiliateRef;
    } else {
      // Recruitment links often use profiles.referral_code (e.g., JOHN2024) or username.
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .or(`referral_code.ilike.${affiliateRef},username.ilike.${affiliateRef},id.eq.${affiliateRef}`)
          .maybeSingle();

        if ((data as any)?.id) {
          resolvedAffiliateId = String((data as any).id);
          localStorage.setItem('affiliate_referral_code', affiliateRef);
        }
      } catch (e) {
        console.warn('[Referral] Profile referral_code lookup failed (non-fatal):', e);
      }

      // Purchase/share links may have used affiliate_links.link_code or affiliate_links.referral_code.
      if (!resolvedAffiliateId) {
        try {
          // Prefer link_code when present
          let linkRow: any = null;
          try {
            const { data } = await supabase
              .from('affiliate_links')
              .select('affiliate_id')
              .eq('link_code', affiliateRef)
              .maybeSingle();
            linkRow = data;
          } catch {
            // ignore
          }

          if (!linkRow) {
            try {
              const { data } = await supabase
                .from('affiliate_links')
                .select('affiliate_id')
                .eq('referral_code', affiliateRef)
                .maybeSingle();
              linkRow = data;
            } catch {
              // ignore
            }
          }

          if (linkRow?.affiliate_id) {
            resolvedAffiliateId = String(linkRow.affiliate_id);
            localStorage.setItem('affiliate_referral_code', affiliateRef);
          }
        } catch (e) {
          console.warn('[Referral] Affiliate link lookup failed (non-fatal):', e);
        }
      }
    }

    // Persist code param if present (used for click tracking and analytics)
    const linkCode = params.get('code');
    if (linkCode) {
      localStorage.setItem('affiliate_referral_code', linkCode);
    }

    // Only persist when we resolved to a valid profile id.
    if (resolvedAffiliateId) {
      console.log('[Referral] Tracking affiliate:', resolvedAffiliateId);
      setCookie(REFERRAL_COOKIE_NAME, resolvedAffiliateId, COOKIE_EXPIRY_DAYS);
      localStorage.setItem('affiliate_referral', resolvedAffiliateId);
    }
    
    // Track affiliate page view
    if (resolvedAffiliateId) {
      trackAffiliateView(resolvedAffiliateId);
    }
  }
  
  // Check for fundraiser referral
  const fundraiserRef = params.get('fundraiser') || params.get('fund');
  if (fundraiserRef) {
    console.log('[Referral] Tracking fundraiser:', fundraiserRef);
    setCookie(FUNDRAISER_COOKIE_NAME, fundraiserRef, COOKIE_EXPIRY_DAYS);
    localStorage.setItem('fundraiser_referral', fundraiserRef);
    
    // Track fundraiser page view
    trackFundraiserView(fundraiserRef);
  }
}

/**
 * Get current referral data
 */
export function getReferralData(): ReferralData {
  const affiliateId = getCookie(REFERRAL_COOKIE_NAME) || localStorage.getItem('affiliate_referral') || undefined;
  const fundraiserId = getCookie(FUNDRAISER_COOKIE_NAME) || localStorage.getItem('fundraiser_referral') || undefined;
  
  return {
    affiliateId,
    fundraiserId,
    timestamp: Date.now()
  };
}

/**
 * Clear referral data (e.g., after order completion)
 */
export function clearReferralData() {
  setCookie(REFERRAL_COOKIE_NAME, '', -1);
  setCookie(FUNDRAISER_COOKIE_NAME, '', -1);
  localStorage.removeItem('affiliate_referral');
  localStorage.removeItem('fundraiser_referral');
}

/**
 * Generate referral link for affiliate
 */
export function generateAffiliateLink(affiliateId: string, productId?: string): string {
  const baseUrl = window.location.origin;
  
  if (productId) {
    return `${baseUrl}/product/${productId}?ref=${affiliateId}`;
  }
  
  return `${baseUrl}/marketplace?ref=${affiliateId}`;
}

/**
 * Generate referral link for fundraiser
 */
export function generateFundraiserLink(fundraiserId: string, productId?: string): string {
  const baseUrl = window.location.origin;
  
  if (productId) {
    return `${baseUrl}/product/${productId}?fundraiser=${fundraiserId}`;
  }
  
  return `${baseUrl}/marketplace?fundraiser=${fundraiserId}`;
}

/**
 * Track affiliate view (for analytics)
 */
async function trackAffiliateView(affiliateId: string) {
  try {
    // This could call a Supabase function to increment view count
    // For now, just log it
    console.log('[Referral] Affiliate view tracked:', affiliateId);
  } catch (error) {
    console.error('Error tracking affiliate view:', error);
  }
}

/**
 * Track fundraiser view (for analytics)
 */
async function trackFundraiserView(fundraiserId: string) {
  try {
    console.log('[Referral] Fundraiser view tracked:', fundraiserId);
  } catch (error) {
    console.error('Error tracking fundraiser view:', error);
  }
}

/**
 * Get referral attribution for order
 * Returns which type of referral should get credit
 */
export function getReferralAttribution(): {
  type: 'affiliate' | 'fundraiser' | null;
  id: string | null;
} {
  const data = getReferralData();
  
  // Fundraiser takes precedence (if both exist, fundraiser wins)
  if (data.fundraiserId) {
    return { type: 'fundraiser', id: data.fundraiserId };
  }
  
  if (data.affiliateId) {
    return { type: 'affiliate', id: data.affiliateId };
  }
  
  return { type: null, id: null };
}

/**
 * Initialize referral tracking (call on app load)
 */
export function initializeReferralTracking() {
  // Track from URL on page load
  void trackReferralFromURL();
  
  // Re-track if URL changes (for SPA navigation)
  window.addEventListener('popstate', () => void trackReferralFromURL());
  
  console.log('[Referral] Tracking initialized');
}
