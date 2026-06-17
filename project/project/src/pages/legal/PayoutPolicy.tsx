import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PayoutPolicy: React.FC = () => (
  <LegalPageLayout title="Payout Policy (Up to 14 Days)" updated="June 13, 2026">
    <section>
      <p>
        Payouts are issued after a standard risk review period of up to 14 days. Payouts may be delayed if a
        chargeback, dispute, or suspected fraud is detected.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Eligibility</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Payout eligibility requires a valid PayPal email on file.</li>
        <li>Amounts are calculated and recorded at the time of sale.</li>
        <li>Payouts are not released during the payout review period.</li>
        <li>Minimum payout threshold is $25 per recipient.</li>
        <li>Orders that require shipping are not eligible for seller payout until a valid tracking number is on file.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Disputes and Payout Pauses</h2>
      <p>
        Disputes, chargebacks, suspected fraud, missing shipment tracking, or missing return-shipment evidence can
        extend the review period and pause payouts until resolved.
      </p>
    </section>
  </LegalPageLayout>
);

export default PayoutPolicy;
