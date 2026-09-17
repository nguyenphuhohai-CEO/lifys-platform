import { DEFAULT_MESSAGES, MODES, defaultProfile } from '../data/demo.js';

const modeIds = new Set(MODES.map((mode) => mode.id));

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function titleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeInterests(value) {
  const source = Array.isArray(value) ? value : `${value || ''}`.split(',');
  return [...new Set(
    source
      .map((item) => `${item}`.trim().toLowerCase())
      .filter(Boolean)
  )];
}

export function formatInterests(value) {
  return normalizeInterests(value).map(titleCase);
}

export function sanitizeStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim()))];
}

export function sanitizeProfile(value) {
  const nextProfile = value && typeof value === 'object' ? value : {};
  const age = Number(nextProfile.age);
  const mode = modeIds.has(nextProfile.mode) ? nextProfile.mode : defaultProfile.mode;

  return {
    ...defaultProfile,
    name: cleanText(nextProfile.name),
    age: Number.isFinite(age) && age >= 18 && age <= 80 ? Math.round(age) : defaultProfile.age,
    city: cleanText(nextProfile.city),
    bio: cleanText(nextProfile.bio),
    interests: normalizeInterests(nextProfile.interests).join(', '),
    mode,
    avatar: cleanText(nextProfile.avatar),
  };
}

export function validateProfileInput(value) {
  const profile = sanitizeProfile(value);
  const errors = {};

  if (!profile.name) {
    errors.name = 'Ajoutez votre prénom ou pseudo pour personnaliser le prototype.';
  }

  if (!profile.city) {
    errors.city = 'Indiquez une ville pour améliorer la découverte locale.';
  }

  if (!profile.bio || profile.bio.length < 24) {
    errors.bio = 'Ajoutez une bio d’au moins 24 caractères pour rendre votre profil crédible.';
  }

  if (!Number.isFinite(Number(value.age)) || Number(value.age) < 18 || Number(value.age) > 80) {
    errors.age = 'Choisissez un âge compris entre 18 et 80 ans.';
  }

  if (profile.avatar) {
    try {
      const avatarUrl = new URL(profile.avatar);
      if (!['http:', 'https:'].includes(avatarUrl.protocol)) {
        errors.avatar = 'Utilisez une URL d’avatar HTTP ou HTTPS valide.';
      }
    } catch {
      errors.avatar = 'Utilisez une URL d’avatar valide ou laissez ce champ vide.';
    }
  }

  return { profile, errors };
}

export function matchesSearch(profile, query) {
  if (!query) {
    return true;
  }

  const haystack = [profile.name, profile.city, profile.bio, ...profile.interests]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export function filterProfiles(profiles, options) {
  const {
    activeMode = 'all',
    likedIds = [],
    passedIds = [],
    profileMode = defaultProfile.mode,
    searchTerm = '',
    cityTerm = '',
  } = options;

  const liked = new Set(likedIds);
  const passed = new Set(passedIds);
  const normalizedCity = cityTerm.trim().toLowerCase();

  return profiles.filter((profileItem) => {
    if (liked.has(profileItem.id) || passed.has(profileItem.id)) {
      return false;
    }

    if (activeMode !== 'all' && profileItem.mode !== activeMode) {
      return false;
    }

    if (profileMode !== 'amoureux' && profileItem.mode !== profileMode) {
      return false;
    }

    if (normalizedCity && profileItem.city.toLowerCase() !== normalizedCity) {
      return false;
    }

    return matchesSearch(profileItem, searchTerm);
  });
}

export function shouldCreateMatch(profileTarget, profile) {
  if (!profileTarget) {
    return false;
  }

  const profileMode = cleanText(profile.mode) || defaultProfile.mode;
  const profileCity = cleanText(profile.city).toLowerCase();
  const interestOverlap = normalizeInterests(profile.interests)
    .some((value) => profileTarget.interests.some((interest) => interest.toLowerCase() === value));

  return (
    profileTarget.mode === profileMode ||
    (profileCity && profileTarget.city.toLowerCase() === profileCity) ||
    interestOverlap
  );
}

export function sanitizeMatches(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === 'object' && typeof item.profileId === 'string' && typeof item.name === 'string')
    .map((item) => ({
      id: cleanText(item.id) || `match-${item.profileId}`,
      profileId: item.profileId,
      name: cleanText(item.name),
      city: cleanText(item.city),
      mode: modeIds.has(item.mode) ? item.mode : defaultProfile.mode,
      avatar: cleanText(item.avatar),
      lastMessage: cleanText(item.lastMessage) || 'Connexion enregistrée localement',
    }));
}

export function sanitizeMessages(value) {
  const source = Array.isArray(value) ? value : DEFAULT_MESSAGES;
  const sanitized = source
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string')
    .map((item, index) => ({
      id: item.id,
      profileId: cleanText(item.profileId) || `profile-${index}`,
      name: cleanText(item.name),
      city: cleanText(item.city),
      mode: modeIds.has(item.mode) ? item.mode : defaultProfile.mode,
      avatar: cleanText(item.avatar),
      messages: Array.isArray(item.messages)
        ? item.messages
            .filter((message) => message && typeof message === 'object' && typeof message.text === 'string')
            .map((message, messageIndex) => ({
              id: cleanText(message.id) || `message-${index}-${messageIndex}`,
              sender: message.sender === 'me' ? 'me' : 'them',
              text: cleanText(message.text),
            }))
            .filter((message) => message.text)
        : [],
    }))
    .filter((item) => item.name && item.messages.length > 0);

  return sanitized.length > 0 ? sanitized : DEFAULT_MESSAGES;
}

export function createConversation(profileTarget) {
  return {
    id: `conv-${profileTarget.id}`,
    profileId: profileTarget.id,
    name: profileTarget.name,
    city: profileTarget.city,
    mode: profileTarget.mode,
    avatar: profileTarget.avatar,
    messages: [
      {
        id: `intro-${profileTarget.id}`,
        sender: 'them',
        text: 'Bonjour, je serais ravi d’échanger avec toi sur Lifys.',
      },
    ],
  };
}

export function getModeLabel(modeId) {
  return MODES.find((mode) => mode.id === modeId)?.label || 'Amoureux';
}

export function getModeDescription(modeId) {
  return MODES.find((mode) => mode.id === modeId)?.description || MODES[1].description;
}

export function getConversationPreview(conversation) {
  return conversation?.messages?.[conversation.messages.length - 1]?.text || 'Aucun message pour le moment';
}
