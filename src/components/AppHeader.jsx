import { NAV_ITEMS } from '../data/demo';

export default function AppHeader({ matchCount, onNavigate, view, mobileNavOpen, onToggleMobileNav }) {
  return (
    <header className="topbar">
      <button type="button" className="brand-button" onClick={() => onNavigate('home')}>
        <span className="brand-icon">❤</span>
        <span>
          <strong>Lifys</strong>
          <small>Prototype premium de démonstration</small>
        </span>
      </button>

      <div className="header-actions">
        <p className="prototype-badge">Données locales simulées · aucun backend réel</p>
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleMobileNav}
          aria-expanded={mobileNavOpen}
          aria-controls="primary-navigation"
        >
          {mobileNavOpen ? 'Fermer' : 'Menu'}
        </button>
      </div>

      <nav
        id="primary-navigation"
        className={mobileNavOpen ? 'nav nav-open' : 'nav'}
        aria-label="Navigation principale"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'nav-button active' : 'nav-button'}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
            {item.id === 'matches' && matchCount > 0 ? <span className="nav-count">{matchCount}</span> : null}
          </button>
        ))}
      </nav>
    </header>
  );
}
