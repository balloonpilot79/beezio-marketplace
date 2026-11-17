import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  // Share the one-use code exchange across React effect re-runs.
  const connection = useRef<{ key: string; request: Promise<ConnectCompleteResponse> } | null>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      try {
        if (error) throw new Error(errorDescription || 'PayPal authorization was canceled.');
        if (!code || !state) throw new Error('Missing PayPal callback details. Please connect again.');
        const key = `${code}:${state}`;
        if (connection.current?.key !== key) {
          const request = (async () => {
            const expectedNonce = String(localStorage.getItem(NONCE_KEY) || '').trim();
            if (!expectedNonce) throw new Error('Unable to verify the connection request. Please connect again.');
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = String(sessionData?.session?.access_token || '').trim();
            if (!accessToken) throw new Error('Please sign in again, then connect PayPal.');
            const res = await fetch('/api/paypal/connect-complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
              body: JSON.stringify({ code, state, expected_nonce: expectedNonce }),
              signal: AbortSignal.timeout(35000),
            });
            const payload = await res.json().catch(() => ({})) as ConnectCompleteResponse;
            if (!res.ok || !payload.ok || payload.emailVerified !== true || !payload.paypalEmail) {
              throw new Error(payload.error || 'PayPal email is not verified. Confirm your email in PayPal, then connect again.');
            }
            localStorage.removeItem(NONCE_KEY);
            return payload;
          })();
          connection.current = { key, request };
        }
        const payload = await connection.current.request;
        if (!active) return;
        setConnectedEmail(String(payload.paypalEmail));
        setStatus('success');
        setMessage('PayPal email verified. Your payout connection is ready.');
        const returnTo = String(payload.returnTo || '/dashboard');
        timer = setTimeout(() => navigate(returnTo.startsWith('/') && !returnTo.startsWith('//') && !/[\\\s]/.test(returnTo) ? returnTo : '/dashboard'), 1200);
      } catch (e: any) {
        if (!active) return;
        setStatus('error');
        setMessage(e?.message || 'PayPal connection failed. Please try again.');
      }
    };
    void run();
    return () => { active = false; if (timer) clearTimeout(timer); };
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

