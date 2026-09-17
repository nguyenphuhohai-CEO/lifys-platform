import { MODES } from '../constants';

function HomeView({ profile, matchCount, activeMode, setActiveMode, setView }) {
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">MVP local · données simulées</span>
          <h1>Une expérience Lifys premium, fiable et cohérente pour vos démonstrations.</h1>
          <p>
            Ce prototype professionnel reste 100% local : profils, matchs et messages sont simulés dans
            votre navigateur, sans backend de production.
          </p>
          <div className="cta-row">
            <button className="primary-button" onClick={() => setView('discover')} type="button">
              Découvrir
            </button>
            <button className="secondary-button" onClick={() => setView('profile')} type="button">
              Éditer mon profil
            </button>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="mini-card large">
            <span className="mini-label">Mode actif</span>
            <h3>{MODES.find((mode) => mode.id === profile.mode)?.label || 'Amoureux'}</h3>
            <p>
              {profile.city || 'Ville non définie'}, {profile.age || 28} ans
            </p>
          </div>
          <div className="mini-card small">
            <span>Matchs</span>
            <strong>{matchCount}</strong>
          </div>
        </div>
      </section>

      <section className="mode-grid" aria-label="Choix du type de rencontre">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={activeMode === mode.id ? 'mode-card active' : 'mode-card'}
            onClick={() => {
              setActiveMode(mode.id);
              setView('discover');
            }}
            type="button"
          >
            <span className="mode-icon">{mode.icon}</span>
            <strong>{mode.label}</strong>
            <small>Rencontres {mode.label.toLowerCase()}</small>
          </button>
        ))}
      </section>
    </>
  );
}

export default HomeView;
