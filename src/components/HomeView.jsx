import { MODES } from '../data/demo';
import { getModeDescription, getModeLabel } from '../lib/app-utils';

export default function HomeView({ profile, matchCount, conversationCount, onModeSelect, onNavigate, onReset }) {
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">MVP local · expérience démonstration</p>
          <h1>Une vitrine professionnelle pour explorer les cinq univers de Lifys.</h1>
          <p>
            Ce prototype React/Vite met en scène une expérience premium, chaleureuse et responsive.
            Les profils, matchs et messages sont entièrement fictifs et stockés localement dans votre navigateur.
          </p>

          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onNavigate('discover')}>Commencer la découverte</button>
            <button type="button" className="secondary-button" onClick={() => onNavigate('profile')}>Compléter mon profil</button>
          </div>

          <div className="notice-card">
            <div>
              <strong>Prototype local et réinitialisable</strong>
              <p>Aucune authentification, base de données distante ou messagerie temps réel n’est fournie dans cette démo.</p>
            </div>
            <button type="button" className="ghost-button" onClick={onReset}>Réinitialiser la démo</button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="mini-card mini-card-main">
            <span className="mini-label">Mode principal</span>
            <h2>{getModeLabel(profile.mode)}</h2>
            <p>{getModeDescription(profile.mode)}</p>
          </div>

          <div className="hero-stats-grid">
            <div className="mini-card stat-card">
              <span>Matchs</span>
              <strong>{matchCount}</strong>
            </div>
            <div className="mini-card stat-card">
              <span>Conversations</span>
              <strong>{conversationCount}</strong>
            </div>
            <div className="mini-card stat-card">
              <span>Ville</span>
              <strong>{profile.city || 'À compléter'}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="mode-grid" aria-label="Catégories Lifys">
        {MODES.map((mode) => (
          <button key={mode.id} type="button" className="mode-card" onClick={() => onModeSelect(mode.id)}>
            <span className="mode-icon" aria-hidden="true">{mode.icon}</span>
            <strong>{mode.label}</strong>
            <small>{mode.description}</small>
          </button>
        ))}
      </section>
    </>
  );
}
