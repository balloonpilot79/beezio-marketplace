import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, TrendingUp, CreditCard, Info } from 'lucide-react';
import { 
  calculatePricing, 
  formatPricingBreakdown, 
  validatePricingInput,
  getRecommendedAffiliateRates,
  PricingBreakdown,
  PricingInput 
} from '../lib/pricing';

interface PricingCalculatorProps {
  onPricingChange?: (breakdown: PricingBreakdown) => void;
  initialSellerAmount?: number;
  initialAffiliateRate?: number;
  initialAffiliateType?: 'percentage' | 'flat_rate';
  currency?: string;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  onPricingChange,
  initialSellerAmount = 100,
  initialAffiliateRate = 20,
  initialAffiliateType = 'percentage',
  currency = 'USD'
}) => {
  const [input, setInput] = useState<PricingInput>({
    sellerDesiredAmount: initialSellerAmount,
    affiliateRate: initialAffiliateRate,
    affiliateType: initialAffiliateType,
  });

  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Calculate pricing whenever input changes
  useEffect(() => {
    const validationErrors = validatePricingInput(input);
    setErrors(validationErrors);

    if (validationErrors.length === 0) {
      const newBreakdown = calculatePricing(input);
      setBreakdown(newBreakdown);
      onPricingChange?.(newBreakdown);
    } else {
      setBreakdown(null);
      onPricingChange?.(null as any);
    }
  }, [input, onPricingChange]);

  const handleInputChange = (field: keyof PricingInput, value: number | string) => {
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

  const recommendations = getRecommendedAffiliateRates(input.sellerDesiredAmount);
  const formattedBreakdown = breakdown ? formatPricingBreakdown(breakdown, currency) : null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center space-x-2 mb-4">
        <Calculator className="h-6 w-6 text-amber-600" />
        <h3 className="text-xl font-bold text-gray-900">Pricing Calculator</h3>
      </div>

      {/* Fee Structure Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Info className="h-5 w-5 text-blue-600" />
          <h4 className="font-semibold text-blue-900">How Beezio Pricing Works</h4>
        </div>
        <p className="text-blue-800 text-sm">
          <strong>Simple Formula:</strong> Seller Amount + 10% Platform Fee + Affiliate Commission + 3% Stripe Fee = Final Listing Price
        </p>
        <p className="text-blue-700 text-xs mt-1">
          ✓ Sellers pay nothing - you get 100% of your desired amount<br/>
          ✓ All fees are added on top of what you want to earn
        </p>
      </div>

      {/* Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seller Desired Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <DollarSign className="h-4 w-4 inline mr-1" />
            How much do you want to make per sale?
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={input.sellerDesiredAmount}
              onChange={(e) => handleInputChange('sellerDesiredAmount', parseFloat(e.target.value) || 0)}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="100.00"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">This is exactly what you'll receive per sale</p>
        </div>

        {/* Affiliate Commission */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <TrendingUp className="h-4 w-4 inline mr-1" />
            Affiliate Commission (You Choose the Rate)
          </label>
          <p className="text-xs text-gray-600 mb-2">
            Set how much affiliates earn for promoting YOUR product - this is added ON TOP of your profit
          </p>
          
          <div className="flex space-x-2 mb-2">
            <select
              value={input.affiliateType}
              onChange={(e) => handleInputChange('affiliateType', e.target.value as 'percentage' | 'flat_rate')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="percentage">Percentage</option>
              <option value="flat_rate">Flat Rate</option>
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

          <p className="text-xs text-green-700 mt-1 font-medium">
            ✓ This commission does NOT come out of your profit - it's added to the final price
          </p>

          <button
            type="button"
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="text-xs text-amber-600 hover:text-amber-700 underline"
          >
            Show recommended rates
          </button>

          {showRecommendations && (
            <div className="mt-2 p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Recommended rates for your price range:</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => applyRecommendedRate(recommendations.low)}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  Low: {recommendations.low}%
                </button>
                <button
                  onClick={() => applyRecommendedRate(recommendations.medium)}
                  className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                >
                  Medium: {recommendations.medium}%
                </button>
                <button
                  onClick={() => applyRecommendedRate(recommendations.high)}
                  className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  High: {recommendations.high}%
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">Please fix these issues:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Pricing Breakdown */}
      {breakdown && formattedBreakdown && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Pricing Breakdown</h4>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-amber-200">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-gray-700">Your earnings (seller)</span>
              </div>
              <span className="font-semibold text-green-600">{formattedBreakdown.seller}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-amber-200">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="text-gray-700">Affiliate commission</span>
              </div>
              <span className="font-semibold text-blue-600">{formattedBreakdown.affiliate}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-amber-200">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="text-gray-700">Beezio platform fee (10% of seller amount)</span>
              </div>
              <span className="font-semibold text-amber-600">{formattedBreakdown.platform}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-amber-200">
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <span className="text-gray-700">Stripe processing fee (3%)</span>
              </div>
              <span className="font-semibold text-purple-600">{formattedBreakdown.stripe}</span>
            </div>

            <div className="flex justify-between items-center py-3 bg-white rounded-lg px-4 border-2 border-amber-300">
              <span className="text-lg font-bold text-gray-900">Customer pays (listing price)</span>
              <span className="text-xl font-bold text-amber-600">{formattedBreakdown.total}</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>🎯 Perfect Control:</strong> You set your profit ({formattedBreakdown.seller}) and affiliate rate ({formattedBreakdown.affiliate}). 
              All fees are added on top - you keep exactly what you want!
            </p>
            <p className="text-xs text-green-700 mt-1">
              Platform fee: {formattedBreakdown.platform} • Processing: {formattedBreakdown.stripe} • Your control = 100%
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingCalculator;