import assert from 'node:assert/strict';
import test from 'node:test';

import { getCategoryPath, getModeFromPathname, getModeFromSearch } from './routing.js';

test('category paths use the capitalised label', () => {
  assert.equal(getCategoryPath('amical'), '/Amical');
  assert.equal(getCategoryPath('sans-lendemain'), '/Sans-lendemain');
  assert.equal(getCategoryPath('inconnu'), '/');
});

test('pathnames resolve to a mode regardless of case', () => {
  for (const [path, id] of [
    ['/Amical', 'amical'],
    ['/amoureux/', 'amoureux'],
    ['/Sans-lendemain', 'sans-lendemain'],
    ['/SansLendemain', 'sans-lendemain'],
    ['/Mariage', 'mariage'],
    ['/PROFESSIONNEL', 'professionnel'],
  ]) {
    assert.equal(getModeFromPathname(path)?.id, id);
  }
  assert.equal(getModeFromPathname('/'), null);
  assert.equal(getModeFromPathname('/api/health'), null);
});

test('mode query parameter is validated', () => {
  assert.equal(getModeFromSearch('?mode=mariage'), 'mariage');
  assert.equal(getModeFromSearch('?mode=x'), null);
});
