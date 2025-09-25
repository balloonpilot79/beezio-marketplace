import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContextMultiRole'
import {
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Banknote,
  Calendar,
  CheckCircle,
  AlertCircle,
  Settings,
  TrendingUp
} from 'lucide-react'

interface PaymentMethod {
  id: string
  type: 'bank_account' | 'debit_card'
  last4: string
  bank_name?: string
  status: 'active' | 'pending' | 'failed'
  is_default: boolean
}

interface PaymentSetupGuideProps {
  userType: 'seller' | 'affiliate'
  onComplete: () => void
}

export const PaymentSetupGuide: React.FC<PaymentSetupGuideProps> = ({ userType, onComplete }) => {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const steps = [
    {
      title: 'Review Earnings',
      description: 'See how much you can earn',
      icon: TrendingUp
    },
    {
      title: 'Sign Tax Agreements',
      description: 'Complete required tax paperwork',
      icon: CheckCircle
    },
    {
      title: 'Connect Payment Method',
      description: 'Set up where you get paid',
      icon: CreditCard
    },
    {
      title: 'Verify & Complete',
      description: 'Confirm everything is ready',
      icon: Settings
    }
  ]

  const getEarningsEstimate = () => {
    if (userType === 'seller') {
      return {
        potential: '$500-2000/month',
        description: 'From product sales (after platform fees)',
        breakdown: [
          'Product Price: $50',
          'Platform Fee: $5 (10%)',
          'Your Earnings: $45'
        ]
      }
    } else {
      return {
        potential: '$100-1000/month',
        description: 'From referral commissions',
        breakdown: [
          'Product Sale: $50',
          'Commission Rate: 15%',
          'Your Earnings: $7.50'
        ]
      }
    }
  }

  const earnings = getEarningsEstimate()

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Your Earnings Potential</h3>
              <p className="text-gray-600">See what you can earn on Beezio</p>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
              <div className="text-center">
                <p className="text-3xl font-bold mb-2">{earnings.potential}</p>
                <p className="text-green-100">{earnings.description}</p>
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold mb-4">How Earnings Work</h4>
              <div className="space-y-3">
                {earnings.breakdown.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-gray-600">{item.split(':')[0]}</span>
                    <span className="font-medium">{item.split(':')[1]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-blue-900 font-medium">All payments processed by Stripe</p>
                  <p className="text-blue-700 text-sm">Secure, fast, and handled entirely within Beezio</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Tax Agreements</h3>
              <p className="text-gray-600">Required for payment processing</p>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">1099-NEC Agreement</p>
                    <p className="text-sm text-gray-600">For independent contractor status</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Tax Withholding Form</p>
                    <p className="text-sm text-gray-600">W-9 equivalent for tax reporting</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium">Independent Contractor Agreement</p>
                    <p className="text-sm text-gray-600">Legal agreement for payment terms</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-green-900 font-medium">All agreements signed digitally</p>
                  <p className="text-green-700 text-sm">No paperwork - everything handled within Beezio</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Connect Your Payment Method</h3>
              <p className="text-gray-600">Choose how you want to receive payments</p>
            </div>

            <div className="space-y-4">
              <div className="bg-white border-2 border-blue-200 p-6 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Banknote className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Bank Account (Recommended)</h4>
                    <p className="text-sm text-gray-600">Direct deposit to your bank account</p>
                    <ul className="text-xs text-gray-500 mt-2 space-y-1">
                      <li>• Faster processing (1-2 business days)</li>
                      <li>• No fees for transfers</li>
                      <li>• Secure and reliable</li>
                    </ul>
                  </div>
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-6 rounded-lg opacity-60">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <CreditCard className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-400">Debit Card</h4>
                    <p className="text-sm text-gray-400">Instant transfers to debit card</p>
                    <p className="text-xs text-orange-600 mt-2">Available after bank account setup</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-yellow-900 font-medium">Payment method setup happens in the next step</p>
                  <p className="text-yellow-700 text-sm">You'll connect your bank account through Stripe's secure, embedded interface</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Setup Complete!</h3>
              <p className="text-gray-600">You're ready to start earning on Beezio</p>
            </div>

            <div className="bg-green-50 p-6 rounded-lg">
              <div className="flex items-center space-x-3 mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <h4 className="font-semibold text-green-900">What's Next?</h4>
              </div>

              <div className="space-y-3 text-green-800">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span>Start {userType === 'seller' ? 'selling products' : 'promoting products'}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span>Earnings will appear in your dashboard</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span>Payments processed automatically weekly</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                  <span>Tax documents generated automatically</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-blue-900 font-medium">Monitor Everything in Your Dashboard</p>
                  <p className="text-blue-700 text-sm">Track earnings, view payment history, and manage tax documents all in one place</p>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon
            const isActive = index === currentStep
            const isCompleted = index < currentStep

            return (
              <div key={index} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  isCompleted ? 'bg-green-600 text-white' :
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-4 text-center">
          <h2 className="text-lg font-semibold">{steps[currentStep].title}</h2>
          <p className="text-gray-600">{steps[currentStep].description}</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <button
          onClick={() => {
            if (currentStep === steps.length - 1) {
              onComplete()
            } else {
              setCurrentStep(Math.min(steps.length - 1, currentStep + 1))
            }
          }}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </div>
    </div>
  )
}