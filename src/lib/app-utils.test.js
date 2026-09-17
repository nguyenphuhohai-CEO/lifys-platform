import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROFILES } from '../data/demo.js';
import {
  filterProfiles,
  sanitizeMessages,
  sanitizeProfile,
  shouldCreateMatch,
  validateProfileInput,
} from './app-utils.js';

test('sanitizeProfile normalizes corrupted profile payloads', () => {
  const profile = sanitizeProfile({
    name: '  Ana  ',
    age: '200',
    city: '  Paris ',
    bio: '  Bonjour  ',
    interests: ' musique, Musique , voyage ',
    mode: 'unknown',
  });

  assert.equal(profile.name, 'Ana');
  assert.equal(profile.age, 28);
  assert.equal(profile.city, 'Paris');
  assert.equal(profile.interests, 'musique, voyage');
  assert.equal(profile.mode, 'amoureux');
});

test('validateProfileInput reports accessible errors for incomplete data', () => {
  const { errors } = validateProfileInput({
    name: '',
    age: '17',
    city: '',
    bio: 'trop court',
    interests: '',
    mode: 'amoureux',
    avatar: 'notaurl',
  });

  assert.deepEqual(Object.keys(errors).sort(), ['age', 'avatar', 'bio', 'city', 'name']);
});

test('filterProfiles combines category, search and city filters', () => {
  const results = filterProfiles(DEMO_PROFILES, {
    activeMode: 'professionnel',
    likedIds: [],
    passedIds: [],
    profileMode: 'amoureux',
    searchTerm: 'consultante',
    cityTerm: 'Nantes',
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'Léa');
});

test('shouldCreateMatch uses category, city or interest overlap', () => {
  assert.equal(
    shouldCreateMatch(DEMO_PROFILES[5], {
      mode: 'amical',
      city: 'Lille',
      interests: 'musique, design',
    }),
    true,
  );

  assert.equal(
    shouldCreateMatch(DEMO_PROFILES[1], {
      mode: 'professionnel',
      city: 'Marseille',
      interests: 'tennis',
    }),
    false,
  );
});

test('sanitizeMessages falls back to default demo messages for invalid payloads', () => {
  const conversations = sanitizeMessages([{ bad: true }]);
  assert.ok(conversations.length >= 1);
  assert.ok(conversations[0].messages.length >= 1);
});
