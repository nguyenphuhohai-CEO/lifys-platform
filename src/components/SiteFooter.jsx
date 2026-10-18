import React from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { useI18n } from '../i18n';

export default function SiteFooter() {
  const { t } = useI18n();

  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} Lifys</span>
      <nav aria-label={t('Informations légales')}>
        <a href="/cgu">{t('CGU')}</a>
        <a href="/confidentialite">{t('Confidentialité')}</a>
        <a href="/mentions-legales">{t('Mentions légales')}</a>
        <LanguageSwitcher />
      </nav>
    </footer>
  );
}
