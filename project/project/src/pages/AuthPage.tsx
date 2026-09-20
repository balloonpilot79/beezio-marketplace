import { useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import PublicLayout from "../components/layout/PublicLayout";
import { consumePostAuthPath, setPostAuthPath } from "../utils/storefrontScope";
import { useAuth } from "../contexts/AuthContextMultiRole";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const params = new URLSearchParams(location.search);
  const next = String(params.get("next") || "").trim();
  const audience =
    params.get("audience") === "buyer" ||
    /^\/(account|cart|checkout)([/?]|$)/.test(next)
      ? "buyer"
      : "business";
  useEffect(() => {
    consumePostAuthPath();
    if (next) setPostAuthPath(next);
  }, [next]);
  if (mode === "register") return <Navigate to="/join" replace />;
  // AuthModal owns post-login navigation, including the user's chosen space.
  // Do not race it with an effect when the auth context changes after submit.
  return (
    <PublicLayout>
      <h1 className="sr-only">Sign in to Beezio</h1>
      <AuthModal
        isOpen
        mode="login"
        audience={audience}
        allowAudienceSwitch
        presentation="page"
        onClose={() => navigate("/")}
      />
      {user && !loading && (
        <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-4 pb-5 text-sm">
          <Link to="/business" className="bz-text-link">
            Open Business Center
          </Link>
          <Link to="/account" className="bz-text-link">
            Open Shopper Account
          </Link>
        </div>
      )}
    </PublicLayout>
  );
}
