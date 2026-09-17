export const STORAGE_KEYS = {
  auth: 'lifys-auth',
  profile: 'lifys-profile',
  likes: 'lifys-likes',
  matches: 'lifys-matches',
  messages: 'lifys-messages',
  passed: 'lifys-passed',
};

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function safeReadJSON(key, fallbackValue, options = {}) {
  const storage = resolveStorage(options.storage);
  const sanitize = options.sanitize ?? ((value) => value);

  if (!storage) {
    return { data: fallbackValue, recovered: false, error: 'storage-unavailable' };
  }

  try {
    const rawValue = storage.getItem(key);
    if (!rawValue) {
      return { data: sanitize(fallbackValue), recovered: false, error: null };
    }

    return { data: sanitize(JSON.parse(rawValue)), recovered: false, error: null };
  } catch (error) {
    try {
      storage.removeItem(key);
    } catch {
      // ignore cleanup failure
    }

    return { data: sanitize(fallbackValue), recovered: true, error: error instanceof Error ? error.message : 'invalid-json' };
  }
}

export function safeWriteJSON(key, value, options = {}) {
  const storage = resolveStorage(options.storage);

  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function resetPrototypeStorage(keys = Object.values(STORAGE_KEYS), options = {}) {
  const storage = resolveStorage(options.storage);

  if (!storage) {
    return false;
  }

  try {
    keys.forEach((key) => storage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}
