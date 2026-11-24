import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { SIGNUP_GUIDE_LAUNCHED_AT, signupWelcomeGuides, WELCOME_SUPPORT } from '../content/signupWelcome';
import type { SignupGuideAudience } from '../content/signupWelcome';
import { requestBusinessWelcome } from '../services/businessWelcomeClient';

const welcomeEndpoint = '/.netlify/functions/signup-welcome';

export default function SignupWelcomeGuide() {
  const { loading, user, session, userRoles } = useAuth();
  const type = user?.user_metadata?.account_type;
  const eligible = !loading && user?.email_confirmed_at
    && Date.parse(user.created_at) >= SIGNUP_GUIDE_LAUNCHED_AT
    && !user.app_metadata?.signup_welcome_completed_at;
  const audience = type === 'buyer' && userRoles.includes('buyer') ? 'shopper'
    : type === 'business' && userRoles.some(role => ['seller', 'affiliate', 'influencer'].includes(role)) ? 'business'
    : null;
  if (!eligible || !user || !session || !audience) return null;

  return <GuideDialog key={user.id} accessToken={session.access_token} audience={audience} />;
}

function GuideDialog({ accessToken, audience }: { accessToken: string; audience: SignupGuideAudience }) {
  const guide = signupWelcomeGuides[audience];
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function checkWelcome() {
      let status: { completed?: boolean; emailed?: boolean } = {};
      try {
        const response = await fetch(welcomeEndpoint, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
        });
        if (response.ok) status = await response.json();
      } catch { /* The guide remains readable if the connection is interrupted. */ }
      if (controller.signal.aborted) return;
      setVisible(!status.completed);
      if (status.emailed) {
        setEmailed(true);
      } else {
        void requestBusinessWelcome(accessToken, accepted => {
          if (!controller.signal.aborted) setEmailed(accepted);
        });
      }
    }
    void checkWelcome();
    return () => controller.abort();
  }, [accessToken]);

  useEffect(() => {
    if (visible && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [visible]);

  async function finish(path?: string) {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const response = await fetch(welcomeEndpoint, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Welcome completion unavailable');
      dialog.current?.close();
      setVisible(false);
      if (path) navigate(path);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (!visible) return null;

  return (
    <dialog ref={dialog} aria-labelledby="signup-welcome-title" onCancel={event => event.preventDefault()}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-auto rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/70">
      <header className="bg-[#ffcb05] p-5 sm:p-7">
        <h1 id="signup-welcome-title" tabIndex={-1} autoFocus className="text-2xl font-bold sm:text-3xl">Welcome to Beezio!</h1>
        <p className="mt-2">{guide.intro}</p>
      </header>
      <div className="space-y-6 p-5 sm:p-7">
        <p role="status" className="rounded-lg bg-amber-50 p-3 font-medium">
          {emailed
            ? 'We sent this same guide to your signup email. Save it so you can come back to it anytime.'
            : 'We’ll email this same guide to your signup address so you can come back to it anytime.'}
        </p>
        {guide.steps.map(step => (
          <section key={step.heading} className="space-y-3 border-t border-slate-200 pt-5">
            <h2 className="text-xl font-bold">{step.heading}</h2>
            {step.image && <img src={`/tutorial/business-v2/${step.image}`} alt={`Beezio example: ${step.heading}`}
              loading="lazy" className="w-full rounded-lg border border-slate-200" />}
            <ol className="list-decimal space-y-2 pl-5">
              {step.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}
            </ol>
            <button type="button" disabled={saving} onClick={() => void finish(step.path)}
              className="text-left font-semibold underline disabled:opacity-60">{step.action}</button>
          </section>
        ))}
        <p>Need help? Email <a className="underline" href={`mailto:${WELCOME_SUPPORT}`}>{WELCOME_SUPPORT}</a>.</p>
      </div>
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-3 sm:px-7">
        {saveFailed && <p role="alert" className="mb-2 text-sm text-red-800">Your progress couldn’t be saved. Please try Continue again.</p>}
        <button type="button" onClick={() => void finish()} disabled={saving}
          className="min-h-11 w-full rounded-lg bg-[#101820] px-4 py-2 font-bold text-white disabled:opacity-60 sm:w-auto">
          {saving ? 'Saving…' : 'Continue to Beezio'}
        </button>
      </footer>
    </dialog>
  );
}
