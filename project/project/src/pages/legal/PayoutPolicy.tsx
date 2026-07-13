import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PayoutPolicy: React.FC = () => (
  <LegalPageLayout title="Payout Policy" updated="July 13, 2026">
    <section>
      <p>
        Standard seller, affiliate, and influencer earnings are held for 14 days after order completion. Beezio
        administrative accounts may be released earlier when funds are required to purchase or fulfill the order.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Payout Schedule and Eligibility</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Eligible payouts are processed on the 15th and the last calendar day of each month.</li>
        <li>A valid payout destination must be on file before funds can be released.</li>
        <li>Amounts and recipients are recorded in the order ledger at the time of sale.</li>
        <li>Payouts are not released during the standard hold.</li>
        <li>Orders that require shipping are not eligible for seller payout until valid tracking is on file.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Disputes and Payout Pauses</h2>
      <p>
        Disputes, chargebacks, suspected fraud, missing shipment tracking, or missing return-shipment evidence can
        pause related payouts until the issue is resolved.
      </p>
    </section>
  </LegalPageLayout>
);

export default PayoutPolicy;
