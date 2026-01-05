import React, { useEffect, useState } from 'react';

const DebugSW: React.FC = () => {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [flag, setFlag] = useState<string | null>(null);
  const [ua, setUa] = useState<string>('');
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    setUa(navigator.userAgent || 'unknown');
    setOnline(navigator.onLine);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        setRegistrations(regs || []);
      }).catch(() => setRegistrations([]));
    }

    try {
      setFlag(localStorage.getItem('beezio_sw_unregistered'));
    } catch (e) {
      setFlag(null);
    }
  }, []);

  const unregisterAll = async () => {
    if (!('serviceWorker' in navigator)) return;
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      try { await r.unregister(); } catch (e) { /* ignore */ }
    }
    // refresh state
    const newRegs = await navigator.serviceWorker.getRegistrations();
    setRegistrations(newRegs || []);
  };

  const clearFlag = () => {
    try {
      localStorage.removeItem('beezio_sw_unregistered');
      setFlag(null);
    } catch (e) {
      // ignore
    }
  };

  const reload = () => window.location.reload();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Beezio — Mobile Debug: Service Worker</h1>
      <p className="mb-4">Open this page on your phone and use the buttons below to clear service workers and reload the site.</p>

      <div className="mb-4">
        <div><strong>User Agent:</strong> {ua}</div>
        <div><strong>Online:</strong> {online ? 'yes' : 'no'}</div>
        <div><strong>beezio_sw_unregistered flag:</strong> {flag === null ? '<not set>' : flag}</div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold mb-2">Service Worker Registrations</h2>
        {registrations.length === 0 ? (
          <div className="bg-green-50 border border-green-200 p-3 rounded">No service workers registered</div>
        ) : (
          <div className="space-y-3">
            {registrations.map((r, i) => (
              <div key={i} className="p-3 border rounded bg-gray-50">
                <div><strong>Scope:</strong> {r.scope}</div>
                <div><strong>Active:</strong> {Boolean(r.active).toString()}</div>
                <div><strong>Waiting:</strong> {Boolean(r.waiting).toString()}</div>
                <div><strong>Installing:</strong> {Boolean(r.installing).toString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={unregisterAll}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Unregister all service workers
        </button>
        <button
          onClick={clearFlag}
          className="bg-yellow-600 text-white px-4 py-2 rounded"
        >
          Clear beezio_sw_unregistered flag
        </button>
        <button
          onClick={reload}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Reload page
        </button>
      </div>
      <p className="text-sm text-gray-500 mt-4">If your phone still shows the old bundle, try clearing site storage in your browser settings or use the browser's "Clear & reset" for the site.</p>
    </div>
  );
};

export default DebugSW;
