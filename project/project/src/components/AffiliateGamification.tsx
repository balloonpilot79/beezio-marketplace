import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import BadgeDisplay from './BadgeDisplay';
import { 
  TrendingUp, Target, Flame, Star, Users, Eye, Share2, 
  Award, Trophy, BarChart3, Calendar, Gift 
} from 'lucide-react';

interface AffiliateStats {
  user_id: string;
  total_sales: number;
  total_commission_earned: number;
  total_referrals: number;
  current_streak_days: number;
  longest_streak_days: number;
  total_product_views: number;
  total_social_shares: number;
  total_points: number;
  level: number;
  last_sale_date?: string;
}

interface BadgeWithType {
  id: string;
  badge_type_id: string;
  earned_at: string;
  progress_value: number;
  badge_types: {
    name: string;
    description: string;
    icon: string;
    color: string;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    requirement_value: number;
    points_reward: number;
  };
}

interface BadgeType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  requirement_type: string;
  requirement_value: number;
  points_reward: number;
}

export const AffiliateGamification: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [earnedBadges, setEarnedBadges] = useState<BadgeWithType[]>([]);
  const [availableBadges, setAvailableBadges] = useState<BadgeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'leaderboard'>('overview');
  const [badgesSupported, setBadgesSupported] = useState(true);
  const [schemaMessageShown, setSchemaMessageShown] = useState(false);

  const isSchemaOutOfSync = (error: any) => {
    if (!error) return false;
    const code = error.code ?? error.status;
    const message = (error.message || '').toLowerCase();
    const details = (error.details || '').toLowerCase();

    const schemaCodes = new Set([
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

    if (code && schemaCodes.has(code)) {
      return true;
    }

    if (message.includes('relationship') || message.includes('does not exist')) {
      return true;
    }

    if (details.includes('relationship') || details.includes('does not exist')) {
      return true;
    }

    return false;
  };

  const handleSchemaMismatch = (error: any, logLabel: string) => {
    if (isSchemaOutOfSync(error)) {
      if (badgesSupported) {
        setBadgesSupported(false);
      }

      if (!schemaMessageShown) {
        console.warn(`[gamification] ${logLabel}: Supabase badges schema not found. Gamification UI will be disabled until migrations are applied.`);
        setSchemaMessageShown(true);
      }

      return true;
    }

    return false;
  };

  useEffect(() => {
    if (user) {
      fetchGamificationData();
    }
  }, [user]);

  const fetchGamificationData = async () => {
    let schemaMismatchDetected = false;

    try {
      // Fetch affiliate stats
      const { data: statsData, error: statsError } = await supabase
        .from('affiliate_stats')
        .select('*')
        .eq('user_id', user!.id)
        .single();

      if (statsError && statsError.code !== 'PGRST116') {
        if (!handleSchemaMismatch(statsError, 'Error fetching stats')) {
          console.error('Error fetching stats:', statsError);
        } else {
          schemaMismatchDetected = true;
        }
      } else {
        setStats(statsData);
      }

      // Fetch earned badges
      if (badgesSupported && !schemaMismatchDetected) {
        const { data: badgesData, error: badgesError } = await supabase
          .from('user_badges')
          .select(`
            *,
            badge_types:badge_type_id (*)
          `)
          .eq('user_id', user!.id)
          .order('earned_at', { ascending: false });

        if (badgesError) {
          if (!handleSchemaMismatch(badgesError, 'Error fetching badges')) {
            console.error('Error fetching badges:', badgesError);
          } else {
            schemaMismatchDetected = true;
          }
        } else {
          setEarnedBadges(badgesData || []);
        }
      }

      // Fetch all available badge types
      if (badgesSupported && !schemaMismatchDetected) {
        const { data: badgeTypesData, error: badgeTypesError } = await supabase
          .from('badge_types')
          .select('*')
          .eq('is_active', true)
          .order('requirement_value', { ascending: true });

        if (badgeTypesError) {
          if (!handleSchemaMismatch(badgeTypesError, 'Error fetching badge types')) {
            console.error('Error fetching badge types:', badgeTypesError);
          } else {
            schemaMismatchDetected = true;
          }
        } else {
          setAvailableBadges(badgeTypesData || []);
        }
      }
    } catch (error) {
      console.error('Error in fetchGamificationData:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressForBadge = (badgeType: BadgeType): number => {
    if (!stats) return 0;
    
    switch (badgeType.requirement_type) {
      case 'sales_count':
        return stats.total_sales;
      case 'commission_earned':
        return Math.floor(stats.total_commission_earned);
      case 'referrals':
        return stats.total_referrals;
      case 'streak_days':
        return stats.current_streak_days;
      case 'product_views':
        return stats.total_product_views;
      case 'social_shares':
        return stats.total_social_shares;
      default:
        return 0;
    }
  };

  const isBadgeEarned = (badgeTypeId: string): boolean => {
    return earnedBadges.some(badge => badge.badge_type_id === badgeTypeId);
  };

  const getLevelProgress = (): number => {
    if (!stats) return 0;
    const pointsForCurrentLevel = (stats.level - 1) * 1000;
    const pointsForNextLevel = stats.level * 1000;
    const currentLevelProgress = stats.total_points - pointsForCurrentLevel;
    return (currentLevelProgress / 1000) * 100;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!badgesSupported) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Affiliate gamification coming soon</h3>
        <p className="text-gray-600">
          We couldn&apos;t load the badges tables from Supabase. Run the latest migrations to unlock levels, leaderboards, and badges.
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Start Your Affiliate Journey!</h3>
        <p className="text-gray-600">Make your first sale to begin earning badges and climbing the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Level and Points */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Level {stats.level} Affiliate</h2>
            <p className="text-amber-100">{stats.total_points.toLocaleString()} Total Points</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{earnedBadges.length}</div>
            <div className="text-amber-100">Badges Earned</div>
          </div>
        </div>
        
        {/* Level Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-amber-100 mb-1">
            <span>Level {stats.level}</span>
            <span>Level {stats.level + 1}</span>
          </div>
          <div className="w-full bg-amber-700 rounded-full h-2">
            <div 
              className="bg-white rounded-full h-2 transition-all duration-300"
              style={{ width: `${getLevelProgress()}%` }}
            />
          </div>
          <div className="text-xs text-amber-100 mt-1">
            {1000 - (stats.total_points % 1000)} points to next level
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'badges', label: 'Badges', icon: Award },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-amber-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total_sales}</div>
                <div className="text-gray-600">Total Sales</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">${stats.total_commission_earned.toFixed(2)}</div>
                <div className="text-gray-600">Commission Earned</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Flame className="w-8 h-8 text-orange-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.current_streak_days}</div>
                <div className="text-gray-600">Current Streak</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total_referrals}</div>
                <div className="text-gray-600">Referrals</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Eye className="w-8 h-8 text-indigo-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total_product_views.toLocaleString()}</div>
                <div className="text-gray-600">Product Views</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Share2 className="w-8 h-8 text-pink-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.total_social_shares}</div>
                <div className="text-gray-600">Social Shares</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Star className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stats.longest_streak_days}</div>
                <div className="text-gray-600">Longest Streak</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-gray-600" />
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.last_sale_date ? new Date(stats.last_sale_date).toLocaleDateString() : 'Never'}
                </div>
                <div className="text-gray-600">Last Sale</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'badges' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Badge Collection</h3>
          
          {/* Earned Badges */}
          {earnedBadges.length > 0 && (
            <div className="mb-8">
              <h4 className="text-md font-medium text-gray-700 mb-4 flex items-center">
                <Trophy className="w-5 h-5 mr-2 text-amber-600" />
                Earned Badges ({earnedBadges.length})
              </h4>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                {earnedBadges.map((badge) => (
                  <BadgeDisplay
                    key={badge.id}
                    badge={{
                      id: badge.badge_type_id,
                      name: badge.badge_types.name,
                      description: badge.badge_types.description,
                      icon: badge.badge_types.icon,
                      color: badge.badge_types.color,
                      tier: badge.badge_types.tier,
                      earned_at: badge.earned_at
                    }}
                    size="lg"
                    isEarned={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Available Badges */}
          <div>
            <h4 className="text-md font-medium text-gray-700 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-gray-600" />
              Available Badges
            </h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
              {availableBadges
                .filter(badgeType => !isBadgeEarned(badgeType.id))
                .map((badgeType) => (
                  <BadgeDisplay
                    key={badgeType.id}
                    badge={{
                      id: badgeType.id,
                      name: badgeType.name,
                      description: badgeType.description,
                      icon: badgeType.icon,
                      color: badgeType.color,
                      tier: badgeType.tier,
                      progress_value: getProgressForBadge(badgeType),
                      requirement_value: badgeType.requirement_value
                    }}
                    size="lg"
                    isEarned={false}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
            <Gift className="w-6 h-6 text-amber-600" />
          </div>
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Top Affiliates This Month</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border">
                <div className="flex items-center">
                  <span className="text-yellow-600 text-xl mr-3">🥇</span>
                  <div>
                    <div className="font-medium">SalesChamp2024</div>
                    <div className="text-sm text-gray-600">$12,450 earned</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-yellow-600">156 sales</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center">
                  <span className="text-gray-600 text-xl mr-3">🥈</span>
                  <div>
                    <div className="font-medium">MarketingPro</div>
                    <div className="text-sm text-gray-600">$8,920 earned</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-600">134 sales</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border">
                <div className="flex items-center">
                  <span className="text-orange-600 text-xl mr-3">🥉</span>
                  <div>
                    <div className="font-medium">CommissionKing</div>
                    <div className="text-sm text-gray-600">$6,780 earned</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-orange-600">89 sales</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AffiliateGamification;
