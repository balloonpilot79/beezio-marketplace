import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PASSWORD_REQUIREMENT_MESSAGE, validatePasswordPolicy } from '../utils/passwordPolicy';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const { data, error: userErr } = await supabase.auth.getUser();
      if (userErr || !data?.user) {
        navigate('/auth/login');
        return;
      }
      if (mounted) {
        setEmail(data.user.email || '');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email) {
      setError('We could not verify your account. Please sign in again.');
      return;
    }
    const passwordError = validatePasswordPolicy(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        setError('Current password is incorrect.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      try {
        await supabase.auth.signOut({ scope: 'others' });
      } catch {
        // non-blocking
      }

      setSuccess(true);
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update password.');
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
          <p className="mt-2 text-sm text-gray-600">Redirecting to your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Change password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Current password</label>
            <div className="mt-1 relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700">New password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border rounded"
            />
            <p className="mt-1 text-xs text-gray-500">{PASSWORD_REQUIREMENT_MESSAGE}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Confirm new password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-purple-600 text-white rounded disabled:opacity-60"
          >
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
