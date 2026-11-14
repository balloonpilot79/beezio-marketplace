import React, { useState } from 'react';
import { getPriceFit } from '../utils/priceFit';

interface Props {
  sellerPayout: number;
  affiliatePayout: number;
  shipping: number;
  productCost: number;
  onApplySellerPayout: (amount: number) => void;
}

export default function PriceFitCheck(props: Props) {
  const [target, setTarget] = useState('');
  const fit = getPriceFit({ ...props, targetDeliveredPrice: Number(target) });
  return (
    <section className="mt-4 rounded-xl border border-slate-300 bg-white p-4 text-slate-900" aria-label="Check your price">
      <h3 className="font-bold">Check your price before publishing</h3>
      <p className="mt-1 text-sm text-slate-600">
        Compare similar products with the same size, features and delivery terms. Enter the total you want a buyer to pay, including shipping and before tax.
      </p>
      <label htmlFor="target-delivered-price" className="mt-3 block text-sm font-semibold">Target buyer total including shipping (optional)</label>
      <input id="target-delivered-price" type="number" min="0.01" step="0.01" inputMode="decimal"
        value={target} onChange={event => setTarget(event.target.value)} placeholder="e.g., 49.99"
        className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2" />
      {fit && <div className="mt-3 space-y-2 text-sm" aria-live="polite">
        <p className={fit.overTarget ? 'font-semibold text-red-700' : 'font-semibold text-slate-900'}>
          Current total including shipping: ${fit.currentDeliveredPrice.toFixed(2)}.
          {fit.overTarget ? ` That is $${fit.difference.toFixed(2)} above your target.` : ' This fits your target.'}
        </p>
        <p>Affiliate payout stays ${props.affiliatePayout.toFixed(2)} per sale. Shipping stays ${props.shipping.toFixed(2)}.</p>
        {fit.maxSellerPayout === null ? <p className="font-semibold text-red-700">This target cannot cover the chosen affiliate payout, shipping and required charges. Review the product, price or payout.</p> : <>
          <p>Maximum seller payout within your target: <strong>${fit.maxSellerPayout.toFixed(2)}</strong>, plus the shipping amount.</p>
          {fit.belowKnownCost ? <p className="font-semibold text-red-700">That payout is below the entered product cost. This combination would lose money before your other expenses.</p> : fit.marginAtTarget !== null ?
            <p>Amount left after the entered product cost: ${fit.marginAtTarget.toFixed(2)}, before your other expenses.</p> :
            <p className="text-slate-600">Product cost is not entered here. Check your cost and profit before applying this payout.</p>}
          <button type="button" disabled={fit.belowKnownCost} onClick={() => props.onApplySellerPayout(fit.maxSellerPayout!)}
            className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Use this seller payout</button>
        </>}
      </div>}
    </section>
  );
}
