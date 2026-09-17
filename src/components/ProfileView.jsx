import Avatar from './Avatar';
import { MODES } from '../data/demoData';
import { formatInterests } from '../lib/appUtils';

export default function ProfileView({ profile, errors, onChange, onSubmit }) {
  const previewInterests = formatInterests(profile.interests);

  return (
    <section className="content-panel profile-layout">
      <div className="profile-preview">
        <p className="eyebrow">Profil</p>
        <h2>Une présentation claire pour vos futures connexions.</h2>
        <div className="profile-preview-card">
          <Avatar src={profile.avatar} alt="Aperçu de votre avatar" name={profile.name || 'Vous'} className="profile-preview-avatar" />
          <div>
            <strong>{profile.name || 'Votre prénom'}</strong>
            <p>{profile.city || 'Votre ville'} · {profile.age || '18+'} ans</p>
            <small>{MODES.find((mode) => mode.id === profile.mode)?.label}</small>
          </div>
        </div>
        <p className="section-description">{profile.bio || 'Ajoutez une bio chaleureuse, claire et rassurante pour une meilleure démonstration.'}</p>
        <div className="interest-row">
          {previewInterests.length > 0 ? previewInterests.map((item) => <span key={item}>{item}</span>) : <span>Aucun intérêt ajouté</span>}
        </div>
      </div>

      <form className="profile-form" onSubmit={onSubmit} noValidate>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Édition</p>
            <h2>Complétez votre profil</h2>
          </div>
        </div>

        <div className="form-grid">
          <label>
            <span>Prénom</span>
            <input
              name="name"
              value={profile.name}
              onChange={(event) => onChange('name', event.target.value)}
              placeholder="Sofia"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'error-name' : undefined}
            />
            {errors.name ? <small id="error-name" className="field-error">{errors.name}</small> : null}
          </label>

          <label>
            <span>Âge</span>
            <input
              name="age"
              type="number"
              min="18"
              max="80"
              value={profile.age}
              onChange={(event) => onChange('age', event.target.value)}
              aria-invalid={Boolean(errors.age)}
              aria-describedby={errors.age ? 'error-age' : undefined}
            />
            {errors.age ? <small id="error-age" className="field-error">{errors.age}</small> : null}
          </label>

          <label>
            <span>Ville</span>
            <input
              name="city"
              value={profile.city}
              onChange={(event) => onChange('city', event.target.value)}
              placeholder="Paris"
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? 'error-city' : undefined}
            />
            {errors.city ? <small id="error-city" className="field-error">{errors.city}</small> : null}
          </label>

          <label>
            <span>Mode de rencontre</span>
            <select name="mode" value={profile.mode} onChange={(event) => onChange('mode', event.target.value)}>
              {MODES.map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.label}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>Avatar URL</span>
          <input name="avatar" value={profile.avatar} onChange={(event) => onChange('avatar', event.target.value)} placeholder="https://..." />
        </label>

        <label>
          <span>Bio</span>
          <textarea
            name="bio"
            rows="4"
            value={profile.bio}
            onChange={(event) => onChange('bio', event.target.value)}
            placeholder="Décrivez votre personnalité et ce que vous recherchez."
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={errors.bio ? 'error-bio' : undefined}
          />
          {errors.bio ? <small id="error-bio" className="field-error">{errors.bio}</small> : null}
        </label>

        <label>
          <span>Centres d’intérêt</span>
          <input
            name="interests"
            value={profile.interests}
            onChange={(event) => onChange('interests', event.target.value)}
            placeholder="voyage, musique, sport"
            aria-invalid={Boolean(errors.interests)}
            aria-describedby={errors.interests ? 'error-interests' : undefined}
          />
          {errors.interests ? <small id="error-interests" className="field-error">{errors.interests}</small> : null}
        </label>

        <div className="form-actions">
          <button type="submit" className="primary-button">Sauvegarder le profil</button>
        </div>
      </form>
    </section>
  );
}
