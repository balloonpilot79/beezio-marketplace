import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Globe, Store } from "lucide-react";
import PublicLayout from "../components/layout/PublicLayout";
import RecruitInviteNotice, { useRecruitInvite } from "../components/RecruitInviteNotice";
import { useAuth } from "../contexts/AuthContextMultiRole";
import { withRecruitCode } from "../utils/referralSharing";

const signupPaths = [
  {
    intent: "sell",
    title: "I want to sell",
    description: "Open a free store, list your own products, and let affiliates promote the listings you choose.",
    icon: Store,
  },
  {
    intent: "earn",
    title: "I want to earn",
    description: "Pick products from Beezio sellers and earn a commission on qualifying sales you bring in.",
    icon: Globe,
  },
];

export default function JoinPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const recruit = params.get("recruit") || params.get("influencer") || params.get("ic");
  const invite = useRecruitInvite(recruit);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-4xl py-4 sm:py-10">
        <h1 className="text-center text-4xl font-semibold tracking-tight">
          How do you want to start on Beezio?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center leading-7 text-slate-600">
          You can sell and promote products with the same account.
        </p>
        <RecruitInviteNotice invite={invite} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {signupPaths.map(({ intent, title, description, icon: Icon }) => {
            const next = new URLSearchParams({ intent });
            if (recruit?.trim()) next.set("recruit", recruit.trim());
            return (
              <Link
                key={intent}
                to={`/signup?${next}`}
                aria-labelledby={`signup-${intent}-title`}
                aria-describedby={`signup-${intent}-description`}
                className="bz-panel flex flex-col p-7 transition-shadow hover:shadow-lg"
              >
                <Icon className="h-7 w-7" aria-hidden="true" />
                <h2 id={`signup-${intent}-title`} className="mt-5 text-2xl font-semibold">{title}</h2>
                <p id={`signup-${intent}-description`} className="mt-3 flex-1 text-sm leading-6 text-slate-600">{description}</p>
                <ArrowRight className="mt-5 h-5 w-5" aria-hidden="true" />
              </Link>
            );
          })}
        </div>
        <div className="mt-8 space-y-3 text-center text-sm text-slate-600">
          <p>
            Just shopping?{" "}
            <Link to={user ? "/account" : withRecruitCode("/account/signup", recruit)} className="bz-text-link">
              {user ? "Open your shopper account" : "Create a shopper account"}
            </Link>
          </p>
          {!user && (
            <p>
              Already have an account?{" "}
              <Link to="/auth/login" className="bz-text-link">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
