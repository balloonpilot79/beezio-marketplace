import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PayoutPolicy: React.FC = () => (
  <LegalPageLayout title="Payout Policy" updated="October 12, 2026">
    <section>
      <p>
        Seller, affiliate, and influencer earnings are held for 14 days from the date the order payment is
        completed. The hold starts at payment, not delivery. Early payout cannot bypass this hold, including
        for administrative accounts.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Payout Schedule and Eligibility</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Eligible payouts are processed on the 15th and the last calendar day of each month.</li>
        <li>Payouts are sent through PayPal only. A valid, confirmed PayPal payout email must be on file.</li>
        <li>The minimum payout is $5 in eligible earnings. Smaller balances carry forward until the minimum is reached.</li>
        <li>Complete any required payout and tax information in your Business Center before funds can be released.</li>
        <li>Amounts and recipients are recorded in the order ledger at the time of sale.</li>
        <li>Payouts are not released during the standard hold.</li>
        <li>Orders that require shipping are not eligible for seller payout until valid tracking is on file.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">Disputes and Payout Pauses</h2>
      <p>
        Disputes, chargebacks, suspected fraud, missing shipment tracking, or missing return-shipment evidence can
        pause only the affected order’s related funds until the issue is resolved. Other eligible earnings
        continue through the normal payout schedule; an issue with one order does not hold your entire balance.
      </p>
    </section>
  </LegalPageLayout>
);

export default PayoutPolicy;
