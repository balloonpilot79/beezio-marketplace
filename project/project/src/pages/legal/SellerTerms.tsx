import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const SellerTerms: React.FC = () => (
  <LegalPageLayout title="Seller Terms" updated="June 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Seller Role</h2>
      <p>
        Sellers are independent merchants responsible for listing, pricing, fulfillment, and customer support.
        Beezio facilitates checkout and provides marketplace tools.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Merchant of Record</h2>
      <p>
        Sellers are the merchant of record for fulfillment and returns. Sellers must comply with applicable laws,
        payment rules, and product safety requirements.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Pricing and Commissions</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Sellers set product pricing and partner commission percentages.</li>
        <li>Beezio platform fees and processing fees are disclosed and included in buyer pricing.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Payout Schedule</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Payouts are issued after a standard review period of up to 14 days.</li>
        <li>Payouts require a valid PayPal email and completion of required verification.</li>
        <li>Orders that require shipping are not eligible for seller payout until a valid tracking number is entered.</li>
        <li>Disputes, chargebacks, suspected fraud, or missing shipment evidence may delay payouts.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Returns and Disputes</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Sellers define return windows and policies consistent with Beezio minimum requirements.</li>
        <li>Sellers must respond to disputes and provide evidence such as tracking, delivery confirmation, or carrier records.</li>
        <li>If a seller authorizes a return, the buyer must provide return shipment tracking before the return or refund is finalized unless Beezio states otherwise.</li>
      </ul>
    </section>
  </LegalPageLayout>
);

export default SellerTerms;
