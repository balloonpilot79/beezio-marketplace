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
    label: "Founding influencers • Beezio beta",
    title: "Help us launch Beezio. Earn when the sellers and affiliates you introduce make qualifying product sales.",
    description:
      "Beezio is a brand-new marketplace built to help sellers move products through affiliates. We’re inviting early influencers and creators to help bring sellers and affiliates together. Share your personal referral link. If an eligible seller or affiliate joins through your link and later participates in a qualifying product sale, your referral relationship can earn an influencer bonus. You are not paid for the signup itself, and income is never guaranteed.",
    features: [
      [
        "Share one tracked referral link",
        "Invite product owners who may want to sell and people who may want to promote products as affiliates. When they join through your personal Beezio referral link, the platform can connect that seller or affiliate relationship to you.",
      ],
      [
        "Your earnings come from real product sales",
        "A signup by itself does not create an influencer payment. When an eligible seller or affiliate you referred participates in a qualifying product sale, the applicable influencer bonus can be recorded for you. There is no one-sale or two-sale cutoff simply because the referral has already produced a sale.",
      ],
      [
        "Help put more products in front of more people",
        "Sellers bring products. Affiliates help move those products. Influencers help grow the network connecting them. There is no inventory to buy or orders to ship just to participate as an influencer, and no specific level of earnings is promised.",
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
        "Affiliates earn commissions by promoting products. Influencers can earn on qualifying product sales involving eligible sellers and affiliates who joined through their referral link. Influencer compensation comes from qualifying sales, not from a signup by itself.",
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
            {audience === "influencer" && (
              <p className="mt-3 text-sm leading-7 text-slate-600">
                If you promote Beezio or a product and you may receive compensation,
                clearly disclose that financial relationship in the same post,
                video, message, or other promotion. Do not promise or imply that
                anyone is guaranteed to earn money by joining Beezio.
              </p>
            )}
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
