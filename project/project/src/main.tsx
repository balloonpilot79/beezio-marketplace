import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';

// Beezio rebuild boot marker. Changing this forces a fresh production bundle.
const BEEZIO_REBUILD_BOOT_VERSION = '2026-09-10-1';
if (typeof window !== 'undefined') {
  (window as any).__beezioRebuildBootVersion = BEEZIO_REBUILD_BOOT_VERSION;
  (window as any).__beezioBooted = true;
}

// Service workers are intentionally disabled for the rebuild unless explicitly enabled.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.VITE_ENABLE_SW !== 'true') {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister().catch(() => {}));
  }).catch(() => {});
}

const root = document.getElementById('root');
if (!root) throw new Error('Beezio root element was not found');

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
