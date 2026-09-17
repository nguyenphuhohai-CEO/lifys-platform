import { getModeMeta } from '../lib/appUtils';

export default function HomeView({ profile, modes, matchCount, remainingCount, onDiscover, onOpenProfile, onExploreMode }) {
  const profileMode = getModeMeta(profile.mode);

  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Prototype local · données simulées</span>
          <h1>Une expérience Lifys plus crédible, élégante et prête pour démonstration.</h1>
          <p>
            Le MVP rassemble les cinq modes de rencontre dans une interface plus soignée, accessible et cohérente, tout en restant volontairement local et sans backend de production.
          </p>
          <div className="cta-row">
            <button type="button" className="primary-button" onClick={onDiscover}>Explorer les profils</button>
            <button type="button" className="secondary-button" onClick={onOpenProfile}>Compléter mon profil</button>
          </div>
          <div className="hero-stats" aria-label="Résumé du prototype">
            <div className="stat-card">
              <span>Profils disponibles</span>
              <strong>{remainingCount}</strong>
            </div>
            <div className="stat-card">
              <span>Matchs locaux</span>
              <strong>{matchCount}</strong>
            </div>
            <div className="stat-card">
              <span>Mode favori</span>
              <strong>{profileMode.label}</strong>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="mini-card large">
            <span className="mini-label">Profil actuel</span>
            <h3>{profile.name || 'Votre profil Lifys'}</h3>
            <p>{profile.city || 'Ville à compléter'} · {profile.age || '18+'} ans</p>
            <small>{profile.bio || 'Ajoutez une bio pour personnaliser vos recommandations.'}</small>
          </div>
          <div className="mini-card small">
            <span>Démo locale</span>
            <strong>100%</strong>
          </div>
        </div>
      </section>

      <section className="mode-grid">
        {modes.map((mode) => (
          <button key={mode.id} type="button" className="mode-card" onClick={() => onExploreMode(mode.id)}>
            <span className="mode-icon" aria-hidden="true">{mode.icon}</span>
            <strong>{mode.label}</strong>
            <small>{mode.description}</small>
          </button>
        ))}
      </section>
    </>
  );
}
