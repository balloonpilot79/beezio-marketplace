import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type ConnectCompleteResponse = {
  ok?: boolean;
  error?: string;
  paypalEmail?: string;
  emailVerified?: boolean;
  returnTo?: string;
};

const NONCE_KEY = 'beezio_paypal_connect_nonce';

const PayPalConnectCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working');
  const [message, setMessage] = useState('Finishing PayPal connection...');
  const [connectedEmail, setConnectedEmail] = useState('');

  const code = useMemo(() => String(searchParams.get('code') || '').trim(), [searchParams]);
  const state = useMemo(() => String(searchParams.get('state') || '').trim(), [searchParams]);
  const error = useMemo(() => String(searchParams.get('error') || '').trim(), [searchParams]);
  const errorDescription = useMemo(() => String(searchParams.get('error_description') || '').trim(), [searchParams]);

  useEffect(() => {
    const run = async () => {
      if (error) {
        setStatus('error');
        setMessage(errorDescription || error || 'PayPal authorization was canceled.');
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing PayPal callback details. Please try connecting again.');
        return;
      }

      const expectedNonce = String(localStorage.getItem(NONCE_KEY) || '').trim();
      if (!expectedNonce) {
        setStatus('error');
        setMessage('Unable to verify the connection request. Please try again.');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = String(sessionData?.session?.access_token || '').trim();
      if (!accessToken) {
        setStatus('error');
        setMessage('Please sign in again, then retry PayPal connect.');
        return;
      }

      try {
        const res = await fetch('/api/paypal/connect-complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            code,
            state,
            expected_nonce: expectedNonce,
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as ConnectCompleteResponse;
        if (!res.ok || !payload?.ok) {
          setStatus('error');
          setMessage(payload?.error || 'PayPal connect failed. Please try again.');
          return;
        }

        localStorage.removeItem(NONCE_KEY);
        setConnectedEmail(String(payload.paypalEmail || ''));
        setStatus('success');
        setMessage('PayPal account connected successfully.');

        const returnTo = String(payload.returnTo || '/onboarding').trim();
        window.setTimeout(() => {
          navigate(returnTo.startsWith('/') ? returnTo : '/onboarding');
        }, 1200);
      } catch (e: any) {
        setStatus('error');
        setMessage(e?.message || 'PayPal connect failed. Please try again.');
      }
    };

    void run();
  }, [code, error, errorDescription, navigate, state]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-lg w-full rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">PayPal Connection</h1>
        <p className="mt-3 text-sm text-gray-700">{message}</p>

        {status === 'success' && connectedEmail && (
          <p className="mt-2 text-sm text-green-700">
            Connected email: <span className="font-semibold">{connectedEmail}</span>
          </p>
        )}

        {status === 'error' && (
          <div className="mt-4 flex gap-3">
            <Link
              to="/onboarding"
              className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-600"
            >
              Back to onboarding
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Go to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayPalConnectCallbackPage;

