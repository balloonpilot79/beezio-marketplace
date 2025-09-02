import React, { useState, useEffect } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import { CreditCard, Lock, MapPin, User, Mail, Phone } from 'lucide-react';
import { stripePromise, STRIPE_CONFIG, toStripeAmount, PAYMENT_METHODS_BY_COUNTRY } from '../lib/stripe';
import { useGlobal } from '../contexts/GlobalContext';
import { useAuth } from '../contexts/AuthContext';
import { calculateShippingCost } from '../lib/geolocation';
import { supabase } from '../lib/supabase';

interface PaymentFormProps {
  product: {
    id: string;
    title: string;
    price: number;
    images: string[];
    seller_id: string;
    commission_rate: number;
    shipping_cost: number;
  };
  onSuccess: (paymentIntent: any) => void;
  onError: (error: string) => void;
}

interface BillingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const PaymentFormContent: React.FC<PaymentFormProps> = ({ product, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();
  const { location, currency, formatPrice } = useGlobal();
  const { user, profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    firstName: profile?.full_name?.split(' ')[0] || '',
    lastName: profile?.full_name?.split(' ').slice(1).join(' ') || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
    country: location?.countryCode || 'US',
  });
  
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [shippingInfo, setShippingInfo] = useState<BillingInfo>({ ...billingInfo });
  const [orderSummary, setOrderSummary] = useState({
    subtotal: product.price,
    shipping: 0,
    tax: 0,
    total: product.price,
  });

  // Calculate order totals
  useEffect(() => {
    calculateOrderTotals();
  }, [billingInfo.country, product.price, location]);

  const calculateOrderTotals = () => {
    const subtotal = product.price;
    const shipping = calculateShippingCost(billingInfo.country, 1, subtotal);
    const taxRate = location?.vatRate || 0;
    const tax = (subtotal + shipping) * (taxRate / 100);
    const total = subtotal + shipping + tax;

    setOrderSummary({
      subtotal,
      shipping,
      tax,
      total,
    });
  };

  const handleBillingChange = (field: keyof BillingInfo, value: string) => {
    setBillingInfo(prev => ({ ...prev, [field]: value }));
    
    if (sameAsShipping) {
      setShippingInfo(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleShippingChange = (field: keyof BillingInfo, value: string) => {
    setShippingInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!stripe || !elements) {
      onError('Stripe not loaded');
      return;
    }

    if (!user) {
      onError('Please sign in to complete your purchase');
      return;
    }

    setLoading(true);

    try {
      // Create payment intent on the server
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          amount: toStripeAmount(orderSummary.total, currency),
          currency: currency.toLowerCase(),
          productId: product.id,
          customerId: profile?.stripe_customer_id,
          billingInfo,
          shippingInfo: sameAsShipping ? billingInfo : shippingInfo,
          metadata: {
            productId: product.id,
            sellerId: product.seller_id,
            userId: user.id,
            commissionRate: product.commission_rate,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret, customerId } = await response.json();

      // Update profile with Stripe customer ID if needed
      if (customerId && !profile?.stripe_customer_id) {
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', profile.id);
      }

      // Confirm payment
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: `${billingInfo.firstName} ${billingInfo.lastName}`,
            email: billingInfo.email,
            phone: billingInfo.phone,
            address: {
              line1: billingInfo.address,
              city: billingInfo.city,
              state: billingInfo.state,
              postal_code: billingInfo.postalCode,
              country: billingInfo.country,
            },
          },
        },
        shipping: {
          name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
          address: {
            line1: shippingInfo.address,
            city: shippingInfo.city,
            state: shippingInfo.state,
            postal_code: shippingInfo.postalCode,
            country: shippingInfo.country,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent);
      } else {
        throw new Error('Payment was not successful');
      }

    } catch (error: any) {
      console.error('Payment error:', error);
      onError(error.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': {
          color: '#9ca3af',
        },
      },
    },
    hidePostalCode: true,
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Form */}
        <div className="space-y-6">
          <div className="flex items-center space-x-2 mb-6">
            <Lock className="h-5 w-5 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">{t('payment.title')}</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Billing Information */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <User className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">{t('payment.billing')}</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={billingInfo.firstName}
                    onChange={(e) => handleBillingChange('firstName', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={billingInfo.lastName}
                    onChange={(e) => handleBillingChange('lastName', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={billingInfo.email}
                    onChange={(e) => handleBillingChange('email', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={billingInfo.phone}
                    onChange={(e) => handleBillingChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={billingInfo.address}
                    onChange={(e) => handleBillingChange('address', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={billingInfo.city}
                    onChange={(e) => handleBillingChange('city', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State/Province
                  </label>
                  <input
                    type="text"
                    value={billingInfo.state}
                    onChange={(e) => handleBillingChange('state', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={billingInfo.postalCode}
                    onChange={(e) => handleBillingChange('postalCode', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    value={billingInfo.country}
                    onChange={(e) => handleBillingChange('country', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="DE">Germany</option>
                    <option value="FR">France</option>
                    <option value="IT">Italy</option>
                    <option value="ES">Spain</option>
                    <option value="AU">Australia</option>
                    <option value="JP">Japan</option>
                    {/* Add more countries as needed */}
                  </select>
                </div>
              </div>
            </div>

            {/* Shipping Information */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{t('payment.shipping')}</h3>
                </div>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={sameAsShipping}
                    onChange={(e) => setSameAsShipping(e.target.checked)}
                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-gray-600">Same as billing</span>
                </label>
              </div>
              
              {!sameAsShipping && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Shipping form fields (similar to billing) */}
                  {/* Implementation similar to billing fields above */}
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-2 mb-4">
                <CreditCard className="h-5 w-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">{t('payment.payment_method')}</h3>
              </div>
              
              <div className="p-4 border border-gray-300 rounded-lg">
                <CardElement options={cardElementOptions} />
              </div>
              
              <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600">
                <Lock className="h-4 w-4" />
                <span>Your payment information is secure and encrypted</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!stripe || loading}
              className="w-full bg-amber-500 text-white py-4 px-6 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
            >
              {loading ? t('payment.processing') : `${t('payment.place_order')} - ${formatPrice(orderSummary.total)}`}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 p-6 rounded-lg h-fit">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('payment.order_summary')}</h3>
          
          <div className="space-y-4">
            {/* Product */}
            <div className="flex items-center space-x-4">
              <img
                src={product.images[0] || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=200'}
                alt={product.title}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 line-clamp-2">{product.title}</h4>
                <p className="text-sm text-gray-600">Quantity: 1</p>
              </div>
              <span className="font-semibold text-gray-900">{formatPrice(product.price)}</span>
            </div>
            
            <hr className="border-gray-200" />
            
            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('payment.subtotal')}</span>
                <span className="text-gray-900">{formatPrice(orderSummary.subtotal)}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('payment.shipping_cost')}</span>
                <span className="text-gray-900">
                  {orderSummary.shipping === 0 ? 'Free' : formatPrice(orderSummary.shipping)}
                </span>
              </div>
              
              {orderSummary.tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('payment.tax_amount')} ({location?.vatRate}%)</span>
                  <span className="text-gray-900">{formatPrice(orderSummary.tax)}</span>
                </div>
              )}
              
              <hr className="border-gray-200" />
              
              <div className="flex justify-between text-lg font-semibold">
                <span className="text-gray-900">{t('payment.total_amount')}</span>
                <span className="text-gray-900">{formatPrice(orderSummary.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PaymentForm: React.FC<PaymentFormProps> = (props) => {
  return (
    <Elements stripe={stripePromise} options={STRIPE_CONFIG}>
      <PaymentFormContent {...props} />
    </Elements>
  );
};

export default PaymentForm;