import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PrivacyPolicy: React.FC = () => (
  <LegalPageLayout title="Privacy Policy" updated="January 20, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Data We Collect</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Account information such as name, email, and profile details.</li>
        <li>Order details, shipping addresses, and transaction metadata.</li>
        <li>Usage data, analytics events, and device identifiers.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Cookies and Tracking</h2>
      <p>
        We use cookies and similar technologies to keep you signed in, understand usage patterns, and improve the
        marketplace experience.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Sharing with Payment Providers</h2>
      <p>
        We share relevant data with payment processors such as PayPal to process transactions and issue payouts.
        These providers handle data according to their own privacy policies.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Your Choices</h2>
      <p>
        You may update account details, request data access, or request deletion by contacting support. Some data
        may be retained to comply with legal and financial obligations.
      </p>
    </section>
  </LegalPageLayout>
);

export default PrivacyPolicy;
