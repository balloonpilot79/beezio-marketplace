const sections = ["seller", "affiliate", "influencer"];

export function businessPath(section: string, tab?: string) {
  const params = new URLSearchParams();
  if (sections.includes(section)) params.set("section", section);
  if (tab) params.set("tab", tab);
  return `/business${params.size ? `?${params}` : ""}`;
}

export function legacyDashboardTarget(
  pathname: string,
  search: string,
  businessAccess: boolean,
  admin: boolean,
) {
  const params = new URLSearchParams(search);
  const segment = (pathname.split("/")[2] || "").toLowerCase();
  const section = String(
    params.get("section") ||
      (sections.includes(segment) || ["buyer", "admin"].includes(segment)
        ? segment
        : ""),
  ).toLowerCase();
  const aliases: Record<string, string> = {
    store: "store-customization",
    fulfillment: "orders",
    payouts: "financials",
    earnings: "financials",
    integrations: "products",
  };
  const tab = String(
    params.get("tab") ||
      (section === segment ? "" : aliases[segment] || segment),
  ).toLowerCase();
  const buyerTarget = `/account${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`;
  if (section === "admin") return admin ? "/admin/platform" : buyerTarget;
  if (section === "buyer" || (!businessAccess && !admin)) return buyerTarget;
  return businessPath(section, aliases[tab] || tab);
}

export function showBusinessNavigation(
  pathname: string,
  signedIn: boolean,
  hidden: boolean,
  productEditor: boolean,
) {
  return (
    signedIn &&
    !hidden &&
    !productEditor &&
    /^\/(business|dashboard)(\/|$)/.test(pathname)
  );
}
