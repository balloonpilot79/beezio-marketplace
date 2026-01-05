import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Lock, 
  CreditCard, 
  User, 
  MapPin, 
  Shield,
  CheckCircle,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useAffiliate } from '../contexts/AffiliateContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getReferralAttribution } from '../utils/referralTracking';
import { recordOrderWithPayouts } from '../lib/orderPersistence';
import {
  computePayoutBreakdown,
  deriveAskPriceFromFinalPrice,
  type PayoutBreakdown,
} from '../utils/pricingEngine';
import { DEFAULT_PAYOUT_SETTINGS, PLATFORM_FEE_PERCENT } from '../config/beezioConfig';
import { supabase } from '../lib/supabase'; // Import supabase

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface OrderSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  affiliateCommission: number;
  fundraiserCommission: number;
  beezioCommission: number;
  stripeFee: number;
  referralBonus: number;
  sellerPayout: number;
  lineItems: Array<{
    productId: string;
    title: string;
    sellerId: string;
    sellerName: string;
    quantity: number;
    salePrice: number;
    sellerAsk: number;
    affiliateRate: number;
    payouts: PayoutBreakdown;
    shippingCost: number;
  }>;
}

interface CheckoutFormData {
  email: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

const CheckoutForm: React.FC<{ onSubmit: (data: any) => void; isLoading: boolean }> = ({ onSubmit, isLoading }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [formData, setFormData] = useState<CheckoutFormData>({
    email: user?.email || '',
    firstName: '',
    lastName: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    phone: ''
  });
  const [errors, setErrors] = useState<Partial<CheckoutFormData>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return;
    }

    // Create payment method
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
      billing_details: {
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        phone: formData.phone,
        address: {
          line1: formData.address,
          city: formData.city,
          state: formData.state,
          postal_code: formData.zipCode,
          country: 'US'
        }
      }
    });

    if (error) {
      console.error('Payment method creation failed:', error);
      return;
    }

    onSubmit({
      paymentMethod,
      customerInfo: formData
    });
  };

  const handleChange = (field: keyof CheckoutFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <User className="w-5 h-5 mr-2 text-blue-600" />
          Customer Information
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-blue-600" />
          Shipping Address
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input
                type="text"
                required
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                required
                value={formData.zipCode}
                onChange={(e) => handleChange('zipCode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Payment Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
          Payment Information
        </h3>
        
        <div className="p-4 border border-gray-300 rounded-lg">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#374151',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  '::placeholder': {
                    color: '#9CA3AF'
                  }
                }
              }
            }}
          />
        </div>
        
        <div className="mt-4 flex items-center text-sm text-gray-600">
          <Lock className="w-4 h-4 mr-2 text-green-600" />
          Your payment information is encrypted and secure
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || isLoading}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Processing...
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Shield className="w-5 h-5 mr-2" />
            Complete Secure Payment
          </div>
        )}
      </button>
    </form>
  );
};

