import test from 'node:test';
import assert from 'node:assert/strict';

import { answerLocalPrompt } from './local-ai.js';

test('answerLocalPrompt ranks profiles from shared interests and matching mode', () => {
  const answer = answerLocalPrompt('Quels profils pourraient me correspondre ?', {
    profile: { mode: 'amoureux', interests: 'musique, voyage' },
    profiles: [
      { name: 'Mila', mode: 'amoureux', interests: ['musique'] },
      { name: 'Yanis', mode: 'amical', interests: ['sport'] },
    ],
  });

  assert.match(answer, /Mila/);
  assert.match(answer, /intérêt commun pour musique/);
  assert.match(answer, /pas une garantie de compatibilité/);
  assert.doesNotMatch(answer, /Yanis/);
});

test('answerLocalPrompt creates a personalized conversation starter locally', () => {
  const answer = answerLocalPrompt('Comment démarrer une conversation ?', {
    profile: { interests: 'lecture' },
    profiles: [{ name: 'Léa', interests: ['lecture'] }],
  });

  assert.match(answer, /Bonjour Léa/);
  assert.match(answer, /aimons tous les deux lecture/);
});

test('answerLocalPrompt gives profile guidance from available profile details', () => {
  const answer = answerLocalPrompt('Comment améliorer ma bio ?', {
    profile: { name: 'Aya', city: 'Lyon', interests: 'cinéma, randonnée' },
  });

  assert.match(answer, /Aya/);
  assert.match(answer, /cinéma, randonnée/);
  assert.match(answer, /Lyon/);
});

test('answerLocalPrompt handles empty input and missing recommendation data', () => {
  assert.match(answerLocalPrompt('   '), /Écrivez une question/);
  assert.match(answerLocalPrompt('Quels matchs ?', { profiles: [] }), /pas encore assez d’affinités/);
  assert.match(answerLocalPrompt('Comment écrire ?', { profiles: [] }), /Parcourez d’abord les profils/);
});
