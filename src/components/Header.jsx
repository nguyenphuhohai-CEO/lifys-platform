import { useState } from 'react';
import { NAV_ITEMS } from '../constants';

function Header({ view, setView, onResetPrototype }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (target) => {
    setView(target);
    setMenuOpen(false);
  };

  return (
    <header className="topbar">
      <button className="brand-block" onClick={() => navigate('home')} type="button">
        <span className="brand-icon">❤</span>
        <span>
          <strong>Lifys</strong>
          <small>Rencontres qui comptent</small>
        </span>
      </button>

      <button
        type="button"
        className="menu-button"
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        onClick={() => setMenuOpen((current) => !current)}
      >
        Menu
      </button>

      <nav id="main-nav" className={`nav ${menuOpen ? 'open' : ''}`} aria-label="Navigation principale">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? 'nav-button active' : 'nav-button'}
            onClick={() => navigate(item.id)}
            type="button"
            aria-current={view === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <button type="button" className="secondary-button reset-button" onClick={onResetPrototype}>
        Réinitialiser le prototype
      </button>
    </header>
  );
}

export default Header;
