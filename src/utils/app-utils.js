import { defaultProfile, DEMO_PROFILES, DEFAULT_MESSAGES, MODES } from '../data/demoData.js';

export function sanitizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function clampAge(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 18 || numericValue > 80) {
    return '';
  }

  return numericValue;
}

export function normalizeInterests(value) {
  const rawValues = Array.isArray(value) ? value : `${value ?? ''}`.split(',');

  return [...new Set(
    rawValues
      .map((item) => sanitizeString(item).toLowerCase())
      .filter(Boolean),
  )];
}

export function serializeInterests(value) {
  return normalizeInterests(value)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(', ');
}

export function sanitizeProfile(value) {
  if (!value || typeof value !== 'object') {
    return { ...defaultProfile };
  }

  const modeExists = MODES.some((mode) => mode.id === value.mode);

  return {
    name: sanitizeString(value.name),
    age: clampAge(value.age),
    city: sanitizeString(value.city),
    bio: sanitizeString(value.bio),
    interests: serializeInterests(value.interests),
    mode: modeExists ? value.mode : defaultProfile.mode,
    avatar: sanitizeString(value.avatar),
  };
}

export function sanitizeIdList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => typeof item === 'string' && item))];
}

export function sanitizeMatch(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const profileId = sanitizeString(value.profileId);
  const mode = MODES.some((item) => item.id === value.mode) ? value.mode : defaultProfile.mode;

  if (!profileId) {
    return null;
  }

  return {
    id: sanitizeString(value.id, `match-${profileId}`),
    profileId,
    name: sanitizeString(value.name, 'Profil'),
    city: sanitizeString(value.city, 'Ville non précisée'),
    mode,
    avatar: sanitizeString(value.avatar),
    lastMessage: sanitizeString(value.lastMessage, 'Nouveau match local'),
    reason: sanitizeString(value.reason, 'Affinité locale détectée'),
  };
}

export function sanitizeMessage(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const sender = value.sender === 'me' ? 'me' : 'them';
  const text = sanitizeString(value.text);

  if (!text) {
    return null;
  }

  return {
    id: sanitizeString(value.id, `msg-${Date.now()}`),
    sender,
    text,
  };
}

export function sanitizeConversation(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const profileId = sanitizeString(value.profileId);
  const messages = Array.isArray(value.messages) ? value.messages.map(sanitizeMessage).filter(Boolean) : [];

  if (!profileId) {
    return null;
  }

  return {
    id: sanitizeString(value.id, `conv-${profileId}`),
    profileId,
    name: sanitizeString(value.name, 'Conversation locale'),
    mode: MODES.some((item) => item.id === value.mode) ? value.mode : defaultProfile.mode,
    avatar: sanitizeString(value.avatar),
    messages: messages.length ? messages : [{ id: `seed-${profileId}`, sender: 'them', text: 'Conversation locale prête à démarrer.' }],
  };
}

export function sanitizeMatches(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(sanitizeMatch).filter(Boolean);
}

export function sanitizeConversations(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_MESSAGES.map(sanitizeConversation).filter(Boolean);
  }

  const conversations = value.map(sanitizeConversation).filter(Boolean);
  return conversations.length ? conversations : DEFAULT_MESSAGES.map(sanitizeConversation).filter(Boolean);
}

export function getModeById(modeId) {
  return MODES.find((mode) => mode.id === modeId) ?? MODES[1];
}

export function buildMatchReason(profileTarget, profile) {
  const profileInterests = normalizeInterests(profile?.interests);
  const targetInterests = normalizeInterests(profileTarget?.interests);

  if (profileTarget?.mode === profile?.mode) {
    return `Vous recherchez tous les deux une rencontre ${getModeById(profileTarget.mode).label.toLowerCase()}.`;
  }

  if (sanitizeString(profileTarget?.city).toLowerCase() === sanitizeString(profile?.city).toLowerCase()) {
    return `Même ville : ${profileTarget.city}.`;
  }

  const sharedInterest = targetInterests.find((interest) => profileInterests.includes(interest));
  if (sharedInterest) {
    return `Point commun : ${sharedInterest}.`;
  }

  return 'Affinité locale détectée sur le prototype.';
}

