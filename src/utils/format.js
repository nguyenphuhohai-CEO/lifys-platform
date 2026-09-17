export function formatInterests(value) {
  const interests = Array.isArray(value) ? value : (value || '').split(',');

  return Array.from(new Set(
    interests
      .map((interest) => interest.trim())
      .filter(Boolean)
      .map((interest) => interest.charAt(0).toUpperCase() + interest.slice(1).toLowerCase())
  ));
}

export function getInitials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'LF';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}
