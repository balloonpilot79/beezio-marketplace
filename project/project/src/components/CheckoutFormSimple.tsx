import React from 'react';

interface CheckoutFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

const CheckoutFormSimple: React.FC<CheckoutFormProps> = ({ amount }) => {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="font-semibold">Payments are temporarily unavailable.</div>
      <div className="mt-1 opacity-90">
        Your total would be ${amount.toFixed(2)}. Please check back later.
      </div>
    </div>
  );
};

export default CheckoutFormSimple;
