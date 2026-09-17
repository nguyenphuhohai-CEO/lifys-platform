import AvatarImage from './AvatarImage';
import { MODES } from '../constants';

function DiscoverView({
  activeMode,
  setActiveMode,
  searchTerm,
  setSearchTerm,
  cityFilter,
  setCityFilter,
  filteredProfiles,
  remainingCount,
  onLike,
  onPass,
}) {
  return (
    <section className="content-panel">
      <div className="panel-header panel-header-wrap">
        <div>
          <p className="eyebrow">Découverte</p>
          <h2>Profils recommandés</h2>
          <p className="panel-meta">{remainingCount} profils restants pour ce filtre</p>
        </div>
        <div className="mode-pills" aria-label="Filtre de mode">
          <button
            type="button"
            className={activeMode === 'all' ? 'pill active' : 'pill'}
            onClick={() => setActiveMode('all')}
          >
            Tous
          </button>
          {MODES.map((mode) => (
            <button
              type="button"
              key={mode.id}
              className={activeMode === mode.id ? 'pill active' : 'pill'}
              onClick={() => setActiveMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filters-grid" aria-label="Filtres complémentaires">
        <label>
          <span>Recherche</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Nom, bio ou intérêt"
          />
        </label>
        <label>
          <span>Ville</span>
          <input
            type="text"
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            placeholder="Paris"
          />
        </label>
      </div>

      {filteredProfiles.length === 0 ? (
        <div className="empty-state">
          <h3>Plus de profils pour le moment</h3>
          <p>Essayez une autre catégorie ou élargissez vos filtres de recherche.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {filteredProfiles.slice(0, 4).map((person) => (
            <article key={person.id} className="profile-card">
              <AvatarImage src={person.avatar} alt={`Photo de ${person.name}`} />
              <div className="profile-card-body">
                <div className="identity-row">
                  <h3>
                    {person.name}, {person.age}
                  </h3>
                  <span className="tag">{MODES.find((mode) => mode.id === person.mode)?.label}</span>
                </div>
                <p className="city-line">📍 {person.city}</p>
                <p>{person.bio}</p>
                <div className="interest-row">
                  {person.interests.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              <div className="card-actions">
                <button className="pass-button" onClick={() => onPass(person.id)} type="button">
                  Passer
                </button>
                <button className="like-button" onClick={() => onLike(person.id)} type="button">
                  Liker
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default DiscoverView;
