import Avatar from './Avatar';
import { MODES } from '../data/demo';
import { getModeLabel } from '../lib/app-utils';

export default function DiscoverView({
  activeMode,
  availableCities,
  cityFilter,
  filteredProfiles,
  onChangeCity,
  onChangeSearch,
  onLike,
  onPass,
  onSelectMode,
  searchTerm,
  totalCount,
}) {
  return (
    <section className="content-panel">
      <div className="panel-header panel-header-stack">
        <div>
          <p className="eyebrow">Découverte</p>
          <h2>Profils recommandés</h2>
          <p className="panel-subtitle">{filteredProfiles.length} profil(s) visibles sur {totalCount} profils fictifs.</p>
        </div>

        <div className="filters-stack">
          <div className="mode-pills" aria-label="Filtre de catégorie">
            <button type="button" className={activeMode === 'all' ? 'pill active' : 'pill'} aria-pressed={activeMode === 'all'} onClick={() => onSelectMode('all')}>Tous</button>
            {MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={activeMode === mode.id ? 'pill active' : 'pill'}
                aria-pressed={activeMode === mode.id}
                onClick={() => onSelectMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>

          <div className="search-row">
            <label className="field-inline">
              <span className="sr-only">Recherche texte</span>
              <input
                type="search"
                value={searchTerm}
                placeholder="Rechercher un nom, intérêt ou bio"
                onChange={(event) => onChangeSearch(event.target.value)}
              />
            </label>
            <label className="field-inline">
              <span className="sr-only">Ville</span>
              <select value={cityFilter} onChange={(event) => onChangeCity(event.target.value)}>
                <option value="">Toutes les villes</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {filteredProfiles.length === 0 ? (
        <div className="empty-state">
          <h3>Aucun profil sur ces critères</h3>
          <p>Essayez une autre catégorie, une autre ville, ou videz la recherche pour retrouver les profils de démonstration.</p>
        </div>
      ) : (
        <div className="discover-grid">
          {filteredProfiles.map((person) => (
            <article key={person.id} className="profile-card">
              <Avatar src={person.avatar} name={person.name} className="profile-avatar" />
              <div className="profile-card-body">
                <div className="identity-row">
                  <div>
                    <h3>{person.name}, {person.age}</h3>
                    <p className="city-line">📍 {person.city}</p>
                  </div>
                  <span className="tag">{getModeLabel(person.mode)}</span>
                </div>
                <p className="card-bio">{person.bio}</p>
                <div className="interest-row" aria-label={`Centres d’intérêt de ${person.name}`}>
                  {person.interests.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
              <div className="card-actions">
                <button type="button" className="pass-button" onClick={() => onPass(person.id)} aria-label={`Passer le profil de ${person.name}`}>
                  Pass
                </button>
                <button type="button" className="like-button" onClick={() => onLike(person.id)} aria-label={`Aimer le profil de ${person.name}`}>
                  Like
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
