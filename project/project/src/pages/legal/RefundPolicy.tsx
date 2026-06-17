import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const RefundPolicy: React.FC = () => (
  <LegalPageLayout title="Refund & Returns Policy" updated="June 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Who Handles Returns</h2>
      <p>
        Sellers are responsible for returns, exchanges, and refunds for their products. Beezio facilitates
        communication and provides tools, but the seller is responsible for fulfillment outcomes.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Return Windows</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Sellers must provide a clear return window in their listings.</li>
        <li>Returns should be initiated within the seller’s stated timeframe.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Digital Products</h2>
      <p>
        Digital downloads are not refundable after the file has been downloaded except where the file is corrupted,
        inaccessible, or materially different from the listing. Buyers must contact the seller promptly if the file
        delivered is incorrect or unusable.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Return Shipment Tracking</h2>
      <p>
        When a return is approved for a shipped item, the buyer must provide the return tracking number or other
        verifiable return-shipment proof requested by the seller or Beezio. Returns and related refunds may be
        delayed or denied if that evidence is not provided.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Restocking and Condition</h2>
      <p>
        Sellers may apply restocking fees where permitted and must clearly disclose conditions for returns,
        including product condition requirements.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">6. Damaged Items</h2>
      <p>
        Buyers should report damaged items promptly and provide supporting photos. Sellers determine replacement
        or refund outcomes based on evidence.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">7. Chargebacks</h2>
      <p>
        Chargebacks, missing outbound shipment tracking, or missing return-shipment tracking may delay payouts
        while the dispute is investigated.
      </p>
    </section>
  </LegalPageLayout>
);

export default RefundPolicy;
