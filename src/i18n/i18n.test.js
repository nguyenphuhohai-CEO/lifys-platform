import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGAL_ROWS } from './legalRows.js';
import { ROWS } from './rows.js';
import { translate } from './index.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');

test('every translation row has four non-empty entries with matching placeholders', () => {
  for (const row of [...ROWS, ...LEGAL_ROWS]) {
    assert.equal(row.length, 4, `bad row: ${row[0]}`);
    for (const text of row) {
      assert.ok(typeof text === 'string' && text.trim(), `empty entry in: ${row[0]}`);
    }
    for (const text of row.slice(1)) {
      assert.equal(placeholders(text), placeholders(row[0]), `placeholder mismatch: ${row[0]}`);
    }
  }
});

test('translate falls back to the French key and interpolates variables', () => {
  assert.equal(translate('fr', 'Bienvenue sur Lifys !'), 'Bienvenue sur Lifys !');
  assert.equal(translate('en', 'Bienvenue sur Lifys !'), 'Welcome to Lifys!');
  assert.equal(translate('es', 'Texte inconnu'), 'Texte inconnu');
  assert.equal(translate('en', '{count} profils', { count: 3 }), '3 profiles');
});
