import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

function SelfieImage({ token, id, onError }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    let objectUrl = '';
    let cancelled = false;
    api.getAdminSelfieImage(token, id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error) => onError(error, 'Image indisponible.'));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, id]); // eslint-disable-line react-hooks/exhaustive-deps

  return url ? <img className="selfie-review" src={url} alt="" /> : null;
}

export default function AdminSelfies({ token, onError }) {
  const { t } = useI18n();
  const [selfies, setSelfies] = useState(null);

  const load = useCallback(async () => {
    try {
      setSelfies((await api.getAdminSelfies(token)).selfies);
    } catch (error) {
      onError(error, t('Impossible de charger les selfies.'));
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id, approve) => {
    try {
      await api.resolveAdminSelfie(token, id, approve);
      await load();
    } catch (error) {
      onError(error, t('Action impossible.'));
    }
  };

  return (
    <section className="content-panel admin-panel">
      <div className="checklist-head">
        <div>
          <p className="eyebrow">{t('Administration')}</p>
          <h2>{t('Selfies à vérifier')}</h2>
        </div>
        <span className="counter-badge">{selfies?.length ?? 0}</span>
      </div>
      {selfies && !selfies.length ? <p className="empty-state">{t('Aucun selfie en attente.')}</p> : null}
      <ul className="admin-list">
        {(selfies ?? []).map((selfie) => (
          <li key={selfie.id} className="admin-report">
            <strong>{selfie.name || selfie.email}</strong> <small>{selfie.email}</small>
            <SelfieImage token={token} id={selfie.id} onError={onError} />
            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={() => resolve(selfie.id, false)}>{t('Refuser')}</button>
              <button type="button" className="primary-button" onClick={() => resolve(selfie.id, true)}>{t('Approuver')}</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
