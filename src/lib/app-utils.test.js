import test from 'node:test';
import assert from 'node:assert/strict';
import { filterProfiles, normalizeInterests, sanitizeMessages, sanitizeProfile, shouldCreateMatch, validateProfile } from './app-utils.js';

const profiles = [
  { id: '1', name: 'Alice', bio: 'Sport et voyages', interests: ['sport', 'voyage'], city: 'Paris', mode: 'amical' },
  { id: '2', name: 'Bob', bio: 'Musique et lecture', interests: ['musique'], city: 'Lyon', mode: 'amoureux' },
];

test('normalizeInterests removes duplicates and trims values', () => {
  assert.deepEqual(normalizeInterests(' Sport, voyage, sport ,, '), ['sport', 'voyage']);
});

test('filterProfiles applies availability, mode, text and city filters', () => {
  const result = filterProfiles({
    profiles,
    likes: ['2'],
    passed: [],
    activeMode: 'amical',
    profileMode: 'all',
    searchText: 'sport',
    cityFilter: 'paris',
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, '1');
});

test('shouldCreateMatch returns true on city/mode/interest compatibility', () => {
  const user = { mode: 'amical', city: 'Paris', interests: 'Design, Produit' };
  const target = { mode: 'amical', city: 'paris', interests: ['design'] };
  assert.equal(shouldCreateMatch(target, user), true);
});

test('validateProfile reports missing fields and age range issues', () => {
  const errors = validateProfile({ name: '', age: 17, city: '', bio: '', interests: '' });
  assert.ok(errors.name);
  assert.ok(errors.age);
  assert.ok(errors.city);
  assert.ok(errors.bio);
});


test('shouldCreateMatch returns false when no compatibility exists', () => {
  const user = { mode: 'mariage', city: 'Paris', interests: 'lecture' };
  const target = { mode: 'amical', city: 'Lyon', interests: ['sport'] };
  assert.equal(shouldCreateMatch(target, user), false);
});

test('sanitizeProfile normalizes invalid profile fields', () => {
  const fallback = { name: '', age: 28, city: '', bio: '', interests: [], mode: 'amoureux', avatar: '' };
  const result = sanitizeProfile({ name: 'Nora', age: '999', interests: ' Musique, musique ', mode: 'unknown' }, fallback);
  assert.equal(result.name, 'Nora');
  assert.equal(result.age, 28);
  assert.deepEqual(result.interests, ['musique']);
  assert.equal(result.mode, 'amoureux');
  assert.equal(result.city, '');
});

test('sanitizeMessages falls back to defaults when messages are invalid', () => {
  const defaults = [{ id: 'conv-1', profileId: 'p1', name: 'Test', mode: 'amical', avatar: 'x', messages: [] }];
  const result = sanitizeMessages([{ id: 'broken', messages: [{ text: 42 }] }], defaults);
  assert.equal(result[0].name, 'Contact Lifys');
  assert.deepEqual(result[0].messages, []);
});
