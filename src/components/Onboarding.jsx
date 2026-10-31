import { useState } from 'react';

import { api } from '../lib/api';
import { SiteFieldsForm } from './SiteFields';

const STEPS = ['Vous', 'Votre univers', 'Votre photo'];

export default function Onboarding({ token, site, brand, profile, t, onDone, onSkip, onError }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({
    ...profile,
    age: profile.age ?? '',
    interests: Array.isArray(profile.interests) ? profile.interests.join(', ') : profile.interests ?? '',
    details: profile.details ?? {},
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const validateBasics = () => {
    const next = {};
    const age = Number(draft.age);
    if (!(age >= 18 && age <= 80)) next.age = t('Indiquez un âge entre 18 et 80 ans.');
    if (!`${draft.city ?? ''}`.trim()) next.city = t('Indiquez votre ville.');
    if (!`${draft.bio ?? ''}`.trim()) next.bio = t('Présentez-vous en quelques mots.');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateBasics()) return;
    setStep((current) => current + 1);
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setErrors({ avatar: t('Choisissez une image JPEG, PNG ou WebP de 3 Mo maximum.') });
      return;
    }
    setBusy(true);
    try {
      const { url } = await api.uploadPhoto(token, file);
      set('avatar', url);
      setErrors({});
    } catch (error) {
      setErrors({ avatar: error.message || t('Impossible d’envoyer la photo.') });
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const { profile: saved } = await api.updateProfile(token, draft);
      onDone(saved);
    } catch (error) {
      onError(error, t('Impossible de sauvegarder le profil.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={t('Bienvenue')}>
      <div className="modal-card onboarding-card">
        <p className="eyebrow">{brand} · {t('Étape {n}/{total}', { n: step + 1, total: STEPS.length })}</p>
        <h3>{t(step === 0 ? 'Bienvenue ! Faisons connaissance' : STEPS[step])}</h3>
        <div className="onboarding-progress" aria-hidden="true">
          {STEPS.map((label, index) => <span key={label} className={index <= step ? 'is-done' : ''} />)}
        </div>

        {step === 0 ? (
          <div className="profile-form">
            <div className="form-grid">
              <label>
                <span>{t('Âge')}</span>
                <input type="number" min="18" max="80" value={draft.age} onChange={(event) => set('age', event.target.value)} />
                {errors.age ? <small className="field-error">{errors.age}</small> : null}
              </label>
              <label>
                <span>{t('Ville')}</span>
                <input value={draft.city ?? ''} onChange={(event) => set('city', event.target.value)} />
                {errors.city ? <small className="field-error">{errors.city}</small> : null}
              </label>
            </div>
            <label>
              <span>{t('Bio')}</span>
              <textarea rows="3" value={draft.bio ?? ''} onChange={(event) => set('bio', event.target.value)} />
              {errors.bio ? <small className="field-error">{errors.bio}</small> : null}
            </label>
            <label>
              <span>{t('Centres d’intérêt')}</span>
              <input value={draft.interests} onChange={(event) => set('interests', event.target.value)} placeholder={t('Voyage, Musique, Sport')} />
            </label>
          </div>
        ) : null}

        {step === 1 ? <SiteFieldsForm site={site} details={draft.details} onChange={(details) => set('details', details)} t={t} /> : null}

        {step === 2 ? (
          <div className="profile-form">
            <p>{t('Un profil avec photo reçoit beaucoup plus de réponses et obtient le badge « vérifié ».')}</p>
            {draft.avatar ? <img className="onboarding-avatar" src={draft.avatar} alt="" /> : null}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadAvatar} disabled={busy} />
            {errors.avatar ? <small className="field-error">{errors.avatar}</small> : null}
          </div>
        ) : null}

        <div className="form-actions">
          {step > 0 ? <button type="button" className="secondary-button" onClick={() => setStep(step - 1)}>{t('Retour')}</button> : null}
          {step < STEPS.length - 1 ? (
            <button type="button" className="primary-button" onClick={next}>{t('Continuer')}</button>
          ) : (
            <button type="button" className="primary-button" onClick={finish} disabled={busy}>{t('Terminer')}</button>
          )}
          <button type="button" className="link-button" onClick={onSkip}>{t('Plus tard')}</button>
        </div>
      </div>
    </div>
  );
}
