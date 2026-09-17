export function safeReadJSON(key, fallbackValue, validate = () => true) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return { value: fallbackValue, recovered: false };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!validate(parsed)) {
      return { value: fallbackValue, recovered: true };
    }
    return { value: parsed, recovered: false };
  } catch {
    return { value: fallbackValue, recovered: true };
  }
}

export function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function resetPrototypeStorage(keys) {
  keys.forEach((key) => localStorage.removeItem(key));
}
