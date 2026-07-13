import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const TermsOfService: React.FC = () => (
  <LegalPageLayout title="Terms of Service" updated="July 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Marketplace Facilitator Role</h2>
      <p>
        Beezio is a marketplace platform that facilitates transactions between buyers and independent sellers.
        Beezio is not an employer, not an escrow service, and not an investment platform. Beezio is not the seller
        of goods listed on the site. Sellers are responsible for product listings, fulfillment, and post-sale
        support.
      </p>
      <p className="mt-3">
        Beezio charges a platform fee for facilitating transactions, payment processing, and marketplace services.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Buyer Responsibilities</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Provide accurate account, shipping, and payment information.</li>
        <li>Review product details, policies, and delivery timelines before purchase.</li>
        <li>Comply with platform rules and applicable laws.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Seller Responsibilities</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>List products accurately with lawful descriptions and images.</li>
        <li>Fulfill orders on time and provide a valid tracking number when a shipped order is marked shipped.</li>
        <li>Handle returns, refunds, and customer communications per policy.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Prohibited Items</h2>
      <p>Listings may not include prohibited items such as:</p>
      <ul className="list-disc list-inside space-y-2">
        <li>Illegal, stolen, or counterfeit goods.</li>
        <li>Hazardous materials, weapons, or regulated items without authorization.</li>
        <li>Content that violates intellectual property or privacy rights.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Listing Moderation and Removal</h2>
      <p>
        Beezio may remove, suspend, archive, disable, or delete any listing at any time if we determine that doing so
        is necessary or appropriate for legal, policy, safety, operational, reputational, or business reasons.
      </p>
      <p className="mt-3">
        Beezio may also decline or refuse to remove a listing when we determine that removal is not necessary or
        appropriate. Listing moderation decisions are made in Beezio&apos;s sole discretion.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">6. Payments and Payout Timing</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Buyers are charged at checkout using approved payment providers.</li>
        <li>Standard earnings have a 14-day hold and are then eligible for a scheduled payday on the 15th or last calendar day of the month.</li>
        <li>Payouts may be delayed if disputes, chargebacks, or suspected fraud occur.</li>
      </ul>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">7. Disputes and Chargebacks</h2>
      <p>
        If a dispute or chargeback is opened, related payouts may be paused while evidence is reviewed.
        Sellers must provide documentation such as tracking or proof of delivery upon request, and buyers may be
        required to provide return shipment tracking for approved returns.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">8. Account Termination</h2>
      <p>
        Beezio may suspend or terminate accounts for violations of these terms, fraud, or illegal activity.
        Outstanding obligations, disputes, or refunds survive account termination.
      </p>
    </section>
  </LegalPageLayout>
);

export default TermsOfService;
