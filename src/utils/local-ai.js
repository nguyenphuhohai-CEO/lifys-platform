import { getModeById, normalizeInterests } from './app-utils';

function hasLongBio(profile) {
  return `${profile?.bio ?? ''}`.trim().length >= 80;
}

function hasEnoughInterests(profile) {
  return normalizeInterests(profile?.interests).length >= 3;
}

export function buildProfileHealth(profile = {}) {
  const checks = [
    Boolean(`${profile.name ?? ''}`.trim()),
    Boolean(profile.age),
    Boolean(`${profile.city ?? ''}`.trim()),
    hasLongBio(profile),
    hasEnoughInterests(profile),
  ];

  const completed = checks.filter(Boolean).length;
  return {
    score: Math.round((completed / checks.length) * 100),
    completed,
    total: checks.length,
  };
}

export function buildLocalCoachInsights({
  currentUser = null,
  profile = {},
  profiles = [],
  matches = [],
  conversations = [],
  appEnvironment = {},
} = {}) {
  const insights = [];
  const profileHealth = buildProfileHealth(profile);
  const firstConversation = conversations.find((conversation) => conversation.messages.length > 0);
  const hasUnreadOpportunity = conversations.some((conversation) => {
    const lastMessage = conversation.messages.at(-1);
    return lastMessage && lastMessage.sender === 'them';
  });

  if (!currentUser?.emailVerified) {
    insights.push({
      id: 'email-verification',
      tone: 'warning',
      title: 'Vérifiez votre adresse e-mail',
      message: 'Confirmez votre e-mail pour sécuriser la récupération du compte et fiabiliser vos prochaines étapes produit.',
      actionLabel: 'Ouvrir le profil',
      actionView: 'profile',
    });
  }

  if (profileHealth.score < 100) {
    insights.push({
      id: 'profile-quality',
      tone: 'info',
      title: 'Renforcez votre profil',
      message: `Votre profil est complété à ${profileHealth.score}%. Une bio plus détaillée et au moins 3 centres d’intérêt améliorent la qualité de découverte.`,
      actionLabel: 'Compléter le profil',
      actionView: 'profile',
    });
  }

  if (profiles.length === 0) {
    insights.push({
      id: 'discovery-filters',
      tone: 'info',
      title: 'Élargissez la découverte',
      message: 'Aucun profil ne remonte avec les filtres actuels. Revenez sur toutes les catégories ou retirez le filtre ville.',
      actionLabel: 'Voir la découverte',
      actionView: 'discover',
    });
  } else if (profiles.length <= 2) {
    insights.push({
      id: 'discovery-available',
      tone: 'info',
      title: 'Peu de profils disponibles',
      message: `Seulement ${profiles.length} profil${profiles.length > 1 ? 's' : ''} disponible${profiles.length > 1 ? 's' : ''} actuellement. Alternez les catégories pour générer plus d’opportunités.`,
      actionLabel: 'Parcourir',
      actionView: 'discover',
    });
  }

  if (matches.length === 0) {
    insights.push({
      id: 'matching',
      tone: 'success',
      title: 'Activez vos premiers matchs',
      message: `Ciblez en priorité la catégorie ${getModeById(profile.mode || 'amoureux').label.toLowerCase()} et likez les profils avec ville ou intérêts communs.`,
      actionLabel: 'Trouver des profils',
      actionView: 'discover',
    });
  } else if (!firstConversation) {
    insights.push({
      id: 'start-conversation',
      tone: 'success',
      title: 'Transformez les matchs en conversations',
      message: `Vous avez ${matches.length} match${matches.length > 1 ? 's' : ''}. Ouvrez la messagerie et envoyez un premier message contextualisé.`,
      actionLabel: 'Ouvrir les messages',
      actionView: 'messages',
    });
  } else if (hasUnreadOpportunity) {
    insights.push({
      id: 'reply-opportunity',
      tone: 'success',
      title: 'Relancez une conversation chaude',
      message: 'Au moins une conversation se termine par un message reçu. Une réponse rapide améliore le taux de continuité du prototype.',
      actionLabel: 'Répondre',
      actionView: 'messages',
    });
  }

  if (appEnvironment.demoDiscoveryEnabled) {
    insights.push({
      id: 'demo-discovery',
      tone: 'warning',
      title: 'Mode démo actif',
      message: 'Les profils de découverte peuvent encore être fictifs dans cet environnement. Gardez une communication claire sur cette limite produit.',
      actionLabel: 'Voir l’accueil',
      actionView: 'home',
    });
  }

  return {
    summary: insights[0] ?? {
      id: 'healthy-state',
      tone: 'success',
      title: 'Base produit cohérente',
      message: 'Le profil, la découverte, les matchs et les messages sont alignés. Vous pouvez passer aux optimisations produit et à la modération.',
      actionLabel: 'Voir les matchs',
      actionView: 'matches',
    },
    insights: insights.slice(0, 4),
    profileHealth,
  };
}
