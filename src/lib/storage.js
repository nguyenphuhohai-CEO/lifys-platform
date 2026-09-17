function getStorage() {
  if (typeof globalThis === 'undefined' || !globalThis.localStorage) {
    return null;
  }
  return globalThis.localStorage;
}

export function safeReadJSON(key, fallbackValue, options = {}) {
  const { validate } = options;
  const storage = getStorage();
  if (!storage) {
    return { value: fallbackValue, recovered: false };
  }

  const raw = storage.getItem(key);

  if (raw === null) {
    return { value: fallbackValue, recovered: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      throw new Error('invalid-shape');
    }
    return { value: parsed, recovered: false };
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
    return { value: fallbackValue, recovered: true };
  }
}

export function writeJSON(key, value) {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function resetPrototypeStorage(keys) {
  const storage = getStorage();
  if (!storage) return;
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {}
  });
}
