import { useEffect, useState } from 'react';

const KEY = 'lifys-ads-consent';
const EVENT = 'lifys:consent';

export function getConsent() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible : le choix ne sera pas mémorisé
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useConsent() {
  const [consent, setState] = useState(getConsent);
  useEffect(() => {
    const sync = () => setState(getConsent());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return consent;
}

let analyticsLoaded = false;

export function loadAnalytics(id) {
  if (analyticsLoaded || !/^G-[A-Z0-9]{4,20}$/.test(id)) return;
  analyticsLoaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

let scriptPromise = null;

export function loadAdsScript(client) {
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('ads_script_failed'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}
