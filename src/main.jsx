import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import HubPage from './pages/HubPage';
import LegalPage from './pages/LegalPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import { getLegalPage, getModeFromPathname } from './utils/routing';
import { I18nProvider } from './i18n';
import './styles.css';

function Root() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const legalPage = getLegalPage(pathname);
  if (legalPage) {
    return <LegalPage page={legalPage} />;
  }

  if (pathname.replace(/\/+$/, '').toLowerCase() === '/verify-email') {
    return <VerifyEmailPage />;
  }

  const mode = getModeFromPathname(pathname);
  return mode ? <App key={mode.id} site={mode.id} /> : <HubPage />;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <Root />
    </I18nProvider>
  </React.StrictMode>
);

