import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Target,
  Users,
  BarChart3,
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { EmbeddedStripeOnboarding } from './EmbeddedStripeOnboarding';
import { TaxComplianceDashboard } from './TaxComplianceDashboard';
import { apiPost } from '../utils/netlifyApi';

interface AffiliateEarnings {
  total_earnings: number;
  pending_commission: number;
  paid_commission: number;
  current_month_earnings: number;
  total_clicks: number;
  total_conversions: number;
  conversion_rate: number;
  top_performing_product: string;
}

interface CommissionPayment {
  id: string;
  amount: number;
  status: 'paid' | 'pending' | 'processing';
  payment_date: string;
  period: string;
  products_count: number;
  stripe_transfer_id?: string;
}

interface BeezioEarnings {
  total_earned: number;
  pending_payout: number;
  paid_out: number;
  current_balance: number;
  last_payout_at?: string | null;
}

interface PayoutRequestRow {
  id: string;
  amount: number;
  status: string;
  requested_at?: string | null;
  processed_at?: string | null;
  rejection_reason?: string | null;
  created_at?: string | null;
}

export const StripeAffiliateDashboard: React.FC = () => {
  const { user, session } = useAuth();
  const [earnings, setEarnings] = useState<AffiliateEarnings | null>(null);
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [beezioEarnings, setBeezioEarnings] = useState<BeezioEarnings | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [requestAmount, setRequestAmount] = useState<string>('');
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchEarningsData();
      fetchPaymentHistory();
      checkStripeConnection();
      fetchBeezioEarnings();
    }
  }, [user]);

  const fetchEarningsData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-affiliate-earnings', {
        body: { userId: user?.id }
      });

      if (error) throw error;
      setEarnings(data);
    } catch (err) {
      console.error('Error fetching affiliate earnings:', err);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-affiliate-payments', {
        body: { userId: user?.id }
      });

      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
    }
  };

  const fetchBeezioEarnings = async () => {
    try {
      const data = await apiPost<any>('/api/user-earnings', session ?? null, { role: 'affiliate' });
      const e = (data as any)?.earnings;
      setBeezioEarnings({
        total_earned: Number(e?.total_earned || 0),
        pending_payout: Number(e?.pending_payout || 0),
        paid_out: Number(e?.paid_out || 0),
        current_balance: Number(e?.current_balance || 0),
        last_payout_at: e?.last_payout_at ?? null,
      });
      setPayoutRequests(Array.isArray((data as any)?.payout_requests) ? (data as any).payout_requests : []);
    } catch (err) {
      console.warn('StripeAffiliateDashboard: failed to load Beezio earnings (non-fatal):', err);
    }
  };

  const requestPayout = async () => {
    setRequestMessage(null);
    const amount = Number(String(requestAmount || '').trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setRequestMessage('Enter a valid amount');
      return;
    }
    setRequesting(true);
    try {
      const { error } = await supabase.functions.invoke('request-payout', {
        body: { role: 'affiliate', amount }
      });
      if (error) throw error;
      setRequestMessage('Payout request submitted');
      setRequestAmount('');
      await fetchBeezioEarnings();
      await fetchPaymentHistory();
    } catch (err: any) {
      setRequestMessage(err?.message || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const checkStripeConnection = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .or(`id.eq.${user?.id},user_id.eq.${user?.id}`)
        .maybeSingle();

      setStripeConnected(!!profileData?.stripe_account_id);
    } catch (err) {
      console.error('Error checking Stripe connection:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const connectStripeAccount = async () => {
    try {
      // Check if user has signed tax agreements
      const { data: agreements } = await supabase
        .from('tax_agreements')
        .select('agreement_type')
        .eq('user_id', user?.id);

      const requiredAgreements = ['1099', 'independent_contractor', 'tax_withholding'];
      const signedAgreements = agreements?.map(a => a.agreement_type) || [];
      const hasAllAgreements = requiredAgreements.every(agreement =>
        signedAgreements.includes(agreement)
      );

      if (!hasAllAgreements) {
        // Show embedded onboarding which includes agreement signing
        setShowOnboarding(true);
        return;
      }

      // If agreements are signed, proceed with account creation
      const data = await apiPost<any>('/api/stripe/create-embedded-account', session ?? null, {
        type: 'affiliate',
        agreements_signed: true,
        country: 'US',
      });

      // Update profile with Stripe account ID
      await supabase
        .from('profiles')
        .update({ stripe_account_id: data.account_id })
        .or(`id.eq.${user?.id},user_id.eq.${user?.id}`);

      // Show onboarding modal
      setShowOnboarding(true);
      
    } catch (err) {
      console.error('Error connecting Stripe account:', err);
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    await Promise.all([
      fetchEarningsData(),
      fetchPaymentHistory(),
      checkStripeConnection(),
      fetchBeezioEarnings()
    ]);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stripe Connection Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Affiliate Earnings</h3>
              <p className="text-gray-600">Track your commission payments and performance</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={refreshData}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            {stripeConnected ? (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Payment Account Connected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <button
                  onClick={connectStripeAccount}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Connect Payment Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Earnings Overview */}
      {earnings && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-6 h-6" />
              <span className="font-medium">Total Earnings</span>
            </div>
            <p className="text-2xl font-bold">${earnings.total_earnings.toFixed(2)}</p>
            <p className="text-green-100 text-sm">All time commission</p>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-6 h-6" />
              <span className="font-medium">Pending Commission</span>
            </div>
            <p className="text-2xl font-bold">${earnings.pending_commission.toFixed(2)}</p>
            <p className="text-blue-100 text-sm">Awaiting payment</p>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg text-white">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-6 h-6" />
              <span className="font-medium">This Month</span>
            </div>
            <p className="text-2xl font-bold">${earnings.current_month_earnings.toFixed(2)}</p>
            <p className="text-purple-100 text-sm">Current month earnings</p>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg text-white">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-6 h-6" />
              <span className="font-medium">Conversion Rate</span>
            </div>
            <p className="text-2xl font-bold">{earnings.conversion_rate.toFixed(1)}%</p>
            <p className="text-orange-100 text-sm">{earnings.total_conversions} of {earnings.total_clicks} clicks</p>
          </div>
        </div>
      )}

      {/* Beezio Payout Requests */}
      {beezioEarnings && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900">Payouts</h3>
          <p className="text-sm text-gray-600">Payouts run bi-monthly (1st & 15th UTC). You can optionally add a payout request for audit/visibility.</p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500">Available</div>
              <div className="text-xl font-bold text-gray-900">${beezioEarnings.current_balance.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500">Pending payout</div>
              <div className="text-xl font-bold text-gray-900">${beezioEarnings.pending_payout.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500">Paid out</div>
              <div className="text-xl font-bold text-gray-900">${beezioEarnings.paid_out.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500">Total earned</div>
              <div className="text-xl font-bold text-gray-900">${beezioEarnings.total_earned.toFixed(2)}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
              placeholder="Amount (min $25)"
              inputMode="decimal"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
            />
            <button
              onClick={requestPayout}
              disabled={requesting || Math.max(beezioEarnings.current_balance, beezioEarnings.pending_payout) < 25 || !stripeConnected}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
            >
              {requesting ? 'Requesting...' : 'Add payout request'}
            </button>
          </div>
          {requestMessage && <div className="mt-2 text-sm text-gray-700">{requestMessage}</div>}
          {!stripeConnected && <div className="mt-2 text-sm text-amber-700">Connect your payment account to receive payouts.</div>}

          {payoutRequests.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">Recent payout requests</div>
              <div className="space-y-2">
                {payoutRequests.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50"
                  >
                    <div className="text-gray-700">
                      ${Number(r.amount || 0).toFixed(2)} • {String(r.status || 'pending')}
                    </div>
                    <div className="text-gray-500">
                      {new Date(String(r.created_at || r.requested_at || Date.now())).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance Metrics */}
      {earnings && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{earnings.total_clicks}</p>
              <p className="text-gray-600">Total Clicks</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{earnings.total_conversions}</p>
              <p className="text-gray-600">Conversions</p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-lg font-bold text-gray-900">{earnings.top_performing_product}</p>
              <p className="text-gray-600">Top Product</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Payment History</h3>
          <button className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Download Report</span>
          </button>
        </div>

        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 font-medium text-gray-700">Period</th>
                  <th className="text-left py-3 font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 font-medium text-gray-700">Products</th>
                  <th className="text-left py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 font-medium text-gray-700">Payment Date</th>
                  <th className="text-left py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-sm text-gray-900">{payment.period}</td>
                    <td className="py-3 text-sm font-medium text-gray-900">
                      ${payment.amount.toFixed(2)}
                    </td>
                    <td className="py-3 text-sm text-gray-600">{payment.products_count} products</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">{payment.payment_date}</td>
                    <td className="py-3">
                      {payment.stripe_transfer_id && (
                        <button className="text-blue-600 hover:text-blue-700 text-sm">
                          View Receipt
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Payments Yet</h4>
            <p className="text-gray-600 mb-4">
              Start promoting products to earn your first commission!
            </p>
            <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
              Browse Products to Promote
            </button>
          </div>
        )}
      </div>

      {/* Tax Compliance Section */}
      <TaxComplianceDashboard />

      {/* Payment Schedule Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Payment Schedule</h4>
            <p className="text-blue-700 text-sm mb-2">
              Payouts are processed bi-monthly on the 1st and 15th (UTC) for both affiliates and sellers (seller payouts may be held until shipped + 14 days).
            </p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• Minimum payout: $25.00</li>
              <li>• Processing time: 2-7 business days</li>
              <li>• Payments via Stripe to your connected bank account</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Embedded Stripe Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <EmbeddedStripeOnboarding
              userType="affiliate"
              onComplete={(_accountId) => {
                setShowOnboarding(false);
                checkStripeConnection();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StripeAffiliateDashboard;
