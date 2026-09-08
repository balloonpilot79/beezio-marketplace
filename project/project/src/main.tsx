import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import AppErrorBoundary from './components/AppErrorBoundary';

// Signal to the HTML boot screen that the React bundle successfully loaded.
if (typeof window !== 'undefined') {
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
