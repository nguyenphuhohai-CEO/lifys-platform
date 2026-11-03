import { useState } from 'react';

import { api } from '../lib/api';

export function PhotoStrip({ photos }) {
  if (!photos?.length) return null;
  return (
    <div className="photo-strip">
      {photos.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" loading="lazy" /></a>
      ))}
    </div>
  );
}

export function GalleryManager({ token, photos = [], t, onChange, onError }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setError(t('Choisissez une image JPEG, PNG ou WebP de 3 Mo maximum.'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { profile } = await api.addPhoto(token, file);
      onChange(profile);
    } catch (failure) {
      setError(failure.message || t('Impossible d’envoyer la photo.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (url) => {
    try {
      const { profile } = await api.removePhoto(token, url);
      onChange(profile);
    } catch (failure) {
      onError(failure, t('Suppression impossible.'));
    }
  };

  return (
    <div className="gallery-manager">
      <span>{t('Galerie photos')}</span>
      <div className="photo-strip photo-strip-edit">
        {photos.map((url) => (
          <div key={url} className="photo-item">
            <img src={url} alt="" />
            <button type="button" aria-label={t('Supprimer')} onClick={() => remove(url)}>×</button>
          </div>
        ))}
      </div>
      {photos.length < 4 ? <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} /> : null}
      <small>{busy ? t('Envoi en cours…') : t('Jusqu’à 4 photos supplémentaires, ajoutées immédiatement à votre profil.')}</small>
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}
