import { NAV_ITEMS } from '../data/demoData';

export default function Header({ view, onViewChange, isMobileNavOpen, onToggleMobileNav }) {
  return (
    <header className="topbar">
      <button type="button" className="brand-block brand-button" onClick={() => onViewChange('home')}>
        <span className="brand-icon" aria-hidden="true">❤</span>
        <span>
          <strong>Lifys</strong>
          <small>Démo locale premium</small>
        </span>
      </button>

      <button
        type="button"
        className="mobile-nav-toggle"
        onClick={onToggleMobileNav}
        aria-expanded={isMobileNavOpen}
        aria-controls="lifys-main-nav"
      >
        Menu
      </button>

      <nav
        id="lifys-main-nav"
        className={isMobileNavOpen ? 'nav nav-open' : 'nav'}
        aria-label="Navigation principale"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={view === item.id ? 'nav-button active' : 'nav-button'}
            aria-pressed={view === item.id}
            onClick={() => onViewChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
