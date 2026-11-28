import { Link } from "react-router-dom";
import { computeFixedTierPricing } from "../../shared/customerPrice";

const example = computeFixedTierPricing({ sellerPayout: 25, affiliatePayout: 5 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const amounts = [
  ["Seller payout", example.sellerPayout],
  ["Affiliate commission", example.affiliatePayout],
  ["Seller and affiliate Ambassador allocation", example.influencerAllocation],
  ["Beezio platform fee", example.platformFee],
  ["Payment processing allowance", example.paypalProcessingAllowance],
  ["Buyer price before shipping and tax", example.finalAdvertisedPrice],
] as const;

export default function BusinessEarningsExample() {
  return (
    <section className="bz-panel mt-8 p-6 sm:p-8" aria-labelledby="business-earnings-example">
      <h2 id="business-earnings-example" className="text-2xl font-semibold">
        Example sale with a {usd.format(example.sellerPayout)} seller payout
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        In this example, a seller sets a {usd.format(example.affiliatePayout)} flat commission and an affiliate brings in a qualifying sale.
        The seller chooses the commission for each participating product.
      </p>
      <dl className="mt-4 max-w-2xl divide-y divide-slate-200">
        {amounts.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-4 py-2 text-sm">
            <dt>{label}</dt>
            <dd className="shrink-0 font-semibold tabular-nums">{usd.format(amount)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        Eligibility and attribution determine who receives commissions and referral rewards.
        Beezio funds any eligible shopper referral reward from the platform fee.
        See the <Link className="underline" to="/legal/payout-policy">payout policy</Link> for timing and terms.
      </p>
    </section>
  );
}
