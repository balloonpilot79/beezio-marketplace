import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const PaymentsRolesPayouts: React.FC = () => (
  <LegalPageLayout title="Payments, Roles, and Payout System" updated="June 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Platform Role Definitions</h2>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">Beezio</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>Beezio is a marketplace platform that facilitates transactions between buyers and independent sellers.</li>
        <li>Beezio is not an employer, not an escrow service, and not an investment platform.</li>
        <li>Beezio charges a platform fee for facilitating transactions, payment processing, and marketplace services.</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">Seller</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>Sellers are independent sellers responsible for listing, pricing, fulfillment, and customer satisfaction.</li>
        <li>Sellers set their own product prices and Partner commission rates.</li>
        <li>Sellers are paid after a standard payout review period and only after required shipment tracking has been provided for shipped orders.</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">Partner (formerly Affiliate)</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>Partners are independent contractors who promote products listed on Beezio.</li>
        <li>Partners may add products from the Beezio marketplace to their own storefronts or links.</li>
        <li>Partner commissions are set by the seller, not Beezio.</li>
        <li>Partners are paid only on valid, completed sales.</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">Influencer</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>Influencers are independent contractors who refer Partners to the Beezio platform.</li>
        <li>Influencers earn a portion of Beezio’s platform fee, not seller or partner earnings.</li>
        <li>Influencers do not set prices, commissions, or product terms.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Platform Fee &amp; Earnings Structure</h2>
      <p className="mt-2">Every sale follows this structure:</p>
      <ul className="list-disc list-inside space-y-2">
        <li>Gross Sale Amount = 100%</li>
        <li>Beezio Platform Fee = 15% TOTAL (this fee is never increased due to influencer involvement)</li>
        <li>If NO influencer is involved: Beezio keeps 15%</li>
        <li>If an influencer IS involved: Influencer receives 5% and Beezio keeps 10% (total platform fee remains 15%)</li>
        <li>Influencer earnings are paid only from Beezio’s platform fee, never from seller or partner funds.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Seller &amp; Partner Payout Logic</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Seller earnings are calculated after the platform fee and partner commission (and applicable taxes/shipping rules).</li>
        <li>Partner commission percentage is set per product or seller default.</li>
        <li>Partner commissions are paid only on completed, undisputed sales.</li>
        <li>Influencer earnings do not affect seller or partner payouts.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Payments &amp; Payout Flow (PayPal)</h2>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">Checkout</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>Buyer completes checkout using PayPal.</li>
        <li>Payment is captured to Beezio’s PayPal Business account.</li>
        <li>Order and payout records are created immediately.</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">Payout Review Period (Fraud Prevention)</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>Seller, Partner, and Influencer payouts are subject to a standard review period of up to 14 days.</li>
        <li>This period allows time to detect fraud, chargebacks, and buyer disputes.</li>
        <li>During the review period, payouts are not released.</li>
        <li>If a dispute or chargeback occurs, payouts are paused.</li>
      </ul>

      <h3 className="text-lg font-semibold text-gray-900 mt-4">Payout Release &amp; Batch Payments</h3>
      <ul className="list-disc list-inside space-y-2">
        <li>After up to 14 days (and if no disputes, tracking holds, or fraud holds exist), earnings become eligible for payout.</li>
        <li>Payouts are issued using PayPal batch payouts (multiple recipients paid at once).</li>
        <li>Payout requirements include a valid PayPal email on file, minimum payout threshold (e.g., $25), account in good standing, and valid shipment tracking for orders that require shipping.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Disputes &amp; Chargebacks</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>If a dispute or chargeback is opened, associated payouts are paused and marked ON HOLD – DISPUTE.</li>
        <li>Funds are released only after resolution.</li>
        <li>If a dispute is lost, related earnings may be reversed or canceled.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">6. Independent Contractor Status</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Sellers, Partners, and Influencers are independent contractors, not employees.</li>
        <li>Beezio does not guarantee earnings.</li>
        <li>Earnings depend on actual completed sales.</li>
        <li>Beezio does not provide financial, tax, or investment advice.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">7. Compliance Summary</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Beezio facilitates transactions; PayPal processes payments.</li>
        <li>Payout timing is disclosed and contractually agreed.</li>
        <li>Influencers are paid only from Beezio’s platform fee.</li>
        <li>Sellers set prices and commissions.</li>
        <li>Beezio does not custody funds outside PayPal.</li>
        <li>Fraud and dispute controls are in place.</li>
      </ul>
    </section>
  </LegalPageLayout>
);

export default PaymentsRolesPayouts;
