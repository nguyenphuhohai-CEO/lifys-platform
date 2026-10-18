import React from 'react';

import { useI18n } from '../i18n';

export function AdSlot({ onUpgrade }) {
  const { t } = useI18n();

  return (
    <aside className="ad-slot" aria-label={t('Publicité')}>
      <span className="ad-label">{t('Publicité')}</span>
      <div className="ad-body">
        <strong>{t('Votre espace publicitaire')}</strong>
        <span>{t('Passez à Lifys Premium pour supprimer toutes les publicités.')}</span>
      </div>
      <button type="button" className="secondary-button" onClick={onUpgrade}>{t('Supprimer les publicités')}</button>
    </aside>
  );
}

function formatPrice(plan, lang) {
  if (!plan.priceCents) {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: plan.currency, maximumFractionDigits: 0 }).format(0);
  }
  return new Intl.NumberFormat(lang, { style: 'currency', currency: plan.currency }).format(plan.priceCents / 100);
}

export default function PricingPanel({ plans, checkoutAvailable, isPremium, busy, onCheckout, onManage }) {
  const { t, lang } = useI18n();
  const features = {
    free: ['Toutes les catégories de rencontre', 'Matchs et messagerie illimités', 'Publicités affichées'],
    premium: ['Toutes les catégories de rencontre', 'Matchs et messagerie illimités', 'Aucune publicité', 'Résiliable à tout moment'],
  };

  return (
    <div className="plan-grid">
      {plans.map((plan) => {
        const current = (plan.id === 'premium') === isPremium;
        return (
          <article key={plan.id} className={plan.id === 'premium' ? 'plan-card featured' : 'plan-card'}>
            <h3>{plan.id === 'premium' ? t('Premium') : t('Gratuit')}</h3>
            <p className="plan-price">
              {formatPrice(plan, lang)}
              {plan.interval ? <small> {t('/ mois')}</small> : null}
            </p>
            <p className="plan-tagline">{plan.ads ? t('Avec publicités') : t('Sans publicités')}</p>
            <ul>
              {features[plan.id].map((item) => <li key={item}>{t(item)}</li>)}
            </ul>
            {current ? <span className="tag">{t('Votre offre actuelle')}</span> : null}
            {plan.id === 'premium' && !isPremium ? (
              <>
                <button type="button" className="primary-button" disabled={busy || !checkoutAvailable} onClick={onCheckout}>
                  {busy ? t('Redirection…') : t('Passer à Premium')}
                </button>
                {!checkoutAvailable ? <small>{t('Le paiement n’est pas encore disponible.')}</small> : null}
              </>
            ) : null}
            {plan.id === 'premium' && isPremium ? (
              <button type="button" className="secondary-button" disabled={busy} onClick={onManage}>{t('Gérer mon abonnement')}</button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
