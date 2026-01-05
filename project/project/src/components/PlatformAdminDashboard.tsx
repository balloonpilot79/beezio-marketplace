import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Users, Package, BarChart3, Download, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ContentModerationDashboard from './ContentModerationDashboard';

interface PlatformStats {
  total_revenue: number;
  monthly_revenue: number;
  total_users: number;
  active_sellers: number;
  total_transactions: number;
  pending_payouts: number;
}

interface RevenueData {
  month_year: string;
  revenue: number;
}

interface TopSeller {
  user_id: string;
  full_name: string;
  total_earned: number;
  total_sales: number;
}

interface PendingPayout {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  amount: number;
  days_pending: number;
}

export default function PlatformAdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [topSellers, setTopSellers] = useState<TopSeller[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'payouts' | 'analytics' | 'moderation'>('overview');

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const fetchPlatformData = async () => {
    try {
      setLoading(true);

      // Fetch platform statistics
      const [
        revenueResult,
        usersResult,
        transactionsResult,
        pendingPayoutsResult
      ] = await Promise.all([
        supabase.from('platform_revenue').select('amount').gte('created_at', new Date(new Date().getFullYear(), 0, 1).toISOString()),
        supabase.from('profiles').select('id, role').eq('role', 'seller'),
        supabase.from('transactions').select('id').eq('status', 'completed'),
        supabase.from('user_earnings').select('current_balance').gt('current_balance', 0)
      ]);

      const totalRevenue = revenueResult.data?.reduce((sum, item) => sum + item.amount, 0) || 0;
      const totalUsers = usersResult.data?.length || 0;
      const totalTransactions = transactionsResult.data?.length || 0;
      const pendingPayoutsAmount = pendingPayoutsResult.data?.reduce((sum, item) => sum + item.current_balance, 0) || 0;

      // Get current month revenue
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: monthlyRevenueData } = await supabase
        .from('platform_revenue')
        .select('amount')
        .eq('month_year', currentMonth);

      const monthlyRevenue = monthlyRevenueData?.reduce((sum, item) => sum + item.amount, 0) || 0;

      setStats({
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        total_users: totalUsers,
        active_sellers: totalUsers,
        total_transactions: totalTransactions,
        pending_payouts: pendingPayoutsAmount
      });

      // Fetch revenue trend data (last 12 months)
      const { data: revenueDataResult } = await supabase
        .from('platform_revenue')
        .select('month_year, amount')
        .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('month_year', { ascending: true });

      // Group by month and sum amounts
      const revenueMap = new Map<string, number>();
      revenueDataResult?.forEach(item => {
        const current = revenueMap.get(item.month_year) || 0;
        revenueMap.set(item.month_year, current + item.amount);
      });

      const revenueChart = Array.from(revenueMap.entries()).map(([month, revenue]) => ({
        month_year: month,
        revenue
      }));

      setRevenueData(revenueChart);

      // Fetch top sellers
      const { data: topSellersData } = await supabase
        .from('user_earnings')
        .select(`
          user_id,
          total_earned,
          profiles!inner(full_name)
        `)
        .eq('role', 'seller')
        .order('total_earned', { ascending: false })
        .limit(10);

      const formattedTopSellers = topSellersData?.map(seller => ({
        user_id: seller.user_id,
        full_name: seller.profiles?.[0]?.full_name || 'Unknown',
        total_earned: seller.total_earned,
        total_sales: 0 // Would need to calculate from transactions
      })) || [];

      setTopSellers(formattedTopSellers);

      // Fetch pending payouts
      const { data: pendingPayoutsData } = await supabase
        .from('user_earnings')
        .select(`
          user_id,
          current_balance,
          role,
          updated_at,
          profiles!inner(full_name, email)
        `)
        .gt('current_balance', 0)
        .order('current_balance', { ascending: false });

      const formattedPendingPayouts = pendingPayoutsData?.map(payout => ({
        user_id: payout.user_id,
        full_name: payout.profiles?.[0]?.full_name || 'Unknown',
        email: payout.profiles?.[0]?.email || 'No email',
        role: payout.role,
        amount: payout.current_balance,
        days_pending: Math.floor((Date.now() - new Date(payout.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      })) || [];

      setPendingPayouts(formattedPendingPayouts);

    } catch (error) {
      console.error('Error fetching platform data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const processBulkPayout = async () => {
    if (!confirm('Are you sure you want to process all pending payouts?')) {
      return;
    }

    try {
      // This would trigger the Stripe transfer process
      const { error } = await supabase.functions.invoke('process-bulk-payouts');
      
      if (error) {
        alert('Error processing payouts: ' + error.message);
      } else {
        alert('Bulk payout initiated successfully!');
        fetchPlatformData(); // Refresh data
      }
    } catch (error) {
      console.error('Error initiating bulk payout:', error);
      alert('Error processing payouts');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading platform data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Platform Admin Dashboard
            </h1>
            <p className="text-xl text-gray-600">
              Monitor platform performance and manage payouts
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('payouts')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'payouts'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Payouts
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'analytics'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('moderation')}
                className={`px-6 py-2 rounded-md transition-colors flex items-center gap-2 ${
                  activeTab === 'moderation'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Moderation
              </button>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(stats?.total_revenue || 0)}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(stats?.monthly_revenue || 0)}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-blue-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Sellers</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {stats?.active_sellers || 0}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-purple-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Transactions</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {stats?.total_transactions || 0}
                      </p>
                    </div>
                    <Package className="h-8 w-8 text-orange-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Pending Payouts</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(stats?.pending_payouts || 0)}
                      </p>
                    </div>
                    <Download className="h-8 w-8 text-red-600" />
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {stats?.total_users || 0}
                      </p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-indigo-600" />
                  </div>
                </div>
              </div>

              {/* Top Sellers */}
              <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Sellers</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Seller</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Total Earned</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Sales Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSellers.map((seller, index) => (
                        <tr key={seller.user_id} className="border-b border-gray-100">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="bg-amber-100 rounded-full w-8 h-8 flex items-center justify-center mr-3">
                                <span className="text-amber-600 font-semibold text-sm">
                                  {index + 1}
                                </span>
                              </div>
                              <span className="font-medium">{seller.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-semibold text-green-600">
                            {formatCurrency(seller.total_earned)}
                          </td>
                          <td className="py-3 px-4">{seller.total_sales}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Payouts Tab */}
          {activeTab === 'payouts' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Pending Payouts</h3>
                <button
                  onClick={processBulkPayout}
                  className="bg-amber-500 text-white px-6 py-2 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Process All Payouts
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Days Pending</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPayouts.map((payout) => (
                      <tr key={payout.user_id} className="border-b border-gray-100">
                        <td className="py-3 px-4 font-medium">{payout.full_name}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            payout.role === 'seller' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {payout.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-green-600">
                          {formatCurrency(payout.amount)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`${payout.days_pending > 7 ? 'text-red-600' : 'text-gray-600'}`}>
                            {payout.days_pending} days
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{payout.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Trend</h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month_year" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                      dot={{ fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Moderation Tab */}
          {activeTab === 'moderation' && (
            <ContentModerationDashboard />
          )}
        </div>
      </div>
    </div>
  );
}
