import React, { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Lock } from 'lucide-react';
import { useGlobal } from '../contexts/GlobalContext';
import { useCart } from '../contexts/CartContext';
import CheckoutForm from './CheckoutForm';
import { formatShippingDisplay } from '../utils/moneyDisplay';

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

const PaymentForm: React.FC<PaymentFormProps> = ({ product, onSuccess, onError }) => {
  const { currency, formatPrice } = useGlobal();
  const { clearCart, addToCart } = useCart();
  const paymentsEnabled = String((import.meta as any)?.env?.VITE_PAYMENTS_ENABLED || 'true').toLowerCase() === 'true';
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const preparedProductRef = useRef<string | null>(null);

  useEffect(() => {
    if (!product?.id || !product?.seller_id || !Number.isFinite(Number(product?.price))) {
      const message = 'This product is missing required checkout details.';
      setSetupError(message);
      onError(message);
      return;
    }

    if (preparedProductRef.current === String(product.id)) {
      setCheckoutReady(true);
      return;
    }

    setCheckoutReady(false);
    setSetupError(null);

    try {
      flushSync(() => {
        clearCart();
        addToCart({
          productId: String(product.id),
          title: String(product.title || 'Product'),
          price: Number(product.price) || 0,
          currency: currency || 'USD',
          quantity: 1,
          image: String(product.images?.[0] || '/placeholder.png'),
          sellerId: String(product.seller_id),
          sellerName: String((product as any)?.seller_name || (product as any)?.sellerName || 'Seller'),
          commission_rate: Number(product.commission_rate) || 0,
          shippingCost: Number(product.shipping_cost) || 0,
        });
      });

      preparedProductRef.current = String(product.id);
      setCheckoutReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare checkout.';
      setSetupError(message);
      onError(message);
    }
  }, [addToCart, clearCart, currency, onError, product]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start space-x-3">
          <Lock className="mt-0.5 h-5 w-5 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-900">Real checkout</h3>
            <p className="text-sm text-green-700">
              Enter shipping and payment details below. This flow uses the same live checkout form as the main
              checkout page instead of a redirect-only link.
            </p>
          </div>
        </div>
      </div>

      {!paymentsEnabled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Payments are temporarily unavailable. The order form is shown, but payment processing must be enabled before
          a real charge can be completed.
        </div>
      )}

      {setupError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{setupError}</div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            {checkoutReady ? (
              <CheckoutForm amount={Number(product.price) || 0} onSuccess={onSuccess} onError={onError} />
            ) : (
              <div className="flex min-h-[240px] items-center justify-center text-sm text-gray-600">Preparing checkout…</div>
            )}
          </div>

          <div className="h-fit rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Order Summary</h2>

            <div className="mb-6 flex items-center space-x-4">
              <img
                src={product.images?.[0] || ''}
                alt={product.title}
                className="h-20 w-20 rounded-lg bg-gray-100 object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-gray-900">{product.title}</div>
                <div className="text-sm text-gray-600">
                  {formatPrice ? formatPrice(product.price) : `$${Number(product.price || 0).toFixed(2)}`}
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">
                  {formatPrice ? formatPrice(product.price) : `$${Number(product.price || 0).toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="text-gray-900">
                  {formatShippingDisplay(Number(product.shipping_cost) || 0, currency || 'USD')}
                </span>
              </div>
              <div className="border-t pt-2 text-xs text-gray-500">
                Final tax and any live shipping adjustments are calculated inside the secure form.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;
