import React from 'react';

const PayoutTimingNotice: React.FC = () => (
  <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm text-amber-900">
    <div className="font-semibold mb-1">Payout Timing Notice</div>
    <div>
      “To help prevent fraud and handle disputes, seller, partner, and influencer payouts are issued after a
      standard risk review period of up to 14 days. Payouts may be delayed or canceled if a chargeback,
      dispute, or suspected fraud is detected.”
    </div>
  </div>
);

export default PayoutTimingNotice;
