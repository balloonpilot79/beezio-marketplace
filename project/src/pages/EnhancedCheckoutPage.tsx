import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Lock, 
  CreditCard, 
  User, 
  MapPin, 
  Mail, 
  Phone,
  Shield,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { useAffiliate } from '../contexts/AffiliateContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface OrderSummary {
  subtotal: number;
  shipping: number;
  tax: number;
  affiliateCommission: number;
  beezioCommission: number;
  total: number;
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
  const { items, getTotalPrice, getShippingTotal, clearCart } = useCart();
  const { user, profile } = useAuth();
  const { trackSale } = useAffiliate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);

  // Check for affiliate reference
  useEffect(() => {
    const ref = searchParams.get('ref') || localStorage.getItem('affiliate_ref');
    if (ref) {
      setAffiliateId(ref);
      localStorage.setItem('affiliate_ref', ref);
    }
  }, [searchParams]);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/signup?redirect=/checkout');
    }
  }, [user, navigate]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  // Calculate order summary
  const calculateOrderSummary = (): OrderSummary => {
    const subtotal = getTotalPrice();
    const shipping = getShippingTotal();
    const tax = subtotal * 0.08; // 8% tax rate
    
    let affiliateCommission = 0;
    let beezioCommission = 0;

    // Check if buyer is an affiliate or fundraiser (no affiliate fee for them)
    const buyerIsAffiliate = profile?.primary_role === 'affiliate' || profile?.primary_role === 'fundraiser';

    if (affiliateId && !buyerIsAffiliate) {
      // If there's an affiliate AND buyer is not an affiliate/fundraiser, calculate commission
      affiliateCommission = items.reduce((sum, item) => {
        // Skip commission if buyer is the seller of this specific item
        if (user?.id === item.sellerId) {
          return sum;
        }
        return sum + (item.price * item.quantity * (item.commission_rate || 0) / 100);
      }, 0);
      // Beezio gets platform fee (always charged)
      beezioCommission = subtotal * 0.15; // 15% platform fee
    } else {
      // No affiliate commission (buyer is affiliate/fundraiser OR no affiliate link used OR buyer is seller)
      affiliateCommission = 0;
      // Beezio still gets platform fee
      beezioCommission = subtotal * 0.15; // 15% platform fee
    }

    const total = subtotal + shipping + tax;

    return {
      subtotal,
      shipping,
      tax,
      affiliateCommission,
      beezioCommission,
      total
    };
  };

  const handlePayment = async (paymentData: any) => {
    setIsLoading(true);
    
    try {
      const orderSummary = calculateOrderSummary();
      
      // Create order payload
      const orderPayload = {
        items: items.map(item => ({
          productId: item.productId,
          title: item.title,
          price: item.price,
          quantity: item.quantity,
          sellerId: item.sellerId,
          sellerName: item.sellerName,
          commission_rate: item.commission_rate
        })),
        customer: paymentData.customerInfo,
        payment: {
          paymentMethodId: paymentData.paymentMethod.id,
          amount: Math.round(orderSummary.total * 100), // Convert to cents
        },
        affiliate: affiliateId ? {
          affiliateId,
          commission: orderSummary.affiliateCommission
        } : null,
        summary: orderSummary
      };

      // In a real app, this would go to your backend API
      console.log('Processing order:', orderPayload);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Track affiliate sales if applicable
      if (affiliateId) {
        items.forEach(item => {
          if (item.commission_rate) {
            const commission = item.price * item.quantity * (item.commission_rate / 100);
            trackSale(item.productId, affiliateId, item.price * item.quantity, commission);
          }
        });
      }

      // Clear cart
      clearCart();
      
      // Redirect to success page
      navigate(`/order-confirmation?orderId=${Date.now()}&affiliate=${affiliateId || 'none'}`);
      
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
          
          {affiliateId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-800">
                  Referred by Affiliate
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
                {items.map(item => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.title}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
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
                
                {/* Commission Transparency */}
                <div className="border-t border-gray-100 pt-2 mt-2">
                  {affiliateId && orderSummary.affiliateCommission > 0 ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-600">Affiliate Commission</span>
                        <span className="text-blue-600">${orderSummary.affiliateCommission.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Platform Fee (15%)</span>
                        <span className="text-gray-600">${orderSummary.beezioCommission.toFixed(2)}</span>
                      </div>
                    </>
                  ) : affiliateId && orderSummary.affiliateCommission === 0 ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Affiliate Fee</span>
                        <span className="text-green-600 line-through">Waived</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Platform Fee (15%)</span>
                        <span className="text-gray-600">${orderSummary.beezioCommission.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        {profile?.primary_role === 'affiliate' || profile?.primary_role === 'fundraiser' 
                          ? '✓ Affiliates & fundraisers shop commission-free!'
                          : '✓ No affiliate fee when buying your own products'
                        }
                      </p>
                    </>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Platform Fee (15%)</span>
                      <span className="text-gray-600">${orderSummary.beezioCommission.toFixed(2)}</span>
                    </div>
                  )}
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
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-yellow-800">100% Transparent Pricing</h4>
                    <p className="text-xs text-yellow-700 mt-1">
                      {affiliateId && orderSummary.affiliateCommission > 0
                        ? `Affiliate earns $${orderSummary.affiliateCommission.toFixed(2)}. Platform fee: $${orderSummary.beezioCommission.toFixed(2)}.`
                        : affiliateId && orderSummary.affiliateCommission === 0
                        ? `Affiliate fee waived! ${profile?.primary_role === 'affiliate' || profile?.primary_role === 'fundraiser' ? 'You shop commission-free as an affiliate/fundraiser.' : 'No fee on your own products.'} Platform fee: $${orderSummary.beezioCommission.toFixed(2)}.`
                        : `No affiliate commission. Platform fee: $${orderSummary.beezioCommission.toFixed(2)} covers operations and seller support.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedCheckoutPage;
