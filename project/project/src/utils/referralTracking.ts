/**
 * Affiliate Referral Tracking System
 * Tracks affiliate referrals via URL parameters and cookies
 */

import { supabase } from '../lib/supabase';

const REFERRAL_COOKIE_NAME = 'beezio_referral';
const REFERRAL_RAW_COOKIE_NAME = 'bz_ref';
const COOKIE_EXPIRY_DAYS = 90;
const REFERRAL_STORAGE_KEY = 'affiliate_referral';
const REFERRAL_RAW_STORAGE_KEY = 'bz_ref';
const LEGACY_REFERRAL_STORAGE_KEY = 'affiliate_ref';

export interface ReferralData {
  affiliateId?: string;
  timestamp: number;
}

const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const clearReferralIdentityStorage = () => {
  setCookie(REFERRAL_COOKIE_NAME, '', -1);
  setCookie(REFERRAL_RAW_COOKIE_NAME, '', -1);
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  localStorage.removeItem(LEGACY_REFERRAL_STORAGE_KEY);
  localStorage.removeItem(REFERRAL_RAW_STORAGE_KEY);
  localStorage.removeItem('affiliate_referral_code');
};

async function resolveAffiliateProfileId(supabaseClient: any, rawCandidate: string): Promise<string | null> {
  const candidate = String(rawCandidate || '').trim();
  if (!candidate) return null;

  let resolvedId = candidate;
  if (!isUuid(candidate)) {
    try {
      const { data } = await supabaseClient
        .from('profiles')
        .select('id')
        .or(`id.eq.${candidate},user_id.eq.${candidate}`)
        .maybeSingle();
      if ((data as any)?.id) {
        resolvedId = String((data as any).id).trim();
      }
    } catch {
      return null;
    }
  }

  try {
    const [{ data: profileRow }, { data: affiliateSettingsRow }] = await Promise.all([
      supabaseClient
        .from('profiles')
        .select('id, role, primary_role')
        .eq('id', resolvedId)
        .maybeSingle(),
      supabaseClient
        .from('affiliate_store_settings')
        .select('affiliate_id')
        .eq('affiliate_id', resolvedId)
        .maybeSingle(),
    ]);

    const role = String((profileRow as any)?.role || '').trim().toLowerCase();
    const primaryRole = String((profileRow as any)?.primary_role || '').trim().toLowerCase();
    const hasAffiliateRole =
      role === 'affiliate' ||
      role === 'partner' ||
      primaryRole === 'affiliate' ||
      primaryRole === 'partner';

    if (hasAffiliateRole || String((affiliateSettingsRow as any)?.affiliate_id || '').trim()) {
      return resolvedId;
    }
  } catch {
    return null;
  }

  return null;
}

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

function persistRawReferralCode(code: string) {
  const trimmed = String(code || '').trim();
  if (!trimmed) return;
  setCookie(REFERRAL_RAW_COOKIE_NAME, trimmed, COOKIE_EXPIRY_DAYS);
  localStorage.setItem(REFERRAL_RAW_STORAGE_KEY, trimmed);
}

function migrateLegacyReferralId() {
  const legacy = String(localStorage.getItem(LEGACY_REFERRAL_STORAGE_KEY) || '').trim();
  if (!legacy || !isUuid(legacy)) return null;

  const existing = String(localStorage.getItem(REFERRAL_STORAGE_KEY) || '').trim();
  if (!existing) {
    localStorage.setItem(REFERRAL_STORAGE_KEY, legacy);
  }
  if (!getCookie(REFERRAL_COOKIE_NAME)) {
    setCookie(REFERRAL_COOKIE_NAME, legacy, COOKIE_EXPIRY_DAYS);
  }
  return legacy;
}

function hydrateRawReferralCode() {
  const cookieValue = getCookie(REFERRAL_RAW_COOKIE_NAME);
  const storageValue = localStorage.getItem(REFERRAL_RAW_STORAGE_KEY);
  if (cookieValue && cookieValue !== storageValue) {
    localStorage.setItem(REFERRAL_RAW_STORAGE_KEY, cookieValue);
  } else if (!cookieValue && storageValue) {
    setCookie(REFERRAL_RAW_COOKIE_NAME, storageValue, COOKIE_EXPIRY_DAYS);
  }
}

async function resolveAffiliateIdFromToken(affiliateRef: string): Promise<string | null> {
  if (!affiliateRef) return null;
  if (isUuid(affiliateRef)) {
    return await resolveAffiliateProfileId(supabase, affiliateRef);
  }

  // Recruitment links often use profiles.referral_code (e.g., JOHN2024) or username.
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or(`referral_code.ilike.${affiliateRef},username.ilike.${affiliateRef},id.eq.${affiliateRef}`)
      .maybeSingle();

    if ((data as any)?.id) {
      localStorage.setItem('affiliate_referral_code', affiliateRef);
      return await resolveAffiliateProfileId(supabase, String((data as any).id));
    }
  } catch (e) {
    console.warn('[Referral] Profile referral_code lookup failed (non-fatal):', e);
  }

  // Public affiliate links now prefer the affiliate store slug/subdomain.
  try {
    const { data } = await supabase
      .from('affiliate_store_settings')
      .select('affiliate_id')
      .eq('subdomain', affiliateRef.toLowerCase())
      .maybeSingle();

    if ((data as any)?.affiliate_id) {
      localStorage.setItem('affiliate_referral_code', affiliateRef);
      return await resolveAffiliateProfileId(supabase, String((data as any).affiliate_id));
    }
  } catch (e) {
    console.warn('[Referral] Affiliate store slug lookup failed (non-fatal):', e);
  }

  // Purchase/share links may have used affiliate_links.link_code or affiliate_links.referral_code.
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
      localStorage.setItem('affiliate_referral_code', affiliateRef);
      return await resolveAffiliateProfileId(supabase, String(linkRow.affiliate_id));
    }
  } catch (e) {
    console.warn('[Referral] Affiliate link lookup failed (non-fatal):', e);
  }

  return null;
}

