export function normalizeInterests(value) {
  const source = Array.isArray(value) ? value.join(',') : value || '';

  return Array.from(new Set(
    source
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  ));
}

export function filterProfiles(profiles, options) {
  const {
    activeMode,
    profileMode,
    likes,
    passed,
    searchText,
    cityFilter,
  } = options;

  const normalizedSearch = searchText.trim().toLowerCase();
  const normalizedCity = cityFilter.trim().toLowerCase();

  return profiles.filter((profile) => {
    const isSaved = likes.includes(profile.id) || passed.includes(profile.id);
    if (isSaved) return false;

    const categoryMatch = activeMode === 'all' || profile.mode === activeMode;
    if (!categoryMatch) return false;

    const compatibilityMode = profileMode === 'all' || profile.mode === profileMode;
    if (!compatibilityMode) return false;

    const cityMatch = !normalizedCity || profile.city.toLowerCase().includes(normalizedCity);
    if (!cityMatch) return false;

    if (!normalizedSearch) return true;

    const searchable = [
      profile.name,
      profile.city,
      profile.bio,
      ...profile.interests,
    ].join(' ').toLowerCase();

    return searchable.includes(normalizedSearch);
  });
}

export function shouldCreateMatch(targetProfile, userProfile) {
  const targetModeMatch = targetProfile.mode === userProfile.mode;
  const cityMatch = targetProfile.city.toLowerCase() === (userProfile.city || '').trim().toLowerCase();
  const userInterests = normalizeInterests(userProfile.interests);
  const interestMatch = userInterests.some((item) =>
    targetProfile.interests.some((targetInterest) => targetInterest.toLowerCase() === item)
  );

  return targetModeMatch || cityMatch || interestMatch;
}
