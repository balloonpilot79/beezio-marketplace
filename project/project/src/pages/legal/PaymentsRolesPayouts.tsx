import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PaymentsRolesPayouts: React.FC = () => (
  <LegalPageLayout title="Payments, Roles, and Payout System" updated="October 7, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Platform Roles</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Buyers purchase products and can view orders, receipts, tracking, and support from their customer dashboard.</li>
        <li>Sellers list, price, and fulfill products and are responsible for product accuracy and customer satisfaction.</li>
        <li>Affiliates choose eligible marketplace products, add them to their storefronts, and earn the commission set for each product.</li>
        <li>Influencers refer sellers and affiliates and may earn the applicable referral bonus when those relationships are connected to qualifying product sales.</li>
        <li>A single business account may use the seller, affiliate, and influencer roles from one dashboard.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Sale and Referral-Bonus Structure</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Seller earnings and affiliate commission are calculated from the product&apos;s saved pricing terms.</li>
        <li>Eligible transactions may include a seller-referrer slot and an affiliate-referrer slot.</li>
        <li>An influencer is not paid merely because a seller or affiliate signs up.</li>
        <li>The applicable influencer amount is determined by Beezio&apos;s program rules for the qualifying transaction when it is recorded.</li>
        <li>If a referral slot is not assigned to an eligible influencer, no influencer payout is owed for that unassigned slot.</li>
        <li>Influencer bonuses do not reduce the seller amount or affiliate commission saved for the transaction.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Checkout and Ledger</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>The buyer completes checkout using an available payment method.</li>
        <li>The order ledger records the seller, affiliate, eligible influencer referral slots, Beezio allocation, processing costs, taxes, shipping, and order status when applicable.</li>
        <li>Only valid, completed, undisputed sales become eligible for payout.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Hold and Payout Schedule</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Standard seller, affiliate, and influencer earnings are subject to Beezio&apos;s current payout hold.</li>
        <li>Beezio administrative accounts may be exempt from the standard hold when funds are needed to purchase or fulfill an order.</li>
        <li>Eligible payouts are processed according to Beezio&apos;s current payout schedule.</li>
        <li>Physical-product seller payouts require valid shipment tracking when tracking is required for the order.</li>
        <li>Disputes, chargebacks, fraud review, or missing tracking can pause a related payout until the issue is resolved.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Earnings and Independent Participation</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Beezio does not guarantee sales, commissions, referral bonuses, or any level of earnings.</li>
        <li>Users must not make misleading or unsubstantiated earnings claims when promoting Beezio.</li>
        <li>Participation does not make a seller, affiliate, or influencer a Beezio employee solely because the person uses the platform or earns through it.</li>
        <li>Each user is responsible for their own tax, legal, and business obligations.</li>
      </ul>
    </section>
  </LegalPageLayout>
);

export default PaymentsRolesPayouts;
