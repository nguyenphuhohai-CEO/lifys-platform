import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { translations } from './translations.js';

export const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'vi', label: 'Tiếng Việt' },
];

const STORAGE_KEY = 'lifys.lang';
const CODES = LANGUAGES.map((item) => item.code);

export function detectLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (CODES.includes(stored)) {
      return stored;
    }
  } catch {
    // stockage indisponible : on retombe sur la langue du navigateur
  }

  const browser = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  return CODES.includes(browser) ? browser : 'fr';
}

export function translate(lang, key, vars) {
  const text = translations[lang]?.[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_match, name) => `${vars[name] ?? ''}`) : text;
}

const I18nContext = createContext({ lang: 'fr', setLang: () => {}, t: (key, vars) => translate('fr', key, vars) });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignoré
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: (key, vars) => translate(lang, key, vars) }), [lang, setLang]);
  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}

