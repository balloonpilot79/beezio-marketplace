import React, { useEffect, useMemo, useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { TAX_RATE } from '../lib/pricing';
import { getReferralAttribution } from '../utils/referralTracking';
import { getStripeStatus } from '../utils/stripeStatus';
import {
  CheckoutShippingOption,
  ShippingQuoteItem,
  getCheckoutShippingQuote,
} from '../services/shippingService';

interface CheckoutFormProps {
  amount: number;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ onSuccess, onError }) => {
  const { items, shippingOption, setShippingOption } = useCart();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableShippingOptions, setAvailableShippingOptions] = useState<CheckoutShippingOption[]>([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [requiresCJShipping, setRequiresCJShipping] = useState(false);

  const stripeStatus = getStripeStatus();

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

  const displaySubtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  }, [items]);

  const displayTax = useMemo(() => {
    return Math.round((displaySubtotal * TAX_RATE + Number.EPSILON) * 100) / 100;
  }, [displaySubtotal]);

  const nonCJShippingTotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.shippingCost || 0) * it.quantity, 0);
  }, [items]);

  const displayShipping = useMemo(() => {
    const cjShipping = shippingOption?.cost || 0;
    return Math.round((cjShipping + nonCJShippingTotal + Number.EPSILON) * 100) / 100;
  }, [shippingOption?.cost, nonCJShippingTotal]);

  const displayTotal = useMemo(() => {
    return Math.round((displaySubtotal + displayShipping + displayTax + Number.EPSILON) * 100) / 100;
  }, [displaySubtotal, displayShipping, displayTax]);

  const shippingQuoteItems = React.useMemo<ShippingQuoteItem[]>(
    () =>
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        variantId: item.variantId,
      })),
    [items]
  );

  const handleShippingSelection = (option: CheckoutShippingOption) => {
    setShippingError(null);
    setShippingOption({
      id: option.id,
      name: option.methodName,
      cost: Number(option.cost),
      methodCode: option.methodCode,
      destinationCountry: billingDetails.address.country,
    });
  };

  useEffect(() => {
    const destinationCountry = billingDetails.address.country;
    const destinationZip = billingDetails.address.postal_code?.trim();
    if (!destinationCountry) return;

    let isCancelled = false;
    const timer = window.setTimeout(async () => {
      setShippingLoading(true);
      setShippingError(null);
      try {
        const quote = await getCheckoutShippingQuote({
          destinationCountryCode: destinationCountry,
          destinationZip,
          items: shippingQuoteItems,
        });
        const options = quote.options;
        const cjMapped = quote.mappedProductIds.length > 0;

        if (isCancelled) return;

        setRequiresCJShipping(cjMapped);
        if (!cjMapped) {
          setAvailableShippingOptions([]);
          setShippingOption(null);
          setShippingError(null);
          return;
        }

        setAvailableShippingOptions(options);
        if (!options.length) {
          setShippingOption(null);
          setShippingError('CJ shipping quotes are unavailable for that address.');
          return;
        }

        const existing = options.find((opt) => opt.id === shippingOption?.id);
        if (existing) {
          handleShippingSelection(existing);
          return;
        }

        if (options.length === 1) {
          handleShippingSelection(options[0]);
        } else {
          setShippingOption(null);
          setShippingError('Please select a shipping method to continue.');
        }
      } catch (err) {
        console.error('Shipping options lookup failed:', err);
        setShippingError('Unable to fetch CJ shipping options right now.');
      } finally {
        if (!isCancelled) {
          setShippingLoading(false);
        }
      }
    }, 600);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    billingDetails.address.country,
    billingDetails.address.postal_code,
    items.length,
    shippingQuoteItems,
    shippingOption?.id,
    setShippingOption,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setProcessing(true);
    setError(null);

    try {
      if (!user) throw new Error('Please sign in to checkout.');
      if (!items.length) throw new Error('Your cart is empty.');
      if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) throw new Error('Stripe is not configured.');

      const sellerId = String(items[0]?.sellerId || '').trim();
      if (!sellerId) throw new Error('Missing seller_id for this cart.');
      if (items.some((it) => String(it.sellerId || '').trim() !== sellerId)) {
        throw new Error('Your cart contains items from multiple sellers. Please checkout one seller at a time.');
      }

      if (requiresCJShipping && !shippingOption) {
        throw new Error('Please select a shipping option before completing checkout.');
      }

      const itemsSubtotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
      const cjShippingCost = requiresCJShipping ? Number(shippingOption?.cost || 0) : 0;
      const shippingTotal = Math.round((cjShippingCost + nonCJShippingTotal + Number.EPSILON) * 100) / 100;
      const taxAmount = Math.round((itemsSubtotal * TAX_RATE + Number.EPSILON) * 100) / 100;

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
            line_items: items.map((it) => ({
              product_id: it.productId,
              variant_id: it.variantId ?? null,
              qty: it.quantity,
              unit_price: it.price,
            })),
            shipping_amount: shippingTotal,
            tax_amount: taxAmount,
            currency: (items[0]?.currency || 'USD') as string,
          },
          context: {
            seller_id: sellerId,
            buyer_id: user.id,
            store_id: null,
            fundraiser_id,
            affiliate_id,
            referrer_id: null,
            source: null,
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

      onSuccess('redirect');
      window.location.href = url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      setError(message);
      onError(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setBillingDetails((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setBillingDetails((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {import.meta.env.DEV && stripeStatus.mode === 'disabled' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="font-semibold">Stripe is disabled.</div>
          <div className="mt-1 opacity-90">Set `VITE_STRIPE_PUBLISHABLE_KEY` to enable Stripe Checkout.</div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
          <input
            type="text"
            value={billingDetails.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={billingDetails.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1</label>
          <input
            type="text"
            value={billingDetails.address.line1}
            onChange={(e) => handleInputChange('address.line1', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
          <input
            type="text"
            value={billingDetails.address.line2}
            onChange={(e) => handleInputChange('address.line2', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
          <input
            type="text"
            value={billingDetails.address.city}
            onChange={(e) => handleInputChange('address.city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
          <input
            type="text"
            value={billingDetails.address.state}
            onChange={(e) => handleInputChange('address.state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ZIP / Postal Code</label>
          <input
            type="text"
            value={billingDetails.address.postal_code}
            onChange={(e) => handleInputChange('address.postal_code', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
          <select
            value={billingDetails.address.country}
            onChange={(e) => handleInputChange('address.country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="US">US</option>
            <option value="CA">Canada</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-900">CJ Shipping</div>
        {shippingLoading && <div className="text-sm text-gray-600">Loading shipping options…</div>}
        {shippingError && <div className="text-sm text-amber-700">{shippingError}</div>}

        {availableShippingOptions.length > 0 && (
          <div className="space-y-2">
            {availableShippingOptions.map((opt) => {
              const selected = opt.id === shippingOption?.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleShippingSelection(opt)}
                  className={`w-full rounded-md border p-3 text-left ${
                    selected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{opt.methodName}</div>
                    <div className="text-gray-900">${Number(opt.cost).toFixed(2)}</div>
                  </div>
                  {opt.minDays != null && opt.maxDays != null && (
                    <div className="text-xs text-gray-600 mt-1">
                      {opt.minDays}–{opt.maxDays} days
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        You’ll be redirected to Stripe Checkout to complete payment securely.
      </div>

      <button
        type="submit"
        disabled={processing || stripeStatus.mode === 'disabled'}
        className="w-full rounded-md bg-amber-500 px-4 py-3 text-white font-semibold disabled:opacity-50"
      >
        {processing ? 'Redirecting…' : `Continue to Checkout ($${displayTotal.toFixed(2)})`}
      </button>
    </form>
  );
};

export default CheckoutForm;
