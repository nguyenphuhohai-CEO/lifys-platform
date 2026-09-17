export function safeReadJSON(key, fallback, validate) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof validate === 'function' && !validate(parsed)) {
      window.localStorage.removeItem(key);
      return fallback;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function resetPrototypeStorage(keys) {
  if (typeof window === 'undefined') {
    return;
  }

  keys.forEach((key) => window.localStorage.removeItem(key));
}
