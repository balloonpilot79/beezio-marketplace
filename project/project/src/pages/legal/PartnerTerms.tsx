import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PartnerTerms: React.FC = () => (
  <LegalPageLayout title="Partner Terms (Independent Contractor)" updated="January 20, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Independent Contractor</h2>
      <p>
        Partners are independent contractors and are not employees, agents, or representatives of Beezio or any
        seller.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Commission Eligibility</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Commissions are earned only on valid, completed sales tracked to a partner link or code.</li>
        <li>Partner commissions are set by the seller, not Beezio.</li>
        <li>Cancelled, refunded, or fraudulent orders void related commissions.</li>
        <li>Commissions are not guaranteed and may be reversed for disputes or chargebacks.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Payout Schedule</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Payouts follow the standard review period of up to 14 days.</li>
        <li>Payout eligibility requires a PayPal email on file.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Fraud and Abuse</h2>
      <p>
        Fraud, self-dealing, or abuse of tracking links may result in forfeited commissions and account removal.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Insurance Promotion Rules</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Insurance storefronts on Beezio are for vetted warm inbound shoppers, not cold lead lists or scraped contact data.</li>
        <li>Partners may share insurance storefront links, but may not promise guaranteed approval, guaranteed coverage, or regulatory approval that does not exist.</li>
        <li>Partners may not advertise Beezio insurance listings as mass-agent distribution, spam-call traffic, or bulk lead dumps.</li>
        <li>Insurance requests are intended for the listed agent after qualification and verification; partners may not re-route or resell that traffic.</li>
        <li>Insurance lead disputes may reverse partner earnings and return value to the agent as Beezio account credit rather than a cash refund.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">6. Enforcement</h2>
      <p>
        Beezio may pause partner links, reverse related earnings, remove listings from promotion surfaces, or suspend accounts that violate insurance marketing, moderation, or compliance rules.
      </p>
    </section>
  </LegalPageLayout>
);

export default PartnerTerms;
