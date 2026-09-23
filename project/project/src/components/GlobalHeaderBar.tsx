import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  ShoppingBag,
  ShoppingCart,
  Store,
  User,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContextMultiRole";
import { useCart } from "../contexts/CartContext";
import { canAccessCJImport } from "../utils/cjImportAccess";
import {
  getBusinessAccountRoles,
  getNormalizedAccountRoles,
} from "../utils/accountRoles";
import { BeezioMark } from "./brand/BeezioBrand";
import MarketplaceSearch from "./MarketplaceSearch";

const publicLinks = [
  { label: "Sellers", href: "/sellers" },
  { label: "Affiliates", href: "/affiliates" },
  { label: "Influencers", href: "/start-earning" },
  { label: "Shop marketplace", href: "/marketplace" },
];

const GlobalHeaderBar: React.FC = () => {
  const { user, profile, userRoles, signOut } = useAuth();
  const { getTotalItems } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const roles = getNormalizedAccountRoles(
    userRoles,
    profile?.primary_role,
    profile?.role,
  );
  const isAdmin =
    roles.includes("admin") ||
    canAccessCJImport(user?.email || profile?.email || "");
  const hasBusinessAccess = Boolean(
    user && (isAdmin || getBusinessAccountRoles(roles).length),
  );
  const isBusiness = /^\/(business|dashboard|admin)(\/|$)/.test(
    location.pathname,
  );
  const count = getTotalItems();
  const mobileLinks = [
    { label: "Shop", href: "/marketplace", icon: ShoppingBag },
    hasBusinessAccess
      ? { label: "Business", href: "/business", icon: LayoutDashboard }
      : { label: "Sell & earn", href: "/start-earning", icon: Store },
    { label: "Account", href: user ? "/account" : "/auth/login", icon: User },
    { label: "Cart", href: "/cart", icon: ShoppingCart },
  ];

  useEffect(() => {
    setAccountOpen(false);
    setMobileOpen(false);
  }, [location.pathname, location.search]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node))
        setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <>
      <header className="bz-header fixed inset-x-0 top-0 z-[70] border-b border-[#e8b900] bg-[#ffcb05] text-[#101820]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Beezio home">
            <BeezioMark
              subtitle={isBusiness ? "Business Center" : "Sell. Share. Earn."}
            />
          </Link>
          <MarketplaceSearch className="bz-header-search" />
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-4 2xl:flex"
          >
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                aria-current={
                  location.pathname === link.href ? "page" : undefined
                }
                className={`text-sm hover:text-slate-900 ${location.pathname === link.href ? "font-semibold text-slate-950" : "text-slate-600"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            {hasBusinessAccess ? (
              <Link
                to="/business"
                className="hidden rounded-lg bg-[#faf9f5] px-3 py-2 text-xs font-semibold text-slate-800 sm:inline-flex"
              >
                Business Center
              </Link>
            ) : (
              <Link
                to="/signup"
                className="hidden rounded-lg bg-[#142a34] px-3 py-2 text-xs font-semibold text-white hover:bg-[#284550] sm:inline-flex"
              >
                Start your free website
              </Link>
            )}
            <Link
              to="/cart"
              aria-label={`Cart${count ? `, ${count} items` : ""}`}
              className="relative inline-flex items-center gap-1 rounded-lg p-2 text-slate-700 hover:bg-slate-50"
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {count > 0 && (
                <span className="rounded-full bg-[#ffcb05] px-1.5 text-xs font-semibold text-[#101820]">
                  {count}
                </span>
              )}
            </Link>
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen(!accountOpen)}
                  aria-label="Account menu"
                  aria-expanded={accountOpen}
                  aria-controls="beezio-account-menu"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 p-2 text-slate-700"
                >
                  <User className="h-4 w-4" />
                  <ChevronDown className="h-3 w-3" />
                </button>
                {accountOpen && (
                  <nav
                    id="beezio-account-menu"
                    aria-label="Your account"
                    className="absolute right-0 mt-3 w-64 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-lg"
                  >
                    <p className="truncate border-b border-slate-100 px-3 py-3 font-semibold">
                      {profile?.full_name || "Your account"}
                    </p>
                    <Link
                      to="/account"
                      className="block rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
                    >
                      Shopper Account
                    </Link>
                    {hasBusinessAccess && (
                      <Link
                        to="/business"
                        className="block rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
                      >
                        Business Center
                      </Link>
                    )}
                    {hasBusinessAccess && (
                      <Link
                        to="/business?tab=financials#payouts"
                        className="flex items-center gap-2 rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
                      >
                        <DollarSign className="h-4 w-4" />
                        Earnings & payouts
                      </Link>
                    )}
                    {!hasBusinessAccess && (
                      <Link
                        to="/signup"
                        className="block rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
                      >
                        Create your free website
                      </Link>
                    )}
                    <Link
                      to="/profile"
                      className="block rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
                    >
                      Profile & settings
                    </Link>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="block rounded-lg px-3 py-3 text-slate-700 hover:bg-slate-50"
                      >
                        Admin
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await signOut();
                        setAccountOpen(false);
                        navigate("/");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-slate-700 hover:bg-slate-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </nav>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-3 sm:flex">
                <Link
                  to="/auth/login"
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  to="/join"
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                >
                  Sign up
                </Link>
              </div>
            )}
            <button
              type="button"
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              aria-controls="beezio-mobile-menu"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-slate-700 2xl:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>
      <nav
        aria-label="Shop Beezio"
        className="bz-shopping-nav fixed inset-x-0 top-14 z-[68]"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-7 overflow-x-auto px-4 sm:px-6 lg:px-8">
          <Link
            to="/marketplace"
            aria-current={location.pathname === "/marketplace" ? "page" : undefined}
            className="bz-shopping-link"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            All products
          </Link>
          <Link
            to="/marketplace?sort=newest"
            className="bz-shopping-link"
          >
            New arrivals
          </Link>
          <Link
            to="/marketplace#categories"
            className="bz-shopping-link"
          >
            Shop by category
          </Link>
          <Link to="/stores" className="bz-shopping-link bz-shopping-link-accent">
            Discover stores
          </Link>
        </div>
      </nav>
      {mobileOpen && (
        <>
          <button
            aria-label="Close navigation backdrop"
            type="button"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 top-[6.375rem] z-[66] bg-black/20 2xl:hidden"
          />
          <nav
            id="beezio-mobile-menu"
            aria-label="Mobile navigation"
            className="fixed inset-x-0 top-[6.375rem] z-[69] grid max-h-[calc(100dvh-10.375rem)] gap-1 overflow-y-auto border-b border-slate-200 bg-[#f3f0e8] p-4 2xl:hidden"
          >
            <MarketplaceSearch />
            {publicLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/how-it-works"
              className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-700"
            >
              How Beezio works
            </Link>
            <Link
              to={hasBusinessAccess ? "/business" : "/signup"}
              className="bz-button bz-button-gold mt-2"
            >
              {hasBusinessAccess
                ? "Business Center"
                : "Start your free website"}
            </Link>
            {user ? (
              <Link to="/account" className="bz-button bz-button-outline">
                Shopper Account
              </Link>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/auth/login" className="bz-button bz-button-outline">
                  Sign in
                </Link>
                <Link to="/join" className="bz-button bz-button-outline">
                  Sign up
                </Link>
              </div>
            )}
          </nav>
        </>
      )}
      <nav
        aria-label="Quick navigation"
        className="fixed inset-x-0 bottom-0 z-[65] grid grid-cols-4 border-t border-slate-200 bg-white px-2 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] xl:hidden"
      >
        {mobileLinks.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            aria-current={
              location.pathname.startsWith(href) ? "page" : undefined
            }
            className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1 text-[10px] font-semibold ${location.pathname.startsWith(href) ? "bg-[#fff4bb] text-[#101820]" : "text-slate-600"}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {href === "/cart" && count > 0 ? ` (${count})` : ""}
          </Link>
        ))}
      </nav>
    </>
  );
};

export default GlobalHeaderBar;
