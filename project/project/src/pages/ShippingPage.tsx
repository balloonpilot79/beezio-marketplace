import React from 'react';
import PublicLayout from '../components/layout/PublicLayout';

const ShippingPage: React.FC = () => {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Shipping Policy</h1>
          <p className="text-gray-600">Review shipping costs and delivery estimates before placing your order.</p>
        </header>

        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4 text-gray-700 text-sm">
          <p>
            Shipping is shown separately from the product price and added to your checkout total when a shipping charge applies.
            Review the product page and final checkout total for the shipping cost, applicable tax, and delivery estimate.
            Handling and delivery times vary by seller and product; made-to-order items may also require production time.
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
