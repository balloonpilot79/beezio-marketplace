export function earningsBreakdown(snapshot: any) {
  const breakdown = snapshot?.payee_breakdown;
  if (!breakdown) return null;
  const amount = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;
  const lines = [
    { label: 'Seller payout (includes shipping)', amount: amount(breakdown.seller_payable_amount ?? breakdown.seller_amount) },
    { label: 'Affiliate commissions', amount: amount(snapshot.affiliate_payout_paid_total ?? breakdown.partner_amount) },
    { label: 'Ambassador rewards', amount: amount(Number(snapshot.influencer_bonus_paid_total || 0) + Number(snapshot.buyer_referral_total || 0)) },
    { label: 'Payment processing (recorded estimate)', amount: amount(snapshot.paypal_fee_estimate ?? breakdown.paypal_fee_estimate) },
    { label: 'Beezio retained', amount: amount(snapshot.beezio_operating_profit ?? breakdown.beezio_operating_profit) },
    { label: 'Tax', amount: amount(snapshot.tax_amount ?? breakdown.tax_amount) },
  ];
  const total = amount(snapshot.total_charged ?? breakdown.total_charged);
  const allocated = amount(lines.reduce((sum, line) => sum + line.amount, 0));
  return { lines, total, platformFee: amount(snapshot.platform_fee_gross_total ?? breakdown.beezio_fee_gross), reconciles: Math.abs(allocated - total) < 0.005 };
}
