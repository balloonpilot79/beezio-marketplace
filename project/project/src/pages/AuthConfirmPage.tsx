import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { sendWelcomeEmail } from '../services/transactionalEmailClient';
import { confirmSignupEmail, sendSignupVerificationEmail } from '../services/signupVerificationClient';

const PENDING_SIGNUP_KEY = 'beezio-pending-signup-bootstrap';
const VERIFY_STATUS_POLL_MS = 3000;

type ConfirmState = 'pending' | 'checking' | 'success' | 'error';

const isBusinessSignupPayload = (payload: any) =>
  Boolean(payload?.bundleBusinessRoles) || String(payload?.role || '').trim().toLowerCase() !== 'buyer';

const resolveDashboardTarget = (payload: any) =>
  isBusinessSignupPayload(payload) ? '/dashboard' : '/dashboard?section=buyer';

const resolveSignInTarget = (payload: any) =>
  isBusinessSignupPayload(payload)
    ? '/auth/login?next=%2Fdashboard'
    : '/account/login?next=%2Fdashboard%3Fsection%3Dbuyer';

const AuthConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, resendVerificationEmail } = useAuth();
  const [state, setState] = useState<ConfirmState>('checking');
  const [message, setMessage] = useState('Confirming your email...');
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendBusy, setResendBusy] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState('');

  const authParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    const combined = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    hashParams.forEach((value, key) => {
      if (!combined.has(key)) combined.set(key, value);
    });
    return combined;
  }, []);

  const storedPayload = useMemo(() => {
    try {
      const raw = localStorage.getItem(PENDING_SIGNUP_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const pendingUserId = String(storedPayload?.userId || '').trim();

  const completePendingSignupWithoutSession = async () => {
    if (!pendingUserId || !storedPayload?.email) {
      throw new Error('Verified email detected, but signup details were missing on this device.');
    }

    const payload = {
      userId: pendingUserId,
      email: String(storedPayload.email || '').trim().toLowerCase(),
      role: String(storedPayload.role || 'buyer'),
      fullName: String(storedPayload.fullName || ''),
      storeName: String(storedPayload.storeName || ''),
      storeSlug: String(storedPayload.storeSlug || ''),
      phone: String(storedPayload.phone || ''),
      streetAddress: String(storedPayload.streetAddress || ''),
      city: String(storedPayload.city || ''),
      state: String(storedPayload.state || ''),
      zipCode: String(storedPayload.zipCode || ''),
      paypalEmail: String(storedPayload.paypalEmail || ''),
      paypalConfirmed: Boolean(storedPayload.paypalConfirmed),
      referrerProfileId: String(storedPayload.referrerProfileId || ''),
      bundleBusinessRoles: Boolean(storedPayload.bundleBusinessRoles),
      independentContractorAcknowledged: Boolean(storedPayload.independentContractorAcknowledged),
      taxDeliveryAcknowledged: Boolean(storedPayload.taxDeliveryAcknowledged),
    };

    const bootstrapResponse = await fetch('/api/signup/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!bootstrapResponse.ok) {
      const bootstrapError = await bootstrapResponse.json().catch(() => ({}));
      throw new Error(String(bootstrapError?.details || bootstrapError?.error || 'Account setup could not be completed after email confirmation.'));
    }

    try {
      localStorage.removeItem(PENDING_SIGNUP_KEY);
    } catch {
      // ignore
    }

    setState('success');
    setMessage(
      isBusinessSignupPayload(payload)
        ? 'Your email was verified. Sign in on this device to open your Beezio business dashboard.'
        : 'Your email was verified. Sign in on this device to open your buyer dashboard.'
    );
  };

  useEffect(() => {
    let active = true;

    const resolvedPendingEmail =
      String(authParams.get('email') || storedPayload?.email || user?.email || '').trim().toLowerCase();
    const flow = String(authParams.get('flow') || '').trim().toLowerCase();
    const verifyToken = String(authParams.get('verify_token') || '').trim();

    if (resolvedPendingEmail) {
      setPendingEmail(resolvedPendingEmail);
    }

    const finalizeSuccess = () => {
      if (!active) return;
      setState('success');
      setMessage('Your email is confirmed and your Beezio account is ready.');
    };

    const finalizeError = (nextMessage: string) => {
      if (!active) return;
      setState('error');
      setMessage(nextMessage);
    };

    const completeConfirmedSignup = async (confirmedUser: any) => {
      const metadata = (confirmedUser.user_metadata || {}) as Record<string, any>;

      const payload = {
        userId: confirmedUser.id,
        email: String(confirmedUser.email || '').trim().toLowerCase(),
        role: String(metadata.role || storedPayload?.role || 'buyer'),
        fullName: String(metadata.full_name || storedPayload?.fullName || ''),
        storeName: String(metadata.store_name || storedPayload?.storeName || ''),
        storeSlug: String(metadata.store_slug || storedPayload?.storeSlug || ''),
        phone: String(metadata.phone || storedPayload?.phone || ''),
        streetAddress: String(metadata.street_address || storedPayload?.streetAddress || ''),
        city: String(metadata.city || storedPayload?.city || ''),
        state: String(metadata.state || storedPayload?.state || ''),
        zipCode: String(metadata.zip_code || storedPayload?.zipCode || ''),
        paypalEmail: String(metadata.paypal_email || storedPayload?.paypalEmail || ''),
        paypalConfirmed: Boolean(
          metadata.paypal_confirmed ??
          storedPayload?.paypalConfirmed ??
          false
        ),
        referrerProfileId: String(metadata.referrer_profile_id || storedPayload?.referrerProfileId || ''),
        bundleBusinessRoles: Boolean(
          metadata.bundle_business_roles ??
          storedPayload?.bundleBusinessRoles ??
          false
        ),
        independentContractorAcknowledged: Boolean(
          metadata.independent_contractor_acknowledged ??
          storedPayload?.independentContractorAcknowledged ??
          false
        ),
        taxDeliveryAcknowledged: Boolean(
          metadata.tax_delivery_acknowledged ??
          storedPayload?.taxDeliveryAcknowledged ??
          false
        ),
      };

      const bootstrapResponse = await fetch('/api/signup/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!bootstrapResponse.ok) {
        const bootstrapError = await bootstrapResponse.json().catch(() => ({}));
        throw new Error(String(bootstrapError?.details || bootstrapError?.error || 'Account setup could not be completed after email confirmation.'));
      }

      const bootstrapData = await bootstrapResponse.json().catch(() => ({}));
      if (bootstrapData?.createdProfile) {
        try {
          await sendWelcomeEmail(
            confirmedUser.id,
            payload.email,
            payload.fullName || payload.email.split('@')[0] || 'there'
          );
        } catch (emailErr) {
          console.error('Post-confirmation welcome email failed:', emailErr);
        }
      }

      try {
        localStorage.removeItem(PENDING_SIGNUP_KEY);
      } catch {
        // ignore
      }

      finalizeSuccess();
      window.setTimeout(() => {
        if (!active) return;
        const nextTarget = resolveDashboardTarget({
          ...payload,
          role: bootstrapData?.role || payload.role || 'buyer',
          bundleBusinessRoles: payload.bundleBusinessRoles,
        });
        navigate(nextTarget, { replace: true });
      }, 1400);
    };

    const run = async () => {
      const errorDescription =
        authParams.get('error_description') ||
        authParams.get('error') ||
        authParams.get('message');
      if (errorDescription) {
        finalizeError(decodeURIComponent(errorDescription).replace(/\+/g, ' '));
        return;
      }

      try {
        const code = String(authParams.get('code') || '').trim();
        const hasTokenPayload =
          Boolean(authParams.get('token_hash')) ||
          Boolean(authParams.get('access_token')) ||
          Boolean(authParams.get('refresh_token')) ||
          code.length > 0;

        if (!hasTokenPayload) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user?.email_confirmed_at) {
            await completeConfirmedSignup(data.session.user);
            return;
          }

          const explicitSendError = String(authParams.get('send_error') || '').trim();
          const emailSent = authParams.get('email_sent') === '1';
          if (explicitSendError) {
            setDeliveryMessage(`We could not send the verification email automatically: ${explicitSendError}`);
          } else if (emailSent && resolvedPendingEmail) {
            setDeliveryMessage(`Verification email sent to ${resolvedPendingEmail}`);
          } else if (resolvedPendingEmail) {
            setDeliveryMessage('We created the account, but the verification email was not confirmed as sent. Use resend below.');
          }
          setState('pending');
          setMessage('Thank you for signing up. Please verify your email to activate your Beezio account.');
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            finalizeError(error.message || 'We could not confirm this email link.');
            return;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          finalizeError(error.message || 'We could not confirm this email link.');
          return;
        }

        if (data.session?.user) {
          if (verifyToken) {
            await confirmSignupEmail(verifyToken);
          }
          await completeConfirmedSignup(data.session.user);
          return;
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
            authListener.subscription.unsubscribe();
            void (async () => {
              try {
                if (verifyToken) {
                  await confirmSignupEmail(verifyToken);
                }
                await completeConfirmedSignup(session.user);
              } catch (err: any) {
                finalizeError(err?.message || 'Account setup could not be completed after email confirmation.');
              }
            })();
          }
        });

        window.setTimeout(() => {
          authListener.subscription.unsubscribe();
          if (!active) return;
          finalizeError('This confirmation link did not create a session. Try opening the latest email again or request a new confirmation email.');
        }, 4000);
      } catch (err: any) {
        finalizeError(err?.message || 'We could not confirm this email link.');
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [authParams, pendingUserId, resendVerificationEmail, storedPayload, user?.email]);

  useEffect(() => {
    if (state !== 'pending' || !pendingUserId || !pendingEmail) return;

    let active = true;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch('/api/signup/check-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: pendingUserId,
            email: pendingEmail,
          }),
        });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({}));
        if (!active || !data?.confirmed) return;

        window.clearInterval(poll);

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user) {
          await supabase.auth.refreshSession();
          const { data: refreshedData } = await supabase.auth.getSession();
          if (refreshedData.session?.user) {
            setState('checking');
            setMessage('Email verified. Finalizing your Beezio account...');
            return;
          }
        }

        await completePendingSignupWithoutSession();
      } catch {
        // keep polling quietly
      }
    }, VERIFY_STATUS_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [pendingEmail, pendingUserId, state]);

  const primaryTarget =
    user || profile
      ? resolveDashboardTarget({
          role: String((profile as any)?.primary_role || (profile as any)?.role || storedPayload?.role || 'buyer'),
          bundleBusinessRoles: Boolean((storedPayload as any)?.bundleBusinessRoles),
        })
      : resolveSignInTarget(storedPayload);

  const primaryLabel = user || profile ? 'Continue to dashboard' : 'Go to sign in';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-center">
          {state === 'pending' || state === 'checking' ? (
            <Loader2 className="h-12 w-12 animate-spin text-amber-500" />
          ) : state === 'success' ? (
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          ) : (
            <XCircle className="h-12 w-12 text-red-600" />
          )}
        </div>

        <h1 className="mb-3 text-center text-3xl font-bold text-gray-900">
          {state === 'pending'
            ? 'Check your email'
            : state === 'checking'
            ? 'Confirming your account'
            : state === 'success'
            ? 'Email confirmed'
            : 'Confirmation failed'}
        </h1>

        <p className="mb-6 text-center text-gray-700">{message}</p>

        {state === 'pending' && pendingEmail && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">{deliveryMessage || `Check ${pendingEmail} for your verification email.`}</p>
            <p className="mt-1">Open that message and click the confirmation link to finish your signup.</p>
            <button
              type="button"
              onClick={async () => {
                setResendBusy(true);
                try {
                  if (pendingUserId) {
                    await sendSignupVerificationEmail({
                      userId: pendingUserId,
                      email: pendingEmail,
                      fullName: String(storedPayload?.fullName || '').trim(),
                    });
                  } else {
                    await resendVerificationEmail(pendingEmail);
                  }
                  setDeliveryMessage(`Verification email sent again to ${pendingEmail}.`);
                  setMessage('Thank you for signing up. Please verify your email to activate your Beezio account.');
                } catch (err: any) {
                  setState('error');
                  setMessage(err?.message || 'Failed to resend verification email.');
                } finally {
                  setResendBusy(false);
                }
              }}
              disabled={resendBusy}
              className="mt-3 font-medium text-amber-700 underline hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendBusy ? 'Sending...' : 'Resend verification email'}
            </button>
          </div>
        )}

        {state === 'success' && (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            One Beezio account can use seller, affiliate, and influencer tools together. Your starting choice does not lock the account.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {state !== 'checking' && state !== 'pending' && (
            <button
              type="button"
              onClick={() => navigate(primaryTarget, { replace: true })}
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-3 font-semibold text-black transition-colors hover:bg-amber-600"
            >
              {primaryLabel}
            </button>
          )}
          {state === 'error' && (
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50"
            >
              Back to signup
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthConfirmPage;
