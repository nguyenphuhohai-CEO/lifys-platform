import Avatar from './Avatar';
import { formatRelativeDate, getModeMeta } from '../lib/appUtils';

export default function MatchesView({ matches, onOpenMessages }) {
  return (
    <section className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Matchs</p>
          <h2>Vos correspondances</h2>
          <p className="section-description">Chaque match est généré localement pour la démonstration, puis relié à une conversation simulée.</p>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun match pour l’instant</h3>
          <p>Commencez à liker des profils compatibles pour créer une première connexion locale.</p>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map((match) => {
            const mode = getModeMeta(match.mode);

            return (
              <article key={match.id} className="match-item">
                <Avatar src={match.avatar} alt={`Photo de ${match.name}`} name={match.name} className="match-avatar" />
                <div>
                  <div className="match-heading">
                    <h3>{match.name}</h3>
                    <span className="tag" style={{ '--tag-accent': mode.accent }}>{mode.label}</span>
                  </div>
                  <p>{match.city} · {match.status}</p>
                  <small>{match.lastMessage} · {formatRelativeDate(match.matchedAt)}</small>
                </div>
                <button type="button" className="secondary-button" onClick={() => onOpenMessages(match.profileId)}>
                  Ouvrir la messagerie
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
