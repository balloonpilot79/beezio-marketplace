import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PaymentsRolesPayouts: React.FC = () => (
  <LegalPageLayout title="Payments, Roles, and Payout System" updated="July 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Platform Roles</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Buyers purchase products and can view orders, receipts, tracking, and support from their customer dashboard.</li>
        <li>Sellers list, price, and fulfill products and are responsible for product accuracy and customer satisfaction.</li>
        <li>Affiliates choose eligible marketplace products, add them to their storefronts, and earn the commission set for each product.</li>
        <li>Influencers refer sellers and affiliates and may earn the applicable fixed referral bonus on completed sales.</li>
        <li>A single business account may use the seller, affiliate, and influencer roles from one dashboard.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Sale and Referral-Bonus Structure</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Seller earnings and affiliate commission are calculated from the product&apos;s saved pricing terms.</li>
        <li>Each item has two possible influencer referral slots: one for the influencer who referred the seller and one for the influencer who referred the affiliate.</li>
        <li>For an item priced below $25, each eligible assigned referral slot pays $0.50.</li>
        <li>For an item priced at $25 or more, each eligible assigned referral slot pays $1.00.</li>
        <li>If a referral slot is not assigned to an eligible influencer, that amount remains with Beezio.</li>
        <li>Influencer bonuses are funded from Beezio&apos;s allocation and do not reduce the saved seller or affiliate amount.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Checkout and Ledger</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>The buyer completes checkout using an available payment method.</li>
        <li>The order ledger records the seller, affiliate, influencer referral slots, Beezio allocation, processing costs, taxes, shipping, and order status when applicable.</li>
        <li>Only valid, completed, undisputed sales become eligible for payout.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Hold and Payout Schedule</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Standard seller, affiliate, and influencer earnings have a 14-day hold beginning when the order is completed.</li>
        <li>Beezio administrative accounts are exempt from the standard hold when funds are needed to purchase or fulfill an order.</li>
        <li>Eligible payouts are processed on the 15th and the last calendar day of each month.</li>
        <li>Physical-product seller payouts require valid shipment tracking when tracking is required for the order.</li>
        <li>Disputes, chargebacks, fraud review, or missing tracking can pause a related payout until the issue is resolved.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Independent Business Status</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Sellers, affiliates, and influencers are independent businesses or contractors, not Beezio employees.</li>
        <li>Beezio does not guarantee sales or earnings.</li>
        <li>Each user is responsible for their own tax, legal, and business obligations.</li>
      </ul>
    </section>
  </LegalPageLayout>
);

export default PaymentsRolesPayouts;
