import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile, DEMO_PROFILES } from '../data/demoData.js';
import {
  applyLikeAction,
  applyPassAction,
  appendMessageToConversation,
  createMatch,
  ensureConversationForProfile,
  filterProfiles,
  loadInitialState,
  normalizeInterests,
  sanitizeConversations,
  sanitizeIdList,
  sanitizeMatches,
  sanitizeProfile,
  serializeInterests,
  shouldCreateMatch,
} from './app-utils.js';
import { STORAGE_KEYS, resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './storage.js';

function createMockStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test('normalizeInterests and serializeInterests clean duplicates and casing', () => {
  assert.deepEqual(normalizeInterests(' Musique, sport, musique , Voyage '), ['musique', 'sport', 'voyage']);
  assert.equal(serializeInterests(' Musique, sport, musique , Voyage '), 'Musique, Sport, Voyage');
});

test('sanitizeProfile enforces defaults and valid age range', () => {
  assert.deepEqual(sanitizeProfile({ mode: 'inconnu', age: 12 }), defaultProfile);
  assert.equal(sanitizeProfile({ name: 'Aya', age: 30, city: 'Paris', bio: 'Bio', mode: 'amical' }).mode, 'amical');
});

test('filterProfiles applies mode, query, city and seen-profile filtering', () => {
  const filtered = filterProfiles({
    profiles: DEMO_PROFILES,
    activeMode: 'amical',
    likes: ['p4'],
    passed: [],
    profileMode: 'amical',
    query: 'musique',
    city: 'bordeaux',
  });

  assert.deepEqual(filtered.map((profile) => profile.id), ['p7']);
});

test('shouldCreateMatch and createMatch reflect compatibility reasons', () => {
  const userProfile = sanitizeProfile({
    name: 'Sofia',
    age: 29,
    city: 'Lyon',
    bio: 'Créative',
    mode: 'amoureux',
    interests: 'musique, cuisine',
  });

  const target = DEMO_PROFILES.find((profile) => profile.id === 'p2');

  assert.equal(shouldCreateMatch(target, userProfile), true);
  assert.match(createMatch(target, userProfile).reason, /amoureux|Même ville|Point commun/i);
});

test('safeReadJSON falls back and clears corrupted storage', () => {
  const storage = createMockStorage();
  storage.setItem('broken', '{oops');

  const result = safeReadJSON('broken', ['fallback'], { storage });

  assert.equal(result.recovered, true);
  assert.deepEqual(result.data, ['fallback']);
  assert.equal(storage.getItem('broken'), null);
});

test('safeWriteJSON and resetPrototypeStorage persist and clear local data', () => {
  const storage = createMockStorage();

  assert.equal(safeWriteJSON('profile', { name: 'Aya' }, { storage }), true);
  assert.deepEqual(safeReadJSON('profile', {}, { storage }).data, { name: 'Aya' });
  assert.equal(resetPrototypeStorage(['profile'], { storage }), true);
  assert.equal(storage.getItem('profile'), null);
});

test('sanitizeConversations restores defaults when conversations are invalid', () => {
  const conversations = sanitizeConversations([{ profileId: '', messages: [] }]);

  assert.ok(conversations.length >= 1);
  assert.ok(conversations.every((conversation) => conversation.messages.length >= 1));
});

test('loadInitialState reports recovered keys and keeps sanitized local data', () => {
  const storage = createMockStorage();
  storage.setItem(STORAGE_KEYS.profile, '{oops');
  storage.setItem(STORAGE_KEYS.likes, JSON.stringify(['p1', 'p1']));

  const state = loadInitialState({
    profile: () => safeReadJSON(STORAGE_KEYS.profile, defaultProfile, { storage, sanitize: sanitizeProfile }),
    likes: () => safeReadJSON(STORAGE_KEYS.likes, [], { storage, sanitize: sanitizeIdList }),
    passed: () => safeReadJSON(STORAGE_KEYS.passed, [], { storage, sanitize: sanitizeIdList }),
    matches: () => safeReadJSON(STORAGE_KEYS.matches, [], { storage, sanitize: sanitizeMatches }),
    messages: () => safeReadJSON(STORAGE_KEYS.messages, [], { storage, sanitize: sanitizeConversations }),
  });

  assert.deepEqual(state.recoveredKeys, ['profile']);
  assert.equal(state.storageAvailable, true);
  assert.deepEqual(state.likes, ['p1']);
  assert.deepEqual(state.profile, defaultProfile);
});

test('applyLikeAction avoids duplicate matches and preserves existing conversations', () => {
  const userProfile = sanitizeProfile({
    name: 'Sofia',
    age: 29,
    city: 'Lyon',
    bio: 'Créative, fiable et prête à rencontrer les bonnes personnes.',
    mode: 'amoureux',
    interests: 'musique, cuisine',
  });
  const existingMatch = createMatch(DEMO_PROFILES.find((profile) => profile.id === 'p2'), userProfile);
  const existingConversation = {
    id: 'conv-existing-p2',
    profileId: 'p2',
    name: 'Lucas',
    mode: 'amoureux',
    avatar: '',
    messages: [{ id: 'm1', sender: 'them', text: 'Salut !' }],
  };

  const result = applyLikeAction({
    profileId: 'p2',
    profile: userProfile,
    likes: ['p2'],
    passed: ['p2'],
    matches: [existingMatch],
    conversations: [existingConversation],
  });

  assert.equal(result.matched, true);
  assert.deepEqual(result.likes, ['p2']);
  assert.deepEqual(result.passed, []);
  assert.equal(result.matches.length, 1);
  assert.equal(result.conversations.length, 1);
  assert.equal(result.selectedConversationId, 'conv-existing-p2');
});

test('appendMessageToConversation adds a local message and updates the related match preview', () => {
  const conversations = [
    {
      id: 'conv-p2',
      profileId: 'p2',
      name: 'Lucas',
      mode: 'amoureux',
      avatar: '',
      messages: [{ id: 'm1', sender: 'them', text: 'Salut !' }],
    },
  ];
  const matches = [
    {
      id: 'match-p2',
      profileId: 'p2',
      name: 'Lucas',
      city: 'Lyon',
      mode: 'amoureux',
      avatar: '',
      lastMessage: 'Salut !',
      reason: 'Point commun : musique.',
    },
  ];

  const result = appendMessageToConversation({
    conversationId: 'conv-p2',
    text: ' Bonjour Lucas ',
    conversations,
    matches,
    createId: () => 'msg-new',
  });

  assert.equal(result.nextMessage.id, 'msg-new');
  assert.equal(result.conversations[0].messages.at(-1).text, 'Bonjour Lucas');
  assert.equal(result.matches[0].lastMessage, 'Bonjour Lucas');
});

test('applyPassAction removes local like, match and conversation for a passed profile', () => {
  const result = applyPassAction({
    profileId: 'p2',
    likes: ['p1', 'p2'],
    passed: [],
    matches: [{ id: 'match-p2', profileId: 'p2' }, { id: 'match-p7', profileId: 'p7' }],
    conversations: [{ id: 'conv-p2', profileId: 'p2' }, { id: 'conv-p7', profileId: 'p7' }],
    selectedConversationId: 'conv-p2',
  });

  assert.deepEqual(result.likes, ['p1']);
  assert.deepEqual(result.passed, ['p2']);
  assert.deepEqual(result.matches.map((match) => match.profileId), ['p7']);
  assert.deepEqual(result.conversations.map((conversation) => conversation.profileId), ['p7']);
  assert.equal(result.selectedConversationId, 'conv-p7');
});

test('ensureConversationForProfile reuses or creates a conversation for a matched profile', () => {
  const existing = ensureConversationForProfile({
    profileId: 'p2',
    conversations: [{ id: 'conv-existing', profileId: 'p2', messages: [] }],
  });
  const created = ensureConversationForProfile({
    profileId: 'p7',
    conversations: [],
  });

  assert.equal(existing.conversation.id, 'conv-existing');
  assert.equal(created.conversation.profileId, 'p7');
  assert.equal(created.conversations.length, 1);
});

test('ensureConversationForProfile can fallback to existing match data when profile list is unavailable', () => {
  const created = ensureConversationForProfile({
    profileId: 'p42',
    conversations: [],
    profiles: [],
    matches: [{
      id: 'match-p42',
      profileId: 'p42',
      name: 'Maya',
      mode: 'amical',
      avatar: '',
    }],
  });

  assert.equal(created.conversation.profileId, 'p42');
  assert.equal(created.conversation.name, 'Maya');
  assert.deepEqual(created.conversation.messages, []);
  assert.equal(created.conversations.length, 1);
});

test('ensureConversationForProfile returns null when neither profile nor match is available', () => {
  const result = ensureConversationForProfile({
    profileId: 'missing',
    conversations: [],
    profiles: [],
    matches: [],
  });

  assert.equal(result, null);
});
