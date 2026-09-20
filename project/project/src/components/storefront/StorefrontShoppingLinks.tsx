import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, UserCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContextMultiRole";
import { useCart } from "../../contexts/CartContext";

/** Buyer-only navigation, shared by seller sites, affiliate sites and custom pages. */
export default function StorefrontShoppingLinks({
  inverse = false,
}: {
  inverse?: boolean;
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
      className="flex flex-wrap items-center gap-2"
    >
      <Link
        to={user ? "/account" : `/account/login?next=${next}`}
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${style}`}
      >
        <UserCircle className="h-4 w-4" aria-hidden="true" />
        {user ? "Your account" : "Sign in"}
      </Link>
      {!user && (
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
        className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${style}`}
      >
        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        Cart{count > 0 && <span>({count})</span>}
      </Link>
    </nav>
  );
}
