import React from "react";
import { Link } from "react-router-dom";
import { BeezioMark } from "./brand/BeezioBrand";

const groups = [
  {
    title: "Shop",
    links: [
      ["Marketplace", "/marketplace"],
      ["Shopper account", "/account"],
      ["Orders & support", "/account?tab=orders"],
      ["Shipping", "/shipping"],
      ["Returns & refunds", "/returns"],
    ],
  },
  {
    title: "Build & earn",
    links: [
      ["Free seller websites", "/sellers"],
      ["Free affiliate websites", "/affiliates"],
      ["Influencers", "/start-earning"],
      ["How it works", "/how-it-works"],
      ["Business Center", "/business"],
    ],
  },
  {
    title: "Help & company",
    links: [
      ["Help center", "/help-center"],
      ["FAQ", "/faq"],
      ["Contact us", "/contact"],
      ["About Beezio", "/about"],
    ],
  },
];
const terms = [
  ["Terms", "/legal/terms"],
  ["Privacy", "/legal/privacy"],
  ["Seller terms", "/legal/seller-terms"],
  ["Affiliate terms", "/legal/partner-terms"],
  ["Influencer terms", "/legal/influencer-terms"],
  ["Payout policy", "/legal/payout-policy"],
  ["Refund policy", "/legal/refund-policy"],
  ["Dispute policy", "/legal/dispute-policy"],
];

const Footer: React.FC = () => (
  <footer className="border-t border-[#2e464e] bg-[#142a34] pb-20 text-slate-300 xl:pb-0">
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <div>
          <Link to="/" aria-label="Beezio home">
            <BeezioMark inverse />
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-6">
            Free custom websites. Sellers, affiliates, and influencers growing
            together. A marketplace everyone can shop.
          </p>
          <a
            href="mailto:support@beezio.co"
            className="mt-4 inline-flex text-xs text-[#ffdb66] hover:text-white"
          >
            support@beezio.co
          </a>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-sm font-semibold text-white">
              {group.title}
            </h2>
            <ul className="mt-4 space-y-3 text-xs">
              {group.links.map(([label, href]) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="text-slate-300 hover:text-[#ffdb66]"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mt-10 flex flex-col justify-between gap-4 border-t border-[#3a5059] pt-6 text-[11px] lg:flex-row">
        <p>© {new Date().getFullYear()} Beezio. All rights reserved.</p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-3">
          {terms.map(([label, href]) => (
            <Link
              key={href}
              to={href}
              className="text-slate-300 hover:text-[#ffdb66]"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  </footer>
);

export default Footer;
