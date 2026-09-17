import AvatarImage from './AvatarImage';
import { MODES } from '../constants';

function MatchesView({ matches, onOpenConversation }) {
  return (
    <section className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Matchs</p>
          <h2>Vos correspondances</h2>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun match pour l’instant</h3>
          <p>Commencez à liker des profils compatibles pour créer une première connexion.</p>
        </div>
      ) : (
        <div className="matches-list">
          {matches.map((match) => (
            <article key={match.id} className="match-item">
              <AvatarImage src={match.avatar} alt={`Photo de ${match.name}`} />
              <div>
                <h3>{match.name}</h3>
                <p>
                  {match.city} · {MODES.find((mode) => mode.id === match.mode)?.label}
                </p>
                <small>
                  {match.status} · {new Date(match.matchedAt).toLocaleDateString('fr-FR')}
                </small>
              </div>
              <button className="secondary-button" onClick={() => onOpenConversation(match)} type="button">
                Ouvrir la messagerie
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default MatchesView;
