import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultProfile, DEMO_PROFILES } from '../data/demoData.js';
import {
  createMatch,
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
