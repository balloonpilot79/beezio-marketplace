import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PartnerTerms: React.FC = () => (
  <LegalPageLayout title="Affiliate Terms (Independent Contractor)" updated="July 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Independent Contractor</h2>
      <p>
        Affiliates are independent contractors and are not employees, agents, or representatives of Beezio or any seller.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Commission Eligibility</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Commissions are earned only on valid, completed sales tracked to an affiliate link or code.</li>
        <li>Affiliate commissions are set by the seller, not Beezio.</li>
        <li>Cancelled, refunded, disputed, or fraudulent orders may void or reverse related commissions.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Payout Schedule</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Standard earnings have a 14-day hold and are then eligible for the next payday on the 15th or last calendar day of the month.</li>
        <li>A valid payout destination must be on file.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Promotion Rules</h2>
      <p>
        Affiliates must use accurate product claims, lawful marketing methods, and Beezio-approved tracking links. Spam,
        misleading claims, self-dealing, or tracking abuse may result in reversed commissions or account suspension.
      </p>
    </section>
  </LegalPageLayout>
);

export default PartnerTerms;
