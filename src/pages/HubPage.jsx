import { useEffect } from 'react';

import SiteFooter from '../components/SiteFooter';
import { MODES } from '../data/demoData';
import { CATEGORY_CONTENT, getSite } from '../data/sites';
import { useI18n } from '../i18n';
import { getCategoryPath, navigate } from '../utils/routing';

function HubPage() {
  const { t } = useI18n();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Lifys';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="app-shell" data-site="hub">
      <main className="page-shell">
        <section className="hero-panel category-hero">
          <div className="hero-copy">
            <p className="eyebrow">Lifys</p>
            <h1>{t('Cinq sites de rencontre, une seule intention à la fois.')}</h1>
            <p>{t('Chaque site Lifys a son propre univers et ses propres membres, avec un seul compte pour tous : choisissez celui qui correspond à ce que vous cherchez.')}</p>
          </div>
        </section>

        <section className="site-grid" aria-label={t('Les sites Lifys')}>
          {MODES.map((mode) => {
            const site = getSite(mode.id);
            return (
              <a
                key={mode.id}
                href={getCategoryPath(mode.id)}
                className="site-card"
                data-site={mode.id}
                onClick={(event) => { event.preventDefault(); navigate(getCategoryPath(mode.id)); }}
              >
                <span className="site-card-icon">{site.icon}</span>
                <strong>{site.brand}</strong>
                <p>{t(CATEGORY_CONTENT[mode.id].intro)}</p>
                <span className="site-card-cta">{t('Rejoindre {mode}', { mode: site.brand })} →</span>
              </a>
            );
          })}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default HubPage;
