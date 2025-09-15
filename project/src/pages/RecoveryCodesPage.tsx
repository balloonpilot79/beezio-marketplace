import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

function generateCodes(count = 8) {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Use browser crypto for randomness
    const arr = new Uint8Array(6);
    crypto.getRandomValues(arr as any);
    const code = Array.from(arr).map(b => (b % 36).toString(36)).join('').slice(0,8).toUpperCase();
    codes.push(code);
  }
  return codes;
}

async function sha256Hex(input: string) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const RecoveryCodesPage: React.FC = () => {
  const [codes, setCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState('');

  const createCodes = async () => {
    setMessage('Generating...');
    const raw = generateCodes(8);
    // Hash codes before storing
    const hashed = await Promise.all(raw.map(c => sha256Hex(c)));

    // Store hashed codes in profiles.recovery_codes for current user
    const sessionRes = await supabase.auth.getSession();
    const session = (sessionRes && (sessionRes as any).data) ? (sessionRes as any).data.session : null;
    if (!session || !session.user) {
      setMessage('You must be signed in to create recovery codes.');
      return;
    }

    const user = session.user;
    const { error } = await supabase.from('profiles').update({ recovery_codes: hashed }).eq('user_id', user.id);
    if (error) {
      setMessage('Failed to save recovery codes: ' + error.message);
      return;
    }

    setCodes(raw);
    setMessage('Recovery codes generated. Store them safely — each code can be used once.');
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Generate Recovery Codes</h2>
      <p className="mb-4 text-sm text-gray-600">These one-time codes let you reset your password without email. Store them securely.</p>
      <button onClick={createCodes} className="px-4 py-2 bg-purple-600 text-white rounded">Create Codes</button>
      {message && <div className="mt-4 text-sm text-gray-700">{message}</div>}
      {codes && (
        <div className="mt-4 bg-gray-50 p-4 rounded">
          <ul className="grid grid-cols-2 gap-2">
            {codes.map((c) => <li key={c} className="p-2 bg-white border rounded text-center font-mono">{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RecoveryCodesPage;