export function shouldCreateMatch(profileTarget, profile) {
  const profileInterests = normalizeInterests(profile?.interests);
  const targetInterests = normalizeInterests(profileTarget?.interests);

  return (
    profileTarget?.mode === profile?.mode
    || sanitizeString(profileTarget?.city).toLowerCase() === sanitizeString(profile?.city).toLowerCase()
    || targetInterests.some((interest) => profileInterests.includes(interest))
  );
}

export function filterProfiles({
  profiles = DEMO_PROFILES,
  activeMode = 'all',
  likes = [],
  passed = [],
  profileMode = defaultProfile.mode,
  query = '',
  city = '',
}) {
  const normalizedQuery = sanitizeString(query).toLowerCase();
  const normalizedCity = sanitizeString(city).toLowerCase();
  const hiddenIds = new Set([...sanitizeIdList(likes), ...sanitizeIdList(passed)]);

  return profiles.filter((profileItem) => {
    if (hiddenIds.has(profileItem.id)) {
      return false;
    }

    if (activeMode !== 'all' && profileItem.mode !== activeMode) {
      return false;
    }

    if (profileMode && profileMode !== 'amoureux' && profileItem.mode !== profileMode && activeMode === 'all') {
      return false;
    }

    if (normalizedCity && !profileItem.city.toLowerCase().includes(normalizedCity)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchCorpus = [
      profileItem.name,
      profileItem.city,
      profileItem.bio,
      ...profileItem.interests,
    ].join(' ').toLowerCase();

    return searchCorpus.includes(normalizedQuery);
  });
}

export function createMatch(profileTarget, profile) {
  return {
    id: `match-${profileTarget.id}`,
    profileId: profileTarget.id,
    name: profileTarget.name,
    city: profileTarget.city,
    mode: profileTarget.mode,
    avatar: profileTarget.avatar,
    lastMessage: 'Nouveau match local',
    reason: buildMatchReason(profileTarget, profile),
  };
}

export function createConversation(profileTarget) {
  return {
    id: `conv-${profileTarget.id}`,
    profileId: profileTarget.id,
    name: profileTarget.name,
    mode: profileTarget.mode,
    avatar: profileTarget.avatar,
    messages: [
      {
        id: `welcome-${profileTarget.id}`,
        sender: 'them',
        text: `Bonjour, je suis ravi${profileTarget.name.endsWith('a') || profileTarget.name.endsWith('e') ? 'e' : ''} de commencer cette conversation locale avec vous.`,
      },
    ],
  };
}

export function applyLikeAction({
  profileId,
  profile,
  likes = [],
  passed = [],
  matches = [],
  conversations = [],
  profiles = DEMO_PROFILES,
}) {
  const targetProfile = profiles.find((item) => item.id === profileId);
  if (!targetProfile) {
    return null;
  }

  const nextLikes = [...new Set([...sanitizeIdList(likes), profileId])];
  const nextPassed = sanitizeIdList(passed).filter((item) => item !== profileId);

  if (!shouldCreateMatch(targetProfile, profile)) {
    return {
      matched: false,
      targetProfile,
      likes: nextLikes,
      passed: nextPassed,
      matches,
      conversations,
      selectedConversationId: conversations.find((conversation) => conversation.profileId === profileId)?.id ?? null,
    };
  }

  const existingMatch = matches.find((match) => match.profileId === profileId);
  const nextMatch = existingMatch ?? createMatch(targetProfile, profile);
  const nextMatches = existingMatch ? matches : [nextMatch, ...matches];
  const conversationState = ensureConversationForProfile({ profileId, conversations, profiles, matches: nextMatches });

  if (!conversationState) {
    return null;
  }

  return {
    matched: true,
    targetProfile,
    likes: nextLikes,
    passed: nextPassed,
    matches: nextMatches,
    conversations: conversationState.conversations,
    selectedConversationId: conversationState.conversation.id,
  };
}

export function applyPassAction({
  profileId,
  likes = [],
  passed = [],
  matches = [],
  conversations = [],
  selectedConversationId = null,
}) {
  const nextConversations = conversations.filter((conversation) => conversation.profileId !== profileId);

  return {
    likes: sanitizeIdList(likes).filter((item) => item !== profileId),
    passed: [...new Set([...sanitizeIdList(passed), profileId])],
    matches: matches.filter((match) => match.profileId !== profileId),
    conversations: nextConversations,
    selectedConversationId: nextConversations.some((conversation) => conversation.id === selectedConversationId)
      ? selectedConversationId
      : nextConversations[0]?.id ?? null,
  };
}

export function ensureConversationForProfile({
  profileId,
  conversations = [],
  profiles = DEMO_PROFILES,
  matches = [],
}) {
  const existingConversation = conversations.find((conversation) => conversation.profileId === profileId);
  if (existingConversation) {
    return {
      conversation: existingConversation,
      conversations,
    };
  }

  const targetProfile = profiles.find((profile) => profile.id === profileId);
  const fallbackMatch = matches.find((match) => match.profileId === profileId);
  if (!targetProfile && !fallbackMatch) {
    return null;
  }

  const nextConversation = targetProfile
    ? createConversation(targetProfile)
    : {
      id: `conv-${profileId}`,
      profileId,
      name: fallbackMatch.name,
      mode: fallbackMatch.mode,
      avatar: fallbackMatch.avatar,
      messages: [
        {
          id: `seed-${profileId}`,
          sender: 'them',
          text: 'Conversation locale prête à démarrer.',
        },
      ],
    };

  return {
    conversation: nextConversation,
    conversations: [nextConversation, ...conversations],
  };
}

export function appendMessageToConversation({
  conversationId,
  text,
  conversations = [],
  matches = [],
  createId = () => `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
}) {
  const trimmedText = sanitizeString(text);
  if (!trimmedText) {
    return null;
  }

  const targetConversation = conversations.find((conversation) => conversation.id === conversationId);
  if (!targetConversation) {
    return null;
  }

  const nextMessage = {
    id: createId(),
    sender: 'me',
    text: trimmedText,
  };

  return {
    nextMessage,
    conversations: conversations.map((conversation) => (
      conversation.id === conversationId
        ? { ...conversation, messages: [...conversation.messages, nextMessage] }
        : conversation
    )),
    matches: matches.map((match) => (
      match.profileId === targetConversation.profileId
        ? { ...match, lastMessage: trimmedText }
        : match
    )),
  };
}

export function getConversationPreview(conversation) {
  return conversation?.messages?.[conversation.messages.length - 1]?.text ?? 'Aucun message';
}

export function loadInitialState(readers) {
  const profileResult = readers.profile();
  const likesResult = readers.likes();
  const passedResult = readers.passed();
  const matchesResult = readers.matches();
  const messagesResult = readers.messages();

  const recoveredKeys = Object.entries({
    profile: profileResult.recovered,
    likes: likesResult.recovered,
    passed: passedResult.recovered,
    matches: matchesResult.recovered,
    messages: messagesResult.recovered,
  })
    .filter(([, recovered]) => recovered)
    .map(([key]) => key);

  return {
    profile: profileResult.data,
    likes: likesResult.data,
    passed: passedResult.data,
    matches: matchesResult.data,
    messages: messagesResult.data,
    recoveredKeys,
    storageAvailable: ![profileResult, likesResult, passedResult, matchesResult, messagesResult]
      .every((result) => result.error === 'storage-unavailable'),
  };
}
