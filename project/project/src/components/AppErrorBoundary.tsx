import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
  componentStack: string;
  recoveryStarted: boolean;
};

const isRecoverableCachedAssetError = (error: unknown) => {
  const message = String((error as any)?.message || error || '');
  return /Minified React error #300|Rendered fewer hooks than expected|Minified React error #310|Rendered more hooks than during the previous render|Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(message);
};

class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: '', recoveryStarted: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: '', recoveryStarted: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Beezio] App render error:', error, info);
    this.setState({ componentStack: info.componentStack || '' });
    if (isRecoverableCachedAssetError(error)) {
      void this.recoverFromCachedDashboardError();
    }
  }

  private async clearBrowserAppCaches() {
    try {
      window.localStorage.clear();
    } catch {
      // ignore storage errors
    }

    try {
      window.sessionStorage.clear();
    } catch {
      // ignore storage errors
    }

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    } catch {
      // ignore browser support or permission errors
    }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // ignore cache cleanup errors
    }
  }

  private recoverFromCachedDashboardError = async () => {
    if (this.state.recoveryStarted) return;
    this.setState({ recoveryStarted: true });

    try {
      const recoveryKey = 'beezio_cached_asset_recovery_v2';
      if (sessionStorage.getItem(recoveryKey) === '1') return;
      sessionStorage.setItem(recoveryKey, '1');
    } catch {
      // ignore storage errors
    }

    await this.clearBrowserAppCaches();

    const freshUrl = new URL(window.location.href);
    freshUrl.searchParams.set('beezio_refresh', String(Date.now()));
    freshUrl.searchParams.set('beezio_bust', Math.random().toString(36).slice(2));
    window.location.replace(freshUrl.toString());
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">Beezio needs a refresh</h1>
          <p className="mt-3 text-sm text-gray-700">
            The app hit a loading error. This can happen right after an update if your browser still has an older dashboard file cached.
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                sessionStorage.clear();
              } catch {
                // ignore
              }
              await this.clearBrowserAppCaches();
              const freshUrl = new URL(window.location.href);
              freshUrl.searchParams.set('beezio_refresh', String(Date.now()));
              window.location.replace(freshUrl.toString());
            }}
            className="mt-5 rounded-lg bg-[#101820] px-5 py-3 text-sm font-semibold text-[#ffcb05] hover:bg-black"
          >
            Refresh Beezio
          </button>
          {this.state.recoveryStarted && (
            <p className="mt-3 text-xs font-semibold text-amber-900">
              Clearing the old dashboard files and reloading Beezio...
            </p>
          )}
          <p className="mt-4 text-xs text-gray-500">
            If this repeats, send support the current page URL and the message: {this.state.error.message}
          </p>
          {this.state.componentStack && (
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-white p-3 text-left text-[11px] leading-relaxed text-gray-600">
              {this.state.componentStack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
