import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CategoryPage from './pages/CategoryPage';
import LegalPage from './pages/LegalPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import { getLegalPage, getModeFromPathname } from './utils/routing';
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
  return mode ? <CategoryPage mode={mode} /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
