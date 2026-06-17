import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const InfluencerTerms: React.FC = () => (
  <LegalPageLayout title="Influencer Terms" updated="January 22, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Program Overview</h2>
      <p>
        Influencers are independent contractors who refer Partners to the Beezio platform. Influencers do not set
        prices, commissions, or product terms.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Earnings Source</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Influencers earn a portion of Beezio’s platform fee, not seller or partner earnings.</li>
        <li>If an influencer is involved in a sale, the influencer earns 5% of the gross sale amount.</li>
        <li>Total platform fee remains 15%; Beezio keeps 10% and the influencer receives 5%.</li>
        <li>If no influencer is involved, Beezio keeps the full 15% platform fee.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Changes to Influencer Pay and Referral Programs</h2>
      <p>
        Beezio may update the influencer payout structure, payout percentages, eligibility rules, and/or related
        referral programs from time to time. Beezio will provide at least thirty (30) days’ prior notice before
        any material change to influencer pay takes effect.
      </p>
      <p>
        The 5% influencer/referral payout described above is an introductory program. It may continue
        indefinitely, but it is not guaranteed to remain available or unchanged. After launch, Beezio may, in its
        sole discretion, discontinue the program, lower or adjust the percentage, or change how payouts are
        calculated. In some cases, Beezio may allow early participants to continue receiving the introductory
        payout rate (“grandfathering”) while ending or modifying the program for new participants.
      </p>
      <p>
        All rights are reserved by Beezio.co.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Payout Timing</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Payouts are issued after the standard review period of up to 14 days.</li>
        <li>Disputes, chargebacks, or suspected fraud may delay or void payouts.</li>
        <li>Payout eligibility requires a PayPal email on file.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Abuse and Fraud</h2>
      <p>
        Abuse of referral links, misleading claims, or fraudulent activity voids commissions and may result in
        account removal.
      </p>
    </section>
  </LegalPageLayout>
);

export default InfluencerTerms;
