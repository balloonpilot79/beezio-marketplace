import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  points_reward: number;
}

interface NewBadgeNotification {
  badge: Badge;
  id: string;
}

export const useGamification = () => {
  const { user } = useAuth();
  const [newBadges, setNewBadges] = useState<NewBadgeNotification[]>([]);
  const [lastCheckedBadges, setLastCheckedBadges] = useState<Set<string>>(new Set());

  // Track affiliate activity
  const trackActivity = useCallback(async (
    activityType: 'sale' | 'referral' | 'view' | 'share',
    data?: {
      commissionAmount?: number;
      productId?: string;
    }
  ) => {
    if (!user) return;

    try {
      // Call the update_affiliate_stats function
      const { error } = await supabase.rpc('update_affiliate_stats', {
        p_user_id: user.id,
        p_commission_amount: data?.commissionAmount || 0,
        p_is_referral: activityType === 'referral',
        p_product_view: activityType === 'view',
        p_social_share: activityType === 'share'
      });

      if (error) {
        console.error('Error tracking activity:', error);
        return;
      }

      // Check for new badges after activity
      await checkForNewBadges();

    } catch (error) {
      console.error('Error in trackActivity:', error);
    }
  }, [user]);

  // Check for newly earned badges
  const checkForNewBadges = useCallback(async () => {
    if (!user) return;

    try {
      const { data: userBadges, error } = await supabase
        .from('user_badges')
        .select(`
          id,
          badge_type_id,
          earned_at,
          badge_types:badge_type_id (
            name,
            description,
            icon,
            color,
            tier,
            points_reward
          )
        `)
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (error) {
        console.error('Error fetching badges:', error);
        return;
      }

      // Find badges earned since last check
      const newlyEarnedBadges = userBadges?.filter(badge => 
        !lastCheckedBadges.has(badge.badge_type_id)
      ) || [];

      if (newlyEarnedBadges.length > 0) {
        const notifications: NewBadgeNotification[] = newlyEarnedBadges.map(badge => ({
          id: badge.id,
          badge: {
            id: badge.badge_type_id,
            name: badge.badge_types.name,
            description: badge.badge_types.description,
            icon: badge.badge_types.icon,
            color: badge.badge_types.color,
            tier: badge.badge_types.tier,
            points_reward: badge.badge_types.points_reward
          }
        }));

        setNewBadges(prev => [...prev, ...notifications]);
      }

      // Update last checked badges
      const allBadgeIds = new Set(userBadges?.map(b => b.badge_type_id) || []);
      setLastCheckedBadges(allBadgeIds);

    } catch (error) {
      console.error('Error in checkForNewBadges:', error);
    }
  }, [user, lastCheckedBadges]);

  // Initialize badge checking
  useEffect(() => {
    if (user) {
      checkForNewBadges();
    }
  }, [user]);

  // Track product views when affiliate links are used
  const trackProductView = useCallback(async (productId: string) => {
    await trackActivity('view', { productId });
  }, [trackActivity]);

  // Track social shares
  const trackSocialShare = useCallback(async (productId?: string) => {
    await trackActivity('share', { productId });
  }, [trackActivity]);

  // Track sales (should be called when a sale is completed)
  const trackSale = useCallback(async (commissionAmount: number) => {
    await trackActivity('sale', { commissionAmount });
  }, [trackActivity]);

  // Track referrals (should be called when someone signs up with referral code)
  const trackReferral = useCallback(async () => {
    await trackActivity('referral');
  }, [trackActivity]);

  // Dismiss a badge notification
  const dismissBadge = useCallback((badgeId: string) => {
    setNewBadges(prev => prev.filter(notification => notification.id !== badgeId));
  }, []);

  // Get current affiliate stats
  const getAffiliateStats = useCallback(async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('affiliate_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching affiliate stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getAffiliateStats:', error);
      return null;
    }
  }, [user]);

  return {
    newBadges,
    dismissBadge,
    trackProductView,
    trackSocialShare,
    trackSale,
    trackReferral,
    getAffiliateStats,
    checkForNewBadges
  };
};

export default useGamification;
