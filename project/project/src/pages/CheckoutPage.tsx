import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, CreditCard } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { TAX_RATE } from '../lib/pricing';
import CheckoutForm from '../components/CheckoutForm';
import { formatMoneyDisplay, formatShippingDisplay } from '../utils/moneyDisplay';
import { setPostAuthPath } from '../utils/storefrontScope';

const CheckoutPage: React.FC = () => {
  const { items, getShippingTotal, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
  }, [items.length, navigate]);

  React.useEffect(() => {
    if (!user) {
      setPostAuthPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
    }
  }, [user]);

  const computeFinalUnitPrice = (item: typeof items[number]) => Math.max(0, Number(item.price || 0));
  const subtotal = items.reduce((sum, item) => sum + computeFinalUnitPrice(item) * item.quantity, 0);
  const shipping = getShippingTotal();
  const tax = Math.round((subtotal * TAX_RATE + Number.EPSILON) * 100) / 100;
  const total = subtotal + shipping + tax;
  const hasDigitalItems = items.some((item) => item.isDigital);

  if (items.length === 0) {
    return null;
  }

  if (!user) {
    const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">Customer Login Required</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Sign in before checkout</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Purchases must be tied to a customer account so orders, receipts, downloads, and partner attribution stay linked correctly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={`/account/login?next=${encodeURIComponent(nextPath)}`}
              onClick={() => setPostAuthPath(nextPath)}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Customer Login
            </Link>
            <Link
              to={`/account/signup?next=${encodeURIComponent(nextPath)}`}
              onClick={() => setPostAuthPath(nextPath)}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Create Account
            </Link>
            <Link
              to="/cart"
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Cart
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/cart" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Cart
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-green-600" />
              <div>
                <h3 className="text-sm font-semibold text-green-900">Secure Checkout</h3>
                <p className="text-xs text-green-700">Review your order on the right while you complete shipping and payment on the left.</p>
              </div>
            </div>
          </div>

          {hasDigitalItems && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Digital purchases are account-tied downloads. After a file is downloaded, refunds are not available unless the file is corrupted, inaccessible, or materially different from the listing. Buyers must contact the seller for any file issues.
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Shipping and payment</h2>
            </div>
            <p className="mb-4 max-w-3xl text-sm text-gray-600">
              {hasDigitalItems
                ? user
                  ? 'Confirm your email, shipping details, and payment information below.'
                  : 'Sign in to buy digital products, then confirm your shipping and payment details below.'
                : user
                  ? 'Confirm your contact details, shipping address, and payment information below.'
                  : 'Enter your contact details, shipping address, and payment information below.'}
            </p>

            <CheckoutForm
              amount={total}
              onSuccess={() => {
                clearCart();
              }}
              onError={(error: string) => {
                console.error('Payment error:', error);
              }}
            />
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Order summary</h2>
              <span className="text-sm font-medium text-gray-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
            </div>

            <div className="mb-5 space-y-4">
              {items.map((item) => {
                return (
                  <div key={item.id} className="flex items-start space-x-4">
                    <div className="relative">
                      <img src={item.image} alt={item.title} className="h-16 w-16 rounded-lg object-cover" />
                      <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-600 text-xs text-white">
                        {item.quantity}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600">By {item.sellerName}</p>
                      {item.isSample && <p className="mt-1 text-xs text-amber-700">Sample • Final sale</p>}
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatMoneyDisplay(computeFinalUnitPrice(item) * item.quantity)}
                      </p>
                      {item.isDigital !== true && (
                        <p className="text-xs text-gray-600">{formatShippingDisplay(item.shippingCost || 0)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-gray-200 pt-4">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatMoneyDisplay(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span>{formatShippingDisplay(shipping)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Tax</span>
                <span>{formatMoneyDisplay(tax)}</span>
              </div>

              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between text-lg font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{formatMoneyDisplay(total)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Final total updates after shipping is quoted from your address.
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-5">
            <h3 className="mb-3 font-semibold text-gray-900">Checkout details</h3>
            <div className="space-y-3 text-sm text-gray-700">
              {[
                'SSL encrypted checkout',
                'Clear, transparent pricing',
                hasDigitalItems ? 'Paid digital delivery stays locked to the buyer account' : 'Fast & reliable shipping',
                hasDigitalItems
                  ? 'Digital downloads are non-refundable after download unless the file is wrong or broken'
                  : items.some((i) => i.isSample)
                    ? 'Samples are final sale (no returns)'
                    : '30-day return policy',
              ].map((text) => (
                <div key={text} className="flex items-center space-x-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
