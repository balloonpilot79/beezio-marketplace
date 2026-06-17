import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/i18n';
import './utils/auth-testing';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';

if (typeof window !== 'undefined') {
  (window as any).__beezioBooted = true;
}

// Register service worker with safe update flow
// Only register the service worker when explicitly enabled via VITE_ENABLE_SW
// This prevents stale/buggy service workers from causing blank pages during local development
if ('serviceWorker' in navigator && import.meta.env.VITE_ENABLE_SW === 'true') {
  // Register the SW using our helper which emits events when updates are available
  import('./services/swRegister').then(({ registerServiceWorker }) => {
    registerServiceWorker();
  }).catch(() => {
    // ignore import failures
  });
}

// If the SW flag is not enabled, proactively unregister any existing SWs (including old/broken ones).
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.VITE_ENABLE_SW !== 'true') {
  try {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        try { r.unregister(); } catch (e) { /* ignore */ }
      });
    }).catch(() => {});
  } catch (e) {
    // swallow errors in environments without SW support
  }
}

// Safety net: if a lazy chunk fails to load (stale bundle), do a one-time hard reload.
if (typeof window !== 'undefined') {
  const RELOAD_KEY = 'beezio_chunk_reload_v2';
  const shouldReloadForChunkError = (err: unknown) => {
    const message = String((err as any)?.message || (err as any)?.reason || err || '');
    return /Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(message);
  };

  const reloadOnce = () => {
    try {
      if (sessionStorage.getItem(RELOAD_KEY) === '1') return;
      sessionStorage.setItem(RELOAD_KEY, '1');
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key))).catch(() => {});
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => registrations.forEach((registration) => registration.unregister()))
          .catch(() => {});
      }
    } catch {
      // ignore storage errors
    }
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('beezio_refresh');
    cleanUrl.searchParams.delete('beezio_bust');
    window.location.replace(cleanUrl.toString());
  };

  window.addEventListener('error', (event) => {
    const errorEvent = event as ErrorEvent;
    if (shouldReloadForChunkError(errorEvent.error) || shouldReloadForChunkError(errorEvent.message)) {
      reloadOnce();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (shouldReloadForChunkError((event as PromiseRejectionEvent).reason)) {
      reloadOnce();
    }
  });
}

if (process.env.NODE_ENV !== 'production') {
  console.debug('React app is initializing...');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);

if (process.env.NODE_ENV !== 'production') {
  console.debug('React app is rendering...');
}
// Force deployment trigger - build fixes applied
