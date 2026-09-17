import test from 'node:test';
import assert from 'node:assert/strict';
import { resetPrototypeStorage, safeReadJSON, writeJSON } from './storage.js';

function createStorageMock() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = `${value}`;
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

test('safeReadJSON reads valid values', () => {
  global.localStorage = createStorageMock();
  writeJSON('profile', { name: 'Mila' });
  const result = safeReadJSON('profile', {});
  assert.deepEqual(result.value, { name: 'Mila' });
  assert.equal(result.recovered, false);
});

test('safeReadJSON recovers from invalid JSON and clears key', () => {
  global.localStorage = createStorageMock();
  localStorage.setItem('profile', '{bad json');
  const result = safeReadJSON('profile', { name: 'fallback' });
  assert.deepEqual(result.value, { name: 'fallback' });
  assert.equal(result.recovered, true);
  assert.equal(localStorage.getItem('profile'), null);
});

test('resetPrototypeStorage removes only selected keys', () => {
  global.localStorage = createStorageMock();
  writeJSON('one', 1);
  writeJSON('two', 2);
  resetPrototypeStorage(['one']);
  assert.equal(localStorage.getItem('one'), null);
  assert.equal(localStorage.getItem('two'), '2');
});


test('safeReadJSON falls back when validate rejects parsed data', () => {
  global.localStorage = createStorageMock();
  writeJSON('likes', { bad: true });
  const result = safeReadJSON('likes', [], { validate: Array.isArray });
  assert.deepEqual(result.value, []);
  assert.equal(result.recovered, true);
  assert.equal(localStorage.getItem('likes'), null);
});

test('writeJSON returns false when setItem throws', () => {
  global.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota exceeded');
    },
    removeItem: () => {},
  };

  assert.equal(writeJSON('profile', { name: 'test' }), false);
});
