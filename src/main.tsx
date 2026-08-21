import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/ui/styles/global.css';


function releaseOrientationLock(): void {
  try {
    window.screen.orientation?.unlock?.();
  } catch {
    // Some browsers expose Screen Orientation but do not allow runtime control.
    // The manifest still permits both orientations, so normal device rotation remains available.
  }
}

releaseOrientationLock();
window.addEventListener('pageshow', releaseOrientationLock);
window.addEventListener('orientationchange', releaseOrientationLock);

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
