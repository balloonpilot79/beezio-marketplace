import { supabase } from '../lib/supabase';

/**
 * Track when someone clicks an affiliate link
 */
export const trackAffiliateClick = async (linkCodeOrReferralCode: string) => {
  try {
    // Best-effort lookup across schema variants.
    let linkData: any = null;

    // Prefer link_code (current schema)
    try {
      const { data } = await supabase
        .from('affiliate_links')
        .select('*')
        .eq('link_code', linkCodeOrReferralCode)
        .maybeSingle();
      linkData = data;
    } catch {
      // ignore
    }

    // Fallback: referral_code (older schema)
    if (!linkData) {
      try {
        const { data } = await supabase
          .from('affiliate_links')
          .select('*')
          .eq('referral_code', linkCodeOrReferralCode)
          .maybeSingle();
        linkData = data;
      } catch {
        // ignore
      }
    }

    if (!linkData) return null;

    // Track the click (best-effort; table may not exist in all schemas)
    try {
      await supabase.from('link_clicks').insert({
        affiliate_link_id: (linkData as any).id,
        ip_address: '',
        user_agent: navigator.userAgent,
        referrer: document.referrer,
      });
    } catch {
      // ignore
    }

    // Increment click count (best-effort across column names)
    try {
      const currentClicksCount = Number((linkData as any).clicks_count);
      const currentClicks = Number((linkData as any).clicks);
      if (Number.isFinite(currentClicksCount)) {
        await supabase
          .from('affiliate_links')
          .update({ clicks_count: currentClicksCount + 1 })
          .eq('id', (linkData as any).id);
      } else if (Number.isFinite(currentClicks)) {
        await supabase
          .from('affiliate_links')
          .update({ clicks: currentClicks + 1 })
          .eq('id', (linkData as any).id);
      }
    } catch {
      // ignore
    }

    // Store in session/cookie for checkout
    sessionStorage.setItem('affiliate_ref', linkCodeOrReferralCode);
    sessionStorage.setItem('affiliate_id', (linkData as any).affiliate_id);

    return (linkData as any).affiliate_id;
  } catch (error) {
    console.error('Error tracking affiliate click:', error);
    return null;
  }
};

/**
 * Get stored affiliate reference from session
 */
export const getAffiliateRef = (): { code: string | null; id: string | null } => {
  return {
    code: sessionStorage.getItem('affiliate_ref'),
    id: sessionStorage.getItem('affiliate_id')
  };
};

/**
 * Clear affiliate reference (e.g., after successful order)
 */
export const clearAffiliateRef = () => {
  sessionStorage.removeItem('affiliate_ref');
  sessionStorage.removeItem('affiliate_id');
};

