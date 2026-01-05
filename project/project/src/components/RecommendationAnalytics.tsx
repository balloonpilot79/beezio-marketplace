import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Eye, 
  ShoppingCart, 
  Star,
  Brain,
  Target,
  Zap,
  Clock,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AnalyticsData {
  totalBehaviors: number;
  uniqueUsers: number;
  uniqueSessions: number;
  conversionRate: number;
  recommendationClicks: number;
  topProducts: any[];
  behaviorTrends: any[];
  deviceBreakdown: any[];
  recommendationPerformance: any[];
}

const RecommendationAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get overall behavior statistics
      const { data: behaviorStats } = await supabase
        .from('user_behaviors')
        .select('*')
        .gte('timestamp', startDate.toISOString());

      // Get recommendation analytics view data
      const { data: recAnalytics } = await supabase
        .from('recommendation_analytics')
        .select('*')
        .gte('date', startDate.toISOString().split('T')[0]);

      // Get top performing products
      const { data: topProducts } = await supabase
        .from('user_behaviors')
        .select('product_id, products(title), count(*)')
        .not('product_id', 'is', null)
        .gte('timestamp', startDate.toISOString())
        .group('product_id, products.title')
        .order('count', { ascending: false })
        .limit(10);

      // Calculate metrics
      const totalBehaviors = behaviorStats?.length || 0;
      const uniqueUsers = new Set(behaviorStats?.filter(b => b.user_id).map(b => b.user_id)).size;
      const uniqueSessions = new Set(behaviorStats?.map(b => b.session_id)).size;
      
      const purchases = behaviorStats?.filter(b => b.behavior_type === 'purchase').length || 0;
      const views = behaviorStats?.filter(b => b.behavior_type === 'view').length || 0;
      const conversionRate = views > 0 ? (purchases / views) * 100 : 0;
      
      const recommendationClicks = behaviorStats?.filter(b => 
        b.behavior_type === 'click' && 
        (b.metadata as any)?.source?.includes('recommendation')
      ).length || 0;

      // Process behavior trends
      const behaviorTrends = recAnalytics?.reduce((acc: any[], curr) => {
        const date = curr.date;
        const existingDate = acc.find(item => item.date === date);
        
        if (existingDate) {
          existingDate[curr.behavior_type] = curr.behavior_count;
        } else {
          acc.push({
            date,
            [curr.behavior_type]: curr.behavior_count
          });
        }
        
        return acc;
      }, []) || [];

      // Device breakdown
      const deviceCounts = behaviorStats?.reduce((acc: any, behavior) => {
        const deviceType = (behavior.metadata as any)?.device_type || 'unknown';
        acc[deviceType] = (acc[deviceType] || 0) + 1;
        return acc;
      }, {});

      const deviceBreakdown = Object.entries(deviceCounts || {}).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      // Recommendation performance (mock data for now)
      const recommendationPerformance = [
        { type: 'Homepage', clicks: 245, conversions: 28, ctr: 11.4 },
        { type: 'Product Detail', clicks: 189, conversions: 34, ctr: 18.0 },
        { type: 'Cart', clicks: 67, conversions: 12, ctr: 17.9 },
        { type: 'Search', clicks: 156, conversions: 19, ctr: 12.2 }
      ];

      setAnalytics({
        totalBehaviors,
        uniqueUsers,
        uniqueSessions,
        conversionRate,
        recommendationClicks,
        topProducts: topProducts || [],
        behaviorTrends,
        deviceBreakdown,
        recommendationPerformance
      });

    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const recalculateSimilarities = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase.rpc('calculate_product_similarities');
      if (error) throw error;
      
      alert(`Successfully calculated ${data} product similarities!`);
    } catch (error) {
      console.error('Failed to recalculate similarities:', error);
      alert('Failed to recalculate similarities');
    } finally {
      setRefreshing(false);
    }
  };

  const cleanupData = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase.rpc('cleanup_recommendation_data');
      if (error) throw error;
      
      alert(`Cleaned up ${data} expired records!`);
      await loadAnalytics();
    } catch (error) {
      console.error('Failed to cleanup data:', error);
      alert('Failed to cleanup data');
    } finally {
      setRefreshing(false);
    }
  };

  const COLORS = ['#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (loading && !analytics) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Brain className="w-8 h-8 text-primary-500" />
          <h1 className="text-3xl font-bold text-gray-900">Recommendation Analytics</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          {/* Action Buttons */}
          <button
            onClick={refreshAnalytics}
            disabled={refreshing}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={recalculateSimilarities}
            disabled={refreshing}
            className="px-4 py-2 bg-secondary-500 text-white rounded-lg hover:bg-secondary-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <Zap className="w-4 h-4" />
            <span>Recalc Similarities</span>
          </button>
          
          <button
            onClick={cleanupData}
            disabled={refreshing}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            <Clock className="w-4 h-4" />
            <span>Cleanup</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Behaviors</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.totalBehaviors.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unique Users</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.uniqueUsers.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-secondary-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.conversionRate.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center">
              <Target className="w-6 h-6 text-accent-500" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rec. Clicks</p>
              <p className="text-3xl font-bold text-gray-900">{analytics?.recommendationClicks.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Behavior Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Behavior Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics?.behaviorTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="view" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="click" stroke="#f97316" strokeWidth={2} />
              <Line type="monotone" dataKey="cart_add" stroke="#ef4444" strokeWidth={2} />
              <Line type="monotone" dataKey="purchase" stroke="#10b981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Device Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics?.deviceBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics?.deviceBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendation Performance */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendation Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics?.recommendationPerformance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="clicks" fill="#f59e0b" />
            <Bar dataKey="conversions" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products Table */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Top Performing Products</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Interactions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics?.topProducts.slice(0, 10).map((product, index) => (
                <tr key={product.product_id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-semibold text-sm">{index + 1}</span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {product.products?.title || 'Unknown Product'}
                        </div>
                        <div className="text-sm text-gray-500">ID: {product.product_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{product.count} interactions</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className="bg-primary-500 h-2 rounded-full" 
                          style={{ width: `${Math.min((product.count / analytics.topProducts[0]?.count) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">
                        {Math.round((product.count / analytics.totalBehaviors) * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecommendationAnalytics;
