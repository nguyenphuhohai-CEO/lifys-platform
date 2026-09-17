function toTitleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((chunk) => `${chunk[0]?.toUpperCase() || ''}${chunk.slice(1)}`)
    .join(' ');
}

export function parseInterests(value) {
  const normalized = Array.isArray(value) ? value.join(',') : value;
  return (normalized || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry, index, list) => list.indexOf(entry) === index);
}

export function formatInterests(value) {
  return parseInterests(value).map(toTitleCase).join(', ');
}

export function isPotentialMatch(userProfile, candidate) {
  const modeCompatible = candidate.mode === (userProfile?.mode || 'amoureux');
  const cityCompatible =
    candidate.city.toLowerCase() === (userProfile?.city || '').trim().toLowerCase();
  const profileInterests = parseInterests(userProfile?.interests || '');
  const interestCompatible = profileInterests.some((interest) =>
    candidate.interests.some((candidateInterest) => candidateInterest.toLowerCase() === interest)
  );

  return modeCompatible || cityCompatible || interestCompatible;
}

export function filterProfiles({
  profiles,
  activeMode,
  likes,
  passed,
  profileMode,
  searchTerm,
  cityFilter,
}) {
  const query = searchTerm.trim().toLowerCase();
  const city = cityFilter.trim().toLowerCase();

  return profiles.filter((profileItem) => {
    const isNotSaved = !likes.includes(profileItem.id) && !passed.includes(profileItem.id);
    const modeMatch = activeMode === 'all' ? true : profileItem.mode === activeMode;
    const sameModeBanner = profileItem.mode === profileMode || profileMode === 'amoureux';
    const searchMatch =
      !query ||
      profileItem.name.toLowerCase().includes(query) ||
      profileItem.bio.toLowerCase().includes(query) ||
      profileItem.interests.some((interest) => interest.toLowerCase().includes(query));
    const cityMatch = !city || profileItem.city.toLowerCase().includes(city);

    return isNotSaved && modeMatch && sameModeBanner && searchMatch && cityMatch;
  });
}
