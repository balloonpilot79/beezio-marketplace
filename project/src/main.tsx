import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/i18n';
import './utils/auth-testing';
import App from './App';

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

// Development helper: automatically unregister any service workers to avoid cached 404s/stale bundles
// This runs only in non-production builds and helps ensure the dev server is used during testing
// ALSO run in production to clean up any broken service workers
if (typeof window !== 'undefined') {
  try {
    if ('serviceWorker' in navigator) {
      // Force unregister ALL service workers on startup to fix authentication issues
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach(r => {
          try { r.unregister(); } catch (e) { /* ignore */ }
        });
      }).catch(() => {});
      // also clear runtime caches that might contain stale index.html
      if (window.caches) {
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
      }
    }
  } catch (e) {
    // swallow errors in environments without SW support
  }
}

if (process.env.NODE_ENV !== 'production') {
  console.debug('React app is initializing...');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (process.env.NODE_ENV !== 'production') {
  console.debug('React app is rendering...');
}
// Force deployment trigger - build fixes applied
