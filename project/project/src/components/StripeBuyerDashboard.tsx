import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Shield, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Receipt,
  RefreshCcw,
  Eye,
  Download,
  Plus,
  Trash2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

interface PaymentHistory {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  description: string;
  created: string;
  receipt_url?: string;
  refund_amount?: number;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface SubscriptionInfo {
  id: string;
  status: 'active' | 'past_due' | 'canceled' | 'unpaid';
  product_name: string;
  amount: number;
  currency: string;
  interval: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export const StripeBuyerDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCard, setIsAddingCard] = useState(false);

  useEffect(() => {
    if (user) {
      fetchPaymentData();
    }
  }, [user]);

  const fetchPaymentData = async () => {
    try {
      await Promise.all([
        fetchPaymentMethods(),
        fetchPaymentHistory(),
        fetchSubscriptions()
      ]);
    } catch (err) {
      console.error('Error fetching payment data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-payment-methods', {
        body: { userId: user?.id }
      });

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (err) {
      console.error('Error fetching payment methods:', err);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-buyer-payments', {
        body: { userId: user?.id }
      });

      if (error) throw error;
      setPaymentHistory(data || []);
    } catch (err) {
      console.error('Error fetching payment history:', err);
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-buyer-subscriptions', {
        body: { userId: user?.id }
      });

      if (error) throw error;
      setSubscriptions(data || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    }
  };

  const addPaymentMethod = async () => {
    setIsAddingCard(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-setup-intent', {
        body: { userId: user?.id }
      });

      if (error) throw error;

      // This would typically open a Stripe Elements modal for card collection
      // For now, we'll simulate success
      setTimeout(() => {
        fetchPaymentMethods();
        setIsAddingCard(false);
      }, 2000);

    } catch (err) {
      console.error('Error adding payment method:', err);
      setIsAddingCard(false);
    }
  };

  const removePaymentMethod = async (paymentMethodId: string) => {
    try {
      const { error } = await supabase.functions.invoke('remove-payment-method', {
        body: { paymentMethodId }
      });

      if (error) throw error;
      await fetchPaymentMethods();
    } catch (err) {
      console.error('Error removing payment method:', err);
    }
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      const { error } = await supabase.functions.invoke('set-default-payment-method', {
        body: { userId: user?.id, paymentMethodId }
      });

      if (error) throw error;
      await fetchPaymentMethods();
    } catch (err) {
      console.error('Error setting default payment method:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': case 'active': return 'text-green-600 bg-green-100';
      case 'pending': case 'past_due': return 'text-yellow-600 bg-yellow-100';
      case 'failed': case 'unpaid': return 'text-red-600 bg-red-100';
      case 'refunded': case 'canceled': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBrandIcon = (brand: string) => {
    // In a real app, you'd use actual card brand icons
    switch (brand.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      case 'discover': return '💳';
      default: return '💳';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Payment Methods */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Payment Methods</h3>
              <p className="text-gray-600">Manage your saved cards and payment options</p>
            </div>
          </div>
          <button
            onClick={addPaymentMethod}
            disabled={isAddingCard}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center space-x-2"
          >
            {isAddingCard ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Adding...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Add Card</span>
              </>
            )}
          </button>
        </div>

        {paymentMethods.length > 0 ? (
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getBrandIcon(method.brand)}</span>
                  <div>
                    <p className="font-medium capitalize">
                      {method.brand} •••• {method.last4}
                    </p>
                    <p className="text-sm text-gray-600">
                      Expires {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
                    </p>
                  </div>
                  {method.is_default && (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {!method.is_default && (
                    <button
                      onClick={() => setDefaultPaymentMethod(method.id)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    onClick={() => removePaymentMethod(method.id)}
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Payment Methods</h4>
            <p className="text-gray-600">Add a payment method for faster checkout</p>
          </div>
        )}
      </div>

      {/* Active Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <RefreshCcw className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Active Subscriptions</h3>
              <p className="text-gray-600">Manage your recurring payments</p>
            </div>
          </div>

          <div className="space-y-3">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-medium">{subscription.product_name}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                      {subscription.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    ${subscription.amount} per {subscription.interval}
                  </p>
                  <p className="text-sm text-gray-600">
                    Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                  {subscription.cancel_at_period_end && (
                    <p className="text-sm text-yellow-600">
                      Cancels at period end
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Manage
                  </button>
                  <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Receipt className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Purchase History</h3>
              <p className="text-gray-600">Your recent transactions and receipts</p>
            </div>
          </div>
          <button className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export History</span>
          </button>
        </div>

        {paymentHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 font-medium text-gray-700">Date</th>
                  <th className="text-left py-3 font-medium text-gray-700">Description</th>
                  <th className="text-left py-3 font-medium text-gray-700">Amount</th>
                  <th className="text-left py-3 font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.slice(0, 10).map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-sm text-gray-900">
                      {new Date(payment.created).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{payment.description}</p>
                        {payment.products.length > 0 && (
                          <p className="text-xs text-gray-600">
                            {payment.products.map(p => `${p.name} (${p.quantity}x)`).join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-sm font-medium text-gray-900">
                      ${payment.amount.toFixed(2)} {payment.currency.toUpperCase()}
                      {payment.refund_amount && (
                        <div className="text-xs text-red-600">
                          -${payment.refund_amount.toFixed(2)} refunded
                        </div>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center space-x-2">
                        {payment.receipt_url && (
                          <a
                            href={payment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center space-x-1"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Receipt</span>
                          </a>
                        )}
                        {payment.status === 'succeeded' && (
                          <button className="text-gray-600 hover:text-gray-700 text-sm">
                            Support
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <Receipt className="w-8 h-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Purchase History</h4>
            <p className="text-gray-600">Your purchases and transactions will appear here</p>
          </div>
        )}
      </div>

      {/* Security Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Shield className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Secure Payments</h4>
            <p className="text-blue-700 text-sm mb-2">
              All payments are processed securely through Stripe with industry-leading encryption and fraud protection.
            </p>
            <ul className="text-blue-700 text-sm space-y-1">
              <li>• PCI DSS Level 1 compliant payment processing</li>
              <li>• 256-bit SSL encryption for all transactions</li>
              <li>• Advanced fraud detection and prevention</li>
              <li>• Secure storage - we never store your card details</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StripeBuyerDashboard;
