import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PrivacyPolicy: React.FC = () => (
  <LegalPageLayout title="Privacy Policy" updated="November 24, 2026">
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
        marketplace experience. Google may place or read cookies or use web beacons and similar technologies in
        connection with Google Customer Reviews. You can manage or delete cookies in your browser settings.
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
      <h2 className="text-xl font-semibold text-gray-900">4. Google Customer Reviews</h2>
      <p>
        At order confirmation, Google may receive your order ID, email address, delivery country, and estimated
        delivery date to offer a purchase experience survey. Google sends the survey only if you opt in. Google
        handles this information under its <a className="underline" href="https://policies.google.com/privacy">Privacy Policy</a>.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Your Choices</h2>
      <p>
        You may update account details, request data access, or request deletion by contacting support. Some data
        may be retained to comply with legal and financial obligations.
      </p>
    </section>
  </LegalPageLayout>
);

export default PrivacyPolicy;
