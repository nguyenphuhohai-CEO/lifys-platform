import { MODES, defaultProfile } from '../data/demoData';

export function normalizeInterests(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => item?.toString().trim().toLowerCase())
      .filter(Boolean);
  }

  return value
    ?.toString()
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) || [];
}

export function formatInterests(value) {
  return normalizeInterests(value).map((item) => item.charAt(0).toUpperCase() + item.slice(1));
}

export function getModeMeta(modeId) {
  return MODES.find((mode) => mode.id === modeId) || MODES[1];
}

export function validateProfile(profile) {
  const errors = {};

  if (!profile.name.trim()) {
    errors.name = 'Ajoutez votre prénom.';
  }

  const age = Number(profile.age);
  if (!Number.isInteger(age) || age < 18 || age > 80) {
    errors.age = 'Indiquez un âge compris entre 18 et 80 ans.';
  }

  if (!profile.city.trim()) {
    errors.city = 'Ajoutez votre ville.';
  }

  if (!profile.bio.trim()) {
    errors.bio = 'Ajoutez une courte bio.';
  }

  if (normalizeInterests(profile.interests).length === 0) {
    errors.interests = 'Ajoutez au moins un centre d’intérêt.';
  }

  return errors;
}

export function sanitizeProfile(profile) {
  return {
    name: profile.name.trim(),
    age: Number(profile.age),
    city: profile.city.trim(),
    bio: profile.bio.trim(),
    interests: formatInterests(profile.interests).join(', '),
    mode: profile.mode || defaultProfile.mode,
    avatar: profile.avatar.trim(),
  };
}

export function filterProfiles(profiles, { activeMode, likes, passed, profileMode, searchTerm, cityFilter }) {
  const query = searchTerm.trim().toLowerCase();
  const cityQuery = cityFilter.trim().toLowerCase();

  return profiles.filter((profileItem) => {
    if (likes.includes(profileItem.id) || passed.includes(profileItem.id)) {
      return false;
    }

    if (activeMode !== 'all' && profileItem.mode !== activeMode) {
      return false;
    }

    if (profileMode && profileMode !== 'all' && profileItem.mode !== profileMode) {
      return false;
    }

    if (cityQuery && !profileItem.city.toLowerCase().includes(cityQuery)) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchContent = [
      profileItem.name,
      profileItem.city,
      profileItem.bio,
      ...profileItem.interests,
    ]
      .join(' ')
      .toLowerCase();

    return searchContent.includes(query);
  });
}

export function isCompatibleMatch(currentProfile, profileTarget) {
  const currentInterests = normalizeInterests(currentProfile.interests);
  const targetInterests = normalizeInterests(profileTarget.interests);

  return (
    profileTarget.mode === currentProfile.mode ||
    profileTarget.city.toLowerCase() === currentProfile.city.trim().toLowerCase() ||
    currentInterests.some((interest) => targetInterests.includes(interest))
  );
}

export function createMatch(profileTarget) {
  return {
    id: `match-${profileTarget.id}`,
    profileId: profileTarget.id,
    name: profileTarget.name,
    city: profileTarget.city,
    mode: profileTarget.mode,
    avatar: profileTarget.avatar,
    status: 'Nouveau match',
    matchedAt: new Date().toISOString(),
    lastMessage: 'Connexion créée localement dans le prototype.',
  };
}

export function createConversation(profileTarget) {
  const createdAt = new Date().toISOString();

  return {
    id: `conv-${profileTarget.id}`,
    profileId: profileTarget.id,
    name: profileTarget.name,
    mode: profileTarget.mode,
    avatar: profileTarget.avatar,
    status: 'Conversation locale',
    updatedAt: createdAt,
    messages: [
      {
        id: `intro-${profileTarget.id}`,
        sender: 'them',
        text: `Bonjour, je suis ravi·e de faire votre connaissance sur Lifys.`,
        createdAt,
      },
    ],
  };
}

export function formatRelativeDate(value) {
  if (!value) {
    return 'À l’instant';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value));
}

export function isNonEmptyObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function isValidProfileShape(value) {
  return (
    isNonEmptyObject(value) &&
    typeof value.name === 'string' &&
    ['string', 'number'].includes(typeof value.age) &&
    typeof value.city === 'string' &&
    typeof value.bio === 'string' &&
    typeof value.interests === 'string' &&
    typeof value.avatar === 'string' &&
    typeof value.mode === 'string'
  );
}

export function isValidMatchList(value) {
  return Array.isArray(value) && value.every((item) => isNonEmptyObject(item) && typeof item.id === 'string' && typeof item.profileId === 'string');
}

export function isValidMessageList(value) {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isNonEmptyObject(item) &&
        typeof item.id === 'string' &&
        typeof item.profileId === 'string' &&
        typeof item.name === 'string' &&
        Array.isArray(item.messages),
    )
  );
}
