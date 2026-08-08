import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

const container = document.getElementById('root');
if (!container) throw new Error('ไม่พบ #root element');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * Offline support. `autoUpdate` installs a new build in the background; the reload
 * below is what actually swaps the running page over to it, so a team member who
 * leaves the tab open still lands on the current version.
 */
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    // Check hourly — long enough not to be chatty, short enough for a work day.
    if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000);
  },
  onNeedRefresh() {
    window.location.reload();
  },
});
