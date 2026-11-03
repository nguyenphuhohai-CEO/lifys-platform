import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import SiteFooter from '../components/SiteFooter';
import { useI18n } from '../i18n';

export default function VerifyEmailPage() {
  const { t } = useI18n();
  const [state, setState] = useState('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    api.verifyEmail(token).then(() => setState('ok')).catch(() => setState('error'));
  }, []);

  return (
    <div className="app-shell">
      <main className="page-shell legal-page">
        <h1>{t('Confirmation de l’adresse e-mail')}</h1>
        {state === 'loading' && <p>{t('Vérification en cours…')}</p>}
        {state === 'ok' && <p>{t('Votre adresse e-mail est confirmée. Vous pouvez maintenant utiliser Lifys.')}</p>}
        {state === 'error' && <p>{t('Ce lien est invalide ou a expiré. Connectez-vous pour recevoir un nouveau lien.')}</p>}
        <a className="primary-button" href="/">{t('Aller sur Lifys')}</a>
      </main>
      <SiteFooter />
    </div>
  );
}
