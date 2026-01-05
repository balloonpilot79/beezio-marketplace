import { Link } from 'react-router-dom';

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-2xl font-bold text-gray-900">Checkout canceled</div>
        <div className="mt-3 text-gray-600">You can return to your cart and try again.</div>
        <div className="mt-6">
          <Link
            to="/cart"
            className="inline-flex items-center justify-center px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium"
          >
            Back to cart
          </Link>
        </div>
      </div>
    </div>
  );
}

