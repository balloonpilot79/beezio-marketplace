import { Link } from "react-router-dom";
import { ArrowRight, ShoppingBag, Store } from "lucide-react";
import PublicLayout from "../components/layout/PublicLayout";
import { WebsiteBenefits } from "../components/brand/BeezioBrand";
import { useAuth } from "../contexts/AuthContextMultiRole";

export default function JoinPage() {
  const { user } = useAuth();
  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl py-4 sm:py-10">
        <p className="bz-eyebrow text-center">Welcome to Beezio</p>
        <h1 className="mt-4 text-center text-4xl font-semibold tracking-tight">
          What brings you here?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center leading-7 text-slate-600">
          Shop for yourself or build something of your own. One login can do
          both, with separate spaces for shopping and business.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <section className="bz-panel flex flex-col p-7">
            <ShoppingBag className="h-7 w-7" />
            <p className="bz-eyebrow mt-6">For buyers</p>
            <h2 className="mt-3 text-2xl font-semibold">I’m here to shop.</h2>
            <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">
              Discover products and independent stores. Keep your orders,
              receipts, and support in one shopper account. No business setup or
              payout details.
            </p>
            <Link
              to={user ? "/account" : "/account/signup"}
              className="bz-button bz-button-ink mt-7"
            >
              {user ? "Open Shopper Account" : "Create free shopper account"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/marketplace"
              className="bz-text-link mt-4 justify-center"
            >
              Browse the marketplace first
            </Link>
          </section>
          <section className="bz-panel flex flex-col p-7">
            <Store className="h-7 w-7" />
            <p className="bz-eyebrow mt-6">
              For sellers, affiliates & influencers
            </p>
            <h2 className="mt-3 text-2xl font-semibold">
              I’m here to build & earn.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Sell your products, promote others, or introduce businesses to
              Beezio. Your Business Center keeps it all organized.
            </p>
            <div className="mt-5 flex-1">
              <WebsiteBenefits />
            </div>
            <Link to="/signup" className="bz-button bz-button-gold mt-7">
              Start your free website
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </div>
        {!user && (
          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/auth/login" className="bz-text-link">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </PublicLayout>
  );
}
