export function safeReadJSON(key, fallbackValue, options = {}) {
  const { validate } = options;
  const raw = localStorage.getItem(key);

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
    localStorage.removeItem(key);
    return { value: fallbackValue, recovered: true };
  }
}

export function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function resetPrototypeStorage(keys) {
  keys.forEach((key) => localStorage.removeItem(key));
}
