import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';

// Compte à rebours d'un match qui expire s'il reste sans message.
export default function ExpiryNotice({ expiresAt }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return null;

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.max(1, Math.floor((remaining % 3600000) / 60000));
  const time = hours > 0 ? t('{h} h {m} min', { h: hours, m: minutes }) : t('{m} min', { m: minutes });

  return (
    <span className={hours < 3 ? 'expiry-notice urgent' : 'expiry-notice'} role="status">
      ⏳ {t('Ce match expire dans {time} : écrivez un message pour le garder.', { time })}
    </span>
  );
}
