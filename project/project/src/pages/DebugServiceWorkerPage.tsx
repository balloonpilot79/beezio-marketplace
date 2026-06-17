import { useCallback, useEffect, useState } from 'react';

type RegistrationInfo = {
  scope: string;
  scriptURL: string | null;
  status: string;
};

const getRegistrationInfo = (reg: ServiceWorkerRegistration): RegistrationInfo => {
  const active = reg.active;
  const waiting = reg.waiting;
  const installing = reg.installing;
  const worker = active || waiting || installing;

  let status = 'unknown';
  if (active) status = 'active';
  if (waiting) status = 'waiting';
  if (installing) status = 'installing';

  return {
    scope: reg.scope,
    scriptURL: worker?.scriptURL ?? null,
    status,
  };
};

const DebugServiceWorkerPage = () => {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationInfo[]>([]);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      setSupported(false);
      return;
    }

    setSupported(true);
    const regs = await navigator.serviceWorker.getRegistrations();
    setRegistrations(regs.map(getRegistrationInfo));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const unregisterAll = async () => {
    if (!('serviceWorker' in navigator)) return;
    setBusy(true);
    setStatus('Unregistering all service workers...');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      setStatus('All service workers unregistered. You can reload the page.');
    } catch (err) {
      setStatus(`Failed to unregister: ${String((err as Error)?.message || err)}`);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const reload = () => {
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="card p-6">
          <h1 className="text-2xl font-semibold">Service Worker Debug</h1>
          <p className="mt-2 text-sm text-gray-600">
            Use this page to inspect and unregister service workers for this site.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={unregisterAll} disabled={busy || supported === false}>
              Unregister all service workers
            </button>
            <button className="btn-secondary" onClick={refresh} disabled={busy}>
              Refresh list
            </button>
            <button className="btn-accent" onClick={reload} disabled={busy}>
              Reload page
            </button>
          </div>

          {status && (
            <div className="mt-4 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-700">
              {status}
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-semibold">Current registrations</h2>
            {supported === false && (
              <p className="mt-2 text-sm text-red-600">Service workers are not supported in this browser.</p>
            )}
            {supported !== false && registrations.length === 0 && (
              <p className="mt-2 text-sm text-gray-600">No registrations found.</p>
            )}
            {registrations.length > 0 && (
              <ul className="mt-3 space-y-3">
                {registrations.map((reg) => (
                  <li key={`${reg.scope}-${reg.scriptURL ?? 'unknown'}`} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="text-sm text-gray-700">
                      <div><span className="font-semibold">Scope:</span> {reg.scope}</div>
                      <div><span className="font-semibold">Status:</span> {reg.status}</div>
                      <div><span className="font-semibold">Script:</span> {reg.scriptURL ?? 'unknown'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 text-sm text-gray-600">
            If the issue persists after unregistering, clear site data in your browser settings and hard reload.
          </div>
        </div>
      </div>
    </main>
  );
};

export default DebugServiceWorkerPage;
