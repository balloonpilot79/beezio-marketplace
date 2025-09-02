import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Users, Calendar, Target, Zap, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RecurringIncome {
  product_title: string;
  subscription_price: number;
  commission_rate: number;
  monthly_commission: number;
  active_subscribers: number;
  monthly_recurring_income: number;
  total_lifetime_value: number;
  avg_customer_lifetime_months: number;
}

interface RecurringStats {
  total_monthly_recurring: number;
  total_active_subscribers: number;
  projected_annual_income: number;
  average_commission_per_subscriber: number;
  fastest_growing_product: string;
  total_lifetime_value: number;
}

const RecurringIncomeDashboard: React.FC = () => {
  const [recurringIncome, setRecurringIncome] = useState<RecurringIncome[]>([]);
  const [stats, setStats] = useState<RecurringStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState<'monthly' | 'annual'>('monthly');
  const { profile } = useAuth();

  useEffect(() => {
    if (profile?.role === 'affiliate') {
      fetchRecurringIncome();
    }
  }, [profile]);

  const fetchRecurringIncome = async () => {
    try {
      // Get all active subscriptions for this affiliate with product details
      const { data: subscriptions, error } = await supabase
        .from('customer_subscriptions')
        .select(`
          id,
          subscription_price,
          status,
          created_at,
          products (
            title,
            commission_rate,
            subscription_interval
          )
        `)
        .eq('affiliate_id', profile?.id)
        .eq('status', 'active');

      if (error) throw error;

      // Group by product and calculate recurring income
      const productGroups = subscriptions?.reduce((acc, sub) => {
        const productTitle = sub.products.title;
        if (!acc[productTitle]) {
          acc[productTitle] = {
            product_title: productTitle,
            subscription_price: sub.subscription_price,
            commission_rate: sub.products.commission_rate,
            subscribers: [],
            monthly_commission: (sub.subscription_price * sub.products.commission_rate) / 100
          };
        }
        acc[productTitle].subscribers.push(sub);
        return acc;
      }, {} as any) || {};

      // Calculate metrics for each product
      const recurringData: RecurringIncome[] = Object.values(productGroups).map((group: any) => {
        const activeSubscribers = group.subscribers.length;
        const monthlyRecurringIncome = group.monthly_commission * activeSubscribers;
        
        // Calculate average customer lifetime (18 months default, but calculate from actual data)
        const avgLifetimeMonths = 18; // This could be calculated from actual churn data
        const totalLifetimeValue = monthlyRecurringIncome * avgLifetimeMonths;

        return {
          product_title: group.product_title,
          subscription_price: group.subscription_price,
          commission_rate: group.commission_rate,
          monthly_commission: group.monthly_commission,
          active_subscribers: activeSubscribers,
          monthly_recurring_income: monthlyRecurringIncome,
          total_lifetime_value: totalLifetimeValue,
          avg_customer_lifetime_months: avgLifetimeMonths
        };
      });

      setRecurringIncome(recurringData);

      // Calculate overall stats
      const totalMonthlyRecurring = recurringData.reduce((sum, item) => sum + item.monthly_recurring_income, 0);
      const totalActiveSubscribers = recurringData.reduce((sum, item) => sum + item.active_subscribers, 0);
      const projectedAnnualIncome = totalMonthlyRecurring * 12;
      const avgCommissionPerSubscriber = totalActiveSubscribers > 0 ? totalMonthlyRecurring / totalActiveSubscribers : 0;
      const totalLifetimeValue = recurringData.reduce((sum, item) => sum + item.total_lifetime_value, 0);
      
      // Find fastest growing product (most subscribers)
      const fastestGrowing = recurringData.reduce((max, item) => 
        item.active_subscribers > max.active_subscribers ? item : max, 
        recurringData[0] || { product_title: 'None', active_subscribers: 0 }
      );

      setStats({
        total_monthly_recurring: totalMonthlyRecurring,
        total_active_subscribers: totalActiveSubscribers,
        projected_annual_income: projectedAnnualIncome,
        average_commission_per_subscriber: avgCommissionPerSubscriber,
        fastest_growing_product: fastestGrowing.product_title,
        total_lifetime_value: totalLifetimeValue
      });

    } catch (error) {
      console.error('Error fetching recurring income:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">💰 Recurring Income Dashboard</h1>
            <p className="text-green-100 text-lg">
              Build wealth with monthly recurring commissions that compound over time
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">
              ${stats?.total_monthly_recurring.toLocaleString() || '0'}
            </div>
            <div className="text-green-200">Monthly Recurring Income</div>
          </div>
        </div>
      </div>

      {/* Time Frame Toggle */}
      <div className="flex justify-center">
        <div className="bg-white rounded-lg shadow-md p-1 flex">
          <button
            onClick={() => setTimeFrame('monthly')}
            className={`px-6 py-2 rounded-md transition-colors ${
              timeFrame === 'monthly'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly View
          </button>
          <button
            onClick={() => setTimeFrame('annual')}
            className={`px-6 py-2 rounded-md transition-colors ${
              timeFrame === 'annual'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual Projection
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {timeFrame === 'monthly' ? 'Monthly Recurring' : 'Annual Projection'}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                ${timeFrame === 'monthly' 
                  ? stats?.total_monthly_recurring.toLocaleString() 
                  : stats?.projected_annual_income.toLocaleString()
                }
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Subscribers</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_active_subscribers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Per Subscriber</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats?.average_commission_per_subscriber.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Zap className="h-6 w-6 text-amber-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Lifetime Value</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats?.total_lifetime_value.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Breakdown */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recurring Income by Product</h3>
          <p className="text-sm text-gray-600">
            Each subscription builds your monthly recurring income
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commission Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Per Subscriber
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active Subs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monthly Recurring
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lifetime Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recurringIncome.map((product, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.product_title}</div>
                    <div className="text-sm text-gray-500">${product.subscription_price}/month</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      {product.commission_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${product.monthly_commission.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">per month</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 text-blue-500 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {product.active_subscribers}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-lg font-bold text-green-600">
                      ${product.monthly_recurring_income.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">every month</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-lg font-bold text-purple-600">
                      ${product.total_lifetime_value.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      over {product.avg_customer_lifetime_months} months
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recurringIncome.length === 0 && (
          <div className="text-center py-12">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Start Building Recurring Income</h3>
            <p className="mt-1 text-sm text-gray-500">
              Promote subscription products to earn monthly recurring commissions!
            </p>
            <div className="mt-6">
              <button className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors">
                Browse Subscription Products
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Growth Projection */}
      {stats && stats.total_monthly_recurring > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🚀 Growth Projection</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                ${(stats.total_monthly_recurring * 6).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">6 Months from Now</div>
              <div className="text-xs text-gray-500">if you maintain current subscribers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                ${(stats.total_monthly_recurring * 12).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Annual Recurring Income</div>
              <div className="text-xs text-gray-500">predictable yearly earnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                ${(stats.total_monthly_recurring * 1.5 * 12).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">With 50% Growth</div>
              <div className="text-xs text-gray-500">if you add 50% more subscribers</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringIncomeDashboard;
