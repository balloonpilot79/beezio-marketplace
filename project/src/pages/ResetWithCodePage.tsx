import React, { useState } from 'react';

const ResetWithCodePage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
      setMessage('');
      if (!email || !code || !password) {
        setMessage('Please provide email, recovery code, and a new password.');
        return;
      }
      setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/reset-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword })
      });
        const json = await res.json().catch(() => ({}));
      if (!res.ok) {
          const errMsg = json?.error || json?.message || res.statusText || 'Unknown error';
          setMessage('Error: ' + errMsg);
      } else {
          setMessage('Password reset successful. Please sign in with your new password.');
          setEmail(''); setCode(''); setPassword('');
      }
    } catch (e: any) {
        setMessage('Network error: ' + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Reset Password with Recovery Code</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 block w-full border px-3 py-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Recovery Code</label>
            <input required value={code} onChange={(e) => setCode(e.target.value)} className="mt-1 block w-full border px-3 py-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full border px-3 py-2 rounded" />
          </div>
          <div>
            <button disabled={loading} className="w-full py-2 px-4 bg-purple-600 text-white rounded">{loading ? 'Updating...' : 'Update Password'}</button>
          </div>
        </form>
        {message && <div className="mt-4 text-sm">{message}</div>}
      </div>
    </div>
  );
};

export default ResetWithCodePage;
