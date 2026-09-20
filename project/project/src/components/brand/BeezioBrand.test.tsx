import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePageBZO from "../../pages/HomePageBZO";
import JoinPage from "../../pages/JoinPage";
import BusinessLandingPage from "../../pages/BusinessLandingPage";
import GlobalHeaderBar from "../GlobalHeaderBar";
import StorefrontShoppingLinks from "../storefront/StorefrontShoppingLinks";
import DashboardRoleSelector from "../../pages/DashboardRoleSelector";
import { audiences, websiteBenefits } from "./BeezioBrand";

const state = vi.hoisted(() => ({
  user: null as any,
  profile: null as any,
  userRoles: [] as string[],
  loading: false,
}));
vi.mock("../../contexts/AuthContextMultiRole", () => ({
  useAuth: () => ({ ...state, signOut: vi.fn() }),
}));
vi.mock("../../contexts/CartContext", () => ({
  useCart: () => ({ getTotalItems: () => 2 }),
}));
vi.mock("../../utils/cjImportAccess", () => ({
  canAccessCJImport: () => false,
}));

const render = (element: React.ReactElement, location = "/") =>
  renderToStaticMarkup(
    <StaticRouter location={location}>{element}</StaticRouter>,
  );

beforeEach(() => {
  state.user = null;
  state.profile = null;
  state.userRoles = [];
  state.loading = false;
});

describe("Beezio public message and account boundaries", () => {
  it("puts sellers, affiliates and influencers at the core, while welcoming buyers", () => {
    expect(audiences.map((item) => item.id)).toEqual([
      "seller",
      "affiliate",
      "influencer",
      "shopper",
    ]);
    const html = render(<HomePageBZO />);
    expect(html).toContain(
      "Free websites for sellers AND affiliates. Designed by you.",
    );
    expect(html).toContain("No seller fees");
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/marketplace"');
    expect(html).toContain("No business account needed.");
    expect(html).toContain('aria-label="Search products"');
    expect(html).toContain('aria-label="Filter homepage products by category"');
    expect(html).toContain('href="#shop"');
    expect(html).toContain("Earnings are not guaranteed");
    expect(html).not.toContain("fixed inset-x");
  });
  it.each(["seller", "affiliate", "influencer", "overview"] as const)(
    "keeps %s messaging consistent",
    (audience) => {
      const html = render(<BusinessLandingPage audience={audience} />);
      websiteBenefits.forEach((benefit) => expect(html).toContain(benefit));
      expect(html).toContain("Shop the marketplace");
    },
  );
  it("offers a shopper signup without business payout setup", () => {
    const html = render(<JoinPage />);
    expect(html).toContain('href="/account/signup"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain("No business setup or payout details.");
  });
  it("keeps cart and sign-in visible to guests", () => {
    const html = render(<GlobalHeaderBar />);
    expect(html).toContain('aria-label="Cart, 2 items"');
    expect(html).toContain('href="/auth/login"');
    expect(html).toContain('href="/join"');
    expect(html).not.toContain('href="/business"');
  });
  it("keeps business shortcuts out of buyer-only navigation", () => {
    state.user = { id: "buyer", email: "test@example.invalid" };
    state.userRoles = ["buyer"];
    const html = render(<GlobalHeaderBar />);
    expect(html).toContain('href="/account"');
    expect(html).not.toContain('href="/business"');
  });
  it.each(["seller", "affiliate", "influencer"])(
    "gives %s access to both account spaces",
    (role) => {
      state.user = { id: role };
      state.userRoles = [role];
      const html = render(<GlobalHeaderBar />);
      expect(html).toContain('href="/business"');
      expect(html).toContain('href="/account"');
    },
  );
  it("uses shopper-only links on custom pages and preserves the return path", () => {
    const html = render(<StorefrontShoppingLinks />, "/store/marebelle/about");
    expect(html).toContain("/account/login?next=%2Fstore%2Fmarebelle%2Fabout");
    expect(html).toContain("/account/signup?next=%2Fstore%2Fmarebelle%2Fabout");
    expect(html).toContain('href="/cart"');
    expect(html).not.toContain("/business");
  });
  it("does not crash the role selector while auth is loading", () => {
    state.loading = true;
    expect(render(<DashboardRoleSelector />)).toContain("Loading your account");
  });
});
