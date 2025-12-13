import React, { useState } from 'react';
import {
  useStripe,
  useElements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
} from '@stripe/react-stripe-js';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { supabase } from '../lib/supabase';
import { calculatePricing, reverseCalculateFromListingPrice, TAX_RATE, DEFAULT_REFERRAL_RATE } from '../lib/pricing';
import { getReferralAttribution, clearReferralData } from '../utils/referralTracking';

interface CheckoutFormProps {
  amount: number;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { items } = useCart();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [billingDetails, setBillingDetails] = useState({
    name: '',
    email: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
    },
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setProcessing(true);
    setError(null);

    try {
      // Prepare cart metadata with consistent pricing breakdown
      const cartMetadata = items.map(item => {
        const affiliateRate = item.commission_type === 'flat_rate'
          ? item.flat_commission_amount || 0
          : item.commission_rate || 0;
        const breakdown = reverseCalculateFromListingPrice(
          item.price,
          affiliateRate,
          item.commission_type || 'percentage',
          0, // referral handled at checkout level if needed
        );
        return {
          productId: item.productId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          sellerId: item.sellerId || 'unknown',
          // Prefer the seller ask we already have (when available), otherwise derive from listing price.
          sellerDesiredAmount: item.sellerAsk ?? breakdown.sellerAmount,
          commissionRate: affiliateRate,
          affiliateType: item.commission_type || 'percentage',
          affiliateId: item.affiliateId || null,
          affiliateCommissionRate: item.affiliateCommissionRate || affiliateRate,
          affiliateAmount: breakdown.affiliateAmount,
          platformFee: breakdown.platformFee,
          stripeFee: breakdown.stripeFee,
        };
      });

      // compute subtotal and shipping/tax at checkout (not per product)
      const itemsSubtotal = cartMetadata.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const shippingTotal = items.reduce((acc, it) => acc + (it.shippingCost || 0) * it.quantity, 0);
      const taxBase = itemsSubtotal; // tax applied on merchandise
      const taxAmount = Math.round((taxBase * TAX_RATE + Number.EPSILON) * 100) / 100;
      const checkoutTotal = itemsSubtotal + shippingTotal + taxAmount;

      // If Stripe isn’t configured, simulate success for now
      if (!stripe || !elements || !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
        onSuccess('order-placeholder');
        setProcessing(false);
        return;
      }

      const cardElement = elements.getElement(CardNumberElement);

      if (!cardElement) {
        setError('Card element not found');
        setProcessing(false);
        return;
      }

      // Create payment method
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: billingDetails,
      });

      if (paymentMethodError) {
        setError(paymentMethodError.message || 'Payment method creation failed');
        setProcessing(false);
        return;
      }

