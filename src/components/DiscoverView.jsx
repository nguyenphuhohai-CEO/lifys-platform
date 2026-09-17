import Avatar from './Avatar';
import { formatInterests, getModeMeta } from '../lib/appUtils';

export default function DiscoverView({
  modes,
  activeMode,
  searchTerm,
  cityFilter,
  filteredProfiles,
  remainingCount,
  hasUnsavedProfileChanges,
  onModeChange,
  onSearchChange,
  onCityChange,
  onLike,
  onPass,
}) {
  return (
    <section className="content-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Découverte</p>
          <h2>Profils recommandés</h2>
          <p className="section-description">{remainingCount} profil{remainingCount > 1 ? 's' : ''} restant{remainingCount > 1 ? 's' : ''} dans le prototype.</p>
        </div>
        <div className="mode-pills" aria-label="Filtre de mode">
          <button type="button" className={activeMode === 'all' ? 'pill active' : 'pill'} onClick={() => onModeChange('all')}>Tous</button>
          {modes.map((mode) => (
            <button key={mode.id} type="button" className={activeMode === mode.id ? 'pill active' : 'pill'} onClick={() => onModeChange(mode.id)}>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-bar" role="search">
        <label>
          <span>Recherche</span>
          <input type="search" value={searchTerm} onChange={(event) => onSearchChange(event.target.value)} placeholder="Nom, bio ou intérêt" />
        </label>
        <label>
          <span>Ville</span>
          <input type="text" value={cityFilter} onChange={(event) => onCityChange(event.target.value)} placeholder="Paris, Lyon..." />
        </label>
      </div>

      {hasUnsavedProfileChanges ? (
        <div className="inline-notice">
          Sauvegardez votre profil avant de créer de nouveaux matchs afin d’utiliser vos préférences à jour.
        </div>
      ) : null}

      {filteredProfiles.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun profil pour ces filtres</h3>
          <p>Essayez une autre catégorie, élargissez votre recherche ou réinitialisez la démo pour revoir tous les profils.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {filteredProfiles.map((person) => {
            const mode = getModeMeta(person.mode);

            return (
              <article key={person.id} className="profile-card">
                <Avatar src={person.avatar} alt={`Photo de ${person.name}`} name={person.name} className="profile-avatar" />
                <div className="profile-card-body">
                  <div className="identity-row">
                    <div>
                      <h3>{person.name}, {person.age}</h3>
                      <p className="city-line">📍 {person.city}</p>
                    </div>
                    <span className="tag" style={{ '--tag-accent': mode.accent }}>{mode.label}</span>
                  </div>
                  <p>{person.bio}</p>
                  <div className="interest-row">
                    {formatInterests(person.interests).map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
                <div className="card-actions">
                  <button type="button" className="pass-button" onClick={() => onPass(person.id)} aria-label={`Passer le profil de ${person.name}`}>Passer</button>
                  <button
                    type="button"
                    className="like-button"
                    onClick={() => onLike(person.id)}
                    aria-label={`Liker le profil de ${person.name}`}
                    disabled={hasUnsavedProfileChanges}
                  >
                    Like
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
