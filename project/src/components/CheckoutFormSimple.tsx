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

interface CheckoutFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const CheckoutFormSimple: React.FC<CheckoutFormProps> = ({ amount, onSuccess, onError }) => {
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

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardNumberElement);

    if (!cardElement) {
      setError('Card element not found');
      setProcessing(false);
      return;
    }

    try {
      // For testing: Create a simple payment method and show success
      // This won't actually charge the card, just validates the setup
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

      // Simulate successful payment for testing
      console.log('Payment method created successfully:', paymentMethod.id);
      console.log('Cart items:', items);
      console.log('Total amount:', amount);
      
      // In a real scenario, you would send this to your backend
      // For now, we'll just show success
      alert(`Payment method validated! ID: ${paymentMethod.id}\nAmount: $${amount.toFixed(2)}\nThis is a test - no actual charge was made.`);
      onSuccess();
      
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
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
        <div className="text-blue-700 text-sm">
          <strong>Test Mode:</strong> This form validates your Stripe setup without making actual charges. 
          Use test card: 4242 4242 4242 4242, any future expiry, any CVC.
        </div>
      </div>

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

      {/* Card Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Payment Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Number * (Test: 4242 4242 4242 4242)
          </label>
          <div className="w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-amber-500 focus-within:border-amber-500">
            <CardNumberElement options={cardElementOptions} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expiry Date * (Any future date)
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-amber-500 focus-within:border-amber-500">
              <CardExpiryElement options={cardElementOptions} />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CVC * (Any 3 digits)
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

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-amber-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Processing...' : `Test Payment Setup - $${amount.toFixed(2)}`}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Test mode - No actual charges will be made
      </p>
    </form>
  );
};

export default CheckoutFormSimple;
