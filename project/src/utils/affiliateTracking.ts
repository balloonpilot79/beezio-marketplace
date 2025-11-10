import { supabase } from '../lib/supabase';

/**
 * Track when someone clicks an affiliate link
 */
export const trackAffiliateClick = async (referralCode: string) => {
  try {
    // Get affiliate link ID
    const { data: linkData } = await supabase
      .from('affiliate_links')
      .select('id, affiliate_id')
      .eq('referral_code', referralCode)
      .single();

    if (!linkData) return null;

    // Track the click
    await supabase.from('link_clicks').insert({
      affiliate_link_id: linkData.id,
      ip_address: '',
      user_agent: navigator.userAgent,
      referrer: document.referrer
    });

    // Increment click count
    await supabase
      .from('affiliate_links')
      .update({ clicks: linkData.clicks + 1 })
      .eq('id', linkData.id);

    // Store in session/cookie for checkout
    sessionStorage.setItem('affiliate_ref', referralCode);
    sessionStorage.setItem('affiliate_id', linkData.affiliate_id);

    return linkData.affiliate_id;
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

