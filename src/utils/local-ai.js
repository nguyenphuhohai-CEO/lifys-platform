import { getModeById, normalizeInterests, sanitizeString } from './app-utils.js';

function rankProfiles(profiles, profile) {
  const userInterests = normalizeInterests(profile?.interests);

  return profiles
    .map((candidate, index) => {
      const sharedInterests = normalizeInterests(candidate.interests)
        .filter((interest) => userInterests.includes(interest));
      const sameMode = Boolean(profile?.mode && candidate.mode === profile.mode);
      const sameCity = Boolean(profile?.city)
        && sanitizeString(candidate.city).toLocaleLowerCase('fr') === sanitizeString(profile.city).toLocaleLowerCase('fr');

      return {
        candidate,
        index,
        score: sharedInterests.length * 3 + Number(sameMode) * 2 + Number(sameCity),
        reasons: [
          ...sharedInterests.map((interest) => `votre intérêt commun pour ${interest}`),
          ...(sameMode ? [`votre recherche ${getModeById(candidate.mode).label.toLowerCase()}`] : []),
          ...(sameCity ? [`votre ville, ${candidate.city}`] : []),
        ],
      };
    })
    .filter((result) => result.score > 0)
    .sort((first, second) => second.score - first.score || first.index - second.index);
}

export function answerLocalPrompt(prompt, { profile, profiles = [] } = {}) {
  const question = sanitizeString(prompt)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

  if (!question) {
    return 'Écrivez une question sur votre profil, vos affinités ou une première conversation.';
  }

  if (/\b(matchs?|rencontres?|compatib\w*|affinit\w*|recommand\w*|correspond\w*|qui pourrait)\b/u.test(question)) {
    const recommendations = rankProfiles(profiles, profile).slice(0, 2);

    if (!recommendations.length) {
      return 'Je n’ai pas encore assez d’affinités à comparer. Complétez vos centres d’intérêt et explorez les profils disponibles.';
    }

    return `Selon les informations de votre profil, ${recommendations.map(({ candidate, reasons }) => (
      `${candidate.name} (${reasons.join(', ')})`
    )).join(' ; ')}. Ce sont des pistes, pas une garantie de compatibilité.`;
  }

  if (/\b(message|aborder|conversation|discuter|ecrire|premier contact)\b/u.test(question)) {
    const [recommendation] = rankProfiles(profiles, profile);
    if (!recommendation) {
      return 'Parcourez d’abord les profils disponibles, puis appuyez-vous sur un détail de leur bio ou un intérêt commun pour démarrer naturellement.';
    }

    const { candidate, reasons } = recommendation;
    const topic = normalizeInterests(candidate.interests)
      .find((interest) => normalizeInterests(profile?.interests).includes(interest));
    const opener = topic
      ? `Bonjour ${candidate.name} ! J’ai vu que nous aimons tous les deux ${topic}. Qu’est-ce qui vous plaît le plus dans cette activité ?`
      : `Bonjour ${candidate.name} ! J’ai découvert votre profil et j’aimerais en savoir plus sur ce qui vous passionne.`;

    return `Pour ${candidate.name}, vous pouvez partir de ${reasons[0]}. Par exemple : « ${opener} »`;
  }

  if (/\b(profil|bio|description|presenter|presentation)\b/u.test(question)) {
    const interests = normalizeInterests(profile?.interests);
    const name = sanitizeString(profile?.name);
    const city = sanitizeString(profile?.city);

    if (!interests.length && !sanitizeString(profile?.bio)) {
      return 'Ajoutez une bio et quelques centres d’intérêt à votre profil ; je pourrai ensuite vous proposer des pistes plus personnalisées.';
    }

    const detail = interests.length
      ? `Mettez en avant ${interests.slice(0, 3).join(', ')}`
      : 'Ajoutez un exemple concret qui illustre votre personnalité';
    const location = city ? ` et précisez ce que vous aimez à ${city}` : '';

    return `${name ? `${name}, ` : ''}${detail}${location}. Une bio personnelle et précise aide à engager une conversation.`;
  }

  return 'Je peux vous aider à améliorer votre profil, repérer des affinités ou trouver une idée de premier message. Vos questions sont traitées localement dans cette page.';
}
