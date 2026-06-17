import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { PASSWORD_REQUIREMENT_MESSAGE, validatePasswordPolicy } from '../utils/passwordPolicy';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const paramsFromHash = new URLSearchParams(window.location.hash.replace('#', ''));
    const paramsFromSearch = new URLSearchParams(window.location.search);
    const recoveryType = paramsFromHash.get('type') || paramsFromSearch.get('type');
    const hasRecoveryContext = recoveryType === 'recovery';
    if (hasRecoveryContext) {
      setIsRecovery(true);
    }

    const checkSession = async () => {
      try {
        const res = await supabase.auth.getSession();
        const session = (res as any)?.data?.session ?? null;
        console.log('ResetPasswordPage: Session check:', {
          hasSession: Boolean(session),
          hasUser: Boolean(session?.user),
          userEmail: session?.user?.email,
          userId: session?.user?.id
        });

        if (mounted) {
          const hasSession = Boolean(session && session.user);
          setAllowed(hasSession && hasRecoveryContext);

          // If we have a session, we're in password reset mode
          if (session?.user) {
            console.log('ResetPasswordPage: User is authenticated for password reset');
          } else {
            console.log('ResetPasswordPage: No session found - user may need to use reset link');
            if (hasRecoveryContext) {
              setError('Please use the password reset link from your email to access this page. If you clicked the link and are still seeing this message, make sure the redirect URLs are configured in your Supabase dashboard.');
            }
          }
        }
      } catch (err) {
        console.error('ResetPasswordPage: Session check failed:', err);
        if (mounted) {
          setAllowed(false);
          setError('Failed to verify authentication status. Please try the reset link again.');
        }
      }
    };

    // Check session immediately
    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('ResetPasswordPage: Auth state change:', event, {
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
        userEmail: session?.user?.email
      });

      if (mounted) {
        const hasSession = Boolean(session && session.user);
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovery(true);
        }
        const recoveryEventActive = event === 'PASSWORD_RECOVERY' || hasRecoveryContext;
        setAllowed(hasSession && recoveryEventActive);
        if (session?.user && recoveryEventActive) {
          console.log('ResetPasswordPage: User authenticated via reset link');
          setError(null); // Clear any previous errors
        } else if (recoveryEventActive) {
          console.log('ResetPasswordPage: User signed out or session invalid');
          setError('Your session has expired. Please use the reset link again.');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequestSent(false);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    setRequestLoading(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const redirectTo = origin ? `${origin}/reset-password` : '/reset-password';
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setRequestSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email.');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!allowed) return setError('Please use the password reset link from your email to change your password.');
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) return setError(passwordError);
    if (password !== confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
      try {
        await supabase.auth.signOut({ scope: 'others' });
      } catch {
        // non-blocking
      }
      setSuccess(true);
      console.log('ResetPasswordPage: Password updated successfully');
      // Redirect to dashboard after successful password reset
      setTimeout(() => {
        navigate('/'); // Will redirect to appropriate dashboard based on role
      }, 2000);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded shadow-md text-center max-w-md w-full">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-2xl font-semibold">Password updated</h2>
          <p className="mt-2 text-sm text-gray-600">Your password has been changed. Redirecting…</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white p-6 rounded shadow">
          <h2 className="text-xl font-bold mb-2">Reset password</h2>
          <p className="text-sm text-gray-600 mb-4">
            Enter your email and we&apos;ll send you a password reset link.
          </p>
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full border px-3 py-2 rounded"
              />
            </div>

            {requestSent && (
              <div className="text-sm text-green-700">
                Password reset email sent. Check your inbox for the reset link.
              </div>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={requestLoading}
              className="w-full py-2 px-4 bg-purple-600 text-white rounded disabled:opacity-60"
            >
              {requestLoading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Change password</h2>
        {!allowed && <div className="mb-4 text-sm text-yellow-700">You must be signed in to change your password.</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">New password</label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 border rounded"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-2 text-gray-500"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">{PASSWORD_REQUIREMENT_MESSAGE}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm password</label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={!allowed || loading}
            className="w-full py-2 px-4 bg-purple-600 text-white rounded disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
