import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export default function PushToggle({ token }) {
  const { t } = useI18n();
  const [key, setKey] = useState(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  useEffect(() => {
    if (!supported) return;
    api.getPushKey().then((data) => setKey(data.publicKey)).catch(() => setKey(null));
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setActive(Boolean(subscription)))
      .catch(() => {});
  }, [supported]);

  if (!supported || !key) {
    return null;
  }

  const toggle = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await api.pushUnsubscribe(token, existing.endpoint);
        await existing.unsubscribe();
        setActive(false);
      } else if (await Notification.requestPermission() === 'granted') {
        const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
        await api.pushSubscribe(token, subscription.toJSON());
        setActive(true);
      }
    } catch {
      setActive(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="push-toggle">
      <div>
        <h3>🔔 {t('Notifications de messages')}</h3>
        <p className="muted small">{t('Recevez une notification quand on vous écrit, même site fermé.')}</p>
      </div>
      <button type="button" className="secondary-button" disabled={busy} onClick={toggle}>{active ? t('Désactiver') : t('Activer')}</button>
    </div>
  );
}
