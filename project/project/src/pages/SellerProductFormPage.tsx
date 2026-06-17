import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ProductForm from '../components/ProductForm';

const SellerProductFormPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1026] via-[#0f1735] to-[#0b132b] py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/seller/products')}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to products
        </button>

        <div className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-emerald-950 shadow-sm">
          <h1 className="text-lg font-semibold">Seller payout reminder</h1>
          <p className="mt-1 text-sm">
            Enter the amount you want to receive for the sale. Your payout stays at that amount unless you change it.
          </p>
        </div>

        <ProductForm
          onSuccess={() => navigate('/dashboard?section=seller&tab=products')}
          onCancel={() => navigate('/seller/products')}
        />
      </div>
    </div>
  );
};

export default SellerProductFormPage;