const EnhancedCheckoutPage: React.FC = () => {
  const { items, getShippingTotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { trackSale } = useAffiliate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [fundraiserId, setFundraiserId] = useState<string | null>(null);
  const [referralAffiliateId, setReferralAffiliateId] = useState<string | null>(null);

  // Check for affiliate or fundraiser reference using new referral system
  useEffect(() => {
    const attribution = getReferralAttribution();
    
    if (attribution.type === 'fundraiser' && attribution.id) {
      setFundraiserId(attribution.id);
      setAffiliateId(null);
    } else if (attribution.type === 'affiliate' && attribution.id) {
      setAffiliateId(attribution.id);
      setFundraiserId(null);
    }
  }, [searchParams]);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/signup?redirect=/checkout');
    }
  }, [user, navigate]);

  // If a sale is attributed to an affiliate, check whether that affiliate was recruited by another affiliate.
  // If yes, Beezio splits its 15% platform fee into 10% (Beezio) + 5% (recruiter) for life.
  useEffect(() => {
    const fetchRecruiter = async () => {
      try {
        if (!affiliateId) {
          setReferralAffiliateId(null);
          return;
        }

        // affiliateId should be a UUID profile id, but we keep referral_code fallback for safety.
        const { data, error } = await supabase
          .from('profiles')
          .select('id, referred_by_affiliate_id')
          .or(`id.eq.${affiliateId},referral_code.ilike.${affiliateId}`)
          .maybeSingle();

        if (error && (error as any).code !== 'PGRST116') {
          console.warn('Recruiter lookup warning:', error);
        }

        setReferralAffiliateId((data as any)?.referred_by_affiliate_id ?? null);
      } catch (e) {
        console.warn('Recruiter lookup failed (non-blocking):', e);
        setReferralAffiliateId(null);
      }
    };

    fetchRecruiter();
  }, [affiliateId]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  // Calculate order summary using unified pricing helpers
  const calculateOrderSummary = (): OrderSummary => {
    const attribution = getReferralAttribution();
    const lineItems = items.map((item) => {
      const commissionType = item.commission_type ?? 'percentage';
      const affiliateRate =
        commissionType === 'flat_rate'
          ? 0
          : typeof item.commission_rate === 'number' && Number.isFinite(item.commission_rate)
          ? item.commission_rate
          : DEFAULT_PAYOUT_SETTINGS.affiliatePercent;

      const payout = {
        affiliatePercent: affiliateRate,
        platformPercent: PLATFORM_FEE_PERCENT,
        fundraiserPercent: DEFAULT_PAYOUT_SETTINGS.fundraiserPercent,
      };

      // Cart stores customer-facing price per unit.
      const salePrice = item.price;

      // Cart SHOULD store sellerAsk; if not, derive it from the final price using the same payout config.
      const sellerAsk =
        typeof item.sellerAsk === 'number' && Number.isFinite(item.sellerAsk) && item.sellerAsk > 0
          ? item.sellerAsk
          : deriveAskPriceFromFinalPrice(salePrice, payout);

      const payouts = computePayoutBreakdown(salePrice, sellerAsk, payout, {
        referralOverrideEnabled: Boolean(referralAffiliateId) && attribution.type === 'affiliate',
      });

      return {
        productId: item.productId,
        title: item.title,
        sellerId: item.sellerId,
        sellerName: item.sellerName,
        quantity: item.quantity,
        salePrice,
        sellerAsk,
        affiliateRate,
        payouts,
        shippingCost: item.shippingCost || 0,
      };
    });

    const subtotal = lineItems.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
    const shipping = getShippingTotal();
    const tax = subtotal * 0.08; // placeholder tax (adjust if needed)

    const payoutTotals = lineItems.reduce(
      (acc, line) => {
        acc.affiliateCommission += line.payouts.affiliateAmount * line.quantity;
        acc.fundraiserCommission += line.payouts.fundraiserAmount * line.quantity;
        acc.beezioCommission += line.payouts.beezioNetAmount * line.quantity;
        acc.referralBonus += line.payouts.referralAffiliateAmount * line.quantity;
        acc.sellerPayout += line.payouts.sellerAmount * line.quantity;
        acc.stripeFee += (line.payouts.stripePercentAmount + line.payouts.stripeFixedFee) * line.quantity;
        return acc;
      },
      {
        affiliateCommission: 0,
        fundraiserCommission: 0,
        beezioCommission: 0,
        referralBonus: 0,
        sellerPayout: 0,
        stripeFee: 0,
      }
    );

    const total = subtotal + shipping + tax;

    return {
      subtotal,
      shipping,
      tax,
      total,
      affiliateCommission: payoutTotals.affiliateCommission,
      fundraiserCommission: payoutTotals.fundraiserCommission,
      beezioCommission: payoutTotals.beezioCommission,
      stripeFee: payoutTotals.stripeFee,
      referralBonus: payoutTotals.referralBonus,
      sellerPayout: payoutTotals.sellerPayout,
      lineItems,
    };
  };

  const handlePayment = async (paymentData: any) => {
    setIsLoading(true);
    
    try {
      void paymentData;
      const orderSummary = calculateOrderSummary();
      const attribution = getReferralAttribution();

      const resolvedAffiliateId = attribution.type === 'affiliate' ? attribution.id : null;
      const resolvedFundraiserId = attribution.type === 'fundraiser' ? attribution.id : null;
      const resolvedReferralAffiliateId =
        attribution.type === 'affiliate' && referralAffiliateId ? referralAffiliateId : null;

      // Persist order + payouts directly to Supabase (best effort if RLS allows)
      try {
        await recordOrderWithPayouts({
          userId: user?.id || '',
          storefrontId: null,
          affiliateId: resolvedAffiliateId,
          referralAffiliateId: resolvedReferralAffiliateId,
          fundraiserId: resolvedFundraiserId,
          summary: {
            subtotal: orderSummary.subtotal,
            shipping: orderSummary.shipping,
            tax: orderSummary.tax,
            total: orderSummary.total,
          },
          lines: orderSummary.lineItems.map(line => ({
            productId: line.productId,
            title: line.title,
            sellerId: line.sellerId,
            sellerName: line.sellerName,
            quantity: line.quantity,
            salePrice: line.salePrice,
            sellerAsk: line.sellerAsk,
            affiliateRate: line.affiliateRate,
            payout: line.payouts,
            shippingCost: line.shippingCost,
          })),
        });
        console.log('✅ Order persisted successfully to database');
      } catch (persistError) {
        console.error('❌ Order persistence failed:', persistError);
        // Non-fatal: orders and payouts are persisted server-side (Stripe webhooks / Edge Functions).
      }

      // Track affiliate sales if applicable
      if (resolvedAffiliateId) {
        orderSummary.lineItems.forEach(line => {
          trackSale(
            line.productId,
            resolvedAffiliateId,
            line.salePrice * line.quantity,
            line.payouts.affiliateAmount * line.quantity
          );
        });
      }

      // Track fundraiser sales and update goal progress
      if (resolvedFundraiserId) {
        const totalCommission = orderSummary.fundraiserCommission;
        
        // Update fundraiser's current_raised amount
        import('../lib/supabase').then(({ supabase }) => {
          supabase.rpc('increment_fundraiser_raised', {
            p_fundraiser_id: resolvedFundraiserId,
            p_amount: totalCommission
          }).then(({ error }) => {
            if (error) console.error('Error updating fundraiser goal:', error);
          });
        });
      }

      // Clear cart
      clearCart();
      
      // Redirect to success page
      navigate(`/order-confirmation?orderId=${Date.now()}&affiliate=${resolvedAffiliateId || 'none'}`);
      
    } catch (error) {
      console.error('Payment failed:', error);
      // Handle error - show error message to user
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || items.length === 0) {
    return null; // Will redirect
  }

  const orderSummary = calculateOrderSummary();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/cart"
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Cart
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Secure Checkout</h1>
          </div>
          
          {(affiliateId || fundraiserId) && (
            <div className={`border rounded-lg px-4 py-2 ${fundraiserId ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center">
                <CheckCircle className={`w-5 h-5 mr-2 ${fundraiserId ? 'text-green-600' : 'text-blue-600'}`} />
                <span className={`text-sm font-medium ${fundraiserId ? 'text-green-800' : 'text-blue-800'}`}>
                  {fundraiserId ? 'Supporting Fundraiser' : 'Referred by Affiliate'}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <Elements stripe={stripePromise}>
              <CheckoutForm onSubmit={handlePayment} isLoading={isLoading} />
            </Elements>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
              
              {/* Items */}
              <div className="space-y-4 mb-6">
                {orderSummary.lineItems.map(line => {
                  const cartItem = items.find((i) => i.productId === line.productId);
                  return (
                  <div key={line.productId} className="flex items-center space-x-3">
                    <img
                      src={cartItem?.image || '/api/placeholder/64/64'}
                      alt={line.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{line.title}</p>
                      <p className="text-sm text-gray-500">Qty: {line.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ${(line.salePrice * line.quantity).toFixed(2)}
                    </p>
                  </div>
                );
                })}
              </div>

              {/* Pricing Breakdown */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">${orderSummary.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-900">${orderSummary.shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span className="text-gray-900">${orderSummary.tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">${orderSummary.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Shield className="w-4 h-4 mr-1 text-green-600" />
                    SSL Secured
                  </div>
                  <div className="flex items-center">
                    <Lock className="w-4 h-4 mr-1 text-green-600" />
                    256-bit Encryption
                  </div>
                </div>
                <p className="text-xs text-center text-gray-500 mt-2">
                  Your payment information is secure and encrypted
                </p>
              </div>

              {/* 100% Transparency Message */}
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
                Your total includes all marketplace pricing. Taxes and shipping are shown here; we keep the checkout clean without payout or commission breakdowns.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCheckoutPage;
