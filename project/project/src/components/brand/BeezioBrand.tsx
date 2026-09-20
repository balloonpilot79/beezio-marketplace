import {
  ArrowRight,
  Check,
  Globe,
  Palette,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

export const websiteBenefits = [
  "Free custom websites for sellers and affiliates",
  "Your design, your branding, your product collection",
  "No monthly fees. No listing fees. No seller fees.",
];

export const pricingExplanation =
  "You set the amount you receive for your product. Beezio’s platform charges and affiliate commissions are built into the selling price, not deducted from that amount. Product, fulfillment, shipping, and tax costs still apply as relevant.";

export const audiences = [
  {
    id: "seller",
    icon: Store,
    label: "For sellers",
    title: "Your products. More reach.",
    description:
      "Design your free website, list your products, and let affiliates promote them through their own stores and links.",
    action: "Explore selling",
    href: "/sellers",
  },
  {
    id: "affiliate",
    icon: Globe,
    label: "For affiliates",
    title: "Your picks. Your payday.",
    description:
      "Design your free website, fill it with marketplace products, and earn commissions on the sales you generate.",
    action: "Explore affiliate stores",
    href: "/affiliates",
  },
  {
    id: "influencer",
    icon: Users,
    label: "For influencers",
    title: "Your audience. New possibilities.",
    description:
      "Introduce sellers and affiliates to Beezio and earn on their eligible sales through lifetime referral attribution.",
    action: "Explore influencer earnings",
    href: "/start-earning",
  },
  {
    id: "shopper",
    icon: ShoppingBag,
    label: "For shoppers",
    title: "Find your next favorite.",
    description:
      "Browse the marketplace, explore independent stores, and buy directly on Beezio. No selling or promoting required.",
    action: "Shop the marketplace",
    href: "/marketplace",
  },
] as const;

export function BeezioMark({
  subtitle = "Sell. Share. Earn.",
}: {
  subtitle?: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffcb05] text-base font-extrabold text-[#101820]"
      >
        bz.
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-tight text-[#101820]">
          beezio
        </span>
        <span className="block text-[10px] font-medium tracking-wide text-slate-500">
          {subtitle}
        </span>
      </span>
    </span>
  );
}

export function AudienceCards() {
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {audiences
          .filter((audience) => audience.id !== "shopper")
          .map(
            ({ id, icon: Icon, label, title, description, action, href }) => (
              <article key={id} className="bz-panel flex flex-col p-6">
                <Icon
                  aria-hidden="true"
                  className="mb-6 h-6 w-6 text-[#101820]"
                />
                <p className="bz-eyebrow">{label}</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                  {description}
                </p>
                <Link to={href} className="bz-text-link mt-6">
                  {action}
                  <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                </Link>
              </article>
            ),
          )}
      </div>
      <aside className="mt-5 flex flex-col justify-between gap-4 rounded-xl bg-[#faf9f5] p-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <ShoppingBag className="mt-1 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-base font-semibold">
              Just here to shop? You’re welcome, too.
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Discover products and buy directly. No selling or promoting
              required.
            </p>
          </div>
        </div>
        <Link to="/marketplace" className="bz-text-link shrink-0">
          Shop the marketplace
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
}

export function WebsiteBenefits() {
  return (
    <ul className="space-y-3 text-sm text-slate-700">
      {websiteBenefits.map((benefit) => (
        <li key={benefit} className="flex items-start gap-3">
          <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  );
}

export function WebsiteInvitation() {
  return (
    <section className="bz-panel grid gap-7 bg-[#faf9f5] p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <p className="bz-eyebrow">Made for sellers and affiliates</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          Your website. Your way. Free.
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Choose a template, make it your own, and build a store around your
          products or your recommendations.
        </p>
      </div>
      <Link to="/signup" className="bz-button bz-button-gold">
        <Palette className="h-4 w-4" aria-hidden="true" />
        Start your free website
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

/** A quiet platform signature; never replaces a store owner's branding. */
export function StorefrontSignature() {
  return (
    <div className="border-t border-slate-200 bg-[#faf9f5] px-4 py-5 text-[#101820]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs sm:flex-row">
        <Link
          to="/"
          className="font-semibold text-slate-600 hover:text-slate-900"
        >
          Storefront & checkout powered by Beezio
        </Link>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link to="/account" className="text-slate-600 hover:text-slate-900">
            Your orders & support
          </Link>
          <Link
            to="/signup"
            className="font-semibold text-slate-700 hover:text-slate-900"
          >
            Create your free website <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
