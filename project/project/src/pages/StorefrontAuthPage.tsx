import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import StorefrontBuyerShell from "../components/storefront/StorefrontBuyerShell";
import {
  loadStorefrontBranding,
  readPostAuthPath,
  readStoredStorefrontScope,
  setPostAuthPath,
  safePostAuthPath,
  type StorefrontBranding,
} from "../utils/storefrontScope";

const fallback: StorefrontBranding = {
  kind: "generic",
  name: "Beezio",
  homePath: "/marketplace",
};

export default function StorefrontAuthPage({
  mode,
}: {
  mode: "login" | "register";
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [branding, setBranding] = useState<StorefrontBranding>(fallback);
  const params = new URLSearchParams(location.search);
  const next =
    safePostAuthPath(params.get("next")) || readPostAuthPath() || "/account";
  useEffect(() => {
    let active = true;
    loadStorefrontBranding(readStoredStorefrontScope()).then((value) => {
      if (active) setBranding(value);
    });
    setPostAuthPath(next);
    return () => {
      active = false;
    };
  }, [mode, next]);
  return (
    <StorefrontBuyerShell branding={branding}>
      <h1 className="sr-only">
        {mode === "login" ? "Shopper sign in" : "Create a free shopper account"}
      </h1>
      <AuthModal
        isOpen
        mode={mode}
        audience="buyer"
        returnTo={next}
        presentation="page"
        onClose={() => navigate(branding.homePath)}
      />
    </StorefrontBuyerShell>
  );
}
