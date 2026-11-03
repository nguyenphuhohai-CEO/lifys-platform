import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

export default function Referral({ token }) {
  const { t } = useI18n();
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getReferral(token).then(setInfo).catch(() => setInfo(null));
  }, [token]);

  if (!info) {
    return null;
  }

  const link = `${window.location.origin}/?ref=${info.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt(t('Lien d’invitation'), link);
    }
  };

  return (
    <div className="referral-card">
      <h3>🎁 {t('Parrainez vos amis')}</h3>
      <p className="muted small">{t('Vous et votre filleul recevez {days} jours de Premium offerts à son inscription ({count}/{max} parrainages).', { days: info.days, count: info.rewarded, max: info.max })}</p>
      <div className="referral-row">
        <input type="text" readOnly value={link} onFocus={(event) => event.target.select()} aria-label={t('Lien d’invitation')} />
        <button type="button" className="secondary-button" onClick={copy}>{copied ? t('Lien copié') : t('Copier')}</button>
      </div>
    </div>
  );
}
