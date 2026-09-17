import Avatar from './Avatar';
import { getModeLabel } from '../lib/app-utils';

export default function MatchesView({ matches, onMessage }) {
  return (
    <section className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Matchs</p>
          <h2>Vos correspondances</h2>
          <p className="panel-subtitle">Des connexions fictives, persistées localement pour la démonstration.</p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun match pour l’instant</h3>
          <p>Likez des profils compatibles pour enrichir cette expérience de démonstration.</p>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map((match) => (
            <article key={match.id} className="match-item">
              <Avatar src={match.avatar} name={match.name} className="match-avatar" />
              <div>
                <h3>{match.name}</h3>
                <p>{match.city} · {getModeLabel(match.mode)}</p>
                <small>{match.lastMessage}</small>
              </div>
              <button type="button" className="secondary-button" onClick={() => onMessage(match)}>
                Ouvrir la conversation
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
