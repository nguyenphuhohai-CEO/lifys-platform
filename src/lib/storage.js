export function safeReadJSON(key, fallback, validate) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  let raw;

  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return fallback;
  }

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof validate === 'function' && !validate(parsed)) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        return fallback;
      }

      return fallback;
    }

    return parsed;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return fallback;
    }

    return fallback;
  }
}

export function writeJSON(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore blocked or full storage in the local-only demo.
  }
}

export function resetPrototypeStorage(keys) {
  if (typeof window === 'undefined') {
    return;
  }

  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore blocked storage so reset stays non-blocking.
    }
  });
}
