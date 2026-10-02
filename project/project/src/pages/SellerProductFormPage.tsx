import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ProductForm from '../components/ProductForm';

const SellerProductFormPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#faf9f5] py-4 sm:py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/business?tab=products')}
          className="mb-4 flex min-h-11 items-center font-semibold text-slate-700 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to products
        </button>

        <ProductForm
          onSuccess={() => navigate('/business?section=seller&tab=products')}
          onCancel={() => navigate('/business?tab=products')}
        />
      </div>
    </div>
  );
};

export default SellerProductFormPage;
