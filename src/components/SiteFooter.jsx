import React from 'react';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} Lifys</span>
      <nav aria-label="Informations légales">
        <a href="/cgu">CGU</a>
        <a href="/confidentialite">Confidentialité</a>
        <a href="/mentions-legales">Mentions légales</a>
      </nav>
    </footer>
  );
}
