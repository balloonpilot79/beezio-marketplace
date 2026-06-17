import React from 'react';
import PublicLayout from '../components/layout/PublicLayout';

const ShippingPage: React.FC = () => {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Shipping Policy</h1>
          <p className="text-gray-600">Shipping timelines vary by seller and are shown at checkout.</p>
        </header>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 text-gray-700 text-sm">
          <p>
            Sellers provide handling times and shipping options on each product page. Estimated delivery dates are shown during checkout.
          </p>
          <p>
            Tracking information is provided when available. If a shipment is delayed or missing, contact the seller first or reach out to
            support@beezio.co.
          </p>
          <p>
            International shipping availability depends on the seller. Duties and taxes may apply based on destination.
          </p>
        </section>
      </div>
    </PublicLayout>
  );
};

export default ShippingPage;
