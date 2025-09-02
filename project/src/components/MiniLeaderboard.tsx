import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trophy, Medal, Award, TrendingUp, Crown } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  total_sales: number;
  total_commission_earned: number;
  total_points: number;
  level: number;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

interface MiniLeaderboardProps {
  timeframe?: 'week' | 'month' | 'all_time';
  metric?: 'sales' | 'commission' | 'points';
  limit?: number;
  showCurrentUser?: boolean;
}

export const MiniLeaderboard: React.FC<MiniLeaderboardProps> = ({
  timeframe = 'month',
  metric = 'points',
  limit = 5,
  showCurrentUser = true
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe, metric, limit]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);

      // For now, we'll use the affiliate_stats table since we don't have historical leaderboard data
      // In a real implementation, you'd query the leaderboard_entries table based on timeframe
      let orderBy = 'total_points';
      if (metric === 'sales') orderBy = 'total_sales';
      if (metric === 'commission') orderBy = 'total_commission_earned';

      const { data, error } = await supabase
        .from('affiliate_stats')
        .select(`
          user_id,
          total_sales,
          total_commission_earned,
          total_points,
          level,
          profiles:user_id (
            full_name,
            avatar_url
          )
        `)
        .order(orderBy, { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching leaderboard:', error);
      } else {
        setLeaderboard(data || []);
      }
    } catch (error) {
      console.error('Error in fetchLeaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">#{rank}</span>;
    }
  };

  const getMetricValue = (entry: LeaderboardEntry) => {
    switch (metric) {
      case 'sales':
        return entry.total_sales.toLocaleString();
      case 'commission':
        return `$${entry.total_commission_earned.toFixed(2)}`;
      case 'points':
        return entry.total_points.toLocaleString();
      default:
        return '0';
    }
  };

  const getMetricLabel = () => {
    switch (metric) {
      case 'sales':
        return 'Sales';
      case 'commission':
        return 'Commission';
      case 'points':
        return 'Points';
      default:
        return 'Points';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1 h-4 bg-gray-200 rounded"></div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Trophy className="w-5 h-5 text-amber-600 mr-2" />
          Top Performers
        </h3>
        <div className="flex items-center text-sm text-gray-500">
          <TrendingUp className="w-4 h-4 mr-1" />
          {getMetricLabel()}
        </div>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-8">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No data available yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.user_id}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200' :
                index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200' :
                index === 2 ? 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200' :
                'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {/* Rank */}
              <div className="flex-shrink-0">
                {getRankIcon(index + 1)}
              </div>

              {/* Avatar */}
              <div className="flex-shrink-0">
                <img
                  src={
                    entry.profiles?.avatar_url ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      entry.profiles?.full_name || 'User'
                    )}&size=32&background=random`
                  }
                  alt={entry.profiles?.full_name || 'User'}
                  className="w-8 h-8 rounded-full"
                />
              </div>

              {/* Name and Level */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {entry.profiles?.full_name || 'Anonymous User'}
                </div>
                <div className="text-xs text-gray-500">Level {entry.level}</div>
              </div>

              {/* Metric Value */}
              <div className="flex-shrink-0 text-right">
                <div className="font-semibold text-gray-900">
                  {getMetricValue(entry)}
                </div>
                {metric !== 'points' && (
                  <div className="text-xs text-gray-500">
                    {entry.total_points} pts
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeframe selector */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-center space-x-1">
          {[
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'all_time', label: 'All Time' }
          ].map((period) => (
            <button
              key={period.key}
              onClick={() => {/* This would update timeframe prop */}}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                timeframe === period.key
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              disabled // Disabled for now since we don't have historical data
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MiniLeaderboard;
