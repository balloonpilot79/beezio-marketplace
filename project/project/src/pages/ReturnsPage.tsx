import React from 'react';
import PublicLayout from '../components/layout/PublicLayout';

const ReturnsPage: React.FC = () => {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Returns & Refunds</h1>
          <p className="text-gray-600">Our goal is to make returns clear and fair for buyers and sellers.</p>
        </header>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 text-gray-700 text-sm">
          <p>
            Return windows and policies are set by each seller and shown on the product page. If a return is allowed,
            requests should be made within 14 days of delivery.
          </p>
          <p>
            Items must be unused, in original packaging, and include all accessories. Some products may be final sale.
          </p>
          <p>
            To start a return, contact the seller through Beezio or email support@beezio.co with your order number.
          </p>
          <p>
            Refunds are issued to the original payment method after the seller confirms the return.
          </p>
        </section>
      </div>
    </PublicLayout>
  );
};

export default ReturnsPage;
