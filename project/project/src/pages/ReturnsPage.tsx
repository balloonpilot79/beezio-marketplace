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
            Request a return within 14 days of delivery. Check the product page for clearly disclosed exclusions and conditions before purchasing.
          </p>
          <p>
            Items must be unused, in original packaging, and include all accessories. Supplements, cosmetics, and personal-care products must be unopened with seals intact. Report damaged, incorrect, or defective items within 14 days through your order support. Contact the seller before shipping a return and keep the return tracking number.
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
