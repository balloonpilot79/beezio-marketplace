import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink,
  Clock,
  Shield,
  TrendingUp,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { EmbeddedStripeOnboarding } from './EmbeddedStripeOnboarding';
import { TaxComplianceDashboard } from './TaxComplianceDashboard';
import { apiPost } from '../utils/netlifyApi';

interface BeezioEarnings {
  total_earned: number;
  pending_payout: number;
  paid_out: number;
  current_balance: number;
  held_balance?: number;
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

interface StripeAccountStatus {
  account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements: string[];
  business_name?: string;
  business_url?: string;
  balance_available: number;
  balance_pending: number;
  next_payout_date?: string;
  next_payout_amount?: number;
}

interface PayoutHistory {
  id: string;
  amount: number;
  status: 'paid' | 'pending' | 'in_transit' | 'failed';
  arrival_date: string;
  description: string;
  failure_reason?: string;
}

export const StripeSellerDashboard: React.FC = () => {
  const { user, session } = useAuth();
  const [stripeAccount, setStripeAccount] = useState<StripeAccountStatus | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistory[]>([]);
  const [beezioEarnings, setBeezioEarnings] = useState<BeezioEarnings | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequestRow[]>([]);
  const [requestAmount, setRequestAmount] = useState<string>('');
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      fetchStripeAccountStatus();
      fetchPayoutHistory();
      fetchBeezioEarnings();
    }
  }, [user]);

  const fetchStripeAccountStatus = async () => {
    try {
      const data = await apiPost<any>('/api/stripe/account-status', session ?? null, {});
      setStripeAccount(data as any);
    } catch (err) {
      console.error('Error fetching Stripe account status:', err);
      setError('Failed to load payment account status');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPayoutHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-payout-history', {
        body: { userId: user?.id }
      });

      if (error) throw error;
      setPayoutHistory(data || []);
    } catch (err) {
      console.error('Error fetching payout history:', err);
    }
  };

  const fetchBeezioEarnings = async () => {
    try {
      const data = await apiPost<any>('/api/user-earnings', session ?? null, { role: 'seller' });
      const earnings = (data as any)?.earnings;
      setBeezioEarnings({
        total_earned: Number(earnings?.total_earned || 0),
        pending_payout: Number(earnings?.pending_payout || 0),
        paid_out: Number(earnings?.paid_out || 0),
        current_balance: Number(earnings?.current_balance || 0),
        held_balance: Number(earnings?.held_balance || 0),
        last_payout_at: earnings?.last_payout_at ?? null,
      });
      setPayoutRequests(Array.isArray((data as any)?.payout_requests) ? (data as any).payout_requests : []);
    } catch (err) {
      console.warn('StripeSellerDashboard: failed to load Beezio earnings (non-fatal):', err);
    }
  };

  const requestPayout = async () => {
    setRequestMessage(null);
    if (!user) return;
    const amount = Number(String(requestAmount || '').trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setRequestMessage('Enter a valid amount');
      return;
    }
    setRequesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('request-payout', {
        body: { role: 'seller', amount }
      });
      if (error) throw error;
      setRequestMessage('Payout request submitted');
      setRequestAmount('');
      // Refresh local state
      await fetchBeezioEarnings();
      await fetchStripeAccountStatus();
      await fetchPayoutHistory();
      console.log('Payout request created:', data);
    } catch (err: any) {
      setRequestMessage(err?.message || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const createStripeAccount = async () => {
    setIsCreatingAccount(true);
    setError(null);
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
        setIsCreatingAccount(false);
        return;
      }

      // If agreements are signed, proceed with account creation
      const data = await apiPost<any>('/api/stripe/create-embedded-account', session ?? null, {
        type: 'seller',
        agreements_signed: true,
        country: 'US',
      });

      // Update user profile with Stripe account ID
      if (user) {
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.account_id })
          .or(`id.eq.${user.id},user_id.eq.${user.id}`);
      }

      // Show onboarding modal
      setShowOnboarding(true);

    } catch (err) {
      console.error('Error creating Stripe account:', err);
      setError('Failed to create payment account. Please try again.');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const refreshAccountStatus = async () => {
    setIsLoading(true);
    await fetchStripeAccountStatus();
    await fetchPayoutHistory();
    await fetchBeezioEarnings();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'in_transit': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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

  return (
    <div className="space-y-6">
      {/* Account Status Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Payment Account</h3>
              <p className="text-gray-600">Manage your Stripe payments and payouts</p>
            </div>
          </div>
          <button 
            onClick={refreshAccountStatus}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!stripeAccount ? (
          <div className="text-center py-8">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
                <CreditCard className="w-8 h-8 text-orange-600" />
              </div>
              <h4 className="text-lg font-semibold mb-2">Set Up Your Payment Account</h4>
              <p className="text-gray-600 mb-6">
                Connect your Stripe account to receive payments from customers and affiliate commissions.
              </p>
            </div>
            <button
              onClick={createStripeAccount}
              disabled={isCreatingAccount}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center space-x-2"
            >
              {isCreatingAccount ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Connect Stripe Account</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Beezio Earnings + Payout Requests */}
            {beezioEarnings && (
              <div className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">Beezio Earnings</h4>
                      <p className="text-sm text-gray-600">Payouts run bi-monthly (1st & 15th UTC). Seller funds may be held until shipped + 14 days.</p>
                    </div>
                  <div className="text-right text-sm text-gray-700">
                    <div>Available: <span className="font-semibold">${beezioEarnings.current_balance.toFixed(2)}</span></div>
                    <div className="text-gray-500">Held: ${(beezioEarnings.held_balance || 0).toFixed(2)} (releases after 14 days + shipped)</div>
                    <div className="text-gray-500">Pending: ${beezioEarnings.pending_payout.toFixed(2)}</div>
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
                    disabled={requesting || Math.max(beezioEarnings.current_balance, beezioEarnings.pending_payout) < 25}
                    className="px-4 py-2 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-50"
                  >
                    {requesting ? 'Requesting...' : 'Add payout request'}
                  </button>
                </div>
                {requestMessage && <div className="mt-2 text-sm text-gray-700">{requestMessage}</div>}

                {payoutRequests.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Recent payout requests</div>
                    <div className="space-y-2">
                      {payoutRequests.slice(0, 5).map((r) => (
                        <div key={r.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
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

            {/* Account Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {stripeAccount.charges_enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium">Accept Payments</span>
                </div>
                <p className="text-sm text-gray-600">
                  {stripeAccount.charges_enabled ? 'Ready to accept payments' : 'Setup required'}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {stripeAccount.payouts_enabled ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium">Receive Payouts</span>
                </div>
                <p className="text-sm text-gray-600">
                  {stripeAccount.payouts_enabled ? 'Payouts enabled' : 'Setup required'}
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  {stripeAccount.details_submitted ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium">Account Details</span>
                </div>
                <p className="text-sm text-gray-600">
                  {stripeAccount.details_submitted ? 'Complete' : 'Incomplete'}
                </p>
              </div>
            </div>

            {/* Requirements */}
            {stripeAccount.requirements.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <h4 className="font-medium text-yellow-800">Action Required</h4>
                </div>
                <p className="text-yellow-700 mb-3">
                  Complete the following to fully activate your account:
                </p>
                <ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">
                  {stripeAccount.requirements.map((requirement, index) => (
                    <li key={index}>{requirement}</li>
                  ))}
                </ul>
                <button className="mt-3 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors inline-flex items-center space-x-2">
                  <ExternalLink className="w-4 h-4" />
                  <span>Complete Setup</span>
                </button>
              </div>
            )}

            {/* Balance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-4 rounded-lg text-white">
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="w-5 h-5" />
                  <span className="font-medium">Available Balance</span>
                </div>
                <p className="text-2xl font-bold">${stripeAccount.balance_available.toFixed(2)}</p>
                <p className="text-green-100 text-sm">Ready for payout</p>
              </div>

              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg text-white">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Pending Balance</span>
                </div>
                <p className="text-2xl font-bold">${stripeAccount.balance_pending.toFixed(2)}</p>
                <p className="text-blue-100 text-sm">Processing</p>
              </div>

              {stripeAccount.next_payout_date && (
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-lg text-white">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-medium">Next Payout</span>
                  </div>
                  <p className="text-2xl font-bold">${stripeAccount.next_payout_amount?.toFixed(2)}</p>
                  <p className="text-purple-100 text-sm">{stripeAccount.next_payout_date}</p>
                </div>
              )}

              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-lg text-white">
                <div className="flex items-center space-x-2 mb-2">
                  <Download className="w-5 h-5" />
                  <span className="font-medium">Total Payouts</span>
                </div>
                <p className="text-2xl font-bold">
                  ${payoutHistory.reduce((sum, payout) => sum + payout.amount, 0).toFixed(2)}
                </p>
                <p className="text-orange-100 text-sm">All time</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tax Compliance Section */}
      <TaxComplianceDashboard />

      {/* Payout History */}
      {payoutHistory.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Payouts</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 font-medium text-gray-700">Description</th>
                </tr>
              </thead>
              <tbody>
                {payoutHistory.slice(0, 5).map((payout) => (
                  <tr key={payout.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-sm text-gray-900">{payout.arrival_date}</td>
                    <td className="py-3 text-sm font-medium text-gray-900">
                      ${payout.amount.toFixed(2)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-gray-600">
                      {payout.description}
                      {payout.failure_reason && (
                        <div className="text-red-600 text-xs mt-1">{payout.failure_reason}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {payoutHistory.length > 5 && (
            <div className="mt-4 text-center">
              <button className="text-blue-600 hover:text-blue-700 font-medium">
                View All Payouts
              </button>
            </div>
          )}
        </div>
      )}

      {/* Embedded Stripe Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <EmbeddedStripeOnboarding
              userType="seller"
              onComplete={(_accountId) => {
                setShowOnboarding(false);
                fetchStripeAccountStatus();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StripeSellerDashboard;
