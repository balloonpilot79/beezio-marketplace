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
    title: "You connect the products. You help power the marketplace.",
    description:
      "Affiliates are central to Beezio’s success. Your recommendations help shoppers discover products and give sellers a way to reach new customers. Build your free custom website, choose products you believe in, and earn commissions when your recommendations lead to qualifying sales. You don’t need your own products to start.",
    features: [
      [
        "Build a store people trust",
        "Create a free custom website with your branding and product collections. Give shoppers a reason to return with thoughtful picks and useful recommendations. No monthly or listing fees.",
      ],
      [
        "Turn recommendations into commissions",
        "Choose eligible marketplace products, review the commission offered, and add them to your store. Share tracked links with your audience and earn on qualifying sales attributed to you.",
      ],
      [
        "No inventory to fulfill",
        "Focus on connecting people with products. The seller or their supplier fulfills orders, while your Business Center keeps your promoted products, tracked sales, and payouts together. Your growth helps sellers grow, too.",
      ],
    ],
  },
  influencer: {
    label: "For influencers & creators",
    title: "Refer once. Earn as they sell. Build your earning potential.",
    description:
      "When a seller or affiliate signs up with your referral code or link, you earn commission on every qualifying sale they make on Beezio. With lifetime referral attribution, your earning opportunity continues beyond their first sale. No inventory to buy or orders to ship.",
    features: [
      [
        "Share your code or link",
        "Invite product owners to become sellers and people with great recommendations to become affiliates. Have them sign up with your personal referral code or link so their account is connected to you.",
      ],
      [
        "Earn as your referrals sell",
        "Earn commission on every qualifying sale made by the sellers and affiliates you refer. Lifetime referral attribution keeps that connection in place—not just for their first order. Commissions come from sales, not signups.",
      ],
      [
        "Grow your network. Grow your potential.",
        "A network of active sellers and affiliates can create multiple sources of recurring commissions. Help your referrals get started and keep growing your connections. Your earning potential grows with their qualifying sales; income is not guaranteed.",
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
        "Affiliates earn commissions by promoting products. Influencers earn commission on every qualifying sale made by sellers and affiliates who sign up with their referral code or link—with lifetime referral attribution.",
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
              {audience === "influencer" ? "Join free as an influencer" : "Start your free website"}
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
              A shopper does not need an affiliate or business account to buy.
              Sellers, affiliates, and influencers can get started free and
              manage their business from one account.
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
