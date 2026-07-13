import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const InfluencerTerms: React.FC = () => (
  <LegalPageLayout title="Influencer Terms" updated="July 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Program Overview</h2>
      <p>
        Influencers are independent contractors who refer sellers and affiliates to Beezio. Influencers do not set
        prices, affiliate commissions, or product terms.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Referral Bonus</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Each item has a possible seller-referrer slot and affiliate-referrer slot.</li>
        <li>Each eligible assigned slot pays $0.50 when the item price is below $25.</li>
        <li>Each eligible assigned slot pays $1.00 when the item price is $25 or more.</li>
        <li>An unassigned referral slot remains with Beezio.</li>
        <li>Referral bonuses do not reduce the saved seller or affiliate amount.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Program Changes</h2>
      <p>
        Beezio may update referral-bonus amounts, eligibility rules, or related programs with notice when required.
        Changes apply prospectively and do not rewrite amounts already recorded for completed orders.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Payout Timing</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Standard earnings have a 14-day hold and are then eligible for the next payday on the 15th or last calendar day of the month.</li>
        <li>Disputes, chargebacks, or suspected fraud may delay or void related payouts.</li>
        <li>A valid payout destination must be on file.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Abuse and Fraud</h2>
      <p>
        Abuse of referral links, misleading claims, or fraudulent activity voids related bonuses and may result in
        account removal.
      </p>
    </section>
  </LegalPageLayout>
);

export default InfluencerTerms;
