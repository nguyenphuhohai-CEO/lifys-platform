import { describe, expect, it } from 'vitest';
import { formatInterests, getInitials } from './format';

describe('formatInterests', () => {
  it('normalise, déduplique et met en forme les intérêts', () => {
    expect(formatInterests(' sport,Musique, sport , cinema ')).toEqual(['Sport', 'Musique', 'Cinema']);
  });
});

describe('getInitials', () => {
  it('génère des initiales de fallback avatar', () => {
    expect(getInitials('Lifys Demo')).toBe('LD');
    expect(getInitials('Nora')).toBe('NO');
    expect(getInitials('')).toBe('LF');
  });
});
