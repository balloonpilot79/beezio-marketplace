import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, UserCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContextMultiRole";
import { useCart } from "../../contexts/CartContext";

/** Buyer-only navigation, shared by seller sites, affiliate sites and custom pages. */
export default function StorefrontShoppingLinks({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const { getTotalItems } = useCart();
  const location = useLocation();
  const count = getTotalItems();
  const next = encodeURIComponent(
    location.pathname.startsWith("/account")
      ? "/account"
      : location.pathname + location.search,
  );
  const style = inverse
    ? "border-white/40 text-white hover:bg-white/10"
    : "border-slate-200 text-slate-700 hover:bg-slate-50";
  return (
    <nav
      aria-label="Store shopping"
      className={`flex items-center ${compact ? "gap-1" : "flex-wrap gap-2"}`}
    >
      <Link
        to={user ? "/account" : `/account/login?next=${next}`}
        aria-label={user ? "Your account" : "Sign in"}
        style={inverse ? { color: "#ffffff" } : undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border text-xs font-semibold ${compact ? "h-11 w-11" : "min-h-10 px-3 py-2"} ${style}`}
      >
        <UserCircle className="h-4 w-4" aria-hidden="true" />
        <span className={compact ? "sr-only" : undefined}>{user ? "Your account" : "Sign in"}</span>
      </Link>
      {!user && !compact && (
        <Link
          to={`/account/signup?next=${next}`}
          className={`inline-flex min-h-10 items-center rounded-lg border px-3 py-2 text-xs font-semibold ${style}`}
        >
          Sign up
        </Link>
      )}
      <Link
        to="/cart"
        aria-label={`Cart${count ? `, ${count} items` : ""}`}
        style={inverse ? { color: "#ffffff" } : undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-lg border text-xs font-semibold ${compact ? "h-11 w-11" : "min-h-10 px-3 py-2"} ${style}`}
      >
        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        <span className={compact ? "sr-only" : undefined}>Cart</span>{count > 0 && <span>{compact ? count : `(${count})`}</span>}
      </Link>
    </nav>
  );
}
