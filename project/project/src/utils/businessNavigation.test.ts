import { describe, expect, it } from "vitest";
import {
  businessPath,
  legacyDashboardTarget,
  showBusinessNavigation,
} from "./businessNavigation";
import { safePostAuthPath } from "./storefrontScope";

describe("business and shopping navigation", () => {
  it.each(["seller", "affiliate", "influencer"])(
    "preserves %s when changing website tabs",
    (role) => {
      expect(businessPath(role, "store-customization")).toBe(
        `/business?section=${role}&tab=store-customization`,
      );
    },
  );
  it("sends legacy store setup links to website design", () => {
    expect(legacyDashboardTarget("/dashboard/store", "", true, false)).toBe(
      "/business?tab=store-customization",
    );
    expect(
      legacyDashboardTarget("/dashboard/affiliate", "?tab=orders", true, false),
    ).toBe("/business?section=affiliate&tab=orders");
    expect(
      legacyDashboardTarget(
        "/dashboard",
        "?section=influencer&tab=payouts",
        true,
        false,
      ),
    ).toBe("/business?section=influencer&tab=financials");
  });
  it("never sends a buyer-only user to a business or admin dashboard", () => {
    expect(
      legacyDashboardTarget("/dashboard/seller", "?tab=orders", false, false),
    ).toBe("/account?tab=orders");
    expect(legacyDashboardTarget("/dashboard/admin", "", false, false)).toBe(
      "/account",
    );
    expect(
      legacyDashboardTarget("/dashboard/buyer", "?tab=orders", true, true),
    ).toBe("/account?tab=orders");
  });
  it.each([
    "/",
    "/marketplace",
    "/sellers",
    "/signup",
    "/account",
    "/store/my-store",
  ])("hides business subnavigation on %s", (path) => {
    expect(showBusinessNavigation(path, true, false, false)).toBe(false);
  });
  it("shows business navigation only in its signed-in shell", () => {
    expect(showBusinessNavigation("/business", true, false, false)).toBe(true);
    expect(showBusinessNavigation("/business", false, false, false)).toBe(
      false,
    );
    expect(
      showBusinessNavigation("/business/products/add", true, false, true),
    ).toBe(false);
  });
  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\n/evil.example",
  ])("rejects unsafe login redirects: %s", (path) => {
    expect(safePostAuthPath(path)).toBeNull();
  });
  it("keeps local checkout and custom-page return paths", () => {
    expect(safePostAuthPath("/checkout?from=store")).toBe(
      "/checkout?from=store",
    );
    expect(safePostAuthPath("/store/marebelle/about")).toBe(
      "/store/marebelle/about",
    );
  });
});
