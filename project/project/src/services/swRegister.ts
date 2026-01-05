// Lightweight service worker registration helper
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js').then(reg => {
    // If there's an update found, notify the app when it's installed
    reg.addEventListener('updatefound', () => {
      const installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          // New content is available, notify the app
          window.dispatchEvent(new CustomEvent('swUpdated', { detail: { registration: reg } }));
        }
      });
    });

    // If the active worker changes (new SW took control), notify the app
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.dispatchEvent(new Event('swControllerChange'));
    });
  }).catch((err) => {
    // registration failed, fail silently
    console.debug('SW registration failed:', err);
  });
}

export function skipWaiting(registration: ServiceWorkerRegistration | null) {
  if (!registration) return;
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}
