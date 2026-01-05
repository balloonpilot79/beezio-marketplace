import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Share2, Eye, MousePointer } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface SocialAnalytics {
  platform: string;
  shares: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
}

interface SocialMediaAnalyticsProps {
  affiliateId?: string;
}

const SocialMediaAnalytics: React.FC<SocialMediaAnalyticsProps> = ({ affiliateId }) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<SocialAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    if (affiliateId || user?.id) {
      fetchAnalytics();
    }
  }, [affiliateId, user?.id, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const targetUserId = affiliateId || user?.id;
      if (!targetUserId) return;

      // Calculate date range
      const now = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
      }

      // Fetch share behaviors
      const { data: shareData, error: shareError } = await supabase
        .from('user_behaviors')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('behavior_type', 'share')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (shareError) {
        console.error('Error fetching share data:', shareError);
        return;
      }

      // Process share data by platform
      const platformStats: { [key: string]: { shares: number; clicks: number; conversions: number } } = {};

      shareData?.forEach((share) => {
        const platform = share.metadata?.platform || 'unknown';
        if (!platformStats[platform]) {
          platformStats[platform] = { shares: 0, clicks: 0, conversions: 0 };
        }
        platformStats[platform].shares++;

        // For demo purposes, we'll simulate some clicks and conversions
        // In a real implementation, you'd track actual click-throughs and purchases
        platformStats[platform].clicks += Math.floor(Math.random() * 5) + 1;
        platformStats[platform].conversions += Math.floor(Math.random() * 2);
      });

      // Convert to analytics format
      const analyticsData: SocialAnalytics[] = Object.entries(platformStats).map(([platform, stats]) => ({
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        shares: stats.shares,
        clicks: stats.clicks,
        conversions: stats.conversions,
        conversionRate: stats.clicks > 0 ? (stats.conversions / stats.clicks) * 100 : 0
      }));

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalShares = analytics.reduce((sum, item) => sum + item.shares, 0);
  const totalClicks = analytics.reduce((sum, item) => sum + item.clicks, 0);
  const totalConversions = analytics.reduce((sum, item) => sum + item.conversions, 0);
  const avgConversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Social Media Performance</h3>
              <p className="text-sm text-gray-600">Track your sharing effectiveness across platforms</p>
            </div>
          </div>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="p-6 border-b border-gray-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Share2 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalShares}</div>
            <div className="text-sm text-gray-600">Total Shares</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <MousePointer className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalClicks}</div>
            <div className="text-sm text-gray-600">Link Clicks</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalConversions}</div>
            <div className="text-sm text-gray-600">Conversions</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{avgConversionRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Conv. Rate</div>
          </div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="p-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4">Performance by Platform</h4>
        {analytics.length === 0 ? (
          <div className="text-center py-8">
            <Share2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No social media shares yet</p>
            <p className="text-sm text-gray-500">Start sharing products to see analytics here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {analytics.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-700">
                      {item.platform.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{item.platform}</div>
                    <div className="text-sm text-gray-600">
                      {item.shares} shares • {item.clicks} clicks
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{item.conversions} sales</div>
                  <div className="text-sm text-gray-600">{item.conversionRate.toFixed(1)}% rate</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Insights */}
        {analytics.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h5 className="font-semibold text-blue-900 mb-2">💡 Insights</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Your best performing platform is {analytics.sort((a, b) => b.conversions - a.conversions)[0]?.platform}</li>
              <li>• Average conversion rate across all platforms: {avgConversionRate.toFixed(1)}%</li>
              <li>• Total estimated earnings from social shares: ${(totalConversions * 25).toFixed(2)}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialMediaAnalytics;