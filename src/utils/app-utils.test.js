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
import { resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './storage.js';

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

test('loadInitialState reports recovered keys when local JSON is corrupted', () => {
  const storage = createMockStorage();
  storage.setItem('profile', '{oops');

  const state = loadInitialState({
    profile: () => safeReadJSON('profile', defaultProfile, { storage, sanitize: sanitizeProfile }),
    likes: () => safeReadJSON('likes', [], { storage, sanitize: sanitizeIdList }),
    passed: () => safeReadJSON('passed', [], { storage, sanitize: sanitizeIdList }),
    matches: () => safeReadJSON('matches', [], { storage, sanitize: sanitizeMatches }),
    messages: () => safeReadJSON('messages', [], { storage, sanitize: sanitizeConversations }),
  });

  assert.deepEqual(state.recoveredKeys, ['profile']);
  assert.equal(state.storageAvailable, true);
  assert.deepEqual(state.profile, defaultProfile);
});

test('loadInitialState reports storage unavailability when every reader falls back', () => {
  const unavailableResult = { data: null, recovered: false, error: 'storage-unavailable' };

  const state = loadInitialState({
    profile: () => ({ ...unavailableResult, data: defaultProfile }),
    likes: () => ({ ...unavailableResult, data: [] }),
    passed: () => ({ ...unavailableResult, data: [] }),
    matches: () => ({ ...unavailableResult, data: [] }),
    messages: () => ({ ...unavailableResult, data: [] }),
  });

  assert.equal(state.storageAvailable, false);
  assert.deepEqual(state.recoveredKeys, []);
});
