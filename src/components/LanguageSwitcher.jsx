import React from 'react';

import { LANGUAGES, useI18n } from '../i18n';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <label className="lang-switcher">
      <span className="sr-only">{t('Langue')}</span>
      <select value={lang} onChange={(event) => setLang(event.target.value)} aria-label={t('Langue')}>
        {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
      </select>
    </label>
  );
}
