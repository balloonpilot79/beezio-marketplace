import React from 'react';
import LegalPageLayout from './LegalPageLayout';

const InfluencerTerms: React.FC = () => (
  <LegalPageLayout title="Influencer Terms" updated="October 7, 2026">
    <section>
      <h2 className="text-xl font-semibold text-gray-900">1. Program Overview</h2>
      <p>
        Beezio influencers may refer sellers and affiliates to the platform. Participation in the influencer program
        is free, and no inventory purchase is required to participate. Influencer compensation is tied to eligible,
        qualifying product sales and is not paid merely because another person signs up.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">2. Referral Attribution and Eligibility</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Beezio may record a seller-referrer relationship and an affiliate-referrer relationship for an eligible transaction.</li>
        <li>A signup by itself does not create an influencer payout.</li>
        <li>Referral attribution may remain associated with an eligible account rather than ending after the first sale.</li>
        <li>Compensation applies only to qualifying sales while the program, the account, and the applicable referral relationship remain eligible under Beezio&apos;s current rules.</li>
        <li>Returns, refunds, chargebacks, fraud, duplicate or self-referrals, or other ineligible activity may reduce, delay, or void related bonuses.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">3. Earnings and Program Terms</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Beezio does not guarantee that an influencer will earn money or that a referred seller or affiliate will make sales.</li>
        <li>Any influencer bonus is determined by the program rules applicable to the qualifying transaction when it is recorded.</li>
        <li>Beezio may update referral-bonus amounts, eligibility rules, or related programs prospectively, with notice when required by law.</li>
        <li>Changes do not rewrite amounts already recorded for completed, eligible transactions unless a refund, chargeback, fraud finding, or other valid adjustment applies.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">4. Advertising and Required Disclosures</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Influencers must make truthful, non-misleading statements about Beezio, its products, and the influencer program.</li>
        <li>Influencers must not promise, imply, or guarantee any particular income, lifestyle, sales volume, or financial result.</li>
        <li>If an influencer promotes Beezio, a seller, an affiliate, or a product and may receive compensation, the influencer must clearly and conspicuously disclose that financial relationship in the promotion.</li>
        <li>Disclosures must be easy to notice and understand and should appear with the promotional message rather than being hidden elsewhere.</li>
        <li>Influencers may not describe participation as employment by Beezio or make claims that conflict with Beezio&apos;s current program terms.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">5. Payout Timing</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Standard eligible earnings are subject to Beezio&apos;s current payout hold and payout schedule.</li>
        <li>Disputes, returns, chargebacks, suspected fraud, verification issues, or other compliance reviews may delay or void related payouts.</li>
        <li>A valid payout destination and any information required for payment or legal compliance must be on file.</li>
      </ul>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">6. Abuse and Fraud</h2>
      <p>
        Abuse of referral links, misleading claims, fake accounts, self-referral schemes, manipulated transactions,
        or fraudulent activity may void related bonuses and may result in suspension or removal from the program.
      </p>
    </section>

    <section>
      <h2 className="text-xl font-semibold text-gray-900">7. Taxes and Independent Participation</h2>
      <p>
        Participation in the influencer program does not make an influencer a Beezio employee. Influencers are
        responsible for their own tax, legal, and business obligations arising from their participation and earnings.
      </p>
    </section>
  </LegalPageLayout>
);

export default InfluencerTerms;
