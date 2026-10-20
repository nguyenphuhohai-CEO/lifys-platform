// Chaque catégorie est un site à part entière : sa marque, son vocabulaire, son thème et ses comptes.
export const SITES = {
  amical: {
    brand: 'Lifys Amis',
    icon: '🤝',
    tagline: 'Se faire des amis près de chez soi',
    inspiredBy: 'Façon Bumble BFF',
    nav: { discover: 'Rencontrer', matches: 'Amis' },
  },
  amoureux: {
    brand: 'Lifys Love',
    icon: '❤',
    tagline: 'Trouver l’amour, durablement',
    inspiredBy: 'Façon Meetic',
    nav: {},
  },
  'sans-lendemain': {
    brand: 'Lifys Éphémère',
    icon: '🔥',
    tagline: 'Des rencontres spontanées et assumées',
    inspiredBy: 'Façon Tinder',
    nav: { discover: 'Explorer' },
  },
  mariage: {
    brand: 'Lifys Mariage',
    icon: '💍',
    tagline: 'Construire un avenir à deux',
    inspiredBy: 'Façon Jdate / Shaadi',
    nav: { discover: 'Rencontres', matches: 'Compatibilités' },
  },
  professionnel: {
    brand: 'Lifys Pro',
    icon: '💼',
    tagline: 'Le réseau professionnel qui vous ressemble',
    inspiredBy: 'Façon LinkedIn',
    nav: { home: 'Fil d’actualité', discover: 'Réseau', matches: 'Connexions' },
  },
};

export function getSite(siteId) {
  return SITES[siteId] ?? SITES.amoureux;
}

export const CATEGORY_CONTENT = {
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
