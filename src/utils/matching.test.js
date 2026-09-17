import { describe, expect, it } from 'vitest';
import { filterProfiles, shouldCreateMatch } from './matching';

const profiles = [
  { id: '1', name: 'Aline', city: 'Paris', bio: 'Sport et design', interests: ['sport', 'design'], mode: 'professionnel' },
  { id: '2', name: 'Noah', city: 'Lyon', bio: 'Cuisine et nature', interests: ['cuisine'], mode: 'amoureux' },
  { id: '3', name: 'Mia', city: 'Paris', bio: 'Art et café', interests: ['art'], mode: 'amoureux' },
];

describe('filterProfiles', () => {
  it('filtre par catégorie, ville et recherche', () => {
    const result = filterProfiles(profiles, {
      activeMode: 'amoureux',
      profileMode: 'amoureux',
      likes: [],
      passed: [],
      searchText: 'art',
      cityFilter: 'paris',
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  it('exclut les profils déjà likés ou passés', () => {
    const result = filterProfiles(profiles, {
      activeMode: 'all',
      profileMode: 'all',
      likes: ['1'],
      passed: ['2'],
      searchText: '',
      cityFilter: '',
    });

    expect(result.map((item) => item.id)).toEqual(['3']);
  });
});

describe('shouldCreateMatch', () => {
  it('retourne true avec ville ou intérêts compatibles', () => {
    expect(shouldCreateMatch(
      { mode: 'amical', city: 'Paris', interests: ['musique'] },
      { mode: 'professionnel', city: 'Paris', interests: 'sport, musique' }
    )).toBe(true);
  });

  it('retourne false si aucun critère ne correspond', () => {
    expect(shouldCreateMatch(
      { mode: 'amical', city: 'Lille', interests: ['lecture'] },
      { mode: 'professionnel', city: 'Paris', interests: 'sport, musique' }
    )).toBe(false);
  });
});
