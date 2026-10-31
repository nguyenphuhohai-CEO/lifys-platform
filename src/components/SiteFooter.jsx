import React from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { setConsent } from '../lib/consent';
import { useI18n } from '../i18n';

export default function SiteFooter({ ads, analytics }) {
  const { t } = useI18n();

  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} Lifys</span>
      <nav aria-label={t('Informations légales')}>
        <a href="/a-propos">{t('À propos')}</a>
        <a href="/aide">{t('Aide')}</a>
        <a href="/securite">{t('Sécurité')}</a>
        <a href="/contact">{t('Contact')}</a>
        <a href="/cgu">{t('CGU')}</a>
        <a href="/confidentialite">{t('Confidentialité')}</a>
        <a href="/mentions-legales">{t('Mentions légales')}</a>
        {ads || analytics ? <button type="button" className="link-button" onClick={() => setConsent(null)}>{t('Gérer les cookies')}</button> : null}
        <LanguageSwitcher />
      </nav>
    </footer>
  );
}
