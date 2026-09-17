import Avatar from './Avatar';
import { MODES } from '../data/demo';
import { formatInterests, getModeDescription, getModeLabel } from '../lib/app-utils';

function FieldError({ id, message }) {
  if (!message) {
    return null;
  }

  return <small id={id} className="field-error">{message}</small>;
}

export default function ProfileView({ draft, errors, onChange, onSubmit }) {
  const formattedInterests = formatInterests(draft.interests);

  return (
    <section className="content-panel profile-panel">
      <div className="panel-header panel-header-stack">
        <div>
          <p className="eyebrow">Profil</p>
          <h2>Fiabiliser votre profil de démonstration</h2>
          <p className="panel-subtitle">Validation accessible, aperçu immédiat et stockage local sécurisé.</p>
        </div>
      </div>

      <div className="profile-layout">
        <form className="profile-form" onSubmit={onSubmit} noValidate>
          <div className="form-grid">
            <label>
              <span>Prénom ou pseudo</span>
              <input
                name="name"
                value={draft.name}
                onChange={(event) => onChange('name', event.target.value)}
                placeholder="Sofia"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'profile-name-error' : undefined}
              />
              <FieldError id="profile-name-error" message={errors.name} />
            </label>

            <label>
              <span>Âge</span>
              <input
                name="age"
                type="number"
                min="18"
                max="80"
                value={draft.age}
                onChange={(event) => onChange('age', event.target.value)}
                aria-invalid={Boolean(errors.age)}
                aria-describedby={errors.age ? 'profile-age-error' : undefined}
              />
              <FieldError id="profile-age-error" message={errors.age} />
            </label>

            <label>
              <span>Ville</span>
              <input
                name="city"
                value={draft.city}
                onChange={(event) => onChange('city', event.target.value)}
                placeholder="Paris"
                aria-invalid={Boolean(errors.city)}
                aria-describedby={errors.city ? 'profile-city-error' : undefined}
              />
              <FieldError id="profile-city-error" message={errors.city} />
            </label>

            <label>
              <span>Catégorie principale</span>
              <select name="mode" value={draft.mode} onChange={(event) => onChange('mode', event.target.value)}>
                {MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>{mode.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            <span>Avatar URL</span>
            <input
              name="avatar"
              value={draft.avatar}
              onChange={(event) => onChange('avatar', event.target.value)}
              placeholder="https://..."
              aria-invalid={Boolean(errors.avatar)}
              aria-describedby={errors.avatar ? 'profile-avatar-error' : undefined}
            />
            <FieldError id="profile-avatar-error" message={errors.avatar} />
          </label>

          <label>
            <span>Bio</span>
            <textarea
              name="bio"
              rows="5"
              value={draft.bio}
              onChange={(event) => onChange('bio', event.target.value)}
              placeholder="Décrivez votre personnalité, vos intentions et le type de relation recherché."
              aria-invalid={Boolean(errors.bio)}
              aria-describedby={errors.bio ? 'profile-bio-error' : undefined}
            />
            <FieldError id="profile-bio-error" message={errors.bio} />
          </label>

          <label>
            <span>Centres d’intérêt</span>
            <input
              name="interests"
              value={draft.interests}
              onChange={(event) => onChange('interests', event.target.value)}
              placeholder="voyages, musique, sport"
            />
            <small className="helper-text">Ils seront automatiquement nettoyés et formatés lors de la sauvegarde.</small>
          </label>

          {Object.keys(errors).length > 0 ? (
            <div className="form-alert" role="alert">
              Merci de corriger les champs signalés avant de sauvegarder ce profil local.
            </div>
          ) : null}

          <div className="form-actions">
            <button type="submit" className="primary-button">Enregistrer le profil</button>
          </div>
        </form>

        <aside className="profile-preview" aria-label="Aperçu du profil">
          <Avatar src={draft.avatar} name={draft.name || 'Votre profil'} className="profile-preview-avatar" altPrefix="Aperçu de" />
          <div>
            <p className="eyebrow">Aperçu</p>
            <h3>{draft.name || 'Votre profil'}, {draft.age || 28}</h3>
            <p className="panel-subtitle">{draft.city || 'Ville à renseigner'} · {getModeLabel(draft.mode)}</p>
            <p className="profile-preview-bio">{draft.bio || getModeDescription(draft.mode)}</p>
          </div>
          <div className="interest-row">
            {formattedInterests.length > 0
              ? formattedInterests.map((item) => <span key={item}>{item}</span>)
              : <span>Ajoutez des centres d’intérêt</span>}
          </div>
        </aside>
      </div>
    </section>
  );
}
