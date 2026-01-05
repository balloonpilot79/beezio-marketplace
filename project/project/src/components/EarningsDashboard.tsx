import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Clock, Download, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';

interface EarningsData {
  total_earned: number;
  pending_payout: number;
  paid_out: number;
  current_balance: number;
  last_payout_at: string | null;
}

interface Transaction {
  id: string;
  amount: number;
  percentage: number;
  status: string;
  created_at: string;
  transaction: {
    total_amount: number;
    currency: string;
    stripe_payment_intent_id: string;
  }[];
}

interface PayoutHistory {
  id: string;
  amount: number;
  status: string;
  completed_at: string | null;
  failure_reason: string | null;
  batch: {
    batch_number: string;
  }[];
}

export default function EarningsDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'seller' | 'affiliate'>('seller');
  const [sellerEarnings, setSellerEarnings] = useState<EarningsData | null>(null);
  const [affiliateEarnings, setAffiliateEarnings] = useState<EarningsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts, setPayouts] = useState<PayoutHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEarningsData();
    }
  }, [user, activeTab]);

  const fetchEarningsData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Resolve profile id (schemas vary: profiles.id may or may not equal auth.users.id)
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('id, user_id')
        .or(`id.eq.${user.id},user_id.eq.${user.id}`)
        .maybeSingle()
      const profileId = profileRow?.id ? String(profileRow.id) : user.id

      // Fetch earnings summary
      const { data: earningsData } = await supabase
        .from('user_earnings')
        .select('*')
        .eq('user_id', profileId)
        .eq('role', activeTab);

      if (activeTab === 'seller') {
        setSellerEarnings(earningsData?.[0] || null);
      } else {
        setAffiliateEarnings(earningsData?.[0] || null);
      }

      // Fetch recent transactions
      const { data: transactionData } = await supabase
        .from('payment_distributions')
        .select(`
          id,
          amount,
          percentage,
          status,
          created_at,
          transaction:transaction_id (
            total_amount,
            currency,
            stripe_payment_intent_id
          )
        `)
        .eq('recipient_id', profileId)
        .eq('recipient_type', activeTab)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(transactionData || []);

      // Fetch payout history
      const { data: payoutData } = await supabase
        .from('payouts')
        .select(`
          id,
          amount,
          status,
          completed_at,
          failure_reason,
          batch:batch_id (
            batch_number
          )
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20);

      setPayouts(payoutData || []);

    } catch (error) {
      console.error('Error fetching earnings data:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentEarnings = activeTab === 'seller' ? sellerEarnings : affiliateEarnings;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading earnings data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Earnings Dashboard
            </h1>
            <p className="text-xl text-gray-600">
              Track your sales performance and payouts
            </p>
          </div>

          {/* Role Tabs */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setActiveTab('seller')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'seller'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Seller Earnings
              </button>
              <button
                onClick={() => setActiveTab('affiliate')}
                className={`px-6 py-2 rounded-md transition-colors ${
                  activeTab === 'affiliate'
                    ? 'bg-amber-500 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Affiliate Earnings
              </button>
            </div>
          </div>

          {/* Earnings Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Earned</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(currentEarnings?.total_earned || 0)}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Balance</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {formatCurrency(currentEarnings?.current_balance || 0)}
                  </p>
                </div>
                <div className="bg-amber-100 p-3 rounded-full">
                  <DollarSign className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Payout</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(currentEarnings?.pending_payout || 0)}
                  </p>
                </div>
                <div className="bg-orange-100 p-3 rounded-full">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Paid Out</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(currentEarnings?.paid_out || 0)}
                  </p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Download className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Payout Information */}
          {currentEarnings?.last_payout_at && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Payout Information</h3>
              <p className="text-gray-600">
                Last payout: {formatDate(currentEarnings.last_payout_at)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Payouts are processed automatically when your balance reaches $25 or more.
              </p>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
                <Eye className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="space-y-4">
                {transactions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No transactions yet
                  </p>
                ) : (
                  transactions.map((transaction) => (
                    <div key={transaction.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-sm text-gray-600">
                            {transaction.percentage}% commission
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(transaction.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : transaction.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.status}
                          </span>
                          <p className="text-sm text-gray-500 mt-1">
                            Order: {formatCurrency(transaction.transaction?.[0]?.total_amount || 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payout History */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Payout History</h3>
                <Download className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="space-y-4">
                {payouts.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No payouts yet
                  </p>
                ) : (
                  payouts.map((payout) => (
                    <div key={payout.id} className="border-b border-gray-100 pb-4 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatCurrency(payout.amount)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Batch: {payout.batch?.[0]?.batch_number || 'N/A'}
                          </p>
                          {payout.completed_at && (
                            <p className="text-xs text-gray-500">
                              {formatDate(payout.completed_at)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            payout.status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : payout.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {payout.status}
                          </span>
                          {payout.failure_reason && (
                            <p className="text-xs text-red-500 mt-1">
                              {payout.failure_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
