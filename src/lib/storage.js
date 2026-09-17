function cloneFallback(fallback) {
  if (typeof structuredClone === 'function') {
    return structuredClone(fallback);
  }

  return JSON.parse(JSON.stringify(fallback));
}

export function safeReadJSON(key, fallback, options = {}) {
  const { storage = globalThis?.localStorage, validate } = options;

  if (!storage) {
    return cloneFallback(fallback);
  }

  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return cloneFallback(fallback);
    }

    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      return cloneFallback(fallback);
    }

    return parsed;
  } catch {
    return cloneFallback(fallback);
  }
}

export function writeJSON(key, value, options = {}) {
  const { storage = globalThis?.localStorage } = options;

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

export function resetPrototypeStorage(keys, options = {}) {
  const { storage = globalThis?.localStorage } = options;

  if (!storage) {
    return;
  }

  keys.forEach((key) => storage.removeItem(key));
}
