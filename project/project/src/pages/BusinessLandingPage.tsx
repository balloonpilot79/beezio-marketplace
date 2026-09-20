import { Link } from "react-router-dom";
import { ArrowRight, Check, Palette } from "lucide-react";
import PublicLayout from "../components/layout/PublicLayout";
import {
  AudienceCards,
  pricingExplanation,
  WebsiteBenefits,
  WebsiteInvitation,
} from "../components/brand/BeezioBrand";

const content = {
  seller: {
    label: "For sellers",
    title: "Your products. Your website. More people selling for you.",
    description:
      "Get a free custom website you design yourself. Sell directly to shoppers and let affiliates feature your products in their own stores and promotions. No monthly fees, listing fees, or seller fees.",
    features: [
      [
        "Design your own website",
        "Choose a template, add your branding, organize products, and create custom pages. Your hosted Beezio storefront is included.",
      ],
      [
        "Let others help you sell",
        "Make eligible products available to affiliates. They promote through their websites and tracked links, earning the commission shown for each sale.",
      ],
      [
        "Stay in control",
        "Set the amount you need to receive, manage product availability, and handle orders and fulfillment in your Business Center.",
      ],
    ],
  },
  affiliate: {
    label: "For affiliates",
    title: "Your taste. Your free website. Your next commission.",
    description:
      "You don’t need your own products to start. Design your free custom website, choose marketplace products, and earn commissions when your recommendations lead to eligible sales.",
    features: [
      [
        "Make it your own",
        "Build a free custom website with your logo, colors, images, collections, and custom pages. You design it yourself.",
      ],
      [
        "Curate, share, earn",
        "Add eligible marketplace products to your store and share tracked links. Review commission terms before you promote.",
      ],
      [
        "No inventory to fulfill",
        "The seller or their supplier fulfills the order. Your Business Center keeps promoted products, tracked sales, and payouts in one place.",
      ],
    ],
  },
  influencer: {
    label: "For influencers & creators",
    title: "Bring your community. Build something together.",
    description:
      "Introduce sellers and affiliates to Beezio with your recruiting link. Lifetime attribution connects you to eligible sales from the businesses you bring in—not just a one-time signup.",
    features: [
      [
        "Introduce businesses",
        "Invite product owners to sell on Beezio and creators to build affiliate websites. Share your personal recruiting link.",
      ],
      [
        "Earn from eligible sales",
        "Influencer earnings are tied to qualifying sales by referred sellers and affiliates, not the act of recruiting or creating an account.",
      ],
      [
        "Build an affiliate store, too",
        "Use your affiliate tools to design a free custom website and curate products for your audience. Product commissions and influencer earnings are tracked separately.",
      ],
    ],
  },
  overview: {
    label: "How Beezio works",
    title: "A place to shop. A place to sell. A way to earn.",
    description:
      "Shoppers buy products. Sellers bring the products. Affiliates recommend them. Influencers introduce businesses. Beezio brings the storefronts, checkout, and tracking together.",
    features: [
      [
        "Shop directly",
        "Explore the marketplace or visit a custom storefront. Choose your product, review shipping and the total, and check out on Beezio.",
      ],
      [
        "Build your free website",
        "Sellers and affiliates each get a custom website they design themselves. List your own products or curate eligible products from the marketplace.",
      ],
      [
        "Grow through recommendations",
        "Affiliates earn commissions on attributed sales. Influencers receive lifetime attribution on eligible sales from the sellers and affiliates they introduce.",
      ],
    ],
  },
};

export default function BusinessLandingPage({
  audience,
}: {
  audience: keyof typeof content;
}) {
  const page = content[audience];
  return (
    <PublicLayout>
      <section className="grid items-center gap-10 rounded-3xl bg-[#faf9f5] p-6 sm:p-10 lg:grid-cols-[1.35fr_1fr]">
        <div>
          <p className="bz-eyebrow">{page.label}</p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-5 leading-7 text-slate-600">{page.description}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/signup" className="bz-button bz-button-gold">
              Start your free website
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/marketplace" className="bz-button bz-button-outline">
              Shop the marketplace
            </Link>
          </div>
        </div>
        <aside className="bz-panel p-7">
          <Palette className="h-7 w-7" aria-hidden="true" />
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            Your website. Designed by you.
          </h2>
          <p className="mt-3 mb-6 text-sm leading-6 text-slate-600">
            For sellers with products and affiliates with great recommendations.
          </p>
          <WebsiteBenefits />
          <Link to="/faq/storefronts" className="bz-text-link mt-6">
            Website setup guide
            <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>
      <section className="grid gap-5 py-12 md:grid-cols-3">
        {page.features.map(([title, detail], index) => (
          <article key={title} className="bz-panel p-6">
            <p className="bz-eyebrow">0{index + 1}</p>
            <h2 className="mt-4 text-xl font-semibold">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{detail}</p>
          </article>
        ))}
      </section>
      <section className="border-y border-slate-200 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">
          Free to start. Transparent about how it works.
        </h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm leading-7 text-slate-600">
              {pricingExplanation}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              On a direct marketplace purchase without an affiliate referral,
              Beezio receives the affiliate allocation. A shopper does not need
              an affiliate or business account to buy.
            </p>
          </div>
          <div>
            <p className="text-sm leading-7 text-slate-600">
              Affiliate and influencer earnings depend on eligible, attributed
              sales. Income is not guaranteed. Returns, verification, and payout
              policies apply.
            </p>
            <div className="mt-4 flex flex-wrap gap-5">
              <Link to="/legal/payout-policy" className="bz-text-link">
                Payout policy
              </Link>
              <Link to="/legal/partner-terms" className="bz-text-link">
                Affiliate terms
              </Link>
              <Link to="/legal/influencer-terms" className="bz-text-link">
                Influencer terms
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="py-12">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">
          One login. The right space for what you do.
        </h2>
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-3 text-sm leading-6 text-slate-600">
            <Check className="mt-1 h-4 w-4 shrink-0" />
            <p>
              <strong className="font-semibold text-slate-900">
                Shopper Account:
              </strong>{" "}
              your purchases, receipts, and order support.
            </p>
          </div>
          <div className="flex items-start gap-3 text-sm leading-6 text-slate-600">
            <Check className="mt-1 h-4 w-4 shrink-0" />
            <p>
              <strong className="font-semibold text-slate-900">
                Business Center:
              </strong>{" "}
              your website, products, promotions, referrals, and earnings.
            </p>
          </div>
        </div>
        <AudienceCards />
      </section>
      <WebsiteInvitation />
    </PublicLayout>
  );
}
