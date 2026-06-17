import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContextMultiRole';
import { canAccessCJImport } from '../utils/cjImportAccess';

type CheckStatus = 'idle' | 'running' | 'pass' | 'fail';

type CheckResult = {
  status: CheckStatus;
  httpStatus?: number;
  durationMs?: number;
  message?: string;
};

type FunctionCheck = {
  name: string;
  cors: CheckResult;
  unauthPost: CheckResult;
  authedValidate?: CheckResult;
};

const getHttpStatus = (err: any): number | undefined => {
  return (
    err?.context?.status ??
    err?.status ??
    err?.context?.response?.status ??
    err?.context?.statusCode ??
    err?.statusCode
  );
};

const statusPill = (status: CheckStatus) => {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border';
  switch (status) {
    case 'pass':
      return `${base} bg-green-50 text-green-700 border-green-200`;
    case 'fail':
      return `${base} bg-red-50 text-red-700 border-red-200`;
    case 'running':
      return `${base} bg-amber-50 text-amber-700 border-amber-200`;
    default:
      return `${base} bg-gray-50 text-gray-700 border-gray-200`;
  }
};

const isReachableStatus = (status?: number) => {
  if (!status) return false;
  // Any non-5xx response means the function endpoint is reachable and responding.
  return status >= 200 && status < 500;
};

const fetchWithTimeout = async (input: RequestInfo, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutHandle: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = window.setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) window.clearTimeout(timeoutHandle);
  }
};

const MessagingSmokeTestPage: React.FC = () => {
  const { user, hasRole, profile, loading } = useAuth();
  const isDev = Boolean(import.meta.env.DEV);
  const isAdmin = Boolean(
    hasRole?.('admin') ||
      String((profile as any)?.primary_role || (profile as any)?.role || '').toLowerCase() === 'admin' ||
      canAccessCJImport(user?.email || profile?.email || '')
  );

  const functions = useMemo(
    () =>
      [
        'start-store-conversation',
        'send-store-message',
        'mark-store-conversation-read',
        'create-support-thread',
        'send-support-message',
        'mark-support-thread-read',
        'admin-create-announcement',
        'mark-announcement-read',
        'admin-send-direct-message',
        'create-dispute-thread',
        'send-dispute-message',
      ] as const,
    []
  );

  const [checks, setChecks] = useState<Record<string, FunctionCheck>>(() => {
    const initial: Record<string, FunctionCheck> = {};
    for (const name of functions) {
      initial[name] = {
        name,
        cors: { status: 'idle' },
        unauthPost: { status: 'idle' },
        authedValidate: { status: 'idle' },
      };
    }
    return initial;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin access…</p>
        </div>
      </div>
    );
  }

  if (!isDev && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Messaging Smoke Test</h1>
            <p className="text-gray-600">Access denied. Admin only.</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link
            to="/inbox"
            className="inline-flex px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
          >
            Back to Inbox
          </Link>
        </div>
      </div>
    );
  }

  
