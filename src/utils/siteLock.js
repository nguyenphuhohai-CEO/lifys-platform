const HOST_PREFIXES = {
  amis: 'amical', amical: 'amical',
  love: 'amoureux', amour: 'amoureux', amoureux: 'amoureux',
  ephemere: 'sans-lendemain', 'sans-lendemain': 'sans-lendemain',
  mariage: 'mariage',
  pro: 'professionnel', professionnel: 'professionnel',
};

// Un site dédié est déduit du sous-domaine (amis.lifys.com, pro.lifys.com…).
export function getSiteFromHostname(hostname = window.location.hostname) {
  const parts = String(hostname).toLowerCase().split('.');
  return parts.length >= 3 ? HOST_PREFIXES[parts[0]] ?? null : null;
}

export async function fetchSiteOnly() {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/site`);
    return (await response.json()).siteOnly ?? null;
  } catch {
    return null;
  }
}
