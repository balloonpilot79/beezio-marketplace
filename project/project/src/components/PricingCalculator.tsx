import React, { useEffect, useState } from 'react';
import { Calculator, DollarSign, Percent, TrendingUp } from 'lucide-react';
import {
  calculatePricing,
  formatPricingBreakdown,
  PricingBreakdown,
} from '../lib/pricing';
import { normalizeMoneyInput } from '../utils/pricing';

interface PricingCalculatorProps {
  onPricingChange?: (breakdown: PricingBreakdown) => void;
  initialSellerAmount?: number;
  initialAffiliateAmount?: number;
  initialAffiliateType?: 'percent' | 'flat';
  shippingAmount?: number;
  includeShippingInPrice?: boolean;
  currency?: string;
  testItem?: boolean;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  onPricingChange,
  initialSellerAmount = 100,
  initialAffiliateAmount = 10,
  initialAffiliateType = 'percent',
  shippingAmount = 0,
  includeShippingInPrice = false,
  currency = 'USD',
  testItem = false,
}) => {
  const [input, setInput] = useState({
    sellerAmount: initialSellerAmount,
    affiliateAmount: initialAffiliateAmount,
    affiliateType: initialAffiliateType,
  });
  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);

  useEffect(() => {
    setInput({
      sellerAmount: initialSellerAmount,
      affiliateAmount: initialAffiliateAmount,
      affiliateType: initialAffiliateType,
    });
  }, [initialAffiliateAmount, initialAffiliateType, initialSellerAmount]);

  useEffect(() => {
    if (input.sellerAmount > 0) {
      const calculated = calculatePricing({
        sellerDesiredAmount: input.sellerAmount,
        affiliateRate: input.affiliateAmount,
        affiliateType: input.affiliateType === 'percent' ? 'percentage' : 'flat_rate',
        shippingIncludedAmount: includeShippingInPrice ? shippingAmount : 0,
        referralRate: 0,
        platformFeeRate: undefined,
        testItem,
      });
      setBreakdown(calculated);
      onPricingChange?.(calculated);
      return;
    }

    setBreakdown(null);
    onPricingChange?.(null as any);
  }, [includeShippingInPrice, input, onPricingChange, shippingAmount, testItem]);

  const formatted = breakdown ? formatPricingBreakdown(breakdown, currency) : null;

  const handleNumberChange = (field: keyof typeof input, value: number) => {
    setInput((prev) => ({
      ...prev,
      [field]: Number.isNaN(value) ? 0 : value,
    }));
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6 border-2 border-amber-200">
      <div className="flex items-center space-x-2">
        <Calculator className="h-6 w-6 text-amber-600" />
        <h3 className="text-xl font-bold text-gray-900">Pricing Calculator</h3>
        <span className="text-sm text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Required</span>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Set your payout and optional affiliate commission.</p>
        <p className="mt-1">
          Enter the amount you want to receive from the sale. The customer price updates automatically.
          {includeShippingInPrice && shippingAmount > 0
            ? ` Shipping is included at ${new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(shippingAmount)}.`
            : ' Shipping stays separate unless you include it in the item price.'}
        </p>
        <p className="mt-1">
          Use the preview below to confirm the seller amount, affiliate amount, and customer total before saving.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <DollarSign className="h-4 w-4 text-amber-600" />
            Seller payout
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
          <p className="text-xs text-gray-600">This is the amount you want to receive from the sale.</p>
          {includeShippingInPrice && shippingAmount > 0 ? (
            <p className="text-xs text-amber-700">Shipping is included in the item price.</p>
          ) : null}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            Affiliate commission
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                <Percent className="h-3 w-3" /> Type
              </label>
              <select
                value={input.affiliateType}
                onChange={(e) => setInput((prev) => ({ ...prev, affiliateType: e.target.value as 'percent' | 'flat' }))}
                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm font-semibold"
              >
                <option value="percent">Percent of ask</option>
                <option value="flat">Flat per sale</option>
              </select>
            </div>
            <div>
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
              : 'Flat is in dollars. Enter 0.11 for 11 cents.'}
          </p>
          {input.affiliateType === 'flat' && input.affiliateAmount >= 1 && input.sellerAmount <= 1 ? (
            <p className="text-xs text-amber-700">
              Heads up: this flat commission is interpreted as ${input.affiliateAmount.toFixed(2)} per sale.
            </p>
          ) : null}
        </div>
      </div>

      {formatted && breakdown ? (
        <div className="bg-slate-900 text-white rounded-xl p-6 shadow-lg">
          <div className="grid sm:grid-cols-3 gap-4 items-center text-center">
            <div>
              <p className="text-sm text-slate-200">{includeShippingInPrice && shippingAmount > 0 ? 'Seller gets incl. shipping' : 'Seller keeps'}</p>
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
          <p className="mt-3 text-center text-xs text-slate-300">
            Sellers keep exactly what you enter in the seller field, and affiliates receive exactly what you enter in the commission field.
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default PricingCalculator;
