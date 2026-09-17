export const FALLBACK_AVATAR = 'https://via.placeholder.com/400x400.png?text=Lifys';

export function normalizeInterests(input) {
  const values = Array.isArray(input) ? input : `${input || ''}`.split(',');
  const normalized = values
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);

  return normalized;
}

export function formatInterests(input) {
  return normalizeInterests(input).map((value) => value.charAt(0).toUpperCase() + value.slice(1));
}

export function sanitizeProfile(raw, defaultProfile) {
  if (!raw || typeof raw !== 'object') {
    return defaultProfile;
  }

  return {
    name: typeof raw.name === 'string' ? raw.name : defaultProfile.name,
    age: Number(raw.age) > 0 ? Number(raw.age) : defaultProfile.age,
    city: typeof raw.city === 'string' ? raw.city : defaultProfile.city,
    bio: typeof raw.bio === 'string' ? raw.bio : defaultProfile.bio,
    interests: normalizeInterests(raw.interests),
    mode: typeof raw.mode === 'string' ? raw.mode : defaultProfile.mode,
    avatar: typeof raw.avatar === 'string' ? raw.avatar : defaultProfile.avatar,
  };
}

export function sanitizeMessages(rawMessages, defaultMessages) {
  if (!Array.isArray(rawMessages)) return defaultMessages;

  const cleaned = rawMessages
    .filter((conversation) => conversation && typeof conversation === 'object')
    .map((conversation) => ({
      id: `${conversation.id || `conv-${Date.now()}`}`,
      profileId: `${conversation.profileId || ''}`,
      name: `${conversation.name || 'Contact Lifys'}`,
      mode: `${conversation.mode || 'amical'}`,
      avatar: `${conversation.avatar || FALLBACK_AVATAR}`,
      messages: Array.isArray(conversation.messages)
        ? conversation.messages
            .filter((message) => message && typeof message.text === 'string')
            .map((message, index) => ({
              id: `${message.id || `${conversation.id || 'conv'}-${index}`}`,
              sender: message.sender === 'me' ? 'me' : 'them',
              text: message.text,
            }))
        : [],
    }))
    .filter((conversation) => conversation.id && conversation.name);

  return cleaned.length ? cleaned : defaultMessages;
}

export function filterProfiles({
  profiles,
  likes,
  passed,
  activeMode,
  profileMode,
  searchText,
  cityFilter,
}) {
  const normalizedSearch = searchText.trim().toLowerCase();
  const normalizedCity = cityFilter.trim().toLowerCase();

  return profiles.filter((profileItem) => {
    const isAvailable = !likes.includes(profileItem.id) && !passed.includes(profileItem.id);
    const modeMatch = activeMode === 'all' || profileItem.mode === activeMode;
    const profileModeMatch = profileMode === 'all' || profileItem.mode === profileMode;
    const textMatch =
      !normalizedSearch ||
      profileItem.name.toLowerCase().includes(normalizedSearch) ||
      profileItem.bio.toLowerCase().includes(normalizedSearch) ||
      profileItem.interests.some((interest) => interest.toLowerCase().includes(normalizedSearch));
    const cityMatch = !normalizedCity || profileItem.city.toLowerCase().includes(normalizedCity);

    return isAvailable && modeMatch && profileModeMatch && textMatch && cityMatch;
  });
}

export function shouldCreateMatch(profileTarget, profile) {
  if (!profileTarget || !profile) return false;

  const modeCompatible = profileTarget.mode === (profile.mode || 'amoureux');
  const cityCompatible = profileTarget.city.toLowerCase() === (profile.city || '').toLowerCase();
  const profileInterests = normalizeInterests(profile.interests);
  const interestOverlap = profileInterests.some((interest) =>
    profileTarget.interests.some((targetInterest) => targetInterest.toLowerCase() === interest)
  );

  return modeCompatible || cityCompatible || interestOverlap;
}

export function validateProfile(profileDraft) {
  const errors = {};

  if (!profileDraft.name.trim()) errors.name = 'Le prénom est requis.';
  if (!profileDraft.city.trim()) errors.city = 'La ville est requise.';
  if (!profileDraft.bio.trim()) errors.bio = 'La bio est requise.';

  const age = Number(profileDraft.age);
  if (!age || age < 18 || age > 80) {
    errors.age = 'L’âge doit être compris entre 18 et 80 ans.';
  }

  return errors;
}
