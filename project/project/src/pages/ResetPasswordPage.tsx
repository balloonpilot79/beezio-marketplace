import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

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
          setAllowed(Boolean(session && session.user));

          // If we have a session, we're in password reset mode
          if (session?.user) {
            console.log('ResetPasswordPage: User is authenticated for password reset');
          } else {
            console.log('ResetPasswordPage: No session found - user may need to use reset link');
            setError('Please use the password reset link from your email to access this page. If you clicked the link and are still seeing this message, make sure the redirect URLs are configured in your Supabase dashboard.');
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
        setAllowed(Boolean(session && session.user));
        if (session?.user) {
          console.log('ResetPasswordPage: User authenticated via reset link');
          setError(null); // Clear any previous errors
        } else {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!allowed) return setError('You must be signed in to change your password');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');

    setLoading(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password });
      if (upErr) throw upErr;
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
