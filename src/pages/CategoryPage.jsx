import { useEffect } from 'react';

import { MODES } from '../data/demoData';
import { getCategoryPath, navigate } from '../utils/routing';

const CATEGORY_CONTENT = {
  amical: {
    headline: 'Rencontrez des personnes avec qui partager de vrais moments.',
    intro: 'Sorties, cafés, sport ou soirées entre amis : trouvez des amitiés sincères près de chez vous.',
    highlights: ['Des profils axés sur les centres d’intérêt', 'Des rencontres sans pression ni ambiguïté', 'Des échanges simples et chaleureux'],
    steps: ['Créez votre profil et vos centres d’intérêt', 'Découvrez des personnes compatibles', 'Discutez puis organisez une première sortie'],
  },
  amoureux: {
    headline: 'Construisez une relation sentimentale qui dure.',
    intro: 'Pour celles et ceux qui cherchent une vraie connexion, avec des profils qui partagent la même intention.',
    highlights: ['Des profils qui cherchent aussi une relation durable', 'Des affinités basées sur vos valeurs', 'Des conversations qui prennent le temps'],
    steps: ['Présentez-vous avec authenticité', 'Likez les profils qui vous parlent', 'Échangez dès qu’un match se crée'],
  },
  'sans-lendemain': {
    headline: 'Des rencontres spontanées, assumées et respectueuses.',
    intro: 'Un espace clair où chacun sait ce qu’il cherche, avec le consentement et le respect au centre.',
    highlights: ['Des intentions annoncées dès le départ', 'Le respect et le consentement avant tout', 'Une discrétion préservée'],
    steps: ['Indiquez vos attentes en toute transparence', 'Découvrez des profils sur la même longueur d’onde', 'Discutez et décidez librement'],
  },
  mariage: {
    headline: 'Rencontrez quelqu’un pour construire un avenir à deux.',
    intro: 'Une approche engagée pour les personnes prêtes à fonder une famille et à s’investir sur le long terme.',
    highlights: ['Des profils avec un projet de vie sérieux', 'Des valeurs et une vision de l’avenir partagées', 'Un cadre bienveillant et sincère'],
    steps: ['Décrivez votre projet de vie', 'Découvrez des profils alignés avec le vôtre', 'Avancez à votre rythme vers une rencontre'],
  },
  professionnel: {
    headline: 'Développez votre réseau avec élégance.',
    intro: 'Entrepreneurs, freelances, salariés : rencontrez des profils qui font avancer vos projets.',
    highlights: ['Des profils par métier et par ambition', 'Des échanges directs et utiles', 'Des opportunités de collaboration'],
    steps: ['Présentez votre activité et vos objectifs', 'Découvrez des profils complémentaires', 'Échangez et lancez des collaborations'],
  },
};

function CategoryPage({ mode }) {
  const content = CATEGORY_CONTENT[mode.id];

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Lifys · ${mode.label}`;
    return () => {
      document.title = previousTitle;
    };
  }, [mode.label]);

  const goToApp = () => navigate(`/?mode=${mode.id}`);

  return (
    <div className="app-shell" style={{ '--mode-accent': mode.accent }}>
      <main className="page-shell category-page">
        <nav className="category-nav" aria-label="Catégories">
          <a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }} className="category-brand">Lifys</a>
          <div className="category-links">
            {MODES.map((item) => (
              <a
                key={item.id}
                href={getCategoryPath(item.id)}
                className={item.id === mode.id ? 'pill active' : 'pill'}
                aria-current={item.id === mode.id ? 'page' : undefined}
                onClick={(event) => { event.preventDefault(); navigate(getCategoryPath(item.id)); }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        <section className="hero-panel category-hero">
          <div className="hero-copy">
            <p className="eyebrow">{mode.icon} {mode.label}</p>
            <h1>{content.headline}</h1>
            <p>{content.intro}</p>
            <div className="category-actions">
              <button type="button" className="primary-button" onClick={goToApp}>Rejoindre {mode.label}</button>
              <button type="button" className="secondary-button" onClick={() => navigate('/')}>Découvrir Lifys</button>
            </div>
          </div>
        </section>

        <section className="content-panel category-section">
          <h2>Pourquoi {mode.label} sur Lifys ?</h2>
          <ul className="category-list">
            {content.highlights.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="content-panel category-section">
          <h2>Comment ça marche</h2>
          <ol className="category-list">
            {content.steps.map((item) => <li key={item}>{item}</li>)}
          </ol>
          <button type="button" className="primary-button" onClick={goToApp}>Commencer maintenant</button>
        </section>
      </main>
    </div>
  );
}

export default CategoryPage;
