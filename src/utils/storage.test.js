import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetPrototypeStorage, safeReadJSON, safeWriteJSON } from './storage';

function createStorageMock() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

describe('safeReadJSON', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('retourne la valeur fallback et supprime la clé si JSON invalide', () => {
    localStorage.setItem('bad', '{not-valid-json');
    const onError = vi.fn();

    const result = safeReadJSON('bad', ['fallback'], { onError });

    expect(result).toEqual(['fallback']);
    expect(localStorage.getItem('bad')).toBe(null);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe('bad');
    expect(onError.mock.calls[0][1]).toBeInstanceOf(Error);
  });

  it('retourne la valeur fallback si la validation échoue', () => {
    localStorage.setItem('profile', JSON.stringify({ mode: 42 }));
    const onError = vi.fn();

    const result = safeReadJSON('profile', { mode: 'amoureux' }, {
      validate: (value) => typeof value?.mode === 'string',
      onError,
    });

    expect(result).toEqual({ mode: 'amoureux' });
    expect(localStorage.getItem('profile')).toBe(null);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('retourne la valeur fallback si les messages imbriqués sont invalides', () => {
    localStorage.setItem('messages', JSON.stringify([
      { id: 'conv1', name: 'Nora', messages: [{ id: 'm1', sender: 'them', text: 42 }] }
    ]));

    const fallback = [{ id: 'safe', name: 'Safe', messages: [] }];
    const result = safeReadJSON('messages', fallback, {
      validate: (value) => Array.isArray(value) && value.every((conversation) =>
        Array.isArray(conversation.messages) && conversation.messages.every((message) =>
          typeof message.text === 'string'
        )
      ),
    });

    expect(result).toEqual(fallback);
    expect(localStorage.getItem('messages')).toBe(null);
  });
});

describe('safeWriteJSON', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('retourne true quand l’écriture réussit', () => {
    expect(safeWriteJSON('key', { ok: true })).toBe(true);
    expect(localStorage.getItem('key')).toBe(JSON.stringify({ ok: true }));
  });

  it('retourne false quand localStorage échoue', () => {
    const storageWithExistingData = createStorageMock();
    storageWithExistingData.setItem('key', JSON.stringify({ previous: true }));
    const previousValue = storageWithExistingData.getItem('key');

    const brokenStorage = {
      getItem: storageWithExistingData.getItem,
      setItem: () => { throw new Error('quota'); },
      removeItem: storageWithExistingData.removeItem,
    };
    vi.stubGlobal('localStorage', brokenStorage);

    expect(safeWriteJSON('key', { ok: true })).toBe(false);
    expect(localStorage.getItem('key')).toBe(previousValue);
  });
});

describe('resetPrototypeStorage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('localStorage', createStorageMock());
  });

  it('supprime toutes les clés demandées', () => {
    localStorage.setItem('a', '1');
    localStorage.setItem('b', '2');
    localStorage.setItem('c', '3');

    resetPrototypeStorage(['a', 'c']);

    expect(localStorage.getItem('a')).toBe(null);
    expect(localStorage.getItem('b')).toBe('2');
    expect(localStorage.getItem('c')).toBe(null);
  });
});
