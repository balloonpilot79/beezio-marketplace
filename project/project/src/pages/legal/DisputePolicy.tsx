import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const DisputePolicy: React.FC = () => (
  <LegalPageLayout title="Dispute Policy" updated="June 13, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Payouts Paused During Disputes</h2>
      <p>
        If a dispute is opened, related payouts are paused until the dispute is resolved. This applies to seller,
        partner, and influencer payouts tied to the order.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Evidence Requirements</h2>
      <p>
        Sellers must provide documentation such as tracking numbers, carrier confirmation, delivery proof,
        and any related shipment records requested by Beezio. Beezio may request additional documentation to
        support dispute resolution.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Tracking Requirement</h2>
      <p>
        Orders with a shipping address are not eligible for seller payout until valid tracking has been provided.
        Sellers are required to enter tracking when an order is shipped.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Return Shipment Evidence</h2>
      <p>
        When a return is approved, buyers must provide return shipment tracking or other return-shipment proof
        requested by the seller or Beezio before a return, refund, or dispute can be finalized.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Resolution Handling</h2>
      <p>
        Once a dispute is resolved, payouts may resume if the order is eligible and no other holds apply. Disputes
        resolved against the seller may result in payout reversals.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">6. Insurance Lead Disputes</h2>
      <p>
        Insurance lead payouts and wallet charges may be held or reviewed if a lead is disputed for fraud, duplication,
        missing verification, out-of-state mismatch, or non-compliant promotion. Insurance is intended for vetted warm
        inbound requests, not cold lead traffic. Insurance submissions are intended for one-agent contact after
        qualification and verification, not mass distribution.
      </p>
      <p className="mt-3">
        Approved insurance lead disputes are resolved as account credit restored to the agent wallet. Beezio does not
        issue cash refunds for used or unused insurance lead balance except where required by law.
      </p>
    </section>
    <section>
      <h2 className="text-xl font-semibold text-gray-900">6. Insurance Promotion Compliance</h2>
      <p>
        If Beezio determines an insurance storefront or partner promotion used prohibited language such as guaranteed
        approval, guaranteed coverage, cold-lead claims, or multi-agent blast promises, related payouts may be held,
        reversed, or denied while moderation review is completed.
      </p>
    </section>
  </LegalPageLayout>
);

export default DisputePolicy;
