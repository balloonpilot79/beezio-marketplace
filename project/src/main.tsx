import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/i18n';
import App from './App';

// Temporarily disable service worker registration while debugging
// to avoid it intercepting requests and causing network errors
if ('serviceWorker' in navigator) {
  // Unregister any existing service workers first
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister().then(() => {
        console.log('SW unregistered: ', registration);
      });
    }
  });

  // Don't register a new one for now
  // window.addEventListener('load', () => {
  //   navigator.serviceWorker.register('/sw.js')
  //     .then((registration) => {
  //       console.log('SW registered: ', registration);
  //     })
  //     .catch((registrationError) => {
  //       console.log('SW registration failed: ', registrationError);
  //     });
  // });
}

console.log('React app is initializing...');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

console.log('React app is rendering...');
// Force deployment trigger - build fixes applied
