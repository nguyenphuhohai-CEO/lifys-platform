export function safeReadJSON(key, fallbackValue, options = {}) {
  const { validate, onError } = options;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;

    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      throw new Error(`Invalid data shape for ${key}`);
    }

    return parsed;
  } catch (error) {
    localStorage.removeItem(key);
    if (onError) onError(key, error);
    return fallbackValue;
  }
}

export function safeWriteJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (_error) {
    return false;
  }
}

export function resetPrototypeStorage(keys) {
  keys.forEach((key) => localStorage.removeItem(key));
}
