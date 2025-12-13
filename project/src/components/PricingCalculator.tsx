import React, { useEffect, useState } from 'react';
import { Calculator, DollarSign, TrendingUp, CreditCard, Info, Percent } from 'lucide-react';
import {
  calculatePricing,
  formatPricingBreakdown,
  PricingBreakdown,
  STRIPE_FEE_RATE,
  STRIPE_FEE_FIXED,
} from '../lib/pricing';
import { getPlatformRate, normalizeMoneyInput } from '../utils/pricing';

interface PricingCalculatorProps {
  onPricingChange?: (breakdown: PricingBreakdown) => void;
  initialSellerAmount?: number;
  initialAffiliateAmount?: number;
  currency?: string;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  onPricingChange,
  initialSellerAmount = 100,
  initialAffiliateAmount = 10,
  currency = 'USD'
}) => {
  const [input, setInput] = useState({
    sellerAmount: initialSellerAmount,
    affiliateAmount: initialAffiliateAmount,
    affiliateType: 'percent' as 'percent' | 'flat',
  });

  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);

  useEffect(() => {
    if (input.sellerAmount > 0) {
      const calculated = calculatePricing({
        sellerDesiredAmount: input.sellerAmount,
        affiliateRate: input.affiliateAmount,
        affiliateType: input.affiliateType === 'percent' ? 'percentage' : 'flat_rate',
        referralRate: 0,
        platformFeeRate: undefined,
      });
      setBreakdown(calculated);
      onPricingChange?.(calculated);
    } else {
      setBreakdown(null);
      onPricingChange?.(null as any);
    }
  }, [input, onPricingChange]);

  const formatted = breakdown ? formatPricingBreakdown(breakdown, currency) : null;
  const totalFees = breakdown ? breakdown.platformFee + breakdown.stripeFee + (breakdown.taxAmount || 0) : 0;

  const handleNumberChange = (field: keyof typeof input, value: number) => {
    setInput(prev => ({
      ...prev,
      [field]: isNaN(value) ? 0 : value
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6 border-2 border-amber-200">
      <div className="flex items-center space-x-2">
        <Calculator className="h-6 w-6 text-amber-600" />
        <h3 className="text-xl font-bold text-gray-900">Pricing Calculator</h3>
        <span className="text-sm text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Required</span>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Beezio adds fees on top.</p>
          <p>The buyer price includes the affiliate payout, platform share, and Stripe. Shipping is separate and not used in this math.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <DollarSign className="h-4 w-4 text-amber-600" />
            What the seller wants
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-gray-500">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={input.sellerAmount}
              onChange={(e) => handleNumberChange('sellerAmount', parseFloat(e.target.value))}
              onBlur={(e) => handleNumberChange('sellerAmount', parseFloat(normalizeMoneyInput(e.target.value)))}
              className="w-full pl-8 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg font-semibold"
            />
          </div>
          <p className="text-xs text-gray-600">This is the exact payout to the seller.</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            Affiliate commission
          </div>
          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                <Percent className="h-3 w-3" /> Type
              </label>
              <select
                value={input.affiliateType}
                onChange={(e) => setInput(prev => ({ ...prev, affiliateType: e.target.value as 'percent' | 'flat' }))}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm font-semibold"
              >
                <option value="percent">Percent of price</option>
                <option value="flat">Flat per sale</option>
              </select>
            </div>
            <div className="w-1/2">
              <label className="text-xs text-gray-500 mb-1 block">Value</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">
                  {input.affiliateType === 'percent' ? '%' : '$'}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={input.affiliateAmount}
                  onChange={(e) => handleNumberChange('affiliateAmount', parseFloat(e.target.value))}
                  onBlur={(e) => handleNumberChange('affiliateAmount', parseFloat(normalizeMoneyInput(e.target.value)))}
                  className="w-full pl-8 pr-3 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg font-semibold"
                  placeholder={input.affiliateType === 'percent' ? '10' : '5'}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            {input.affiliateType === 'percent'
              ? 'Enter 10 for 10% of your ask.'
              : 'Enter 5 for $5 per sale.'}
          </p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <CreditCard className="h-4 w-4 text-amber-600" />
            Fees we add on top
          </div>
          {formatted && breakdown ? (
            <div className="space-y-2 text-sm text-gray-800">
              <div className="flex justify-between">
                <span>Beezio Platform ({(breakdown.platformFeeRate * 100).toFixed(0)}%)</span>
                <span>{formatted.platform}</span>
              </div>
              <div className="flex justify-between">
                <span>Stripe ({(STRIPE_FEE_RATE * 100).toFixed(1)}% + ${STRIPE_FEE_FIXED.toFixed(2)})</span>
                <span>{formatted.stripe}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-dashed border-gray-300 pt-2">
                <span>Total fees added</span>
                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(totalFees)}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Enter values to see fees.</p>
          )}
        </div>
      </div>

      {formatted && breakdown && (
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-lg">
          <div className="grid sm:grid-cols-3 gap-4 items-center text-center">
            <div>
              <p className="text-sm text-slate-200">Seller keeps</p>
              <p className="text-2xl font-bold text-amber-300">{formatted.seller}</p>
            </div>
            <div>
              <p className="text-sm text-slate-200">Affiliate gets</p>
              <p className="text-2xl font-bold text-amber-300">{formatted.affiliate}</p>
            </div>
            <div>
              <p className="text-sm text-slate-200">Customer pays</p>
              <p className="text-3xl font-black text-white">{formatted.total}</p>
            </div>
          </div>
          <p className="text-xs text-slate-300 text-center mt-3">
            Fees are automatically added so the seller and affiliate receive exactly what you enter.
          </p>
          <p className="text-xs text-slate-400 text-center mt-1">
            Platform rate is calculated automatically based on your ask ({getPlatformRate(breakdown.sellerAmount) * 100}%).
          </p>
        </div>
      )}
    </div>
  );
};

export default PricingCalculator;
