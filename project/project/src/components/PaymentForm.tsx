import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, MapPin, User, Mail, Phone } from 'lucide-react';
import { useGlobal } from '../contexts/GlobalContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { calculateShippingCost } from '../lib/geolocation';
import { getReferralAttribution } from '../utils/referralTracking';

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
  onSuccess: (result: any) => void;
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

const PaymentForm: React.FC<PaymentFormProps> = ({ product, onSuccess, onError }) => {
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

  useEffect(() => {
    const subtotal = product.price;
    const shipping = calculateShippingCost(billingInfo.country, 1, subtotal);
    const taxRate = location?.vatRate || 0;
    const tax = (subtotal + shipping) * (taxRate / 100);
    const total = subtotal + shipping + tax;

    setOrderSummary({ subtotal, shipping, tax, total });
  }, [billingInfo.country, product.price, location]);

  const handleBillingChange = (field: keyof BillingInfo, value: string) => {
    setBillingInfo((prev) => ({ ...prev, [field]: value }));
    if (sameAsShipping) {
      setShippingInfo((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleShippingChange = (field: keyof BillingInfo, value: string) => {
    setShippingInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      onError('Please sign in to complete your purchase');
      return;
    }

    setLoading(true);
    try {
      const attribution = getReferralAttribution();
      const fundraiser_id = attribution.type === 'fundraiser' ? attribution.id : null;
      const affiliate_id = attribution.type === 'affiliate' ? attribution.id : null;

      const origin = window.location.origin;
      const success_url = `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancel_url = `${origin}/checkout/cancel`;

      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: {
            line_items: [
              {
                product_id: product.id,
                qty: 1,
                unit_price: product.price,
              },
            ],
            shipping_amount: orderSummary.shipping,
            tax_amount: orderSummary.tax,
            currency: currency || 'USD',
          },
          context: {
            seller_id: product.seller_id,
            buyer_id: user.id,
            store_id: null,
            fundraiser_id,
            affiliate_id,
            referrer_id: null,
            source: 'product_modal',
            campaign: null,
          },
          success_url,
          cancel_url,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String((data as any)?.error || 'Checkout creation failed'));
      }

      const url = String((data as any)?.url || '').trim();
      if (!url) throw new Error('Checkout creation failed: missing session url');

      onSuccess({ redirected: true });
      window.location.href = url;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Payment failed';
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Lock className="w-5 h-5 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-900">Secure Checkout</h3>
                <p className="text-sm text-green-700">You will be redirected to Stripe Checkout to pay.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('checkout.contact', 'Contact')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="inline w-4 h-4 mr-1" /> Email
                  </label>
                  <input
                    value={billingInfo.email}
                    onChange={(e) => handleBillingChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="inline w-4 h-4 mr-1" /> Name
                  </label>
                  <input
                    value={`${billingInfo.firstName} ${billingInfo.lastName}`.trim()}
                    onChange={(e) => {
                      const [first, ...rest] = e.target.value.split(' ');
                      handleBillingChange('firstName', first || '');
                      handleBillingChange('lastName', rest.join(' '));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="inline w-4 h-4 mr-1" /> Phone
                  </label>
                  <input
                    value={billingInfo.phone}
                    onChange={(e) => handleBillingChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  <MapPin className="inline w-5 h-5 mr-1" /> Shipping Address
                </h2>
                <label className="text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={sameAsShipping}
                    onChange={(e) => setSameAsShipping(e.target.checked)}
                    className="mr-2"
                  />
                  Same as contact
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    value={shippingInfo.address}
                    onChange={(e) => handleShippingChange('address', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    value={shippingInfo.city}
                    onChange={(e) => handleShippingChange('city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    value={shippingInfo.state}
                    onChange={(e) => handleShippingChange('state', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                  <input
                    value={shippingInfo.postalCode}
                    onChange={(e) => handleShippingChange('postalCode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    value={shippingInfo.country}
                    onChange={(e) => handleShippingChange('country', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50"
            >
              {loading ? 'Redirecting…' : 'Continue to Stripe Checkout'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 h-fit">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('checkout.summary', 'Order Summary')}</h2>

          <div className="flex items-center space-x-4 mb-6">
            <img
              src={product.images?.[0] || ''}
              alt={product.title}
              className="w-20 h-20 object-cover rounded-lg bg-gray-100"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900">{product.title}</div>
              <div className="text-sm text-gray-600">{formatPrice ? formatPrice(product.price) : `$${product.price.toFixed(2)}`}</div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900">{formatPrice ? formatPrice(orderSummary.subtotal) : `$${orderSummary.subtotal.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span className="text-gray-900">{formatPrice ? formatPrice(orderSummary.shipping) : `$${orderSummary.shipping.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax</span>
              <span className="text-gray-900">{formatPrice ? formatPrice(orderSummary.tax) : `$${orderSummary.tax.toFixed(2)}`}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice ? formatPrice(orderSummary.total) : `$${orderSummary.total.toFixed(2)}`}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentForm;
