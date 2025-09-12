import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/i18n';
import App from './App';

// Register service worker with safe update flow
if ('serviceWorker' in navigator) {
  // Register the SW using our helper which emits events when updates are available
  import('./services/swRegister').then(({ registerServiceWorker }) => {
    registerServiceWorker();
  }).catch(() => {
    // ignore import failures
  });
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
