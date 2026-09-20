import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Globe, Palette, ShoppingBag } from "lucide-react";
import PublicLayout from "../components/layout/PublicLayout";
import {
  AudienceCards,
  pricingExplanation,
  WebsiteBenefits,
  WebsiteInvitation,
} from "../components/brand/BeezioBrand";

const storefronts = [
  {
    name: "MareBelle",
    slug: "marebelle",
    label: "Equestrian beauty & lifestyle",
    image: "/marebelle-storefront-example.png",
    imageClass: "object-cover object-top",
    background: "#eae2d5",
  },
  {
    name: "RedTail",
    slug: "redtail",
    label: "Fresh-roasted coffee & bold blends",
    image: "/redtail-ridgeline-homepage.webp?v=20260725",
    imageClass: "object-contain p-5",
    background: "#231416",
  },
  {
    name: "Loving Nutrition",
    slug: "loving-nutrition",
    label: "Nutrition & everyday wellness",
    image: "/loving-nutrition-logo.png?v=20260723",
    imageClass: "object-contain p-7",
    background: "#063c2f",
  },
];

const HomePageBZO: React.FC = () => (
  <PublicLayout
    className="bz-public bg-white"
    contentClassName="!py-6 sm:!py-10"
  >
    <section className="bz-home-hero grid items-center gap-10 rounded-3xl bg-[#faf9f5] px-6 py-10 sm:p-10 lg:grid-cols-[1.15fr_1fr] lg:p-12">
      <div>
        <p className="bz-eyebrow">
          Built for sellers. Powered by affiliates & influencers.
        </p>
        <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-[#101820] sm:text-6xl lg:text-[4.25rem]">
          Your website.
          <br />
          <span className="bz-highlight">More ways to earn.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
          Design your free custom website. Sell your products, earn commissions
          promoting others, or grow the network as an influencer. Together, we
          give buyers more to discover.
        </p>
        <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
          <Link to="/signup" className="bz-button bz-button-gold">
            Start your free website
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/marketplace" className="bz-button bz-button-outline">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Shop the marketplace
          </Link>
        </div>
        <p className="mt-5 text-xs leading-6 text-slate-500">
          Just here to shop? You’re in the right place. No business account
          needed.
        </p>
      </div>
      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_-30px_rgba(16,24,32,.35)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Globe className="h-4 w-4" aria-hidden="true" />
              Built with Beezio
            </span>
            <span className="rounded-full bg-[#fff4bb] px-3 py-1 text-xs font-semibold">
              Your brand, front and center
            </span>
          </div>
          <Link to="/store/marebelle" className="group block">
            <div className="aspect-[4/3] overflow-hidden bg-[#eae2d5]">
              <img
                src="/marebelle-storefront-example.png"
                alt="MareBelle, an example of a custom website built with Beezio"
                className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
                loading="eager"
              />
            </div>
            <div className="flex items-center justify-between gap-3 p-5">
              <div>
                <span className="text-sm font-semibold text-slate-900">
                  MareBelle
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  A Beezio-created storefront
                </p>
              </div>
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                Visit store
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </Link>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
          <Palette className="h-4 w-4" aria-hidden="true" />
          Free websites for sellers AND affiliates. Designed by you.
        </div>
      </div>
    </section>

    <div
      aria-label="Beezio business benefits"
      className="grid gap-4 border-b border-slate-200 py-7 text-sm font-semibold sm:grid-cols-3"
    >
      {[
        "Free custom websites",
        "No monthly or listing fees",
        "No seller fees",
      ].map((text) => (
        <div key={text} className="flex items-center justify-center gap-2">
          <Check className="h-4 w-4" aria-hidden="true" />
          {text}
        </div>
      ))}
    </div>

    <section className="py-14 sm:py-20">
      <div className="mb-8 max-w-2xl">
        <p className="bz-eyebrow">The people who power Beezio</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Sellers. Affiliates. Influencers.
          <br />
          Built to grow together.
        </h2>
        <p className="mt-4 leading-7 text-slate-600">
          Sellers bring the products. Affiliates help sell them. Influencers
          introduce more businesses. That’s how we build a marketplace buyers
          want to shop.
        </p>
      </div>
      <AudienceCards />
    </section>

    <section className="grid gap-10 rounded-3xl bg-[#faf9f5] p-6 sm:p-10 lg:grid-cols-2 lg:gap-16">
      <div>
        <p className="bz-eyebrow">Not just a listing. Your own website.</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Made by you.
          <br />
          Built for your next chapter.
        </h2>
        <p className="mt-5 leading-7 text-slate-600">
          Sellers and affiliates both get free custom websites they can design
          themselves. Start with a template. Add your logo, colors, images,
          collections, and custom pages. Make it feel like you.
        </p>
        <div className="mt-6">
          <WebsiteBenefits />
        </div>
        <Link to="/signup" className="bz-text-link mt-7">
          Create your website
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid content-center gap-4">
        {[
          [
            "01",
            "Make it yours",
            "Choose your look, tell your story, and add custom pages. No coding required.",
          ],
          [
            "02",
            "Choose what you sell",
            "List your own products, or curate marketplace products as an affiliate.",
          ],
          [
            "03",
            "Give people a place to shop",
            "Share your website and tracked links. Manage your activity in your Business Center.",
          ],
        ].map(([number, title, detail]) => (
          <div key={number} className="bz-panel flex gap-4 p-5">
            <span className="text-sm font-semibold text-slate-400">
              {number}
            </span>
            <div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="py-14 sm:py-20">
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="bz-eyebrow">Explore the possibilities</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Different brands. One Beezio.
          </h2>
        </div>
        <Link to="/marketplace" className="bz-text-link">
          Shop all products
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {storefronts.map((store) => (
          <Link
            key={store.slug}
            to={`/store/${store.slug}`}
            className="bz-panel group overflow-hidden"
          >
            <div
              className="aspect-[4/3] overflow-hidden"
              style={{ backgroundColor: store.background }}
            >
              <img
                src={store.image}
                alt={`${store.name} storefront`}
                loading="lazy"
                className={`h-full w-full transition duration-300 group-hover:scale-[1.02] ${store.imageClass}`}
              />
            </div>
            <div className="flex items-center justify-between gap-3 p-5">
              <div>
                <h3 className="text-lg font-semibold">{store.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{store.label}</p>
              </div>
              <ArrowRight
                className="h-4 w-4 text-slate-700"
                aria-hidden="true"
              />
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Beezio-created brands showing what a custom storefront can look like.
      </p>
    </section>

    <section className="grid gap-8 border-y border-slate-200 py-10 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <p className="bz-eyebrow">Free to build. Clear on costs.</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          No seller fees.
          <br />
          Here’s what that means.
        </h2>
      </div>
      <div>
        <p className="leading-7 text-slate-600">{pricingExplanation}</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Affiliate and influencer earnings come from eligible sales, not
          signups. Earnings are not guaranteed and are subject to returns and
          payout terms.
        </p>
        <Link to="/how-it-works" className="bz-text-link mt-5">
          See how Beezio works
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
    <div className="pt-14 pb-6">
      <WebsiteInvitation />
    </div>
  </PublicLayout>
);

export default HomePageBZO;
