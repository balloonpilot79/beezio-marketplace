import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, TrendingUp, CreditCard, Info, AlertTriangle, Users } from 'lucide-react';
import {
  reverseCalculateFromListingPrice,
  formatPricingBreakdown,
  getRecommendedAffiliateRates,
  PricingBreakdown,
  TAX_RATE,
  DEFAULT_PLATFORM_FEE_RATE,
  STRIPE_FEE_RATE,
  STRIPE_FEE_FIXED
} from '../lib/pricing';

interface PricingCalculatorProps {
  onPricingChange?: (breakdown: PricingBreakdown) => void;
  initialListingPrice?: number;
  initialAffiliateRate?: number;
  initialAffiliateType?: 'percentage' | 'flat_rate';
  initialReferralRate?: number;
  initialPlatformFeeRate?: number;
  currency?: string;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  onPricingChange,
  initialListingPrice = 129.99,
  initialAffiliateRate = 20,
  initialAffiliateType = 'percentage',
  initialReferralRate = 0,
  initialPlatformFeeRate = DEFAULT_PLATFORM_FEE_RATE * 100,
  currency = 'USD'
}) => {
  const [input, setInput] = useState({
    listingPrice: initialListingPrice,
    affiliateRate: initialAffiliateRate,
    affiliateType: initialAffiliateType as 'percentage' | 'flat_rate',
    referralRate: initialReferralRate,
    platformFeeRate: initialPlatformFeeRate,
  });

  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Calculate pricing whenever input changes
  useEffect(() => {
    if (input.listingPrice > 0) {
      try {
        const newBreakdown = reverseCalculateFromListingPrice(
          input.listingPrice,
          input.affiliateRate,
          input.affiliateType,
          input.referralRate,
          input.platformFeeRate / 100
        );
        setBreakdown(newBreakdown);
        setErrors([]);
        onPricingChange?.(newBreakdown);
      } catch (error) {
        setBreakdown(null);
        setErrors(['Invalid pricing calculation']);
        onPricingChange?.(null as any);
      }
    } else {
      setBreakdown(null);
      setErrors(['Please enter a valid listing price']);
      onPricingChange?.(null as any);
    }
  }, [input, onPricingChange]);

  const handleInputChange = (field: string, value: number | string) => {
    setInput(prev => ({
      ...prev,
      [field]: typeof value === 'string' ? value : value,
    }));
  };

  const applyRecommendedRate = (rate: number) => {
    setInput(prev => ({
      ...prev,
      affiliateRate: rate,
    }));
    setShowRecommendations(false);
  };

  const recommendations = breakdown ? getRecommendedAffiliateRates(breakdown.sellerAmount) : { low: 15, medium: 20, high: 25 };
  const formattedBreakdown = breakdown ? formatPricingBreakdown(breakdown, currency) : null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6 border-2 border-amber-200">
      <div className="flex items-center space-x-2 mb-4">
        <Calculator className="h-6 w-6 text-amber-600" />
        <h3 className="text-xl font-bold text-gray-900">Pricing Calculator</h3>
        <span className="text-sm text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Required</span>
      </div>

      {/* Fee Structure Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Info className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-blue-900">How Beezio Pricing Works</h4>
        </div>
        <p className="text-blue-800 text-sm">
          <strong>Enter your final selling price</strong> (what customers pay) and we'll calculate what you'll actually receive after all fees.
        </p>
        <div className="text-blue-700 text-xs mt-2 space-y-1">
          <div><strong>Platform Fees:</strong></div>
          <div>• Beezio Platform Fee: {input.platformFeeRate}% (configurable 10-15%)</div>
          <div>• Stripe Processing: {STRIPE_FEE_RATE * 100}% + ${STRIPE_FEE_FIXED.toFixed(2)}</div>
          <div>• Sales Tax: {Math.round(TAX_RATE * 100)}% (estimated)</div>
          {input.referralRate > 0 && (
            <div className="text-amber-700 mt-2">
              <Users className="h-3 w-3 inline mr-1" />
              <strong>Referral Bonus:</strong> {input.referralRate}% (for users who refer others)
            </div>
          )}
        </div>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Final Selling Price Input */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="h-4 w-4 inline mr-1" />
            Final Selling Price (What customers pay)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={input.listingPrice}
              onChange={(e) => handleInputChange('listingPrice', parseFloat(e.target.value) || 0)}
              className="w-full pl-8 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg font-semibold"
              placeholder="129.99"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">This is the price customers will see and pay</p>
        </div>

        {/* Affiliate Commission */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <TrendingUp className="h-4 w-4 inline mr-1" />
            Affiliate Commission Rate (Editable)
          </label>
          <p className="text-xs text-gray-600 mb-3">
            Choose how much affiliates earn for promoting your product. Higher rates attract more affiliates but reduce your earnings.
          </p>

          <div className="flex space-x-3 mb-3">
            <select
              value={input.affiliateType}
              onChange={(e) => handleInputChange('affiliateType', e.target.value as 'percentage' | 'flat_rate')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="percentage">Percentage of Sale</option>
              <option value="flat_rate">Flat Dollar Amount</option>
            </select>

            <div className="relative flex-1">
              {input.affiliateType === 'flat_rate' && (
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
              )}
              <input
                type="number"
                min="0"
                step={input.affiliateType === 'percentage' ? '1' : '0.01'}
                value={input.affiliateRate}
                onChange={(e) => handleInputChange('affiliateRate', parseFloat(e.target.value) || 0)}
                className={`w-full ${input.affiliateType === 'flat_rate' ? 'pl-8' : 'pl-3'} pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500`}
                placeholder={input.affiliateType === 'percentage' ? '20' : '25.00'}
              />
              {input.affiliateType === 'percentage' && (
                <span className="absolute right-3 top-2.5 text-gray-500">%</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="text-xs text-amber-600 hover:text-amber-700 underline"
          >
            Show recommended rates for this price range
          </button>

          {showRecommendations && (
            <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-gray-600 mb-2">Recommended affiliate rates:</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => applyRecommendedRate(recommendations.low)}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium"
                >
                  Conservative: {recommendations.low}%
                </button>
                <button
                  onClick={() => applyRecommendedRate(recommendations.medium)}
                  className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 font-medium"
                >
                  Standard: {recommendations.medium}%
                </button>
                <button
                  onClick={() => applyRecommendedRate(recommendations.high)}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium"
                >
                  Aggressive: {recommendations.high}%
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Settings: Referral & Platform Fee */}
        <div className="md:col-span-2 border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Advanced Fee Settings</h4>
            <span className="text-xs text-gray-500">Optional - Only change if needed</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Referral Commission Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="h-4 w-4 inline mr-1" />
                Referral Commission (2-5%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.5"
                  value={input.referralRate}
                  onChange={(e) => handleInputChange('referralRate', parseFloat(e.target.value) || 0)}
                  className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="3"
                />
                <span className="absolute right-3 top-2.5 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Commission for users who refer others (0% = disabled)
              </p>
            </div>

            {/* Platform Fee Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calculator className="h-4 w-4 inline mr-1" />
                Beezio Platform Fee (10-15%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="15"
                  step="0.5"
                  value={input.platformFeeRate}
                  onChange={(e) => handleInputChange('platformFeeRate', parseFloat(e.target.value) || 10)}
                  className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="10"
                />
                <span className="absolute right-3 top-2.5 text-gray-500">%</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Platform fee (typically 10%, contact support to adjust)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h4 className="text-sm font-medium text-red-800">Please fix these issues:</h4>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pricing Breakdown */}
      {breakdown && (
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">💰 Your Earnings Breakdown</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* What You Keep */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <DollarSign className="h-5 w-5 text-green-600" />
                <h5 className="font-semibold text-green-900">What You Keep</h5>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Your Profit:</span>
                  <span className="font-bold text-green-700">${breakdown.sellerAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Affiliate Commission:</span>
                  <span className="font-bold text-blue-700">${breakdown.affiliateAmount.toFixed(2)}</span>
                </div>
                {breakdown.referralAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Referral Bonus ({breakdown.referralRate}%):</span>
                    <span className="font-bold text-amber-700">${breakdown.referralAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-green-300 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span className="text-green-900">Total You Keep:</span>
                    <span className="text-green-700">${(breakdown.sellerAmount + breakdown.affiliateAmount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fees Deducted */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <CreditCard className="h-5 w-5 text-red-600" />
                <h5 className="font-semibold text-red-900">Fees (Auto-Deducted)</h5>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Beezio Platform ({breakdown.platformFeeRate * 100}%):</span>
                  <span className="font-bold text-red-700">${breakdown.platformFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Stripe Processing:</span>
                  <span className="font-bold text-red-700">${breakdown.stripeFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sales Tax (est.):</span>
                  <span className="font-bold text-red-700">${(breakdown.taxAmount || 0).toFixed(2)}</span>
                </div>
                <div className="border-t border-red-300 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span className="text-red-900">Total Fees:</span>
                    <span className="text-red-700">${(breakdown.platformFee + breakdown.stripeFee + (breakdown.taxAmount || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-6 bg-white border-2 border-amber-300 rounded-lg p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 mb-2">
                Customer Pays: ${breakdown.listingPrice.toFixed(2)}
              </div>
              <div className="text-lg text-green-700 font-semibold">
                You Receive: ${(breakdown.sellerAmount + breakdown.affiliateAmount).toFixed(2)}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Profit Margin: {(((breakdown.sellerAmount + breakdown.affiliateAmount) / breakdown.listingPrice) * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              <strong>✅ Ready to save:</strong> This pricing will be automatically applied when you create your product.
              You can always edit the affiliate commission rate later, but the platform fees are fixed.
            </p>
          </div>

          {/* Shipping Cost Information */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h5 className="font-semibold text-blue-900">🚚 Shipping Costs (Your Control)</h5>
            </div>
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>✅ Shipping is 100% separate from platform fees</strong></p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="bg-white p-2 rounded border">
                  <div className="text-xs text-gray-600">Example: FREE Shipping</div>
                  <div className="font-semibold">Product: ${breakdown.listingPrice.toFixed(2)}</div>
                  <div className="text-green-600">Shipping: $0.00</div>
                  <div className="border-t pt-1 font-bold">Total: ${breakdown.listingPrice.toFixed(2)}</div>
                </div>
                <div className="bg-white p-2 rounded border">
                  <div className="text-xs text-gray-600">Example: $8.99 Shipping</div>
                  <div className="font-semibold">Product: ${breakdown.listingPrice.toFixed(2)}</div>
                  <div className="text-blue-600">Shipping: $8.99</div>
                  <div className="border-t pt-1 font-bold">Total: ${(breakdown.listingPrice + 8.99).toFixed(2)}</div>
                </div>
              </div>
              <div className="text-xs text-blue-700 mt-2 space-y-1">
                <div>• You set shipping costs when creating your product</div>
                <div>• Shipping revenue goes 100% to you (no platform fees)</div>
                <div>• Offer multiple options: Standard, Express, Overnight</div>
                <div>• FREE shipping can increase conversion rates by 40%+</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingCalculator;