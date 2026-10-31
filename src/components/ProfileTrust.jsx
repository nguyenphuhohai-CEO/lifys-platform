import { useState } from 'react';
import { api } from '../lib/api';

const STATUS_LABEL = {
  none: 'Aucune vérification',
  pending: 'En cours de vérification',
  approved: 'Selfie vérifié',
  rejected: 'Selfie refusé, réessayez',
};

// Vérification par selfie (revue manuelle) et boost de visibilité.
export default function ProfileTrust({ token, profile, t, onChange, onError }) {
  const [busy, setBusy] = useState(false);
  const status = profile.selfieStatus ?? 'none';
  const boostActive = profile.boostUntil && new Date(profile.boostUntil) > new Date();
  const nextBoost = profile.nextBoostAt && new Date(profile.nextBoostAt) > new Date() ? new Date(profile.nextBoostAt) : null;

  const handleSelfie = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const response = await api.uploadSelfie(token, file);
      onChange(response.profile);
    } catch (error) {
      onError(error, t('Envoi du selfie impossible.'));
    } finally {
      setBusy(false);
    }
  };

  const handleBoost = async () => {
    setBusy(true);
    try {
      const response = await api.boostProfile(token);
      onChange(response.profile);
    } catch (error) {
      onError(error, t('Boost impossible pour le moment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="trust-card">
      <div>
        <strong>🤳 {t('Vérification par selfie')}</strong>
        <p className="muted">{t(STATUS_LABEL[status] ?? STATUS_LABEL.none)}</p>
        {status === 'none' || status === 'rejected' ? (
          <label className="secondary-button file-button">
            {t('Prendre un selfie')}
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={handleSelfie} disabled={busy} hidden />
          </label>
        ) : null}
        <small>{t('Le selfie est vu uniquement par un modérateur, puis supprimé de la file.')}</small>
      </div>
      <div>
        <strong>🚀 {t('Boost de visibilité')}</strong>
        <p className="muted">
          {boostActive
            ? t('Actif jusqu’à {time}', { time: new Date(profile.boostUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
            : nextBoost
              ? t('Prochain boost le {date}', { date: nextBoost.toLocaleString() })
              : t('30 minutes en tête des résultats.')}
        </p>
        <button type="button" className="primary-button" onClick={handleBoost} disabled={busy || boostActive || Boolean(nextBoost)}>
          {t('Booster mon profil')}
        </button>
      </div>
    </div>
  );
}
