import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

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
  const [badgesSupported, setBadgesSupported] = useState(true);
  const hasLoggedSchemaWarningRef = useRef(false);

  const isSchemaOutOfSync = useCallback((error: any) => {
    if (!error) return false;
    const possibleCodes = new Set([
      'PGRST200',
      'PGRST201',
      'PGRST204',
      'PGRST302',
      '42P01',
      '42703',
      400,
      404,
      406
    ]);

    const code = error.code ?? error.status;
    const message = (error.message || '').toLowerCase();
    const details = (error.details || '').toLowerCase();

    if (code && possibleCodes.has(code)) {
      return true;
    }

    if (message.includes('relationship') || message.includes('does not exist')) {
      return true;
    }

    if (details.includes('relationship') || details.includes('does not exist')) {
      return true;
    }

    return false;
  }, []);

  const handleSchemaMismatch = useCallback((error: any) => {
    if (!badgesSupported) {
      return;
    }

    if (isSchemaOutOfSync(error)) {
      setBadgesSupported(false);

      if (!hasLoggedSchemaWarningRef.current) {
        console.warn(
          '[gamification] Badge tables are missing or out of sync on Supabase. Gamification features will be disabled until the migration runs.'
        );
        hasLoggedSchemaWarningRef.current = true;
      }
      return true;
    }

    return false;
  }, [badgesSupported, isSchemaOutOfSync]);

  // Check for newly earned badges
  const checkForNewBadges = useCallback(async () => {
    if (!user || !badgesSupported) return;

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
        if (!handleSchemaMismatch(error)) {
          console.error('Error fetching badges:', error);
        }
        return;
      }

      // Find badges earned since last check
      const newlyEarnedBadges = userBadges?.filter(badge => 
        !lastCheckedBadges.has(badge.badge_type_id)
      ) || [];

      if (newlyEarnedBadges.length > 0) {
        const notifications: NewBadgeNotification[] = newlyEarnedBadges
          .map(badge => {
            const badgeType = Array.isArray(badge.badge_types)
              ? badge.badge_types[0]
              : badge.badge_types;

            if (!badgeType) {
              return null;
            }

            return {
              id: badge.id,
              badge: {
                id: badge.badge_type_id,
                name: badgeType.name,
                description: badgeType.description,
                icon: badgeType.icon,
                color: badgeType.color,
                tier: badgeType.tier,
                points_reward: badgeType.points_reward
              }
            } as NewBadgeNotification;
          })
          .filter(Boolean) as NewBadgeNotification[];

        setNewBadges(prev => [...prev, ...notifications]);
      }

      // Update last checked badges
      const allBadgeIds = new Set(userBadges?.map(b => b.badge_type_id) || []);
      setLastCheckedBadges(allBadgeIds);

    } catch (error) {
      console.error('Error in checkForNewBadges:', error);
    }
  }, [user, badgesSupported, lastCheckedBadges, handleSchemaMismatch]);

  // Track affiliate activity
  const trackActivity = useCallback(async (
    activityType: 'sale' | 'referral' | 'view' | 'share',
    data?: {
      commissionAmount?: number;
      productId?: string;
    }
  ) => {
    if (!user || !badgesSupported) return;

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
        if (!handleSchemaMismatch(error)) {
          console.error('Error tracking activity:', error);
        }
        return;
      }

      // Check for new badges after activity
      await checkForNewBadges();

    } catch (error) {
      console.error('Error in trackActivity:', error);
    }
  }, [user, badgesSupported, handleSchemaMismatch, checkForNewBadges]);

  // Initialize badge checking
  useEffect(() => {
    if (user && badgesSupported) {
      checkForNewBadges();
    }
  }, [user, badgesSupported, checkForNewBadges]);

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
    if (!user || !badgesSupported) return null;

    try {
      const { data, error } = await supabase
        .from('affiliate_stats')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        if (!handleSchemaMismatch(error)) {
          console.error('Error fetching affiliate stats:', error);
        }
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getAffiliateStats:', error);
      return null;
    }
  }, [user, badgesSupported, handleSchemaMismatch]);

  return {
    newBadges,
    dismissBadge,
    trackProductView,
    trackSocialShare,
    trackSale,
    trackReferral,
    getAffiliateStats,
    checkForNewBadges,
    badgesSupported
  };
};

export default useGamification;
