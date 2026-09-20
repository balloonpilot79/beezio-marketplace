import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContextMultiRole";
import type { StorefrontBranding } from "../../utils/storefrontScope";
import { BeezioMark, StorefrontSignature } from "../brand/BeezioBrand";
import StorefrontShoppingLinks from "./StorefrontShoppingLinks";

interface StorefrontBuyerShellProps {
  branding: StorefrontBranding;
  children: React.ReactNode;
}

const StorefrontBuyerShell: React.FC<StorefrontBuyerShellProps> = ({
  branding,
  children,
}) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#faf9f5] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            to={branding.homePath}
            className="flex min-w-0 items-center gap-3 text-slate-900"
          >
            {branding.kind === "generic" ? (
              <BeezioMark subtitle="Shopper Account" />
            ) : (
              <>
                {branding.logoUrl && (
                  <img
                    src={branding.logoUrl}
                    alt=""
                    className="h-10 w-10 rounded-lg object-contain"
                  />
                )}
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-widest text-slate-500">
                    Shopper Account
                  </span>
                  <span className="block text-lg font-semibold">
                    {branding.name}
                  </span>
                </span>
              </>
            )}
          </Link>
          <StorefrontShoppingLinks />
        </div>
        <nav
          aria-label="Shopper navigation"
          className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-4 text-xs font-semibold"
        >
          <Link
            to={branding.homePath}
            className="text-slate-600 hover:text-slate-900"
          >
            Back to shop
          </Link>
          {user && (
            <>
              <Link
                to="/account?tab=orders"
                className="text-slate-600 hover:text-slate-900"
              >
                Your orders
              </Link>
              <Link
                to="/account?tab=support"
                className="text-slate-600 hover:text-slate-900"
              >
                Order support
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  navigate(branding.homePath, { replace: true });
                }}
                className="ml-auto inline-flex items-center gap-2 text-slate-600"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto min-h-[65vh] max-w-6xl px-4 py-8">
        {children}
      </main>
      <StorefrontSignature />
    </div>
  );
};

export default StorefrontBuyerShell;