const setResult = (name: string, key: keyof FunctionCheck, result: CheckResult) => {
    setChecks((prev) => ({
      ...prev,
      [name]: {
        ...prev[name],
        [key]: result,
      } as FunctionCheck,
    }));
  };

  const runCors = async (name: string) => {
    const url = `${supabaseUrl}/functions/v1/${name}`;
    setResult(name, 'cors', { status: 'running' });
    const started = performance.now();
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'OPTIONS',
          headers: {
            apikey: supabaseAnonKey,
          },
        },
        12000
      );
      const durationMs = Math.round(performance.now() - started);
      setResult(name, 'cors', {
        status: isReachableStatus(res.status) ? 'pass' : 'fail',
        httpStatus: res.status,
        durationMs,
        message: isReachableStatus(res.status) ? 'Reachable (CORS/OPTIONS)' : 'Unexpected status',
      });
    } catch (e) {
      const durationMs = Math.round(performance.now() - started);
      setResult(name, 'cors', {
        status: 'fail',
        durationMs,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const runUnauthPost = async (name: string) => {
    const url = `${supabaseUrl}/functions/v1/${name}`;
    setResult(name, 'unauthPost', { status: 'running' });
    const started = performance.now();
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({ __smoke: true }),
        },
        12000
      );
      const durationMs = Math.round(performance.now() - started);
      const reachable = isReachableStatus(res.status);
      setResult(name, 'unauthPost', {
        status: reachable ? 'pass' : 'fail',
        httpStatus: res.status,
        durationMs,
        message: reachable
          ? 'Reachable (POST without Authorization)'
          : 'Unexpected status (possible platform error)',
      });
    } catch (e) {
      const durationMs = Math.round(performance.now() - started);
      setResult(name, 'unauthPost', {
        status: 'fail',
        durationMs,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const runAuthedValidate = async (name: string) => {
    // Intentionally invalid bodies that should fail validation BEFORE any insert/update.
    // NOTE: create-support-thread is excluded because an empty body can still create a thread.
    const unsafeAuthed = new Set(['create-support-thread']);
    if (unsafeAuthed.has(name)) {
      setResult(name, 'authedValidate', {
        status: 'idle',
        message: 'Skipped (would create data)',
      });
      return;
    }

    setResult(name, 'authedValidate', { status: 'running' });
    const started = performance.now();

    try {
      const invalidBodies: Record<string, any> = {
        'start-store-conversation': { ownerType: 'seller' }, // missing ownerId
        'send-store-message': { body: 'x' }, // missing conversationId
        'mark-store-conversation-read': {}, // missing conversationId
        'send-support-message': { body: 'x' }, // missing threadId
        'mark-support-thread-read': {}, // missing threadId
        'admin-create-announcement': {}, // missing title/body
        'mark-announcement-read': {}, // missing announcementId
        'admin-send-direct-message': {}, // missing email/body
        'create-dispute-thread': {}, // missing sellerId/description
        'send-dispute-message': {}, // missing disputeId/message
      };

      const body = invalidBodies[name] ?? {};
      const { data, error } = await withTimeout(supabase.functions.invoke(name, { body }), 12000);

      const durationMs = Math.round(performance.now() - started);
      if (error) {
        const httpStatus = getHttpStatus(error);
        const ok = httpStatus === 400 || httpStatus === 401 || httpStatus === 403 || httpStatus === 404;
        setResult(name, 'authedValidate', {
          status: ok ? 'pass' : 'fail',
          httpStatus,
          durationMs,
          message: ok
            ? 'Validated (expected error; endpoint/auth working)'
            : `Unexpected error: ${String((error as any)?.message || error)}`,
        });
        return;
      }

      // A 200 here is still “reachable”, but it may indicate missing validation.
      setResult(name, 'authedValidate', {
        status: 'pass',
        durationMs,
        message: data ? 'OK (returned data)' : 'OK',
      });
    } catch (e) {
      const durationMs = Math.round(performance.now() - started);
      setResult(name, 'authedValidate', {
        status: 'fail',
        durationMs,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const runAll = async () => {
    for (const name of functions) {
      await runCors(name);
      await runUnauthPost(name);
      if (user) {
        await runAuthedValidate(name);
      }
    }
  };

  const reset = () => {
    setChecks(() => {
      const initial: Record<string, FunctionCheck> = {};
      for (const name of functions) {
        initial[name] = {
          name,
          cors: { status: 'idle' },
          unauthPost: { status: 'idle' },
          authedValidate: { status: 'idle' },
        };
      }
      return initial;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Messaging Smoke Test</h1>
            <p className="text-gray-600">
              Checks that each messaging Edge Function endpoint is deployed and responding. Authed checks use intentionally invalid
              inputs to avoid creating data.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/inbox"
              className="px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
            >
              Back to Inbox
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl border p-4 mb-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="text-sm text-gray-700">
              <div>
                <span className="font-semibold">Supabase:</span> {supabaseUrl}
              </div>
              <div>
                <span className="font-semibold">Signed in:</span> {user ? user.email : 'No'}
                {user && (
                  <>
                    {' '}
                    <span className="text-gray-500">(user id {user.id})</span>
                  </>
                )}
              </div>
              <div>
                <span className="font-semibold">Admin:</span> {isAdmin ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="px-3 py-2 rounded-lg text-sm font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                onClick={runAll}
                className="px-3 py-2 rounded-lg text-sm font-semibold border bg-black text-white border-black hover:bg-gray-900"
              >
                Run All
              </button>
            </div>
          </div>
          {!user && (
            <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              You are not signed in. CORS + unauth POST checks will still run, but the authed validation column will be skipped.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="grid grid-cols-12 gap-0 px-4 py-3 bg-gray-50 border-b text-xs font-bold text-gray-600">
            <div className="col-span-4">Function</div>
            <div className="col-span-3">CORS (OPTIONS)</div>
            <div className="col-span-3">POST (no Authorization)</div>
            <div className="col-span-2">Authed Validate</div>
          </div>

          {functions.map((name) => {
            const row = checks[name];
            return (
              <div key={name} className="grid grid-cols-12 gap-0 px-4 py-3 border-b last:border-b-0 text-sm">
                <div className="col-span-4">
                  <div className="font-semibold text-gray-900">{name}</div>
                  <div className="text-xs text-gray-500">/functions/v1/{name}</div>
                </div>

                <div className="col-span-3 flex items-center gap-2">
                  <span className={statusPill(row.cors.status)}>{row.cors.status}</span>
                  <span className="text-xs text-gray-500">
                    {row.cors.httpStatus ? `HTTP ${row.cors.httpStatus}` : ''}
                    {row.cors.durationMs ? ` · ${row.cors.durationMs}ms` : ''}
                  </span>
                  <button
                    onClick={() => runCors(name)}
                    className="ml-auto px-2 py-1 rounded-md text-xs font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                  >
                    Run
                  </button>
                </div>

                <div className="col-span-3 flex items-center gap-2">
                  <span className={statusPill(row.unauthPost.status)}>{row.unauthPost.status}</span>
                  <span className="text-xs text-gray-500">
                    {row.unauthPost.httpStatus ? `HTTP ${row.unauthPost.httpStatus}` : ''}
                    {row.unauthPost.durationMs ? ` · ${row.unauthPost.durationMs}ms` : ''}
                  </span>
                  <button
                    onClick={() => runUnauthPost(name)}
                    className="ml-auto px-2 py-1 rounded-md text-xs font-semibold border bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
                  >
                    Run
                  </button>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <span className={statusPill(row.authedValidate?.status || 'idle')}>{row.authedValidate?.status || 'idle'}</span>
                  <button
                    disabled={!user}
                    onClick={() => runAuthedValidate(name)}
                    className={`ml-auto px-2 py-1 rounded-md text-xs font-semibold border ${
                      user
                        ? 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                  >
                    Run
                  </button>
                </div>

                {(row.cors.message || row.unauthPost.message || row.authedValidate?.message) && (
                  <div className="col-span-12 mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2">
                    {row.cors.message ? (
                      <div>
                        <span className="font-semibold">CORS:</span> {row.cors.message}
                      </div>
                    ) : null}
                    {row.unauthPost.message ? (
                      <div>
                        <span className="font-semibold">POST:</span> {row.unauthPost.message}
                      </div>
                    ) : null}
                    {row.authedValidate?.message ? (
                      <div>
                        <span className="font-semibold">Authed:</span> {row.authedValidate.message}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MessagingSmokeTestPage;

