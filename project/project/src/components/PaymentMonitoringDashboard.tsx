import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContextMultiRole'
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Calendar,
  Banknote,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Settings
} from 'lucide-react'

interface PaymentOverview {
  total_earned: number
  available_balance: number
  pending_payments: number
  next_payout_date: string
  payout_schedule: string
  payment_method: {
    type: string
    last4: string
    bank_name?: string
  } | null
}

interface PayoutRecord {
  id: string
  amount: number
  status: 'paid' | 'pending' | 'processing' | 'failed'
  date: string
  method: string
  description: string
}

interface EarningsBreakdown {
  this_month: number
  last_month: number
  this_year: number
  pending: number
}

export const PaymentMonitoringDashboard: React.FC = () => {
  const { user, profile } = useAuth()
  const [overview, setOverview] = useState<PaymentOverview | null>(null)
  const [payouts, setPayouts] = useState<PayoutRecord[]>([])
  const [earnings, setEarnings] = useState<EarningsBreakdown | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showFullBalance, setShowFullBalance] = useState(false)
  const [userType, setUserType] = useState<'seller' | 'affiliate'>('seller')

  useEffect(() => {
    if (user) {
      determineUserType()
      loadPaymentData()
    }
  }, [user])

  const determineUserType = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user?.id)
        .single()

      setUserType(data?.user_type || 'seller')
    } catch (error) {
      console.error('Error determining user type:', error)
    }
  }

  const loadPaymentData = async () => {
    setIsLoading(true)
    try {
      // Load payment overview
      const { data: overviewData } = await supabase.functions.invoke(
        userType === 'seller' ? 'get-seller-payment-overview' : 'get-affiliate-payment-overview',
        { body: { userId: user?.id } }
      )
      setOverview(overviewData)

      // Load payout history
      const { data: payoutsData } = await supabase.functions.invoke('get-payout-history', {
        body: { userId: user?.id, limit: 10 }
      })
      setPayouts(payoutsData || [])

      // Load earnings breakdown
      const { data: earningsData } = await supabase.functions.invoke(
        userType === 'seller' ? 'get-seller-earnings' : 'get-affiliate-earnings',
        { body: { userId: user?.id } }
      )
      setEarnings(earningsData)

    } catch (error) {
      console.error('Error loading payment data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'processing': return 'text-blue-600 bg-blue-100'
      case 'failed': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Dashboard</h1>
          <p className="text-gray-600">Monitor your earnings and payments - all within Beezio</p>
        </div>
        <button
          onClick={loadPaymentData}
          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Key Metrics */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-6 h-6" />
              <button
                onClick={() => setShowFullBalance(!showFullBalance)}
                className="text-green-100 hover:text-white"
              >
                {showFullBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-2xl font-bold">
              {showFullBalance ? formatCurrency(overview.available_balance) : '••••••'}
            </p>
            <p className="text-green-100 text-sm">Available Balance</p>
          </div>

          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
            <Clock className="w-6 h-6 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(overview.pending_payments)}</p>
            <p className="text-blue-100 text-sm">Pending Payments</p>
          </div>

          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg text-white">
            <TrendingUp className="w-6 h-6 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(overview.total_earned)}</p>
            <p className="text-purple-100 text-sm">Total Earned</p>
          </div>

          <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg text-white">
            <Calendar className="w-6 h-6 mb-2" />
            <p className="text-lg font-bold">{overview.next_payout_date}</p>
            <p className="text-orange-100 text-sm">Next Payout</p>
          </div>
        </div>
      )}

      {/* Payment Method & Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Method */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold">Payment Method</h3>
          </div>

          {overview?.payment_method ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Banknote className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium">
                      {overview.payment_method.type === 'bank_account' ? 'Bank Account' : 'Debit Card'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {overview.payment_method.bank_name && `${overview.payment_method.bank_name} ••••`}
                      {overview.payment_method.last4}
                    </p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>

              <button className="w-full text-blue-600 hover:text-blue-700 font-medium text-sm">
                Update Payment Method
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-3">No payment method connected</p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                Connect Payment Method
              </button>
            </div>
          )}
        </div>

        {/* Payout Schedule */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold">Payout Schedule</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <p className="font-medium text-green-900">Weekly Payouts</p>
                <p className="text-sm text-green-700">{overview?.payout_schedule}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex justify-between">
                <span>Minimum payout:</span>
                <span className="font-medium">$25.00</span>
              </div>
              <div className="flex justify-between">
                <span>Processing time:</span>
                <span className="font-medium">1-2 business days</span>
              </div>
              <div className="flex justify-between">
                <span>Transfer method:</span>
                <span className="font-medium">Direct deposit</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Earnings Breakdown */}
      {earnings && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Earnings Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-900">{formatCurrency(earnings.this_month)}</p>
              <p className="text-blue-700 text-sm">This Month</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-900">{formatCurrency(earnings.last_month)}</p>
              <p className="text-green-700 text-sm">Last Month</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-900">{formatCurrency(earnings.this_year)}</p>
              <p className="text-purple-700 text-sm">This Year</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-900">{formatCurrency(earnings.pending)}</p>
              <p className="text-yellow-700 text-sm">Pending</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Payouts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recent Payouts</h3>
          <button className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Download Report</span>
          </button>
        </div>

        {payouts.length > 0 ? (
          <div className="space-y-3">
            {payouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${
                    payout.status === 'paid' ? 'bg-green-100' :
                    payout.status === 'pending' ? 'bg-yellow-100' : 'bg-gray-100'
                  }`}>
                    {payout.status === 'paid' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : payout.status === 'pending' ? (
                      <Clock className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{formatCurrency(payout.amount)}</p>
                    <p className="text-sm text-gray-600">{payout.date} • {payout.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(payout.status)}`}>
                    {payout.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{payout.method}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No payouts yet</p>
            <p className="text-sm text-gray-500">Payouts will appear here once you start earning</p>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-blue-900 font-medium">All Payment Processing Handled by Stripe</p>
            <p className="text-blue-700 text-sm">
              Your payment information is secure and never stored on Beezio servers.
              All transactions are processed through Stripe's certified payment infrastructure.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}