/**
 * Track referral from URL parameters
 * Supports: ?ref=affiliate-id
 */
export async function trackReferralFromURL() {
  const params = new URLSearchParams(window.location.search);

  hydrateRawReferralCode();

  // Check for referral from URL first, then persisted storage/cookie.
  const urlReferralToken = params.get('ref') || params.get('affiliate');
  const persistedReferralToken = localStorage.getItem(REFERRAL_RAW_STORAGE_KEY) || getCookie(REFERRAL_RAW_COOKIE_NAME);
  const promoterUserId = String(params.get('uid') || '').trim();
  const affiliateRef = String(urlReferralToken || persistedReferralToken || '').trim();

  if (affiliateRef) {
    if (urlReferralToken) persistRawReferralCode(affiliateRef);
    let resolvedAffiliateId = await resolveAffiliateIdFromToken(affiliateRef);

    // Persist code param if present (used for click tracking and analytics)
    const linkCode = params.get('code');
    if (linkCode) {
      localStorage.setItem('affiliate_referral_code', linkCode);
    }

    // Some direct product links carry the sharer profile in `uid`.
    // Use it as a fallback when the public `ref` token cannot be resolved locally.
    if (!resolvedAffiliateId && promoterUserId) {
      resolvedAffiliateId = await resolveAffiliateProfileId(supabase, promoterUserId);
    }

    // Only persist when we resolved to a valid profile id.
    if (resolvedAffiliateId) {
      console.log('[Referral] Tracking affiliate:', resolvedAffiliateId);
      setCookie(REFERRAL_COOKIE_NAME, resolvedAffiliateId, COOKIE_EXPIRY_DAYS);
      localStorage.setItem(REFERRAL_STORAGE_KEY, resolvedAffiliateId);
      // Backward compatibility for legacy pages that still read this key.
      localStorage.setItem(LEGACY_REFERRAL_STORAGE_KEY, resolvedAffiliateId);
      if (promoterUserId) {
        sessionStorage.setItem('affiliate_id', resolvedAffiliateId);
      }
    } else {
      clearReferralIdentityStorage();
    }
    
    // Track affiliate page view
    if (resolvedAffiliateId) {
      trackAffiliateView(resolvedAffiliateId);
    }
  }
}

/**
 * Get current referral data
 */
export function getReferralData(): ReferralData {
  const migrated = migrateLegacyReferralId();
  const sessionAffiliateId =
    typeof window !== 'undefined'
      ? String(window.sessionStorage.getItem('affiliate_id') || '').trim()
      : '';
  const affiliateId =
    getCookie(REFERRAL_COOKIE_NAME) ||
    localStorage.getItem(REFERRAL_STORAGE_KEY) ||
    sessionAffiliateId ||
    migrated ||
    undefined;
  
  return {
    affiliateId,
    timestamp: Date.now()
  };
}

/**
 * Clear referral data (e.g., after order completion)
 */
export function clearReferralData() {
  setCookie(REFERRAL_COOKIE_NAME, '', -1);
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  localStorage.removeItem(LEGACY_REFERRAL_STORAGE_KEY);
}

/**
 * Generate referral link for affiliate
 */
export function generateAffiliateLink(affiliateId: string, productId?: string, promoterUserId?: string): string {
  const baseUrl = window.location.origin;
  const uid = promoterUserId || affiliateId;
  
  if (productId) {
    return `${baseUrl}/product/${productId}?ref=${encodeURIComponent(affiliateId)}&uid=${encodeURIComponent(uid)}`;
  }
  
  return `${baseUrl}/marketplace?ref=${encodeURIComponent(affiliateId)}&uid=${encodeURIComponent(uid)}`;
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
 * Get referral attribution for order
 * Returns which type of referral should get credit
 */
export function getReferralAttribution(): {
  type: 'affiliate' | null;
  id: string | null;
} {
  const data = getReferralData();
  
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

  const onLocationChange = () => void trackReferralFromURL();
  window.addEventListener('popstate', onLocationChange);

  // SPA navigation often uses pushState/replaceState without popstate.
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args as any);
    window.dispatchEvent(new Event('beezio:location-change'));
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args as any);
    window.dispatchEvent(new Event('beezio:location-change'));
    return result;
  };
  window.addEventListener('beezio:location-change', onLocationChange);

  console.log('[Referral] Tracking initialized');
}
