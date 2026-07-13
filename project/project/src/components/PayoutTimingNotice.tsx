import React from 'react';

const PayoutTimingNotice: React.FC = () => (
  <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-900">
    <div className="font-semibold mb-1">Payout Timing Notice</div>
    <div>
      Seller, affiliate, and influencer earnings have a standard 14-day hold. Eligible payouts are processed on
      the 15th and last calendar day of each month. Related payouts may be paused for chargebacks, disputes,
      suspected fraud, or missing shipment tracking.
    </div>
  </div>
);

export default PayoutTimingNotice;
