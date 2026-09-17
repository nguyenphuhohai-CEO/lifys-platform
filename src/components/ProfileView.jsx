import { MODES } from '../constants';

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <span id={id} className="field-error" role="status">
      {message}
    </span>
  );
}

function ProfileView({ profile, errors, onSubmit }) {
  return (
    <section className="content-panel profile-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Profil</p>
          <h2>Complétez votre profil</h2>
          <p className="panel-meta">Les informations restent stockées uniquement en local.</p>
        </div>
      </div>

      <form className="profile-form" onSubmit={onSubmit} noValidate>
        <div className="form-grid">
          <label htmlFor="profile-name">
            <span>Prénom</span>
            <input
              id="profile-name"
              name="name"
              defaultValue={profile.name}
              placeholder="Sofia"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'error-name' : undefined}
            />
            <FieldError id="error-name" message={errors.name} />
          </label>
          <label htmlFor="profile-age">
            <span>Âge</span>
            <input id="profile-age" name="age" type="number" min="18" max="80" defaultValue={profile.age || 28} />
          </label>
          <label htmlFor="profile-city">
            <span>Ville</span>
            <input
              id="profile-city"
              name="city"
              defaultValue={profile.city}
              placeholder="Paris"
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? 'error-city' : undefined}
            />
            <FieldError id="error-city" message={errors.city} />
          </label>
          <label htmlFor="profile-mode">
            <span>Mode de rencontre</span>
            <select id="profile-mode" name="mode" defaultValue={profile.mode || 'amoureux'}>
              {MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label htmlFor="profile-avatar">
          <span>Avatar URL (optionnel)</span>
          <input id="profile-avatar" name="avatar" defaultValue={profile.avatar} placeholder="https://..." />
        </label>

        <label htmlFor="profile-bio">
          <span>Bio</span>
          <textarea
            id="profile-bio"
            name="bio"
            rows="4"
            defaultValue={profile.bio}
            placeholder="Décrivez votre personnalité et ce que vous recherchez."
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={errors.bio ? 'error-bio' : undefined}
          />
          <FieldError id="error-bio" message={errors.bio} />
        </label>

        <label htmlFor="profile-interests">
          <span>Centres d’intérêt</span>
          <input
            id="profile-interests"
            name="interests"
            defaultValue={profile.interests}
            placeholder="voyage, musique, sport"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="primary-button">
            Sauvegarder
          </button>
        </div>
      </form>
    </section>
  );
}

export default ProfileView;
