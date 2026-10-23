import React from 'react';

import { useI18n } from '../i18n';
import { setConsent, useConsent } from '../lib/consent';

export default function ConsentBanner({ ads, hidden }) {
  const { t } = useI18n();
  const consent = useConsent();

  if (!ads || hidden || consent) return null;

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label={t('Publicités personnalisées')}>
      <p>
        {t('Lifys affiche des publicités sur l’offre Gratuite. Avec votre accord, notre partenaire publicitaire peut utiliser des cookies pour les personnaliser. Vous pouvez changer d’avis à tout moment, ou passer à Premium pour ne plus en voir.')}{' '}
        <a href="/confidentialite">{t('Confidentialité')}</a>
      </p>
      <div className="consent-actions">
        <button type="button" className="secondary-button" onClick={() => setConsent('denied')}>{t('Refuser')}</button>
        <button type="button" className="primary-button" onClick={() => setConsent('granted')}>{t('Accepter')}</button>
      </div>
    </div>
  );
}