      // Create payment intent using Supabase function
      const { data, error: functionError } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: Math.round(checkoutTotal * 100), // Convert to cents
          items: cartMetadata,
          userId: user?.id,
          billingName: billingDetails.name,
          billingEmail: billingDetails.email,
          tax: taxAmount,
        },
      });

      if (functionError) {
        throw new Error(`Payment setup failed: ${functionError.message}`);
      }

      const { client_secret, order_id, payment_intent_id } = data;
      const resolvedOrderId = order_id || payment_intent_id;

      if (!resolvedOrderId) {
        throw new Error('Payment setup failed: missing order id');
      }

      // Confirm payment
      const { error: confirmError } = await stripe.confirmCardPayment(client_secret, {
        payment_method: paymentMethod.id,
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment confirmation failed');
        setProcessing(false);
        return;
      }

      // Payment successful - create order record and clear cart
      try {
        const attribution = getReferralAttribution();
        
        // Add affiliate/fundraiser tracking data to items
        const itemsWithAffiliateData = cartMetadata.map(item => {
          // IMPORTANT: the Edge Function expects camelCase `affiliateId`.
          // Referral/recruiter logic is handled server-side (service role) based on the affiliate's profile.
          if (attribution.type === 'affiliate' && attribution.id) {
            return { ...item, affiliateId: attribution.id };
          }

          // Fundraiser attribution isn't currently modeled in the edge function schema.
          // Keep items unchanged here.
          return { ...item, affiliateId: item.affiliateId ?? null };
        });
        
        // Update order status in database
        await supabase.functions.invoke('complete-order-corrected', {
          body: {
            orderId: resolvedOrderId,
            paymentIntentId: payment_intent_id,
            items: itemsWithAffiliateData,
            billingDetails: billingDetails,
            totalPaid: checkoutTotal,
            tax: taxAmount,
            referral: attribution,
          },
        });

        // Clear referral data after successful order
        clearReferralData();

        // Clear the cart after successful order
        localStorage.removeItem('beezio-cart');
        
        // Payment successful
        onSuccess(resolvedOrderId);
      } catch (orderError) {
        console.error('Order completion error:', orderError);
        // Payment went through but order recording failed
        // Still call onSuccess since payment was processed
        onSuccess(resolvedOrderId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setBillingDetails(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setBillingDetails(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Billing Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={billingDetails.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            required
            value={billingDetails.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address *
        </label>
        <input
          type="text"
          required
          value={billingDetails.address.line1}
          onChange={(e) => handleInputChange('address.line1', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address Line 2
        </label>
        <input
          type="text"
          value={billingDetails.address.line2}
          onChange={(e) => handleInputChange('address.line2', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City *
          </label>
          <input
            type="text"
            required
            value={billingDetails.address.city}
            onChange={(e) => handleInputChange('address.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            State *
          </label>
          <input
            type="text"
            required
            value={billingDetails.address.state}
            onChange={(e) => handleInputChange('address.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ZIP Code *
          </label>
          <input
            type="text"
            required
            value={billingDetails.address.postal_code}
            onChange={(e) => handleInputChange('address.postal_code', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Card Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Payment Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Number *
          </label>
          <div className="w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-amber-500 focus-within:border-amber-500">
            <CardNumberElement options={cardElementOptions} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiry Date *
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-amber-500 focus-within:border-amber-500">
              <CardExpiryElement options={cardElementOptions} />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CVC *
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-amber-500 focus-within:border-amber-500">
              <CardCvcElement options={cardElementOptions} />
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-700 text-sm">{error}</div>
        </div>
      )}

      {/* Transparent Pricing Breakdown */}
      {items.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-amber-900 mb-3 flex items-center">
            💰 Transparent Pricing - Where Your Money Goes
          </h3>
          <div className="space-y-3">
            {items.map((item) => {
              const pricing = calculatePricing({
                sellerDesiredAmount: item.price,
                affiliateRate: item.commission_type === 'flat_rate' 
                  ? item.flat_commission_amount || 0
                  : item.commission_rate || 0,
                affiliateType: item.commission_type || 'percentage'
              });
              const formatted = formatPricingBreakdown(pricing);
              
              return (
                <div key={item.id} className="border-b border-amber-200 pb-2 last:border-b-0">
                  <div className="font-medium text-amber-900 mb-1">{item.title}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">🎯 Seller gets:</span>
                      <span className="font-medium text-green-600">{formatted.seller}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">🎁 Affiliate earns:</span>
                      <span className="font-medium text-blue-600">{formatted.affiliate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">🏢 Platform fee:</span>
                      <span className="font-medium text-purple-600">{formatted.platform}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">💳 Processing:</span>
                      <span className="font-medium text-gray-600">{formatted.stripe}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-amber-300">
              <div className="flex justify-between items-center font-semibold text-amber-900">
                <span>Total you pay:</span>
                <span className="text-lg">${amount.toFixed(2)}</span>
              </div>
              <p className="text-xs text-amber-700 mt-1">
                ✨ No hidden fees - everyone wins with transparent pricing!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-amber-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Your payment information is secure and encrypted
      </p>
    </form>
  );
};

export default CheckoutForm;
