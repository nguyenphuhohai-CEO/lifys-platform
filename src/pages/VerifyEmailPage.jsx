import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function VerifyEmailPage() {
  const [state, setState] = useState('loading');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    api.verifyEmail(token).then(() => setState('ok')).catch(() => setState('error'));
  }, []);

  return (
    <div className="app-shell">
      <main className="page-shell legal-page">
        <h1>Confirmation de l’adresse e-mail</h1>
        {state === 'loading' && <p>Vérification en cours…</p>}
        {state === 'ok' && <p>Votre adresse e-mail est confirmée. Vous pouvez maintenant utiliser Lifys.</p>}
        {state === 'error' && <p>Ce lien est invalide ou a expiré. Connectez-vous pour recevoir un nouveau lien.</p>}
        <a className="primary-button" href="/">Aller sur Lifys</a>
      </main>
    </div>
  );
}
