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

// Offline support: pick up a new build on the next visit without prompting.
registerSW({ immediate: true });
