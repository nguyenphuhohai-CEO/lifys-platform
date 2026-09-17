import { describe, expect, it } from 'vitest';
import { normalizeProfileDraft } from './profile';

describe('normalizeProfileDraft', () => {
  it('normalise les intérêts et convertit l’âge', () => {
    const { profile, errors } = normalizeProfileDraft({
      name: '  Léa ',
      city: ' Paris ',
      bio: ' Curieuse ',
      interests: ' sport,Musique, sport ',
      avatar: ' https://example.com/avatar.jpg ',
      mode: 'amoureux',
      age: '29',
    });

    expect(errors).toEqual({});
    expect(profile).toMatchObject({
      name: 'Léa',
      city: 'Paris',
      bio: 'Curieuse',
      interests: 'Sport, Musique',
      age: 29,
    });
  });

  it('garde l’âge vide et signale une erreur si non renseigné', () => {
    const { profile, errors } = normalizeProfileDraft({
      name: 'Léa',
      city: 'Paris',
      bio: 'Curieuse',
      interests: '',
      avatar: '',
      mode: 'amoureux',
      age: '',
    });

    expect(profile.age).toBe('');
    expect(errors.age).toBeTruthy();
  });
});
